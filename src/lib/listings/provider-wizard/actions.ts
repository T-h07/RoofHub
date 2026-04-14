"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isProviderRole } from "@/lib/auth/roles";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import type { Enums } from "@/types/database";

import {
  PROVIDER_WIZARD_DEFAULT_VALUES,
  isProviderWizardStep,
  type ProviderDraftWizardValues,
  type ProviderWizardFieldErrors,
  type ProviderWizardStep,
} from "./types";
import {
  validateAmenitiesStep,
  validateBasicsStep,
  validateContactStep,
  validateFactsStep,
  validateLocationStep,
  validatePricingStep,
  validateReviewStep,
} from "./validation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DRAFT_DEFAULTS = {
  listing_type: "rent" as const,
  property_type: "apartment" as const,
  price_amount: 0,
  currency_code: "EUR",
  area_m2: 1,
  city: "Pending city",
  listing_status: "draft" as const,
  latitude: null,
  longitude: null,
  public_location_mode: "approximate" as const,
};

const CONTACT_SCHEMA_OUT_OF_DATE_MESSAGE =
  "Contact profile columns are out of date. Apply the latest Supabase migrations and retry.";

export type SaveProviderWizardStepInput = {
  step: ProviderWizardStep;
  values: ProviderDraftWizardValues;
  draftId?: string | null;
  createDraftId?: string | null;
};

export type SaveProviderWizardStepResult = {
  ok: boolean;
  draftId: string | null;
  message: string;
  fieldErrors?: ProviderWizardFieldErrors;
  reviewBlockers?: string[];
};

type ProviderWizardStringFieldKey = {
  [K in keyof ProviderDraftWizardValues]: ProviderDraftWizardValues[K] extends string ? K : never;
}[keyof ProviderDraftWizardValues];

type ProviderWizardBooleanFieldKey = {
  [K in keyof ProviderDraftWizardValues]: ProviderDraftWizardValues[K] extends boolean ? K : never;
}[keyof ProviderDraftWizardValues];

function isUuid(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readStringField(
  record: Record<string, unknown>,
  key: ProviderWizardStringFieldKey
): string {
  const value = record[key];
  return typeof value === "string" ? value : PROVIDER_WIZARD_DEFAULT_VALUES[key];
}

function readBooleanField(
  record: Record<string, unknown>,
  key: ProviderWizardBooleanFieldKey
): boolean {
  const value = record[key];
  return typeof value === "boolean" ? value : PROVIDER_WIZARD_DEFAULT_VALUES[key];
}

function readNullableCoordinate(record: Record<string, unknown>, key: "latitude" | "longitude") {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function sanitizeDraftWizardValues(value: unknown): ProviderDraftWizardValues {
  if (!isRecord(value)) {
    return {
      ...PROVIDER_WIZARD_DEFAULT_VALUES,
      contactMethods: [...PROVIDER_WIZARD_DEFAULT_VALUES.contactMethods],
    };
  }

  const contactMethods = Array.isArray(value.contactMethods)
    ? Array.from(
        new Set(
          value.contactMethods
            .filter((method): method is string => typeof method === "string")
            .slice(0, 8)
        )
      )
    : [...PROVIDER_WIZARD_DEFAULT_VALUES.contactMethods];

  return {
    title: readStringField(value, "title"),
    description: readStringField(value, "description"),
    listingType: readStringField(value, "listingType") as ProviderDraftWizardValues["listingType"],
    propertyType: readStringField(value, "propertyType") as ProviderDraftWizardValues["propertyType"],
    priceAmount: readStringField(value, "priceAmount"),
    currencyCode: readStringField(value, "currencyCode"),
    depositAmount: readStringField(value, "depositAmount"),
    areaM2: readStringField(value, "areaM2"),
    bedrooms: readStringField(value, "bedrooms"),
    bathrooms: readStringField(value, "bathrooms"),
    floorNumber: readStringField(value, "floorNumber"),
    totalFloors: readStringField(value, "totalFloors"),
    city: readStringField(value, "city"),
    neighborhood: readStringField(value, "neighborhood"),
    addressText: readStringField(value, "addressText"),
    latitude: readNullableCoordinate(value, "latitude"),
    longitude: readNullableCoordinate(value, "longitude"),
    publicLocationMode: readStringField(
      value,
      "publicLocationMode"
    ) as ProviderDraftWizardValues["publicLocationMode"],
    availableFrom: readStringField(value, "availableFrom"),
    furnished: readBooleanField(value, "furnished"),
    parking: readBooleanField(value, "parking"),
    petsAllowed: readBooleanField(value, "petsAllowed"),
    elevator: readBooleanField(value, "elevator"),
    balcony: readBooleanField(value, "balcony"),
    internetIncluded: readBooleanField(value, "internetIncluded"),
    utilitiesIncluded: readBooleanField(value, "utilitiesIncluded"),
    heatingType: readStringField(value, "heatingType") as ProviderDraftWizardValues["heatingType"],
    preferredContactMethod: readStringField(
      value,
      "preferredContactMethod"
    ) as ProviderDraftWizardValues["preferredContactMethod"],
    contactMethods: contactMethods as ProviderDraftWizardValues["contactMethods"],
    contactEmail: readStringField(value, "contactEmail"),
    contactPhone: readStringField(value, "contactPhone"),
    whatsappPhone: readStringField(value, "whatsappPhone"),
    viberPhone: readStringField(value, "viberPhone"),
  };
}

function normalizeSaveStepInput(input: SaveProviderWizardStepInput | unknown):
  | {
      ok: true;
      step: ProviderWizardStep;
      values: ProviderDraftWizardValues;
      draftId: string | null;
      createDraftId: string | null;
    }
  | {
      ok: false;
      message: string;
    } {
  if (!isRecord(input)) {
    return {
      ok: false,
      message: "Draft save payload is invalid.",
    };
  }

  if (!isProviderWizardStep(input.step)) {
    return {
      ok: false,
      message: "Draft step is invalid.",
    };
  }

  return {
    ok: true,
    step: input.step,
    values: sanitizeDraftWizardValues(input.values),
    draftId: typeof input.draftId === "string" ? input.draftId : null,
    createDraftId: typeof input.createDraftId === "string" ? input.createDraftId : null,
  };
}

function normalizeSupabaseError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to edit this listing draft.";
  }

  if (
    normalized.includes('null value in column "latitude"') ||
    normalized.includes('null value in column "longitude"')
  ) {
    return "Listing location columns are out of date. Apply the latest Supabase migrations and retry.";
  }

  if (normalized.includes("check constraint")) {
    return "Some values do not match listing requirements. Review highlighted fields and retry.";
  }

  if (
    isMissingContactMethodsColumnError(message) ||
    isMissingContactChannelColumnError(message) ||
    (normalized.includes("invalid input value for enum") &&
      normalized.includes("preferred_contact_method"))
  ) {
    return CONTACT_SCHEMA_OUT_OF_DATE_MESSAGE;
  }

  return "Draft save failed. Please retry.";
}

function isMissingContactMethodsColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("contact_methods") &&
    (normalized.includes("does not exist") || normalized.includes("column"))
  );
}

function isMissingContactChannelColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("contact_email") ||
      normalized.includes("whatsapp_phone") ||
      normalized.includes("viber_phone"))
  );
}

function slugifyTitle(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "listing-draft";
}

function buildDraftSlug(title: string, draftId: string) {
  const base = slugifyTitle(title).slice(0, 46);
  return `${base}-${draftId.slice(0, 8)}`;
}

async function ensureProviderContext() {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false as const,
      message: profileResult.message,
      supabase,
      profile: null,
    };
  }

  if (!isProviderRole(profileResult.profile.role)) {
    return {
      ok: false as const,
      message: "Switch your profile role to provider before creating listings.",
      supabase,
      profile: profileResult.profile,
    };
  }

  return {
    ok: true as const,
    supabase,
    profile: profileResult.profile,
    userEmail: profileResult.user.email ?? null,
  };
}

async function ensureDraftAccess(
  draftId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  const query = supabase
    .from("listings")
    .select("id, owner_id, organization_id, listing_status")
    .eq("id", draftId)
    .eq("owner_id", userId)
    .limit(1);

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return {
      ok: false as const,
      message: "Draft listing not found or inaccessible.",
      listing: null as {
        id: string;
        owner_id: string;
        organization_id: string | null;
        listing_status: string;
      } | null,
    };
  }

  return {
    ok: true as const,
    listing: data as {
      id: string;
      owner_id: string;
      organization_id: string | null;
      listing_status: string;
    },
  };
}

async function updateDraftListing(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  options: {
    draftId: string;
    userId: string;
    patch: Record<string, unknown>;
  }
) {
  const query = supabase
    .from("listings")
    .update(options.patch)
    .eq("id", options.draftId)
    .eq("owner_id", options.userId)
    .select("id")
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      ok: false as const,
      message: normalizeSupabaseError(error.message),
    };
  }

  if (!data) {
    return {
      ok: false as const,
      message: "Draft listing not found or inaccessible.",
    };
  }

  return {
    ok: true as const,
  };
}

async function recordProviderDraftStepSavedAudit(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  actorUserId: string;
  actorRole: Enums<"app_role">;
  draftId: string;
  step: ProviderWizardStep;
  outcome: "saved" | "resumed";
}) {
  await recordSecurityAuditEvent({
    supabase: input.supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.listingDraftStepSaved,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      targetType: "listing",
      targetId: input.draftId,
      listingId: input.draftId,
      metadata: {
        step: input.step,
        outcome: input.outcome,
      },
    },
  });
}

export async function saveProviderWizardStepAction(
  input: SaveProviderWizardStepInput
): Promise<SaveProviderWizardStepResult> {
  const normalizedInput = normalizeSaveStepInput(input);
  if (!normalizedInput.ok) {
    return {
      ok: false,
      draftId: null,
      message: normalizedInput.message,
    };
  }

  const providerContext = await ensureProviderContext();

  if (!providerContext.ok) {
    return {
      ok: false,
      draftId: null,
      message: providerContext.message,
    };
  }

  const { supabase, profile, userEmail } = providerContext;
  const { step, values, createDraftId } = normalizedInput;
  const candidateDraftId = normalizedInput.draftId;
  const draftSaveTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.providerDraftSavePerUser,
    identity: {
      userId: profile.id,
      scope: step,
      includeIp: false,
    },
    throttledMessage: "Draft save limit reached. Please wait before saving again.",
    unavailableMessage: "Draft save is temporarily unavailable. Please retry shortly.",
  });
  if (!draftSaveTrafficControl.ok) {
    return {
      ok: false,
      draftId: candidateDraftId,
      message: draftSaveTrafficControl.message,
    };
  }

  try {
    if (step === "basics") {
      const basicsValidation = validateBasicsStep(values);
      if (!basicsValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix the highlighted basics fields and retry.",
          fieldErrors: basicsValidation.errors,
        };
      }

      if (candidateDraftId && isUuid(candidateDraftId)) {
        const updateResult = await updateDraftListing(supabase, {
          draftId: candidateDraftId,
          userId: profile.id,
          patch: basicsValidation.payload,
        });

        if (!updateResult.ok) {
          return {
            ok: false,
            draftId: candidateDraftId,
            message: updateResult.message,
          };
        }

        await recordProviderDraftStepSavedAudit({
          supabase,
          actorUserId: profile.id,
          actorRole: profile.role,
          draftId: candidateDraftId,
          step: "basics",
          outcome: "saved",
        });

        return {
          ok: true,
          draftId: candidateDraftId,
          message: "Basics saved.",
        };
      }

      const draftId = isUuid(createDraftId) ? createDraftId : crypto.randomUUID();
      const slug = buildDraftSlug(basicsValidation.payload.title, draftId);
      const listingCreationContextResult = await resolveProviderListingCreationContext(
        supabase,
        profile
      );

      if (!listingCreationContextResult.ok) {
        return {
          ok: false,
          draftId: null,
          message: listingCreationContextResult.message,
        };
      }

      const listingCreationContext = listingCreationContextResult.context;

      const { error } = await supabase.from("listings").insert({
        id: draftId,
        owner_id: profile.id,
        organization_id: listingCreationContext.organizationId,
        created_by_user_id: profile.id,
        assigned_agent_user_id:
          listingCreationContext.ownershipMode === "company" ? profile.id : null,
        slug,
        title: basicsValidation.payload.title,
        description: basicsValidation.payload.description,
        ...DRAFT_DEFAULTS,
      });

      if (error) {
        if (error.code === "23505") {
          const existingAccess = await ensureDraftAccess(draftId, profile.id, supabase);
          if (existingAccess.ok) {
            await recordProviderDraftStepSavedAudit({
              supabase,
              actorUserId: profile.id,
              actorRole: profile.role,
              draftId,
              step: "basics",
              outcome: "resumed",
            });

            return {
              ok: true,
              draftId,
              message: "Draft resumed.",
            };
          }
        }

        return {
          ok: false,
          draftId: null,
          message: normalizeSupabaseError(error.message),
        };
      }

      await recordSecurityAuditEvent({
        supabase,
        event: {
          eventType: AUDIT_EVENT_TYPES.listingDraftCreated,
          actorUserId: profile.id,
          actorRole: profile.role,
          targetType: "listing",
          targetId: draftId,
          listingId: draftId,
          metadata: {
            source_step: "basics",
          },
        },
      });

      return {
        ok: true,
        draftId,
        message: "Draft created. Continue with pricing details.",
      };
    }

    if (!candidateDraftId || !isUuid(candidateDraftId)) {
      return {
        ok: false,
        draftId: null,
        message: "Draft could not be resolved. Restart from the basics step.",
      };
    }

    const accessResult = await ensureDraftAccess(candidateDraftId, profile.id, supabase);
    if (!accessResult.ok || !accessResult.listing) {
      return {
        ok: false,
        draftId: candidateDraftId,
        message: accessResult.ok ? "Listing not found or inaccessible." : accessResult.message,
      };
    }

    if (step === "pricing") {
      const pricingValidation = validatePricingStep(values);

      if (!pricingValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix pricing fields and retry.",
          fieldErrors: pricingValidation.errors,
        };
      }

      if (
        accessResult.listing.listing_status === "published" &&
        pricingValidation.payload.price_amount <= 0
      ) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Active listings require a price greater than zero.",
          fieldErrors: {
            priceAmount: "Set a price greater than zero or pause/archive the listing first.",
          },
        };
      }

      const updateResult = await updateDraftListing(supabase, {
        draftId: candidateDraftId,
        userId: profile.id,
        patch: pricingValidation.payload,
      });

      if (updateResult.ok) {
        await recordProviderDraftStepSavedAudit({
          supabase,
          actorUserId: profile.id,
          actorRole: profile.role,
          draftId: candidateDraftId,
          step: "pricing",
          outcome: "saved",
        });
      }

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Pricing details saved." : updateResult.message,
      };
    }

    if (step === "facts") {
      const factsValidation = validateFactsStep(values);

      if (!factsValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix property facts and retry.",
          fieldErrors: factsValidation.errors,
        };
      }

      const updateResult = await updateDraftListing(supabase, {
        draftId: candidateDraftId,
        userId: profile.id,
        patch: factsValidation.payload,
      });

      if (updateResult.ok) {
        await recordProviderDraftStepSavedAudit({
          supabase,
          actorUserId: profile.id,
          actorRole: profile.role,
          draftId: candidateDraftId,
          step: "facts",
          outcome: "saved",
        });
      }

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Property facts saved." : updateResult.message,
      };
    }

    if (step === "location") {
      const locationValidation = validateLocationStep(values);

      if (!locationValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Set map pin placement details and retry.",
          fieldErrors: locationValidation.errors,
        };
      }

      const updateResult = await updateDraftListing(supabase, {
        draftId: candidateDraftId,
        userId: profile.id,
        patch: locationValidation.payload,
      });

      if (updateResult.ok) {
        await recordProviderDraftStepSavedAudit({
          supabase,
          actorUserId: profile.id,
          actorRole: profile.role,
          draftId: candidateDraftId,
          step: "location",
          outcome: "saved",
        });
      }

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Location pin saved." : updateResult.message,
      };
    }

    if (step === "amenities") {
      const amenitiesValidation = validateAmenitiesStep(values);

      if (!amenitiesValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix amenities fields and retry.",
          fieldErrors: amenitiesValidation.errors,
        };
      }

      const updateResult = await updateDraftListing(supabase, {
        draftId: candidateDraftId,
        userId: profile.id,
        patch: amenitiesValidation.payload,
      });

      if (updateResult.ok) {
        await recordProviderDraftStepSavedAudit({
          supabase,
          actorUserId: profile.id,
          actorRole: profile.role,
          draftId: candidateDraftId,
          step: "amenities",
          outcome: "saved",
        });
      }

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Amenities saved." : updateResult.message,
      };
    }

    if (step === "contact") {
      const contactValidation = validateContactStep(values);

      if (!contactValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix contact settings and retry.",
          fieldErrors: contactValidation.errors,
        };
      }

      const usesEmailMethod = contactValidation.payload.contact_methods.includes("email");
      const effectiveContactEmail = contactValidation.payload.contact_email ?? (usesEmailMethod ? userEmail : null);

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({
          preferred_contact_method: contactValidation.payload.preferred_contact_method,
          contact_methods: contactValidation.payload.contact_methods,
          contact_email: effectiveContactEmail,
          phone: contactValidation.payload.phone,
          whatsapp_phone: contactValidation.payload.whatsapp_phone,
          viber_phone: contactValidation.payload.viber_phone,
        })
        .eq("id", profile.id)
        .select("id")
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: normalizeSupabaseError(error.message),
        };
      }

      if (!updatedProfile) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Contact settings could not be persisted for this profile. Refresh and retry.",
        };
      }

      await recordProviderDraftStepSavedAudit({
        supabase,
        actorUserId: profile.id,
        actorRole: profile.role,
        draftId: candidateDraftId,
        step: "contact",
        outcome: "saved",
      });

      return {
        ok: true,
        draftId: candidateDraftId,
        message: "Contact settings saved.",
      };
    }

    if (step === "photos") {
      return {
        ok: true,
        draftId: candidateDraftId,
        message: "Photo step ready. Save images in this step before publishing.",
      };
    }

    const reviewValidation = validateReviewStep(values);

    if (!reviewValidation.isReadyForDraft) {
      return {
        ok: false,
        draftId: candidateDraftId,
        message: "Draft is missing required information.",
        reviewBlockers: reviewValidation.blockers,
      };
    }

    return {
      ok: true,
      draftId: candidateDraftId,
      message: "Draft is saved and ready for photo and publish-prep steps.",
    };
  } catch {
    return {
      ok: false,
      draftId: candidateDraftId,
      message: "Draft save failed. Please retry.",
    };
  }
}
