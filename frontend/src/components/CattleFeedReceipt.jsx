// CattleFeedReceipt.jsx
import { getPrintSettings } from "../utils/printSettings";
import { getReceiptTemplate } from "../utils/receiptTemplate";
import { renderReceiptHeader, renderReceiptFooter } from "../utils/receiptTemplateRenderer";
import QRCode from "qrcode";

export const printReceipt = async (txn, t, appName, centreName, { onStart, onReady, onDone } = {}) => {
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
      <td style="text-align:center;">${i + 1}</td>
      <td>${item.feed_name || t('cattleFeedSales.receipt.unknown') || "—"}</td>
      <td style="text-align:right;">${parseFloat(item.quantity).toFixed(2)}</td>
      <td style="text-align:right;">${parseFloat(item.rate).toFixed(2)}</td>
      <td style="text-align:right;">${parseFloat(item.total_amount || item.quantity * item.rate).toFixed(2)}</td>
    </tr>
  `).join("");

  const grandTotal = txn.items.reduce((s, i) => s + parseFloat(i.total_amount || i.quantity * i.rate || 0), 0);
  const showDateTime = tpl.showDateTime;
  const showSellerCode = tpl.showSellerCode;
  const modeClass = isThermal ? "mode-thermal" : "mode-a4";

  // ── QR code for pickup verification at the feed storage ──
  let qrDataUrl = "";
  if (txn.fulfillment_token) {
    try {
      const verifyUrl = `${window.location.origin}/feed-scan/${txn.fulfillment_token}`;
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: isThermal ? 130 : 160,
        color: { dark: "#2F4B3C", light: "#00000000" },
      });
    } catch {
      qrDataUrl = "";
    }
  }

  // A small hand-drawn-style wheat sheaf — the one recurring emblem in the
  // design, used sparingly as a divider glyph and inside the ink seal.
  const wheatGlyph = (size, color) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 44V14" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 14C24 14 14 12 12 4" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 14C24 14 34 12 36 4" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 22C24 22 15 20 13 13" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 22C24 22 33 20 35 13" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 30C24 30 16 28.5 14.5 22.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 30C24 30 32 28.5 33.5 22.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${t('cattleFeedSales.receipt.title') || 'Receipt'}_${txn.transaction_id}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --paper: #F6F7F1;
          --paper-grain: #EFF1E8;
          --ink: #2F4B3C;
          --ink-soft: #4A6355;
          --charcoal: #2B2B28;
          --muted: #A79C8A;
          --hairline: #D9D4C4;
          --mustard: #C8871E;
          --seal: #8B3A2E;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        @page {
          size: ${isThermal ? `${paperWidthMm}mm auto` : "A4"};
          margin: ${isThermal ? "2mm 3mm" : "12mm"};
        }
        body {
          font-family: 'Inter', 'Arial', 'Helvetica', sans-serif;
          -webkit-font-smoothing: antialiased;
          padding: ${isThermal ? "1px 2px" : "0"};
          color: var(--charcoal);
          background: ${isThermal ? "#fff" : "var(--paper)"};
        }
        .receipt-shell {
          max-width: ${isThermal ? `${paperWidthMm - 10}mm` : "600px"};
          width: ${isThermal ? `${paperWidthMm - 10}mm` : "auto"};
          margin: 0 auto;
          font-size: ${isThermal ? "9px" : "13px"};
          line-height: 1.15;
          letter-spacing: -0.01em;
          background: #fff;
          position: relative;
          ${isThermal ? "" : "box-shadow: 0 1px 2px rgba(47,75,60,0.06), 0 12px 32px rgba(47,75,60,0.10); border-radius: 3px; overflow: hidden;"}
        }

        /* ── Torn-ticket edge: only meaningful on a full sheet, skipped on thermal to save paper ── */
        .tear-edge {
          height: 10px;
          background:
            radial-gradient(circle at 8px 0, transparent 7px, #fff 7.5px) top left / 16px 10px repeat-x;
        }
        .mode-thermal .tear-edge { display: none; }

        .header-frame {
          padding: ${isThermal ? "3px 0 4px" : "22px 26px 10px"};
          text-align: center;
          border-bottom: 1px solid var(--hairline);
        }
        .shri {
          font-family: 'Fraunces', Georgia, serif;
          font-size: ${Math.min(tpl.topSymbolFontSize || 14, 14)}px;
          font-weight: 600;
          color: var(--muted);
          letter-spacing: 0.04em;
          margin-bottom: 1px;
          line-height: 1;
        }
        .app-name {
          font-family: 'Fraunces', Georgia, serif;
          font-size: ${Math.min(tpl.appNameFontSize || 14, 14)}px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.01em;
          margin-top: 1px;
          line-height: 1.15;
        }
        .center-name {
          font-family: 'Inter', 'Arial', sans-serif;
          font-size: ${Math.min(tpl.centreNameFontSize || 11, 11)}px;
          font-weight: 500;
          color: var(--ink-soft);
          margin-top: 2px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          line-height: 1.1;
        }
        .transaction-id {
          text-align: center;
          font-family: 'Inter', 'Arial', sans-serif;
          font-size: ${Math.min(tpl.transactionIdFontSize || 9, 9)}px;
          color: var(--muted);
          margin: 5px 0 0 0;
          letter-spacing: 0.04em;
          font-weight: 600;
          line-height: 1.1;
        }

        /* ── Grain-glyph divider: the one recurring emblem in the design ── */
        .thread-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: ${isThermal ? "3px 0" : "7px 0"};
        }
        .thread-divider .line {
          flex: 1;
          max-width: ${isThermal ? "26px" : "64px"};
          height: 1px;
          background: var(--hairline);
        }
        .thread-divider svg { display: block; opacity: 0.85; }

        .body-frame { padding: ${isThermal ? "0" : "0 26px"}; }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 0;
          border-bottom: 1px dashed var(--hairline);
          margin-bottom: 5px;
          font-size: ${Math.min(tpl.dateTimeFontSize || 9, 9)}px;
          line-height: 1.1;
        }
        .info-row .left {
          font-weight: 600;
          color: var(--ink-soft);
          letter-spacing: 0.03em;
        }
        .info-row .right {
          font-weight: 600;
          color: var(--charcoal);
          font-variant-numeric: tabular-nums;
        }

        .seller-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          padding: 4px 6px;
          background: var(--paper-grain);
          border-radius: 2px;
          font-size: ${Math.min(tpl.sellerNameFontSize || 9, 9)}px;
          line-height: 1.1;
        }
        .seller-code {
          font-size: ${Math.min(tpl.sellerCodeFontSize || 9, 9)}px;
          color: var(--ink);
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .seller-name {
          font-weight: 700;
          color: var(--charcoal);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 2px;
        }
        thead th {
          background: var(--ink);
          color: #fff;
          padding: 5px 6px;
          font-family: 'Inter', 'Arial', sans-serif;
          font-size: ${Math.min(tpl.tableHeaderFontSize || 8, 8)}px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: left;
          line-height: 1.1;
        }
        thead th:first-child { border-radius: 2px 0 0 0; }
        thead th:last-child { border-radius: 0 2px 0 0; }
        thead th:nth-child(1) { text-align: center; width: 8%; }
        thead th:nth-child(2) { text-align: left; width: 32%; }
        thead th:nth-child(3) { text-align: right; width: 15%; }
        thead th:nth-child(4) { text-align: right; width: 15%; }
        thead th:nth-child(5) { text-align: right; width: 30%; }

        tbody tr:nth-child(even) { background: var(--paper-grain); }
        tbody tr:last-child td { border-bottom: 1.5px solid var(--ink); }
        tbody td {
          padding: 3px 6px;
          font-size: ${Math.min(tpl.tableBodyFontSize || 8, 8)}px;
          line-height: 1.2;
          border-bottom: 0.5px solid var(--hairline);
        }
        tbody td:nth-child(1) { text-align: center; color: var(--muted); font-weight: 600; }
        tbody td:nth-child(3),
        tbody td:nth-child(4),
        tbody td:nth-child(5) { text-align: right; font-variant-numeric: tabular-nums; }

        .total-block {
          position: relative;
          margin-top: 6px;
        }
        .grand-total-row {
          padding: 6px 10px;
          background: var(--ink);
          border-radius: 2px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: ${Math.min(tpl.grandTotalFontSize || 10, 10)}px;
          font-weight: 700;
          line-height: 1.1;
          border-left: 4px solid var(--mustard);
        }
        .grand-total-row .label {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #EDECE3;
        }
        .grand-total-row .amount {
          color: #fff;
          font-family: 'Fraunces', Georgia, serif;
          font-size: ${Math.min((tpl.grandTotalFontSize || 10) + 3, 14)}px;
          font-variant-numeric: tabular-nums;
        }

        /* ── Ink-seal: a screen/A4 flourish only — kept off thermal to save ink & paper ── */
        .stamp-seal {
          display: none;
        }
        .mode-a4 .stamp-seal {
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          right: -10px;
          top: -18px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1.5px solid var(--seal);
          transform: rotate(-11deg);
          opacity: 0.85;
          background: rgba(139,58,46,0.03);
        }
        .stamp-seal::before {
          content: "";
          position: absolute;
          inset: 4px;
          border: 1px solid var(--seal);
          border-radius: 50%;
        }
        .stamp-seal span {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 6.5px;
          font-weight: 700;
          letter-spacing: 0.09em;
          color: var(--seal);
          text-transform: uppercase;
        }

        .footer {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0 0;
          border-top: 1px solid var(--hairline);
          font-size: ${Math.min(tpl.footerFontSize || 8, 8)}px;
          color: var(--muted);
          line-height: 1.1;
        }
        .footer .left { font-weight: 400; }
        .footer .right { font-weight: 600; color: var(--ink); }

        .signature {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
          width: 130px;
          margin-left: auto;
          text-align: center;
          border-top: 1px solid var(--charcoal);
          font-size: ${Math.min(tpl.signatoryFontSize || 8, 8)}px;
          color: var(--ink-soft);
          line-height: 1.1;
          letter-spacing: 0.03em;
        }

        /* ── Pickup stub: styled like a ticket you'd actually tear off ── */
        .pickup-stub {
          margin-top: 10px;
          padding: ${isThermal ? "8px 0 2px" : "12px 14px"};
          text-align: center;
          border-top: 1px dashed var(--hairline);
          position: relative;
        }
        .pickup-stub img {
          display: block;
          margin: 0 auto;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px var(--hairline);
          border-radius: 2px;
        }
        .pickup-stub .caption {
          font-size: ${isThermal ? '7px' : '9px'};
          color: var(--ink-soft);
          margin-top: 5px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .advertising {
          text-align: center;
          margin-top: 10px;
          padding: 6px 8px 8px;
          font-size: 6px;
          letter-spacing: 0.04em;
          color: var(--muted);
          line-height: 1.4;
          border-top: 1px solid var(--paper-grain);
        }

        @media print {
          body { background: #fff; padding: ${isThermal ? "1px 2px" : "0"}; }
          .receipt-shell { box-shadow: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body class="${modeClass}">
      <div class="receipt-shell">
        <div class="tear-edge" aria-hidden="true"></div>

        <div class="header-frame">
          <!-- Header (fully driven by the saved receipt template) -->
          ${renderReceiptHeader({ appName: displayAppName, centreName, transactionId: txn.transaction_id, t })}
        </div>

        <div class="thread-divider" aria-hidden="true">
          <span class="line"></span>
          ${wheatGlyph(isThermal ? 12 : 16, "#A79C8A")}
          <span class="line"></span>
        </div>

        <div class="body-frame">
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
          <div class="total-block">
            <div class="grand-total-row">
              <span class="label">${t('cattleFeedSales.receipt.grandTotal') || 'Grand Total'}</span>
              <span class="amount">₹${grandTotal.toFixed(2)}</span>
            </div>
            <div class="stamp-seal" aria-hidden="true">${wheatGlyph(16, "#8B3A2E")}</div>
          </div>

          <!-- Footer (fully driven by the saved receipt template) -->
          ${renderReceiptFooter()}

          ${qrDataUrl ? `
          <div class="pickup-stub">
            <img src="${qrDataUrl}" width="${isThermal ? 90 : 120}" height="${isThermal ? 90 : 120}" />
            <div class="caption">${t('cattleFeedSales.receipt.scanToCollect') || 'Scan at Feed Storage to collect'}</div>
          </div>` : ''}
        </div>

        <!-- Hardcoded advertising line — not user-configurable -->
        <div class="advertising">
          PRAVAS DIGITAL VISION SYSTEMS PVT. LTD.
        </div>
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
    // slightly longer delay so the imported webfonts (Fraunces / Inter)
    // and QR image have time to settle before the print dialog opens
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
    }, 450);
  };
};