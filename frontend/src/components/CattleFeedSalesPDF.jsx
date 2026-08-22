// CattleFeedSalesPDF.jsx
import { useTranslation } from "react-i18next";

export const printSalesPDF = (data, rangeMode, fromDate, toDate, t) => {
    const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    const fmtT = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

    const modeLabel = rangeMode === "daily" ? t('cattleFeedSales.rangeDay')
        : rangeMode === "weekly" ? t('cattleFeedSales.rangeWeek')
            : rangeMode === "monthly" ? t('cattleFeedSales.rangeMonth') : t('cattleFeedSales.rangeCustom');

    const periodLabel = fromDate === toDate ? fmtD(fromDate) : `${fmtD(fromDate)} ${t('cattleFeedSales.pdf.report').toLowerCase()} ${fmtD(toDate)}`;
    const totalRevenueCalc = data.reduce((a, txn) => a + parseFloat(txn.total_amount || 0), 0);

    const qtyByUnit = data.reduce((acc, txn) => {
        txn.items.forEach((item) => {
            const unit = item.unit || "units";
            acc[unit] = (acc[unit] || 0) + parseFloat(item.quantity || 0);
        });
        return acc;
    }, {});

    const uniqueSellersCount = [...new Set(data.map((txn) => txn.seller_id))].length;

    const rows = [...data].reverse().map((txn, i) => {
        const feedsHtml = txn.items.map(item => `
      <div style="margin-bottom:3px">
        <span style="font-weight:600">${item.feed_name || `ID:${item.feed_id}`}</span>
        <span style="font-size:8px;color:#555"> (${item.unit || "—"})</span>
      </div>
    `).join("");

        const qtyHtml = txn.items.map(item => `<div style="margin-bottom:3px">${parseFloat(item.quantity).toFixed(2)}</div>`).join("");
        const rateHtml = txn.items.map(item => `<div style="margin-bottom:3px">₹${parseFloat(item.rate).toFixed(2)}</div>`).join("");

        return `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f2f2f2"}">
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;font-weight:600;color:#000">
          <div style="display:flex;align-items:center;gap:4px">
            <span style="background:#000;color:#fff;width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0">
              ${(txn.seller_name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <div style="font-size:8px;color:#555;font-family:monospace">${txn.seller_code || "—"}</div>
            </div>
          </div>
        </td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000">${feedsHtml}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:600;color:#000">${qtyHtml}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">${rateHtml}</td>
        <td style="padding:4px 6px;border:1px solid #999;background:#e0e0e0;font-size:9px;text-align:right;font-weight:700;color:#000">₹${parseFloat(txn.total_amount).toFixed(2)}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:8px;color:#333;font-family:monospace">
          ${fmtD(txn.sale_date)}<br/>
          <span style="font-size:8px">${fmtT(txn.created_at)}</span>
        </td>
      </tr>
    `;
    }).join("");

    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html><head>
    <title>${t('cattleFeedSales.pdf.title')} — ${periodLabel}</title>
    <style>
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: Arial, sans-serif; font-size: 9px; color: #000; margin: 0; padding: 16px; background: #fff; }
      table { border-collapse: collapse; width: 100%; }
      @media print {
        @page { margin: 8mm; size: A4 portrait; }
        body { padding: 0; }
      }
      @media screen {
        body { max-width: 175mm; margin: 0 auto; }
      }
    </style>
  </head><body>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
    <div>
      <div style="font-size:18px;font-weight:bold;color:#000">${t('cattleFeedSales.pdf.title')}</div>
      <div style="font-size:11px;color:#333;margin-top:3px">${t('cattleFeedSales.pdf.period', { mode: modeLabel, period: periodLabel })}</div>
      <div style="font-size:10px;color:#555;margin-top:2px">${t('cattleFeedSales.pdf.generated')} ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
    </div>
    <div style="display:flex;gap:10px">
      <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
        <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cattleFeedSales.pdf.sales')}</div>
        <div style="font-size:16px;font-weight:700;color:#000">${data.length}</div>
      </div>
      <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
        <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cattleFeedSales.pdf.sellers')}</div>
        <div style="font-size:16px;font-weight:700;color:#000">${uniqueSellersCount}</div>
      </div>
      <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
        <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cattleFeedSales.pdf.revenue')}</div>
        <div style="font-size:16px;font-weight:700;color:#000">₹${totalRevenueCalc.toFixed(2)}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr style="background:#000;color:#fff">
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:22%">${t('cattleFeedSales.pdf.seller')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:20%">${t('cattleFeedSales.pdf.feed')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:right;width:12%">${t('cattleFeedSales.pdf.qty')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:right;width:12%">${t('cattleFeedSales.pdf.rate')}</th>
        <th style="padding:5px 6px;border:1px solid #333;background:#333;font-size:9px;text-align:right;width:14%">${t('cattleFeedSales.pdf.amount')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:20%">${t('cattleFeedSales.pdf.dateTime')}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000">
        <td colspan="2" style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:700;color:#000">
          ${t('cattleFeedSales.pdf.grandTotal')} — ${data.length} ${t('cattleFeedSales.pdf.entries')} · ${uniqueSellersCount} ${t('cattleFeedSales.pdf.sellerCount', { count: uniqueSellersCount })}
        </td>
        <td style="padding:5px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:700;color:#000">
          ${Object.entries(qtyByUnit).map(([u, q]) => `${q.toFixed(2)} ${u}`).join(" · ")}
        </td>
        <td style="padding:5px 6px;border:1px solid #999;font-size:9px"></td>
        <td style="padding:5px 6px;border:1px solid #999;background:#d0d0d0;font-size:9px;text-align:right;font-weight:700;color:#000">₹${totalRevenueCalc.toFixed(2)}</td>
        <td style="padding:5px 6px;border:1px solid #999;font-size:9px"></td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#444">
    <span>${t('cattleFeedSales.pdf.footer')}</span>
    <span>${t('cattleFeedSales.pdf.signatory')}</span>
  </div>

  <script>window.onload = () => { window.print(); };<\/script>
  </body></html>`);
    win.document.close();
};