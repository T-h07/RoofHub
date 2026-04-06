import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function MapPage() {
  return (
    <PlaceholderScreen
      eyebrow="Route Foundation"
      title="Map workspace is prepared but intentionally empty."
      description="NM-PT01 defines the route and shell only. Interactive map rendering, markers, clustering, and geospatial behavior will be introduced in later PTs."
      upcoming={[
        "Map provider integration with environment-driven configuration",
        "Marker and cluster rendering pipeline",
        "Viewport and selection state orchestration",
      ]}
    />
  );
}
