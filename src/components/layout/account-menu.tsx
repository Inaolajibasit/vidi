"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { signOutAction } from "@/features/auth/actions";

interface AccountMenuProps {
  authenticated?: boolean;
  friendRequests?: number;
  incompleteGames?: number;
  avatarUrl?: string | null;
  displayName?: string;
}

const links: Array<{ href: string; icon: IconName; label: string }> = [
  { href: "/games", icon: "game", label: "Games" },
  { href: "/watchlist", icon: "spark", label: "Watchlists" },
  { href: "/friends", icon: "users", label: "Friends" },
  { href: "/profile", icon: "profile", label: "Profile" },
];

export function AccountMenu({
  authenticated = true,
  friendRequests = 0,
  incompleteGames = 0,
  avatarUrl = null,
  displayName = "Guest",
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasAttention = friendRequests > 0 || incompleteGames > 0;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative z-[100]" ref={menuRef}>
      <button
        aria-controls="account-menu-panel"
        aria-expanded={open}
        aria-label={open ? "Close account menu" : "Open account menu"}
        className="focus-visible:outline-accent group relative grid size-11 place-items-center rounded-sm transition-transform duration-150 hover:-rotate-2 focus-visible:outline-2 focus-visible:outline-offset-4 active:scale-95"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {authenticated ? (
          <Avatar
            className="border-accent shadow-[3px_3px_0_#2227F7] transition-shadow group-hover:shadow-[4px_4px_0_#FFD628]"
            name={displayName}
            size="md"
            src={avatarUrl ?? undefined}
          />
        ) : (
          <span className="border-foreground/40 bg-background text-foreground group-hover:border-accent grid size-11 place-items-center rounded-sm border shadow-[3px_3px_0_#2227F7] transition-shadow group-hover:shadow-[4px_4px_0_#FFD628]">
            <Icon name="profile" size={20} />
          </span>
        )}
        {authenticated && hasAttention && !open ? (
          <span
            aria-label={`${friendRequests + incompleteGames} item${friendRequests + incompleteGames === 1 ? "" : "s"} need attention`}
            className="bg-accent border-background absolute -top-0.5 -right-0.5 size-3.5 rounded-full border-2 shadow-[0_0_0_2px_rgba(199,255,24,0.15)]"
            role="status"
          />
        ) : null}
      </button>

      {open ? (
        <div
          id="account-menu-panel"
          className="account-menu-enter border-foreground/20 bg-background/95 absolute top-[calc(100%+0.75rem)] right-0 z-[110] w-52 origin-top-right overflow-hidden rounded-sm border p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          <div className="border-foreground/15 border-b px-3 py-2.5">
            <p className="text-muted text-[0.62rem] font-bold tracking-[0.12em] uppercase">
              {authenticated ? "Signed in as" : "Your vidi"}
            </p>
            <p className="mt-1 truncate text-sm font-bold">
              {authenticated ? displayName : "Not signed in"}
            </p>
          </div>
          {authenticated ? (
            <>
              <nav aria-label="Account navigation" className="py-1">
                {links.map((item) => {
                  const count =
                    item.href === "/friends"
                      ? friendRequests
                      : item.href === "/games"
                        ? incompleteGames
                        : 0;
                  return (
                    <Link
                      className="hover:bg-accent hover:text-background focus-visible:bg-accent focus-visible:text-background flex min-h-11 items-center gap-3 rounded-[2px] px-3 text-sm font-bold transition-colors outline-none"
                      href={item.href}
                      key={item.href}
                      onClick={() => setOpen(false)}
                    >
                      <Icon name={item.icon} size={17} />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 ? (
                        <span
                          aria-label={`${count} ${item.label.toLowerCase()} notification${count === 1 ? "" : "s"}`}
                          className="bg-accent size-2.5 shrink-0 rounded-full"
                          role="status"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              <form
                action={signOutAction}
                className="border-foreground/15 border-t pt-1"
              >
                <button
                  className="text-muted hover:bg-purple hover:text-foreground focus-visible:bg-purple focus-visible:text-foreground flex min-h-11 w-full items-center gap-3 rounded-[2px] px-3 text-sm font-bold transition-colors outline-none"
                  type="submit"
                >
                  <Icon name="logout" size={17} />
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link
              className="bg-accent text-background mt-1 flex min-h-11 items-center justify-between rounded-[2px] px-3 text-sm font-extrabold uppercase transition-transform active:scale-[0.98]"
              href="/auth"
              onClick={() => setOpen(false)}
            >
              Sign up
              <Icon name="chevron-right" size={17} />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
