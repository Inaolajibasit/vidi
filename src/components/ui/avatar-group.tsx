import { Avatar, type AvatarProps } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarGroupProps {
  avatars: AvatarProps[];
  className?: string;
  max?: number;
  size?: AvatarProps["size"];
}

export function AvatarGroup({
  avatars,
  className,
  max = 4,
  size = "md",
}: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const remaining = Math.max(0, avatars.length - visible.length);

  return (
    <div
      aria-label={`${avatars.length} players`}
      className={cn("flex -space-x-2", className)}
      role="group"
    >
      {visible.map((avatar) => (
        <Avatar {...avatar} key={avatar.name} size={size} />
      ))}
      {remaining > 0 && (
        <span className="border-background bg-surface-strong text-muted relative inline-grid size-11 place-items-center rounded-full border-2 text-xs font-bold">
          +{remaining}
        </span>
      )}
    </div>
  );
}
