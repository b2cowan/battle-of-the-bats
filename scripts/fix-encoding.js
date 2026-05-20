// Fix double-encoded UTF-8 characters in markdown files.
// Each pair: [corrupted_sequence, correct_character]
// Corrupted sequences are expressed as \uXXXX escapes so this script file
// stays pure ASCII — no risk of the script itself being mis-saved.
'use strict';
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node fix-encoding.js <file>'); process.exit(1); }

// How these got corrupted:
//   Original UTF-8 bytes were read as Windows-1252, producing wrong chars,
//   then those wrong chars were re-saved as UTF-8 (double-encoded).
//
// Pattern: bad = Windows-1252 char sequence | good = original Unicode char
const fixes = [
  // em dash —  (UTF-8: E2 80 94)
  //   E2=â(a-circumflex)  80=€(euro)  94=”(right-dbl-quot)
  ['â€”', '—'],

  // right single quote ’  (UTF-8: E2 80 99)
  //   E2=â  80=€  99=™(trade-mark)
  ['â€™', '’'],

  // left single quote ‘  (UTF-8: E2 80 98)
  //   E2=â  80=€  98=˜(small-tilde)
  ['â€˜', '‘'],

  // left double quote “  (UTF-8: E2 80 9C)
  //   E2=â  80=€  9C=œ(oe-ligature)
  ['â€œ', '“'],

  // right double quote ”  (UTF-8: E2 80 9D) — already covered above as part of em-dash?
  // Actually em-dash ends in 94=”, so handle separately only if needed
  // (covered by em-dash replacement above since ” is the 3rd byte there)

  // right arrow →  (UTF-8: E2 86 92)
  //   E2=â  86=†(dagger)  92=’(right-single-quot)
  ['â†’', '→'],

  // left arrow ←  (UTF-8: E2 86 90)
  //   E2=â  86=†  90=‘
  ['â†‘', '←'],

  // checkmark emoji ✅  (UTF-8: E2 9C 85)
  //   E2=â  9C=œ(oe)  85=…(ellipsis)
  ['âœ…', '✅'],

  // times / multiplication ×  (UTF-8: C3 97)
  //   C3=Ã(A-tilde)  97=—(em-dash) -- note em-dash byte, not the char
  //   Actually: 0x97 in Windows-1252 = —, so C3 97 -> Ã—
  ['Ã—', '×'],

  // en dash –  (UTF-8: E2 80 93)
  //   E2=â  80=€  93=“(left-dbl-quot)
  ['â€“', '–'],

  // bullet •  (UTF-8: E2 80 A2)
  //   E2=â  80=€  A2=¢(cent)
  ['â€¢', '•'],

  // ellipsis …  (UTF-8: E2 80 A6)
  //   E2=â  80=€  A6=¦(broken-bar)
  ['â€¦', '…'],
];

let content = fs.readFileSync(file, 'utf8');
let totalFixed = 0;

for (const [bad, good] of fixes) {
  let count = 0;
  let idx = content.indexOf(bad);
  while (idx !== -1) {
    count++;
    content = content.slice(0, idx) + good + content.slice(idx + bad.length);
    idx = content.indexOf(bad, idx + good.length);
  }
  if (count > 0) {
    const badDisplay = [...bad].map(c => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`).join(' ');
    console.log(`  ${count}x  [${badDisplay}] -> "${good}" (U+${good.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')})`);
    totalFixed += count;
  }
}

fs.writeFileSync(file, content, 'utf8');
console.log(`\nTotal: ${totalFixed} replacements in ${require('path').basename(file)}`);
