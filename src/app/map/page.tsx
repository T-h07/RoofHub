import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function MapPage() {
  return (
    <PlaceholderScreen
      eyebrow="Map scaffold"
      title="Map workspace composition is prepared for geospatial PTs."
      description="Global shell, spacing rhythm, and feedback components are already in place. Later map logic can focus on interaction and data, not shell rewrites."
      upcoming={[
        "Map provider integration with environment-driven configuration",
        "Marker and cluster rendering pipeline",
        "Viewport and selection state orchestration",
      ]}
    />
  );
}
