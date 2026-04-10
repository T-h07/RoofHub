const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SERVER_SUPABASE_URL_ENV = "SUPABASE_URL";
const SERVER_SUPABASE_PUBLISHABLE_KEY_ENV = "SUPABASE_PUBLISHABLE_KEY";
const SERVER_SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";

function readEnv(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return null;
}

export function getSupabaseEnv() {
  const url = readEnv([SUPABASE_URL_ENV, SERVER_SUPABASE_URL_ENV]);

  if (!url) {
    throw new Error(
      `[Supabase] Missing required environment variable: ${SUPABASE_URL_ENV}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  const publishableKey =
    readEnv([
      SUPABASE_PUBLISHABLE_KEY_ENV,
      SUPABASE_ANON_KEY_ENV,
      SERVER_SUPABASE_PUBLISHABLE_KEY_ENV,
      SERVER_SUPABASE_ANON_KEY_ENV,
    ]);

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
