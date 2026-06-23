import { useAppConfig } from '../context/AppConfigContext';
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    FileText, RefreshCw, Printer, Search, Users,
    TrendingUp, Banknote, BadgeCheck, AlertTriangle, X
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

const now = new Date();
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SumReport() {
    // ── All Hooks must be called unconditionally at the top ───────────────────
    const { t } = useTranslation();
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();
    const { appName } = useAppConfig();

    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate, setToDate] = useState(defaultTo);
    const [sellerTypeFilter, setSellerTypeFilter] = useState("utpadak");

    // Define `showFlash` as a Hook (before any early returns)
    const showFlash = useCallback((type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    }, []);

    // Define `fetchReport` as a Hook
    const fetchReport = useCallback(async () => {
        if (!fromDate || !toDate) return;
        setLoading(true);
        try {
            // Fetch seller payments
            const { data: payments } = await api.get(
                `/payments/seller-summary?from=${fromDate}&to=${toDate}`
            );
            const paymentsArr = Array.isArray(payments) ? payments : [];

            // Fetch net balance for each seller
            const sellersWithNetBalance = paymentsArr;

            // Initialize bonus maps
            let utpadakBonusMap = {};
            let gavaliBonusMap = {};

            // Fetch Utpadak bonus
            try {
                const { data: events } = await api.get("/bonus/events");
                if (Array.isArray(events)) {
                    for (const ev of events) {
                        const evFrom = ev.from_date?.split("T")[0];
                        const evTo = ev.to_date?.split("T")[0];
                        if (evFrom > toDate || evTo < fromDate) continue;
                        try {
                            const { data: reg } = await api.get(`/bonus/events/${ev.event_id}/register?from=${fromDate}&to=${toDate}`);
                            if (reg?.sellers && Array.isArray(reg.sellers)) {
                                reg.sellers.forEach(s => {
                                    utpadakBonusMap[s.seller_id] = (utpadakBonusMap[s.seller_id] || 0) +
                                        parseFloat(s.total_amt || s.total_bonus || 0);
                                });
                            }
                        } catch (err) {
                            console.error("Failed to fetch Utpadak bonus register:", err);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch Utpadak bonus events:", err);
            }

            // Fetch Gavali bonus
            try {
                const { data: gevents } = await api.get("/gavali-bonus/events");
                if (Array.isArray(gevents)) {
                    for (const ev of gevents) {
                        const evFrom = ev.from_date?.split("T")[0];
                        const evTo = ev.to_date?.split("T")[0];
                        if (evFrom > toDate || evTo < fromDate) continue;
                        try {
                            const { data: reg } = await api.get(`/gavali-bonus/events/${ev.event_id}/register?from=${fromDate}&to=${toDate}`);
                            if (reg?.sellers && Array.isArray(reg.sellers)) {
                                reg.sellers.forEach(s => {
                                    gavaliBonusMap[s.seller_id] = (gavaliBonusMap[s.seller_id] || 0) +
                                        parseFloat(s.total_bonus || s.total_amt || 0);
                                });
                            }
                        } catch (err) {
                            console.error("Failed to fetch Gavali bonus register:", err);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch Gavali bonus events:", err);
            }

            // Merge data with net balance and bonus
            // If no event bonus found, fall back to seller's own bonus_amount from summary
            // Default slabs for utpadak (same as UtpadakBonusRegister DEFAULT_SLABS)
            const DEFAULT_UTPADAK_SLABS = [
                { fat_min: 2.5, fat_max: 3.4, rate: 1.0 },
                { fat_min: 3.5, fat_max: 5.4, rate: 1.5 },
                { fat_min: 5.5, fat_max: 6.2, rate: 2.0 },
                { fat_min: 6.3, fat_max: 15.0, rate: 2.5 },
            ];
            const DEFAULT_GAVALI_RATES = { cow: 0.25, buffalo: 0.50 };

            const merged = sellersWithNetBalance.map(s => {
                const type = (s.seller_type || "").toLowerCase();
                const eventBonus = type === "gavali"
                    ? (gavaliBonusMap[s.seller_id] || 0)
                    : (utpadakBonusMap[s.seller_id] || 0);

                let bonus = eventBonus;

                // If no event bonus, compute locally from entries
                if (bonus === 0) {
                    const entries = s.entries || [];
                    if (type === "gavali") {
                        const cowQty = entries
                            .filter(e => (e.milk_type || "").toLowerCase() === "cow")
                            .reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                        const buffaloQty = entries
                            .filter(e => (e.milk_type || "").toLowerCase() === "buffalo")
                            .reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                        bonus = parseFloat(
                            (cowQty * DEFAULT_GAVALI_RATES.cow + buffaloQty * DEFAULT_GAVALI_RATES.buffalo).toFixed(2)
                        );
                    } else {
                        // utpadak — use fat slabs
                        entries.forEach(e => {
                            const fat = parseFloat(e.fat || 0);
                            const qty = parseFloat(e.quantity || 0);
                            const slab = DEFAULT_UTPADAK_SLABS.find(
                                sl => fat >= sl.fat_min && fat <= sl.fat_max
                            );
                            if (slab) bonus += qty * slab.rate;
                        });
                        bonus = parseFloat(bonus.toFixed(2));
                    }
                }

                return { ...s, bonus_amount: bonus };
            });

            setSellers(merged);
        } catch (err) {
            console.error("Failed to fetch report data:", err);
            showFlash("error", err.response?.data?.message || t('sumReport.loadError'));
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate, showFlash, t]);

    // Define `handlePrint` (not a Hook, but a regular function)
    const handlePrint = () => {
        if (filtered.length === 0) {
            showFlash("error", t('sumReport.noDataToPrint'));
            return;
        }

        const rows = filtered.map((s, i) => {
            return `
                <tr style="border-bottom:1px solid #e5e7eb;${i % 2 === 0 ? "" : "background:#f9fafb"}">
                    <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600;font-size:11px">${s.name}</td>
                    <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;font-family:monospace;font-size:11px;color:#3b82f6">
                        Rs.${parseFloat(s.deposit_balance || 0).toFixed(2)}
                    </td>
                    <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;font-family:monospace;font-size:11px;color:#10b981">Rs.${parseFloat(s.bonus_amount || s.total_bonus || 0).toFixed(2)}</td>
<td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:#111">Rs.${(parseFloat(s.deposit_balance || 0) + parseFloat(s.bonus_amount || 0)).toFixed(2)}</td>                    <td style="padding:7px 10px;border:1px solid #e5e7eb;min-width:90px"></td>
                </tr>
            `;
        }).join("");

        const totalDepositBal = filtered.reduce((a, s) => a + parseFloat(s.deposit_balance || 0), 0);
        const totalBonus = filtered.reduce((a, s) => a + parseFloat(s.bonus_amount || 0), 0);
        const totalAll = totalDepositBal + totalBonus;

        const win = window.open("", "_blank", "width=1100,height=900");
        if (!win) {
            showFlash("error", t('sumReport.popupBlocked'));
            return;
        }

        win.document.write(`<!DOCTYPE html><html><head>
            <title>${t('sumReport.pdfTitle')} - ${fromDate} ${t('sumReport.pdfTo')} ${toDate}</title>
            <style>
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 24px; }
                table { border-collapse: collapse; width: 100%; }
                @media print { @page { margin: 12px; size: A4 landscape; } }
            </style>
            </head><body>
            <div style="max-width:1050px;margin:0 auto">
                <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">
                    <div style="font-size:18px;font-weight:bold;letter-spacing:1px">${appName}</div>
                    <div style="font-size:12px;color:#555;margin-top:2px">${t('sumReport.pdfSubtitle')}</div>
                    <div style="font-size:11px;color:#888;margin-top:3px">
                        ${t('sumReport.period')}: ${new Date(fromDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        &nbsp;${t('sumReport.to')}&nbsp;${new Date(toDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        &nbsp;&nbsp;|&nbsp;&nbsp; ${t('sumReport.pdfGenerated')}: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                </div>

                <table style="border:1px solid #d1d5db;margin-bottom:16px;font-size:11px">
                    <thead>
                        <tr style="background:#111;color:#fff">
                            <th style="padding:8px 10px;border:1px solid #374151;text-align:left;white-space:nowrap">${t('sumReport.sellerName')}</th>
                            <th style="padding:8px 10px;border:1px solid #374151;text-align:right;white-space:nowrap">${t('sumReport.deposit')}</th>
                            <th style="padding:8px 10px;border:1px solid #374151;text-align:right;white-space:nowrap">${t('sumReport.bonus')}</th>
                            <th style="padding:8px 10px;border:1px solid #374151;text-align:right;white-space:nowrap">${t('sumReport.total')}</th>
                            <th style="padding:8px 10px;border:1px solid #374151;text-align:center;white-space:nowrap;min-width:90px">${t('sumReport.signature')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #111">
                            <td style="padding:8px 10px;border:1px solid #d1d5db;font-size:11px;color:#555">${t('sumReport.totalLabel')} (${filtered.length} ${t('sumReport.utpadakSellers')})</td>
                            <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;font-family:monospace;color:#3b82f6">Rs.${totalDepositBal.toFixed(2)}</td>
                            <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;font-family:monospace;color:#10b981">Rs.${totalBonus.toFixed(2)}</td>
                            <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;font-family:monospace;font-size:13px;font-weight:700">Rs.${totalAll.toFixed(2)}</td>
                            <td style="padding:8px 10px;border:1px solid #d1d5db"></td>
                        </tr>
                    </tbody>
                <table>

                <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:11px;color:#555">
                    <span>${t('sumReport.pdfFooter')}</span>
                    <span>${t('sumReport.pdfSignatory')}</span>
                </div>
            </div>
            <script>window.onload = () => { window.print(); };</script>
            </body></html>
        `);
        win.document.close();
    };

    // Use effect to fetch report on mount or date change
    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    // ── Early returns (must come AFTER all Hooks) ────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );
    if (!can('sum_report', 'R')) return <AccessDenied />;

    // ── Derived state (must come AFTER all Hooks and early returns) ───────────
    const filtered = sellers.filter((s) => {
        const type = (s.seller_type || "").toLowerCase();
        const matchType = sellerTypeFilter === "all" ? true : type === sellerTypeFilter;
        const matchSearch =
            (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (s.seller_code || "").toLowerCase().includes(search.toLowerCase());
        return matchType && matchSearch;
    });

    // ── Totals ───────────────────────────────────────────────────────────────
    const totalMilk = filtered.reduce((a, s) => a + parseFloat(s.milk_amount || 0), 0);
    const totalDeduction = filtered.reduce((a, s) => a + parseFloat(s.deposit_deduction || 0), 0);
    const totalAdvance = filtered.reduce((a, s) => a + parseFloat(s.advance_given || 0), 0);
    const totalCash = filtered.reduce((a, s) => a + parseFloat(s.cash_to_pay || 0), 0);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>

            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <FileText size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('sumReport.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('sumReport.pageSubtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-black text-white hover:bg-gray-800 transition"
                        >
                            <Printer size={13} /> {t('sumReport.printReport')}
                        </button>
                    </div>
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-3 flex-wrap no-print">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sumReport.from')}</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={e => setFromDate(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sumReport.to')}</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 sm:grid-cols-1 lg:grid-cols-3 gap-3">
                    <StatCard
                        label={t('sumReport.utpadakSellers')}
                        value={filtered.length}
                        icon={<Users size={14} />}
                        color="text-blue-600 bg-blue-50 border-blue-100"
                    />
                    <StatCard
                        label={t('sumReport.totalNetBalance')}
                        value={fmt(filtered.reduce((a, s) => a + parseFloat(s.net_balance || 0), 0))}
                        icon={<Banknote size={14} />}
                        color="text-blue-600 bg-blue-50 border-blue-100"
                    />
                    <StatCard
                        label={t('sumReport.totalBonus')}
                        value={fmt(filtered.reduce((a, s) => a + parseFloat(s.bonus_amount || s.total_bonus || 0), 0))}
                        icon={<Banknote size={14} />}
                        color="text-emerald-600 bg-emerald-50 border-emerald-100"
                    />
                </div>

                {/* Flash Message */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium no-print
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Search */}
                <div className="flex items-center gap-2 no-print">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('sumReport.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300"
                        />
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[["utpadak", t('sumReport.utpadak')], ["gavali", t('sumReport.gavali')], ["all", t('sumReport.all')]].map(([v, l]) => (
                            <button
                                key={v}
                                onClick={() => setSellerTypeFilter(v)}
                                className={`px-3 py-2 transition
                                    ${sellerTypeFilter === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-max">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    {[t('sumReport.sellerName'), t('sumReport.deposit'), t('sumReport.bonus'), t('sumReport.total')].map(h => (
                                        <th key={h} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left border-r border-gray-100 last:border-r-0 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center">
                                            <div className="flex items-center justify-center">
                                                <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-gray-300">
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText size={32} />
                                                <p className="text-sm">{t('sumReport.noData')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((s, i) => {
                                        return (
                                            <tr
                                                key={s.seller_id || i}
                                                className={`border-b border-gray-50 hover:bg-blue-50/20 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}
                                            >
                                                <td className="px-3 py-2.5 font-semibold text-gray-800 border-r border-gray-50 whitespace-nowrap">{s.name}</td>
                                                <td className="px-3 py-2.5 font-mono text-blue-600 font-semibold text-right border-r border-gray-50">
                                                    {fmt(parseFloat(s.deposit_balance || 0))}
                                                </td>
                                                <td className="px-3 py-2.5 font-mono text-emerald-600 font-semibold text-right border-r border-gray-50">
                                                    {fmt(parseFloat(s.bonus_amount || 0))}
                                                </td>
                                                <td className="px-3 py-2.5 font-mono font-bold text-gray-900 text-right border-r border-gray-50">
                                                    {fmt(parseFloat(s.deposit_balance || 0) + parseFloat(s.bonus_amount || 0))}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                                {filtered.length > 0 && (
                                    <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-bold">
                                        <td className="px-3 py-3 text-xs text-gray-600 border-r border-gray-100">
                                            {t('sumReport.totalLabel')} ({filtered.length} {t('sumReport.utpadakSellers')})
                                        </td>
                                        <td className="px-3 py-3 font-mono font-bold text-blue-600 text-right border-r border-gray-100">
                                            {fmt(filtered.reduce((a, s) => a + parseFloat(s.deposit_balance || 0), 0))}
                                        </td>
                                        <td className="px-3 py-3 font-mono font-bold text-emerald-600 text-right border-r border-gray-100">
                                            {fmt(filtered.reduce((a, s) => a + parseFloat(s.bonus_amount || 0), 0))}
                                        </td>
                                        <td className="px-3 py-3 font-mono font-bold text-gray-900 text-right border-r border-gray-100">
                                            {fmt(filtered.reduce((a, s) => a + parseFloat(s.deposit_balance || 0) + parseFloat(s.bonus_amount || 0), 0))}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}