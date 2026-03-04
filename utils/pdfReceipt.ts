export type ReceiptData = {
    projectTitle: string;
    amount: string;
    currency?: string;
    date: string;
    description?: string;
    recipient?: string;
};

/**
 * Generate a branded PDF receipt and offer share/print.
 * Call when payment is released (milestone paid).
 * Uses expo-print + expo-sharing when available; no-op otherwise.
 */
export async function generateAndShareReceipt(data: ReceiptData): Promise<void> {
    try {
        const printModule = 'expo-' + 'print';
        const sharingModule = 'expo-' + 'sharing';
        const Print = require(printModule) as typeof import('expo-print');
        const Sharing = require(sharingModule) as typeof import('expo-sharing');

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #0F172A; }
    .brand { font-weight: 800; color: #0EA5E9; margin-bottom: 24px; }
    h1 { font-size: 20px; margin: 0 0 16px 0; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; }
    .label { color: #64748B; }
    .amount { font-size: 24px; font-weight: 800; color: #10B981; margin: 16px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="brand">DIASPORA BRIDGE</div>
  <h1>Payment Receipt</h1>
  <div class="row"><span class="label">Project</span><span>${escapeHtml(data.projectTitle)}</span></div>
  <div class="row"><span class="label">Date</span><span>${escapeHtml(data.date)}</span></div>
  ${data.recipient ? `<div class="row"><span class="label">Recipient</span><span>${escapeHtml(data.recipient)}</span></div>` : ''}
  <div class="amount">${escapeHtml(data.amount)} ${data.currency ?? 'CFA'}</div>
  ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ''}
  <div class="footer">Secured by Stripe & Supabase · This is a computer-generated receipt.</div>
</body>
</html>
  `.trim();

        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
        }
    } catch (_) {
        // expo-print or expo-sharing not installed / unavailable
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
