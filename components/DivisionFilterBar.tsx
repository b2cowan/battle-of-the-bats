'use client';
import { useRouter } from 'next/navigation';
import { setAgPref } from '@/lib/age-group-cookie';
import type { AgeGroup } from '@/lib/types';

interface Props {
  orgSlug: string;
  ageGroups: AgeGroup[];
  activeName: string;
  isFiltering: boolean;
  viewAllHref: string;
  backHref: string;
}

export default function DivisionFilterBar({
  orgSlug, ageGroups, activeName, isFiltering, viewAllHref, backHref,
}: Props) {
  const router = useRouter();

  function selectDivision(name: string) {
    setAgPref(orgSlug, name);
    if (isFiltering) {
      router.refresh();
    } else {
      router.push(backHref);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      marginBottom: '1.5rem', fontSize: '0.8rem', flexWrap: 'wrap',
    }}>
      <span style={{ color: 'var(--white-40)', marginRight: '0.1rem' }}>Division:</span>
      {ageGroups.map(g => {
        const isActive = g.name === activeName && isFiltering;
        return (
          <button
            key={g.id}
            onClick={() => selectDivision(g.name)}
            style={{
              background: isActive ? 'var(--primary)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '99px',
              padding: '0.15rem 0.6rem',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--white)' : 'var(--white-40)',
              transition: 'all 0.15s',
            }}
          >
            {g.name}
          </button>
        );
      })}
      <span style={{ color: 'var(--white-20)', margin: '0 0.1rem' }}>·</span>
      {isFiltering ? (
        <a href={viewAllHref} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>View all →</a>
      ) : (
        <a href={backHref} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>Back to {activeName} →</a>
      )}
    </div>
  );
}
