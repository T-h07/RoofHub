export const MAP_BOUNDS_PARAM = "bbox";

export type MapSearchBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeBounds(bounds: MapSearchBounds): MapSearchBounds | null {
  const west = clamp(bounds.west, -180, 180);
  const east = clamp(bounds.east, -180, 180);
  const south = clamp(bounds.south, -90, 90);
  const north = clamp(bounds.north, -90, 90);

  if (east <= west || north <= south) {
    return null;
  }

  return {
    west,
    south,
    east,
    north,
  };
}

function toFixedNumber(value: number, precision = 5) {
  return Number.parseFloat(value.toFixed(precision));
}

export function serializeMapSearchBounds(bounds: MapSearchBounds, precision = 5) {
  const normalizedBounds = normalizeBounds(bounds);

  if (!normalizedBounds) {
    return null;
  }

  const west = toFixedNumber(normalizedBounds.west, precision);
  const south = toFixedNumber(normalizedBounds.south, precision);
  const east = toFixedNumber(normalizedBounds.east, precision);
  const north = toFixedNumber(normalizedBounds.north, precision);

  return `${west},${south},${east},${north}`;
}

export function parseMapSearchBounds(value: string | null | undefined): MapSearchBounds | null {
  if (!value) {
    return null;
  }

  const parts = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    return null;
  }

  const [westRaw, southRaw, eastRaw, northRaw] = parts;
  const west = Number.parseFloat(westRaw);
  const south = Number.parseFloat(southRaw);
  const east = Number.parseFloat(eastRaw);
  const north = Number.parseFloat(northRaw);

  if (![west, south, east, north].every((entry) => Number.isFinite(entry))) {
    return null;
  }

  return normalizeBounds({
    west,
    south,
    east,
    north,
  });
}

function readFirstParamValue(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const rawValue = params[key];

  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (Array.isArray(rawValue)) {
    return rawValue.find((entry) => typeof entry === "string") ?? null;
  }

  return null;
}

export function parseMapSearchBoundsFromParams(
  params: Record<string, string | string[] | undefined>
) {
  return parseMapSearchBounds(readFirstParamValue(params, MAP_BOUNDS_PARAM));
}

export function areBoundsMeaningfullyDifferent(
  currentBounds: MapSearchBounds,
  referenceBounds: MapSearchBounds,
  options: {
    centerRatioThreshold?: number;
    spanRatioThreshold?: number;
  } = {}
) {
  const centerRatioThreshold = options.centerRatioThreshold ?? 0.18;
  const spanRatioThreshold = options.spanRatioThreshold ?? 0.2;

  const currentLngSpan = Math.max(currentBounds.east - currentBounds.west, 0.00001);
  const currentLatSpan = Math.max(currentBounds.north - currentBounds.south, 0.00001);
  const referenceLngSpan = Math.max(referenceBounds.east - referenceBounds.west, 0.00001);
  const referenceLatSpan = Math.max(referenceBounds.north - referenceBounds.south, 0.00001);

  const currentCenterLng = (currentBounds.east + currentBounds.west) / 2;
  const currentCenterLat = (currentBounds.north + currentBounds.south) / 2;
  const referenceCenterLng = (referenceBounds.east + referenceBounds.west) / 2;
  const referenceCenterLat = (referenceBounds.north + referenceBounds.south) / 2;

  const centerLngDiff = Math.abs(currentCenterLng - referenceCenterLng);
  const centerLatDiff = Math.abs(currentCenterLat - referenceCenterLat);
  const spanLngDiff = Math.abs(currentLngSpan - referenceLngSpan);
  const spanLatDiff = Math.abs(currentLatSpan - referenceLatSpan);

  return (
    centerLngDiff > referenceLngSpan * centerRatioThreshold ||
    centerLatDiff > referenceLatSpan * centerRatioThreshold ||
    spanLngDiff > referenceLngSpan * spanRatioThreshold ||
    spanLatDiff > referenceLatSpan * spanRatioThreshold
  );
}
