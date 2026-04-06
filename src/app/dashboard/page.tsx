import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function DashboardPage() {
  return (
    <PlaceholderScreen
      eyebrow="Route Foundation"
      title="Dashboard route is scaffolded for operational workflows."
      description="The shell is in place for later PTs to add account tools, listing management, and reporting surfaces without revisiting global layout foundations."
      upcoming={[
        "Role-aware navigation and access boundaries",
        "Listing management and moderation operations",
        "Messaging, notifications, and activity surfaces",
      ]}
    />
  );
}
