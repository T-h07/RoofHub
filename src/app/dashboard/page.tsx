import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function DashboardPage() {
  return (
    <PlaceholderScreen
      eyebrow="Dashboard scaffold"
      title="Operational dashboard shell is established."
      description="Component density, card hierarchy, and overlay patterns are now consistent so future dashboard PTs can focus on role workflows and data contracts."
      upcoming={[
        "Role-aware navigation and access boundaries",
        "Listing management and moderation operations",
        "Messaging, notifications, and activity surfaces",
      ]}
    />
  );
}
