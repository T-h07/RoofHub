"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isAdminRole, isProviderRole } from "@/lib/auth/roles";

import type { ProviderDraftWizardValues, ProviderWizardFieldErrors, ProviderWizardStep } from "./types";
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

function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function normalizeSupabaseError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to edit this listing draft.";
  }

  if (normalized.includes("check constraint")) {
    return "Some values do not match listing requirements. Review highlighted fields and retry.";
  }

  return "Draft save failed. Please retry.";
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
      isAdmin: false,
    };
  }

  if (!isProviderRole(profileResult.profile.role)) {
    return {
      ok: false as const,
      message: "Switch your profile role to provider before creating listings.",
      supabase,
      profile: profileResult.profile,
      isAdmin: isAdminRole(profileResult.profile.role),
    };
  }

  return {
    ok: true as const,
    supabase,
    profile: profileResult.profile,
    isAdmin: isAdminRole(profileResult.profile.role),
  };
}

async function ensureDraftAccess(
  draftId: string,
  userId: string,
  isAdmin: boolean,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  let query = supabase.from("listings").select("id, owner_id, listing_status").eq("id", draftId).limit(1);
  if (!isAdmin) {
    query = query.eq("owner_id", userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return {
      ok: false as const,
      message: "Draft listing not found or inaccessible.",
    };
  }

  return {
    ok: true as const,
  };
}

async function updateDraftListing(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  options: {
    draftId: string;
    userId: string;
    isAdmin: boolean;
    patch: Record<string, unknown>;
  }
) {
  let query = supabase
    .from("listings")
    .update(options.patch)
    .eq("id", options.draftId)
    .select("id")
    .limit(1);

  if (!options.isAdmin) {
    query = query.eq("owner_id", options.userId);
  }

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

export async function saveProviderWizardStepAction(
  input: SaveProviderWizardStepInput
): Promise<SaveProviderWizardStepResult> {
  const providerContext = await ensureProviderContext();

  if (!providerContext.ok) {
    return {
      ok: false,
      draftId: null,
      message: providerContext.message,
    };
  }

  const { supabase, profile, isAdmin } = providerContext;
  const candidateDraftId = input.draftId ?? null;

  try {
    if (input.step === "basics") {
      const basicsValidation = validateBasicsStep(input.values);
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
          isAdmin,
          patch: basicsValidation.payload,
        });

        if (!updateResult.ok) {
          return {
            ok: false,
            draftId: candidateDraftId,
            message: updateResult.message,
          };
        }

        return {
          ok: true,
          draftId: candidateDraftId,
          message: "Basics saved.",
        };
      }

      const draftId = isUuid(input.createDraftId) ? input.createDraftId! : crypto.randomUUID();
      const slug = buildDraftSlug(basicsValidation.payload.title, draftId);

      const { error } = await supabase.from("listings").insert({
        id: draftId,
        owner_id: profile.id,
        slug,
        title: basicsValidation.payload.title,
        description: basicsValidation.payload.description,
        ...DRAFT_DEFAULTS,
      });

      if (error) {
        if (error.code === "23505") {
          const existingAccess = await ensureDraftAccess(draftId, profile.id, isAdmin, supabase);
          if (existingAccess.ok) {
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

    const accessResult = await ensureDraftAccess(candidateDraftId, profile.id, isAdmin, supabase);
    if (!accessResult.ok) {
      return {
        ok: false,
        draftId: candidateDraftId,
        message: accessResult.message,
      };
    }

    if (input.step === "pricing") {
      const pricingValidation = validatePricingStep(input.values);

      if (!pricingValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix pricing fields and retry.",
          fieldErrors: pricingValidation.errors,
        };
      }

      const updateResult = await updateDraftListing(supabase, {
        draftId: candidateDraftId,
        userId: profile.id,
        isAdmin,
        patch: pricingValidation.payload,
      });

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Pricing details saved." : updateResult.message,
      };
    }

    if (input.step === "facts") {
      const factsValidation = validateFactsStep(input.values);

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
        isAdmin,
        patch: factsValidation.payload,
      });

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Property facts saved." : updateResult.message,
      };
    }

    if (input.step === "location") {
      const locationValidation = validateLocationStep(input.values);

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
        isAdmin,
        patch: locationValidation.payload,
      });

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Location pin saved." : updateResult.message,
      };
    }

    if (input.step === "amenities") {
      const amenitiesValidation = validateAmenitiesStep(input.values);

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
        isAdmin,
        patch: amenitiesValidation.payload,
      });

      return {
        ok: updateResult.ok,
        draftId: candidateDraftId,
        message: updateResult.ok ? "Amenities saved." : updateResult.message,
      };
    }

    if (input.step === "contact") {
      const contactValidation = validateContactStep(input.values);

      if (!contactValidation.ok) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: "Fix contact settings and retry.",
          fieldErrors: contactValidation.errors,
        };
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_contact_method: contactValidation.payload.preferred_contact_method,
          phone: contactValidation.payload.phone,
        })
        .eq("id", profile.id);

      if (error) {
        return {
          ok: false,
          draftId: candidateDraftId,
          message: normalizeSupabaseError(error.message),
        };
      }

      return {
        ok: true,
        draftId: candidateDraftId,
        message: "Contact settings saved.",
      };
    }

    const reviewValidation = validateReviewStep(input.values);

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
