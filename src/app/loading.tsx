export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading vidi"
      className="font-ui page-container grid min-h-dvh max-w-md place-items-center"
      role="status"
    >
      <div className="w-full">
        <p className="font-accent text-accent text-3xl">vidi.</p>
        <div className="mt-14 space-y-4" aria-hidden="true">
          <div className="bg-purple h-2 w-14 animate-pulse motion-reduce:animate-none" />
          <div className="bg-surface h-14 w-4/5 animate-pulse rounded-sm motion-reduce:animate-none" />
          <div className="bg-surface h-14 w-3/5 animate-pulse rounded-sm motion-reduce:animate-none" />
          <div className="bg-surface mt-8 h-14 w-full animate-pulse rounded-sm motion-reduce:animate-none" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
