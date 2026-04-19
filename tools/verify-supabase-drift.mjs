import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const typesPath = resolve(repoRoot, "src/types/database.ts");

function normalize(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function runSupabase(args, purpose) {
  const command = `npx supabase ${args.join(" ")}`;

  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";

    console.error(`[verify:supabase:drift] ${purpose} failed.`);
    if (stdout.trim()) {
      console.error(stdout.trim());
    }
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    process.exit(1);
  }
}

runSupabase(["db", "lint", "--local", "--fail-on", "error"], "Supabase lint");

const generatedTypes = runSupabase(
  ["gen", "types", "--local", "--lang", "typescript"],
  "Supabase type generation"
);
const checkedInTypes = readFileSync(typesPath, "utf8");

if (normalize(generatedTypes) !== normalize(checkedInTypes)) {
  console.error("[verify:supabase:drift] src/types/database.ts does not match the local migrated schema.");
  console.error("Run `npm run supabase:db:reset` and `npm run supabase:types:generate`, then commit the updated types.");
  process.exit(1);
}

console.log("[verify:supabase:drift] local schema and generated types are aligned.");
