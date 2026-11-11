'use client';

import { Check, Copy, Shield } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { cleanFriendCode, isFriendCode } from '@/lib/league-friend-code';
import { FRIEND_WORDS as FW, type FriendIn } from '@/lib/league-friends';
import formKit from '@/components/public/ClubForm.module.css';
import kit from '@/components/public/ClubKit.module.css';
import styles from './register.module.css';

/**
 * THE PARENT'S QUESTION, INSIDE A CHILD'S CARD (Board Ready Stage 1 Part 1; drawing tab 1, rulings A2, A8, A12). Used by
 * the sign-up form under the division line, and by "Your sign-up"'s Change. Friends are hairline blocks inside the
 * child's section, never nested cards. Each is a name (first, last, their parent's) or a friend code, and the parent can
 * swap between the two. A code is checked by its check letter only; nothing is looked up, and nothing typed is checked
 * against other families. The two /legal lines show once a friend is being named.
 */

export type FriendDraft = { key: number; by: 'name' | 'code'; first: string; last: string; parent: string; code: string };
export const blankFriend = (key: number): FriendDraft => ({ key, by: 'name', first: '', last: '', parent: '', code: '' });

/** What is sent: every block as typed (the server drops empty ones and checks the rest). */
export function friendsToSend(drafts: readonly FriendDraft[]): FriendIn[] {
  return drafts.map(f => (f.by === 'code'
    ? { by: 'code' as const, code: f.code }
    : { by: 'name' as const, first: f.first || null, last: f.last || null, parent: f.parent || null }));
}

/** A typed code with a full six characters that fails its check letter (the form says so at once). */
export const codeHasTypo = (typed: string) => cleanFriendCode(typed).length >= 6 && !isFriendCode(typed);

export default function FriendFields({
  idPrefix, childName, division, max, friends, onChange, nextKey, errors, headingLevel = 3,
}: {
  idPrefix: string;
  childName: string;
  /** The child's division, when known ("signing up for U9"). */
  division: string | null;
  max: number;
  friends: FriendDraft[];
  onChange: (next: FriendDraft[]) => void;
  /** A key for the next block. */
  nextKey: () => number;
  /** Errors keyed `friends.{n}.{field}` or `friends`. */
  errors: Record<string, string>;
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const set = (i: number, patch: Partial<FriendDraft>) => onChange(friends.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className={styles.fq} role="group" aria-labelledby={`${idPrefix}-fq`}>
      <Heading id={`${idPrefix}-fq`} className={styles.fqTitle}>{FW.question(childName)}</Heading>
      <p className={formKit.hint} style={{ marginTop: 0 }}>{FW.hint(max, division)}</p>
      {friends.map((f, i) => {
        const id = `${idPrefix}-f${f.key}`;
        const err = (k: string) => errors[`friends.${i}.${k}`];
        const typo = f.by === 'code' && (err('code') || (codeHasTypo(f.code) ? FW.codeTypo : null));
        return (
          <div key={f.key} className={styles.friend}>
            <div className={styles.friendHead}>
              <span>{FW.friendN(i + 1)}</span>
              <button type="button" className={styles.linkButton} aria-label={FW.removeLabel(i + 1)}
                onClick={() => onChange(friends.filter((_, j) => j !== i))}>{FW.remove}</button>
            </div>
            {f.by === 'name' ? (
              <>
                <div className={formKit.fieldRow}>
                  <div>
                    <label className={formKit.label} htmlFor={`${id}-first`}>{FW.first}</label>
                    <input id={`${id}-first`} className={`${formKit.input}${err('first') ? ` ${formKit.inputError}` : ''}`} type="text"
                      value={f.first} maxLength={80} autoComplete="off" onChange={e => set(i, { first: e.target.value })} />
                    {err('first') && <p className={formKit.errorMsg}>{err('first')}</p>}
                  </div>
                  <div>
                    <label className={formKit.label} htmlFor={`${id}-last`}>{FW.last}</label>
                    <input id={`${id}-last`} className={formKit.input} type="text"
                      value={f.last} maxLength={80} autoComplete="off" onChange={e => set(i, { last: e.target.value })} />
                  </div>
                </div>
                <div className={formKit.field}>
                  <label className={formKit.label} htmlFor={`${id}-parent`}>{FW.parent}</label>
                  <input id={`${id}-parent`} className={formKit.input} type="text" placeholder={FW.parentPlaceholder}
                    value={f.parent} maxLength={120} autoComplete="off" onChange={e => set(i, { parent: e.target.value })} />
                </div>
                <button type="button" className={styles.linkButton} onClick={() => set(i, { by: 'code' })}>{FW.useCode}</button>
              </>
            ) : (
              <>
                <div className={formKit.field}>
                  <label className={formKit.label} htmlFor={`${id}-code`}>{FW.code}</label>
                  <input id={`${id}-code`} className={`${formKit.input} ${styles.codeInput}${typo ? ` ${formKit.inputError}` : ''}`} type="text"
                    value={f.code} maxLength={9} autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    aria-describedby={`${id}-code-hint`} aria-invalid={typo ? true : undefined}
                    onChange={e => set(i, { code: e.target.value.toUpperCase() })} />
                  <p id={`${id}-code-hint`} className={formKit.hint}>{FW.codeHint}</p>
                  {typo && <p className={formKit.errorMsg} role="alert">{typo}</p>}
                </div>
                <button type="button" className={styles.linkButton} onClick={() => set(i, { by: 'name' })}>{FW.useName}</button>
              </>
            )}
          </div>
        );
      })}
      {errors.friends && <p className={formKit.errorMsg}>{errors.friends}</p>}
      {friends.length < max ? (
        <button type="button" className={`${kit.btn} ${kit.btnSecondary} ${styles.addFriend}`}
          onClick={() => onChange([...friends, blankFriend(nextKey())])}>{FW.add}</button>
      ) : (
        <p className={styles.fqDim}>{FW.atMax(childName, max)}</p>
      )}
      {friends.length > 0 && (
        <>
          <p className={styles.fqDim}>{FW.care}</p>
          <p className={styles.priv}><Shield size={16} aria-hidden className={styles.privIcon} /><span>{FW.privacy}</span></p>
        </>
      )}
    </div>
  );
}

/** A child's friend code with Copy (drawing tab 2): text, never a link; "Copied" for two seconds; the symbol alone on a phone. */
export function FriendCodeRow({ code, childName }: { code: string; childName: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <span className={styles.codeBox}>
      <span className={styles.codeValue}>{code}</span>
      <button type="button" className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.codeCopy}`}
        onClick={() => void copy(code.replace(/\s/g, ''))} aria-label={FW.copyLabel(childName)}>
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
        <span className={styles.codeCopyLabel}>{copied ? FW.copied : FW.copy}</span>
      </button>
      <span className={kit.srOnly} aria-live="polite">{copied ? FW.copied : ''}</span>
    </span>
  );
}
