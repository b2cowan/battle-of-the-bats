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
import { clubInvoiceLayout, creditNoteFilename, creditNoteLayout, invoiceFilename, type ClubInvoiceInput } from './club-sponsor-invoice';
import { dealBullets } from './club-sponsorship-deals';
import type { Organization } from './types';

type PdfOrg = Pick<Organization, 'id' | 'name' | 'planId' | 'logoUrl'>;

/** The deal's invoice as a PDF, or null when it has none (an open offer, a withdrawn deal never invoiced). */
export async function dealInvoicePdf(org: PdfOrg, dealId: string): Promise<{ bytes: ArrayBuffer; filename: string } | null> {
  const read = await invoiceInput(org, dealId);
  if (!read) return null;
  const layout = clubInvoiceLayout(read.input);
  return { bytes: await renderPdf(layout, read.pdf), filename: invoiceFilename(read.input.invoice.number, read.input.billTo.name) };
}

/**
 * A refund's credit note as a PDF (Part 3b; /accounting 2026-11-23): only a refund that reached the card on a taxed invoice
 * has one (its number was given then). null otherwise — the route answers 404.
 */
export async function dealCreditNotePdf(org: PdfOrg, dealId: string, refundId: string): Promise<{ bytes: ArrayBuffer; filename: string } | null> {
  const read = await invoiceInput(org, dealId);
  const refund = read?.input.refunds?.find(r => r.id === refundId);
  if (!read || !refund || refund.status !== 'succeeded' || !refund.creditNumber) return null;
  const layout = creditNoteLayout(read.input, refund);
  return { bytes: await renderPdf(layout, read.pdf), filename: creditNoteFilename(refund.creditNumber, read.input.billTo.name) };
}

/** Draws a layout (the invoice's or a credit note's) in the club's PDF look. */
async function renderPdf(layout: ReturnType<typeof clubInvoiceLayout>, settings: Awaited<ReturnType<typeof resolveOrgPdfSettings>>): Promise<ArrayBuffer> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return buildClubSponsorInvoiceDoc(jsPDF, autoTable, { ...layout, settings }).output('arraybuffer') as ArrayBuffer;
}

/** What both papers are drawn from: the deal, its business, the club's invoice details and its PDF look. */
async function invoiceInput(org: PdfOrg, dealId: string): Promise<{ input: ClubInvoiceInput; pdf: Awaited<ReturnType<typeof resolveOrgPdfSettings>> } | null> {
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
  const input: ClubInvoiceInput = {
    club: { name: org.name, mailingAddress: settings.mailingAddress, gstHstNumber: settings.gstHstNumber, contactName: settings.contactName, contactEmail: settings.contactEmail },
    howToPay: { etransferTo: settings.etransferTo, chequesPayableTo: settings.chequesPayableTo },
    deal: {
      packageName: deal.packageName, placeName: deal.placeKind === 'club' ? null : deal.targetName,
      bullets: dealBullets(deal), endsOn: deal.endsOn, revisedOn: deal.revisedOn,
      withdrawnAt: deal.state === 'withdrawn' ? deal.withdrawn?.at ?? null : null,
    },
    invoice: deal.invoice,
    billTo: {
      name: business?.name || deal.businessName, contactName: business?.contactName ?? null,
      address: a ? `${a.street}, ${a.city} ${a.province} ${a.postal}` : null, email: business?.email ?? null,
    },
    payments: deal.payments,
    refunds: deal.refunds,
  };
  return { input, pdf };
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
