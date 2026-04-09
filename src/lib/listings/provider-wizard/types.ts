import type { Enums, Tables } from "@/types/database";

export const PROVIDER_WIZARD_STEPS = [
  "basics",
  "pricing",
  "facts",
  "amenities",
  "contact",
  "review",
] as const;

export type ProviderWizardStep = (typeof PROVIDER_WIZARD_STEPS)[number];
export type ProviderListingType = Enums<"listing_type">;
export type ProviderPropertyType = Enums<"property_type">;
export type ProviderHeatingType = Enums<"heating_type">;
export type ProviderPreferredContactMethod = Enums<"preferred_contact_method">;

export const PROVIDER_WIZARD_STEP_LABELS: Record<ProviderWizardStep, string> = {
  basics: "Basics",
  pricing: "Type & pricing",
  facts: "Property facts",
  amenities: "Amenities",
  contact: "Contact settings",
  review: "Review draft",
};

export type ProviderDraftWizardValues = {
  title: string;
  description: string;
  listingType: ProviderListingType;
  propertyType: ProviderPropertyType;
  priceAmount: string;
  currencyCode: string;
  depositAmount: string;
  areaM2: string;
  bedrooms: string;
  bathrooms: string;
  floorNumber: string;
  totalFloors: string;
  city: string;
  neighborhood: string;
  addressText: string;
  availableFrom: string;
  furnished: boolean;
  parking: boolean;
  petsAllowed: boolean;
  elevator: boolean;
  balcony: boolean;
  internetIncluded: boolean;
  utilitiesIncluded: boolean;
  heatingType: ProviderHeatingType | "";
  preferredContactMethod: ProviderPreferredContactMethod | "";
  contactPhone: string;
};

export const PROVIDER_WIZARD_DEFAULT_VALUES: ProviderDraftWizardValues = {
  title: "",
  description: "",
  listingType: "rent",
  propertyType: "apartment",
  priceAmount: "",
  currencyCode: "EUR",
  depositAmount: "",
  areaM2: "",
  bedrooms: "",
  bathrooms: "",
  floorNumber: "",
  totalFloors: "",
  city: "",
  neighborhood: "",
  addressText: "",
  availableFrom: "",
  furnished: false,
  parking: false,
  petsAllowed: false,
  elevator: false,
  balcony: false,
  internetIncluded: false,
  utilitiesIncluded: false,
  heatingType: "",
  preferredContactMethod: "",
  contactPhone: "",
};

export type ProviderDraftEditorRecord = Pick<
  Tables<"listings">,
  | "id"
  | "owner_id"
  | "slug"
  | "title"
  | "description"
  | "listing_type"
  | "property_type"
  | "listing_status"
  | "price_amount"
  | "currency_code"
  | "deposit_amount"
  | "area_m2"
  | "bedrooms"
  | "bathrooms"
  | "floor_number"
  | "total_floors"
  | "city"
  | "neighborhood"
  | "address_text"
  | "available_from"
  | "furnished"
  | "parking"
  | "pets_allowed"
  | "elevator"
  | "balcony"
  | "internet_included"
  | "utilities_included"
  | "heating_type"
  | "public_location_mode"
  | "latitude"
  | "longitude"
  | "updated_at"
  | "created_at"
>;

export type ProviderDraftSummary = Pick<
  Tables<"listings">,
  | "id"
  | "slug"
  | "title"
  | "listing_status"
  | "listing_type"
  | "property_type"
  | "city"
  | "price_amount"
  | "updated_at"
  | "created_at"
>;

export type ProviderContactSettings = {
  preferredContactMethod: ProviderPreferredContactMethod | "";
  phone: string;
};

export type ProviderWizardFieldErrors = Partial<Record<keyof ProviderDraftWizardValues, string>>;

