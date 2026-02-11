export default function MainLoading() {
  return (
    <div className="flex gap-6 w-full max-w-[1440px] mx-auto">
      {/* Sidebar skeleton - hidden on mobile */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="animate-shimmer-premium h-10 rounded-xl mb-4" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-shimmer-premium h-20 rounded-xl" />
          ))}
        </div>
        <div className="animate-shimmer-premium h-32 rounded-xl mt-4" />
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 max-w-[840px] space-y-6">
        {/* Create post card skeleton */}
        <div className="rounded-2xl border border-neutral-200/60 overflow-hidden">
          <div className="animate-shimmer-premium h-1 w-full" />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="animate-shimmer-premium h-10 w-10 rounded-full" />
              <div className="animate-shimmer-premium h-10 flex-1 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Post card skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200/60 overflow-hidden"
          >
            <div className="animate-shimmer-premium h-1 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="animate-shimmer-premium h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="animate-shimmer-premium h-4 w-32 rounded" />
                  <div className="animate-shimmer-premium h-3 w-20 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="animate-shimmer-premium h-4 w-full rounded" />
                <div className="animate-shimmer-premium h-4 w-3/4 rounded" />
              </div>
              <div className="flex gap-4 pt-2">
                <div className="animate-shimmer-premium h-8 w-16 rounded-lg" />
                <div className="animate-shimmer-premium h-8 w-16 rounded-lg" />
                <div className="animate-shimmer-premium h-8 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
