import type { AgentService } from "@bantuin/agent";
import { createId } from "@bantuin/core";
import {
  type AutomationRecord,
  AutomationRepository,
  type BantuinDatabase,
  ProfileRepository,
  type RunRecord,
  type TaskRecord,
  TaskRepository,
} from "@bantuin/db";

const RUN_TIMEOUT_MS = 60_000;
const RUN_OUTPUT_MAX_CHARS = 32_000;

export function safeRunText(value: string): string {
  return value
    .replaceAll(/(bearer\s+)[a-z0-9._~+/-]+/giu, "$1[REDACTED]")
    .replaceAll(/((?:api[_-]?key|password|token)\s*[:=]\s*)\S+/giu, "$1[REDACTED]")
    .slice(0, RUN_OUTPUT_MAX_CHARS);
}

function cronPartMatches(part: string, value: number, minimum: number, maximum: number): boolean {
  return part.split(",").some((item) => {
    if (!/^(?:\*|\d+(?:-\d+)?)(?:\/\d+)?$/u.test(item)) return false;
    const [range = "", stepText] = item.split("/", 2);
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) return false;
    const [startText = "", endText] = range.split("-", 2);
    const start = range === "*" ? minimum : Number(startText);
    const resolvedEnd = range === "*" ? maximum : endText ? Number(endText) : start;
    if (!Number.isInteger(start) || start < minimum || start > maximum) return false;
    return (
      resolvedEnd >= start &&
      resolvedEnd <= maximum &&
      value >= start &&
      value <= resolvedEnd &&
      (value - start) % step === 0
    );
  });
}

export function cronMatches(cron: string, date: Date, timezone: string): boolean {
  const fields = cron.trim().split(/\s+/u);
  if (fields.length !== 5) return false;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      minute: "numeric",
      hour: "numeric",
      day: "numeric",
      month: "numeric",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfMonth = cronPartMatches(fields[2] ?? "", Number(parts.day), 1, 31);
  const dayOfWeek = cronPartMatches(fields[4] ?? "", weekdays[parts.weekday ?? ""] ?? -1, 0, 6);
  const dayMatches =
    fields[2] === "*" ? dayOfWeek : fields[4] === "*" ? dayOfMonth : dayOfMonth || dayOfWeek;
  return (
    cronPartMatches(fields[0] ?? "", Number(parts.minute), 0, 59) &&
    cronPartMatches(fields[1] ?? "", Number(parts.hour), 0, 23) &&
    cronPartMatches(fields[3] ?? "", Number(parts.month), 1, 12) &&
    dayMatches
  );
}

export function validCron(cron: string): boolean {
  const fields = cron.trim().split(/\s+/u);
  const limits = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ] as const;
  return (
    fields.length === 5 &&
    fields.every((field, index) => {
      const [minimum, maximum] = limits[index] ?? [0, -1];
      return Array.from({ length: maximum - minimum + 1 }, (_, offset) => minimum + offset).some(
        (value) => cronPartMatches(field, value, minimum, maximum),
      );
    })
  );
}

export class SafeActionService {
  readonly tasks: TaskRepository;
  readonly automations: AutomationRepository;
  readonly profiles: ProfileRepository;
  readonly #agent: AgentService;
  readonly #active = new Map<string, { controller: AbortController; ownerId: string }>();
  readonly #pending = new Set<Promise<void>>();

  constructor(database: BantuinDatabase, agent: AgentService) {
    this.tasks = new TaskRepository(database);
    this.automations = new AutomationRepository(database);
    this.profiles = new ProfileRepository(database);
    this.#agent = agent;
    const now = new Date().toISOString();
    this.tasks.recoverExpired(now);
    this.automations.recoverExpired(now);
  }

  startTask(task: TaskRecord): RunRecord | null {
    const run = this.#newRun(createId("taskRun"));
    if (!this.tasks.createRun(task.id, run)) return null;
    this.#track(
      this.#execute(run, task.ownerId, task.profileId, task.prompt, (status, output, error) => {
        this.tasks.finishRun(run.id, status, new Date().toISOString(), output, error);
        const current = this.tasks.find(task.id, task.ownerId);
        if (current)
          this.tasks.update({
            ...current,
            status: status === "completed" ? "done" : "failed",
            updatedAt: new Date().toISOString(),
          });
      }),
    );
    return run;
  }

  startAutomation(
    item: AutomationRecord,
    occurrenceKey = `manual:${crypto.randomUUID()}`,
    scheduledFor: string | null = null,
  ): RunRecord | null {
    const run = this.#newRun(createId("automationRun"));
    if (!this.automations.claimRun(item.id, occurrenceKey, scheduledFor, run)) return null;
    this.#track(
      this.#execute(run, item.ownerId, item.profileId, item.prompt, (status, output, error) => {
        this.automations.finishRun(run.id, status, new Date().toISOString(), output, error);
      }),
    );
    return run;
  }

  cancel(runId: string, ownerId: string): boolean {
    const active = this.#active.get(runId);
    if (!active || active.ownerId !== ownerId) return false;
    active.controller.abort();
    return true;
  }

  async stop(): Promise<void> {
    for (const active of this.#active.values()) active.controller.abort();
    await Promise.allSettled(this.#pending);
  }

  #track(execution: Promise<void>): void {
    this.#pending.add(execution);
    void execution.finally(() => this.#pending.delete(execution));
  }

  tick(date = new Date()): number {
    let claimed = 0;
    const scheduledFor = `${date.toISOString().slice(0, 16)}:00.000Z`;
    for (const item of this.automations.listScheduled()) {
      if (!item.cron || !cronMatches(item.cron, date, item.timezone)) continue;
      if (this.startAutomation(item, `schedule:${scheduledFor}`, scheduledFor)) claimed += 1;
    }
    return claimed;
  }

  #newRun(id: string): RunRecord {
    const started = new Date();
    return {
      id,
      status: "running",
      startedAt: started.toISOString(),
      completedAt: null,
      leaseExpiresAt: new Date(started.getTime() + RUN_TIMEOUT_MS).toISOString(),
      output: null,
      error: null,
    };
  }

  async #execute(
    run: RunRecord,
    ownerId: string,
    profileId: string,
    prompt: string,
    finish: (
      status: "completed" | "failed" | "cancelled",
      output: string | null,
      error: string | null,
    ) => void,
  ): Promise<void> {
    const row = this.profiles.findById(profileId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
    this.#active.set(run.id, { controller, ownerId });
    let output = "";
    try {
      for await (const event of this.#agent.streamReply(
        {
          requestId: run.id,
          messages: [
            ...(row?.systemPrompt ? [{ role: "system" as const, content: row.systemPrompt }] : []),
            { role: "user" as const, content: prompt },
          ],
          ...(row?.providerModel ? { model: row.providerModel } : {}),
        },
        { signal: controller.signal },
      )) {
        if (event.type === "message.delta")
          output = (output + event.delta).slice(0, RUN_OUTPUT_MAX_CHARS);
        if (event.type === "message.error") throw new Error(event.message);
      }
      finish("completed", safeRunText(output), null);
    } catch (error) {
      const cancelled = controller.signal.aborted;
      finish(
        cancelled ? "cancelled" : "failed",
        output ? safeRunText(output) : null,
        cancelled
          ? "RUN_CANCELLED_OR_TIMED_OUT"
          : safeRunText(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      clearTimeout(timeout);
      this.#active.delete(run.id);
    }
  }
}
