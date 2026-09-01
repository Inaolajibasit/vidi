import Image from "next/image";

import { cn } from "@/lib/utils";

export interface AvatarProps {
  className?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  src?: string;
}

const sizes = {
  sm: "size-8 text-[0.625rem]",
  md: "size-11 text-xs",
  lg: "size-14 text-sm",
};

export function Avatar({ className, name, size = "md", src }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      aria-label={name}
      className={cn(
        "border-background bg-purple-soft text-purple relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 font-bold tracking-[0.04em]",
        sizes[size],
        className,
      )}
      role="img"
    >
      {src ? (
        <Image alt="" className="object-cover" fill sizes="56px" src={src} />
      ) : (
        initials
      )}
    </span>
  );
}
