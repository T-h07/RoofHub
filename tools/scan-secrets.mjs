#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const mode = process.argv.includes("--staged") ? "staged" : "tracked";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const ALLOWED_PLACEHOLDERS = [
  "<project-ref>",
  "<supabase-publishable-key>",
  "<supabase-service-role-key>",
  "<server-only-service-role-key>",
  "<db-password>",
  "<google-oauth-client-secret>",
  "<vercel-token>",
  "<vercel-org-id>",
  "<vercel-project-id>",
  "${",
  "$",
  "env(",
];

const RULES = [
  {
    id: "old-roofhub-supabase-project-ref",
    pattern: /\bygcjvklqzujqrssdlxzq\b/gi,
    message: "Old RoofHub Supabase project ref must never be committed.",
  },
  {
    id: "supabase-project-url",
    pattern: /https:\/\/[a-z0-9]{15,40}\.supabase\.co/gi,
    message: "Use https://<project-ref>.supabase.co instead of a real Supabase URL.",
  },
  {
    id: "supabase-publishable-key",
    pattern: /\bsb_publishable_[A-Za-z0-9_-]{20,}\b/gi,
    message: "Use <supabase-publishable-key> instead of a real Supabase publishable key.",
  },
  {
    id: "supabase-secret-key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/gi,
    message: "Supabase secret/service-role keys must stay in private env storage only.",
  },
  {
    id: "supabase-jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    message: "JWT-like Supabase keys must not be committed.",
  },
  {
    id: "database-url",
    pattern: /\b(?:DATABASE_URL|POSTGRES_URL|SUPABASE_DB_URL)\s*[:=]\s*['"]?postgres(?:ql)?:\/\/[^\s'"`]+/gi,
    message: "Database URLs must be placeholders in committed files.",
  },
  {
    id: "supabase-service-role-assignment",
    pattern: /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)\s*[:=]\s*['"]?[^#\s'"]{12,}/gi,
    message: "Service-role key assignments must not be committed.",
  },
  {
    id: "vercel-secret-or-project-assignment",
    pattern: /\b(?:VERCEL_TOKEN|VERCEL_ORG_ID|VERCEL_PROJECT_ID)\s*[:=]\s*['"]?[^#\s'"]{6,}/gi,
    message: "Vercel tokens and project identifiers must stay out of the public repo.",
  },
  {
    id: "google-client-secret-assignment",
    pattern: /\b(?:GOOGLE_CLIENT_SECRET|GOOGLE_OAUTH_CLIENT_SECRET)\s*[:=]\s*['"]?[^#\s'"]{10,}/gi,
    message: "Google OAuth client secrets must stay in private env storage only.",
  },
];

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function listTrackedFiles() {
  return git(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean);
}

function listStagedFiles() {
  return git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    .split("\0")
    .filter(Boolean);
}

function isTextLike(filePath) {
  const lower = filePath.toLowerCase();
  if (lower === ".env.example" || lower.endsWith(".env.example")) {
    return true;
  }

  if (lower.includes("package-lock.json")) {
    return false;
  }

  return TEXT_EXTENSIONS.has(path.extname(lower));
}

function getFileContent(filePath) {
  if (mode === "staged") {
    try {
      return git(["show", `:${filePath}`]);
    } catch {
      return "";
    }
  }

  if (!existsSync(filePath)) {
    return "";
  }

  return readFileSync(filePath, "utf8");
}

function isAllowedPlaceholder(match) {
  return ALLOWED_PLACEHOLDERS.some((placeholder) => match.includes(placeholder));
}

function redact(match) {
  const value = match.trim();
  if (value.length <= 18) {
    return "<redacted>";
  }

  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split("\n").length;
}

const files = mode === "staged" ? listStagedFiles() : listTrackedFiles();
const findings = [];

for (const filePath of files) {
  if (!isTextLike(filePath)) {
    continue;
  }

  const content = getFileContent(filePath);
  if (!content) {
    continue;
  }

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const value = match[0];
      if (isAllowedPlaceholder(value)) {
        continue;
      }

      findings.push({
        filePath,
        line: lineNumberFor(content, match.index ?? 0),
        rule: rule.id,
        message: rule.message,
        value: redact(value),
      });
    }
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed: ${findings.length} finding(s).`);
  for (const finding of findings) {
    console.error(
      `${finding.filePath}:${finding.line} [${finding.rule}] ${finding.message} (${finding.value})`
    );
  }
  process.exit(1);
}

console.log(`Secret scan passed (${mode}, ${files.length} file(s) checked).`);
