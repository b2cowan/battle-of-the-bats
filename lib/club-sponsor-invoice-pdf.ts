import 'server-only';
/**
 * THE CLUB'S SPONSORSHIP INVOICE — THE PDF (Board Ready Stage 6 Part 3a). Made on the server, for both of its doors: the
 * club's deal page (behind Sponsorships) and the business's page (its link's one door). Neither door reads anything the
 * other can't: the same deal, the same invoice, the club's own PDF look (its colour, crest and footer, as every admin paper
 * prints it). The paid invoice is the receipt (ask 10) — the same file, "Paid in full" leading its subtitle.
 */
import { supabaseAdmin } from './supabase-admin';
import { resolveOrgPdfSettings } from './export/resolve-pdf-settings';
import { buildClubSponsorInvoiceDoc } from './export/pdf';
import { readSettings } from './club-sponsorships-server';
import { readDeal, readDealBusiness } from './club-sponsorship-deals-server';
import { clubInvoiceLayout, invoiceFilename } from './club-sponsor-invoice';
import { dealBullets } from './club-sponsorship-deals';
import type { Organization } from './types';

/** The deal's invoice as a PDF, or null when it has none (an open offer, a withdrawn deal never invoiced). */
export async function dealInvoicePdf(org: Pick<Organization, 'id' | 'name' | 'planId' | 'logoUrl'>, dealId: string): Promise<{ bytes: ArrayBuffer; filename: string } | null> {
  const [deal, business, settings, row] = await Promise.all([
    readDeal(org.id, dealId),
    readDealBusiness(org.id, dealId),
    readSettings(org.id),
    supabaseAdmin.from('organizations').select('pdf_settings').eq('id', org.id).maybeSingle(),
  ]);
  if (!deal?.invoice) return null;
  if (row.error) throw row.error;
  const pdf = await resolveOrgPdfSettings({
    id: org.id, name: org.name, planId: org.planId, logoUrl: org.logoUrl ?? null,
    pdfSettings: (row.data as { pdf_settings: Record<string, unknown> | null } | null)?.pdf_settings ?? null,
  });
  const a = business?.address;
  const layout = clubInvoiceLayout({
    club: { name: org.name, mailingAddress: settings.mailingAddress, gstHstNumber: settings.gstHstNumber, contactName: settings.contactName, contactEmail: settings.contactEmail },
    howToPay: { etransferTo: settings.etransferTo, chequesPayableTo: settings.chequesPayableTo },
    deal: {
      packageName: deal.packageName, placeName: deal.placeKind === 'club' ? null : deal.targetName,
      bullets: dealBullets(deal), endsOn: deal.endsOn, revisedOn: deal.revisedOn,
    },
    invoice: deal.invoice,
    billTo: {
      name: business?.name || deal.businessName, contactName: business?.contactName ?? null,
      address: a ? `${a.street}, ${a.city} ${a.province} ${a.postal}` : null, email: business?.email ?? null,
    },
    payments: deal.payments,
  });
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = buildClubSponsorInvoiceDoc(jsPDF, autoTable, { ...layout, settings: pdf });
  return { bytes: doc.output('arraybuffer') as ArrayBuffer, filename: invoiceFilename(deal.invoice.number, business?.name || deal.businessName) };
}

/** The file, as a download: no-store (it changes as payments arrive), never indexed. */
export function invoicePdfResponse(file: { bytes: ArrayBuffer; filename: string }): Response {
  return new Response(file.bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
