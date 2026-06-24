import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Home, Save, AlertTriangle, BadgeCheck, RefreshCw,
    X, Sun, Moon, Milk, TrendingDown, Layers,
    FileText, Clock,
} from "lucide-react";
import api from "../../api/axios";
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmt = (v) => parseFloat(v || 0).toFixed(2);

const EMPTY_FORM = {
    shift: "morning",
    milk_type: "cow",
    quantity: "",
    purpose: "",
};

// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1 shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {icon}{label}
            </span>
            {children}
        </div>
    );
}

function TinyInput({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={`border border-gray-200 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function ToggleGroup({ value, onChange, options, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden h-[35px]">
            {options.map((opt, i) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`flex items-center gap-1.5 px-4 text-xs font-semibold transition
                        ${i > 0 ? "border-l border-gray-200" : ""}
                        ${value === opt.value
                            ? opt.activeClass
                            : "bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                    {opt.icon}{opt.label}
                </button>
            ))}
        </div>
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function OwnerUsage() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();
    const [form, setForm] = useState(EMPTY_FORM);
    const [entries, setEntries] = useState([]);
    const [stock, setStock] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [selectedDate, setSelectedDate] = useState(today());

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startOwnerUsageTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="usage-stats"]',
                    popover: { title: t('ownerUsage.totalUsed'), description: 'Summary of total milk used today, broken down by cow and buffalo, plus the total number of entries recorded.' },
                },
                {
                    element: '[data-tour="usage-stock"]',
                    popover: { title: t('ownerUsage.cowAvailable'), description: 'Live view of remaining stock available for cow, buffalo, and total — calculated after walk-in sales and prior usage entries.' },
                },
                {
                    element: '[data-tour="usage-form"]',
                    popover: { title: t('ownerUsage.newUsageEntry'), description: 'Select a shift and milk type, enter the quantity used, and optionally describe the purpose. Stock availability is shown inline to prevent over-entry.' },
                },
                {
                    element: '[data-tour="usage-table"]',
                    popover: { title: t('ownerUsage.colShift'), description: 'All usage entries for the selected date, listed with shift, milk type, quantity, purpose, and time recorded.' },
                },
            ],
        });
        driverObj.drive();
    };

    // fetch entries for date
    const fetchEntries = async (date) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/owner-usage?date=${date}`);
            setEntries(data);
        } catch {
            showFlash("error", t('ownerUsage.loadError'));
        } finally {
            setLoading(false);
        }
    };

    // fetch available stock for context
    const fetchStock = async (date) => {
        try {
            const { data } = await api.get(`/stock/available?date=${date}`);
            setStock(data);
        } catch {
            setStock(null);
        }
    };

    useEffect(() => {
        fetchEntries(selectedDate);
        fetchStock(selectedDate);
    }, [selectedDate]);

    // available stock for selected milk type
    const availableQty = stock
        ? form.milk_type === "cow"
            ? parseFloat(stock.available?.cow || stock.cow || 0)
            : parseFloat(stock.available?.buffalo || stock.buffalo || 0)
        : null;

    const exceedsStock = availableQty !== null &&
        form.quantity &&
        parseFloat(form.quantity) > availableQty;

    // save
    const handleSave = async () => {
        if (!form.quantity || parseFloat(form.quantity) <= 0) {
            showFlash("error", t('ownerUsage.quantityError'));
            return;
        }
        if (exceedsStock) {
            showFlash("error", t('ownerUsage.insufficientStock', { qty: availableQty.toFixed(2), type: form.milk_type === "cow" ? t('ownerUsage.cow') : t('ownerUsage.buffalo') }));
            return;
        }
        if (saving) return;

        setSaving(true);
        try {
            await api.post("/owner-usage", {
                usage_date: selectedDate,
                shift: form.shift,
                milk_type: form.milk_type,
                quantity: parseFloat(form.quantity),
                purpose: form.purpose.trim() || t('ownerUsage.personalUse'),
            });
            showFlash("success", t('ownerUsage.saveSuccess'));
            await fetchEntries(selectedDate);
            await fetchStock(selectedDate);
            setForm((p) => ({ ...p, quantity: "", purpose: "" }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('ownerUsage.saveError'));
        } finally {
            setSaving(false);
        }
    };

    // stats
    const totalUsed = entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const cowUsed = entries.filter((e) => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const buffaloUsed = entries.filter((e) => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const morningUsed = entries.filter((e) => e.shift === "morning").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const eveningUsed = entries.filter((e) => e.shift === "evening").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);

    // table
    const COLS = [t('ownerUsage.colShift'), t('ownerUsage.colMilkType'), t('ownerUsage.colQuantity'), t('ownerUsage.colPurpose'), t('ownerUsage.colTime')];
    const GRID = "100px 120px 100px 1fr 80px";
    
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('owner_usage', 'R')) return <AccessDenied />;
    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Home size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('ownerUsage.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('ownerUsage.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={startOwnerUsageTour}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('ownerUsage.dateLabel')}</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="usage-stats">
                    {[
                        { label: t('ownerUsage.totalUsed'), value: totalUsed.toFixed(2) + " L", icon: <TrendingDown size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('ownerUsage.cowUsed'), value: cowUsed.toFixed(2) + " L", icon: <Milk size={14} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                        { label: t('ownerUsage.buffaloUsed'), value: buffaloUsed.toFixed(2) + " L", icon: <Milk size={14} />, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                        { label: t('ownerUsage.entriesToday'), value: entries.length, icon: <Layers size={14} />, color: "text-violet-600 bg-violet-50 border-violet-100" },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                            <div className="shrink-0">{icon}</div>
                            <div>
                                <p className="text-xs text-gray-400 leading-none">{label}</p>
                                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Available Stock Banner */}
                {stock && (
                    <div className="grid grid-cols-3 gap-3" data-tour="usage-stock">
                        {[
                            {
                                label: t('ownerUsage.cowAvailable'),
                                value: parseFloat(stock.available?.cow ?? stock.cow ?? 0),
                                color: "bg-amber-50 border-amber-100 text-amber-800",
                                sub: "text-amber-500",
                            },
                            {
                                label: t('ownerUsage.buffaloAvailable'),
                                value: parseFloat(stock.available?.buffalo ?? stock.buffalo ?? 0),
                                color: "bg-blue-50 border-blue-100 text-blue-800",
                                sub: "text-blue-400",
                            },
                            {
                                label: t('ownerUsage.totalAvailable'),
                                value: parseFloat(stock.available?.total ?? stock.total ?? 0),
                                color: "bg-gray-900 border-gray-700 text-white",
                                sub: "text-gray-400",
                            },
                        ].map(({ label, value, color, sub }) => (
                            <div key={label} className={`px-5 py-4 rounded-2xl border flex flex-col gap-1 ${color}`}>
                                <p className={`text-[10px] font-semibold uppercase tracking-wider ${sub}`}>{label}</p>
                                <p className="text-2xl font-bold leading-tight">
                                    {value.toFixed(1)}
                                    <span className={`text-sm font-medium ml-1 ${sub}`}>L</span>
                                </p>
                                <p className={`text-[10px] ${sub}`}>{t('ownerUsage.afterWalkinAndUsage')}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
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

                {/* Entry Form */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5" data-tour="usage-form">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{t('ownerUsage.newUsageEntry')}</p>

                    <div className="flex items-start gap-4 flex-wrap">

                        {/* Shift toggle */}
                        <Field label={t('ownerUsage.shift')} icon={<Clock size={12} />}>
                            <ToggleGroup
                                value={form.shift}
                                onChange={(v) => set("shift", v)}
                                options={[
                                    {
                                        value: "morning",
                                        label: t('ownerUsage.morning'),
                                        icon: <Sun size={11} />,
                                        activeClass: "bg-amber-500 text-white",
                                    },
                                    {
                                        value: "evening",
                                        label: t('ownerUsage.evening'),
                                        icon: <Moon size={11} />,
                                        activeClass: "bg-indigo-500 text-white",
                                    },
                                ]}
                                t={t}
                            />
                        </Field>

                        {/* Milk type toggle */}
                        <Field label={t('ownerUsage.milkType')} icon={<Milk size={12} />}>
                            <ToggleGroup
                                value={form.milk_type}
                                onChange={(v) => set("milk_type", v)}
                                options={[
                                    {
                                        value: "cow",
                                        label: t('ownerUsage.cow'),
                                        activeClass: "bg-amber-500 text-white",
                                    },
                                    {
                                        value: "buffalo",
                                        label: t('ownerUsage.buffalo'),
                                        activeClass: "bg-blue-500 text-white",
                                    },
                                ]}
                                t={t}
                            />
                            {/* Available stock hint */}
                            {availableQty !== null && (
                                <p className={`text-[10px] font-medium mt-0.5 ${availableQty <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                                    {t('ownerUsage.available')}: <span className="font-bold">{availableQty.toFixed(2)} L</span>
                                    {availableQty <= 0 && " · ⚠ " + t('ownerUsage.noneLeft')}
                                </p>
                            )}
                        </Field>

                        {/* Quantity */}
                        <Field label={t('ownerUsage.quantity')} icon={<Layers size={12} />}>
                            <TinyInput
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.quantity}
                                onChange={(e) => set("quantity", e.target.value)}
                                placeholder="0.00"
                                className={`w-24 ${exceedsStock
                                    ? "bg-red-50 border-red-300 text-red-700"
                                    : "bg-blue-50 border-blue-200 text-blue-700"
                                    }`}
                            />
                            {exceedsStock && (
                                <p className="text-[10px] text-red-500 font-semibold mt-0.5">⚠ {t('ownerUsage.exceedsStock')}</p>
                            )}
                        </Field>

                        {/* Purpose */}
                        <Field label={t('ownerUsage.purpose')} icon={<FileText size={12} />}>
                            <TinyInput
                                value={form.purpose}
                                onChange={(e) => set("purpose", e.target.value)}
                                placeholder={t('ownerUsage.purposePlaceholder')}
                                className="w-52"
                            />
                        </Field>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            {entries.length} {entries.length === 1 ? t('ownerUsage.entry') : t('ownerUsage.entries')} {t('ownerUsage.on')}{" "}
                            {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {totalUsed > 0 && (
                                <span className="ml-2 text-gray-600 font-semibold">· {totalUsed.toFixed(2)} L {t('ownerUsage.totalUsed')}</span>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || availableQty <= 0}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                                ${saving || availableQty <= 0
                                    ? "bg-gray-300 cursor-not-allowed"
                                    : "bg-black hover:bg-gray-800 active:scale-95"}`}
                        >
                            <Save size={15} />
                            {saving ? t('ownerUsage.saving') : t('ownerUsage.recordUsage')}
                        </button>
                    </div>
                </div>

                {/* Shift summary mini-cards */}
                {entries.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: t('ownerUsage.morningUsage'), value: morningUsed, icon: <Sun size={13} />, color: "text-amber-700 bg-amber-50 border-amber-100" },
                            { label: t('ownerUsage.eveningUsage'), value: eveningUsed, icon: <Moon size={13} />, color: "text-indigo-700 bg-indigo-50 border-indigo-100" },
                        ].map(({ label, value, icon, color }) => (
                            <div key={label} className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${color}`}>
                                {icon}
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                    <p className="text-lg font-bold text-gray-900">{value.toFixed(2)} L</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Entries Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="usage-table">

                    {/* Header */}
                    <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Home size={32} />
                            <p className="text-sm">{t('ownerUsage.noEntries')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max w-full">
                                {[...entries].reverse().map((e, i) => (
                                    <div
                                        key={e.usage_id || i}
                                        className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}
                                    >
                                        {/* Shift */}
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                                                ${e.shift === "morning"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                                                    : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                                                {e.shift === "morning" ? <Sun size={8} /> : <Moon size={8} />}
                                                {e.shift === "morning" ? t('ownerUsage.morning') : t('ownerUsage.evening')}
                                            </span>
                                        </TableCell>

                                        {/* Milk type */}
                                        <TableCell>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                                                ${e.milk_type === "cow"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                                                    : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
                                                {e.milk_type === "cow" ? t('ownerUsage.cow') : t('ownerUsage.buffalo')}
                                            </span>
                                        </TableCell>

                                        {/* Quantity */}
                                        <TableCell className="text-blue-600 font-mono font-bold text-xs">
                                            {parseFloat(e.quantity).toFixed(2)} L
                                        </TableCell>

                                        {/* Purpose */}
                                        <TableCell className="text-gray-600 text-xs">
                                            {e.purpose || <span className="text-gray-300">{t('ownerUsage.personalUse')}</span>}
                                        </TableCell>

                                        {/* Time */}
                                        <TableCell className="text-gray-400 font-mono text-xs">
                                            {fmtTime(e.created_at)}
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totals footer */}
                    {entries.length > 0 && (
                        <div className="grid border-t-2 border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                {entries.length} {entries.length === 1 ? t('ownerUsage.entry') : t('ownerUsage.entries')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-blue-600 border-r border-gray-100">
                                {totalUsed.toFixed(2)} L
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• {t('ownerUsage.legendSubtraction')}</span>
                    <span>• {t('ownerUsage.legendStockUpdate')}</span>
                    <span>• {t('ownerUsage.legendPurposeDefault')}</span>
                </div>

            </main>
        </div>
    );
}