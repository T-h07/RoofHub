import { headers } from "next/headers";

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

function resolveProtocol(host: string | null, forwardedProto: string | null) {
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() || "https";
  }

  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) {
    return "http";
  }

  return "https";
}

export async function getRequestOrigin() {
  const headerList = await headers();
  const forwardedHostHeader = headerList.get("x-forwarded-host");
  const forwardedHost = forwardedHostHeader?.split(",")[0]?.trim() ?? null;
  const host = forwardedHost ?? headerList.get("host");
  const protocol = resolveProtocol(host, headerList.get("x-forwarded-proto"));

  if (host) {
    return `${protocol}://${host}`;
  }

  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

export async function buildAbsolutePath(path: string) {
  const origin = await getRequestOrigin();
  if (!origin) {
    return null;
  }

  return new URL(path, origin).toString();
}
