const MAP_STYLE_URL_ENV = "NEXT_PUBLIC_MAP_STYLE_URL";
const MAP_LIGHT_STYLE_URL_ENV = "NEXT_PUBLIC_MAP_LIGHT_STYLE_URL";
const MAP_DARK_STYLE_URL_ENV = "NEXT_PUBLIC_MAP_DARK_STYLE_URL";

const CONFIGURED_MAP_STYLE_URLS: Record<string, string | undefined> = {
  [MAP_STYLE_URL_ENV]: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  [MAP_LIGHT_STYLE_URL_ENV]: process.env.NEXT_PUBLIC_MAP_LIGHT_STYLE_URL,
  [MAP_DARK_STYLE_URL_ENV]: process.env.NEXT_PUBLIC_MAP_DARK_STYLE_URL,
};

export type MapStyleTheme = "light" | "dark";

export const DEFAULT_PUBLIC_MAP_LIGHT_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
export const DEFAULT_PUBLIC_MAP_DARK_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const DEFAULT_PUBLIC_MAP_STYLE_URL = DEFAULT_PUBLIC_MAP_LIGHT_STYLE_URL;

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function getDefaultMapStyleUrl(theme: MapStyleTheme) {
  return theme === "dark" ? DEFAULT_PUBLIC_MAP_DARK_STYLE_URL : DEFAULT_PUBLIC_MAP_LIGHT_STYLE_URL;
}

function getConfiguredStyleUrl(envName: string) {
  const configuredStyleUrl = CONFIGURED_MAP_STYLE_URLS[envName]?.trim();

  if (!configuredStyleUrl) {
    return null;
  }

  if (isValidUrl(configuredStyleUrl)) {
    return configuredStyleUrl;
  }

  console.warn(
    `[Map] Invalid ${envName}. Falling back to default public map style URL.`
  );

  return null;
}

function legacyStyleAppliesToTheme(styleUrl: string, theme: MapStyleTheme) {
  const normalized = styleUrl.toLowerCase();
  const looksDark = normalized.includes("dark") || normalized.includes("night");
  const looksLight =
    normalized.includes("light") ||
    normalized.includes("voyager") ||
    normalized.includes("positron");

  if (theme === "light" && looksDark) {
    return false;
  }

  if (theme === "dark" && looksLight) {
    return false;
  }

  return true;
}

export function getMapStyleUrl(theme: MapStyleTheme = "light") {
  const themedStyleUrl = getConfiguredStyleUrl(
    theme === "dark" ? MAP_DARK_STYLE_URL_ENV : MAP_LIGHT_STYLE_URL_ENV
  );

  if (themedStyleUrl) {
    return themedStyleUrl;
  }

  const legacyStyleUrl = getConfiguredStyleUrl(MAP_STYLE_URL_ENV);
  if (legacyStyleUrl && legacyStyleAppliesToTheme(legacyStyleUrl, theme)) {
    return legacyStyleUrl;
  }

  return getDefaultMapStyleUrl(theme);
}
