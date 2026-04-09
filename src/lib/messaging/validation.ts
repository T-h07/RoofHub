const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MESSAGE_BODY_MAX_LENGTH = 2_000;
export const MESSAGE_PREVIEW_MAX_LENGTH = 180;

export function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

export function normalizeMessageBody(value: string, maxLength = MESSAGE_BODY_MAX_LENGTH) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

export function toMessagePreview(value: string, maxLength = MESSAGE_PREVIEW_MAX_LENGTH) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}