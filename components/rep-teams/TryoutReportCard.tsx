'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileChartColumn, ChevronDown, ArrowRight, Lock, FileText, FileSpreadsheet } from 'lucide-react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import CategoryBars from '@/components/coaches/CategoryBars';
import { useOrg } from '@/lib/org-context';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import {
  downloadXLSX, buildFilename, downloadPDF, downloadTryoutBoardSummary, abbreviateHeadings,
  fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { fairnessReceiptLines, type TryoutReport } from '@/lib/tryout-report';
import day from './TryoutDayCard.module.css';
import styles from './TryoutReportCard.module.css';

/**
 * The Tryout Report — Build-your-team stage (Tryout Insights Phase 1; mockups v1 frames 01–03).
 * Aggregates only on screen; the fairness receipt states nothing the data can't prove; the
 * full-detail export sits behind an explicit confirm (R1) and cannot exist while blind (R6) —
 * the server withholds candidateRows until names are revealed, this component only mirrors that.
 */

interface ReportPayload {
  seasonName: string;
  teamName: string;
  rosterNames: string[];
  report: TryoutReport;
}

interface Props {
  /** `/api/coaches/{orgSlug}/teams/{teamId}/tryout-report` */
  apiBase: string;
  orgSlug: string;
  teamId: string;
  rosterHref: string;
  /** True while the Build tab is the visible panel — triggers a refresh so decisions just made show up. */
  active: boolean;
  onError?: (msg: string) => void;
}

export default function TryoutReportCard({ apiBase, orgSlug, teamId, rosterHref, active, onError }: Props) {
  const confirm = useConfirm();
  const { currentOrg } = useOrg();
  const [data, setData] = useState<ReportPayload | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissable(menuOpen, rootRef, () => setMenuOpen(false));
  const menuStyle = useAnchoredMenu(menuOpen, rootRef, menuRef, { minWidth: 260, narrowMinWidth: 200, align: 'end' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return; // quiet — the Build tab keeps its intro; errors here should not block the stage
      setData(await res.json());
    } catch { /* non-blocking */ }
  }, [apiBase]);

  // Load only when the Build tab is (or becomes) the visible panel — the hub keeps every stage
  // mounted, so this both avoids a wasted fetch and refreshes after decisions made on Decide.
  useEffect(() => { if (active) load(); }, [active, load]);

  const loadPdfSettings = useCallback(async (): Promise<OrgPdfSettings> => {
    // Team-resolved (D4): team look → club look → defaults, team name as the identity.
    // Fetched PER EXPORT, deliberately uncached: an export is a click, one small GET is
    // nothing — and this hub stays mounted for a whole session, so a cached copy would keep
    // printing a look the coach has since changed in "How your documents look".
    const fetched = await fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`);
    return { ...DEFAULT_PDF_SETTINGS, ...(fetched ?? {}) };
  }, [orgSlug, teamId]);

  if (!data) return null;
  const { report } = data;

  if (!report.hasAnything) {
    return (
      <p className={styles.empty}>
        Once you accept players from the decision board, they land on your{' '}
        <a href={rosterHref} className={styles.inlineLink}>team roster</a> with their fees already
        set — so lineups, attendance, dues and announcements all work from day one, with no name re-typed.
      </p>
    );
  }

  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : true;
  const pdfGateCopy = canUsePDF ? '' : requiresPlanCopy('pdf_exports');
  const blind = report.candidateRows === null;

  const f = report.funnel;
  const denom = Math.max(1, f.registered);
  const funnelRows: { label: string; value: number; caption?: string }[] = [
    { label: 'Registered', value: f.registered },
    {
      label: 'Attended', value: f.attended,
      caption: f.neverCheckedIn > 0 ? `${f.neverCheckedIn} never checked in` : undefined,
    },
    { label: 'Evaluated', value: f.evaluated },
    // ⚠ "Offers extended", not "Offered" — a deliberate mockup deviation (frame 01 says "Offered")
    // recorded /review 2026-08-03. Since Phase 2's sticky stamp this row counts offers EVER made,
    // while the decision board one tab away tallies who is offered RIGHT NOW. Both are correct and
    // both are wanted, but under one word they read as the same number disagreeing with itself —
    // which is what a coach who rescinded an offer would have seen.
    { label: 'Offers extended', value: f.offered },
    {
      label: 'Accepted', value: f.accepted,
      caption: [
        f.familyDeclined > 0 ? `${f.familyDeclined} declined by family` : null,
        f.offerExpired > 0 ? `${f.offerExpired} offer${f.offerExpired === 1 ? '' : 's'} expired` : null,
        f.awaitingReply > 0 ? `${f.awaitingReply} awaiting reply` : null,
      ].filter(Boolean).join(' · ') || undefined,
    },
    { label: 'On roster', value: f.rostered },
  ];

  const profile = report.profile;
  const scoredAvgs = profile ? profile.categories.filter(c => c.avg != null) : [];
  const minAvg = scoredAvgs.length >= 2 ? Math.min(...scoredAvgs.map(c => c.avg!)) : null;
  const thinnest = minAvg != null ? profile!.categories.filter(c => c.avg === minAvg) : [];

  const turnoutDelta = report.turnout.prior != null ? report.turnout.count - report.turnout.prior : null;

  async function runExport(action: () => Promise<void>) {
    setMenuOpen(false);
    setExporting(true);
    try { await action(); }
    catch { onError?.('Export failed. Please try again.'); }
    finally { setExporting(false); }
  }

  function exportBoardSummary() {
    return runExport(async () => {
      if (!data) return;
      const settings = await loadPdfSettings();
      await downloadTryoutBoardSummary(
        buildFilename({ org: data.teamName, dataset: 'tryout-report', scope: 'board-summary' }, 'pdf'),
        {
          // D1: team paper — same identity contract as the table engine.
          identity: data.teamName,
          seasonName: data.seasonName,
          finalized: report.finalized,
          stats: {
            candidates: report.turnout.count,
            prior: report.turnout.prior,
            priorSeasonName: report.turnout.priorSeasonName,
            offers: f.offered,
            accepted: f.accepted,
            rosterTotal: report.composition?.rosterTotal ?? null,
            returning: report.composition?.returning ?? null,
            newcomers: report.composition?.newcomers ?? null,
          },
          processLines: report.fairness ? fairnessReceiptLines(report.fairness) : [],
          profile: profile ? profile.categories.map(c => ({ label: c.label, avg: c.avg })) : null,
          scaleMax: profile?.scaleMax ?? null,
          rosterNames: data.rosterNames,
          settings,
        },
      );
    });
  }

  /** Full detail (R1): explicit confirm naming the consequence, then names × scores × decisions. */
  async function exportFullDetail(format: 'pdf' | 'xlsx') {
    if (!data || !report.candidateRows) return;
    const ok = await confirm({
      title: 'Export full detail?',
      message: "This file lists every candidate by name with their scores and your decisions — including players who didn't make the team. It's for coaching staff only. The board summary is the version to share.",
      confirmText: 'Export full detail',
      tone: 'warning',
    });
    if (!ok) return;
    const rows = report.candidateRows;
    const catCols = profile ? profile.categories : [];
    // Headers, body and drop priorities are all built from FIXED_LEAD + catCols in that one
    // order, so nothing can disagree about which index is which — including the PDF's
    // shortened headings below, which are the same columns wearing shorter names.
    // The full ladder is declared — rubric categories yield rightmost-first, then Evaluators,
    // Composite, Bib — so Player and Decision are the last columns standing on ANY paper
    // (without this, the engine's last-first default would take Decision, the one column the
    // whole report exists to record, first).
    const FIXED_LEAD = ['Player', 'Bib', 'Composite', 'Evaluators'];
    const headers = [...FIXED_LEAD, ...catCols.map(c => c.label), 'Decision'];
    const rubricDropOrder = [
      ...catCols.map((_, i) => FIXED_LEAD.length + i).reverse(),
      3, // Evaluators
      2, // Composite
      1, // Bib
    ];
    const body = rows.map(r => [
      r.name,
      r.bib ?? '',
      r.composite != null ? r.composite : '',
      r.evaluatorCount,
      ...catCols.map(c => r.categoryAverages[c.key] ?? ''),
      r.decision,
    ]);
    const filename = buildFilename({ org: data.teamName, dataset: 'tryout-report', scope: 'full-detail' }, format);
    await runExport(async () => {
      if (format === 'xlsx') {
        await downloadXLSX(filename, headers, body, 'Tryout report');
      } else {
        const settings = await loadPdfSettings();
        /* The PDF's column diet (owner's pick from rendered options, Phase 2 Registers pass).
           Two moves, and neither touches the spreadsheet above — a coach opening the xlsx gets
           the club's own category names, in full, as they always did.

           1. HEADINGS SHORTEN TO CODES with a legend under the title, because the columns after
              Player are the customer's words and a club running ten categories used to lose
              three of them to the fit contract. Codes keep all ten on the page.
           2. THE ROWS PRINT COMPACT — the density the tournament schedule already declares.
              Full-width rows spent 12mm of padding on a two-character score, wrapped every
              candidate's name onto two lines, and put eight candidates on a page. Compact puts
              twenty on a page and holds every name on one line.

           `Decision` is never abbreviated: it is the column this report exists to record. */
        const { codes, legend } = abbreviateHeadings([...FIXED_LEAD.slice(2), ...catCols.map(c => c.label)]);
        const pdfHeaders = [...FIXED_LEAD.slice(0, 2), ...codes, 'Decision'];
        await downloadPDF(
          filename,
          'Tryout report — full detail',
          // D1: the header carries the team's name; the subtitle keeps season + audience,
          // and now the legend — which is why the engine wraps a subtitle rather than
          // running it off the edge of the paper.
          `${data.seasonName}  ·  Coaching staff only${legend ? `\n${legend}` : ''}`,
          pdfHeaders, body, settings,
          {
            identity: data.teamName,
            shape: { orientation: 'landscape', density: 'compact' },
            fit: { dropOrder: rubricDropOrder },
          },
        );
      }
    });
  }

  return (
    <div className={day.card}>
      <div className={day.head}>
        <h3 className={day.title}><FileChartColumn size={16} /> Tryout report</h3>
        <div className={styles.headActions}>
          {report.finalized ? (
            <span className={styles.finalChip}>✓ Final — every candidate has a decision</span>
          ) : (
            <span className={styles.liveChip}>● Live — updates as you decide</span>
          )}
          <div className={styles.menuWrap} ref={rootRef}>
            <button
              type="button" className={styles.exportBtn}
              onClick={() => setMenuOpen(o => !o)}
              disabled={exporting}
              aria-haspopup="menu" aria-expanded={menuOpen}
            >
              {exporting ? 'Exporting…' : 'Export'} <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div ref={menuRef} className={styles.menu} style={menuStyle} role="menu" aria-label="Export the tryout report">
                <button
                  role="menuitem" className={styles.menuItem}
                  onClick={exportBoardSummary}
                  disabled={!canUsePDF}
                  title={canUsePDF ? undefined : pdfGateCopy}
                >
                  {!canUsePDF && <Lock size={12} aria-hidden />}<FileText size={14} aria-hidden />
                  <span><span className={styles.menuLabel}>Board summary (PDF)</span>
                  <span className={styles.menuHint}>{canUsePDF ? 'Aggregates and roster only — safe to share' : pdfGateCopy}</span></span>
                </button>
                <button
                  role="menuitem" className={styles.menuItem}
                  onClick={() => exportFullDetail('pdf')}
                  disabled={blind || !canUsePDF}
                  title={!canUsePDF ? pdfGateCopy : blind ? 'Reveal names first — full detail can’t exist while evaluation is blind' : undefined}
                >
                  {!canUsePDF && <Lock size={12} aria-hidden />}<FileText size={14} aria-hidden />
                  <span><span className={styles.menuLabel}>Full detail (PDF)</span>
                  <span className={styles.menuHint}>{blind ? 'Reveal names first' : 'Every candidate, score and decision — staff only'}</span></span>
                </button>
                <button
                  role="menuitem" className={styles.menuItem}
                  onClick={() => exportFullDetail('xlsx')}
                  disabled={blind}
                  title={blind ? 'Reveal names first — full detail can’t exist while evaluation is blind' : undefined}
                >
                  <FileSpreadsheet size={14} aria-hidden />
                  <span><span className={styles.menuLabel}>Full detail (Excel)</span>
                  <span className={styles.menuHint}>{blind ? 'Reveal names first' : 'Same data as the PDF, for your own analysis'}</span></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* From signup to roster */}
      <div className={styles.sectionLabel}>From signup to roster</div>
      <div className={styles.funnel}>
        {funnelRows.map(row => (
          <div key={row.label} className={styles.funnelRowWrap}>
            <div className={styles.funnelRow}>
              <span className={styles.funnelLabel}>{row.label}</span>
              <span className={styles.funnelTrack}>
                {/* Clamped: the roster row counts roster truth, which historic data can push past
                    the registered denominator — a bar must never overflow its track. */}
                <span className={styles.funnelBar} style={{ width: `${Math.min(100, (row.value / denom) * 100)}%` }} />
              </span>
              <span className={styles.funnelValue}>{row.value}</span>
            </div>
            {row.caption && <div className={styles.funnelCaption}>{row.caption}</div>}
          </div>
        ))}
      </div>

      {/* Turnout */}
      <div className={styles.sectionLabel}>Turnout</div>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{report.turnout.count}</span>
          <span className={styles.statLabel}>candidates</span>
        </div>
        <div className={styles.stat}>
          {turnoutDelta == null ? (
            <>
              <span className={styles.statNum}>—</span>
              <span className={styles.statLabel}>first recorded tryout</span>
            </>
          ) : (
            <>
              <span className={`${styles.statNum} ${turnoutDelta > 0 ? styles.statUp : turnoutDelta < 0 ? styles.statDown : ''}`}>
                {turnoutDelta > 0 ? `▲ +${turnoutDelta}` : turnoutDelta < 0 ? `▼ ${turnoutDelta}` : 'level'}
              </span>
              <span className={styles.statLabel}>vs {report.turnout.priorSeasonName ?? 'last season'}</span>
            </>
          )}
        </div>
        {report.composition && (
          <>
            <div className={styles.stat}>
              <span className={styles.statNum}>{report.composition.returning}</span>
              <span className={styles.statLabel}>returning</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{report.composition.rosterTotal}</span>
              <span className={styles.statLabel}>
                on the roster{report.composition.fromTryout === report.composition.rosterTotal
                  ? ' · all via tryout'
                  : ` · ${report.composition.fromTryout} via tryout`}
              </span>
            </div>
          </>
        )}
      </div>
      {/* C4 — returning-candidate improvement. The server emits this only at three or more
          comparable pairs and only once names are revealed; below that the line does not exist,
          because an average built from one or two players is an anecdote wearing a number. */}
      {report.returningImprovement && (
        <p className={styles.returningLine}>{report.returningImprovement.line}</p>
      )}

      {/* Class strength profile */}
      {profile && (
        <>
          <div className={styles.sectionLabel}>Where this class is strong — and thin</div>
          {/* The bars are the shared CategoryBars widget (extracted /simplify 2026-08-02, when the
              per-player snapshot became a second hand-copy of them). What "thin" MEANS stays here:
              on the report it is the class's weakest category, not a fixed threshold. */}
          <CategoryBars
            scaleMax={profile.scaleMax}
            rows={profile.categories.map(cat => ({ ...cat, thin: thinnest.some(t => t.key === cat.key) }))}
          />
          {thinnest.length > 0 && (
            <p className={styles.catFlag}>
              {thinnest.map(t => t.label).join(' and ')} — thinnest area of the incoming class, a head start for practice planning.
            </p>
          )}
        </>
      )}

      {/* Fairness receipt */}
      {report.fairness && (
        <>
          <div className={styles.sectionLabel}>How the evaluation was run</div>
          <div className={styles.receipt}>
            <p className={styles.receiptTitle}>Fairness receipt</p>
            <ul className={styles.receiptList}>
              {fairnessReceiptLines(report.fairness).map(line => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </>
      )}

      {f.rostered > 0 && (
        <a className={styles.rosterLink} href={rosterHref}>View your team roster <ArrowRight size={15} /></a>
      )}
    </div>
  );
}
