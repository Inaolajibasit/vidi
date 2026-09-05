import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import {
  AddFriendForm,
  FriendshipAction,
} from "@/features/friends/components/friend-actions";
import { getFriendsData, type FriendshipItem } from "@/features/friends/data";

export const metadata = { title: "Friends" };

function ProfileLink({ item }: { item: FriendshipItem }) {
  const content = (
    <>
      <Avatar
        name={item.profile.displayName}
        size="lg"
        src={item.profile.avatarUrl ?? undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{item.profile.displayName}</p>
        <p className="text-muted mt-1 truncate text-xs">
          {item.profile.username ? `@${item.profile.username}` : "No username"}
        </p>
      </div>
    </>
  );
  return item.profile.username ? (
    <Link
      className="focus-visible:outline-accent flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
      href={`/profile/${item.profile.username}`}
    >
      {content}
    </Link>
  ) : (
    <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
  );
}

export default async function FriendsPage() {
  const data = await getFriendsData();
  if (!data) redirect("/auth?next=/friends");

  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            aria-label="Back to profile"
            className="tap-target text-muted hover:text-foreground grid size-11 place-items-center rounded-full"
            href="/profile"
          >
            <Icon name="arrow-left" size={22} />
          </Link>
          <Link className="font-accent text-accent text-2xl" href="/">
            vidi<span className="text-purple">.</span>
          </Link>
        </header>

        <section className="pt-14 pb-12">
          <p className="text-label text-purple">Your people</p>
          <h1 className="font-display mt-4 text-[clamp(4.5rem,22vw,7rem)] leading-[0.78] tracking-[-0.05em] uppercase">
            Friends
          </h1>
          <div className="mt-9">
            <p className="text-label text-muted mb-3">Add by username</p>
            <AddFriendForm />
          </div>
        </section>

        <section
          aria-labelledby="friends-title"
          className="border-border border-t py-10"
        >
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-3xl uppercase" id="friends-title">
              Friends
            </h2>
            <span className="text-label text-muted">{data.friends.length}</span>
          </div>
          {data.friends.length ? (
            <ul className="divide-border divide-y">
              {data.friends.map((item) => (
                <li className="py-5" key={item.friendshipId}>
                  <div className="flex items-center gap-3">
                    <ProfileLink item={item} />
                    {item.profile.username ? (
                      <Link
                        className="bg-accent text-background grid min-h-11 shrink-0 place-items-center rounded-sm px-3 text-[0.65rem] font-extrabold uppercase"
                        href={`/games/new?with=${encodeURIComponent(item.profile.username)}`}
                      >
                        Play
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <FriendshipAction
                      friendshipId={item.friendshipId}
                      kind="remove"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted py-5 text-sm leading-6">
              No friends yet. Search by username above to send a request.
            </p>
          )}
        </section>

        <section
          aria-labelledby="pending-title"
          className="border-border border-t py-10"
        >
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-3xl uppercase" id="pending-title">
              Pending
            </h2>
            <span className="text-label text-muted">
              {data.incoming.length + data.outgoing.length}
            </span>
          </div>
          {data.incoming.length ? (
            <div>
              <p className="text-label text-purple mb-3">Received</p>
              <ul className="divide-border divide-y">
                {data.incoming.map((item) => (
                  <li className="py-5" key={item.friendshipId}>
                    <ProfileLink item={item} />
                    <div className="mt-4 flex gap-2">
                      <FriendshipAction
                        friendshipId={item.friendshipId}
                        kind="accept"
                      />
                      <FriendshipAction
                        friendshipId={item.friendshipId}
                        kind="decline"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.outgoing.length ? (
            <div className="mt-8">
              <p className="text-label text-muted mb-3">Sent</p>
              <ul className="divide-border divide-y">
                {data.outgoing.map((item) => (
                  <li
                    className="flex items-center gap-3 py-5"
                    key={item.friendshipId}
                  >
                    <ProfileLink item={item} />
                    <span className="text-label text-muted">Waiting</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!data.incoming.length && !data.outgoing.length ? (
            <p className="text-muted py-5 text-sm">No pending requests.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
