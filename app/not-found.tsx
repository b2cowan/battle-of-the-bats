import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pitch-black bg-grid-faint bg-grid flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="hud-label mb-6">Diagnostic Output</div>
        <div className="font-mono text-7xl font-bold text-blueprint-blue/30 mb-2 leading-none">404</div>
        <div className="font-mono text-xl font-bold text-fl-text mb-3">[DIAGNOSTIC]: ROUTE_NOT_FOUND</div>
        <div className="font-mono text-xs text-data-gray mb-8 leading-relaxed">
          Requested resource is outside the current system scope.<br />
          Verify the URL and retry, or return to root.
        </div>
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-logic-lime border border-logic-lime px-8 py-3 hover:bg-logic-lime hover:text-pitch-black transition-colors"
        >
          Return to Root Node
        </Link>
      </div>
    </div>
  );
}
