import { notFound, redirect } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readOffers, readPaying, type OfferedClub } from '@/lib/lead-book';
import { leadTimeline } from '@/lib/lead-timeline';
import { featureWords, lostWords, offerSentence, planWords, sourceWords, stepTone } from '@/lib/lead-views';
import { heardFromLabel, linkTagLabel, sourceFromHeard } from '@/lib/lead-form-answers';
import { clubPredatesLead, daysToSignUp } from '@/lib/lead-numbers';
import { consoleDay } from '@/lib/console-dates';
import { daysBetweenDateStrings, orgDayKey, tournamentToday } from '@/lib/timezone';
import { EARLY_ACCESS_STATUS_LABELS, isEarlyAccessStatus, leadPageLabel, type EarlyAccessStatus } from '@/lib/early-access-admin';
import { planName } from '@/lib/platform-story-view';
import { isUuid } from '@/lib/utils';
import kit from '../../console.module.css';
import LeadRecord, { type LeadRecordProps } from './LeadRecord';

/**
 * A lead's own page (Support console Stage 7 Part 4; drawings A and C). It reads first and edits whole: the pencil
 * flips every field staff own at once, and the check mark saves at once (owner Q6: no reason, no confirm window). The
 * growth power is asked before the lead is read. Every sentence is built here; the client lays them out.
 */
export const metadata = { title: 'Lead — Support console' };

type LeadRow = {
  id: string; created_at: string; last_submitted_at: string | null; submission_count: number; internal_status: string;
  name: string; email: string; organization_name: string | null; role: string | null; sports: string | null;
  plan_interest: string[] | null; features_interested: string[] | null; notes: string | null; source_path: string | null;
  release_notifications_consent: boolean; last_contacted_at: string | null; last_contacted_by: string | null;
  converted_org_id: string | null; follow_up_due_at: string | null; next_action: string | null; source: string | null;
  source_words: string | null; lost_reason: string | null; link_method: string | null; linked_by: string | null;
  linked_at: string | null; signed_up_at: string | null; heard_from: string | null; ref_tag: string | null;
  do_not_contact_at: string | null;
};

const COLUMNS = 'id, created_at, last_submitted_at, submission_count, internal_status, name, email, organization_name, role, sports, '
  + 'plan_interest, features_interested, notes, source_path, release_notifications_consent, last_contacted_at, last_contacted_by, '
  + 'converted_org_id, follow_up_due_at, next_action, source, source_words, lost_reason, link_method, linked_by, linked_at, '
  + 'signed_up_at, heard_from, ref_tag, do_not_contact_at';

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requirePlatformAreaView('early_access');
  if (!hasPlatformPower(auth.role, 'growth')) redirect('/platform-admin');
  const { leadId } = await params;
  if (!isUuid(leadId)) notFound();

  const { data, error } = await supabaseAdmin.from('early_access_leads').select(COLUMNS).eq('id', leadId).maybeSingle();
  if (error) {
    return (
      <div className={kit.page}>
        <AdminPageHeader title="Lead" backTo={{ href: '/platform-admin/early-access', label: 'Leads' }} />
        <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">This lead could not be read just now.</div>
      </div>
    );
  }
  if (!data) notFound();
  const lead = data as unknown as LeadRow;
  const step: EarlyAccessStatus = isEarlyAccessStatus(lead.internal_status) ? lead.internal_status : 'new';
  const now = new Date();
  const today = tournamentToday(now);

  const offers = lead.linked_at
    ? { kind: 'read' as const, value: new Map<string, OfferedClub[]>() }
    : await readOffers([{ id: lead.id, email: lead.email, step, linkedAt: null }]);
  const offered: OfferedClub[] = offers.kind === 'read' ? offers.value.get(lead.id) ?? [] : [];
  const timeline = await leadTimeline(lead, offered);

  const { data: staff } = await supabaseAdmin.from('platform_users').select('email, display_name');
  const names = new Map(((staff ?? []) as { email: string; display_name: string | null }[]).map(s => [s.email.toLowerCase(), s.display_name?.trim() || null]));
  const who = (email: string | null) => (email ? names.get(email.toLowerCase()) ?? email : 'staff');

  // The club it signed up as, read live (its plan and trial), and whether it pays today.
  let signedUp: LeadRecordProps['signedUp'] = null;
  if (lead.linked_at) {
    const org = lead.converted_org_id
      ? (await supabaseAdmin.from('organizations').select('id, name, plan_id, subscription_status, current_period_end').eq('id', lead.converted_org_id).maybeSingle()).data as
        { id: string; name: string; plan_id: string | null; subscription_status: string | null; current_period_end: string | null } | null
      : null;
    const pay = org ? await readPaying([org.id]) : null;
    const days = daysToSignUp({ createdAt: lead.created_at, signedUpAt: lead.signed_up_at });
    const predates = clubPredatesLead({ createdAt: lead.created_at, signedUpAt: lead.signed_up_at });
    const paying = !org ? 'The club has since been deleted.'
      : pay?.kind === 'not_read' ? 'Whether it pays could not be read just now.'
        : pay?.paying.has(org.id) ? `Paying: ${planName(org.plan_id)}.`
          : org.subscription_status === 'trialing'
            ? `Not paying yet: on a ${planName(org.plan_id)} trial${org.current_period_end ? ` until ${consoleDay(org.current_period_end)}` : ''}.`
            : `Not paying: ${planName(org.plan_id)}.`;
    signedUp = {
      line: (predates
        ? `This club already existed: it was created on ${consoleDay(lead.signed_up_at)}, before this lead arrived. `
        : `Signed up on ${consoleDay(lead.signed_up_at)}${days !== null ? `, ${plural(days, 'day')} after it arrived` : ''}. `)
        + `Linked by ${who(lead.linked_by)} on ${consoleDay(lead.linked_at)}. ${paying}`,
      club: org ? { id: org.id, name: org.name, sub: `${planName(org.plan_id)}${org.subscription_status === 'trialing' ? ' · trial' : ''} · ${lead.link_method === 'offered' ? 'linked from the offered match' : 'linked by hand'}` } : null,
    };
  }

  const page = leadPageLabel(lead.source_path);
  const ago = daysBetweenDateStrings(orgDayKey(lead.created_at), today);
  const first = lead.name.split(/\s+/)[0] || lead.name;

  const props: LeadRecordProps = {
    id: lead.id,
    title: lead.organization_name || lead.name,
    step,
    stepLabel: EARLY_ACCESS_STATUS_LABELS[step],
    tone: stepTone(step),
    meta: `${lead.name} · ${lead.email} · arrived ${consoleDay(lead.created_at)} from ${page === 'Other pages' ? 'another page' : page.replace(/^The /, 'the ')}${lead.linked_at ? '' : ` · ${plural(ago, 'day')} ago`}`,
    firstName: first,
    email: lead.email,
    organization: lead.organization_name,
    offers: offered.map(c => ({ orgId: c.orgId, name: c.name, sentence: offerSentence(c, now), matchLine: `Matched because its owner signs in with ${c.ownerEmail}. Nothing is linked until someone confirms.` })),
    offersNotRead: offers.kind === 'not_read',
    signedUp,
    facts: {
      contact: `${[lead.name, lead.role].filter(Boolean).join(' · ')}`,
      contactSub: `${lead.email} · ${lead.release_notifications_consent ? 'said yes to release emails' : 'did not ask for release emails'}`,
      interest: planWords(lead.plan_interest ?? []),
      interestSub: featureWords(lead.features_interested ?? []),
      arrivedFrom: page,
      arrivedSub: `${lead.source_path ?? 'no page recorded'}${lead.submission_count > 1 ? ` · filled the form ${plural(lead.submission_count, 'time')}, last on ${consoleDay(lead.last_submitted_at)}` : ''}`,
      // Staff's choice; else the visitor's own answer mapped to the same list (drawing J, question 13 A).
      source: sourceWords(lead.source ?? sourceFromHeard(lead.heard_from)),
      sourceWords: lead.source_words,
      sourceFromForm: !lead.source && sourceFromHeard(lead.heard_from) ? sourceWords(sourceFromHeard(lead.heard_from)) : null,
      formAnswer: heardFromLabel(lead.heard_from) ? `From the form: ${heardFromLabel(lead.heard_from)}` : null,
      link: linkTagLabel(lead.ref_tag),
      lost: step === 'lost' ? lostWords(lead.lost_reason) : null,
      nextAction: lead.next_action,
      followUp: lead.follow_up_due_at ? consoleDay(`${lead.follow_up_due_at}T12:00:00Z`) : null,
      lastContacted: lead.last_contacted_at ? `${consoleDay(lead.last_contacted_at)}, by ${who(lead.last_contacted_by)}` : null,
      words: lead.notes,
      sports: lead.sports,
    },
    form: {
      step,
      lostReason: lead.lost_reason ?? '',
      source: lead.source ?? '',
      sourceWords: lead.source_words ?? '',
      nextAction: lead.next_action ?? '',
      followUpDueAt: lead.follow_up_due_at ?? '',
    },
    linked: !!lead.linked_at,
    doNotContact: lead.do_not_contact_at
      ? { sentence: `Asked not to be contacted, on ${consoleDay(lead.do_not_contact_at)}.`, canAllow: lead.lost_reason !== 'asked_not_to_contact' }
      : null,
    timeline: timeline.entries,
    timelineNotRead: timeline.notRead,
    canRemoveNotes: hasPlatformPower(auth.role, 'delete_records'),
  };

  return <LeadRecord {...props} />;
}
