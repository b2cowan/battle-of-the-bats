'use client';
import { useEffect, useState, type RefObject } from 'react';
import { useConfirm } from './ConfirmProvider';
import CalendarSubscribeWindow from './CalendarSubscribeWindow';
import { SUBSCRIBE_WORDS as W, lastReadWords } from '@/lib/calendar-subscribe-words';

/**
 * THE COACH'S SUBSCRIBE WINDOW (Club Tier Stage 6d, B1 + B2) — the shared window with the coach's link and words.
 *
 * The link is the coach's OWN (Ask 1), rebuilt by the server every time this opens (`GET …/calendar-link` — signed,
 * never stored, so it is the same link until Reset). What's in it follows what this coach's Schedule shows (Ask 2): the
 * tryout days only for a coach who runs them. Reset asks first — the portal's question, the one modal here — then makes
 * a new link; the old one answers an empty calendar from then on, and the pill says "New link made".
 */
interface LinkState { url: string; calendarName: string; lastReadOn: string | null; today: string; includesTryouts: boolean; generation: number }

export default function CoachCalendarSubscribe({
  orgSlug, teamId, teamName, phone, opener, onClose,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  phone: boolean;
  opener: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const endpoint = `/api/coaches/${orgSlug}/teams/${teamId}/calendar-link`;
  const [link, setLink] = useState<LinkState | null>(null);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [newLinkKey, setNewLinkKey] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(endpoint)
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) { setError(body.error ?? 'Your calendar link could not be loaded.'); return; }
        setLink(body as LinkState);
      })
      .catch(() => { if (live) setError('Your calendar link could not be loaded.'); });
    return () => { live = false; };
  }, [endpoint]);

  async function reset() {
    const yes = await confirm({
      title: W.resetTitle,
      message: W.resetBody(teamName),
      confirmText: W.reset,
      cancelText: W.resetCancel,
      tone: 'info',
    });
    if (!yes) return;
    setResetting(true);
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation: link?.generation }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Reset somewhere else first (another tab, another device): the link on screen is already dead, so show the
        // current one rather than hand out a link that answers an empty calendar (/review 2026-10-11).
        const fresh = await fetch(endpoint);
        if (fresh.ok) { setLink(await fresh.json() as LinkState); return; }
      }
      if (!res.ok) { setError(body.error ?? 'The link could not be reset. Try again.'); return; }
      setLink(body as LinkState);
      setNewLinkKey(k => k + 1);
    } catch {
      setError('The link could not be reset. Try again.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <CalendarSubscribeWindow
      phone={phone}
      opener={opener}
      context={`${teamName} · Schedule`}
      title={phone ? W.sheetTitle : W.windowTitle}
      lead={W.lead(teamName)}
      link={link ? { https: link.url, calendarName: link.calendarName } : null}
      loadError={error || undefined}
      lines={{
        whatsIn: W.whatsInCoach(link?.includesTryouts ?? false),
        seasonLine: W.seasonLine,
        howOften: W.howOften,
        yourLink: W.yourLinkCoach,
        yourCalendar: link ? lastReadWords(link.lastReadOn, link.today, newLinkKey > 0) : undefined,
      }}
      onReset={reset}
      resetting={resetting}
      newLinkKey={newLinkKey}
      onClose={onClose}
    />
  );
}
