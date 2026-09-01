import Image from "next/image";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface MoviePosterProps {
  alt: string;
  badge?: string;
  className?: string;
  priority?: boolean;
  src?: string;
}

export function MoviePoster({
  alt,
  badge,
  className,
  priority,
  src,
}: MoviePosterProps) {
  return (
    <figure
      className={cn(
        "bg-surface-strong border-border relative aspect-2/3 overflow-hidden rounded-lg border",
        className,
      )}
    >
      {src ? (
        <Image
          alt={alt}
          className="object-cover"
          fill
          priority={priority}
          sizes="(max-width: 640px) 75vw, 320px"
          src={src}
        />
      ) : (
        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_70%_20%,var(--accent-personality-soft),transparent_38%),linear-gradient(145deg,var(--surface-strong),var(--surface-canvas))]">
          <div className="text-center">
            <Icon className="text-purple mx-auto mb-3" name="spark" size={28} />
            <span className="text-label text-muted">Poster unavailable</span>
          </div>
        </div>
      )}
      {badge && (
        <span className="text-label bg-background/85 text-foreground absolute top-3 left-3 rounded-full px-2.5 py-1.5 backdrop-blur-sm">
          {badge}
        </span>
      )}
    </figure>
  );
}
