import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Home, Save, AlertTriangle, BadgeCheck, RefreshCw,
    X, Sun, Moon, Milk, TrendingDown, Layers,
    FileText, Clock,
    Trash,
    Trash2,
    Pencil,
    Settings,
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
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
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
            className={`border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function ToggleGroup({ value, onChange, options, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden h-[38px] shadow-sm">
            {options.map((opt, i) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`flex items-center gap-1.5 px-4 text-xs font-semibold transition
                        ${i > 0 ? "border-l border-gray-200/60" : ""}
                        ${value === opt.value
                            ? opt.activeClass
                            : "bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80"}`}
                >
                    {opt.icon}{opt.label}
                </button>
            ))}
        </div>
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-2.5 py-2 flex items-center border-r border-gray-100/60 last:border-r-0 text-sm ${className}`}>
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
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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

    // Handle edit: pre-fill form with entry data
    const handleEdit = (entry) => {
        setForm({
            shift: entry.shift,
            milk_type: entry.milk_type,
            quantity: entry.quantity.toString(),
            purpose: entry.purpose || "",
        });
        setEditingId(entry.usage_id);
    };

    // Handle delete confirmation
    const handleDelete = async (id) => {
        if (saving) return;
        setSaving(true);
        try {
            await api.delete(`/owner-usage/${id}`);
            showFlash("success", t('ownerUsage.deleteSuccess'));
            await fetchEntries(selectedDate);
            await fetchStock(selectedDate);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('ownerUsage.deleteError'));
        } finally {
            setSaving(false);
            setDeleteConfirmId(null);
        }
    };

    // Handle update (save edited entry)
    const handleUpdate = async () => {
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
            await api.put(`/owner-usage/${editingId}`, {
                usage_date: selectedDate,
                shift: form.shift,
                milk_type: form.milk_type,
                quantity: parseFloat(form.quantity),
                purpose: form.purpose.trim() || t('ownerUsage.personalUse'),
            });
            showFlash("success", t('ownerUsage.updateSuccess'));
            await fetchEntries(selectedDate);
            await fetchStock(selectedDate);
            setForm(EMPTY_FORM);
            setEditingId(null);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('ownerUsage.updateError'));
        } finally {
            setSaving(false);
        }
    };

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

    const isFormReady = () =>
        form.quantity && parseFloat(form.quantity) > 0 && !exceedsStock && availableQty > 0;

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (saving || !isFormReady()) return;
        handleSave();
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('owner_usage', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('ownerUsage.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('ownerUsage.pageSubtitle')} —{" "}
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startOwnerUsageTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> Take a Tour
                        </button>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('ownerUsage.dateLabel')}</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-tour="usage-stats">
                    {[
                        { label: t('ownerUsage.totalUsed'), value: totalUsed.toFixed(2) + " L", icon: <TrendingDown size={16} />, color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700" },
                        { label: t('ownerUsage.cowUsed'), value: cowUsed.toFixed(2) + " L", icon: <Milk size={16} />, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                        { label: t('ownerUsage.buffaloUsed'), value: buffaloUsed.toFixed(2) + " L", icon: <Milk size={16} />, color: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700" },
                        { label: t('ownerUsage.entriesToday'), value: entries.length, icon: <Layers size={16} />, color: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700" },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
                            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
                            <div className="shrink-0 relative z-10 opacity-70">{icon}</div>
                            <div className="relative z-10">
                                <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Available Stock Banner ── */}
                {stock && (
                    <div className="grid grid-cols-3 gap-4" data-tour="usage-stock">
                        {[
                            {
                                label: t('ownerUsage.cowAvailable'),
                                value: parseFloat(stock.available?.cow ?? stock.cow ?? 0),
                                color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-800",
                                sub: "text-amber-500",
                            },
                            {
                                label: t('ownerUsage.buffaloAvailable'),
                                value: parseFloat(stock.available?.buffalo ?? stock.buffalo ?? 0),
                                color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-800",
                                sub: "text-blue-400",
                            },
                            {
                                label: t('ownerUsage.totalAvailable'),
                                value: parseFloat(stock.available?.total ?? stock.total ?? 0),
                                color: "from-gray-900 to-gray-800 border-gray-700 text-white",
                                sub: "text-gray-400",
                            },
                        ].map(({ label, value, color, sub }) => (
                            <div key={label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-lg p-5 flex flex-col gap-1`}>
                                <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full ${value > 0 ? 'bg-white/10' : 'bg-gray-400/10'} blur-3xl`} />
                                <p className={`text-[10px] font-semibold uppercase tracking-wider ${sub} relative z-10`}>{label}</p>
                                <p className="text-2xl font-bold leading-tight relative z-10">
                                    {value.toFixed(1)}
                                    <span className={`text-sm font-medium ml-1 ${sub}`}>L</span>
                                </p>
                                <p className={`text-[10px] ${sub} relative z-10`}>{t('ownerUsage.afterWalkinAndUsage')}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success"
                            ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Entry Form ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 px-6 py-5" data-tour="usage-form">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 relative z-10">{t('ownerUsage.newUsageEntry')}</p>

                    <div className="flex items-start gap-4 flex-wrap relative z-10" onKeyDown={handleFormKeyDown}>

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
                                        activeClass: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30",
                                    },
                                    {
                                        value: "evening",
                                        label: t('ownerUsage.evening'),
                                        icon: <Moon size={11} />,
                                        activeClass: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30",
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
                                        activeClass: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30",
                                    },
                                    {
                                        value: "buffalo",
                                        label: t('ownerUsage.buffalo'),
                                        activeClass: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30",
                                    },
                                ]}
                                t={t}
                            />
                            {/* Available stock hint */}
                            {availableQty !== null && (
                                <p className={`text-[10px] font-medium mt-0.5 ${availableQty <= 0 ? "text-rose-500" : "text-emerald-600"}`}>
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
                                    ? "border-rose-300 bg-rose-50/50 text-rose-700"
                                    : "border-blue-200/60 bg-blue-50/30 text-blue-700"
                                    }`}
                            />
                            {exceedsStock && (
                                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">⚠ {t('ownerUsage.exceedsStock')}</p>
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
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200/60 relative z-10">
                        <p className="text-xs text-gray-400">
                            {entries.length} {entries.length === 1 ? t('ownerUsage.entry') : t('ownerUsage.entries')} {t('ownerUsage.on')} {" "}
                            {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {totalUsed > 0 && (
                                <span className="ml-2 text-gray-600 font-semibold">· {totalUsed.toFixed(2)} L {t('ownerUsage.totalUsed')}</span>
                            )}
                        </p>
                        <div className="flex gap-2">
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm(EMPTY_FORM);
                                        setEditingId(null);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    <X size={15} />
                                    {t('ownerUsage.cancel')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={editingId ? handleUpdate : handleSave}
                                disabled={saving || availableQty <= 0 || (editingId ? !isFormReady() : false)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all duration-200
                                    ${saving || availableQty <= 0 || (editingId ? !isFormReady() : false)
                                        ? "bg-gray-300 cursor-not-allowed shadow-gray-300/30"
                                        : "bg-gradient-to-br from-gray-900 to-gray-800 hover:shadow-xl hover:shadow-gray-900/40 active:scale-95"}`}
                            >
                                <Save size={15} />
                                {saving ? t('ownerUsage.saving') : editingId ? t('ownerUsage.updateEntry') : t('ownerUsage.recordUsage')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Shift summary mini-cards ── */}
                {entries.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: t('ownerUsage.morningUsage'), value: morningUsed, icon: <Sun size={14} />, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                            { label: t('ownerUsage.eveningUsage'), value: eveningUsed, icon: <Moon size={14} />, color: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700" },
                        ].map(({ label, value, icon, color }) => (
                            <div key={label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
                                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
                                <div className="shrink-0 relative z-10">{icon}</div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                    <p className="text-lg font-bold text-gray-900">{value.toFixed(2)} L</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Entries Table ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden" data-tour="usage-table">

                    {/* Header */}
                    <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50" style={{ gridTemplateColumns: `${GRID} 100px` }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
                                {label}
                            </div>
                        ))}
                        <div className="px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                            {t('ownerUsage.actions')}
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                            <Home size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">{t('ownerUsage.noEntries')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max w-full">
                                {[...entries].reverse().map((e, i) => (
                                    <div
                                        key={e.usage_id || i}
                                        className="grid border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors"
                                        style={{ gridTemplateColumns: `${GRID} 100px` }}
                                    >
                                        {/* Shift */}
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase backdrop-blur-sm border
                                                ${e.shift === "morning"
                                                    ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                                                    : "bg-indigo-50/80 text-indigo-700 border-indigo-200/60"}`}>
                                                {e.shift === "morning" ? <Sun size={8} /> : <Moon size={8} />}
                                                {e.shift === "morning" ? t('ownerUsage.morning') : t('ownerUsage.evening')}
                                            </span>
                                        </TableCell>

                                        {/* Milk type */}
                                        <TableCell>
                                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm border
                                                ${e.milk_type === "cow"
                                                    ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                                                    : "bg-blue-50/80 text-blue-700 border-blue-200/60"}`}>
                                                {e.milk_type === "cow" ? t('ownerUsage.cow') : t('ownerUsage.buffalo')}
                                            </span>
                                        </TableCell>

                                        {/* Quantity */}
                                        <TableCell className="text-blue-600 font-mono font-bold text-sm">
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

                                        {/* Actions */}
                                        <TableCell className="justify-center gap-1.5">
                                            <button
                                                onClick={() => handleEdit(e)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border bg-blue-50/80 text-blue-600 border-blue-200/60 backdrop-blur-sm hover:bg-blue-100/80 shadow-sm"
                                            >
                                                <Pencil size={12} /> {t('ownerUsage.edit')}
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(e.usage_id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border bg-rose-50/80 text-rose-600 border-rose-200/60 backdrop-blur-sm hover:bg-rose-100/80 shadow-sm"
                                            >
                                                <Trash2 size={12} /> {t('ownerUsage.delete')}
                                            </button>
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totals footer */}
                    {entries.length > 0 && (
                        <div className="grid border-t-2 border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50" style={{ gridTemplateColumns: `${GRID} 100px` }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-200/60">
                                {entries.length} {entries.length === 1 ? t('ownerUsage.entry') : t('ownerUsage.entries')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 text-xs font-bold text-blue-600 border-r border-gray-200/60">
                                {totalUsed.toFixed(2)} L
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </div>

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>• {t('ownerUsage.legendSubtraction')}</span>
                    <span>• {t('ownerUsage.legendStockUpdate')}</span>
                    <span>• {t('ownerUsage.legendPurposeDefault')}</span>
                </div>

                {/* ── Delete Modal ── */}
                {deleteConfirmId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl p-6 max-w-sm w-full">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('ownerUsage.deleteConfirmTitle')}</h3>
                            <p className="text-sm text-gray-500 mb-4">{t('ownerUsage.deleteConfirmMessage')}</p>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('ownerUsage.cancel')}
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirmId)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200"
                                >
                                    {t('ownerUsage.delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}