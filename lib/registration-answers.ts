/**
 * A TOURNAMENT'S REGISTRATION ANSWERS — how a team's answers to the organizer's own questions are read back (Board Ready,
 * the tournament registration questions, fixes F1–F3; owner ruling 15, 2026-11-20).
 *
 *   · F1 — archiving a question only hides it from the public form. The window promises "Answers teams already gave stay
 *     with their registrations", so every READ of answers takes the archived questions too: the team's record shows an
 *     archived question's answer under "No longer asked", and the export adds a column for an archived question that at
 *     least one team answered, after the current questions. The public form reads the active questions only, as before.
 *   · F2 — a file answer is a private storage key, never a link. The record shows the file's NAME and opens it through
 *     `/api/admin/tournaments/[tournamentId]/registrations/file` (a one-hour signed link, after the answers' own access
 *     check); the export writes "Attached". The key itself never leaves the server.
 *   · F3 — a file is a PDF, JPEG, PNG or HEIC, read from its own bytes (`lib/document-upload.ts`), and the form's files
 *     together stay under the proxy's per-request limit.
 * Pure and server-safe: the teams route, the export route, the upload route, the record and the public form share it.
 */
import type { DocumentUploadKind } from './document-upload.ts';

/** The types a registration file may be (F3). */
export const REGISTRATION_FILE_KINDS: readonly DocumentUploadKind[] = ['pdf', 'jpeg', 'png', 'heic'];

/** The file picker's filter: a hint to the person; the server still reads the bytes. */
export const REGISTRATION_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif';

/**
 * The most ALL of one form's files may weigh together. The registration passes through the proxy, which buffers a body only
 * up to 10 MB (Next's `proxyClientMaxBodySize` default) and cuts the rest, so a bigger form arrives broken and the server
 * cannot even say which question was too big. 9 MB leaves room for the form's own fields — the Rules screen's figure, for
 * the same reason (`lib/resource-file-storage.ts`). The browser checks it before sending; the server checks it again.
 */
export const REGISTRATION_FILES_MAX_BYTES = 9 * 1024 * 1024;

export const REGISTRATION_FILE_WORDS = {
  /** A refused type — names the four. */
  wrongType: (label: string) => `${label}: upload a PDF, JPEG, PNG or HEIC file.`,
  tooBig: (label: string) => `${label}: the files on this form must be 9 MB or smaller in total. Choose a smaller copy.`,
  /** The export's cell for a file answer (F2): never the storage key. */
  attached: 'Attached',
  /** The record's line above the archived questions' answers (F1). */
  noLongerAsked: 'No longer asked',
  /** The export's column heading for an archived question. */
  archivedColumn: (label: string) => `${label} (no longer asked)`,
} as const;

/** Whether the browser's own name and type look like an allowed file — the picker's early answer, never the server's. */
export function looksLikeRegistrationFile(name: string, type: string): boolean {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  // `.heif` is the format's own extension; the server still takes only an HEVC-coded one (a HEIC).
  if (['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext) && name.includes('.')) return true;
  return ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(type.toLowerCase());
}

type FieldLike = { id: string; label: string; fieldType: string; isArchived?: boolean };
type AnswerLike = {
  registrationId: string;
  fieldId: string;
  valueText: string | null;
  valueJson: unknown;
  fileUrl: string | null;
};

/** One answer as the team's record shows it. `file`: the answer is a stored file, opened through the signed-link route. */
export type TeamRecordAnswer = {
  fieldId: string;
  label: string;
  fieldType: string;
  value: string;
  archived?: boolean;
  file?: boolean;
};

/**
 * The name a stored file was uploaded as. Keys are `{org}/{tournament}/{team}/{fieldId}-{uuid}-{cleanName}` (the upload
 * route), so the name is what follows the two ids. A key of another shape shows its last part, never the folders.
 */
export function registrationFileName(key: string): string {
  const last = key.split('/').pop() ?? '';
  const match = /^[0-9a-f-]{36}-[0-9a-f-]{36}-(.+)$/i.exec(last);
  return (match ? match[1] : last) || 'File';
}

function checkboxValue(valueJson: unknown): string | null {
  if (valueJson && typeof valueJson === 'object' && 'checked' in valueJson) {
    return (valueJson as { checked?: unknown }).checked ? 'Yes' : 'No';
  }
  return null;
}

/** An answer as text, for the record (a file is its name). */
function recordValue(answer: AnswerLike): string {
  if (answer.fileUrl) return registrationFileName(answer.fileUrl);
  if (answer.valueText) return answer.valueText;
  return checkboxValue(answer.valueJson) ?? '';
}

/** An answer as the export writes it (F2: a file is "Attached", never its key). */
export function exportAnswerValue(answer: AnswerLike | undefined): string {
  if (!answer) return '';
  if (answer.fileUrl) return REGISTRATION_FILE_WORDS.attached;
  if (answer.valueText) return answer.valueText;
  return checkboxValue(answer.valueJson) ?? '';
}

/**
 * Each registration's answers for its record, in the questions' order: the current questions' first, then the archived
 * questions' (F1). `fields` is EVERY question of the tournament, archived included. An answer to a question that is gone
 * altogether (no row) is not shown — there is nothing to call it.
 */
export function teamRecordAnswers(fields: FieldLike[], answers: AnswerLike[]): Map<string, TeamRecordAnswer[]> {
  const order = new Map(fields.map((field, i) => [field.id, i]));
  const fieldMap = new Map(fields.map(field => [field.id, field]));
  const byRegistration = new Map<string, TeamRecordAnswer[]>();
  for (const answer of answers) {
    const field = fieldMap.get(answer.fieldId);
    if (!field) continue;
    const value = recordValue(answer);
    // An archived question with nothing in it says nothing worth a line.
    if (field.isArchived && !value) continue;
    const row: TeamRecordAnswer = { fieldId: field.id, label: field.label, fieldType: field.fieldType, value };
    if (field.isArchived) row.archived = true;
    if (answer.fileUrl) row.file = true;
    const list = byRegistration.get(answer.registrationId) ?? [];
    list.push(row);
    byRegistration.set(answer.registrationId, list);
  }
  for (const list of byRegistration.values()) {
    list.sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || (order.get(a.fieldId) ?? 0) - (order.get(b.fieldId) ?? 0));
  }
  return byRegistration;
}

/**
 * The export's question columns: every current question, then each archived question at least one of these teams answered
 * (F1), headed so the two never read alike.
 */
export function exportAnswerColumns(fields: FieldLike[], answers: AnswerLike[]): Array<{ fieldId: string; heading: string }> {
  const answered = new Set(answers.filter(answer => exportAnswerValue(answer)).map(answer => answer.fieldId));
  return [
    ...fields.filter(field => !field.isArchived).map(field => ({ fieldId: field.id, heading: field.label })),
    ...fields.filter(field => field.isArchived && answered.has(field.id))
      .map(field => ({ fieldId: field.id, heading: REGISTRATION_FILE_WORDS.archivedColumn(field.label) })),
  ];
}

/**
 * Whether a stored key belongs to this team's registration in this tournament of this club — the signed-link route's last
 * check before it signs (the key is read from our own row, so this is defence in depth, not the access rule).
 */
export function registrationFileKeyBelongs(key: string, orgId: string, tournamentId: string, teamId: string): boolean {
  if (!key || key.includes('\\') || key.includes('\0')) return false;
  if (key.split('/').some(part => part === '' || part === '.' || part === '..')) return false;
  return key.startsWith(`${orgId}/${tournamentId}/${teamId}/`);
}
