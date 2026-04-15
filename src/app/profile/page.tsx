import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { Building2, TriangleAlert, UserRound } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { ProfileForm, type ProfileExperience } from "@/components/profile/profile-form";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isProviderRole, type PreferredContactMethod } from "@/lib/auth/roles";
import { getCompanyMembershipContextForUser } from "@/lib/company/context";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import { loadProviderListingOverviewMetrics } from "@/lib/listings/provider-dashboard/queries";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Database, Tables } from "@/types/database";

type CompletionCheck = {
  label: string;
  ready: boolean;
};

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en").format(value);
}

function buildCompletionSummary(percent: number) {
  if (percent >= 90) {
    return "Launch-ready profile identity";
  }

  if (percent >= 75) {
    return "Strong profile baseline";
  }

  if (percent >= 50) {
    return "Solid progress, needs refinement";
  }

  return "Initial profile setup in progress";
}

function buildProfileCompletion(profile: Tables<"profiles">) {
  const hasChannels = profile.contact_methods.length > 0;
  const completionChecks: CompletionCheck[] = [
    {
      label: "display name",
      ready: profile.display_name.trim().length >= 2,
    },
    {
      label: "profile photo",
      ready: Boolean(profile.avatar_url),
    },
    {
      label: "about summary",
      ready: Boolean(profile.bio?.trim()),
    },
    {
      label: "contact channels",
      ready: hasChannels,
    },
    {
      label: "primary contact method",
      ready: Boolean(profile.preferred_contact_method),
    },
  ];

  if (isProviderRole(profile.role)) {
    completionChecks.push(
      {
        label: "multiple response channels",
        ready: profile.contact_methods.length >= 2,
      },
      {
        label: "direct response detail",
        ready: Boolean(
          profile.phone?.trim() ||
          profile.contact_email?.trim() ||
          profile.whatsapp_phone?.trim() ||
          profile.viber_phone?.trim()
        ),
      }
    );
  } else {
    completionChecks.push({
      label: "direct contact preference",
      ready: Boolean(profile.phone?.trim() || profile.contact_email?.trim()),
    });
  }

  const completedCount = completionChecks.filter((check) => check.ready).length;
  const completionPercent = Math.round((completedCount / completionChecks.length) * 100);

  return {
    completionPercent,
    completionSummary: buildCompletionSummary(completionPercent),
    missingItems: completionChecks.filter((check) => !check.ready).map((check) => check.label),
  };
}

async function loadSeekerProfileExperience(
  supabase: SupabaseClient<Database>,
  profile: Tables<"profiles">
) {
  const [favoritesCountResult, conversationCountResult] = await Promise.all([
    supabase
      .from("favorites")
      .select("listing_id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .or(`provider_id.eq.${profile.id},seeker_id.eq.${profile.id}`),
  ]);

  const favoritesCount = favoritesCountResult.error ? null : (favoritesCountResult.count ?? 0);
  const conversationCount = conversationCountResult.error
    ? null
    : (conversationCountResult.count ?? 0);
  const completion = buildProfileCompletion(profile);

  return {
    heroTitle: "Personal account identity",
    heroDescription:
      "Shape how your RoofHub account appears in saved listings, messaging threads, and activity history.",
    roleDescriptor: "Seeker profile",
    previewTitle: "How your account context is presented",
    previewDescription:
      "Seeker identity is private-first while still keeping your preferences and contact readiness consistent.",
    completionPercent: completion.completionPercent,
    completionSummary: completion.completionSummary,
    missingItems: completion.missingItems,
    metrics: [
      {
        label: "Saved listings",
        value: formatCount(favoritesCount),
        hint: "Keep favorites visible from explore and map flows.",
        tone: "primary",
      },
      {
        label: "Conversations",
        value: formatCount(conversationCount),
        hint: "Messaging threads linked to listing inquiries.",
        tone: "neutral",
      },
      {
        label: "Primary channel",
        value: profile.preferred_contact_method
          ? profile.preferred_contact_method.replace("_", " ")
          : "Not selected",
        hint: "Used as the first contact preference in messaging context.",
        tone: "success",
      },
    ],
  } satisfies ProfileExperience;
}

async function loadProviderProfileExperience(
  supabase: SupabaseClient<Database>,
  profile: Tables<"profiles">,
  organizationId: string | null
) {
  const overviewResult = await loadProviderListingOverviewMetrics(supabase, {
    userId: profile.id,
    organizationId,
  });
  const completion = buildProfileCompletion(profile);

  return {
    heroTitle: "Marketplace-facing provider identity",
    heroDescription:
      "Your provider profile shapes trust on listing detail pages, contact surfaces, and lead response expectations.",
    roleDescriptor: "Provider profile",
    previewTitle: "How seekers evaluate your profile",
    previewDescription:
      "Provider-facing identity should feel professional, responsive, and consistent across listing and messaging flows.",
    completionPercent: completion.completionPercent,
    completionSummary: completion.completionSummary,
    missingItems: completion.missingItems,
    metrics: [
      {
        label: "Published listings",
        value: overviewResult.ok ? formatCount(overviewResult.metrics.published) : "--",
        hint: "Public inventory currently visible to seekers.",
        tone: "primary",
      },
      {
        label: "Draft pipeline",
        value: overviewResult.ok ? formatCount(overviewResult.metrics.draft) : "--",
        hint: "Listings still being prepared for publish.",
        tone: "neutral",
      },
      {
        label: "Unread leads",
        value: overviewResult.ok ? formatCount(overviewResult.metrics.unreadLeadsCount) : "--",
        hint: "New inbound threads requiring provider follow-up.",
        tone: "success",
      },
      {
        label: "Hidden by moderation",
        value: overviewResult.ok ? formatCount(overviewResult.metrics.hiddenByAdmin) : "--",
        hint: "Listings currently under moderation visibility controls.",
        tone: "warning",
      },
    ],
  } satisfies ProfileExperience;
}

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile"));
  }

  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return (
      <MainContainer size="content" className="space-y-6">
        <EmptyState
          icon={UserRound}
          title="Profile could not be loaded"
          description={profileResult.message}
        />
      </MainContainer>
    );
  }

  const profile = profileResult.profile;
  const companyContextResult = await getCompanyMembershipContextForUser(supabase, profile.id);
  const ownerOrganization = companyContextResult.ok ? companyContextResult.ownerOrganization : null;
  const listingCreationContextResult = isProviderRole(profile.role)
    ? await resolveProviderListingCreationContext(supabase, profile)
    : null;
  const providerOrganizationId =
    listingCreationContextResult && listingCreationContextResult.ok
      ? listingCreationContextResult.context.organizationId
      : null;
  const roleExperience = isProviderRole(profile.role)
    ? await loadProviderProfileExperience(supabase, profile, providerOrganizationId)
    : await loadSeekerProfileExperience(supabase, profile);

  const contactMethods: PreferredContactMethod[] =
    profile.contact_methods.length > 0
      ? profile.contact_methods
      : profile.preferred_contact_method
        ? [profile.preferred_contact_method]
        : ["in_app"];

  return (
    <MainContainer size="wide" className="space-y-6">
      <ProfileForm
        key={`${profile.updated_at}:${profile.avatar_url ?? "no-avatar"}:${profile.role}`}
        profile={{
          id: profile.id,
          displayName: profile.display_name,
          role: profile.role,
          providerAccountType: profile.provider_account_type,
          bio: profile.bio,
          phone: profile.phone,
          avatarUrl: profile.avatar_url,
          preferredContactMethod: profile.preferred_contact_method,
          contactMethods,
          contactEmail: profile.contact_email,
          whatsappPhone: profile.whatsapp_phone,
          viberPhone: profile.viber_phone,
        }}
        account={{
          email: profileResult.user.email ?? null,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        }}
        experience={roleExperience}
      />

      {companyContextResult.ok ? (
        ownerOrganization ? (
          <section className="border-border bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_56%),linear-gradient(334deg,color-mix(in_oklch,var(--accent)_10%,transparent)_0%,transparent_72%)] opacity-52" />
            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Building2 className="text-primary size-4" />
                Company workspace active
              </div>
              <h2 className="type-section-title">{ownerOrganization.name}</h2>
              <p className="type-body-muted max-w-3xl">
                This account owns your RoofHub company workspace. Continue in the workspace to
                manage branding, contact details, and public company profile presence.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
                  Open company workspace
                </Link>
                <Link
                  href="/profile/company/team"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Manage team members
                </Link>
                <Link
                  href={`/companies/${ownerOrganization.slug}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  View public company page
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Building2 className="text-primary size-4" />
                Company workspace
              </div>
              <h2 className="type-section-title">Create a company account foundation</h2>
              <p className="type-body-muted max-w-3xl">
                Set up a company workspace to operate as a company provider while keeping account
                ownership and session handling anchored to trusted server-side membership records.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/profile/company/new" className={buttonVariants({ size: "sm" })}>
                  Create company workspace
                </Link>
                <Link
                  href="/profile/company"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Learn more
                </Link>
              </div>
            </div>
          </section>
        )
      ) : (
        <EmptyState
          icon={Building2}
          title="Company context is temporarily unavailable"
          description={companyContextResult.message}
        />
      )}

      {roleExperience.metrics.some((metric) => metric.value === "--") ? (
        <EmptyState
          icon={TriangleAlert}
          title="Some profile insights are unavailable"
          description="Operational metrics are partially unavailable right now. Profile editing remains fully functional."
        />
      ) : null}
    </MainContainer>
  );
}
