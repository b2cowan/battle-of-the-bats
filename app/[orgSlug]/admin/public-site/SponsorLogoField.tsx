'use client';
/**
 * A SPONSOR'S LOGO BOX (Club Tier Stage 4d; drawing https://claude.ai/artifact/CAKV9xcGQoW4zudF5TvGcE, words
 * CLUB_TIER_STAGE4D_COPY.md §B). The one new control in the list window. The box is the shape families see (160 by 72, the
 * logo scaled to fit and never cropped), so what the editor shows is what the strip shows. A file is uploaded the moment it
 * is chosen — the server opens it and re-saves a small PNG (lib/sponsor-logo-image.ts) — and this reports the address the
 * server made. A refused file is never kept: the red line stays until a good file is chosen or the window closes.
 *
 * It does not save the sponsor and does not delete files: the window around it owns both (SiteListRecord), because a file
 * may only be thrown away AFTER the list that stopped using it has been saved.
 */
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { ORG_IMAGE_TYPES, ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import styles from './public-site.module.css';

const ACCEPT = ORG_IMAGE_TYPES.join(',');

export default function SponsorLogoField({ label, value, canWrite, upload, onChange, onBusy }: {
  label: string;
  /** The logo's address, or '' for none. */
  value: string;
  canWrite: boolean;
  /** Sends the file; resolves with the address the server made, or throws with the sentence to show. */
  upload: (file: File) => Promise<string>;
  /** The logo changed: the address of a file made just now, or '' for Remove logo. */
  onChange: (url: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState('');

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(ORG_IMAGE_TYPES as readonly string[]).includes(file.type)) { setRefusal(W.logoWrongType); return; }
    if (file.size > ORG_LOGO_MAX_BYTES) { setRefusal(W.logoTooBig); return; }
    setRefusal('');
    setBusy(true);
    onBusy?.(true);
    try {
      onChange(await upload(file));
    } catch (err) {
      setRefusal(err instanceof Error && err.message ? err.message : W.logoUploadFailed);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  const boxClass = `${styles.sponsorBox}${refusal && !value ? ` ${styles.sponsorBoxBad}` : ''}${!value && !busy && !refusal ? ` ${styles.sponsorBoxEmpty}` : ''}`;
  return (
    <div className={ck.field}>
      <span className={ck.label}>{label}</span>
      <div className={styles.imageRow}>
        <span className={boxClass}>
          {busy ? <span className={styles.noImage}>{W.uploading}</span>
            : value ? <img src={value} alt="" />
            : <span className={styles.noImage}>{refusal ? W.logoNotSaved : W.noLogoYet}</span>}
        </span>
        {canWrite && (
          <div className={styles.imageButtons}>
            <button type="button" className="btn btn-outline btn-data" onClick={() => input.current?.click()} disabled={busy}>
              <Upload size={14} aria-hidden /> {value ? W.replaceLogo : W.uploadLogo}
            </button>
            {value && <button type="button" className="btn btn-ghost btn-data" onClick={() => { setRefusal(''); onChange(''); }} disabled={busy}>{W.removeLogo}</button>}
          </div>
        )}
      </div>
      {refusal ? <p className={styles.fieldError} role="alert">{refusal}</p> : <p className={ck.hint}>{W.sponsorLogoHint}</p>}
      <input ref={input} type="file" accept={ACCEPT} hidden aria-label={label} onChange={e => void pick(e)} />
    </div>
  );
}
