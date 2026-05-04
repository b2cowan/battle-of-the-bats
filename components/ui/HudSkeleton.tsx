interface HudSkeletonProps {
  message?: string;
  rows?: number;
}

export function HudSkeleton({ message = 'PROCESSING REQUEST...', rows = 4 }: HudSkeletonProps) {
  return (
    <div className="p-8">
      <div className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-6 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-logic-lime animate-pulse" />
        {message}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-blueprint-blue/10 border border-blueprint-blue/20 animate-pulse"
            style={{ width: `${85 - i * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}
