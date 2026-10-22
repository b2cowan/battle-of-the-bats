'use client';
/**
 * CHOOSE A STOCK LOGO — the window the club's Look opens (moved with the logo from Settings into the Public site editor,
 * Public site builder Option A, 2026-10-21; the window itself unchanged). A pick is made as its mark on a circle of the
 * club's main colour (lib/stock-logo-render.ts), so the tiles draw that circle in the SAVED colours.
 */
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { STOCK_LOGOS, STOCK_LOGO_CATEGORIES, STOCK_MARK_SCALE, isStockLogoUnlocked } from '@/lib/stock-logos';
import { resolveTheme } from '@/lib/themes';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import type { OrgPlan } from '@/lib/types';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';

export default function StockLogoWindow({ orgSlug, planId, theme, onClose, onPicked }: {
  orgSlug: string;
  planId: OrgPlan;
  theme: { preset: string | null | undefined; primary: string | null | undefined; accent: string | null | undefined };
  onClose: () => void;
  onPicked: (logoUrl: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [lockedPlan, setLockedPlan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colours = resolveTheme(theme.preset, theme.primary, theme.accent);

  async function apply() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/org-logo-stock?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockPath: selected }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string };
      if (!res.ok) throw new Error(data.error ?? W.lookFailed);
      onPicked(data.logoUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : W.lookFailed);
      setSaving(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={W.stockTitle}
      onClose={onClose}
      busy={saving}
      footerStart={error ? <span role="alert">{error}</span> : undefined}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void apply()} disabled={!selected || saving}>
            {saving ? W.saving : W.useThisLogo}
          </button>
        </>
      }
    >
      {STOCK_LOGO_CATEGORIES.map(category => {
        const icons = STOCK_LOGOS.filter(l => l.category === category);
        if (!icons.length) return null;
        return (
          <div key={category} className={styles.stockGroup}>
            <p className={styles.stockCategory}>{category}</p>
            <div className={styles.stockGrid}>
              {icons.map(logo => {
                const unlocked = isStockLogoUnlocked(logo, planId);
                const on = selected === logo.file;
                return (
                  <button
                    key={logo.id}
                    type="button"
                    aria-label={logo.label}
                    aria-pressed={on}
                    className={`${styles.stockTile}${on ? ` ${styles.stockTileOn}` : ''}${unlocked ? '' : ` ${styles.stockTileLocked}`}`}
                    onClick={() => {
                      if (!unlocked) { setLockedPlan(logo.minPlan); return; }
                      setLockedPlan(null);
                      setSelected(logo.file);
                    }}
                  >
                    <span className={styles.stockMark} style={{ background: colours.primary }}>
                      {/* The white art as a mask, painted in the ink the made logo uses. */}
                      <span
                        className={styles.stockGlyph}
                        style={{
                          background: colours.onPrimary,
                          width: `${STOCK_MARK_SCALE * 100}%`,
                          maskImage: `url(${logo.file})`,
                          WebkitMaskImage: `url(${logo.file})`,
                        }}
                      />
                    </span>
                    <span className={styles.stockLabel}>{logo.label}</span>
                    {!unlocked && <Lock size={10} className={styles.stockLock} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {lockedPlan && (
        <p className={ck.hint}><Lock size={12} aria-hidden /> {W.stockLocked(lockedPlan.charAt(0).toUpperCase() + lockedPlan.slice(1))}</p>
      )}
    </KitDialog>
  );
}
