import type { AgentService } from "@bantuin/agent";
import { encodeSseFrame } from "@bantuin/client";
import {
  BANTUIN_API_VERSION,
  type AppConfig,
  AppError,
  createId,
  toErrorEnvelope,
} from "@bantuin/core";
import { checkDatabase, type BantuinDatabase } from "@bantuin/db";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

type Variables = {
  requestId: string;
};

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

  app.use("*", async (context, next) => {
    const requestId = context.req.header("x-request-id") || createId("request");
    context.set("requestId", requestId);
    context.header("x-request-id", requestId);
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

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Bantuin API",
      version: BANTUIN_API_VERSION,
      description: "Foundation API for the Bantuin personal assistant",
    },
  });

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
    return context.json(toErrorEnvelope(appError, requestId), status as 400 | 404 | 500 | 503);
  });

  return app;
}
