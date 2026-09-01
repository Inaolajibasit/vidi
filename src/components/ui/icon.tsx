import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export type IconName =
  | "arrow-left"
  | "check"
  | "chevron-right"
  | "close"
  | "copy"
  | "game"
  | "home"
  | "plus"
  | "profile"
  | "search"
  | "share"
  | "spark"
  | "users";

const paths: Record<IconName, React.ReactNode> = {
  "arrow-left": <path d="m15 18-6-6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  copy: (
    <>
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  game: (
    <>
      <path d="M8 12h.01M16 12h.01M12 8v8" />
      <path d="M7 5h10a4 4 0 0 1 3.7 5.5l-2 5A2.4 2.4 0 0 1 16.5 17c-.7 0-1.4-.3-1.9-.9L13.5 15h-3l-1.1 1.1a2.6 2.6 0 0 1-4.1-.6l-2-5A4 4 0 0 1 7 5Z" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  spark: (
    <path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z" />
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ className, name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  );
}
