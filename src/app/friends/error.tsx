"use client";

export default function FriendsError({ reset }: { reset: () => void }) {
  return (
    <main className="editorial-screen font-ui page-container grid min-h-dvh max-w-xl place-items-center text-center">
      <div>
        <p className="text-label text-danger">Friends unavailable</p>
        <h1 className="font-display mt-4 text-5xl uppercase">
          Lost the connection.
        </h1>
        <p className="text-muted mt-5">Your friendships have not changed.</p>
        <button
          className="bg-accent text-background mt-8 min-h-12 rounded-sm px-6 text-xs font-extrabold uppercase"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
