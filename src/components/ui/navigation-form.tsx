"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ButtonPendingContext } from "./button";

export function NavigationForm({
  children,
  className,
  role,
}: {
  children: ReactNode;
  className?: string;
  role?: "search";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  useEffect(() => {
    if (!pending) locked.current = false;
  }, [pending]);
  return (
    <ButtonPendingContext.Provider value={pending}>
      <form
        action={pathname}
        method="get"
        className={className}
        role={role}
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (locked.current) return;
          const query = new URLSearchParams();
          for (const [key, value] of new FormData(event.currentTarget)) {
            if (typeof value === "string") query.append(key, value);
          }
          locked.current = true;
          startTransition(() => router.push(`${pathname}?${query}`));
        }}
      >
        {children}
      </form>
    </ButtonPendingContext.Provider>
  );
}
