'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import CoachCollapseSection from '@/components/coaches/CoachCollapseSection';
import { accentNeedsLightInk } from '@/lib/export/pdf';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './TeamDocumentsLookCard.module.css';

/**
 * "How your documents look" — the team layer of document branding (PDF Export Quality
 * Phase 1, decisions 7–8; mockup approved by the owner 2026-08-22, and the mockup is the
 * spec). Team crest, accent colour and footer line for the paper THIS team prints; a
 * club-owned team inherits its club's look until it sets its own, and gets one honest way
 * back ("Use club look"). The paper preview is the card's hero: the coach sees exactly what
 * the next printed document starts like. The team's NAME is not a setting — team paper
 * always carries it.
 *
 * Renders NOTHING when the plan carries no PDF customization (absent, not a locked tease —
 * free Basic portals have no PDF export at all). Head coach edits; assistants read.
 */

interface TeamLook { logoDataUrl?: string; accentColor?: string; footerText?: string }

interface LookPayload {
  look: {
    team: TeamLook;
    club: { name: string; logoDataUrl: string | null; accentColor: string; footerText: string | null };
    teamColor: string | null;
    canCustomize: boolean;
    isHeadCoach: boolean;
    isStandalone: boolean;
  };
}

/** Client-side crest normalization: decode → fit inside 256px → PNG data URL. Matches the
 *  server's size guard so a phone-camera original never travels or gets stored. */
const CREST_MAX_PX = 256;
async function fileToCrestDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file could not be read as an image.'));
      el.src = url;
    });
    const scale = Math.min(1, CREST_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('That image could not be processed.');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function TeamDocumentsLookCard({
  orgSlug,
  teamId,
  teamName,
  seasonName,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  /** Shown under the team name on the preview, the way real paper shows it. */
  seasonName?: string | null;
}) {
  const [payload, setPayload] = useState<LookPayload['look'] | null>(null);
  const [saved, setSaved] = useState<TeamLook>({});
  const [draft, setDraft] = useState<TeamLook>({});
  const [hexDraft, setHexDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Cleanup-guarded (the repo's team-scoped-fetch idiom): if teamId changes or the card
  // unmounts mid-fetch, a slow earlier response must not land another team's look here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // `card=1` asks for the two-layer `look` block — export surfaces fetch the same
        // route without it and get the (much lighter) resolved settings alone.
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings?card=1`);
        if (!res.ok || cancelled) return; // quiet — the settings groups below carry the page
        const json: LookPayload = await res.json();
        if (cancelled) return;
        setPayload(json.look);
        setSaved(json.look.team ?? {});
        setDraft(json.look.team ?? {});
        setHexDraft(json.look.team?.accentColor ?? '');
      } catch { /* absent on failure, never broken */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  if (!payload || !payload.canCustomize) return null;

  const { club, teamColor, isHeadCoach, isStandalone } = payload;
  const canEdit = isHeadCoach;

  // The resolved look — what the next printed document actually starts like.
  const effAccent = draft.accentColor ?? club.accentColor;
  const effLogo = draft.logoDataUrl ?? club.logoDataUrl ?? null;
  const effFooter = draft.footerText ?? club.footerText ?? null;
  // token-exempt: paper preview — printed-page ink, the PDF engine's own contrast values
  const headTextColor = accentNeedsLightInk(effAccent) ? '#ffffff' : '#14141f';

  const savedCustomized = Boolean(saved.logoDataUrl || saved.accentColor || saved.footerText);
  // Field-wise, not JSON.stringify: clearing and re-setting a key changes insertion order,
  // and order must never make identical values read as "unsaved changes".
  const dirty = draft.logoDataUrl !== saved.logoDataUrl
    || draft.accentColor !== saved.accentColor
    || draft.footerText !== saved.footerText;

  // The closed header states the condition (settings-page idiom).
  const meta = savedCustomized
    ? 'Your own crest and colour'
    : isStandalone
      ? 'Standard look — add your crest'
      : 'Your club’s look';

  function setLook(patch: Partial<TeamLook>) {
    setMsg('');
    setError('');
    setDraft(prev => {
      const next = { ...prev, ...patch };
      // An unset key means "inherit" — hold undefined, never '' (the server treats absent as inherit).
      (Object.keys(next) as (keyof TeamLook)[]).forEach(k => { if (next[k] == null || next[k] === '') delete next[k]; });
      return next;
    });
  }

  async function put(body: TeamLook, okMsg: string) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not save.');
      // Adopt what the server PERSISTED — it re-encodes the crest server-side, so the
      // stored bytes are the truth the next load will show.
      const persisted: TeamLook = json.team ?? body;
      setSaved(persisted);
      setDraft(persisted);
      setHexDraft(persisted.accentColor ?? '');
      setMsg(okMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function onPickCrest(file: File | null) {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await fileToCrestDataUrl(file);
      setLook({ logoDataUrl: dataUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be used.');
    }
  }

  function commitHex(value: string) {
    setHexDraft(value);
    if (HEX_RE.test(value)) setLook({ accentColor: value });
  }

  return (
    <CoachCollapseSection sectionId="documents" title="How your documents look" defaultOpen={false} meta={meta}>
      <p className={shared.settingWho}>
        {canEdit
          ? isStandalone
            ? 'Head coach only. Your paper carries your team’s name from day one — a crest and a colour make it unmistakably yours.'
            : savedCustomized
              ? 'Head coach only.'
              : 'Head coach only. This is your club’s look — anything you set below replaces it on your team’s paper.'
          : 'Only the head coach can change how documents look.'}
      </p>

      {/* ── The paper preview — what every PDF this team prints starts like ── */}
      <div className={styles.prevWrap}>
        <div className={styles.prevLabelRow}>
          <span className={styles.prevLabel}>Every PDF this team prints starts like this</span>
          {!isStandalone && !savedCustomized && !dirty && (
            <span className={styles.prevTag}>Your club’s look</span>
          )}
        </div>
        <div className={styles.paper} aria-hidden>
          <div className={styles.paperBar} style={{ background: effAccent }} />
          <div className={styles.paperHead}>
            {effLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.paperLogo} src={effLogo} alt="" />
            )}
            <div>
              <div className={styles.paperName}>{teamName}</div>
              {seasonName && <div className={styles.paperSub}>{seasonName}</div>}
            </div>
          </div>
          <div className={styles.paperDivide} />
          <div className={styles.paperTitle}>Team Roster</div>
          <div className={styles.paperTable}>
            <div className={`${styles.paperTr} ${styles.paperTh}`} style={{ background: effAccent, color: headTextColor }}>
              <span>#</span><span>Player</span><span>Position</span><span>Status</span>
            </div>
            <div className={styles.paperTr}><span>4</span><span>M. Okafor</span><span>SS</span><span>Active</span></div>
            <div className={`${styles.paperTr} ${styles.paperTrAlt}`}><span>7</span><span>J. Tremblay</span><span>C</span><span>Active</span></div>
          </div>
          <div className={styles.paperFoot}>
            <span>{[effFooter, 'Generated by FieldLogicHQ'].filter(Boolean).join(' · ')}</span>
            <span>Page 1 of 2</span>
          </div>
        </div>
      </div>

      <div className={shared.settingRows}>
        {/* ── Team crest ── */}
        <div className={shared.settingRow}>
          <div className={shared.settingRowMain}>
            <span className={shared.settingRowLabel}>Team crest</span>
            <span className={shared.settingRowDesc}>
              Printed in the top corner of every document. Square images work best.
            </span>
          </div>
          <div className={shared.settingRowCtl}>
            {draft.logoDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.crestThumb} src={draft.logoDataUrl} alt="Team crest" />
                {canEdit && (
                  <>
                    <button type="button" className={shared.btnSecondary} disabled={saving} onClick={() => fileRef.current?.click()}>Replace</button>
                    <button type="button" className={shared.btnGhost} disabled={saving} onClick={() => setLook({ logoDataUrl: undefined })}>Remove</button>
                  </>
                )}
              </>
            ) : (
              <>
                {club.logoDataUrl && !isStandalone && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.crestThumb} src={club.logoDataUrl} alt={`${club.name} logo`} />
                    <span className={styles.fromClub}>From your club</span>
                  </>
                )}
                {canEdit && (
                  <button type="button" className={shared.btnSecondary} disabled={saving} onClick={() => fileRef.current?.click()}>
                    <Upload size={14} /> {club.logoDataUrl && !isStandalone ? 'Add your own' : 'Upload crest'}
                  </button>
                )}
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={e => { void onPickCrest(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>
        </div>

        {/* ── Accent colour ── */}
        <div className={shared.settingRow}>
          <div className={shared.settingRowMain}>
            <span className={shared.settingRowLabel}>Accent colour</span>
            <span className={shared.settingRowDesc}>
              The band across the top of the page and the table headings.
            </span>
          </div>
          <div className={shared.settingRowCtl}>
            {canEdit ? (
              <>
                <input
                  type="color"
                  className={styles.swatchInput}
                  aria-label="Accent colour"
                  disabled={saving}
                  value={HEX_RE.test(hexDraft) ? hexDraft : effAccent}
                  onChange={e => commitHex(e.target.value)}
                />
                <input
                  className={`${shared.input} ${styles.hexInput}`}
                  aria-label="Accent colour hex value"
                  disabled={saving}
                  value={hexDraft}
                  placeholder={`${effAccent}${!draft.accentColor && !isStandalone ? ' — from your club' : ''}`}
                  maxLength={7}
                  onChange={e => commitHex(e.target.value)}
                  onBlur={() => { if (hexDraft && !HEX_RE.test(hexDraft)) setHexDraft(draft.accentColor ?? ''); }}
                />
                {teamColor && HEX_RE.test(teamColor) && teamColor !== draft.accentColor && (
                  <button type="button" className={styles.chipBtn} disabled={saving} onClick={() => { setLook({ accentColor: teamColor }); setHexDraft(teamColor); }}>
                    <span className={styles.chipDot} style={{ background: teamColor }} aria-hidden />
                    Use your team colour
                  </button>
                )}
              </>
            ) : (
              <span className={shared.settingRowDesc}>{effAccent}</span>
            )}
          </div>
        </div>

        {/* ── Footer line ── */}
        <div className={shared.settingRow}>
          <div className={shared.settingRowMain}>
            <span className={shared.settingRowLabel}>Footer line</span>
            <span className={shared.settingRowDesc}>
              One line at the foot of every page — a website, an email, a motto.
            </span>
          </div>
          <div className={shared.settingRowCtl}>
            {canEdit ? (
              <input
                className={shared.input}
                aria-label="Footer line"
                style={{ width: 260, maxWidth: '100%', minHeight: 40 }}
                disabled={saving}
                value={draft.footerText ?? ''}
                maxLength={200}
                placeholder={club.footerText && !isStandalone
                  ? `${club.footerText} — from your club`
                  : 'e.g. gohawks.ca · coach@gohawks.ca'}
                onChange={e => setLook({ footerText: e.target.value })}
              />
            ) : (
              <span className={shared.settingRowDesc}>{effFooter ?? '—'}</span>
            )}
          </div>
        </div>

        {/* ── The honest way back (club-owned teams that customized) ── */}
        {canEdit && !isStandalone && savedCustomized && (
          <div className={shared.settingRow}>
            <div className={shared.settingRowMain}>
              <span className={shared.settingRowLabel}>Back to your club’s look</span>
              <span className={shared.settingRowDesc}>
                Clears your crest, colour and footer; your paper shows {club.name}’s look again.
              </span>
            </div>
            <div className={shared.settingRowCtl}>
              <button type="button" className={shared.btnSecondary} disabled={saving} onClick={() => void put({}, 'Back to your club’s look.')}>
                Use club look
              </button>
            </div>
          </div>
        )}
      </div>

      {canEdit && (
        <div className={styles.saveRow}>
          {error && <span className={shared.errorText} style={{ margin: 0 }}>{error}</span>}
          {msg && !error && <span className={shared.settingRowSaved}>{msg}</span>}
          <button
            type="button"
            className={shared.btnPrimary}
            disabled={saving || !dirty}
            onClick={() => void put(draft, 'Saved — your next document carries this look.')}
          >
            {saving ? 'Saving…' : 'Save look'}
          </button>
        </div>
      )}
    </CoachCollapseSection>
  );
}
