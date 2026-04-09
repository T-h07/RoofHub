import type { ProviderContactSettings, ProviderDraftEditorRecord, ProviderDraftWizardValues } from "./types";
import { PROVIDER_WIZARD_DEFAULT_VALUES } from "./types";

function formatNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || value === undefined) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number(value).toFixed(maximumFractionDigits).replace(/\.?0+$/, "");
}

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function normalizeCoordinate(value: number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildWizardValuesFromDraft(
  draft: ProviderDraftEditorRecord,
  contact: ProviderContactSettings
): ProviderDraftWizardValues {
  return {
    ...PROVIDER_WIZARD_DEFAULT_VALUES,
    title: draft.title,
    description: draft.description,
    listingType: draft.listing_type,
    propertyType: draft.property_type,
    priceAmount: formatNumber(draft.price_amount, 2),
    currencyCode: draft.currency_code,
    depositAmount: formatNumber(draft.deposit_amount, 2),
    areaM2: formatNumber(draft.area_m2, 2),
    bedrooms: formatNumber(draft.bedrooms, 0),
    bathrooms: formatNumber(draft.bathrooms, 1),
    floorNumber: formatNumber(draft.floor_number, 0),
    totalFloors: formatNumber(draft.total_floors, 0),
    city: draft.city,
    neighborhood: draft.neighborhood ?? "",
    addressText: draft.address_text ?? "",
    latitude: normalizeCoordinate(draft.latitude),
    longitude: normalizeCoordinate(draft.longitude),
    publicLocationMode: draft.public_location_mode === "exact" ? "exact" : "approximate",
    availableFrom: formatDate(draft.available_from),
    furnished: draft.furnished,
    parking: draft.parking,
    petsAllowed: draft.pets_allowed,
    elevator: draft.elevator,
    balcony: draft.balcony,
    internetIncluded: draft.internet_included,
    utilitiesIncluded: draft.utilities_included,
    heatingType: draft.heating_type ?? "",
    preferredContactMethod: contact.preferredContactMethod,
    contactMethods: contact.contactMethods,
    contactEmail: contact.contactEmail,
    contactPhone: contact.phone,
    whatsappPhone: contact.whatsappPhone,
    viberPhone: contact.viberPhone,
  };
}
