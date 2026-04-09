import type { ProviderDraftWizardValues, ProviderHeatingType, ProviderPreferredContactMethod } from "./types";
import type { ProviderWizardFieldErrors } from "./types";

const LISTING_TYPES = new Set(["rent", "sale"]);
const PROPERTY_TYPES = new Set(["apartment", "house", "studio", "land", "commercial"]);
const HEATING_TYPES = new Set(["central", "electric", "gas", "district", "other"]);
const PREFERRED_CONTACT_METHODS = new Set(["in_app", "phone", "email"]);
const PHONE_PATTERN = /^[+0-9().\-\s]{6,24}$/;

function normalizeText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeNullableText(value: string, maxLength: number) {
  const normalized = normalizeText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function parseInteger(
  rawValue: string,
  options: { min?: number; max?: number; allowEmpty?: boolean } = {}
) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return options.allowEmpty ? null : Number.NaN;
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return Number.NaN;
  }

  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  if (options.min !== undefined && value < options.min) {
    return Number.NaN;
  }

  if (options.max !== undefined && value > options.max) {
    return Number.NaN;
  }

  return value;
}

function parseFloatValue(
  rawValue: string,
  options: { min?: number; max?: number; allowEmpty?: boolean } = {}
) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return options.allowEmpty ? null : Number.NaN;
  }

  const value = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  if (options.min !== undefined && value < options.min) {
    return Number.NaN;
  }

  if (options.max !== undefined && value > options.max) {
    return Number.NaN;
  }

  return value;
}

function parseDate(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export type BasicsStepPayload = {
  title: string;
  description: string;
};

export type PricingStepPayload = {
  listing_type: "rent" | "sale";
  property_type: "apartment" | "house" | "studio" | "land" | "commercial";
  price_amount: number;
  currency_code: string;
  deposit_amount: number | null;
};

export type FactsStepPayload = {
  area_m2: number;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_number: number | null;
  total_floors: number | null;
  city: string;
  neighborhood: string | null;
  address_text: string | null;
  available_from: string | null;
};

export type AmenitiesStepPayload = {
  furnished: boolean;
  parking: boolean;
  pets_allowed: boolean;
  elevator: boolean;
  balcony: boolean;
  internet_included: boolean;
  utilities_included: boolean;
  heating_type: ProviderHeatingType | null;
};

export type ContactStepPayload = {
  preferred_contact_method: ProviderPreferredContactMethod | null;
  phone: string | null;
};

type ValidationSuccess<TPayload> = {
  ok: true;
  payload: TPayload;
};

type ValidationError = {
  ok: false;
  errors: ProviderWizardFieldErrors;
};

type ValidationResult<TPayload> = ValidationSuccess<TPayload> | ValidationError;

export function validateBasicsStep(values: ProviderDraftWizardValues): ValidationResult<BasicsStepPayload> {
  const errors: ProviderWizardFieldErrors = {};
  const title = normalizeText(values.title, 120);
  const description = normalizeText(values.description, 5_000);

  if (title.length < 8) {
    errors.title = "Add a clear title (at least 8 characters).";
  }

  if (description.length < 30) {
    errors.description = "Description should be at least 30 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      title,
      description,
    },
  };
}

export function validatePricingStep(values: ProviderDraftWizardValues): ValidationResult<PricingStepPayload> {
  const errors: ProviderWizardFieldErrors = {};
  const listingType = values.listingType;
  const propertyType = values.propertyType;
  const price = parseFloatValue(values.priceAmount, { min: 0, max: 100_000_000 });
  const currencyCode = normalizeText(values.currencyCode.toUpperCase(), 3);
  const deposit = parseFloatValue(values.depositAmount, {
    min: 0,
    max: 100_000_000,
    allowEmpty: true,
  });

  if (!LISTING_TYPES.has(listingType)) {
    errors.listingType = "Select rent or sale.";
  }

  if (!PROPERTY_TYPES.has(propertyType)) {
    errors.propertyType = "Select a valid property type.";
  }

  if (!Number.isFinite(price)) {
    errors.priceAmount = "Enter a valid price amount.";
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    errors.currencyCode = "Use a 3-letter currency code (for example EUR).";
  }

  if (deposit !== null && !Number.isFinite(deposit)) {
    errors.depositAmount = "Deposit must be a valid amount or left empty.";
  }

  if (listingType === "sale" && deposit !== null && Number.isFinite(deposit)) {
    errors.depositAmount = "Deposit is only used for rental listings.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      listing_type: listingType,
      property_type: propertyType,
      price_amount: Number(price),
      currency_code: currencyCode,
      deposit_amount: listingType === "rent" ? (deposit as number | null) : null,
    },
  };
}

export function validateFactsStep(values: ProviderDraftWizardValues): ValidationResult<FactsStepPayload> {
  const errors: ProviderWizardFieldErrors = {};
  const area = parseFloatValue(values.areaM2, { min: 0.01, max: 100_000 });
  const bedrooms = parseInteger(values.bedrooms, { min: 0, max: 30, allowEmpty: true });
  const bathrooms = parseFloatValue(values.bathrooms, { min: 0, max: 30, allowEmpty: true });
  const floorNumber = parseInteger(values.floorNumber, { min: -10, max: 300, allowEmpty: true });
  const totalFloors = parseInteger(values.totalFloors, { min: 1, max: 300, allowEmpty: true });
  const city = normalizeText(values.city, 80);
  const neighborhood = normalizeNullableText(values.neighborhood, 80);
  const addressText = normalizeNullableText(values.addressText, 220);
  const availableFrom = parseDate(values.availableFrom);

  if (!Number.isFinite(area)) {
    errors.areaM2 = "Area must be greater than 0.";
  }

  if (bedrooms !== null && !Number.isFinite(bedrooms)) {
    errors.bedrooms = "Bedrooms must be a whole number.";
  }

  if (bathrooms !== null && !Number.isFinite(bathrooms)) {
    errors.bathrooms = "Bathrooms must be a valid number.";
  }

  if (floorNumber !== null && !Number.isFinite(floorNumber)) {
    errors.floorNumber = "Floor number must be a whole number.";
  }

  if (totalFloors !== null && !Number.isFinite(totalFloors)) {
    errors.totalFloors = "Total floors must be a whole number greater than 0.";
  }

  if (
    floorNumber !== null &&
    totalFloors !== null &&
    Number.isFinite(floorNumber) &&
    Number.isFinite(totalFloors) &&
    floorNumber > totalFloors
  ) {
    errors.floorNumber = "Floor number cannot exceed total floors.";
  }

  if (city.length < 2) {
    errors.city = "Enter a city for this listing.";
  }

  if (values.availableFrom.trim() && !availableFrom) {
    errors.availableFrom = "Use a valid availability date.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      area_m2: Number(area),
      bedrooms: bedrooms as number | null,
      bathrooms: bathrooms as number | null,
      floor_number: floorNumber as number | null,
      total_floors: totalFloors as number | null,
      city,
      neighborhood,
      address_text: addressText,
      available_from: availableFrom,
    },
  };
}

export function validateAmenitiesStep(
  values: ProviderDraftWizardValues
): ValidationResult<AmenitiesStepPayload> {
  const errors: ProviderWizardFieldErrors = {};
  const heatingType = values.heatingType || null;

  if (heatingType && !HEATING_TYPES.has(heatingType)) {
    errors.heatingType = "Select a valid heating type.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      furnished: values.furnished,
      parking: values.parking,
      pets_allowed: values.petsAllowed,
      elevator: values.elevator,
      balcony: values.balcony,
      internet_included: values.internetIncluded,
      utilities_included: values.utilitiesIncluded,
      heating_type: heatingType,
    },
  };
}

export function validateContactStep(values: ProviderDraftWizardValues): ValidationResult<ContactStepPayload> {
  const errors: ProviderWizardFieldErrors = {};
  const preferredContactMethod = values.preferredContactMethod || null;
  const phone = normalizeNullableText(values.contactPhone, 24);

  if (
    preferredContactMethod !== null &&
    !PREFERRED_CONTACT_METHODS.has(preferredContactMethod)
  ) {
    errors.preferredContactMethod = "Select a valid contact preference.";
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.contactPhone = "Phone should include digits and optional +, spaces, (), dots, or dashes.";
  }

  if (preferredContactMethod === "phone" && !phone) {
    errors.contactPhone = "Add a phone number when phone is your preferred contact method.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      preferred_contact_method: preferredContactMethod,
      phone,
    },
  };
}

export function validateReviewStep(values: ProviderDraftWizardValues) {
  const blockers: string[] = [];

  const basics = validateBasicsStep(values);
  if (!basics.ok) {
    blockers.push("Basics");
  }

  const pricing = validatePricingStep(values);
  if (!pricing.ok) {
    blockers.push("Type & pricing");
  }

  const facts = validateFactsStep(values);
  if (!facts.ok) {
    blockers.push("Property facts");
  }

  const contact = validateContactStep(values);
  if (!contact.ok) {
    blockers.push("Contact settings");
  }

  return {
    isReadyForDraft: blockers.length === 0,
    blockers,
  };
}

