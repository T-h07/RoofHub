const MAP_STYLE_URL_ENV = "NEXT_PUBLIC_MAP_STYLE_URL";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `[Map] Missing required environment variable: ${name}. Set it in .env.local (local) or Vercel Environment Variables (Development/Preview/Production).`
    );
  }

  return value;
}

export function getMapStyleUrl() {
  const styleUrl = requireEnv(MAP_STYLE_URL_ENV);

  try {
    new URL(styleUrl);
  } catch {
    throw new Error(
      `[Map] Invalid ${MAP_STYLE_URL_ENV}. Provide a valid map style URL for MapLibre.`
    );
  }

  return styleUrl;
}
