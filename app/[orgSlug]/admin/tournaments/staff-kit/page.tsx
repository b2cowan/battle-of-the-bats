'use client';

/**
 * J1-080 — Day-of Staff Kit. One screen that hands out the two volunteer
 * surfaces (Scorekeeper + Gate/Check-in) as QR codes + copy-links, with a
 * printable one-pager for the volunteer table. Aggregates links/screens that
 * already exist; volunteers still authenticate on landing.
 */

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { ClipboardList, ScanLine, Check, Copy, Printer, ExternalLink } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { TournamentAdminHeader } from '@/components/admin/tournament';
import s from '../../admin-common.module.css';
import styles from './staff-kit.module.css';

type Surface = {
  key: 'scorekeeper' | 'check-in';
  title: string;
  blurb: string;
  path: string;
};

const SURFACES: Surface[] = [
  { key: 'scorekeeper', title: 'Scorekeeper', blurb: 'Enter game scores from any field.', path: 'scorekeeper' },
  { key: 'check-in', title: 'Gate / Check-in', blurb: 'Check teams in at the gate.', path: 'check-in' },
];

export default function StaffKitPage() {
  usePageTitle('Staff Kit');
  const { currentTournament, loading } = useTournament();
  const { currentOrg } = useOrg();

  const [qr, setQr] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  // Absolute URLs are resolved on the client (we need window.location.origin).
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const urlFor = useCallback(
    (path: string) => (currentOrg ? `${origin}/${currentOrg.slug}/${path}` : ''),
    [origin, currentOrg],
  );

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const surface of SURFACES) {
        try {
          next[surface.key] = await QRCode.toDataURL(urlFor(surface.path), {
            width: 320,
            margin: 1,
            color: { dark: '#0a0a0a', light: '#ffffff' },
          });
        } catch {
          /* leave missing — the copy-link still works */
        }
      }
      if (!cancelled) setQr(next);
    })();
    return () => { cancelled = true; };
  }, [currentOrg, urlFor]);

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    } catch {
      /* clipboard blocked — user can still read the URL */
    }
  }, []);

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        eyebrow="Game Day"
        title="Staff Kit"
        subtitle={currentTournament ? currentTournament.name : 'Select a tournament'}
        mobileActionsInline
        actions={
          <button type="button" className="btn btn-ghost btn-data" onClick={() => window.print()} aria-label="Print the staff kit one-pager">
            <Printer size={13} />
            <span>Print</span>
          </button>
        }
      />

      {!loading && !currentTournament && (
        <div className={styles.empty}>Select a tournament to hand out volunteer links.</div>
      )}

      {currentTournament && currentOrg && (
        <>
          <p className={styles.intro}>
            Hand these to your day-of volunteers — scan the code or copy the link. Each volunteer signs in
            on the screen they land on, then sees only their job (scoring or the gate).
          </p>

          <div className={styles.grid}>
            {SURFACES.map(surface => {
              const url = urlFor(surface.path);
              const Icon = surface.key === 'scorekeeper' ? ScanLine : ClipboardList;
              return (
                <section key={surface.key} className={styles.card}>
                  <div className={styles.cardHead}>
                    <Icon size={16} aria-hidden />
                    <div>
                      <h2 className={styles.cardTitle}>{surface.title}</h2>
                      <p className={styles.cardBlurb}>{surface.blurb}</p>
                    </div>
                  </div>

                  <div className={styles.qrWrap}>
                    {qr[surface.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr[surface.key]} alt={`QR code linking to the ${surface.title} screen`} className={styles.qr} />
                    ) : (
                      <div className={styles.qrPlaceholder} aria-hidden />
                    )}
                  </div>

                  <div className={styles.urlRow}>
                    <span className={styles.url} title={url}>{url}</span>
                    <div className={styles.urlActions}>
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => copy(surface.key, url)} aria-label={`Copy the ${surface.title} link`}>
                        {copied === surface.key ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copied === surface.key ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer" className={`btn btn-ghost btn-data ${styles.openLink}`} aria-label={`Open the ${surface.title} screen`}>
                        <ExternalLink size={13} />
                        <span>Open</span>
                      </a>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <p className={styles.note}>
            Inviting a volunteer? Add them under <strong>Settings &amp; Access → Members</strong>{' '}
            as a Volunteer and pick whether they&apos;re scorekeeping, on the gate, or both — the invite email links them
            straight to the right screen.
          </p>
        </>
      )}
    </div>
  );
}
