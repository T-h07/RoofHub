import { headers } from "next/headers";

const AUTH_ALLOWED_ORIGINS_ENV = "AUTH_ALLOWED_ORIGINS";
const LOCAL_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

function normalizeOrigin(origin: string) {
  const trimmed = origin.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
}

function splitOriginList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function uniqueOrigins(origins: readonly string[]) {
  return [...new Set(origins)];
}

function getConfiguredAllowedOrigins() {
  const configured = splitOriginList(process.env[AUTH_ALLOWED_ORIGINS_ENV]);
  const siteOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");

  const localOrigins = process.env.NODE_ENV === "production" ? [] : [...LOCAL_ALLOWED_ORIGINS];
  return uniqueOrigins([...configured, ...(siteOrigin ? [siteOrigin] : []), ...localOrigins]);
}

function resolveProtocol(host: string | null, forwardedProto: string | null) {
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() || "https";
  }

  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) {
    return "http";
  }

  return "https";
}

function resolveTrustedOrigin(candidate: string | null, allowedOrigins: readonly string[]) {
  if (!candidate) {
    return null;
  }

  if (allowedOrigins.length === 0) {
    return process.env.NODE_ENV === "production" ? null : candidate;
  }

  return allowedOrigins.includes(candidate) ? candidate : null;
}

export async function getRequestOrigin() {
  const headerList = await headers();
  const forwardedHostHeader = headerList.get("x-forwarded-host");
  const forwardedHost = forwardedHostHeader?.split(",")[0]?.trim() ?? null;
  const host = forwardedHost ?? headerList.get("host");
  const protocol = resolveProtocol(host, headerList.get("x-forwarded-proto"));
  const allowedOrigins = getConfiguredAllowedOrigins();
  const fallbackOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");

  if (host) {
    const requestOrigin = normalizeOrigin(`${protocol}://${host}`);
    const trustedRequestOrigin = resolveTrustedOrigin(requestOrigin, allowedOrigins);
    if (trustedRequestOrigin) {
      return trustedRequestOrigin;
    }
  }

  const trustedFallbackOrigin = resolveTrustedOrigin(fallbackOrigin, allowedOrigins);
  if (trustedFallbackOrigin) {
    return trustedFallbackOrigin;
  }

  return allowedOrigins[0] ?? null;
}

export async function buildAbsolutePath(path: string) {
  if (!path.startsWith("/")) {
    return null;
  }

  const origin = await getRequestOrigin();
  if (!origin) {
    return null;
  }

  return new URL(path, origin).toString();
}
