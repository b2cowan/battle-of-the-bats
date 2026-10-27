'use client';
/**
 * Leads on the screen (Support console Stage 7 Parts 3 and 5; drawings A and B). The server hands over finished rows,
 * sentences and figures; this lays them out and moves the address when a picker changes.
 *
 * The toolbar (Toolbar Rules; S7-D1–D3, D5): which list on the left — the view switch first (one white track), then, in
 * the Pipeline only, the rounded scope picker carrying the amber "Needs you" count; Search, Filter and Tools on the
 * right. Numbers has no Search (S7-D2): its period picker sits left. Tools' Export opens the one export window, Excel first.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import ViewSwitch from '@/components/coaches/kit/ViewSwitch';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { EARLY_ACCESS_PLAN_LABELS, EARLY_ACCESS_STATUS_LABELS, EARLY_ACCESS_STATUSES, LEAD_SOURCE_LABELS, LEAD_SOURCES } from '@/lib/early-access-admin';
import type { BandCell, PipelineRow, StepTone } from '@/lib/lead-views';
import type { NumbersModel } from '@/lib/lead-numbers-view';
import type { GroupRow } from '@/lib/lead-numbers';
import { errorOf, sendJson } from '../console-fetch';
import kit from '../console.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import bars from '../overview.module.css';
import styles from './early-access.module.css';

type Filters = { q: string; step: string; plan: string; source: string; tag: string; page: string };
type FilterOptions = { plans: string[]; tags: string[]; pages: string[] };

type Props =
  | { view: 'pipeline'; hasLeads: boolean; scope: 'needs' | 'all'; needCount: number; rows: PipelineRow[]; band: BandCell[];
      offersNotRead: boolean; filters: Filters; filterOptions: FilterOptions; today: string }
  | { view: 'numbers'; hasLeads: boolean; numbers: NumbersModel; readAt: string; filters: Filters; filterOptions: FilterOptions };

const TONE: Record<StepTone, string> = {
  plain: '', ok: kit.chipOk, info: kit.chipInfo, warn: kit.chipWarn, bad: kit.chipBad, quiet: kit.chipQuiet,
};

function useAddress() {
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  return (changes: Record<string, string | null>, reset = false) => {
    const p = reset ? new URLSearchParams() : new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(changes)) { if (v) p.set(k, v); else p.delete(k); }
    const qs = p.toString();
    router.push(`${path}${qs ? `?${qs}` : ''}`);
  };
}

/** The list the Copy emails and the export work on: the address's own filters. */
function listParams(f: Filters, scope: string) {
  const p = new URLSearchParams();
  p.set('scope', scope);
  for (const k of ['q', 'step', 'plan', 'source', 'tag'] as const) if (f[k]) p.set(k, f[k]);
  return p;
}

export default function LeadsScreen(props: Props) {
  const go = useAddress();
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);

  const viewSwitch = (
    <ViewSwitch label="Leads view" value={props.view}
      views={[{ id: 'pipeline', label: 'Pipeline' }, { id: 'numbers', label: 'Numbers' }]}
      onChange={v => go({ view: v === 'numbers' ? 'numbers' : null }, true)} />
  );

  async function copyEmails(f: Filters, scope: string) {
    setNotice(null);
    const { ok, data } = await sendJson(`/api/platform-admin/early-access/copy-emails?${listParams(f, scope)}`, 'POST', {});
    if (!ok) { setNotice({ text: errorOf(data, 'The addresses could not be gathered just now.'), bad: true }); return; }
    const d = data as { emails: string[] };
    if (d.emails.length === 0) { setNotice({ text: 'Nobody in this list said yes to release emails.' }); return; }
    try {
      await navigator.clipboard.writeText(d.emails.join(', '));
      setNotice({ text: `Copied ${d.emails.length} address${d.emails.length === 1 ? '' : 'es'}: the leads in this list who said yes to release emails.` });
    } catch {
      setNotice({ text: 'Your browser did not let the page copy. Try again.', bad: true });
    }
  }

  if (props.view === 'numbers') {
    const n = props.numbers;
    return (
      <>
        <div className={`${tb.toolbar} ${styles.toolbar}`}>
          {viewSwitch}
          <select className={`${kit.select} ${styles.period}`} aria-label="Period" value={n.period.key}
            onChange={e => go({ period: e.target.value === 'all' ? null : e.target.value })}>
            {n.periods.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <span className={kit.countQuiet}>Read at {props.readAt}</span>
          <span className={tb.toolbarSpacer} />
          <FilterButton kind="numbers" filters={props.filters} options={props.filterOptions} go={go} />
          <CoachToolbarMenu label="Tools" icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />} triggerClassName={tb.tool}>
            <CoachToolbarMenuItem label="Export the numbers" onSelect={() => setExporting(true)} />
          </CoachToolbarMenu>
        </div>
        {exporting && (
          <ExportWindow title="Export the numbers" sentence="Every table on this view, for this period and filter."
            href={f => `/api/platform-admin/early-access/numbers-export?${new URLSearchParams({ ...(n.period.key !== 'all' ? { period: n.period.key } : {}), ...pick(props.filters, ['plan', 'source', 'tag', 'page']), format: f })}`}
            onClose={() => setExporting(false)} />
        )}
        <NumbersBody model={n} />
      </>
    );
  }

  const p = props;
  const filterCount = ['step', 'plan', 'source', 'tag'].filter(k => p.filters[k as keyof Filters]).length;
  const empty = !p.hasLeads;
  return (
    <>
      {!empty && (
        <div className={kit.band} role="list" aria-label="Every lead, by step">
          {p.band.map(c => (
            <Link key={c.step} role="listitem" href={`/platform-admin/early-access?scope=all&step=${c.step}`}
              className={`${kit.bandCell} ${styles.bandCell}${p.filters.step === c.step ? ` ${kit.bandOn}` : ''}${c.warn ? ` ${kit.bandWarn}` : ''}`}
              aria-current={p.filters.step === c.step ? 'true' : undefined}>
              <span className={kit.bandLabel}>{c.label}</span>
              <span className={kit.bandValue}>{c.count}</span>
              {c.note && <span className={kit.bandNote}>{c.note}</span>}
            </Link>
          ))}
        </div>
      )}

      <div className={kit.card}>
        <div className={`${tb.toolbar} ${styles.toolbar}`}>
          {viewSwitch}
          {!empty && (
            <span className={styles.scope}>
              <select className={`${kit.select} ${styles.scopeSelect}`} aria-label="Which leads" value={p.scope}
                onChange={e => go({ scope: e.target.value === 'all' ? 'all' : null, step: null })}>
                <option value="needs">Needs you</option>
                <option value="all">Every lead</option>
              </select>
              {p.needCount > 0 && <span className={`${frame.count} ${styles.scopeCount}`} aria-label={`${p.needCount} need you`}>{p.needCount}</span>}
            </span>
          )}
          <span className={tb.toolbarSpacer} />
          <SearchBox value={p.filters.q} onSearch={q => go({ q: q || null })} />
          <FilterButton kind="pipeline" filters={p.filters} options={p.filterOptions} go={go} count={filterCount} />
          <CoachToolbarMenu label="Tools" icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />} triggerClassName={tb.tool}>
            <CoachToolbarMenuItem label="Copy emails" hint="Leads in this list who said yes to release emails" onSelect={() => void copyEmails(p.filters, p.scope)} />
            <CoachToolbarMenuItem label="Export" hint="Every lead in this list; Excel first, or CSV" onSelect={() => setExporting(true)} />
          </CoachToolbarMenu>
        </div>

        {notice && <div className={`${kit.notice} ${notice.bad ? kit.noticeBad : kit.noticeGood}`} role="status">{notice.text}</div>}
        {p.offersNotRead && <p className={`${kit.caption} ${styles.quietLine}`}>The sign-up match could not be checked just now, so no club is offered on this page.</p>}

        {empty ? (
          <div className={styles.empty}>
            <strong>No leads yet</strong>
            <span>A lead arrives when someone fills the early-access form on a pricing or start page, or a coach asks for more from inside the product.</span>
          </div>
        ) : (
          <PipelineTable rows={p.rows} scope={p.scope} />
        )}
      </div>

      {exporting && (
        <ExportWindow title="Export leads" sentence="Every lead in this list. A lead who asked not to be contacted has an empty email cell."
          href={f => `/api/platform-admin/early-access/export?${listParams(p.filters, p.scope)}&format=${f}`}
          onClose={() => setExporting(false)} />
      )}
    </>
  );
}

function pick(f: Filters, keys: (keyof Filters)[]): Record<string, string> {
  return Object.fromEntries(keys.filter(k => f[k]).map(k => [k, f[k]]));
}

function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <form role="search" className={styles.search} onSubmit={e => { e.preventDefault(); onSearch(text.trim()); }}>
      <input type="search" className={kit.search} placeholder="Search leads" aria-label="Search leads by name, email or organization"
        value={text} onChange={e => { setText(e.target.value); if (!e.target.value) onSearch(''); }} />
    </form>
  );
}

function FilterButton({ kind, filters, options, go, count }: {
  kind: 'pipeline' | 'numbers'; filters: Filters; options: FilterOptions; go: (c: Record<string, string | null>) => void; count?: number;
}) {
  const [open, setOpen] = useState(false);
  const n = count ?? ['plan', 'source', 'tag', 'page'].filter(k => filters[k as keyof Filters]).length;
  const field = (label: string, key: keyof Filters, opts: { value: string; label: string }[]) => (
    <label className={kit.fieldGroup}>
      <span className={kit.label}>{label}</span>
      <select className={kit.select} value={filters[key]} onChange={e => go({ [key]: e.target.value || null })}>
        <option value="">Any</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  return (
    <span className={tb.regFilterRoot}>
      <button type="button" className={tb.tool} aria-expanded={open} onClick={() => setOpen(o => !o)} data-on={n > 0 ? '' : undefined}>
        <SlidersHorizontal size={15} aria-hidden /> Filter{n > 0 ? <span className={tb.filterOn}> · {n}</span> : null}
      </button>
      {open && (
        <div className={`${tb.regFilterPanel} ${styles.filterPanel}`} role="group" aria-label="Filter leads">
          {kind === 'pipeline' && field('Step', 'step', EARLY_ACCESS_STATUSES.map(s => ({ value: s, label: EARLY_ACCESS_STATUS_LABELS[s] })))}
          {field('Plan', 'plan', [...options.plans.map(pl => ({ value: pl, label: EARLY_ACCESS_PLAN_LABELS[pl] ?? pl })), { value: 'none', label: 'None picked' }])}
          {kind === 'numbers' && options.pages.length > 0 && field('Page', 'page', options.pages.map(pg => ({ value: pg, label: pg })))}
          {field('Source', 'source', [{ value: 'not_set', label: 'Not set' }, ...LEAD_SOURCES.map(s => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))])}
          {options.tags.length > 0 && field('Link tag', 'tag', options.tags.map(t => ({ value: t, label: t })))}
          {n > 0 && (
            <button type="button" className={kit.door} onClick={() => { go({ step: null, plan: null, source: null, tag: null, page: null }); setOpen(false); }}>
              Clear the filter
            </button>
          )}
        </div>
      )}
    </span>
  );
}

function ExportWindow({ title, sentence, href, onClose }: { title: string; sentence: string; href: (format: 'xlsx' | 'csv') => string; onClose: () => void }) {
  return (
    <KitDialog kind="question" title={title} onClose={onClose}
      footer={(
        <>
          <a className="btn btn-outline" href={href('csv')} download onClick={onClose}>CSV</a>
          <a className="btn btn-primary" href={href('xlsx')} download onClick={onClose}>Excel</a>
        </>
      )}>
      <p>{sentence} Every export is kept in the audit log: who, when and how many.</p>
    </KitDialog>
  );
}

function PipelineTable({ rows, scope }: { rows: PipelineRow[]; scope: 'needs' | 'all' }) {
  return (
    <div className={`${kit.tableWrap} table-cards`}>
      <table>
        <thead>
          <tr>
            <th>Lead</th><th>Interest</th><th>Step</th><th>Next action</th><th>Follow-up</th><th>Source</th><th>Arrived</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody className={kit.comfortable}>
          {rows.length === 0 && (
            <tr><td colSpan={8} className={kit.empty}>{scope === 'needs' ? 'Nothing needs you. Every lead has been answered and none is due.' : 'No leads match.'}</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className="table-cards-title">
                <Link href={`/platform-admin/early-access/${r.id}`} className={kit.nameLink}>{r.title}</Link>
                <span className={kit.sub}>{r.person}</span>
                {r.toConfirm && <span className={`${kit.chip} ${kit.chipWarn} ${styles.flag}`}>Sign-up to confirm</span>}
              </td>
              <td data-label="Interest">{r.interest}{r.interestSub && <span className={kit.sub}>{r.interestSub}</span>}</td>
              <td data-label="Step">
                <span className={`${kit.chip} ${TONE[r.tone]}`}>{r.step}</span>
                {r.stepLine && <span className={`${kit.sub}${r.stuck ? ` ${styles.stuck}` : ''}`}>{r.stepLine}</span>}
              </td>
              <td data-label="Next action" className={r.nextAction ? undefined : kit.muted}>{r.nextAction ?? 'None yet'}</td>
              <td data-label="Follow-up" className={`${kit.nowrap}${r.followUp?.due ? ` ${styles.due}` : r.followUp ? '' : ` ${kit.muted}`}`}>{r.followUp?.text ?? 'None'}</td>
              <td data-label="Source" className={r.sourceSet ? undefined : kit.muted}>{r.source}</td>
              <td data-label="Arrived" className={kit.nowrap}>{r.arrived}</td>
              <td className={kit.rowDoor}>
                <Link href={`/platform-admin/early-access/${r.id}`} className={kit.rowDoorLink} tabIndex={-1} aria-hidden>›</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumbersBody({ model }: { model: NumbersModel }) {
  const n = model.numbers;
  const cell = (label: string, value: ReactNode, note: ReactNode) => (
    <div className={kit.bandCell}>
      <span className={kit.bandLabel}>{label}</span>
      <span className={kit.bandValue}>{value}</span>
      <span className={kit.bandNote}>{note}</span>
    </div>
  );
  const maxMonth = Math.max(1, ...n.byMonth.map(m => m.arrived));
  return (
    <>
      <div className={kit.band}>
        {cell('Leads arrived', n.arrived, model.rangeLine)}
        {cell('Signed up', n.signedUp, n.signedUpRate === null ? '—' : `${n.signedUpRate}% of the leads`)}
        {cell('Pay now', n.payNow ?? 'Not read', n.payNow === null ? 'The billing records could not be read' : `of the ${n.signedUp} who signed up`)}
        {cell('Time to sign up', n.timeToSignUp ? `${n.timeToSignUp.middle} days` : '—',
          n.timeToSignUp ? `the middle lead; quickest ${n.timeToSignUp.quickest}, slowest ${n.timeToSignUp.slowest}` : 'nobody has signed up yet')}
        {cell('New accounts', n.newAccounts ? n.newAccounts.total : 'Not read',
          n.newAccounts ? `${n.newAccounts.withoutLead} came without a lead` : 'The accounts could not be read')}
      </div>

      <GroupTable title="By the page they arrived from" first="Page" rows={n.byPage} days />
      <GroupTable title="By the plan they wanted" lede="A lead may pick two" first="Plan" rows={n.byPlan} days />
      <GroupTable title="By source" lede="Recorded by staff" first="Source" rows={n.bySource} />
      {n.byTag.length > 0 && <GroupTable title="By link tag" first="Link tag" rows={n.byTag} />}

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Month by month <span className={kit.sectionLede}>By the month a lead arrived</span></h2>
        <div className={`${kit.card} ${kit.cardPad}`}>
          {n.byMonth.length === 0 ? <p className={kit.muted}>No leads in this period.</p> : (
            <div className={bars.barList}>
              {n.byMonth.map(m => (
                <div key={m.month} className={bars.barRow}>
                  <div className={bars.barMeta}><span>{monthWords(m.month)}</span><strong>{m.arrived} arrived · {m.signedUp} signed up so far</strong></div>
                  <div className={bars.barTrack}><span className={bars.barFill} style={{ width: `${Math.max(3, Math.round((m.arrived / maxMonth) * 100))}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <p className={`${kit.caption} ${styles.quietLine}`}>{model.payingFrom}</p>
        </div>
      </section>

      <section className={kit.section}>
        <dl className={`${kit.card} ${kit.cardPad} ${styles.definitions}`}>
          {model.definitions.map(d => (
            <div key={d.term}><dt>{d.term}</dt><dd>{d.text}</dd></div>
          ))}
        </dl>
      </section>
    </>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthWords(ym: string) {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

function GroupTable({ title, lede, first, rows, days = false }: { title: string; lede?: string; first: string; rows: GroupRow[]; days?: boolean }) {
  return (
    <section className={kit.section}>
      <h2 className={kit.sectionTitle}>{title}{lede && <span className={kit.sectionLede}> {lede}</span>}</h2>
      <div className={`${kit.card} ${kit.tableWrap}`}>
        <table>
          <thead>
            <tr><th>{first}</th><th className={kit.num}>Leads</th><th className={kit.num}>Signed up</th><th className={kit.num}>Rate</th><th className={kit.num}>Pay now</th>{days && <th className={kit.num}>Days</th>}</tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className={kit.num} data-label="Leads">{r.leads}</td>
                <td className={kit.num} data-label="Signed up">{r.signedUp}</td>
                <td className={kit.num} data-label="Rate">{r.rate === null ? '—' : `${r.rate}%`}</td>
                <td className={kit.num} data-label="Pay now">{r.payNow ?? 'Not read'}</td>
                {days && <td className={kit.num} data-label="Days">{r.days ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
