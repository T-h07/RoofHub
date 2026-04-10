import { BrowseIntentSection } from "@/components/home/browse-intent-section";
import { FeaturedListingsSection } from "@/components/home/featured-listings-section";
import { HomeHero } from "@/components/home/home-hero";
import { ProviderCtaSection } from "@/components/home/provider-cta-section";
import { MainContainer } from "@/components/layout/main-container";
import { EXPLORE_DEFAULT_STATE } from "@/lib/listings/explore-search-params";
import { loadPublicExploreListings } from "@/lib/listings/public-explore";

export default async function Home() {
  const featuredResult = await loadPublicExploreListings({
    ...EXPLORE_DEFAULT_STATE,
    page: 1,
    sort: "newest",
  });
  const featuredListings = featuredResult.ok ? featuredResult.listings.slice(0, 4) : [];

  return (
    <MainContainer size="wide" className="space-y-10">
      <HomeHero />
      <BrowseIntentSection />
      <FeaturedListingsSection
        listings={featuredListings}
        isAuthenticated={Boolean(featuredResult.viewerUserId)}
        loadErrorMessage={featuredResult.ok ? null : featuredResult.message}
      />
      <ProviderCtaSection />
    </MainContainer>
  );
}
