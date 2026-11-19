import { getRepDocumentTemplates } from './db';

/**
 * WHICH TEMPLATE A PLAYER DOCUMENT ANSWERS — the one rule both upload doors ask (a coach's, `api/coaches/…/roster/
 * [playerId]/documents`; the club's, `api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents`).
 *
 * A row's Upload names the template it answers. The id is kept only when it is an ACTIVE template that applies to this
 * team (the club's own, or its group's, as `getRepDocumentTemplates` reads them) and is of the chosen document type, so a
 * form-supplied id is never taken on trust. Anything else (a stale id, another club's template, a retired one, a medical
 * template on a waiver upload) answers null and the document is filed as answering no template. Stage 14 S4 put this
 * check in the coach door; the club door kept the form's id until leftover call 11 (owner 2026-11-19, queue P8b).
 */
export async function answeredTemplateId(
  orgId: string, teamId: string, templateId: string | null | undefined, documentType: string,
): Promise<string | null> {
  if (!templateId) return null;
  const applies = await getRepDocumentTemplates(orgId, teamId);
  const t = applies.find(x => x.id === templateId);
  return t && t.isActive && t.documentType === documentType ? t.id : null;
}
