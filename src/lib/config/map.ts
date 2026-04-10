const MAP_STYLE_URL_ENV = "NEXT_PUBLIC_MAP_STYLE_URL";
export const DEFAULT_PUBLIC_MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function getMapStyleUrl() {
  const configuredStyleUrl = process.env[MAP_STYLE_URL_ENV]?.trim();

  if (!configuredStyleUrl) {
    return DEFAULT_PUBLIC_MAP_STYLE_URL;
  }

  if (isValidUrl(configuredStyleUrl)) {
    return configuredStyleUrl;
  }

  console.warn(
    `[Map] Invalid ${MAP_STYLE_URL_ENV}. Falling back to default public map style URL.`
  );

  return DEFAULT_PUBLIC_MAP_STYLE_URL;
}
