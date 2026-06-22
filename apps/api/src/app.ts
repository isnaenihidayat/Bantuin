import { type AgentService, assembleContext } from "@bantuin/agent";
import { encodeSseFrame } from "@bantuin/client";
import {
  BANTUIN_API_VERSION,
  type AppConfig,
  AppError,
  createId,
  toErrorEnvelope,
} from "@bantuin/core";
import {
  AuthRepository,
  AttachmentRepository,
  chunkKnowledgeText,
  checkDatabase,
  type BantuinDatabase,
  KnowledgeRepository,
  MessageRepository,
  type MessageRecord,
  MemoryRepository,
  type MemoryStatus,
  type MemoryType,
  ProfileRepository,
  SessionRepository,
} from "@bantuin/db";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "hono/bun";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";

type Variables = {
  requestId: string;
};

type AppContext = Context<{ Variables: Variables }>;

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 5 * 60 * 1_000;
const LOGIN_MAX_FAILURES = 5;
const KNOWLEDGE_MAX_BYTES = 1024 * 1024;
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 5;
const memoryTypes = ["preference", "fact", "goal", "note"] as const;
const memoryStatuses = ["active", "archived"] as const;

function createSessionToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

function hashSessionToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export type AppDependencies = {
  config: AppConfig;
  database: BantuinDatabase;
  agent: AgentService;
};

const healthSchema = z.object({
  status: z.literal("ok"),
  apiVersion: z.string(),
  timestamp: z.string(),
});

const readinessSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z.object({
    database: z.enum(["ok", "error"]),
    providerConfiguration: z.enum(["ok", "error"]),
  }),
  timestamp: z.string(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      content: { "application/json": { schema: healthSchema } },
      description: "Process liveness",
    },
  },
});

const readinessRoute = createRoute({
  method: "get",
  path: "/ready",
  responses: {
    200: {
      content: { "application/json": { schema: readinessSchema } },
      description: "Dependency readiness",
    },
    503: {
      content: { "application/json": { schema: readinessSchema } },
      description: "One or more dependencies are unavailable",
    },
  },
});

export function createApp(dependencies: AppDependencies) {
  const app = new OpenAPIHono<{ Variables: Variables }>();
  const auth = new AuthRepository(dependencies.database);
  const profiles = new ProfileRepository(dependencies.database);
  const sessions = new SessionRepository(dependencies.database);
  const messageRepository = new MessageRepository(dependencies.database);
  const memories = new MemoryRepository(dependencies.database);
  const knowledge = new KnowledgeRepository(dependencies.database);
  const attachments = new AttachmentRepository(dependencies.database);
  const activeStreams = new Map<string, AbortController>();
  // ponytail: single-process limiter; move to shared storage before horizontal deployment.
  const loginFailures = new Map<string, { count: number; resetAt: number }>();
  const secureCookies = new URL(dependencies.config.publicOrigin).protocol === "https:";
  const sessionCookie = secureCookies ? "__Host-bantuin_session" : "bantuin_session";
  messageRepository.reconcileInterrupted(new Date().toISOString());

  function startSession(context: AppContext, ownerId: string): void {
    const token = createSessionToken();
    const createdAt = new Date();
    auth.createSession({
      tokenHash: hashSessionToken(token),
      ownerId,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + SESSION_MAX_AGE_SECONDS * 1_000).toISOString(),
    });
    setCookie(context, sessionCookie, token, {
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
      secure: secureCookies,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    context.header("cache-control", "no-store");
  }

  function currentOwner(context: AppContext) {
    const token = getCookie(context, sessionCookie);
    const owner = token
      ? auth.findOwnerBySession(hashSessionToken(token), new Date().toISOString())
      : null;
    if (!owner) {
      throw new AppError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        status: 401,
      });
    }
    return owner;
  }

  function publicSources(messageId: string) {
    return knowledge
      .listMessageSources(messageId)
      .map(({ chunkId, documentId, sourceName, ordinal }) => ({
        chunkId,
        documentId,
        sourceName,
        ordinal,
      }));
  }

  function publicAttachments(messageId: string) {
    return attachments.list(messageId).map((item) => ({
      id: item.id,
      kind: item.kind,
      filename: item.filename,
      mediaType: item.mediaType,
      bytes: item.bytes,
      data: Buffer.from(item.content).toString("base64"),
    }));
  }

  function checkpointDeletedContent(): void {
    dependencies.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  }

  function validateProfileModel(model: string | null): void {
    const configured =
      dependencies.config.provider.kind === "openrouter"
        ? dependencies.config.provider.model
        : "mock";
    if (model && model !== configured) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Model is not available from the configured provider",
        status: 400,
      });
    }
  }

  function streamAssistant(
    context: AppContext,
    assistant: MessageRecord,
    created: boolean,
  ): Response {
    const owner = currentOwner(context);
    const requestId = context.get("requestId");
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const providerSignal = AbortSignal.any([abortController.signal, AbortSignal.timeout(120_000)]);
    activeStreams.set(assistant.id, abortController);
    context.req.raw.signal.addEventListener("abort", () => abortController.abort(), { once: true });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let terminal = false;
        const emit = (event: string | undefined, data: unknown) =>
          controller.enqueue(
            encoder.encode(
              encodeSseFrame({
                ...(event ? { event } : {}),
                data: typeof data === "string" ? data : JSON.stringify(data),
              }),
            ),
          );

        try {
          emit("message.accepted", assistant);
          if (!created) {
            emit(undefined, "[DONE]");
            terminal = true;
            return;
          }

          const session = sessions.findByIdForOwner(assistant.sessionId, owner.id);
          const profile = session ? profiles.findByIdForOwner(session.profileId, owner.id) : null;
          if (!session || !profile || profile.archivedAt) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "Session profile is unavailable",
              status: 409,
            });
          }
          const history = messageRepository
            .list(assistant.sessionId)
            .filter((message) => message.id !== assistant.id && message.status === "completed")
            .map((message) => {
              const messageAttachments = attachments.list(message.id);
              if (message.role !== "user" || !messageAttachments.length) {
                return { role: message.role, content: message.content };
              }
              const documentText = messageAttachments
                .filter((item) => item.kind === "document")
                .map(
                  (item) =>
                    `\n\n[${item.filename ?? "dokumen"}]\n${new TextDecoder().decode(item.content)}`,
                )
                .join("");
              return {
                role: message.role,
                content: `${message.content}${documentText}`,
              };
            });
          const query = history.findLast((message) => message.role === "user")?.content ?? "";
          const foundSources = knowledge.search(owner.id, profile.id, query, 5);
          const contextWindowTokens = await dependencies.agent.contextWindowTokens();
          const assembled = assembleContext({
            contextWindowTokens,
            systemPrompt: profile?.systemPrompt ?? "",
            memories: memories.list(owner.id, "active"),
            sources: foundSources,
            history,
          });
          const latestUser = assembled.messages.findLast((message) => message.role === "user");
          const latestStoredUser = messageRepository
            .list(assistant.sessionId)
            .filter((message) => message.role === "user" && message.status === "completed")
            .at(-1);
          const imageAttachments = latestStoredUser
            ? attachments.list(latestStoredUser.id).filter((item) => item.kind === "image")
            : [];
          if (latestUser && imageAttachments.length) {
            latestUser.images = imageAttachments.map((item) => ({
              mediaType: item.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: Buffer.from(item.content).toString("base64"),
            }));
          }
          const selectedSources = foundSources.filter((source) =>
            assembled.sources.some((selected) => selected.chunkId === source.chunkId),
          );
          knowledge.recordMessageSources(assistant.id, selectedSources);
          if (selectedSources.length) {
            emit(
              "context.sources",
              selectedSources.map(({ chunkId, documentId, sourceName, ordinal }) => ({
                chunkId,
                documentId,
                sourceName,
                ordinal,
              })),
            );
          }

          for await (const event of dependencies.agent.streamReply(
            {
              requestId,
              messages: assembled.messages,
              ...(profile.providerModel ? { model: profile.providerModel } : {}),
              maxTokens: Math.min(2_048, Math.floor(contextWindowTokens / 4)),
            },
            { signal: providerSignal },
          )) {
            if (event.type === "message.delta") {
              messageRepository.appendDelta(assistant.id, event.delta, new Date().toISOString());
            } else if (event.type === "message.error") {
              messageRepository.finish(assistant.id, "failed", new Date().toISOString(), {
                errorCode: event.code,
              });
              terminal = true;
            } else if (event.type === "message.completed") {
              messageRepository.finish(assistant.id, "completed", new Date().toISOString(), {
                ...(event.providerRequestId ? { providerRequestId: event.providerRequestId } : {}),
              });
              terminal = true;
            }
            emit(event.type, event);
            if (event.type === "message.error") break;
          }

          if (!terminal) {
            messageRepository.finish(assistant.id, "failed", new Date().toISOString(), {
              errorCode: "PROVIDER_STREAM_FAILED",
            });
            emit("message.error", {
              type: "message.error",
              code: "PROVIDER_STREAM_FAILED",
              message: "Provider stream ended unexpectedly",
              retryable: true,
              partial: true,
            });
          }
          emit(undefined, "[DONE]");
        } catch (error) {
          const cancelled = abortController.signal.aborted;
          messageRepository.finish(
            assistant.id,
            cancelled ? "cancelled" : "failed",
            new Date().toISOString(),
            { errorCode: cancelled ? "CANCELLED" : "PROVIDER_STREAM_FAILED" },
          );
          try {
            emit(
              cancelled ? "message.cancelled" : "message.error",
              cancelled
                ? { type: "message.cancelled", messageId: assistant.id }
                : toErrorEnvelope(error, requestId).error,
            );
            emit(undefined, "[DONE]");
          } catch {
            // Client disconnected; durable state was already written above.
          }
        } finally {
          activeStreams.delete(assistant.id);
          try {
            controller.close();
          } catch {
            // Stream may already be cancelled by the client.
          }
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }

  app.use("*", async (context, next) => {
    const requestId = context.req.header("x-request-id") || createId("request");
    context.set("requestId", requestId);
    context.header("x-request-id", requestId);
    await next();
  });

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      },
    }),
  );
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: 1_100_000,
      onError: (context) =>
        context.json(
          toErrorEnvelope(
            new AppError({
              code: "VALIDATION_FAILED",
              message: "Request body is too large",
              status: 413,
            }),
            context.get("requestId"),
          ),
          413,
        ),
    }),
  );

  app.use("/v1/*", async (context, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(context.req.method)) {
      const origin = context.req.header("origin");
      const csrfHeader = context.req.header("x-csrf-token");
      if (origin !== dependencies.config.publicOrigin || csrfHeader !== "1") {
        throw new AppError({
          code: "CSRF_REJECTED",
          message: "Cross-site request rejected",
          status: 403,
        });
      }
    }
    await next();
  });

  app.openapi(healthRoute, (context) =>
    context.json(
      {
        status: "ok" as const,
        apiVersion: BANTUIN_API_VERSION,
        timestamp: new Date().toISOString(),
      },
      200,
    ),
  );

  app.openapi(readinessRoute, (context) => {
    const database = checkDatabase(dependencies.database) ? "ok" : "error";
    const providerConfiguration = dependencies.config.provider ? "ok" : "error";
    const status = database === "ok" && providerConfiguration === "ok" ? "ready" : "not_ready";
    const response = {
      status,
      checks: { database, providerConfiguration },
      timestamp: new Date().toISOString(),
    } as const;

    return status === "ready" ? context.json(response, 200) : context.json(response, 503);
  });

  app.get("/v1/setup/status", (context) => context.json({ setupComplete: auth.isSetupComplete() }));

  app.post("/v1/setup", async (context) => {
    if (auth.isSetupComplete()) {
      throw new AppError({
        code: "SETUP_ALREADY_COMPLETED",
        message: "Setup has already been completed",
        status: 409,
      });
    }

    const input = z
      .object({
        email: z.email().transform((value) => value.toLowerCase()),
        password: z.string().min(12).max(128),
        assistantName: z.string().trim().min(1).max(80).default("Bantuin"),
      })
      .parse(await context.req.json());
    const now = new Date().toISOString();
    const owner = { id: createId("owner"), email: input.email, createdAt: now };
    const profile = {
      id: createId("profile"),
      ownerId: owner.id,
      name: input.assistantName,
      systemPrompt: "Kamu adalah asisten pribadi yang membantu dalam Bahasa Indonesia.",
      providerModel: null,
      createdAt: now,
      updatedAt: now,
    };
    const created = auth.createSetup({
      owner,
      profile,
      passwordHash: await Bun.password.hash(input.password, "argon2id"),
    });
    if (!created) {
      throw new AppError({
        code: "SETUP_ALREADY_COMPLETED",
        message: "Setup has already been completed",
        status: 409,
      });
    }

    startSession(context, owner.id);
    return context.json({ owner, profile }, 201);
  });

  app.post("/v1/auth/login", async (context) => {
    const input = z
      .object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string() })
      .parse(await context.req.json());
    const attempt = loginFailures.get(input.email);
    if (attempt && attempt.count >= LOGIN_MAX_FAILURES && attempt.resetAt > Date.now()) {
      throw new AppError({
        code: "AUTHENTICATION_RATE_LIMITED",
        message: "Too many login attempts; try again later",
        status: 429,
      });
    }
    const credentials = auth.findCredentialsByEmail(input.email);
    let passwordMatches = false;
    if (credentials) {
      passwordMatches = await Bun.password.verify(input.password, credentials.passwordHash);
    } else {
      await Bun.password.hash(input.password);
    }

    if (!credentials || !passwordMatches) {
      const activeWindow = Boolean(attempt && attempt.resetAt > Date.now());
      const count = (activeWindow ? (attempt?.count ?? 0) : 0) + 1;
      loginFailures.set(input.email, {
        count,
        resetAt: activeWindow ? (attempt?.resetAt ?? 0) : Date.now() + LOGIN_WINDOW_MS,
      });
      throw new AppError({
        code: "AUTHENTICATION_FAILED",
        message: "Email or password is incorrect",
        status: 401,
      });
    }

    loginFailures.delete(input.email);
    startSession(context, credentials.id);
    const owner = {
      id: credentials.id,
      email: credentials.email,
      createdAt: credentials.createdAt,
    };
    return context.json({ owner, profile: profiles.findByOwnerId(credentials.id) });
  });

  app.post("/v1/auth/logout", (context) => {
    const token = getCookie(context, sessionCookie);
    if (token) auth.deleteSession(hashSessionToken(token));
    deleteCookie(context, sessionCookie, { path: "/", secure: secureCookies });
    context.header("cache-control", "no-store");
    return context.body(null, 204);
  });

  app.get("/v1/me", (context) => {
    const owner = currentOwner(context);
    context.header("cache-control", "no-store");
    return context.json({ owner, profile: profiles.findByOwnerId(owner.id) });
  });

  app.get("/v1/profile", (context) => {
    const owner = currentOwner(context);
    return context.json({ profile: profiles.findByOwnerId(owner.id) });
  });

  app.patch("/v1/profile", async (context) => {
    const owner = currentOwner(context);
    const current = profiles.findByOwnerId(owner.id);
    if (!current) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Profile not found", status: 404 });
    }
    const input = z
      .object({
        name: z.string().trim().min(1).max(80).default(current.name),
        systemPrompt: z.string().trim().max(8_000).default(current.systemPrompt),
        providerModel: z.string().trim().min(1).max(180).nullable().default(current.providerModel),
      })
      .parse(await context.req.json());
    validateProfileModel(input.providerModel);
    profiles.update(current.id, owner.id, { ...input, updatedAt: new Date().toISOString() });
    return context.json({ profile: profiles.findByOwnerId(owner.id) });
  });

  app.get("/v1/profiles", (context) => {
    const owner = currentOwner(context);
    return context.json({ profiles: profiles.list(owner.id) });
  });

  app.post("/v1/profiles", async (context) => {
    const owner = currentOwner(context);
    const input = z
      .object({
        name: z.string().trim().min(1).max(80),
        systemPrompt: z.string().trim().max(8_000).default(""),
        providerModel: z.string().trim().min(1).max(180).nullable().default(null),
      })
      .parse(await context.req.json());
    validateProfileModel(input.providerModel);
    const now = new Date().toISOString();
    const profile = {
      id: createId("profile"),
      ownerId: owner.id,
      ...input,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    profiles.create(profile);
    return context.json({ profile }, 201);
  });

  app.patch("/v1/profiles/:id", async (context) => {
    const owner = currentOwner(context);
    const current = profiles.findByIdForOwner(context.req.param("id"), owner.id);
    if (!current || current.archivedAt) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Profile not found", status: 404 });
    }
    const input = z
      .object({
        name: z.string().trim().min(1).max(80).default(current.name),
        systemPrompt: z.string().trim().max(8_000).default(current.systemPrompt),
        providerModel: z.string().trim().min(1).max(180).nullable().default(current.providerModel),
      })
      .parse(await context.req.json());
    validateProfileModel(input.providerModel);
    profiles.update(current.id, owner.id, { ...input, updatedAt: new Date().toISOString() });
    return context.json({ profile: profiles.findByIdForOwner(current.id, owner.id) });
  });

  app.delete("/v1/profiles/:id", (context) => {
    const owner = currentOwner(context);
    if (!profiles.archive(context.req.param("id"), owner.id, new Date().toISOString())) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Profile not found or it is the last active profile",
        status: 409,
      });
    }
    return context.body(null, 204);
  });

  app.get("/v1/models", (context) => {
    currentOwner(context);
    const model =
      dependencies.config.provider.kind === "openrouter"
        ? dependencies.config.provider.model
        : "mock";
    return context.json({ models: [{ id: model, name: model.split("/").at(-1) ?? model }] });
  });

  app.get("/v1/memories", (context) => {
    const owner = currentOwner(context);
    const status = z.enum(memoryStatuses).optional().parse(context.req.query("status"));
    return context.json({ memories: memories.list(owner.id, status) });
  });

  app.post("/v1/memories", async (context) => {
    const owner = currentOwner(context);
    const input = z
      .object({
        type: z.enum(memoryTypes),
        content: z.string().trim().min(1).max(2_000),
        sourceMessageId: z.string().nullable().default(null),
      })
      .parse(await context.req.json());
    if (input.sourceMessageId && !messageRepository.findForOwner(input.sourceMessageId, owner.id)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Source message not found",
        status: 404,
      });
    }
    const now = new Date().toISOString();
    const memory = {
      id: createId("memory"),
      ownerId: owner.id,
      type: input.type as MemoryType,
      content: input.content,
      sourceMessageId: input.sourceMessageId,
      confidence: 1,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    };
    memories.create(memory);
    return context.json({ memory }, 201);
  });

  app.patch("/v1/memories/:id", async (context) => {
    const owner = currentOwner(context);
    const current = memories.findForOwner(context.req.param("id"), owner.id);
    if (!current) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Memory not found", status: 404 });
    }
    const input = z
      .object({
        type: z.enum(memoryTypes).default(current.type),
        content: z.string().trim().min(1).max(2_000).default(current.content),
        status: z.enum(memoryStatuses).default(current.status),
      })
      .parse(await context.req.json());
    memories.update(current.id, owner.id, {
      type: input.type as MemoryType,
      content: input.content,
      status: input.status as MemoryStatus,
      updatedAt: new Date().toISOString(),
    });
    return context.json({ memory: memories.findForOwner(current.id, owner.id) });
  });

  app.delete("/v1/memories/:id", (context) => {
    const owner = currentOwner(context);
    if (!memories.delete(context.req.param("id"), owner.id)) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Memory not found", status: 404 });
    }
    checkpointDeletedContent();
    return context.body(null, 204);
  });

  app.get("/v1/knowledge", (context) => {
    const owner = currentOwner(context);
    const profileId = context.req.query("profileId") ?? profiles.findByOwnerId(owner.id)?.id;
    if (!profileId || !profiles.findByIdForOwner(profileId, owner.id)) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Profile not found", status: 404 });
    }
    const documents = knowledge
      .listDocuments(owner.id, profileId)
      .map(({ content, ...document }) => ({
        ...document,
        bytes: new TextEncoder().encode(content).byteLength,
      }));
    return context.json({ documents });
  });

  app.post("/v1/knowledge", async (context) => {
    const owner = currentOwner(context);
    const input = z
      .object({
        profileId: z.string().optional(),
        sourceName: z.string().trim().min(1).max(180),
        content: z.string().min(1),
      })
      .parse(await context.req.json());
    const profileId = input.profileId ?? profiles.findByOwnerId(owner.id)?.id;
    if (!profileId || !profiles.findByIdForOwner(profileId, owner.id)) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Profile not found", status: 404 });
    }
    if (
      input.sourceName.includes("/") ||
      input.sourceName.includes("\\") ||
      !/\.(?:md|txt)$/iu.test(input.sourceName)
    ) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Only .md and .txt files are supported",
        status: 400,
      });
    }
    if (
      input.content.includes("\0") ||
      new TextEncoder().encode(input.content).byteLength > KNOWLEDGE_MAX_BYTES
    ) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Knowledge file must be valid text up to 1 MiB",
        status: 413,
      });
    }
    const chunks = chunkKnowledgeText(input.content);
    if (!chunks.length) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Knowledge file is empty",
        status: 400,
      });
    }
    const now = new Date().toISOString();
    const checksum = new Bun.CryptoHasher("sha256").update(input.content).digest("hex");
    const document = {
      id: createId("document"),
      ownerId: owner.id,
      profileId,
      sourceName: input.sourceName,
      mediaType: input.sourceName.toLowerCase().endsWith(".md")
        ? ("text/markdown" as const)
        : ("text/plain" as const),
      checksum,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    };
    const created = knowledge.createDocument(
      document,
      chunks.map((content, ordinal) => ({
        publicId: createId("chunk"),
        ordinal,
        checksum: new Bun.CryptoHasher("sha256").update(content).digest("hex"),
        content,
      })),
    );
    if (!created) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "This knowledge file already exists",
        status: 409,
      });
    }
    return context.json(
      {
        document: {
          ...document,
          content: undefined,
          bytes: new TextEncoder().encode(input.content).byteLength,
        },
      },
      201,
    );
  });

  app.delete("/v1/knowledge/:id", (context) => {
    const owner = currentOwner(context);
    const profileId = context.req.query("profileId") ?? profiles.findByOwnerId(owner.id)?.id;
    if (!profileId || !knowledge.deleteDocument(context.req.param("id"), owner.id, profileId)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Knowledge document not found",
        status: 404,
      });
    }
    checkpointDeletedContent();
    return context.body(null, 204);
  });

  app.get("/v1/export", (context) => {
    const owner = currentOwner(context);
    const exportedSessions = sessions.listForOwner(owner.id).map((session) => ({
      ...session,
      messages: messageRepository.list(session.id).map((message) => ({
        ...message,
        sources: publicSources(message.id),
        attachments: publicAttachments(message.id),
      })),
    }));
    context.header("cache-control", "no-store");
    context.header("content-disposition", 'attachment; filename="bantuin-export.json"');
    return context.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      owner,
      profile: profiles.findByOwnerId(owner.id),
      memories: memories.list(owner.id),
      knowledge: profiles
        .list(owner.id, true)
        .flatMap((profile) => knowledge.listDocuments(owner.id, profile.id)),
      sessions: exportedSessions,
    });
  });

  app.get("/v1/sessions", (context) => {
    const owner = currentOwner(context);
    return context.json({ sessions: sessions.listForOwner(owner.id) });
  });

  app.post("/v1/sessions", async (context) => {
    const owner = currentOwner(context);
    const input = z
      .object({
        title: z.string().trim().min(1).max(120).nullable().default(null),
        profileId: z.string().optional(),
      })
      .parse(await context.req.json());
    const profile = input.profileId
      ? profiles.findByIdForOwner(input.profileId, owner.id)
      : profiles.findByOwnerId(owner.id);
    if (!profile) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Profile not found", status: 404 });
    }
    const now = new Date().toISOString();
    const session = {
      id: createId("session"),
      ownerId: owner.id,
      profileId: profile.id,
      channel: "web",
      title: input.title,
      parentSessionId: null,
      branchMessageId: null,
      createdAt: now,
      updatedAt: now,
    };
    sessions.create(session);
    return context.json({ session }, 201);
  });

  app.post("/v1/sessions/:id/branch", async (context) => {
    const owner = currentOwner(context);
    const source = sessions.findByIdForOwner(context.req.param("id"), owner.id);
    if (!source) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Session not found", status: 404 });
    }
    const input = z.object({ messageId: z.string().min(1) }).parse(await context.req.json());
    const now = new Date().toISOString();
    const branch = {
      id: createId("session"),
      ownerId: owner.id,
      profileId: source.profileId,
      channel: source.channel,
      title: source.title ? `${source.title} · cabang` : "Percakapan cabang",
      parentSessionId: source.id,
      branchMessageId: input.messageId,
      createdAt: now,
      updatedAt: now,
    };
    if (!sessions.branch(source.id, owner.id, input.messageId, branch)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Branch checkpoint not found",
        status: 404,
      });
    }
    return context.json({ session: branch }, 201);
  });

  app.get("/v1/sessions/:id/messages", (context) => {
    const owner = currentOwner(context);
    const session = sessions.findByIdForOwner(context.req.param("id"), owner.id);
    if (!session) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Session not found", status: 404 });
    }
    return context.json({
      messages: messageRepository.list(session.id).map((message) => ({
        ...message,
        sources: publicSources(message.id),
        attachments: publicAttachments(message.id),
      })),
    });
  });

  app.post("/v1/sessions/:id/messages", async (context) => {
    const owner = currentOwner(context);
    const session = sessions.findByIdForOwner(context.req.param("id"), owner.id);
    if (!session) {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Session not found", status: 404 });
    }
    const input = z
      .object({
        message: z.string().trim().min(1).max(4_000),
        clientRequestId: z.string().trim().min(8).max(128),
        attachments: z
          .array(
            z.object({
              kind: z.enum(["image", "document"]),
              filename: z.string().trim().min(1).max(180).nullable().default(null),
              mediaType: z.enum([
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "text/plain",
                "text/markdown",
              ]),
              data: z.string().min(1),
            }),
          )
          .max(ATTACHMENT_MAX_COUNT)
          .default([]),
      })
      .parse(await context.req.json());
    const decodedAttachments = input.attachments.map((item) => {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(item.data)) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Attachment data is invalid",
          status: 400,
        });
      }
      const content = Buffer.from(item.data, "base64");
      if (!content.byteLength || content.byteLength > ATTACHMENT_MAX_BYTES) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Attachment must be 5 MiB or smaller",
          status: 413,
        });
      }
      if ((item.kind === "image") !== item.mediaType.startsWith("image/")) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Attachment kind does not match media type",
          status: 400,
        });
      }
      return { ...item, content };
    });
    const exchange = messageRepository.createExchange({
      sessionId: session.id,
      userMessageId: createId("message"),
      assistantMessageId: createId("message"),
      content: input.message,
      clientRequestId: input.clientRequestId,
      now: new Date().toISOString(),
    });
    if (exchange.created && decodedAttachments.length) {
      const now = new Date().toISOString();
      attachments.createMany(
        decodedAttachments.map((item) => ({
          id: createId("attachment"),
          messageId: exchange.user.id,
          kind: item.kind,
          filename: item.filename,
          mediaType: item.mediaType,
          bytes: item.content.byteLength,
          content: item.content,
          createdAt: now,
        })),
      );
    }
    if (exchange.created && (!session.title || session.title === "Percakapan baru")) {
      const title = input.message.replaceAll(/\s+/gu, " ").slice(0, 72).trim();
      if (title) sessions.updateTitle(session.id, owner.id, title, new Date().toISOString());
    }
    return streamAssistant(context, exchange.assistant, exchange.created);
  });

  app.post("/v1/messages/:id/cancel", (context) => {
    const owner = currentOwner(context);
    const message = messageRepository.findForOwner(context.req.param("id"), owner.id);
    if (message?.role !== "assistant") {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Message not found", status: 404 });
    }
    activeStreams.get(message.id)?.abort();
    messageRepository.finish(message.id, "cancelled", new Date().toISOString(), {
      errorCode: "CANCELLED",
    });
    return context.json({ message: messageRepository.findForOwner(message.id, owner.id) });
  });

  app.post("/v1/messages/:id/retry", async (context) => {
    const owner = currentOwner(context);
    const original = messageRepository.findForOwner(context.req.param("id"), owner.id);
    if (original?.role !== "assistant") {
      throw new AppError({ code: "VALIDATION_FAILED", message: "Message not found", status: 404 });
    }
    if (!["failed", "cancelled"].includes(original.status)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Only failed or cancelled messages can be retried",
        status: 409,
      });
    }
    const input = z
      .object({ clientRequestId: z.string().trim().min(8).max(128) })
      .parse(await context.req.json());
    const retry = messageRepository.createRetry({
      sessionId: original.sessionId,
      assistantMessageId: createId("message"),
      clientRequestId: input.clientRequestId,
      now: new Date().toISOString(),
    });
    return streamAssistant(context, retry.assistant, retry.created);
  });

  app.post("/_foundation/mock-chat", async (context) => {
    if (dependencies.config.provider.kind !== "mock") {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "The foundation mock endpoint is only available with the mock provider",
        status: 404,
      });
    }

    const body = z
      .object({ message: z.string().trim().min(1).max(4_000) })
      .parse(await context.req.json());
    const requestId = context.get("requestId");
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of dependencies.agent.streamReply({
            requestId,
            messages: [{ role: "user", content: body.message }],
          })) {
            controller.enqueue(
              encoder.encode(
                encodeSseFrame({
                  event: event.type,
                  data: JSON.stringify(event),
                }),
              ),
            );
          }
          controller.enqueue(encoder.encode(encodeSseFrame({ data: "[DONE]" })));
          controller.close();
        } catch (error) {
          const envelope = toErrorEnvelope(error, requestId);
          controller.enqueue(
            encoder.encode(
              encodeSseFrame({ event: "error", data: JSON.stringify(envelope.error) }),
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  });

  app.get("/openapi.json", (context) => {
    const document = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "Bantuin API",
        version: BANTUIN_API_VERSION,
        description: "API for the Bantuin personal assistant",
      },
    });
    const paths = document.paths ?? {};
    const operation = (summary: string, success = "200") => ({
      summary,
      responses: {
        [success]: { description: "Success" },
        "400": { description: "Invalid request" },
        "401": { description: "Authentication required" },
        "403": { description: "Cross-site request rejected" },
      },
    });
    Object.assign(paths, {
      "/v1/setup/status": { get: operation("Read first-run setup status") },
      "/v1/setup": { post: operation("Create the single owner and default profile", "201") },
      "/v1/auth/login": { post: operation("Create a browser session") },
      "/v1/auth/logout": { post: operation("End the current browser session", "204") },
      "/v1/me": { get: operation("Read the authenticated owner and profile") },
      "/v1/profile": {
        get: operation("Read the assistant profile"),
        patch: operation("Update the assistant profile"),
      },
      "/v1/profiles": {
        get: operation("List active assistant profiles"),
        post: operation("Create an assistant profile", "201"),
      },
      "/v1/profiles/{id}": {
        patch: operation("Update an assistant profile"),
        delete: operation("Archive an assistant profile", "204"),
      },
      "/v1/models": { get: operation("List configured provider models") },
      "/v1/memories": {
        get: operation("List owner-controlled memories"),
        post: operation("Create an explicit memory", "201"),
      },
      "/v1/memories/{id}": {
        patch: operation("Update or archive a memory"),
        delete: operation("Permanently delete a memory", "204"),
      },
      "/v1/knowledge": {
        get: operation("List local knowledge documents"),
        post: operation("Index a text knowledge document", "201"),
      },
      "/v1/knowledge/{id}": {
        delete: operation("Permanently delete a knowledge document", "204"),
      },
      "/v1/export": { get: operation("Export owner data as JSON") },
      "/v1/sessions": {
        get: operation("List chat sessions"),
        post: operation("Create a chat session", "201"),
      },
      "/v1/sessions/{id}/messages": {
        get: operation("Read ordered durable message history"),
        post: operation("Submit a message with bounded attachments and stream the response"),
      },
      "/v1/sessions/{id}/branch": {
        post: operation("Branch durable history at a completed message", "201"),
      },
      "/v1/messages/{id}/cancel": { post: operation("Cancel an active assistant response") },
      "/v1/messages/{id}/retry": { post: operation("Retry a failed assistant response") },
    });
    document.paths = paths;
    return context.json(document);
  });

  app.use("/assets/*", serveStatic({ root: "./dist/web" }));
  app.get("/", serveStatic({ path: "./dist/web/index.html" }));

  app.notFound((context) =>
    context.json(
      toErrorEnvelope(
        new AppError({ code: "VALIDATION_FAILED", message: "Route not found", status: 404 }),
        context.get("requestId"),
      ),
      404,
    ),
  );

  app.onError((error, context) => {
    const requestId = context.get("requestId") || createId("request");
    const appError =
      error instanceof z.ZodError
        ? new AppError({
            code: "VALIDATION_FAILED",
            message: "Request validation failed",
            status: 400,
            details: { issues: error.issues },
          })
        : error;
    const status = appError instanceof AppError ? appError.status : 500;
    return context.json(
      toErrorEnvelope(appError, requestId),
      status as 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
    );
  });

  return app;
}
