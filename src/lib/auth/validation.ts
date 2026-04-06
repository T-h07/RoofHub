import type { AuthFormErrors } from "./types";

const MIN_PASSWORD_LENGTH = 8;

function normalize(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readAuthCredentials(formData: FormData) {
  const email = normalize(formData.get("email")).toLowerCase();
  const password =
    typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

  return { email, password };
}

export function readSignUpFields(formData: FormData) {
  const displayName = normalize(formData.get("displayName"));
  const { email, password } = readAuthCredentials(formData);
  const confirmPassword =
    typeof formData.get("confirmPassword") === "string"
      ? String(formData.get("confirmPassword"))
      : "";

  return { displayName, email, password, confirmPassword };
}

export function readResetPasswordFields(formData: FormData) {
  const password =
    typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const confirmPassword =
    typeof formData.get("confirmPassword") === "string"
      ? String(formData.get("confirmPassword"))
      : "";

  return { password, confirmPassword };
}

export function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateSignInInput(input: { email: string; password: string }) {
  const errors: AuthFormErrors = {};

  if (!input.email || !isEmailValid(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!input.password) {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function validateSignUpInput(input: {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const errors: AuthFormErrors = {};

  if (!input.displayName || input.displayName.length < 2) {
    errors.displayName = "Display name must be at least 2 characters.";
  }

  if (!input.email || !isEmailValid(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export function validateForgotPasswordInput(input: { email: string }) {
  const errors: AuthFormErrors = {};

  if (!input.email || !isEmailValid(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

export function validateResetPasswordInput(input: { password: string; confirmPassword: string }) {
  const errors: AuthFormErrors = {};

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`;
  }

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
