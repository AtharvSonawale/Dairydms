// ProductSalesReceipt.jsx
import { getPrintSettings } from "../utils/printSettings";
import { getReceiptTemplate } from "../utils/receiptTemplate";
import { renderReceiptHeader, renderReceiptFooter } from "../utils/receiptTemplateRenderer";

export const printReceipt = (txn, t, appName, centreName, { onStart, onReady, onDone } = {}) => {
  const { printerType, paperWidthMm } = getPrintSettings();
  const tpl = getReceiptTemplate();
  const isThermal = printerType === "thermal";
  const displayAppName = appName || t('appName') || 'MilkApp';
  const displayCentreName = centreName || t('productSales.receipt.centerName') || 'Product Sales Center';
  const dateStr = new Date(txn.sale_date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
  const timeStr = new Date(txn.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });

  const itemRows = txn.items.map((item, i) => `
    <tr>
      <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #ddd;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${item.product_name || t('productSales.receipt.unknown') || "—"}</td>
      <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">${parseFloat(item.quantity).toFixed(2)}</td>
      <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">${parseFloat(item.rate).toFixed(2)}</td>
      <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">${parseFloat(item.total_amount || item.quantity * item.rate).toFixed(2)}</td>
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
      <title>${t('productSales.receipt.title') || 'Receipt'}_${txn.transaction_id}</title>
      <style>
        * { letter-spacing: -0.04em; margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: ${isThermal ? `${paperWidthMm}mm auto` : "A4"}; margin: ${isThermal ? "4mm" : "12mm"}; }
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          padding: ${isThermal ? "0 4px" : "30px"};
          color: #111;
          max-width: ${isThermal ? `${paperWidthMm - 10}mm` : "580px"};
          width: ${isThermal ? `${paperWidthMm - 10}mm` : "auto"};
          margin: 0 auto;
          font-size: ${isThermal ? "11px" : "13px"};
          background: #fff;
        }
        .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
        .shri { font-size: ${tpl.topSymbolFontSize}px; font-weight: 700; color: #111; letter-spacing: -2px; margin-bottom: 2px; }
        .app-name { font-size: ${tpl.appNameFontSize}px; font-weight: 700; color: #111; letter-spacing: -1px; margin-top: 2px; }
        .center-name { font-size: ${tpl.centreNameFontSize}px; font-weight: 500; color: #333; margin-top: 2px; }
        .transaction-id { text-align: center; font-size: ${tpl.transactionIdFontSize}px; color: #666; margin: 8px 0 12px 0; letter-spacing: -0.05em; font-weight: 600; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 4px 6px 0; border-bottom: 1px dashed #ddd; margin-bottom: 12px; font-size: ${tpl.dateTimeFontSize}px; }
        .info-row .left { font-weight: 600; color: #333; }
        .info-row .right { font-weight: 500; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        thead th { background: #f5f5f5; color: #111; padding: 8px 8px; font-size: ${tpl.tableHeaderFontSize}px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.5px; border-bottom: 2px solid #111; text-align: left; }
        thead th:nth-child(1) { text-align: center; width: 8%; }
        thead th:nth-child(2) { text-align: left; width: 32%; }
        thead th:nth-child(3) { text-align: right; width: 15%; }
        thead th:nth-child(4) { text-align: right; width: 15%; }
        thead th:nth-child(5) { text-align: right; width: 30%; }
        tbody tr:last-child td { border-bottom: 2px solid #111; }
        tbody td { padding: 6px 8px; font-size: ${tpl.tableBodyFontSize}px; }
        tbody td:nth-child(1) { text-align: center; }
        tbody td:nth-child(3), tbody td:nth-child(4), tbody td:nth-child(5) { text-align: right; }
        .grand-total-row { margin-top: 10px; padding: 10px 8px; background: #f5f5f5; border: 2px solid #111; display: flex; justify-content: space-between; align-items: center; font-size: ${tpl.grandTotalFontSize}px; font-weight: 700; }
        .grand-total-row .label { text-transform: uppercase; letter-spacing: -0.5px; color: #111; }
        .grand-total-row .amount { color: #111; font-size: ${tpl.grandTotalFontSize + 1}px; }
        .footer { margin-top: 24px; display: flex; justify-content: space-between; align-items: center; padding: 12px 4px 0 0; border-top: 1px solid #ddd; font-size: ${tpl.footerFontSize}px; color: #666; }
        .footer .left { font-weight: 400; }
        .footer .right { font-weight: 600; color: #111; }
        .signature { margin-top: 30px; display: flex; justify-content: flex-end; padding-top: 6px; width: 140px; margin-left: auto; text-align: center; border-top: 1px solid #111; font-size: ${tpl.signatoryFontSize}px; color: #555; }
        @media print { body { padding: ${isThermal ? "0 4px" : "20px"}; } .no-print { display: none; } }
        @media screen { body { box-shadow: 0 2px 20px rgba(0,0,0,0.08); border-radius: 8px; padding: 30px; } }
      </style>
    </head>
    <body>
      ${renderReceiptHeader({ appName: displayAppName, centreName, transactionId: txn.transaction_id, t })}

      ${showDateTime ? `
      <div class="info-row">
        <span class="left">${dateStr}</span>
        <span class="right">${timeStr}</span>
      </div>` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding: 6px 4px 6px 0; font-size: ${tpl.sellerNameFontSize}px;">
        ${showSellerCode && txn.seller_code ? `<span style="font-size: ${tpl.sellerCodeFontSize}px; color: #000000; font-weight:700;">Farmer Code: <span style="font-weight: 700;">${txn.seller_code}</span></span>` : ''}
        <span style="font-weight: 700; color: #000000;">${txn.seller_name || "—"}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>${t('productSales.receipt.no') || '#'}</th>
            <th>${tpl.productLabel || t('productSales.receipt.product') || 'Product'}</th>
            <th>${t('productSales.receipt.qty') || 'Qty'}</th>
            <th>${t('productSales.receipt.rate') || 'Rate'}</th>
            <th>${t('productSales.receipt.amount') || 'Amount'}</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="grand-total-row">
        <span class="label">${t('productSales.receipt.grandTotal') || 'Grand Total'}</span>
        <span class="amount">₹${grandTotal.toFixed(2)}</span>
      </div>

      ${renderReceiptFooter()}

      <div style="text-align:start; margin-top: 14px; padding-top: 8px; font-size: 8px; letter-spacing: -0.6px; color: #999;">
        PRAVAS DIGITAL VISION SYSTEMS PVT. LTD.
      </div>
    </body>
    </html>
  `;

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
    setTimeout(() => {
      onReady?.();
      iframe.contentWindow.focus();

      const cleanup = () => {
        onDone?.();
        iframe.contentWindow.removeEventListener("afterprint", cleanup);
        setTimeout(() => document.body.removeChild(iframe), 300);
      };
      iframe.contentWindow.addEventListener("afterprint", cleanup);

      iframe.contentWindow.print();
      setTimeout(cleanup, 8000);
    }, 300);
  };
};