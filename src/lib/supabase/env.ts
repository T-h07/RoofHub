const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `[Supabase] Missing required environment variable: ${name}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  return value;
}

export function getSupabaseEnv() {
  const url = requireEnv(SUPABASE_URL_ENV);
  const publishableKey = requireEnv(SUPABASE_PUBLISHABLE_KEY_ENV);

  try {
    new URL(url);
  } catch {
    throw new Error(
      `[Supabase] Invalid ${SUPABASE_URL_ENV}. Provide a valid Supabase project URL (https://<project-ref>.supabase.co).`
    );
  }

  return { url, publishableKey };
}
