import type { ProviderDraftWizardValues, ProviderWizardStep } from "./types";
import {
  validateBasicsStep,
  validateFactsStep,
  validateLocationStep,
  validatePricingStep,
} from "./validation";

export type ProviderPublishBlocker = {
  id: string;
  step: ProviderWizardStep;
  title: string;
  description: string;
};

export type ProviderPublishReadiness = {
  isReady: boolean;
  blockers: ProviderPublishBlocker[];
  imageCount: number;
  hasCoverImage: boolean;
};

type PublishReadinessInput = {
  values: ProviderDraftWizardValues;
  imageCount: number;
  hasCoverImage: boolean;
};

function parsePositiveNumber(rawValue: string) {
  const parsed = Number.parseFloat(rawValue.trim().replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function evaluateProviderPublishReadiness(
  input: PublishReadinessInput
): ProviderPublishReadiness {
  const blockers: ProviderPublishBlocker[] = [];

  const basicsValidation = validateBasicsStep(input.values);
  if (!basicsValidation.ok) {
    blockers.push({
      id: "basics",
      step: "basics",
      title: "Basics need attention",
      description: "Add a clearer title and description before publishing.",
    });
  }

  const pricingValidation = validatePricingStep(input.values);
  if (!pricingValidation.ok) {
    blockers.push({
      id: "pricing",
      step: "pricing",
      title: "Pricing details are incomplete",
      description: "Set listing type, property type, and valid pricing values.",
    });
  } else {
    const parsedPrice = parsePositiveNumber(input.values.priceAmount);
    if (parsedPrice === null || parsedPrice <= 0) {
      blockers.push({
        id: "pricing-positive",
        step: "pricing",
        title: "Price must be greater than zero",
        description: "Publish flow requires a real non-zero listing price.",
      });
    }
  }

  const factsValidation = validateFactsStep(input.values);
  if (!factsValidation.ok) {
    blockers.push({
      id: "facts",
      step: "facts",
      title: "Property facts are incomplete",
      description: "Add required facts like area and city with valid values.",
    });
  }

  const locationValidation = validateLocationStep(input.values);
  if (!locationValidation.ok) {
    blockers.push({
      id: "location",
      step: "location",
      title: "Location pin is not ready",
      description: "Place a map pin and choose public location visibility.",
    });
  }

  if (input.imageCount < 1) {
    blockers.push({
      id: "photos-empty",
      step: "photos",
      title: "Add at least one photo",
      description: "Published listings need at least one visible image.",
    });
  } else if (!input.hasCoverImage) {
    blockers.push({
      id: "photos-cover",
      step: "photos",
      title: "Choose a cover photo",
      description: "One photo must be marked as cover for public listing surfaces.",
    });
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    imageCount: input.imageCount,
    hasCoverImage: input.hasCoverImage,
  };
}
