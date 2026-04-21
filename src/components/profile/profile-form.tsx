import { ProfileAccountModeForm } from "@/components/profile/profile-account-mode-form";
import { ProfileContactPreferencesForm } from "@/components/profile/profile-contact-preferences-form";
import { ProfileOverviewHero } from "@/components/profile/profile-overview-hero";
import { ProfilePublicProfileForm } from "@/components/profile/profile-public-profile-form";
import { ProfileSecurityPanel } from "@/components/profile/profile-security-panel";

import type { ProfileAccountSnapshot, ProfileExperience, ProfileSnapshot } from "./types";

type ProfileFormProps = {
  profile: ProfileSnapshot;
  account: ProfileAccountSnapshot;
  experience: ProfileExperience;
};

export function ProfileForm({ profile, account, experience }: ProfileFormProps) {
  return (
    <div className="space-y-6 pb-12">
      <ProfileOverviewHero profile={profile} account={account} experience={experience} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="space-y-6">
          <ProfilePublicProfileForm profile={profile} account={account} />
          <ProfileContactPreferencesForm profile={profile} account={account} />
        </div>

        <div className="space-y-6">
          <ProfileAccountModeForm profile={profile} />
          <ProfileSecurityPanel account={account} />
        </div>
      </div>
    </div>
  );
}

export type { ProfileExperience } from "./types";
