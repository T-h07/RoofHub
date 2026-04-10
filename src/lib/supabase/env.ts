const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SERVER_SUPABASE_PUBLISHABLE_KEY_ENV = "SUPABASE_PUBLISHABLE_KEY";
const SERVER_SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";

type SupabaseResolvedEnv = {
  url: string | null;
  publishableKey: string | null;
};

function resolveClientSupabaseEnv(): SupabaseResolvedEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      null,
  };
}

function resolveServerSupabaseEnv(): SupabaseResolvedEnv {
  const clientEnv = resolveClientSupabaseEnv();

  return {
    url: clientEnv.url ?? process.env.SUPABASE_URL ?? null,
    publishableKey:
      clientEnv.publishableKey ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      null,
  };
}

export function getSupabaseEnv() {
  const { url, publishableKey } =
    typeof window === "undefined" ? resolveServerSupabaseEnv() : resolveClientSupabaseEnv();

  if (!url) {
    throw new Error(
      `[Supabase] Missing required environment variable: ${SUPABASE_URL_ENV}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  if (!publishableKey) {
    const acceptedNames = [
      SUPABASE_PUBLISHABLE_KEY_ENV,
      SUPABASE_ANON_KEY_ENV,
      SERVER_SUPABASE_PUBLISHABLE_KEY_ENV,
      SERVER_SUPABASE_ANON_KEY_ENV,
    ].join(", ");

    throw new Error(
      `[Supabase] Missing required environment variable: ${SUPABASE_PUBLISHABLE_KEY_ENV}. Also checked: ${acceptedNames}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error(
      `[Supabase] Invalid ${SUPABASE_URL_ENV}. Provide a valid Supabase project URL (https://<project-ref>.supabase.co).`
    );
  }

  return { url, publishableKey };
}
