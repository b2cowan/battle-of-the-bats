/**
 * club-schedule-export.ts — A CLUB SCHEDULE'S FILES, in the house format (Club Tier Stage 11a, part B; hub Stages 10 +
 * 11, specimens 5, 8 and 15; plan §6b, Ask 26). One Export, Excel first (2026-10-01):
 *
 *   Excel    — the schedule's three sheets (`scheduleSheets`): the masthead with the club's logo top-left, the slate
 *              header frozen under it, hours and money in their formats, the bold totals row, the notes under the
 *              table, the FieldLogicHQ row, landscape and fit to width, the text page footer (10a's print setup).
 *   PDF      — the printed schedule (`clubScheduleDocument`): through the product's PDF engine, the club's band and
 *              crest, a section per day ruled in the club's colour, the club-colour heading row in sentence case, the
 *              notes under the tables and the footer line. Landscape, compact: a wide grid is the report's own shape.
 *   Calendar — once the schedule is SENT (a draft is on nobody's calendar): every slot a team has, at its instants.
 *
 * The letterhead comes from the club's own PDF settings (`/api/admin/org/pdf-settings`), fetched for Excel too —
 * a club's Excel report once never got its logo because the settings were fetched for PDFs only (Ask 26's gap).
 */
import { DEFAULT_PDF_SETTINGS, downloadPDF, fetchResolvedPdfSettings, type OrgPdfSettings } from './pdf';
import { downloadXLSX, pageFooterText } from './xlsx';
import { buildFilename } from './table';
import { loadBrandMark } from './brand-mark';
import { BRANDING_TEXT } from './pdf';
import { downloadICSFromInstants } from './ics';
import { formatStoredDate, tournamentToday } from '../timezone';
import { clubScheduleDocument, scheduleSheets, type ScheduleDocInput } from '../club-schedule-document';

export interface ScheduleExportInput extends ScheduleDocInput {
  /** The page's "orgSlug=…" query. */
  q: string;
  orgSlug: string;
  orgName?: string;
}

/**
 * The club's letterhead for a workbook: its logo (the masthead's, top-left), our mark under everything when its
 * branding switch is on, and the house print setup. One helper for every club workbook (a permit's use, a schedule).
 */
export async function clubWorkbookBrand(q: string) {
  // org-slug-ok: `q` is the host page's "orgSlug=…" query
  const settings = await fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`);
  const branded = settings?.showBranding ?? true;
  const mark = branded ? await loadBrandMark() : null;
  return {
    settings,
    logoDataUrl: settings?.logoDataUrl ?? undefined,
    footer: branded ? { text: BRANDING_TEXT, logoDataUrl: mark ?? undefined } : undefined,
    print: { landscape: true, fitToWidth: true, pageFooter: pageFooterText(branded) },
  };
}

const fileScope = (input: ScheduleExportInput) => (input.draftLabel ? `${input.name} draft ${input.draftLabel}` : input.name);

export async function exportScheduleFile(kind: 'xlsx' | 'pdf' | 'ics', input: ScheduleExportInput): Promise<void> {
  if (kind === 'ics') {
    const placeOf = (s: ScheduleExportInput['slots'][number]) => {
      const v = input.places.find(p => p.venueId === s.venueId);
      const f = s.facilityId ? v?.facilities.find(x => x.id === s.facilityId)?.name : null;
      return [v?.venueName, f].filter(Boolean).join(' · ');
    };
    const entries = input.slots.flatMap(s => s.teamIds.map(teamId => ({
      uid: `club-slot-${s.key}-${teamId}`,
      title: `${input.teams.find(t => t.id === teamId)?.name ?? 'A team'} practice`,
      startsAtIso: s.startsAt,
      endsAtIso: s.endsAt,
      location: placeOf(s),
      description: `From ${input.name} · the club’s schedule`,
    })));
    await downloadICSFromInstants(buildFilename({ org: input.orgSlug, dataset: 'schedule', scope: input.name }, 'ics'), entries, input.name);
    return;
  }

  const brand = await clubWorkbookBrand(input.q);
  if (kind === 'pdf') {
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(brand.settings ?? {}) };
    const doc = clubScheduleDocument(input);
    await downloadPDF(
      buildFilename({ org: input.orgSlug, dataset: 'schedule', scope: fileScope(input) }, 'pdf'),
      input.name,
      doc.groups.length ? undefined : 'Nothing is handed out yet.',
      doc.headers,
      [],
      settings,
      {
        identity: input.orgName,
        // A wide grid of facilities: landscape and compact are the report's own shape (D2), never the org's preference.
        shape: { orientation: 'landscape', density: 'compact' },
        groups: doc.groups,
        notes: doc.notes.map(text => ({ text })),
      },
    );
    return;
  }

  const sheets = scheduleSheets(input);
  await downloadXLSX(buildFilename({ org: input.orgSlug, dataset: 'schedule', scope: fileScope(input) }, 'xlsx'), sheets.headers, sheets.rows, sheets.sheetName, {
    columnNumFmts: sheets.columnNumFmts,
    rowStyles: sheets.rowStyles,
    notes: sheets.notes.map(text => ({ runs: [{ text }] })),
    masthead: {
      title: [input.orgName, input.name].filter(Boolean).join(' · '),
      subtitle: `The schedule · ${sheets.subtitle}`,
      meta: `As at ${formatStoredDate(tournamentToday(), { longMonth: true })}`,
      logoDataUrl: brand.logoDataUrl,
    },
    footer: brand.footer,
    extraSheets: sheets.extraSheets,
    print: brand.print,
  });
}
