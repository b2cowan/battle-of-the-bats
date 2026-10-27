import { redirect } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import { readAccounts, readLeadBook, readOffers, readPaying } from '@/lib/lead-book';
import { isSignedUp } from '@/lib/lead-numbers';
import { bandCells, filterToken, pipelineRows } from '@/lib/lead-views';
import { numbersView, parsePeriod } from '@/lib/lead-numbers-view';
import { consoleClock, consoleDay } from '@/lib/console-dates';
import { tournamentToday } from '@/lib/timezone';
import { EARLY_ACCESS_STATUSES } from '@/lib/early-access-admin';
import kit from '../console.module.css';
import LeadsScreen from './LeadsScreen';

/**
 * Leads (Support console Stage 7 Parts 3 and 5; drawings A and B). One address, two views: the Pipeline (the list) and
 * Numbers. The growth power (Super admin, Product, Growth) is asked before any lead is read; every figure counts through
 * the one definition (`lib/lead-numbers.ts`), over every lead.
 */
export const metadata = { title: 'Leads — Support console' };

type Search = { view?: string; scope?: string; q?: string; step?: string; plan?: string; source?: string; tag?: string; page?: string; period?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const auth = await requirePlatformAreaView('early_access');
  if (!hasPlatformPower(auth.role, 'growth')) redirect('/platform-admin');

  const sp = await searchParams;
  const view = sp.view === 'numbers' ? 'numbers' : 'pipeline';
  const book = await readLeadBook();
  const now = new Date();

  if (book.kind === 'not_read') {
    return (
      <div className={kit.page}>
        <AdminPageHeader title="Leads" />
        <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">The leads could not be read just now. Nothing on this page is counted until they can be.</div>
      </div>
    );
  }
  const leads = book.value;
  const filters = {
    q: (sp.q ?? '').trim().slice(0, 80),
    step: (EARLY_ACCESS_STATUSES as readonly string[]).includes(sp.step ?? '') ? sp.step! : '',
    plan: filterToken(sp.plan),
    source: filterToken(sp.source),
    tag: filterToken(sp.tag, 32),
    page: (sp.page ?? '').slice(0, 60),
  };

  if (view === 'numbers') {
    const period = parsePeriod(sp.period, leads);
    const signedOrgIds = leads.filter(isSignedUp).map(l => l.orgId).filter((x): x is string => !!x);
    const [pay, accounts] = await Promise.all([readPaying(signedOrgIds), readAccounts()]);
    const linked = new Set(leads.map(l => l.orgId).filter((x): x is string => !!x));
    const model = numbersView(leads, period, filters, pay, accounts, linked, now);
    return (
      <div className={kit.page}>
        <AdminPageHeader title="Leads" />
        <LeadsScreen view="numbers" hasLeads={leads.length > 0} numbers={model} readAt={consoleClock(now.toISOString())}
          filters={filters} filterOptions={model.filterOptions} />
      </div>
    );
  }

  const offers = await readOffers(leads);
  const offerMap = offers.kind === 'read' ? offers.value : new Map();
  const signedOrgIds = leads.filter(l => l.step === 'converted').map(l => l.orgId).filter((x): x is string => !!x);
  const pay = await readPaying(signedOrgIds);
  const scope = sp.scope === 'all' || filters.step ? 'all' : 'needs';
  const { rows, needCount } = pipelineRows(leads, offerMap, scope, filters, now);

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Leads" />
      <LeadsScreen
        view="pipeline"
        hasLeads={leads.length > 0}
        scope={scope}
        needCount={needCount}
        rows={rows}
        band={bandCells(leads, now, pay)}
        offersNotRead={offers.kind === 'not_read'}
        filters={filters}
        filterOptions={{
          plans: [...new Set(leads.flatMap(l => l.plans))],
          tags: [...new Set(leads.map(l => l.refTag).filter((x): x is string => !!x))],
          pages: [],
        }}
        today={consoleDay(tournamentToday(now))}
      />
    </div>
  );
}
