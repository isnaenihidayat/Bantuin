const SECRET_KEY_PATTERN = /token|password|secret|authorization|cookie|api[-_]?key/iu;

function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : value;
  }
  return redacted;
}

export type LogLevel = "info" | "warn" | "error";

export function logEvent(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...redactFields(fields),
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
