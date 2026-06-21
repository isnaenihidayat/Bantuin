import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(path);
      }
      return entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

const violations: string[] = [];
for (const file of await sourceFiles("packages")) {
  const content = await Bun.file(file).text();
  if (/from\s+["'][^"']*apps\//u.test(content) || /from\s+["']@bantuin\/api/u.test(content)) {
    violations.push(`${relative(process.cwd(), file)} imports from an app`);
  }
  if (file.includes("packages/agent/") && /from\s+["']@bantuin\/providers/u.test(content)) {
    violations.push(`${relative(process.cwd(), file)} couples the agent core to providers`);
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Package dependency boundaries are valid.");
