// pages/common/Expenses.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Receipt, Save, AlertTriangle, BadgeCheck, X,
    Building2, CreditCard, Hash, Wallet,
    Layers, Trash2, Pencil, CheckCircle2, Circle,
    FileText, Calendar, Home
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

// ── SectionCard Component (matching Settings page) ────────────────────────────
function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" {...rest}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 relative z-10">{children}</div>
        </div>
    );
}

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const EMPTY_FORM = {
    expense_date: today(),
    reason: "",
    amount: "",
    vendor_name: "",
    vendor_contact: "",
    payment_mode: "cash",
    bill_no: "",
    payment_status: "paid",
};

const PAYMENT_MODES = [
    { value: "cash", labelKey: "expenses.paymentModeCash", activeClass: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm" },
    { value: "card", labelKey: "expenses.paymentModeCard", activeClass: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm" },
    { value: "upi", labelKey: "expenses.paymentModeUpi", activeClass: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm" },
];

const PAYMENT_STATUS = [
    { value: "paid", labelKey: "expenses.statusPaid", icon: <CheckCircle2 size={12} />, activeClass: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm" },
    { value: "unpaid", labelKey: "expenses.statusUnpaid", icon: <Circle size={12} />, activeClass: "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm" },
];

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
            className={`border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-2.5 py-[7px] text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function ToggleGroup({ value, onChange, options, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden h-[35px] bg-white/50 backdrop-blur-sm shadow-sm">
            {options.map((opt, i) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`flex items-center gap-1.5 px-3 text-xs font-semibold transition-all duration-200
                        ${i > 0 ? "border-l border-gray-200/60" : ""}
                        ${value === opt.value ? opt.activeClass : "bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80"}`}
                >
                    {opt.icon}{t(opt.labelKey)}
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

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color} bg-white/60 backdrop-blur-sm shadow-sm`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function Expenses() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    const [form, setForm] = useState(EMPTY_FORM);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [searchText, setSearchText] = useState("");

    // range filter: daily / weekly / monthly / yearly / custom
    const [rangeMode, setRangeMode] = useState("daily");
    const [selectedDate, setSelectedDate] = useState(today());
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        return {
            from: new Date(y, m, 1).toISOString().split("T")[0],
            to: new Date(y, m + 1, 0).toISOString().split("T")[0],
        };
    };

    const getYearRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear();
        return {
            from: new Date(y, 0, 1).toISOString().split("T")[0],
            to: new Date(y, 11, 31).toISOString().split("T")[0],
        };
    };

    const applyRange = (mode, anchorDate) => {
        if (mode === "daily") return { from: anchorDate, to: anchorDate };
        if (mode === "weekly") return getWeekRange(anchorDate);
        if (mode === "monthly") return getMonthRange(anchorDate);
        if (mode === "yearly") return getYearRange(anchorDate);
        return null; // custom — leave as-is
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        const r = applyRange(mode, selectedDate);
        if (r) { setFromDate(r.from); setToDate(r.to); }
    };

    const handleDateChange = (d) => {
        setSelectedDate(d);
        const r = applyRange(rangeMode, d);
        if (r) { setFromDate(r.from); setToDate(r.to); }
    };

    const fetchEntries = async (from, to) => {
        setLoading(true);
        try {
            const url = from === to ? `/expenses?date=${from}` : `/expenses?from=${from}&to=${to}`;
            const { data } = await api.get(url);
            setEntries(data);
        } catch {
            showFlash("error", t('expenses.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEntries(fromDate, toDate); }, [fromDate, toDate]);

    const handleEdit = (entry) => {
        setForm({
            expense_date: entry.expense_date?.split("T")[0] || today(),
            reason: entry.reason || "",
            amount: String(entry.amount),
            vendor_name: entry.vendor_name || "",
            vendor_contact: entry.vendor_contact || "",
            payment_mode: entry.payment_mode || "cash",
            bill_no: entry.bill_no || "",
            payment_status: entry.payment_status || "paid",
        });
        setEditingId(entry.expense_id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (saving) return;
        setSaving(true);
        try {
            await api.delete(`/expenses/${id}`);
            showFlash("success", t('expenses.deleteSuccess'));
            await fetchEntries(fromDate, toDate);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('expenses.deleteError'));
        } finally {
            setSaving(false);
            setDeleteConfirmId(null);
        }
    };

    const isFormReady = () => form.expense_date && form.reason.trim() && form.amount && parseFloat(form.amount) > 0;

    const buildPayload = () => ({
        expense_date: form.expense_date,
        reason: form.reason.trim(),
        amount: parseFloat(form.amount),
        vendor_name: form.vendor_name.trim() || null,
        vendor_contact: form.vendor_contact.trim() || null,
        payment_mode: form.payment_mode,
        bill_no: form.bill_no.trim() || null,
        payment_status: form.payment_status,
    });

    const handleSave = async () => {
        if (!form.reason.trim()) { showFlash("error", t('expenses.reasonRequired')); return; }
        if (!form.amount || parseFloat(form.amount) <= 0) { showFlash("error", t('expenses.amountRequired')); return; }
        if (saving) return;
        setSaving(true);
        try {
            await api.post("/expenses", buildPayload());
            showFlash("success", t('expenses.saveSuccess'));
            await fetchEntries(fromDate, toDate);
            setForm({ ...EMPTY_FORM, expense_date: form.expense_date });
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('expenses.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!form.reason.trim()) { showFlash("error", t('expenses.reasonRequired')); return; }
        if (!form.amount || parseFloat(form.amount) <= 0) { showFlash("error", t('expenses.amountRequired')); return; }
        if (saving) return;
        setSaving(true);
        try {
            await api.put(`/expenses/${editingId}`, buildPayload());
            showFlash("success", t('expenses.updateSuccess'));
            await fetchEntries(fromDate, toDate);
            setForm(EMPTY_FORM);
            setEditingId(null);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('expenses.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (saving || !isFormReady()) return;
        editingId ? handleUpdate() : handleSave();
    };

    const filteredEntries = searchText.trim()
        ? entries.filter(e =>
            (e.reason || "").toLowerCase().includes(searchText.toLowerCase()) ||
            (e.vendor_name || "").toLowerCase().includes(searchText.toLowerCase()) ||
            (e.bill_no || "").toLowerCase().includes(searchText.toLowerCase()))
        : entries;

    // stats
    const totalAmount = entries.reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const paidAmount = entries.filter(e => e.payment_status === "paid").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const unpaidAmount = entries.filter(e => e.payment_status === "unpaid").reduce((a, e) => a + parseFloat(e.amount || 0), 0);

    const COLS = [
        t('expenses.table.date'),
        t('expenses.table.reason'),
        t('expenses.table.vendor'),
        t('expenses.table.billNo'),
        t('expenses.table.mode'),
        t('expenses.table.status'),
        t('expenses.table.amount'),
    ];
    const GRID = "90px 1.4fr 1fr 100px 90px 90px 100px";

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('expenses', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('expenses.title')}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/30">
                                <Receipt size={12} /> Expenses
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('expenses.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('expenses.subtitle', {
                                date: new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('expenses.anchorDate')}</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('expenses.period')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                    {[
                                        { v: "daily", l: t('expenses.periodDay') },
                                        { v: "weekly", l: t('expenses.periodWeek') },
                                        { v: "monthly", l: t('expenses.periodMonth') },
                                        { v: "yearly", l: t('expenses.periodYear') },
                                        { v: "custom", l: t('expenses.periodCustom') },
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button"
                                            onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition-all duration-200 ${rangeMode === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate}
                                            onChange={e => setFromDate(e.target.value)}
                                            className="border border-gray-200/60 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate}
                                            onChange={e => setToDate(e.target.value)}
                                            className="border border-gray-200/60 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl whitespace-nowrap hidden sm:inline shadow-sm">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        label={t('expenses.stats.total')}
                        value={"₹" + totalAmount.toFixed(2)}
                        icon={<Wallet size={14} className="text-blue-600" />}
                        color="text-blue-600 bg-blue-50/80 border-blue-200/60"
                    />
                    <StatCard
                        label={t('expenses.stats.paid')}
                        value={"₹" + paidAmount.toFixed(2)}
                        icon={<CheckCircle2 size={14} className="text-emerald-600" />}
                        color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60"
                    />
                    <StatCard
                        label={t('expenses.stats.unpaid')}
                        value={"₹" + unpaidAmount.toFixed(2)}
                        icon={<Circle size={14} className="text-rose-600" />}
                        color="text-rose-600 bg-rose-50/80 border-rose-200/60"
                    />
                    <StatCard
                        label={t('expenses.stats.entries')}
                        value={entries.length}
                        icon={<Layers size={14} className="text-violet-600" />}
                        color="text-violet-600 bg-violet-50/80 border-violet-200/60"
                    />
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === 'success'
                            ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700'
                            : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Entry Form ── */}
                <SectionCard
                    title={editingId ? t('expenses.editExpense') : t('expenses.newExpense')}
                    icon={<Receipt size={16} className="text-white" />}
                >
                    <div className="flex items-center justify-between mb-4">
                        {editingId && (
                            <button onClick={handleCancelEdit}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded-lg hover:bg-gray-100/80">
                                <X size={12} /> {t('expenses.cancelEdit')}
                            </button>
                        )}
                    </div>

                    <div className="flex items-start gap-4 flex-wrap" onKeyDown={handleFormKeyDown}>

                        <Field label={t('expenses.date')} icon={<Calendar size={12} />}>
                            <TinyInput
                                type="date"
                                value={form.expense_date}
                                onChange={(e) => set("expense_date", e.target.value)}
                                className="w-36"
                            />
                        </Field>

                        <Field label={t('expenses.reason')} icon={<FileText size={12} />}>
                            <TinyInput
                                value={form.reason}
                                onChange={(e) => set("reason", e.target.value)}
                                placeholder={t('expenses.reasonPlaceholder')}
                                className="w-56"
                            />
                        </Field>

                        <Field label={t('expenses.amount')} icon={<Wallet size={12} />}>
                            <TinyInput
                                type="number" min="0" step="0.01"
                                value={form.amount}
                                onChange={(e) => set("amount", e.target.value)}
                                placeholder="0.00"
                                className="w-28 bg-blue-50/80 border-blue-200/60 text-blue-700"
                            />
                        </Field>

                        <Field label={t('expenses.vendorName')} icon={<Building2 size={12} />}>
                            <TinyInput
                                value={form.vendor_name}
                                onChange={(e) => set("vendor_name", e.target.value)}
                                placeholder={t('expenses.vendorPlaceholder')}
                                className="w-44"
                            />
                        </Field>

                        <Field label={t('expenses.vendorContact')} icon={<Building2 size={12} />}>
                            <TinyInput
                                value={form.vendor_contact}
                                onChange={(e) => set("vendor_contact", e.target.value)}
                                placeholder={t('expenses.contactPlaceholder')}
                                className="w-36"
                            />
                        </Field>

                        <Field label={t('expenses.paymentMode')} icon={<CreditCard size={12} />}>
                            <ToggleGroup
                                value={form.payment_mode}
                                onChange={(v) => set("payment_mode", v)}
                                options={PAYMENT_MODES}
                                t={t}
                            />
                        </Field>

                        <Field label={t('expenses.billNo')} icon={<Hash size={12} />}>
                            <TinyInput
                                value={form.bill_no}
                                onChange={(e) => set("bill_no", e.target.value)}
                                placeholder={t('expenses.billPlaceholder')}
                                className="w-32"
                            />
                        </Field>

                        <Field label={t('expenses.status')} icon={<CheckCircle2 size={12} />}>
                            <ToggleGroup
                                value={form.payment_status}
                                onChange={(v) => set("payment_status", v)}
                                options={PAYMENT_STATUS}
                                t={t}
                            />
                        </Field>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200/60">
                        <p className="text-xs text-gray-400">
                            {t('expenses.entryCount', { count: entries.length })}
                            {totalAmount > 0 && (
                                <span className="ml-2 text-gray-600 font-semibold">· {t('expenses.totalAmount', { amount: totalAmount.toFixed(2) })}</span>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={editingId ? handleUpdate : handleSave}
                            disabled={saving || !isFormReady()}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all
                                ${saving || !isFormReady()
                                    ? "bg-gray-300 cursor-not-allowed"
                                    : editingId
                                        ? "bg-gradient-to-br from-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/30 active:scale-95"
                                        : "bg-gradient-to-br from-gray-900 to-gray-800 hover:shadow-lg hover:shadow-gray-900/30 active:scale-95"}`}
                        >
                            <Save size={15} />
                            {saving ? (editingId ? t('expenses.updating') : t('expenses.saving')) : editingId ? t('expenses.updateButton') : t('expenses.saveButton')}
                        </button>
                    </div>
                </SectionCard>

                {/* ── Entries Table ── */}
                <SectionCard
                    title={t('expenses.entries')}
                    icon={<Receipt size={16} className="text-white" />}
                >
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200/60 bg-gray-50/60 rounded-t-xl flex-wrap">
                        <input
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            placeholder={t('expenses.searchPlaceholder')}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm w-64"
                        />
                        {searchText && (
                            <button onClick={() => setSearchText("")} className="text-gray-400 hover:text-gray-600 transition">
                                <X size={13} />
                            </button>
                        )}
                        <span className="ml-auto text-xs text-gray-400">
                            {t('expenses.entryCount', { count: filteredEntries.length })}
                        </span>
                    </div>

                    <div className="grid border-b border-gray-200/60 bg-gray-50/80 rounded-t-xl" style={{ gridTemplateColumns: `${GRID} 100px` }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
                                {label}
                            </div>
                        ))}
                        <div className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t('expenses.actions')}</div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Receipt size={32} />
                            <p className="text-sm">{t('expenses.noEntries')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max w-full">
                                {[...filteredEntries].reverse().map((e, i) => (
                                    <div
                                        key={e.expense_id || i}
                                        className="grid border-b border-gray-200/60 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: `${GRID} 100px` }}
                                    >
                                        <TableCell className="text-gray-500 font-mono text-xs">
                                            {fmtDate(e.expense_date)}
                                        </TableCell>

                                        <TableCell className="text-gray-800 text-xs font-medium">
                                            {e.reason}
                                        </TableCell>

                                        <TableCell className="text-gray-600 text-xs">
                                            <div className="flex flex-col">
                                                <span>{e.vendor_name || <span className="text-gray-300">—</span>}</span>
                                                {e.vendor_contact && <span className="text-[10px] text-gray-400">{e.vendor_contact}</span>}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-gray-500 font-mono text-xs">
                                            {e.bill_no || "—"}
                                        </TableCell>

                                        <TableCell>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase border
                                                ${e.payment_mode === "cash" ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"
                                                    : e.payment_mode === "card" ? "bg-blue-50/80 text-blue-700 border-blue-200/60"
                                                        : "bg-violet-50/80 text-violet-700 border-violet-200/60"}`}>
                                                {e.payment_mode === "cash" ? t('expenses.paymentModeCash')
                                                    : e.payment_mode === "card" ? t('expenses.paymentModeCard')
                                                        : t('expenses.paymentModeUpi')}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                                ${e.payment_status === "paid"
                                                    ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"
                                                    : "bg-rose-50/80 text-rose-700 border-rose-200/60"}`}>
                                                {e.payment_status === "paid" ? <CheckCircle2 size={9} /> : <Circle size={9} />}
                                                {e.payment_status === "paid" ? t('expenses.statusPaid') : t('expenses.statusUnpaid')}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-gray-900 font-mono font-bold text-xs">
                                            ₹{parseFloat(e.amount).toFixed(2)}
                                        </TableCell>

                                        <TableCell className="justify-center gap-1">
                                            <button
                                                onClick={() => handleEdit(e)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border bg-blue-50/80 text-blue-600 border-blue-200/60 hover:bg-blue-100/80 shadow-sm"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(e.expense_id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border bg-rose-50/80 text-rose-600 border-rose-200/60 hover:bg-rose-100/80 shadow-sm"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totals footer */}
                    {filteredEntries.length > 0 && (
                        <div className="grid border-t-2 border-gray-200/60 bg-gray-50/60 rounded-b-xl" style={{ gridTemplateColumns: `${GRID} 100px` }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-200/60">
                                {t('expenses.entryCount', { count: filteredEntries.length })}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 text-xs font-bold text-blue-600 border-r border-gray-200/60">
                                ₹{filteredEntries.reduce((a, e) => a + parseFloat(e.amount || 0), 0).toFixed(2)}
                            </div>
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </SectionCard>

                {/* ── Delete Confirm Modal ── */}
                {deleteConfirmId && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl p-6 max-w-sm w-full">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('expenses.deleteTitle')}</h3>
                            <p className="text-sm text-gray-500 mb-4">{t('expenses.deleteConfirm')}</p>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 transition shadow-sm"
                                >
                                    {t('expenses.cancel')}
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirmId)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 hover:shadow-lg hover:shadow-rose-500/30 transition shadow-sm"
                                >
                                    {t('expenses.delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}