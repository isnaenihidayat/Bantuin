import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const environmentSchema = z
  .object({
    BANTUIN_HOST: z.string().trim().min(1).default("127.0.0.1"),
    BANTUIN_PORT: z.coerce.number().int().min(1).max(65_535).default(4310),
    BANTUIN_PUBLIC_ORIGIN: z.url().default("http://127.0.0.1:4310"),
    DATABASE_URL: z.string().trim().startsWith("file:").default("file:data/bantuin.sqlite"),
    BANTUIN_PROVIDER: z.enum(["mock", "openrouter"]).default("mock"),
    OPENROUTER_API_KEY: z.string().trim().optional(),
    OPENROUTER_MODEL: z.string().trim().optional(),
    OPENROUTER_HTTP_REFERER: z.string().url().optional(),
    OPENROUTER_APP_TITLE: z.string().trim().min(1).default("Bantuin"),
    BANTUIN_LIVE_PROVIDER_CHECK: booleanString,
  })
  .superRefine((environment, context) => {
    if (environment.BANTUIN_PROVIDER !== "openrouter") {
      return;
    }

    if (!environment.OPENROUTER_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["OPENROUTER_API_KEY"],
        message: "OPENROUTER_API_KEY is required when BANTUIN_PROVIDER=openrouter",
      });
    }

    if (!environment.OPENROUTER_MODEL) {
      context.addIssue({
        code: "custom",
        path: ["OPENROUTER_MODEL"],
        message: "OPENROUTER_MODEL is required when BANTUIN_PROVIDER=openrouter",
      });
    }
  });

export type AppConfig = {
  host: string;
  port: number;
  publicOrigin: string;
  databaseUrl: string;
  provider:
    | { kind: "mock" }
    | {
        kind: "openrouter";
        apiKey: string;
        model: string;
        httpReferer?: string;
        appTitle: string;
      };
  liveProviderCheck: boolean;
};

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): AppConfig {
  const parsed = environmentSchema.parse(environment);

  const provider: AppConfig["provider"] =
    parsed.BANTUIN_PROVIDER === "openrouter"
      ? {
          kind: "openrouter",
          apiKey: parsed.OPENROUTER_API_KEY as string,
          model: parsed.OPENROUTER_MODEL as string,
          ...(parsed.OPENROUTER_HTTP_REFERER
            ? { httpReferer: parsed.OPENROUTER_HTTP_REFERER }
            : {}),
          appTitle: parsed.OPENROUTER_APP_TITLE,
        }
      : { kind: "mock" };

  return {
    host: parsed.BANTUIN_HOST,
    port: parsed.BANTUIN_PORT,
    publicOrigin: parsed.BANTUIN_PUBLIC_ORIGIN.replace(/\/$/, ""),
    databaseUrl: parsed.DATABASE_URL,
    provider,
    liveProviderCheck: parsed.BANTUIN_LIVE_PROVIDER_CHECK,
  };
}
