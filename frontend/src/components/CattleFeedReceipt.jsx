// CattleFeedReceipt.jsx
import { getPrintSettings } from "../utils/printSettings";
import { getReceiptTemplate } from "../utils/receiptTemplate";
import { renderReceiptHeader, renderReceiptFooter } from "../utils/receiptTemplateRenderer";

export const printReceipt = (txn, t, appName, centreName, { onStart, onReady, onDone } = {}) => {
  const { printerType, paperWidthMm } = getPrintSettings();
  const tpl = getReceiptTemplate();
  const isThermal = printerType === "thermal";
  const displayAppName = appName || t('appName') || 'CATTLE FEED SALES';
  const displayCentreName = centreName || t('cattleFeedSales.receipt.centerName') || 'Cattle Feed Sales Center';
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
      <td style="text-align:center;padding:2px 4px;border-bottom:0.5px solid #ddd;">${i + 1}</td>
      <td style="padding:2px 4px;border-bottom:0.5px solid #ddd;">${item.feed_name || t('cattleFeedSales.receipt.unknown') || "—"}</td>
      <td style="text-align:right;padding:2px 4px;border-bottom:0.5px solid #ddd;">${parseFloat(item.quantity).toFixed(2)}</td>
      <td style="text-align:right;padding:2px 4px;border-bottom:0.5px solid #ddd;">${parseFloat(item.rate).toFixed(2)}</td>
      <td style="text-align:right;padding:2px 4px;border-bottom:0.5px solid #ddd;">${parseFloat(item.total_amount || item.quantity * item.rate).toFixed(2)}</td>
    </tr>
  `).join("");

  const grandTotal = txn.items.reduce((s, i) => s + parseFloat(i.total_amount || i.quantity * i.rate || 0), 0);
  const showDateTime = tpl.showDateTime;
  const showSellerCode = tpl.showSellerCode;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${t('cattleFeedSales.receipt.title') || 'Receipt'}_${txn.transaction_id}</title>
      <style>
        * {
          letter-spacing: -0.04em;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        @page {
          size: ${isThermal ? `${paperWidthMm}mm auto` : "A4"};
          margin: ${isThermal ? "2mm 3mm" : "12mm"};
        }
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          padding: ${isThermal ? "1px 2px" : "30px"};
          color: #111;
          max-width: ${isThermal ? `${paperWidthMm - 6}mm` : "580px"};
          width: ${isThermal ? `${paperWidthMm - 6}mm` : "auto"};
          margin: 0 auto;
          font-size: ${isThermal ? "9px" : "13px"};
          line-height: 1.1;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 0.5px solid #111;
          padding-bottom: 4px;
          margin-bottom: 4px;
        }
        .shri {
          font-size: ${Math.min(tpl.topSymbolFontSize || 14, 14)}px;
          font-weight: 700;
          color: #111;
          letter-spacing: -2px;
          margin-bottom: 0px;
          line-height: 1;
        }
        .app-name {
          font-size: ${Math.min(tpl.appNameFontSize || 14, 14)}px;
          font-weight: 700;
          color: #111;
          letter-spacing: -1px;
          margin-top: 0px;
          line-height: 1.1;
        }
        .center-name {
          font-size: ${Math.min(tpl.centreNameFontSize || 11, 11)}px;
          font-weight: 500;
          color: #333;
          margin-top: 0px;
          line-height: 1.1;
        }
        .transaction-id {
          text-align: center;
          font-size: ${Math.min(tpl.transactionIdFontSize || 9, 9)}px;
          color: #666;
          margin: 2px 0 4px 0;
          letter-spacing: -0.05em;
          font-weight: 600;
          line-height: 1.1;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 2px 2px 0;
          border-bottom: 0.5px dashed #ddd;
          margin-bottom: 4px;
          font-size: ${Math.min(tpl.dateTimeFontSize || 9, 9)}px;
          line-height: 1.1;
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
          margin-top: 2px;
        }
        thead th {
          background: #f5f5f5;
          color: #111;
          padding: 3px 4px;
          font-size: ${Math.min(tpl.tableHeaderFontSize || 8, 8)}px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: -0.5px;
          border-bottom: 0.25px solid #111;
          text-align: left;
          line-height: 1.1;
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
          border-bottom: 0.25px solid #111;
        }
        tbody td {
          padding: 1px 4px;
          font-size: ${Math.min(tpl.tableBodyFontSize || 8, 8)}px;
          line-height: 1.1;
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
          margin-top: 4px;
          padding: 4px 6px;
          background: #f5f5f5;
          border: 0.5px solid #111;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: ${Math.min(tpl.grandTotalFontSize || 10, 10)}px;
          font-weight: 700;
          line-height: 1.1;
        }
        .grand-total-row .label {
          text-transform: uppercase;
          letter-spacing: -0.5px;
          color: #111;
        }
        .grand-total-row .amount {
          color: #111;
          font-size: ${Math.min((tpl.grandTotalFontSize || 10) + 1, 11)}px;
        }
        .footer {
          margin-top: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 2px 0 0;
          border-top: 0.5px solid #ddd;
          font-size: ${Math.min(tpl.footerFontSize || 8, 8)}px;
          color: #666;
          line-height: 1.1;
        }
        .footer .left {
          font-weight: 400;
        }
        .footer .right {
          font-weight: 600;
          color: #111;
        }
        .signature {
          margin-top: 10px;
          display: flex;
          justify-content: flex-end;
          padding-top: 3px;
          width: 120px;
          margin-left: auto;
          text-align: center;
          border-top: 0.5px solid #111;
          font-size: ${Math.min(tpl.signatoryFontSize || 8, 8)}px;
          color: #555;
          line-height: 1.1;
        }
        .seller-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
          padding: 2px 2px 2px 0;
          font-size: ${Math.min(tpl.sellerNameFontSize || 9, 9)}px;
          line-height: 1.1;
        }
        .seller-code {
          font-size: ${Math.min(tpl.sellerCodeFontSize || 9, 9)}px;
          color: #000000;
          font-weight: 700;
        }
        .seller-name {
          font-weight: 700;
          color: #000000;
        }
        .advertising {
          text-align: start;
          margin-top: 6px;
          padding-top: 3px;
          font-size: 6px;
          letter-spacing: -0.6px;
          color: #999;
          line-height: 1;
        }
        @media print {
          body {
            padding: ${isThermal ? "1px 2px" : "20px"};
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
      <!-- Header (fully driven by the saved receipt template) -->
      ${renderReceiptHeader({ appName: displayAppName, centreName, transactionId: txn.transaction_id, t })}

      <!-- Info Row: Date & Time -->
      ${showDateTime ? `
      <div class="info-row">
        <span class="left">${dateStr}</span>
        <span class="right">${timeStr}</span>
      </div>` : ''}

      <!-- Seller Info -->
      <div class="seller-info">
        ${showSellerCode && txn.seller_code ? `<span class="seller-code">Farmer Code: <span style="font-weight: 700;">${txn.seller_code}</span></span>` : ''}
        <span class="seller-name">${txn.seller_name || "—"}</span>
      </div>

      <!-- Table -->
      <table>
        <thead>
          <tr>
            <th>${t('cattleFeedSales.receipt.no') || '#'}</th>
            <th>${tpl.productLabel || t('cattleFeedSales.receipt.feed') || 'Feed'}</th>
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

      <!-- Footer (fully driven by the saved receipt template) -->
      ${renderReceiptFooter()}

      <!-- Hardcoded advertising line — not user-configurable -->
      <div class="advertising">
        PRAVAS DIGITAL VISION SYSTEMS PVT. LTD.
      </div>
    </body>
    </html>
  `;

  // Print via a hidden iframe instead of a new tab — no extra page,
  // no manual "download"/"print" click. The OS print dialog still
  // appears once (browsers won't skip that for security reasons),
  // but it opens immediately and defaults to the system default printer.
  onStart?.();

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    // small delay lets fonts/images settle before the print dialog opens
    setTimeout(() => {
      onReady?.();
      iframe.contentWindow.focus();

      // fires once the OS print dialog is dismissed (printed or cancelled)
      const cleanup = () => {
        onDone?.();
        iframe.contentWindow.removeEventListener("afterprint", cleanup);
        setTimeout(() => document.body.removeChild(iframe), 300);
      };
      iframe.contentWindow.addEventListener("afterprint", cleanup);

      iframe.contentWindow.print();

      // fallback in case afterprint doesn't fire on some browsers
      setTimeout(cleanup, 8000);
    }, 300);
  };
};