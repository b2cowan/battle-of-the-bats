import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '8rem 2rem' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.25rem', marginBottom: '2rem', opacity: 0.7 }}>
        Page not found — that organization or page doesn&apos;t exist.
      </p>
      <Link href="/milton-bats" className="btn btn-primary">
        Back to Home
      </Link>
    </div>
  );
}
