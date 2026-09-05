import { StatusAction, StatusScreen } from "@/components/ui/status-state";

export default function ProfileNotFound() {
  return (
    <StatusScreen
      action={<StatusAction href="/friends">Find friends</StatusAction>}
      description="This profile does not exist, or its username has changed."
      eyebrow="Profile not found"
      title="No one here."
      tone="purple"
    />
  );
}
