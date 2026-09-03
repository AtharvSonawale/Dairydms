// components/ReceiptPDF.jsx
import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download, X } from 'lucide-react';

// ── A5 scaling ────────────────────────────────────────────────
// A5 landscape (210mm x 148mm) is ONE ISO 216 step below A4 landscape
// (297mm x 210mm) — each step down halves the *area*, so dimensions
// scale by 1/√2 (~0.7071), not 0.5. So every mm-based dimension, font
// size, and line width below is multiplied by SCALE to reproduce the
// identical layout shrunk to true A5 size, instead of an oversized
// A4 layout hanging off the page.
const SCALE = 1 / Math.sqrt(2); // ≈ 0.7071 — A4 landscape → A5 landscape
const mm = (n) => n * SCALE;

// jsPDF's built-in "helvetica" font has no glyph for ₹, →, or typographic
// dashes (−, –, —), which causes garbled characters and mis-measured
// (right-align) text that gets clipped or spaced out oddly.
// Replace them with plain ASCII before drawing.
const clean = (str) =>
    String(str)
        .replace(/₹/g, 'Rs. ')
        .replace(/→/g, '->')
        .replace(/[−–—]/g, '-');

// Parse a date value into {day, month, year} WITHOUT relying on the
// built-in `new Date(string)` constructor, which is ambiguous for
// non-ISO strings and can silently produce a wrong year (this is what
// was causing dates to show as 2001 instead of 2026).
// Returns null if the format isn't recognised. `year` is null when the
// source string has no year of its own (e.g. "13/08").
const parseDateParts = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return { day: value.getDate(), month: value.getMonth() + 1, year: value.getFullYear() };
    }

    const str = String(value).trim();

    // ISO: YYYY-MM-DD (optionally with a time component)
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return { year: +m[1], month: +m[2], day: +m[3] };

    // DD/MM/YYYY
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return { day: +m[1], month: +m[2], year: +m[3] };

    // DD/MM with no year
    m = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m) return { day: +m[1], month: +m[2], year: null };

    return null;
};

const pad2 = (n) => String(n).padStart(2, '0');

// Always render as DD/MM/YYYY. `fallbackYear` is used only when the
// source value has no year of its own (e.g. "13/08") - pass the
// receipt's own billing-cycle year here, not the current year.
const formatDate = (value, fallbackYear) => {
    const parts = parseDateParts(value);
    if (!parts) return value ? String(value) : '';

    const year = parts.year ?? fallbackYear ?? new Date().getFullYear();
    return `${pad2(parts.day)}/${pad2(parts.month)}/${year}`;
};

const ReceiptPDF = ({ data, onClose }) => {
    const generatePDF = () => {
        // Derive the correct year for any entry date that doesn't carry
        // its own year (e.g. "13/08"), from the receipt's billing period
        // instead of defaulting to "today".
        const cycleYear =
            (parseDateParts(data.endDate) || parseDateParts(data.startDate) || {}).year ||
            new Date().getFullYear();

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a5',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = mm(8);
        let y = mm(10);

        // ---------- Header ----------
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(mm(16));
        doc.text('Kumbhar Dairy', marginX, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(mm(8.5));
        doc.setTextColor(60, 60, 60);
        doc.text('Milk Collection Receipt', marginX, y + mm(5));

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(mm(10.5));
        doc.text(
            `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`,
            pageWidth - marginX,
            y,
            { align: 'right' }
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(mm(8.5));
        doc.setTextColor(60, 60, 60);
        doc.text(`Bill No.: ${data.billNo}`, pageWidth - marginX, y + mm(4.5), {
            align: 'right',
        });
        doc.text(`Generated: ${formatDate(data.generatedDate)}`, pageWidth - marginX, y + mm(8.5), {
            align: 'right',
        });

        y += mm(12);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(mm(0.5));
        doc.line(marginX, y, pageWidth - marginX, y);
        y += mm(5);

        // ---------- Compact info strip ----------
        // ── UPDATED: Even more width for SELLER NAME ──
        const stripItems = [
            { label: 'SELLER NAME', value: data.sellerName, width: 2.0 },  // 2.0x width (was 1.5)
            { label: 'SELLER CODE', value: data.sellerCode, width: 0.7 },
            { label: 'STATUS', value: data.status, width: 0.7 },
            { label: 'TOTAL ENTRIES', value: data.totalEntries, width: 0.7 },
            { label: 'TOTAL QTY', value: data.totalQty, width: 0.7 },
            { label: 'MORNING/EVENING', value: data.morningEvening, width: 0.7 },
            { label: 'COW/BUFFALO', value: data.cowBuffalo, width: 0.7 },
            { label: 'AVG FAT / AVG SNF', value: data.avgFatSnf, width: 0.6 },
        ];

        // Calculate total width units
        const totalWidthUnits = stripItems.reduce((sum, item) => sum + item.width, 0);
        const stripBoxH = mm(13);

        doc.setFillColor(242, 242, 242);
        doc.setDrawColor(85, 85, 85);
        doc.setLineWidth(mm(0.25));
        doc.roundedRect(
            marginX,
            y,
            pageWidth - 2 * marginX,
            stripBoxH,
            mm(1),
            mm(1),
            'FD'
        );

        let currentX = marginX;
        stripItems.forEach((item) => {
            const itemWidth = ((pageWidth - 2 * marginX) * item.width) / totalWidthUnits;
            const x = currentX + mm(3);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(mm(6));
            doc.setTextColor(51, 51, 51);
            doc.text(item.label, x, y + mm(5));

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(mm(8.3));
            doc.setTextColor(0, 0, 0);

            // ── IMPROVED: Better truncation for seller names ──
            let displayValue = item.value;
            if (item.label === 'SELLER NAME') {
                // Calculate available width for seller name
                const availableWidth = itemWidth - mm(8); // padding
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(mm(8.3));
                const fullWidth = doc.getTextWidth(clean(item.value));

                if (fullWidth > availableWidth) {
                    // Try to fit with ellipsis
                    let truncated = item.value;
                    while (truncated.length > 0) {
                        const testStr = truncated + '..';
                        const testWidth = doc.getTextWidth(clean(testStr));
                        if (testWidth <= availableWidth) {
                            displayValue = testStr;
                            break;
                        }
                        truncated = truncated.slice(0, -1);
                    }
                    if (displayValue === item.value) {
                        displayValue = item.value.substring(0, 20) + '..';
                    }
                }
            }

            doc.text(clean(displayValue), x, y + mm(10));

            currentX += itemWidth;
        });

        y += stripBoxH + mm(5);

        // ---------- Daily entry table ----------
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(mm(9));
        doc.setTextColor(0, 0, 0);
        doc.text('DAILY ENTRY BREAKDOWN', marginX, y);
        y += mm(2.5);

        const head = [
            [
                { content: 'Date', rowSpan: 2 },
                { content: 'Morning Shift', colSpan: 5 },
                { content: 'Evening Shift', colSpan: 5 },
                { content: 'Day Total', rowSpan: 2 },
            ],
            [
                'Qty(L)',
                'Fat%',
                'SNF',
                'Rate',
                'Amt',
                'Qty(L)',
                'Fat%',
                'SNF',
                'Rate',
                'Amt',
            ],
        ];

        // Build body from data
        const body = data.entries.map((entry) => [
            formatDate(entry.date, cycleYear),
            entry.morning.qty,
            entry.morning.fat,
            entry.morning.snf,
            entry.morning.rate,
            entry.morning.amt,
            entry.evening.qty,
            entry.evening.fat,
            entry.evening.snf,
            entry.evening.rate,
            entry.evening.amt,
            entry.dayTotal,
        ]);

        // Add total row
        body.push([
            'Total',
            data.totals.morning.qty,
            data.totals.morning.fat,
            data.totals.morning.snf,
            '—',
            '—',
            data.totals.evening.qty,
            data.totals.evening.fat,
            data.totals.evening.snf,
            '—',
            '—',
            data.totals.dayTotal,
        ]);

        const totalRowIndex = body.length - 1;

        const colWidths = {
            0: mm(23),
            1: mm(23),
            2: mm(21),
            3: mm(21),
            4: mm(24),
            5: mm(26),
            6: mm(23),
            7: mm(21),
            8: mm(21),
            9: mm(24),
            10: mm(26),
            11: mm(28),
        };

        const columnStyles = {};
        Object.keys(colWidths).forEach((k) => {
            columnStyles[k] = { cellWidth: colWidths[k] };
        });
        columnStyles[5].fillColor = [255, 255, 255];
        columnStyles[10].fillColor = [255, 255, 255];
        columnStyles[11].fontStyle = 'bold';
        columnStyles[11].fillColor = [240, 244, 255];

        autoTable(doc, {
            startY: y,
            head: head,
            body: body,
            theme: 'grid',
            tableWidth: 'wrap',
            styles: {
                font: 'helvetica',
                fontSize: mm(7),
                cellPadding: mm(1.3),
                halign: 'center',
                valign: 'middle',
                textColor: [0, 0, 0],
                lineColor: [68, 68, 68],
                lineWidth: mm(0.2),
            },
            headStyles: {
                fillColor: [224, 224, 224],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: mm(6.6),
                halign: 'center',
                valign: 'middle',
            },
            columnStyles: columnStyles,
            margin: {
                left: marginX,
                right: marginX,
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.row.index === totalRowIndex) {
                    data.cell.styles.fillColor = [232, 232, 232];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.lineWidth = mm(0.3);
                }
                if (data.section === 'body') {
                    const rightAlignedColumns = [1, 4, 5, 6, 9, 10, 11];
                    const centerAlignedColumns = [0, 2, 3, 7, 8];

                    if (rightAlignedColumns.includes(data.column.index)) {
                        data.cell.styles.halign = 'right';
                    }

                    if (centerAlignedColumns.includes(data.column.index)) {
                        data.cell.styles.halign = 'center';
                    }
                }
            },
        });

        y = doc.lastAutoTable.finalY + mm(5);

        // ---------- Account Summary (3 columns) ----------
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(mm(9));
        doc.setTextColor(0, 0, 0);
        doc.text('ACCOUNT SUMMARY', marginX, y);
        y += mm(2.5);

        const summaryTop = y;

        const summaryW = pageWidth - 2 * marginX;
        const colW = summaryW / 3;

        const summaryPadX = mm(4);

        const headerH = mm(5.5);
        const rowH = mm(5);
        const totalH = mm(6);

        const summaryBoxH = headerH + rowH * 3 + totalH;

        const columns = [
            {
                title: 'ADVANCE ACCOUNT',
                rows: [
                    ['Opening Balance', data.advance.opening],
                    ['Given This Cycle', data.advance.given],
                    ['Installment Cut', data.advance.cut],
                ],
                total: ['Closing Balance', data.advance.closing],
            },
            {
                title: 'DEPOSIT ACCOUNT',
                rows: [
                    ['Opening Balance', data.deposit.opening],
                    ['Added This Cycle', data.deposit.added],
                    [`${data.deposit.qtyFormula}`, 'formula'],
                ],
                total: ['Closing Balance', data.deposit.closing],
            },
            {
                title: 'PAYMENT SUMMARY',
                rows: [
                    ['Milk Amount', data.payment.milkAmount],
                    ['Deposit Cut', data.payment.depositCut],
                    ['Adv. Installment', data.payment.advInstallment],
                ],
                total: ['Net Cash to Hand', data.payment.netCash],
                totalDark: true,
            },
        ];

        columns.forEach((col, i) => {
            const x = marginX + i * colW;

            doc.setDrawColor(85, 85, 85);
            doc.setLineWidth(mm(0.5));
            doc.rect(x, summaryTop, colW, summaryBoxH);

            doc.setFillColor(204, 204, 204);
            doc.rect(x, summaryTop, colW, headerH, 'F');
            doc.setDrawColor(85, 85, 85);
            doc.setLineWidth(mm(0.2));
            doc.line(x, summaryTop + headerH, x + colW, summaryTop + headerH);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(mm(7.3));
            doc.setTextColor(0, 0, 0);
            doc.text(col.title, x + colW / 2, summaryTop + headerH / 2 + mm(1.2), {
                align: 'center',
            });

            let ry = summaryTop + headerH;
            col.rows.forEach((r, rowIndex) => {
                doc.setFillColor(255, 255, 255);
                doc.rect(x, ry, colW, rowH, 'F');
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(mm(0.15));
                doc.line(x, ry + rowH, x + colW, ry + rowH);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(mm(7.1));
                doc.setTextColor(51, 51, 51);
                doc.text(clean(r[0]), x + summaryPadX, ry + rowH / 2 + mm(1.3), {
                    align: 'left',
                });

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(mm(7.1));
                doc.setTextColor(0, 0, 0);
                doc.text(clean(r[1]), x + colW - summaryPadX, ry + rowH / 2 + mm(1.3), {
                    align: 'right',
                });

                ry += rowH;
            });

            if (col.totalDark) {
                doc.setFillColor(34, 34, 34);
                doc.rect(x, ry, colW, totalH, 'F');
                doc.setTextColor(255, 255, 255);
            } else {
                doc.setFillColor(232, 232, 232);
                doc.rect(x, ry, colW, totalH, 'F');
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(mm(0.35));
                doc.line(x, ry, x + colW, ry);
                doc.setTextColor(0, 0, 0);
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(mm(7.4));
            doc.text(clean(col.total[0]), x + summaryPadX, ry + totalH / 2 + mm(1.3), {
                align: 'left',
            });

            doc.text(clean(col.total[1]), x + colW - summaryPadX, ry + totalH / 2 + mm(1.3), {
                align: 'right',
            });

            if (i < columns.length - 1) {
                doc.setDrawColor(85, 85, 85);
                doc.setLineWidth(mm(0.3));
                doc.line(x + colW, summaryTop, x + colW, summaryTop + summaryBoxH);
            }
        });

        y = summaryTop + summaryBoxH + mm(5);

        // ---------- Detailed Breakdown (UPDATED with Product Cuts and Cattle Feed Cuts) ----------
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(mm(9));
        doc.setTextColor(0, 0, 0);
        doc.text('DETAILED BREAKDOWN', marginX, y);
        y += mm(2.5);

        const breakdownTop = y;
        const breakdownW = pageWidth - 2 * marginX;
        const breakdownPadLeft = mm(4);
        const breakdownPadRight = mm(4);
        const dRowH = mm(5.2);
        const netRowH = mm(8);

        // ── Build rows dynamically, including product cuts and cattle feed cuts ──
        const dRows = [
            {
                label: 'Milk Amount Payable',
                sub: '',
                value: data.breakdown.milkAmount,
                fill: [240, 253, 244],
            },
            {
                label: 'Opening Advance Balance',
                sub: '',
                value: data.breakdown.openingAdvance,
                fill: [250, 245, 255],
            },
            {
                label: 'Advance Installment Cut',
                sub: data.breakdown.advanceSub || '',
                value: data.breakdown.advanceCut,
                fill: [255, 245, 245],
            },
            {
                label: 'Deposit Deducted',
                sub: data.breakdown.depositSub || '',
                value: data.breakdown.depositDeducted,
                fill: [239, 246, 255],
            },
            // ── Product Cuts ──
            {
                label: 'Product Cuts',
                sub: data.breakdown.productSub || '',
                value: data.breakdown.productCut || 'Rs. 0.00',
                fill: [254, 243, 199], // amber tint
            },
            // ── Cattle Feed Cuts ──
            {
                label: 'Cattle Feed Cuts',
                sub: data.breakdown.cattleFeedSub || '',
                value: data.breakdown.cattleFeedCut || 'Rs. 0.00',
                fill: [209, 250, 229], // emerald tint
            },
        ];

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(mm(0.4));
        doc.rect(
            marginX,
            breakdownTop,
            breakdownW,
            dRowH * dRows.length + netRowH
        );

        let dy = breakdownTop;
        dRows.forEach((row, idx) => {
            doc.setFillColor(row.fill[0], row.fill[1], row.fill[2]);
            doc.rect(marginX, dy, breakdownW, dRowH, 'F');

            if (idx < dRows.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(mm(0.15));
                doc.line(marginX, dy + dRowH, marginX + breakdownW, dy + dRowH);
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(mm(8));
            doc.setTextColor(0, 0, 0);
            doc.text(clean(row.label), marginX + breakdownPadLeft, dy + dRowH / 2 + mm(1), {
                align: 'left',
            });

            if (row.sub) {
                const labelWidth = doc.getTextWidth(row.label);
                doc.setFontSize(mm(5.8));
                doc.setTextColor(102, 102, 102);
                doc.text(clean(row.sub), marginX + breakdownPadLeft + labelWidth + mm(2), dy + dRowH / 2 + mm(1), {
                    align: 'left',
                });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(mm(7.6));
            doc.setTextColor(0, 0, 0);
            doc.text(clean(row.value), marginX + breakdownW - breakdownPadRight, dy + dRowH / 2 + mm(1), {
                align: 'right',
            });

            dy += dRowH;
        });

        // ── Net Cash to Hand (dark footer) ──
        doc.setFillColor(34, 34, 34);
        doc.rect(marginX, dy, breakdownW, netRowH, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(mm(0.4));
        doc.line(marginX, dy, marginX + breakdownW, dy);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(mm(10.5));
        doc.setTextColor(255, 255, 255);
        doc.text('Net Cash to Hand', marginX + breakdownPadLeft, dy + netRowH / 2 + mm(1.5), {
            align: 'left',
        });

        doc.text(clean(data.breakdown.netCash), marginX + breakdownW - breakdownPadRight, dy + netRowH / 2 + mm(1.5), {
            align: 'right',
        });

        y = dy + netRowH + mm(4);

        // ---------- Footer ----------
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(mm(0.2));
        doc.line(marginX, y, pageWidth - marginX, y);
        y += mm(4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(mm(7));
        doc.setTextColor(102, 102, 102);
        doc.text('Computer Generated - Kumbhar Dairy', marginX, y);
        doc.text(`Paid On: ${formatDate(data.paidOn)}`, pageWidth - marginX, y, {
            align: 'right',
        });

        doc.save(`Kumbhar_Dairy_Receipt_${data.billNo}.pdf`);
        onClose();
    };

    const previewCycleYear =
        (parseDateParts(data.endDate) || parseDateParts(data.startDate) || {}).year ||
        new Date().getFullYear();

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/60 w-full max-w-md shadow-2xl p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                            <FileText size={18} className="text-blue-500" />
                            Download Receipt
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {data.sellerName} - {data.billNo}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/60">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-gray-500">Seller:</span>
                            <span className="font-medium text-gray-800">{data.sellerName}</span>
                            <span className="text-gray-500">Bill No.:</span>
                            <span className="font-medium text-gray-800">{data.billNo}</span>
                            <span className="text-gray-500">Period:</span>
                            <span className="font-medium text-gray-800">{formatDate(data.startDate)} - {formatDate(data.endDate)}</span>
                            <span className="text-gray-500">Total Amount:</span>
                            <span className="font-medium text-gray-800">{data.payment.milkAmount}</span>
                        </div>
                    </div>

                    <button
                        onClick={generatePDF}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
                    >
                        <Download size={15} />
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptPDF;