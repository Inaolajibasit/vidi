"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface AvatarProps {
  className?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  src?: string;
}

const sizes = {
  sm: "size-8 text-[0.625rem]",
  md: "size-11 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-xl",
};

export function Avatar({ className, name, size = "md", src }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

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
        "border-purple bg-purple text-foreground relative inline-grid shrink-0 place-items-center overflow-hidden rounded-sm border font-extrabold tracking-[0.04em]",
        sizes[size],
        className,
      )}
      role="img"
    >
      {src && failedSrc !== src ? (
        // Profile avatars can come from OAuth providers or a validated custom
        // URL, so a native image avoids coupling accounts to a host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          decoding="async"
          onError={() => setFailedSrc(src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : (
        initials || <span aria-hidden="true">?</span>
      )}
    </span>
  );
}
