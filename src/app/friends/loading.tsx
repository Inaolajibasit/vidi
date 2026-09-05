export default function FriendsLoading() {
  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-xl animate-pulse px-5 pt-16 motion-reduce:animate-none sm:px-8">
        <div className="bg-surface-strong h-8 w-16 rounded-sm" />
        <div className="bg-surface-strong mt-16 h-20 w-4/5 rounded-sm" />
        <div className="bg-surface-strong mt-12 h-12 w-full rounded-sm" />
        <div className="border-border mt-12 space-y-5 border-t pt-10">
          <div className="bg-surface-strong h-8 w-32 rounded-sm" />
          <div className="bg-surface-strong h-16 w-full rounded-sm" />
          <div className="bg-surface-strong h-16 w-full rounded-sm" />
        </div>
      </div>
    </main>
  );
}
