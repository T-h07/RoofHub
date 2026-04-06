import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function ExplorePage() {
  return (
    <PlaceholderScreen
      eyebrow="Route Foundation"
      title="Explore listings is reserved for future PTs."
      description="This surface will host search-first discovery, listing density controls, and map/list synchronization once domain features are implemented."
      upcoming={[
        "Listing cards and list virtualization for high-density results",
        "Search and filter controls connected to query state",
        "Selection model shared with map and detail panes",
      ]}
    />
  );
}
