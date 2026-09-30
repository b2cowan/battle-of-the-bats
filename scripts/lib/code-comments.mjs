/**
 * Comment blanking for the source-reading gates — one reader, so a fix to its string handling reaches every
 * gate that counts or matches code (`check-css-selectors.mjs`, `check-admin-old-look.mjs`). Blanking keeps
 * every newline, so line numbers stay honest.
 */

/**
 * Blank comments in a TS/JS/TSX source in place, string-aware, so `//` inside a URL string or a
 * template literal does not start a comment and a headstone's `styles.buried` does not read as a
 * reference. Newlines survive so line numbers stay honest. A `'`/`"` string ends at its line
 * (an unescaped JSX apostrophe can therefore only mis-read the rest of its own line); a template
 * literal tracks `${ }` nesting so an inner expression is read as code.
 */
export function blankCodeComments(src) {
  const out = src.split('');
  const frames = [{ mode: 'code', depth: 0 }];   // template expressions push a 'code' frame
  const top = () => frames[frames.length - 1];
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    const f = top();
    if (f.mode === 'lc') { if (c === '\n') { frames.pop(); continue; } out[i] = ' '; continue; }
    if (f.mode === 'bc') {
      if (c === '*' && n === '/') { out[i] = out[i + 1] = ' '; i++; frames.pop(); continue; }
      if (c !== '\n') out[i] = ' ';
      continue;
    }
    if (f.mode === 'sq' || f.mode === 'dq') {
      if (c === '\\') { i++; continue; }
      if (c === '\n' || c === (f.mode === 'sq' ? "'" : '"')) frames.pop();
      continue;
    }
    if (f.mode === 'tpl') {
      if (c === '\\') { i++; continue; }
      if (c === '`') { frames.pop(); continue; }
      if (c === '$' && n === '{') { frames.push({ mode: 'code', depth: 0 }); i++; }
      continue;
    }
    // mode === 'code'
    if (c === '/' && n === '/') { out[i] = out[i + 1] = ' '; i++; frames.push({ mode: 'lc' }); continue; }
    if (c === '/' && n === '*') { out[i] = out[i + 1] = ' '; i++; frames.push({ mode: 'bc' }); continue; }
    if (c === "'") { frames.push({ mode: 'sq' }); continue; }
    if (c === '"') { frames.push({ mode: 'dq' }); continue; }
    if (c === '`') { frames.push({ mode: 'tpl' }); continue; }
    if (c === '{') { f.depth++; continue; }
    if (c === '}') {
      if (f.depth === 0 && frames.length > 1) { frames.pop(); continue; }  // closes a `${`
      f.depth--;
    }
  }
  return out.join('');
}

/** Blank `/* … *\/` comments in a stylesheet, newlines kept. */
export const blankCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
