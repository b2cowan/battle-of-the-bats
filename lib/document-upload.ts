/**
 * PLAYER DOCUMENTS, DOCUMENT TEMPLATES AND A PERMIT'S FILE — what an uploaded file is called and what it really is
 * (Board Ready trust close-out 6, owner 2026-11-18; the third access sweep's "Upload paths" small finding).
 *
 * The three upload routes into the `rep-team-documents` bucket (a coach's player documents, the club's player documents,
 * the club's document templates) used to file the object under the name the browser sent and store it with the type the
 * browser claimed. Now:
 *   · the TYPE is read from the file's own first bytes (PDF, JPEG, PNG, Word .docx), never the browser's claim, and is the
 *     type the object is stored and later served with. A file whose bytes are none of the four is refused.
 *   · the stored KEY carries a cleaned name (the Rules screen's cleaner: word characters, dots, dashes), with the extension
 *     the checked type has, so a key can never hold a slash, a `..` or a misleading extension.
 *   · the NAME the screens show keeps the person's own spelling, minus any folder part and control characters, capped.
 * Pure and server-safe. The routes call `checkDocumentUpload` once; the parts stay exported for the unit test.
 */
import { cleanResourceFileName } from './resource-file-storage.ts';

export type DocumentUploadKind = 'pdf' | 'jpeg' | 'png' | 'docx';

const KINDS: Record<DocumentUploadKind, { mime: string; ext: string; also?: readonly string[] }> = {
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg', also: ['jpeg'] },
  png: { mime: 'image/png', ext: 'png' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
};

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Where `text` first sits in the bytes, or -1. Tests the first byte before the rest: a 10 MB ZIP that is not a .docx is
 *  walked once, not compared in full at every position. */
function indexOfAscii(b: Uint8Array, text: string, limit = b.length): number {
  const codes = [...text].map(c => c.charCodeAt(0));
  const first = codes[0];
  const end = Math.min(limit, b.length) - codes.length;
  for (let i = b.indexOf(first); i >= 0 && i <= end; i = b.indexOf(first, i + 1)) if (startsWith(b, codes, i)) return i;
  return -1;
}

/**
 * What the bytes are, or null. A PDF's header may sit anywhere in its first 1,024 bytes (the PDF standard allows it); a
 * .docx is a ZIP archive that holds a `word/` part (the name is in the archive's directory, so the whole file is read).
 */
export function sniffDocumentUpload(bytes: ArrayBuffer | Uint8Array): DocumentUploadKind | null {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (indexOfAscii(b, '%PDF-', 1024) >= 0) return 'pdf';
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && indexOfAscii(b, 'word/') >= 0) return 'docx';
  return null;
}

/** The type a checked file is stored and served with. */
export function documentUploadMime(kind: DocumentUploadKind): string {
  return KINDS[kind].mime;
}

/** The name as the screens show it: the person's spelling, without a folder part or control characters, never empty. */
export function documentDisplayName(name: string, kind: DocumentUploadKind): string {
  // Control characters, and the direction marks that can make "invoice<RLO>fdp.exe" read as "invoiceexe.pdf" in a list.
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').trim();
  // Cut by character, not by UTF-16 unit: half an emoji at the cut is a lone surrogate the database refuses.
  const chars = Array.from(base);
  const short = chars.length > 200 ? chars.slice(-200).join('') : base;
  return short || `document.${KINDS[kind].ext}`;
}

/** The three routes' one refusal when the bytes are none of the four types. */
export const DOCUMENT_TYPE_REFUSAL = 'File type not allowed. Use PDF, JPG, PNG, or DOCX.';

/**
 * The whole check, as the three upload routes ask it: what the file really is, the type it is stored and served with, the
 * cleaned name for its key and the name the screens show — or null when the bytes are none of the four types. `allowed`
 * narrows the four for a door that takes fewer (a permit's file: PDF, JPEG, PNG — leftover call 10, owner 2026-11-19); that
 * door refuses in its own words, since `DOCUMENT_TYPE_REFUSAL` names DOCX.
 */
export function checkDocumentUpload(
  bytes: ArrayBuffer | Uint8Array, name: string, allowed?: readonly DocumentUploadKind[],
): { contentType: string; storedName: string; displayName: string } | null {
  const kind = sniffDocumentUpload(bytes);
  if (!kind || (allowed && !allowed.includes(kind))) return null;
  return { contentType: documentUploadMime(kind), storedName: documentStoredName(name, kind), displayName: documentDisplayName(name, kind) };
}

/** The name as it is filed in the key: cleaned, and ending in the checked type's extension. */
export function documentStoredName(name: string, kind: DocumentUploadKind): string {
  const cleaned = cleanResourceFileName(documentDisplayName(name, kind));
  const { ext, also = [] } = KINDS[kind];
  const has = cleaned.toLowerCase().split('.').pop();
  return has && cleaned.includes('.') && (has === ext || also.includes(has)) ? cleaned : `${cleaned}.${ext}`;
}
