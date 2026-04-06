import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

export default function MessagesPage() {
  return (
    <PlaceholderScreen
      eyebrow="Messages scaffold"
      title="Conversation workspace is locked to authenticated users."
      description="Messaging surfaces can now be built on top of session-aware navigation and protected route flow."
      upcoming={[
        "Conversation list and unread state model",
        "Thread pane composition with listing context",
        "Realtime message delivery and presence states",
      ]}
    />
  );
}
