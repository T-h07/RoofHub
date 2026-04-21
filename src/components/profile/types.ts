export type ProfileExperienceMetric = {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "primary" | "success" | "warning";
};

export type ProfileExperience = {
  heroTitle: string;
  heroDescription: string;
  roleDescriptor: string;
  previewTitle: string;
  previewDescription: string;
  completionPercent: number;
  completionSummary: string;
  missingItems: string[];
  metrics: ProfileExperienceMetric[];
};

export type ProfileSnapshot = {
  id: string;
  displayName: string;
  role: import("@/lib/auth/roles").AppRole;
  providerAccountType: import("@/lib/auth/roles").ProviderAccountType;
  bio: string | null;
  phone: string | null;
  avatarUrl: string | null;
  preferredContactMethod: import("@/lib/auth/roles").PreferredContactMethod | null;
  contactMethods: import("@/lib/auth/roles").PreferredContactMethod[];
  contactEmail: string | null;
  whatsappPhone: string | null;
  viberPhone: string | null;
};

export type ProfileAccountSnapshot = {
  email: string | null;
  createdAt: string;
  updatedAt: string;
};
