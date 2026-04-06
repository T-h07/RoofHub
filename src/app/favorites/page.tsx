import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function FavoritesPage() {
  return (
    <PlaceholderScreen
      eyebrow="Favorites scaffold"
      title="Saved listing workspace is secured and ready."
      description="This route is now protected by auth session checks and prepared for upcoming favorite collections and compare flows."
      upcoming={[
        "Favorite groupings and collection-level organization",
        "List and map synchronization for saved items",
        "Cross-device persistence and recency sorting",
      ]}
    />
  );
}
