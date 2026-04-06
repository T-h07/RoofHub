import { BrowseIntentSection } from "@/components/home/browse-intent-section";
import { FeaturedListingsSection } from "@/components/home/featured-listings-section";
import { HomeHero } from "@/components/home/home-hero";
import { ProviderCtaSection } from "@/components/home/provider-cta-section";
import { MainContainer } from "@/components/layout/main-container";

export default function Home() {
  return (
    <MainContainer size="wide" className="space-y-10">
      <HomeHero />
      <BrowseIntentSection />
      <FeaturedListingsSection />
      <ProviderCtaSection />
    </MainContainer>
  );
}
