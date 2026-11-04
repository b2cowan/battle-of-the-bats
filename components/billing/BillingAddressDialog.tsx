'use client';
/**
 * THE BILLING ADDRESS WINDOW, and the one way a paid button asks for it (GST/HST Stage 1 Part 2; owner drawing
 * 2026-11-03, tab 2; drawing asks 1–6 ruled A).
 *
 *   · A form window at the form width (520), Cancel then the lime main button: Continue on the way to paying, Save on
 *     Plan & billing. While saving it reads "Saving…" and cannot be pressed twice; a failed save is one red sentence at
 *     the left of the foot and nothing typed is lost; closing with something typed asks Keep writing / Discard.
 *   · US while US sales are closed: the foot says why in amber at the LEFT and only Cancel is left (the main button is
 *     absent, not greyed — a standing reason, nothing to fix inside the form).
 *   · `useBillingAddressGate`: every paid button calls `ensure(next)` — with an address on file, `next` runs at once;
 *     without one, this window opens first and `next` runs after Continue saves. A server refusal with the code
 *     `billing_address_required` calls `refused(retry)`, which opens the window instead of showing an error. The order
 *     is always window → (monthly-or-yearly question) → Stripe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import {
  BILLING_ADDRESS_FORM_WORDS as F,
  BILLING_ADDRESS_REQUIRED,
  BILLING_LOCATION_WORDS,
  storedLocationStillValid,
  type StoredBillingLocation,
} from '@/lib/billing-location';
import BillingAddressFields, { useAddressDraft } from './BillingAddressFields';
import styles from './BillingAddress.module.css';

/** Whose address: a club's (by its Plan & billing slug — a Coaches Portal's resolves to the coach's own), or the person's. */
export type BillingAddressTarget = { orgSlug: string } | { scope: 'person' };

export type BillingAddressInfo = {
  location: StoredBillingLocation | null;
  buyer: 'club' | 'person';
  name: string | null;
  usSalesOpen: boolean;
};

const FALLBACK: BillingAddressInfo = { location: null, buyer: 'club', name: null, usSalesOpen: false };

const query = (target: BillingAddressTarget) =>
  'orgSlug' in target ? `orgSlug=${encodeURIComponent(target.orgSlug)}` : 'scope=person';

/** null = the read FAILED (not "no address on file"): the caller must not remember it. */
export async function fetchBillingAddress(target: BillingAddressTarget): Promise<BillingAddressInfo | null> {
  try {
    const res = await fetch(`/api/billing/location?${query(target)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json() as Partial<BillingAddressInfo>;
    return {
      location: data.location ?? null,
      buyer: data.buyer === 'person' ? 'person' : 'club',
      name: data.name ?? null,
      usSalesOpen: data.usSalesOpen === true,
    };
  } catch {
    return null;
  }
}

/** The address on file is one a paid checkout accepts today (a US one stops being one while US sales are closed). */
export function addressOnFile(info: BillingAddressInfo | null): StoredBillingLocation | null {
  const location = info?.location ?? null;
  return location && storedLocationStillValid(location, info!.usSalesOpen) ? location : null;
}

/** A server answer that means "ask for the address", from any of the paid routes. */
export const isAddressRefusal = (data: unknown): boolean =>
  !!data && typeof data === 'object' && (data as { code?: unknown }).code === BILLING_ADDRESS_REQUIRED;

/** Saves through PUT /api/billing/location. Field errors come back as red lines; anything else is the save-failed sentence. */
export async function saveBillingAddress(target: BillingAddressTarget, body: Record<string, unknown>): Promise<
  | { ok: true; location: StoredBillingLocation }
  | { ok: false; errors?: Record<string, string>; failed?: true }
> {
  try {
    const res = await fetch('/api/billing/location', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...('orgSlug' in target ? { orgSlug: target.orgSlug } : { scope: 'person' }) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.location) return { ok: true, location: data.location as StoredBillingLocation };
    if (res.status === 400 && data.errors) return { ok: false, errors: data.errors };
    return { ok: false, failed: true };
  } catch {
    return { ok: false, failed: true };
  }
}

export default function BillingAddressDialog({ target, info, action, onClose, onSaved }: {
  target: BillingAddressTarget;
  info: BillingAddressInfo;
  /** `continue`: on the way to paying. `save`: changing it from Plan & billing. */
  action: 'continue' | 'save';
  onClose: () => void;
  onSaved: (location: StoredBillingLocation) => void;
}) {
  const form = useAddressDraft(info.location, info.usSalesOpen);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const person = info.buyer === 'person';
  const subject = person ? { kind: 'person' as const } : { kind: 'club' as const, name: info.name ?? '' };

  async function save() {
    if (busy.current) return;
    setFailed(false);
    if (!form.check().ok) return;
    busy.current = true; setSaving(true);
    const result = await saveBillingAddress(target, form.body);
    busy.current = false; setSaving(false);
    if (result.ok) { onSaved(result.location); return; }
    if (result.errors) form.setErrors(result.errors);
    else setFailed(true);
  }

  const foot = form.usClosed
    ? <span className={styles.amber}>{BILLING_LOCATION_WORDS.usClosed}</span>
    : failed ? <span role="alert">{BILLING_LOCATION_WORDS.saveFailed}</span> : undefined;

  return (
    <KitDialog kind="form" title={person ? F.personTitle : F.title} identity={person ? undefined : info.name ?? undefined}
      onClose={onClose} busy={saving} dirty={form.dirty}
      footerStart={foot}
      footer={<>
        <DialogCancel>{F.cancel}</DialogCancel>
        {!form.usClosed && (
          <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={saving}>
            {saving ? F.saving : action === 'save' ? F.save : F.continue}
          </button>
        )}
      </>}
    >
      <form className={styles.fields} onSubmit={event => { event.preventDefault(); void save(); }}>
        <p className={styles.intro}>{person ? F.personIntro : F.intro}</p>
        <BillingAddressFields form={form} idPrefix="billing-address" subject={subject} disabled={saving} />
      </form>
    </KitDialog>
  );
}

/**
 * One gate per screen that has paid buttons. Render `dialog` somewhere on the screen; call `ensure(next)` from each paid
 * button and `refused(retry)` when a paid route answers `billing_address_required`.
 */
export function useBillingAddressGate(target: BillingAddressTarget | null) {
  const [info, setInfo] = useState<BillingAddressInfo | null>(null);
  const [ask, setAsk] = useState<{ next: (() => void) | null; action: 'continue' | 'save'; pill?: true } | null>(null);
  const loading = useRef<Promise<BillingAddressInfo> | null>(null);
  const key = target ? query(target) : null;

  const load = useCallback((): Promise<BillingAddressInfo> => {
    if (!target) return Promise.resolve(FALLBACK);
    if (!loading.current) {
      const pending: Promise<BillingAddressInfo> = fetchBillingAddress(target).then(next => {
        // A failed read is asked again next time (a blank window for a buyer who has an address is the wrong answer to a blip).
        if (!next) { if (loading.current === pending) loading.current = null; return FALLBACK; }
        setInfo(next);
        return next;
      });
      loading.current = pending;
    }
    return loading.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target's query string, not its object identity
  }, [key]);

  useEffect(() => { loading.current = null; if (key) void load(); }, [key, load]);

  const ensure = useCallback((next: () => void) => {
    void load().then(current => {
      if (addressOnFile(current)) next();
      else setAsk({ next, action: 'continue' });
    });
  }, [load]);

  const refused = useCallback((retry: () => void) => {
    void load().then(() => setAsk({ next: retry, action: 'continue' }));
  }, [load]);

  /** The window filled in, with Save: Plan & billing's "Billing address" button (no `after`: the save pill shows), or a
   *  "Billed to … Change" door (`after` brings back what it was opened from — on Save, and on Cancel). */
  const edit = useCallback((after?: () => void) => {
    void load().then(() => setAsk(after ? { next: after, action: 'save' } : { next: null, action: 'save', pill: true }));
  }, [load]);

  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dialog = ask && target && info ? (
    <BillingAddressDialog target={target} info={info} action={ask.action}
      onClose={() => {
        setAsk(null);
        // A "Change" door goes back to the question it came from; a first-time ask on the way to paying does not go on.
        if (ask.action === 'save' && !ask.pill) ask.next?.();
      }}
      onSaved={location => {
        const saved = { ...(info ?? FALLBACK), location };
        setInfo(saved);
        loading.current = Promise.resolve(saved);
        setAsk(null);
        if (ask.pill) setSavedAt(Date.now());
        ask.next?.();
      }}
    />
  ) : null;

  /** After a save made outside the window (the sign-up page's Address step): the gate knows the address is on file. */
  const remember = useCallback((location: StoredBillingLocation) => {
    setInfo(current => {
      const saved = { ...(current ?? FALLBACK), location };
      loading.current = Promise.resolve(saved);
      return saved;
    });
  }, []);

  return {
    info, location: addressOnFile(info), load, ensure, refused, edit, remember, dialog, open: ask !== null,
    savedAt, clearSaved: () => setSavedAt(null),
  };
}
