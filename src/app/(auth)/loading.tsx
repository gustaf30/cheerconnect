export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo placeholder */}
        <div className="flex justify-center">
          <div className="animate-shimmer-premium h-10 w-40 rounded-xl" />
        </div>

        {/* Heading placeholder */}
        <div className="space-y-2 text-center">
          <div className="animate-shimmer-premium h-7 w-48 rounded mx-auto" />
          <div className="animate-shimmer-premium h-4 w-64 rounded mx-auto" />
        </div>

        {/* Input fields */}
        <div className="space-y-4">
          <div className="animate-shimmer-premium h-12 w-full rounded-xl" />
          <div className="animate-shimmer-premium h-12 w-full rounded-xl" />
        </div>

        {/* Button */}
        <div className="animate-shimmer-premium h-11 w-full rounded-xl" />

        {/* Footer link */}
        <div className="flex justify-center">
          <div className="animate-shimmer-premium h-4 w-52 rounded" />
        </div>
      </div>
    </div>
  );
}
