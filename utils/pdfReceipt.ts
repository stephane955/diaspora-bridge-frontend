export type ReceiptData = {
    projectTitle: string;
    amount: string;
    currency?: string;
    date: string;
    description?: string;
    recipient?: string;
};

export type MilestoneReceiptData = ReceiptData & {
    milestoneTitle?: string;
    projectId?: string;
    milestoneId?: string;
};

/**
 * Generate a dark-themed branded PDF receipt and share via expo-print + expo-sharing.
 */
export async function generateAndShareReceipt(
    data: MilestoneReceiptData,
): Promise<void> {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Diaspora Bridge Receipt</title>
  <style>
    @page { margin: 0; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0A0F1A;
      color: #F8FAFC;
      padding: 40px 36px;
    }
    .brand {
      font-size: 13px;
      letter-spacing: 3px;
      font-weight: 800;
      color: #D4AF37;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .rule {
      height: 1px;
      background: linear-gradient(90deg, #D4AF37, transparent);
      margin: 18px 0 28px;
    }
    h1 { font-size: 26px; margin: 0 0 6px; font-weight: 800; }
    .sub { color: #94A3B8; font-size: 13px; margin-bottom: 28px; }
    .card {
      background: rgba(17,24,39,0.95);
      border: 1px solid rgba(212,175,55,0.28);
      border-radius: 16px;
      padding: 22px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 12px 0;
      font-size: 14px;
    }
    .label { color: #94A3B8; font-weight: 600; }
    .value { color: #F8FAFC; font-weight: 700; text-align: right; }
    .amount {
      margin-top: 22px;
      font-size: 32px;
      font-weight: 800;
      color: #D4AF37;
    }
    .footer {
      margin-top: 36px;
      font-size: 11px;
      color: #64748B;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="brand">Diaspora Bridge</div>
  <div class="rule"></div>
  <h1>Escrow Payment Receipt</h1>
  <div class="sub">Secured milestone release · Computer-generated</div>
  <div class="card">
    <div class="row"><span class="label">Project</span><span class="value">${escapeHtml(data.projectTitle)}</span></div>
    ${data.milestoneTitle ? `<div class="row"><span class="label">Milestone</span><span class="value">${escapeHtml(data.milestoneTitle)}</span></div>` : ''}
    <div class="row"><span class="label">Date</span><span class="value">${escapeHtml(data.date)}</span></div>
    ${data.recipient ? `<div class="row"><span class="label">Recipient</span><span class="value">${escapeHtml(data.recipient)}</span></div>` : ''}
    ${data.description ? `<div class="row"><span class="label">Note</span><span class="value">${escapeHtml(data.description)}</span></div>` : ''}
    <div class="amount">${escapeHtml(data.amount)}${data.currency && !String(data.amount).includes(data.currency) ? ` ${escapeHtml(data.currency)}` : ''}</div>
  </div>
  <div class="footer">
    Diaspora Bridge Escrow · Stripe-secured settlements<br/>
    Keep this receipt for your records. ID refs are stored in your project activity.
  </div>
</body>
</html>
  `.trim();

    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
        await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: 'Share Escrow Receipt',
        });
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
