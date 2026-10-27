/**
 * A tag on a link we hand out (`?ref=spring-mailout`), remembered in THIS TAB only (Support console Stage 7 Part 8;
 * drawing J, "what the visitor never sees"). Session storage: no cookie, nothing in an account, gone when the tab
 * closes. The first tag a tab sees is kept. The server is the judge: only a tag on the short list in
 * `lib/lead-form-answers.ts` is ever stored, so what is kept here is just a short harmless word or nothing.
 * Browser only; every storage call is guarded, because a private window may refuse it.
 */
const KEY = 'flhq-ref';
const SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

export function rememberRefTag(search: string): void {
  try {
    if (window.sessionStorage.getItem(KEY)) return;
    const tag = new URLSearchParams(search).get('ref');
    if (tag && SHAPE.test(tag)) window.sessionStorage.setItem(KEY, tag.toLowerCase());
  } catch {
    /* storage refused: the lead is simply saved without a tag */
  }
}

export function readRefTag(): string | undefined {
  try {
    return window.sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
