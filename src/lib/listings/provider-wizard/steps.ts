import {
  PROVIDER_WIZARD_STEPS,
  type ProviderWizardStep,
} from "./types";

export const PROVIDER_WIZARD_FIRST_STEP: ProviderWizardStep = "basics";
export const PROVIDER_WIZARD_LAST_STEP: ProviderWizardStep = "review";

export function isProviderWizardStep(value: string | null | undefined): value is ProviderWizardStep {
  if (!value) {
    return false;
  }

  return PROVIDER_WIZARD_STEPS.includes(value as ProviderWizardStep);
}

export function parseProviderWizardStep(
  value: string | null | undefined,
  fallback: ProviderWizardStep = PROVIDER_WIZARD_FIRST_STEP
) {
  return isProviderWizardStep(value) ? value : fallback;
}

export function getProviderWizardStepIndex(step: ProviderWizardStep) {
  return PROVIDER_WIZARD_STEPS.indexOf(step);
}

export function getPreviousProviderWizardStep(step: ProviderWizardStep) {
  const index = getProviderWizardStepIndex(step);
  if (index <= 0) {
    return null;
  }

  return PROVIDER_WIZARD_STEPS[index - 1] ?? null;
}

export function getNextProviderWizardStep(step: ProviderWizardStep) {
  const index = getProviderWizardStepIndex(step);
  const nextIndex = index + 1;
  if (nextIndex >= PROVIDER_WIZARD_STEPS.length) {
    return null;
  }

  return PROVIDER_WIZARD_STEPS[nextIndex] ?? null;
}

