import { readdir } from "node:fs/promises";
import { join } from "node:path";

const result = Bun.spawnSync({
  cmd: ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
  stdout: "pipe",
  stderr: "pipe",
});

const ignoredDirectories = new Set([".git", "node_modules", "dist", "data", "logs", "backups"]);

async function discoverFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        return [];
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return discoverFiles(path);
      }
      return entry.isFile() ? [path.replace(/^\.\//u, "")] : [];
    }),
  );
  return nested.flat();
}

const files = (
  result.success ? result.stdout.toString().split("\n").filter(Boolean) : await discoverFiles(".")
).filter((file) => !file.endsWith("bun.lock"));

const signatures = [
  { name: "OpenRouter API key", pattern: /sk-or-v1-[A-Za-z0-9_-]{20,}/u },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/u },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/u },
  { name: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
];

const findings: string[] = [];
for (const file of files) {
  const bunFile = Bun.file(file);
  if (bunFile.size > 1_000_000) {
    continue;
  }
  const content = await bunFile.text();
  for (const signature of signatures) {
    if (signature.pattern.test(content)) {
      findings.push(`${file}: ${signature.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Potential secrets detected:\n${findings.join("\n")}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} files.`);
