const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SERVER_SUPABASE_URL_ENV = "SUPABASE_URL";
const SERVER_SUPABASE_PUBLISHABLE_KEY_ENV = "SUPABASE_PUBLISHABLE_KEY";
const SERVER_SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";
const LOCAL_DEV_SUPABASE_URL = "http://127.0.0.1:54321";

function readEnv(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return null;
}

function requireEnv(name: string, fallbackNames: readonly string[] = []): string {
  const value = readEnv([name, ...fallbackNames]);

  if (!value) {
    const acceptedNames = [name, ...fallbackNames].join(", ");
    throw new Error(
      `[Supabase] Missing required environment variable: ${name}. Also checked: ${acceptedNames}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  return value;
}

export function getSupabaseEnv() {
  const url =
    readEnv([SUPABASE_URL_ENV, SERVER_SUPABASE_URL_ENV]) ??
    (process.env.NODE_ENV !== "production" ? LOCAL_DEV_SUPABASE_URL : null);

  if (!url) {
    throw new Error(
      `[Supabase] Missing required environment variable: ${SUPABASE_URL_ENV}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  const publishableKey = requireEnv(SUPABASE_PUBLISHABLE_KEY_ENV, [
    SUPABASE_ANON_KEY_ENV,
    SERVER_SUPABASE_PUBLISHABLE_KEY_ENV,
    SERVER_SUPABASE_ANON_KEY_ENV,
  ]);

  try {
    new URL(url);
  } catch {
    throw new Error(
      `[Supabase] Invalid ${SUPABASE_URL_ENV}. Provide a valid Supabase project URL (https://<project-ref>.supabase.co).`
    );
  }

  return { url, publishableKey };
}
