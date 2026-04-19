export type SupabaseSchemaDriftErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

const SCHEMA_DRIFT_ERROR_CODES = new Set(["42703", "42P01", "42883", "PGRST202"]);

export function isSupabaseSchemaDriftError(
  error: SupabaseSchemaDriftErrorLike,
  identifiers: string[] = []
) {
  const message = normalizeToken(error.message ?? "");
  if (!message) {
    return false;
  }

  const isSchemaDriftCode = error.code ? SCHEMA_DRIFT_ERROR_CODES.has(error.code) : false;
  const isSchemaDriftMessage =
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("function") ||
    message.includes("column") ||
    message.includes("relation") ||
    message.includes("table");

  if (!isSchemaDriftCode && !isSchemaDriftMessage) {
    return false;
  }

  if (identifiers.length === 0) {
    return true;
  }

  return identifiers.some((identifier) => message.includes(normalizeToken(identifier)));
}

export function createSchemaDriftMessage(scope: string) {
  return `${scope} schema is out of date. Apply the latest Supabase migrations and regenerate Supabase types.`;
}

export function logSupabaseSchemaDrift(
  scope: string,
  error: SupabaseSchemaDriftErrorLike,
  context: Record<string, unknown> = {}
) {
  console.error(`[SchemaDrift][${scope}] detected`, {
    error_code: error.code ?? null,
    error_message: error.message ?? null,
    error_details: error.details ?? null,
    error_hint: error.hint ?? null,
    ...context,
  });
}
