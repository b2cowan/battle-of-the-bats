/**
 * The printable rules' QR code (Public tournament pages Stage 10, A4): a PNG data URL of the Rules page's address with
 * `?view=all`, so a phone that scans it lands on the whole book whatever division it has saved. Drawn about 2 cm square
 * on page one. One definition, read by the route that serves the file and the PDF check that renders it.
 */
export async function rulesQrDataUrl(address: string): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default;
    // Medium correction survives a smudged print; no quiet zone, because the stamp box's padding is the margin.
    return await QRCode.toDataURL(address, { errorCorrectionLevel: 'M', margin: 0, width: 264 });
  } catch {
    return null; // no code, never no file (the stamp says the address in words)
  }
}

/** The address the code opens: the Rules page, every division. */
export function rulesViewAllUrl(rulesPageUrl: string): string {
  const url = new URL(rulesPageUrl);
  url.searchParams.set('view', 'all');
  url.hash = '';
  return url.toString();
}
