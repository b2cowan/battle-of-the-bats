'use client';
/**
 * RULES & RESOURCES — Tournament admin redesign Stage 5 (E6, A50, A54; F30, F31), built to hub v45, ruled as drawn
 * 2026-10-10.
 *
 *   two cards   Rules ("As families read them on the public site": a row per section, then Start from a sample) and
 *               Resources & downloads (a row per link or file, then its own Start from a sample — each card's samples
 *               are its own kind, owner 2026-10-12). Each card's add is its head's button: + on a phone,
 *               worded at a desk. An empty card says one sentence (no blank area, no dashed box).
 *   a row       opens its record (RuleSectionRecord / ResourceRecord): reads first, the pencil edits all of it, which
 *               saves itself; Delete ends it and asks. Adding asks (the same window's Save). A section's row leads with
 *               the icon families see beside it (owner, 2026-10-12).
 *   order       the portal's reorder standard (ReorderList, owner 2026-10-12 — superseding A54's Reorder mode): each
 *               row's handle drags (hold it on a phone), a tap on it offers Move up · Move down · Cancel; each move
 *               saves. Each card's Layout menu holds its own public layout — one column or two for rules, a list or
 *               two columns for resources — beside its add, absent while the card is empty (owner, 2026-10-12: one
 *               Tools on the Rules card held both cards' layouts, and nothing else).
 *   saving      every write reports its failure — the record's pill, or this page's for an order or a layout. No
 *               browser alert, no leave dialog, no patched browser Back (there is nothing unsaved to protect).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { ClubRow, ClubRowList, ClubSection, LoadFailed, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import { arrayMove } from '@dnd-kit/sortable';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import { createRuleSection, getResources, getRules, saveResource, saveResourceOrder, saveRuleOrder } from '@/lib/db';
import { ORDER_WORDS, RULES_WORDS as W, resourceCaption, sectionCaption } from '@/lib/tournament-settings-words';
import { RuleIcon } from '@/lib/rule-icons';
import type { Resource, RuleSection, Tournament } from '@/lib/types';
import RuleSectionRecord, { namesFor, type RuleDivision } from './RuleSectionRecord';
import ResourceRecord, { isResourceFile } from './ResourceRecord';
import SamplesWindow from './SamplesWindow';
import type { SampleResource, SampleSection } from './rules-samples';
import styles from './rules.module.css';
import LoadingState from '@/components/shared/LoadingState';

/** Rules & resources' "?" (A56): its own help sub-topic. */
const RULES_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['venues-contacts-rules'], subtopicId: 'rules-records' };

export default function RulesAdmin({ tournament, orgSlug }: { tournament: Tournament; orgSlug?: string }) {
  const [rules, setRules] = useState<RuleSection[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [divisions, setDivisions] = useState<RuleDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<string | null>(null);
  /** Which card's samples are open: each card has its own Start from a sample. */
  const [samplesFor, setSamplesFor] = useState<'sections' | 'links' | null>(null);
  const [rulesLayout, setRulesLayout] = useState<'columns' | 'single'>(tournament.settings?.rulesLayout ?? 'columns');
  const [resourcesLayout, setResourcesLayout] = useState<'list' | 'grid'>(tournament.settings?.resourcesLayout ?? 'list');

  /** Re-reads both lists and the divisions; false when they didn't load. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const [r, res, divRes] = await Promise.all([
        getRules(tournament.id, { strict: true }),
        getResources(tournament.id, { strict: true }),
        fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournament.id)}${orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : ''}`, { cache: 'no-store' }),
      ]);
      // A failed read says so: never "every division" or "No rules yet" over what exists.
      const divs = divRes.ok ? await divRes.json().catch(() => null) as Array<{ id: string; name: string }> | null : null;
      if (!Array.isArray(divs)) throw new Error('divisions');
      setRules(r);
      setResources(res);
      setDivisions(divs.map(d => ({ id: d.id, name: d.name })));
      setLoadError(false);
      return true;
    } catch {
      setLoadError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tournament.id, orgSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own rules
    setLoading(true);
    setOpenSection(null);
    setOpenResource(null);
    void refresh();
  }, [refresh]);

  // ── The page's own saves (an order, a layout): one at a time, the floating pill says each, Retry replays the last ──
  const { saving: pageSaving, error: pageError, run: runPageSave, retry: retryPageSave } = useSaveQueue();

  function moveSection(from: number, to: number) {
    const next = arrayMove(rules, from, to);
    setRules(next);
    void runPageSave(() => saveRuleOrder(next.map(s => s.id)), ORDER_WORDS.saveFailed);
  }
  function moveResource(from: number, to: number) {
    const next = arrayMove(resources, from, to);
    setResources(next);
    void runPageSave(() => saveResourceOrder(next.map(r => r.id)), ORDER_WORDS.saveFailed);
  }
  function chooseLayout(key: 'rulesLayout' | 'resourcesLayout', value: string) {
    if (key === 'rulesLayout') setRulesLayout(value as 'columns' | 'single');
    else setResourcesLayout(value as 'list' | 'grid');
    void runPageSave(async () => {
      const res = await fetch(`/api/admin/tournaments${orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'patch-settings', id: tournament.id, data: { settings: { [key]: value } } }),
      });
      if (!res.ok) throw new Error('layout');
    }, W.layoutFailed);
  }

  // ── Samples: add as today, each failure said in the window ──
  async function addSampleSection(sample: SampleSection) {
    await createRuleSection(tournament.id, nextRuleOrder, { title: sample.title, icon: sample.icon, divisionIds: null, items: sample.items });
    await refresh();
  }
  async function addSampleResource(sample: SampleResource) {
    await saveResource({ tournamentId: tournament.id, label: sample.label, url: sample.url || '#', order: nextResourceOrder });
    await refresh();
  }

  const sectionNames = (s: RuleSection) => namesFor(s.divisionIds, divisions);
  // A new row goes after the last one (never the list's length, which collides once rows were moved or deleted).
  const nextRuleOrder = rules.reduce((m, s) => Math.max(m, (s.order ?? 0) + 1), 0);
  const nextResourceOrder = resources.reduce((m, r) => Math.max(m, (r.order ?? 0) + 1), 0);
  const sIdx = openSection && openSection !== 'new' ? rules.findIndex(s => s.id === openSection) : -1;
  const rIdx = openResource && openResource !== 'new' ? resources.findIndex(r => r.id === openResource) : -1;

  // A desk reads "Layout"; a phone the ⋯ (the word and chevron go at ≤640). Its name says whose layout it is, since
  // both cards carry one.
  const layoutMenu = (name: string, choices: ReactNode) => (
    <CoachToolbarMenu
      label={name}
      collapseOnPhone
      bareOnPhone
      drawerOnPhone
      drawerTitle={name}
      triggerClassName={`${tb.tool} ${styles.tool}`}
      triggerContent={<>
        <MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />
        <span className={shared.headerBtnLabel}>{W.layout}</span>
        <ChevronDown size={14} aria-hidden />
      </>}
    >
      <CoachToolbarMenuHeading>{W.onPublicSite}</CoachToolbarMenuHeading>
      {choices}
    </CoachToolbarMenu>
  );
  const rulesLayoutMenu = layoutMenu(W.rulesLayout, <>
    <CoachToolbarMenuItem label={W.oneColumn} checked={rulesLayout === 'single'} onSelect={() => chooseLayout('rulesLayout', 'single')} />
    <CoachToolbarMenuItem label={W.twoColumns} checked={rulesLayout === 'columns'} onSelect={() => chooseLayout('rulesLayout', 'columns')} />
  </>);
  const resourcesLayoutMenu = layoutMenu(W.resourcesLayout, <>
    <CoachToolbarMenuItem label={W.aList} checked={resourcesLayout === 'list'} onSelect={() => chooseLayout('resourcesLayout', 'list')} />
    <CoachToolbarMenuItem label={W.twoColumns} checked={resourcesLayout === 'grid'} onSelect={() => chooseLayout('resourcesLayout', 'grid')} />
  </>);
  const addButton = (label: string, onClick: () => void) => (
    <button type="button" className={`btn btn-outline btn-data ${screenParts.headerButton}`} onClick={onClick}
      aria-label={label} title={label} aria-haspopup="dialog">
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{label}</span>
    </button>
  );
  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={W.title}
        inlineActions
        actions={<HelpButton help={RULES_HELP} label={W.title} iconOnly />}
      />

      {loadError && rules.length === 0 && resources.length === 0 ? (
        <LoadFailed title={W.loadFailed} onRetry={() => { setLoading(true); void refresh(); }} />
      ) : loading ? (
        <LoadingState label="Loading the rules…" />
      ) : (
        <>
          <ClubSection
            id="rules"
            list
            className={styles.headCard}
            title={<>{W.rules}<span className={styles.headCaption}>{W.rulesCaption}</span></>}
            actions={<>{rules.length > 0 && rulesLayoutMenu}{addButton(W.addSection, () => setOpenSection('new'))}</>}
          >
            {rules.length === 0 && <p className={styles.cardEmpty}>{W.noRules}</p>}
            <ClubRowList inset label={W.rules}>
              <ReorderList ids={rules.map(s => s.id)} names={rules.map(s => s.title)} onMove={moveSection} disabled={pageSaving}>
                {rules.map(s => (
                  <ReorderRow key={s.id} id={s.id}>
                    {({ handle, itemRef, itemStyle }) => (
                      <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenSection(s.id)} chevron
                        mark={<RuleIcon name={s.icon} size={18} className={styles.iconMark} aria-hidden />}
                        title={s.title} caption={sectionCaption(s.items.length, sectionNames(s))}
                        grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
                    )}
                  </ReorderRow>
                ))}
              </ReorderList>
              <ClubRow as="button" aria-haspopup="dialog" onClick={() => setSamplesFor('sections')} chevron
                title={W.sample} caption={W.sampleCaption} />
            </ClubRowList>
          </ClubSection>

          <ClubSection
            id="resources"
            list
            className={styles.headCard}
            title={W.resources}
            actions={<>{resources.length > 0 && resourcesLayoutMenu}{addButton(W.addResource, () => setOpenResource('new'))}</>}
          >
            {resources.length === 0 && <p className={styles.cardEmpty}>{W.noResources}</p>}
            <ClubRowList inset label={W.resources}>
              <ReorderList ids={resources.map(r => r.id)} names={resources.map(r => r.label)} onMove={moveResource} disabled={pageSaving}>
                {resources.map(r => (
                  <ReorderRow key={r.id} id={r.id}>
                    {({ handle, itemRef, itemStyle }) => (
                      <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenResource(r.id)} chevron
                        title={r.label} caption={resourceCaption(r.url, isResourceFile(r.url))}
                        grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
                    )}
                  </ReorderRow>
                ))}
              </ReorderList>
              <ClubRow as="button" aria-haspopup="dialog" onClick={() => setSamplesFor('links')} chevron
                title={W.sample} caption={W.linkSampleCaption} />
            </ClubRowList>
          </ClubSection>
        </>
      )}

      <SavePill
        saving={pageSaving}
        dirty={false}
        error={pageError}
        onRetry={retryPageSave}
      />

      {openSection && (openSection === 'new' || sIdx >= 0) && (
        <RuleSectionRecord
          section={openSection === 'new' ? null : rules[sIdx]}
          tournamentId={tournament.id}
          divisions={divisions}
          canWrite
          order={nextRuleOrder}
          prev={sIdx > 0 ? { id: rules[sIdx - 1].id, name: rules[sIdx - 1].title } : null}
          next={sIdx >= 0 && sIdx < rules.length - 1 ? { id: rules[sIdx + 1].id, name: rules[sIdx + 1].title } : null}
          position={`${sIdx + 1} of ${rules.length}`}
          onStep={setOpenSection}
          onClose={() => setOpenSection(null)}
          onChanged={refresh}
        />
      )}

      {openResource && (openResource === 'new' || rIdx >= 0) && (
        <ResourceRecord
          resource={openResource === 'new' ? null : resources[rIdx]}
          tournamentId={tournament.id}
          canWrite
          order={nextResourceOrder}
          prev={rIdx > 0 ? { id: resources[rIdx - 1].id, name: resources[rIdx - 1].label } : null}
          next={rIdx >= 0 && rIdx < resources.length - 1 ? { id: resources[rIdx + 1].id, name: resources[rIdx + 1].label } : null}
          position={`${rIdx + 1} of ${resources.length}`}
          onStep={setOpenResource}
          onClose={() => setOpenResource(null)}
          onChanged={refresh}
        />
      )}

      {samplesFor === 'sections' && <SamplesWindow kind="sections" onAdd={addSampleSection} onClose={() => setSamplesFor(null)} />}
      {samplesFor === 'links' && <SamplesWindow kind="links" onAdd={addSampleResource} onClose={() => setSamplesFor(null)} />}
    </div>
  );
}
