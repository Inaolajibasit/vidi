"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { signOutAction } from "@/features/auth/actions";

interface AccountMenuProps {
  avatarUrl: string | null;
  displayName: string;
}

const links: Array<{ href: string; icon: IconName; label: string }> = [
  { href: "/games", icon: "game", label: "Games" },
  { href: "/friends", icon: "users", label: "Friends" },
  { href: "/profile", icon: "profile", label: "Profile" },
];

export function AccountMenu({ avatarUrl, displayName }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Close account menu" : "Open account menu"}
        className="focus-visible:outline-accent group relative grid size-11 place-items-center rounded-sm transition-transform duration-150 hover:-rotate-2 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Avatar
          className="border-accent shadow-[3px_3px_0_#2227F7] transition-shadow group-hover:shadow-[4px_4px_0_#FFD628]"
          name={displayName}
          size="md"
          src={avatarUrl ?? undefined}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="border-foreground/20 bg-background/95 absolute top-[calc(100%+0.75rem)] right-0 z-50 w-52 origin-top-right overflow-hidden rounded-sm border p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            exit={{ opacity: 0, scale: 0.97, y: -5 }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: -5 }}
            role="menu"
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="border-foreground/15 border-b px-3 py-2.5">
              <p className="text-muted text-[0.62rem] font-bold tracking-[0.12em] uppercase">
                Signed in as
              </p>
              <p className="mt-1 truncate text-sm font-bold">{displayName}</p>
            </div>
            <nav aria-label="Account navigation" className="py-1">
              {links.map((item) => (
                <Link
                  className="hover:bg-accent hover:text-background focus-visible:bg-accent focus-visible:text-background flex min-h-11 items-center gap-3 rounded-[2px] px-3 text-sm font-bold transition-colors outline-none"
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <Icon name={item.icon} size={17} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action={signOutAction} className="border-foreground/15 border-t pt-1">
              <button
                className="text-muted hover:bg-purple hover:text-foreground focus-visible:bg-purple focus-visible:text-foreground flex min-h-11 w-full items-center gap-3 rounded-[2px] px-3 text-sm font-bold transition-colors outline-none"
                role="menuitem"
                type="submit"
              >
                <Icon name="logout" size={17} />
                Log out
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
