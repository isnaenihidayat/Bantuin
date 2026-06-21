export const BANTUIN_API_VERSION = "1.0.0-foundation";

export type HealthResponse = {
  status: "ok";
  apiVersion: string;
  timestamp: string;
};

export type ReadinessResponse = {
  status: "ready" | "not_ready";
  checks: {
    database: "ok" | "error";
    providerConfiguration: "ok" | "error";
  };
  timestamp: string;
};
