'use client';
/* eslint-disable @next/next/no-img-element */
/**
 * THE LOOK ROW — the club's logo, colours, type and banner photo, moved in from Settings (Public site builder, ruled
 * 2026-10-21; Option A: the owner OR an admin changes them, the routes ask the same — lib/public-site-access.ts).
 *
 *   Logo     upload · stock logos · remove (unchanged, moved).
 *   Colours  A3 "From your logo" FIRST whenever there is an uploaded logo (its two strong colours, read in the browser —
 *            lib/logo-colours.ts), then the nine presets, then the club's own two colours. Under them, the colours in
 *            words: who reads what, and when the platform darkened the colour so families can read it.
 *   Type     A4 three looks named for what they look like, each showing the club's own name in its faces.
 *   Banner   upload · remove; says phones leave it out.
 *
 * A6: every choice saves itself (the editor's floating pill), and the preview redraws — there is no Save button.
 * Below the desk width that holds the preview, a strip of the club's own bar sits at the top, so a phone sees each pick
 * land (the drawing's phone ②).
 */
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ImageIcon, Library, Upload } from 'lucide-react';
import StockLogoWindow from '@/components/admin/kit/club/StockLogoWindow';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { LookPill, LookSwatches, LookTypeTiles } from '@/components/admin/kit/club/LookControls';
import { resolveTheme } from '@/lib/themes';
import { lookWords } from '@/lib/colour-words';
import { clubInitials } from '@/lib/club-site';
import { ORG_BANNER_MAX_BYTES, ORG_IMAGE_TYPES, ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { pickLogoColours, type LogoColours } from '@/lib/logo-colours';
import { isStockLogoUrl } from '@/lib/stock-logos';
import { clubLookOf, type ClubLook } from '@/lib/public-site-builder';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import type { Organization } from '@/lib/types';
import styles from './public-site.module.css';

/** Each image the Look holds: the route that takes it and what it may be (lib/org-image-limits.ts, the routes' own). */
const IMAGE = {
  logo: { route: 'org-logo', max: ORG_LOGO_MAX_BYTES, hint: W.logoHint },
  banner: { route: 'org-hero-banner', max: ORG_BANNER_MAX_BYTES, hint: W.bannerHint },
} as const;
type ImageKind = keyof typeof IMAGE;
const IMAGE_ACCEPT = ORG_IMAGE_TYPES.join(',');

type Pick = { kind: 'logo' } | { kind: 'preset'; key: string } | { kind: 'own' };

/** The logo's two colours, read once per logo in the browser; null for a stock logo (made in the club's colour), for a
 *  grey logo, and when the image can't be read. Pass null to read nothing. */
function useLogoColours(url: string | null | undefined): LogoColours | null {
  const [read, setRead] = useState<{ url: string; colours: LogoColours | null } | null>(null);
  const src = url && !isStockLogoUrl(url) ? url : null;
  useEffect(() => {
    if (!src) return;
    let stale = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const n = 64;
        const canvas = document.createElement('canvas');
        canvas.width = n;
        canvas.height = n;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        if (!g) throw new Error('no canvas');
        g.drawImage(img, 0, 0, n, n);
        if (!stale) setRead({ url: src, colours: pickLogoColours(g.getImageData(0, 0, n, n).data) });
      } catch {
        if (!stale) setRead({ url: src, colours: null });
      }
    };
    img.onerror = () => { if (!stale) setRead({ url: src, colours: null }); };
    img.src = src;
    return () => { stale = true; };
  }, [src]);
  return src && read?.url === src ? read.colours : null;
}

export default function LookPanel({ org, orgSlug, run, onChanged, readOnly = false, children }: {
  org: Organization;
  orgSlug: string;
  /** Parts after the Look's own, in its column (the Tournaments part). */
  children?: ReactNode;
  /** Staff who may read the editor but not write it: the look in words, no controls. */
  readOnly?: boolean;
  /** The editor's look queue: one save at a time, the floating pill, Retry. */
  run: (task: () => Promise<void>, failText: string) => Promise<unknown>;
  /** After a save: the org is read again and the preview redrawn. */
  onChanged: () => Promise<void>;
}) {
  const query = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [refusal, setRefusal] = useState<{ kind: ImageKind; text: string } | null>(null);
  const [busy, setBusy] = useState<ImageKind | null>(null);
  // What the club just picked, shown at once while the save and the org's re-read catch up.
  const [picked, setPicked] = useState<{ colour?: Pick; look?: ClubLook } | null>(null);
  const [own, setOwn] = useState({ primary: org.themePrimary ?? '#1F3A5F', accent: org.themeAccent ?? '#D9A93A' }); // token-exempt: data defaults for the club's own colours
  const [ownOpen, setOwnOpen] = useState(false);
  const ownTimer = useRef<number | null>(null);

  // A reader of the look in words has no "From your logo" swatch, so the logo is not read for them.
  const fromLogo = useLogoColours(readOnly ? null : org.logoUrl);
  const same = (a: string | null | undefined, b: string) => (a ?? '').toUpperCase() === b.toUpperCase();
  const savedPick: Pick = org.themePrimary
    ? (fromLogo && same(org.themePrimary, fromLogo.primary) && same(org.themeAccent, fromLogo.accent) ? { kind: 'logo' } : { kind: 'own' })
    : { kind: 'preset', key: org.themePreset ?? 'platform' };
  const colourPick = picked?.colour ?? savedPick;
  const lookPick = picked?.look ?? clubLookOf(org.themeFont);
  const ownShown = ownOpen || colourPick.kind === 'own';
  const current = resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);
  const words = lookWords({ preset: org.themePreset, primary: org.themePrimary, accent: org.themeAccent, font: org.themeFont });

  // Each pick stamps its field; a save clears the field's optimistic pick only if no later pick has replaced it, so two
  // quick picks never snap the screen back to the first one while the second is still queued.
  const pickSeq = useRef({ colour: 0, look: 0 });
  const patchTheme = (body: Record<string, unknown>, pick: { colour?: Pick; look?: ClubLook }) => {
    const mine = (Object.keys(pick) as ('colour' | 'look')[]).map(field => [field, ++pickSeq.current[field]] as const);
    setPicked(p => ({ ...p, ...pick }));
    void run(async () => {
      try {
        const res = await fetch(`/api/admin/org-settings${query}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(W.lookFailed);
        await onChanged();
      } finally {
        setPicked(p => {
          if (!p) return p;
          const next = { ...p };
          for (const [field, n] of mine) if (pickSeq.current[field] === n) delete next[field];
          return next;
        });
      }
    }, W.lookFailed);
  };

  // A preset or the logo's colours replaces the club's own pair: the two pickers close, and a pick of their colour still
  // waiting out its half second is dropped so it cannot land afterwards and undo this choice.
  const leaveOwn = () => {
    if (ownTimer.current) window.clearTimeout(ownTimer.current);
    ownTimer.current = null;
    setOwnOpen(false);
  };
  const pickPreset = (key: string) => {
    leaveOwn();
    patchTheme({ themePreset: key, themePrimary: null, themeAccent: null }, { colour: { kind: 'preset', key } });
  };
  const pickFromLogo = () => {
    if (!fromLogo) return;
    leaveOwn();
    patchTheme({ themePreset: 'platform', themePrimary: fromLogo.primary, themeAccent: fromLogo.accent }, { colour: { kind: 'logo' } });
  };
  const changeOwn = (next: { primary: string; accent: string }) => {
    setOwn(next);
    if (ownTimer.current) window.clearTimeout(ownTimer.current);
    ownTimer.current = window.setTimeout(() => {
      patchTheme({ themePreset: 'platform', themePrimary: next.primary.toUpperCase(), themeAccent: next.accent.toUpperCase() }, { colour: { kind: 'own' } });
    }, 500);
  };
  const pickLook = (look: { key: ClubLook; font: string }) => {
    if (look.key === lookPick) return;
    patchTheme({ themeFont: look.font }, { look: look.key });
  };

  /** One image's change — an upload or a removal — one at a time through the editor's queue, then the org read again. */
  function change(kind: ImageKind, init: RequestInit) {
    void run(async () => {
      setRefusal(null);
      setBusy(kind);
      try {
        const res = await fetch(`/api/admin/${IMAGE[kind].route}${query}`, init);
        const data = await res.json().catch(() => ({})) as { error?: string };
        if (!res.ok) { setRefusal({ kind, text: data.error ?? W.lookFailed }); throw new Error(data.error ?? W.lookFailed); }
        await onChanged();
      } finally {
        setBusy(null);
      }
    }, W.lookFailed);
  }

  function upload(kind: ImageKind, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Refused here, beside the button, before a byte is sent (the route says the same).
    if (!(ORG_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > IMAGE[kind].max) {
      setRefusal({ kind, text: IMAGE[kind].hint });
      return;
    }
    const body = new FormData();
    body.append('file', file);
    change(kind, { method: 'POST', body });
  }

  const remove = (kind: ImageKind) => change(kind, { method: 'DELETE' });

  // The club's bar as families see it — below the desk width that holds the preview (a phone, a narrow window).
  const strip = (
    <div className={styles.lookStrip}
      style={{ background: words.roles.fill, color: words.roles.onFill, borderBottomColor: words.roles.accent }} aria-hidden>
      {org.logoUrl
        ? <img src={org.logoUrl} alt="" className={styles.lookStripLogo} />
        : <span className={styles.lookStripLogo} style={{ background: words.roles.tile, color: words.roles.tileInk }}>{clubInitials(org.name)}</span>}
      <span className={styles.lookStripName} data-look={lookPick}>{org.name}</span>
    </div>
  );
  if (readOnly) {
    return (
      <div className={`${styles.look} ${styles.lookReadOnly}`}>
        {strip}
        <p className={styles.readable}><strong>{words.summary}.</strong> {words.readable}</p>
        {words.darkened && <p className={styles.readable}>{words.darkened}</p>}
        {children}
      </div>
    );
  }
  return (
    <div className={styles.look}>
      {strip}

      {/* ── Logo ── */}
      <div className={styles.lookPart}>
        <h3 className={styles.lookPartTitle}>{W.logo}</h3>
        <div className={styles.imageRow}>
          <span className={styles.logoTile}>
            {org.logoUrl ? <img src={org.logoUrl} alt="" /> : <span className={styles.noImage}>{W.noLogo}</span>}
          </span>
          <div className={styles.imageButtons}>
            <button type="button" className="btn btn-outline btn-data" onClick={() => logoInput.current?.click()} disabled={busy !== null}>
              <Upload size={14} aria-hidden /> {busy === 'logo' ? W.uploading : org.logoUrl ? W.replaceLogo : W.uploadLogo}
            </button>
            <button type="button" className="btn btn-outline btn-data" onClick={() => setStockOpen(true)} disabled={busy !== null} aria-haspopup="dialog">
              <Library size={14} aria-hidden /> {W.browseStock}
            </button>
            {org.logoUrl && <button type="button" className="btn btn-ghost btn-data" onClick={() => remove('logo')} disabled={busy !== null}>{W.removeImage}</button>}
          </div>
        </div>
        {refusal?.kind === 'logo'
          ? <p className={styles.fieldError} role="alert">{refusal.text}</p>
          : <p className={ck.hint}>{W.logoHint}</p>}
        <input ref={logoInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => upload('logo', e)} />
      </div>

      {/* ── Colours ── */}
      <div className={styles.lookPart}>
        <h3 className={styles.lookPartTitle} id="site-colours">{W.colours}</h3>
        <LookSwatches labelledBy="site-colours" idPrefix="site"
          before={fromLogo && (
            <LookPill primary={fromLogo.primary} accent={fromLogo.accent} label={W.fromLogo} on={colourPick.kind === 'logo'} onClick={pickFromLogo} />
          )}
          chosenPreset={colourPick.kind === 'preset' ? colourPick.key : null}
          ownChosen={colourPick.kind === 'own'}
          ownOpen={ownShown}
          onPreset={pickPreset}
          onOwnToggle={() => {
            if (!ownShown) setOwn({ primary: current.primary.toUpperCase(), accent: current.accent.toUpperCase() });
            setOwnOpen(o => !o);
          }}
          own={own}
          onOwnChange={changeOwn} />
        <p className={styles.readable}>{words.readable}</p>
        {words.darkened && <p className={styles.readable}>{words.darkened}</p>}
      </div>

      {/* ── Type ── */}
      <div className={styles.lookPart}>
        <h3 className={styles.lookPartTitle} id="site-type">{W.type}</h3>
        <LookTypeTiles labelledBy="site-type" name={org.name} chosen={lookPick} onPick={pickLook} />
      </div>

      {/* ── Banner photo ── */}
      <div className={styles.lookPart}>
        <h3 className={styles.lookPartTitle}>{W.banner}</h3>
        <div className={styles.imageRow}>
          {org.heroBannerUrl && <span className={styles.bannerTile}><img src={org.heroBannerUrl} alt="" /></span>}
          <div className={styles.imageButtons}>
            <button type="button" className="btn btn-outline btn-data" onClick={() => bannerInput.current?.click()} disabled={busy !== null}>
              <ImageIcon size={14} aria-hidden /> {busy === 'banner' ? W.uploading : org.heroBannerUrl ? W.replaceBanner : W.uploadBanner}
            </button>
            {org.heroBannerUrl && <button type="button" className="btn btn-ghost btn-data" onClick={() => remove('banner')} disabled={busy !== null}>{W.removeImage}</button>}
          </div>
        </div>
        {refusal?.kind === 'banner'
          ? <p className={styles.fieldError} role="alert">{refusal.text}</p>
          : <p className={ck.hint}>{W.bannerHint}</p>}
        <input ref={bannerInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => upload('banner', e)} />
      </div>

      {children}

      {stockOpen && (
        <StockLogoWindow
          orgSlug={orgSlug}
          planId={org.planId}
          theme={{ preset: org.themePreset, primary: org.themePrimary, accent: org.themeAccent }}
          onClose={() => setStockOpen(false)}
          onPicked={() => {
            setStockOpen(false);
            void run(onChanged, W.lookFailed);
          }}
        />
      )}
    </div>
  );
}
