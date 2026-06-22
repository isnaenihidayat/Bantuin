const prefixes = {
  owner: "usr",
  profile: "pro",
  session: "ses",
  message: "msg",
  memory: "mem",
  document: "doc",
  chunk: "chk",
  request: "req",
} as const;

export type IdKind = keyof typeof prefixes;

export function createId(kind: IdKind): string {
  return `${prefixes[kind]}_${crypto.randomUUID().replaceAll("-", "")}`;
}
