// CattleFeedReceipt.jsx
export const printReceipt = (txn, t) => {
  const dateStr = new Date(txn.sale_date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const timeStr = new Date(txn.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const itemRows = txn.items.map((item, i) => `
    <tr>
      <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #ddd;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${item.feed_name || "—"}</td>
      <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">${parseFloat(item.quantity).toFixed(2)}</td>
      <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">${parseFloat(item.rate).toFixed(2)}</td>
      <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">${parseFloat(item.total_amount || item.quantity * item.rate).toFixed(2)}</td>
    </tr>
  `).join("");

  const grandTotal = txn.items.reduce((s, i) => s + parseFloat(i.total_amount || i.quantity * i.rate || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Receipt_${txn.transaction_id}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          padding: 30px;
          color: #111;
          max-width: 580px;
          margin: 0 auto;
          font-size: 13px;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #111;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .shri {
          font-size: 28px;
          font-weight: 700;
          color: #111;
          letter-spacing: 2px;
          margin-bottom: 2px;
        }
        .app-name {
          font-size: 20px;
          font-weight: 700;
          color: #111;
          letter-spacing: 1px;
          margin-top: 2px;
        }
        .center-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-top: 2px;
        }
        .transaction-id {
          text-align: center;
          font-size: 11px;
          color: #666;
          margin: 8px 0 12px 0;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px dashed #ddd;
          margin-bottom: 12px;
          font-size: 13px;
        }
        .info-row .left {
          font-weight: 600;
          color: #333;
        }
        .info-row .right {
          font-weight: 500;
          color: #111;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }
        thead th {
          background: #f5f5f5;
          color: #111;
          padding: 8px 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #111;
          text-align: left;
        }
        thead th:nth-child(1) {
          text-align: center;
          width: 8%;
        }
        thead th:nth-child(2) {
          text-align: left;
          width: 32%;
        }
        thead th:nth-child(3) {
          text-align: right;
          width: 15%;
        }
        thead th:nth-child(4) {
          text-align: right;
          width: 15%;
        }
        thead th:nth-child(5) {
          text-align: right;
          width: 30%;
        }
        tbody tr:last-child td {
          border-bottom: 2px solid #111;
        }
        tbody td {
          padding: 6px 8px;
          font-size: 12.5px;
        }
        tbody td:nth-child(1) {
          text-align: center;
        }
        tbody td:nth-child(3),
        tbody td:nth-child(4),
        tbody td:nth-child(5) {
          text-align: right;
        }
        .grand-total-row {
          margin-top: 10px;
          padding: 10px 8px;
          background: #f5f5f5;
          border: 2px solid #111;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 15px;
          font-weight: 700;
        }
        .grand-total-row .label {
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #111;
        }
        .grand-total-row .amount {
          color: #111;
          font-size: 16px;
        }
        .footer {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #ddd;
          font-size: 11px;
          color: #666;
        }
        .footer .left {
          font-weight: 400;
        }
        .footer .right {
          font-weight: 600;
          color: #111;
        }
        .signature {
          margin-top: 30px;
          display: flex;
          justify-content: flex-end;
          padding-top: 6px;
          width: 140px;
          margin-left: auto;
          text-align: center;
          border-top: 1px solid #111;
          font-size: 12px;
          color: #555;
        }
        @media print {
          body {
            padding: 20px;
          }
          .no-print {
            display: none;
          }
        }
        @media screen {
          body {
            box-shadow: 0 2px 20px rgba(0,0,0,0.08);
            border-radius: 8px;
            padding: 30px;
          }
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="shri">श्री</div>
        <div class="app-name">${t('appName') || 'CATTLE FEED SALES'}</div>
        <div class="center-name">${t('centerName') || 'Cattle Feed Sales Center'}</div>
      </div>

      <!-- Transaction ID -->
      <div class="transaction-id">
        Transaction ID: ${txn.transaction_id}
      </div>

      <!-- Info Row: Date & Time -->
      <div class="info-row">
        <span class="left">${dateStr}</span>
        <span class="right">${timeStr}</span>
      </div>

      <!-- Seller Info -->
      <div style="margin-bottom: 12px; padding: 6px 0; font-size: 13px;">
        <span style="font-weight: 600; color: #333;">${txn.seller_name || "—"}</span>
        ${txn.seller_code ? `<span style="color: #666; margin-left: 8px; font-size: 12px;">(${txn.seller_code})</span>` : ''}
      </div>

      <!-- Table -->
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${t('cattleFeedSales.receipt.feed') || 'Feed'}</th>
            <th>${t('cattleFeedSales.receipt.qty') || 'Qty'}</th>
            <th>${t('cattleFeedSales.receipt.rate') || 'Rate'}</th>
            <th>${t('cattleFeedSales.receipt.amount') || 'Amount'}</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Grand Total -->
      <div class="grand-total-row">
        <span class="label">${t('cattleFeedSales.receipt.grandTotal') || 'Grand Total'}</span>
        <span class="amount">₹${grandTotal.toFixed(2)}</span>
      </div>

      <!-- Footer -->
      <div class="footer">
        <span class="left">${t('cattleFeedSales.receipt.footer') || 'Thank you for your business'}</span>
        <span class="right">${t('cattleFeedSales.receipt.gst') || 'GST: 27AABCQ1234D1ZP'}</span>
      </div>

      <!-- Signature -->
      <div class="signature">
        ${t('cattleFeedSales.receipt.signatory') || 'Authorized Signatory'}
      </div>

      <!-- Print Button (visible only on screen) -->
      <div style="text-align: center; margin-top: 20px;" class="no-print">
        <button onclick="window.print()" style="padding: 8px 24px; background: #111; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 600;">
          🖨️ ${t('cattleFeedSales.receipt.print') || 'Print Receipt'}
        </button>
        <button onclick="window.close()" style="padding: 8px 24px; margin-left: 8px; background: #f0f0f0; color: #333; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 600;">
          ✕ ${t('cattleFeedSales.receipt.close') || 'Close'}
        </button>
      </div>

      <script>
        // Auto-print when loaded
        window.onload = function() {
          // Small delay to ensure everything renders
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      win.document.title = `Receipt_${txn.transaction_id}`;
      // Keep the URL for a bit longer
      setTimeout(() => {
        // Don't revoke immediately to allow printing
      }, 3000);
    };
  }
};