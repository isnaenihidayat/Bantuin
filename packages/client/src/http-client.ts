import { parseSseFrames } from "./sse";

export type BantuinClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class BantuinClient {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  private cookie = "";

  constructor(options: BantuinClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:4310").replace(/\/$/u, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async login(email: string, password: string): Promise<void> {
    const response = await this.request("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const setCookie = response.headers.get("set-cookie");
    const cookie = setCookie?.split(";", 1)[0];
    if (!cookie) throw new Error("Bantuin login did not return a session cookie");
    this.cookie = cookie;
  }

  async createSession(channel: "web" | "cli" = "cli"): Promise<string> {
    const response = await this.json<{ session: { id: string } }>("/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ channel }),
    });
    return response.session.id;
  }

  async claimTelegramMessage(input: {
    externalUserId: string;
    externalMessageId: string;
  }): Promise<{ sessionId: string; duplicate: boolean }> {
    return this.json("/v1/channels/telegram/claims", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async sendMessage(
    sessionId: string,
    message: string,
    clientRequestId: string = crypto.randomUUID(),
  ) {
    const response = await this.request(`/v1/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, clientRequestId }),
    });
    let reply = "";
    for (const frame of parseSseFrames(await response.text())) {
      if (frame.event === "message.delta") {
        const event = JSON.parse(frame.data) as { delta?: unknown };
        if (typeof event.delta === "string") reply += event.delta;
      }
      if (frame.event === "message.error") {
        const event = JSON.parse(frame.data) as { message?: unknown };
        throw new Error(
          typeof event.message === "string" ? event.message : "Bantuin stream failed",
        );
      }
    }
    return reply;
  }

  async status(): Promise<Record<string, unknown>> {
    return this.json("/v1/system/status");
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    return (await this.request(path, init)).json() as Promise<T>;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (this.cookie) headers.set("cookie", this.cookie);
    if (init.method && !["GET", "HEAD"].includes(init.method)) {
      headers.set("origin", this.baseUrl);
      headers.set("x-csrf-token", "1");
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (response.ok) return response;
    let message = `Bantuin request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: unknown } };
      if (typeof body.error?.message === "string") message = body.error.message;
    } catch {
      // Keep the stable status fallback.
    }
    throw new Error(message);
  }
}
