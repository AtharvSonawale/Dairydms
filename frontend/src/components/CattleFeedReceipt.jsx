// CattleFeedReceipt.jsx
import { useTranslation } from "react-i18next";

export const printReceipt = (txn, t) => {
    const dateStr = new Date(txn.sale_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric"
    });

    const itemRows = txn.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.feed_name || "—"}</td>
      <td style="text-align:right">${parseFloat(item.quantity).toFixed(2)} ${item.unit || ""}</td>
      <td style="text-align:right">₹${parseFloat(item.rate).toFixed(2)}</td>
      <td style="text-align:right">₹${parseFloat(item.total_amount).toFixed(2)}</td>
    </tr>
  `).join("");

    const grandTotal = txn.items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);

    const html = `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>${t('cattleFeedSales.receipt.title')}_${txn.transaction_id}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:Arial,sans-serif; padding:24px; color:#111; max-width:480px; margin:0 auto; font-size:13px; }
      .title { text-align:center; font-size:17px; font-weight:800; letter-spacing:1px; text-transform:uppercase; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:14px; }
      .meta { display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; margin-bottom:14px; font-size:12px; }
      .meta .row { display:flex; gap:6px; }
      .meta .lbl { color:#666; min-width:70px; }
      .meta .val { font-weight:700; }
      table { width:100%; border-collapse:collapse; margin-bottom:0; }
      thead tr { background:#111; color:#fff; }
      thead th { padding:7px 10px; font-size:11px; text-align:left; text-transform:uppercase; }
      thead th:nth-child(n+3) { text-align:right; }
      tbody tr { border-bottom:1px solid #e5e7eb; }
      tbody td { padding:8px 10px; font-size:12px; }
      tbody td:nth-child(n+3) { text-align:right; }
      tfoot tr { border-top:2px solid #111; }
      tfoot td { padding:9px 10px; font-size:13px; font-weight:800; }
      tfoot td:last-child { text-align:right; }
      .sign { display:flex; justify-content:flex-end; margin-top:36px; font-size:12px; color:#555; border-top:1px solid #111; padding-top:6px; width:120px; margin-left:auto; text-align:center; }
      .txn-id { text-align:center; font-size:10px; color:#888; margin-bottom:10px; letter-spacing:0.05em; }
      @media print { body { padding:12px; } }
    </style>
    </head><body>
    <div class="title">${t('cattleFeedSales.receipt.title')}</div>
    <div class="txn-id">${t('cattleFeedSales.receipt.transactionId', { id: txn.transaction_id })}</div>
    <div class="meta">
      <div class="row"><span class="lbl">${t('cattleFeedSales.receipt.date')}:</span><span class="val">${dateStr}</span></div>
      <div class="row"><span class="lbl">${t('cattleFeedSales.receipt.time')}:</span><span class="val">${new Date(txn.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
      <div class="row"><span class="lbl">${t('cattleFeedSales.receipt.custNo')}:</span><span class="val">${txn.seller_code || "—"}</span></div>
      <div class="row"><span class="lbl">${t('cattleFeedSales.receipt.custName')}:</span><span class="val">${txn.seller_name || "—"}</span></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:32px">${t('cattleFeedSales.receipt.no')}</th>
        <th>${t('cattleFeedSales.receipt.feed')}</th>
        <th style="text-align:right">${t('cattleFeedSales.receipt.qty')}</th>
        <th style="text-align:right">${t('cattleFeedSales.receipt.rate')}</th>
        <th style="text-align:right">${t('cattleFeedSales.receipt.amount')}</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr>
        <td colspan="4">${t('cattleFeedSales.receipt.grandTotal')}</td>
        <td>₹${grandTotal.toFixed(2)}</td>
      </tr></tfoot>
    </table>
    <div class="sign">${t('cattleFeedSales.receipt.signatory')}</div>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
        win.onload = () => {
            win.document.title = `Receipt_${txn.transaction_id}`;
            setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 100);
        };
    }
};