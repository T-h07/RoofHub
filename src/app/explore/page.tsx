import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function ExplorePage() {
  return (
    <PlaceholderScreen
      eyebrow="Explore scaffold"
      title="Explore route is ready for list-first discovery flows."
      description="The PT02 shell and primitives are now applied here so search, filters, and listing density controls can be added without rebuilding composition."
      upcoming={[
        "Listing cards and list virtualization for high-density results",
        "Search and filter controls connected to query state",
        "Selection model shared with map and detail panes",
      ]}
    />
  );
}
