/**
 * lib/calendar-subscribe.ts — THE SUBSCRIBE WINDOW'S DOORS (Club Tier Stage 6d, specimen 2, ruled 2026-10-11).
 * Client-safe and pure: the coach's window and the public team page's sheet both read it, so the three app doors can
 * never point at two different places.
 *
 *   Apple Calendar  the webcal:// link — the Mac's and the iPhone's Calendar answer it with their own "Subscribe?";
 *   Google Calendar its add page with the webcal:// link filled in (`?cid=`), which reaches the phone's Google Calendar;
 *   Outlook         Outlook on the web's "Subscribe from web" with the https:// link and the calendar's name.
 *
 * No logos: the names are the labels. Order says which comes first — on a phone, this phone's own calendar app.
 */

export type CalendarApp = 'apple' | 'google' | 'outlook';

export interface CalendarSubscribeDoors {
  https: string;
  webcal: string;
  apple: string;
  google: string;
  outlook: string;
}

export function calendarSubscribeDoors(httpsUrl: string, calendarName: string): CalendarSubscribeDoors {
  const webcal = httpsUrl.replace(/^https?:\/\//i, 'webcal://');
  return {
    https: httpsUrl,
    webcal,
    apple: webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(calendarName)}`,
  };
}

export const CALENDAR_APP_NAMES: Record<CalendarApp, string> = {
  apple: 'Apple Calendar',
  google: 'Google Calendar',
  outlook: 'Outlook',
};

/**
 * The doors in order. At a desk Apple · Google · Outlook, as drawn. On a phone THIS PHONE'S OWN calendar app first: an
 * iPhone or iPad lists Apple first (one tap to its "Subscribe?"); anything else lists Google first (its add page, then
 * the phone's Google Calendar). Read from the browser's own description of itself, once, after mount.
 */
export function calendarAppOrder(opts: { phone: boolean; userAgent: string }): CalendarApp[] {
  if (!opts.phone) return ['apple', 'google', 'outlook'];
  const apple = /iPhone|iPad|iPod/i.test(opts.userAgent) || (/Macintosh/i.test(opts.userAgent) && /Mobile/i.test(opts.userAgent));
  return apple ? ['apple', 'google', 'outlook'] : ['google', 'apple', 'outlook'];
}
