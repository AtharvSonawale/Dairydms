import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Droplets, Save, Sun, Moon, FlaskConical, Waves,
    User, AlertTriangle, BadgeCheck, X,
    TrendingUp, Milk, Trash2, Scale,
    Pencil, Calendar, Download, ChevronDown,
    Filter, Search, RefreshCw, ChevronLeft, ChevronRight,
    Home
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { useAppConfig } from '../context/AppConfigContext';

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const waterRisk = (v) => parseFloat(v) > 5;

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
    const colorMap = {
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        slate: "from-slate-50 to-slate-100/50 border-slate-200/60 text-slate-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color] || colorMap.blue} shadow-sm p-3 flex items-center gap-2.5`}>
            <div className="absolute -right-6 -top-6 w-16 h-16 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">
                {icon}
            </div>
            <div className="relative z-10 min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider opacity-60 leading-none truncate">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-1 truncate">{value}</p>
            </div>
        </div>
    );
}

// ── Table Cell ────────────────────────────────────────────────
function TableCell({ children, className = "", align = "left" }) {
    const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
    return (
        <div className={`px-3 py-3 flex items-center ${alignClass} border-r border-gray-100/60 last:border-r-0 text-[15px] ${className}`}>
            {children}
        </div>
    );
}

// ── Edit Modal ───────────────────────────────────────────────
function EditEntryModal({ entry, isOpen, onClose, onSave, showFlash }) {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        shift: "morning",
        milk_type: "cow",
        quantity: "",
        fat: "",
        snf: "",
        protein: "",
        water: "",
        rate_applied: "",
        total_amount: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (entry && isOpen) {
            setForm({
                shift: entry.shift || "morning",
                milk_type: entry.milk_type || "cow",
                quantity: String(entry.quantity || ""),
                fat: String(entry.fat || ""),
                snf: String(entry.snf || ""),
                protein: String(entry.protein ?? ""),
                water: String(entry.water || ""),
                rate_applied: String(entry.rate_applied || ""),
                total_amount: String(entry.total_amount || ""),
            });
        }
    }, [entry, isOpen]);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        if (!form.quantity || !form.fat || !form.snf || !form.rate_applied) {
            showFlash("error", "All fields are required.");
            return;
        }
        if (saving) return;
        setSaving(true);
        try {
            const computedAmount = (parseFloat(form.quantity) * parseFloat(form.rate_applied)).toFixed(2);
            await api.put(`/milk-entries/${entry.entry_id}`, {
                shift: form.shift,
                milk_type: form.milk_type,
                seller_type: entry.seller_type,
                quantity: Number(form.quantity),
                fat: Number(form.fat),
                snf: Number(form.snf),
                protein: form.protein !== "" ? Number(form.protein) : null,
                water: Number(form.water || 0),
                rate_applied: Number(form.rate_applied),
                total_amount: Number(form.total_amount || computedAmount),
            });
            showFlash("success", "Entry updated successfully!");
            onSave();
            onClose();
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to update entry.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-blue-50/50 to-white/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                            <Pencil size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Edit Milk Entry</h2>
                            <p className="text-[11px] text-gray-500">
                                Seller: <span className="font-semibold text-gray-700">{entry?.seller_name || `ID:${entry?.seller_id}`}</span>
                                {" · "}{fmtDate(entry?.entry_date)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Sun size={10} /> Shift
                            </label>
                            <select
                                value={form.shift}
                                onChange={(e) => set("shift", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            >
                                <option value="morning">Morning</option>
                                <option value="evening">Evening</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Milk size={10} /> Milk Type
                            </label>
                            <select
                                value={form.milk_type}
                                onChange={(e) => set("milk_type", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            >
                                <option value="cow">Cow</option>
                                <option value="buffalo">Buffalo</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Droplets size={10} /> Quantity (L)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.quantity}
                                onChange={(e) => set("quantity", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <FlaskConical size={10} /> Fat (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.fat}
                                onChange={(e) => set("fat", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <FlaskConical size={10} /> SNF (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.snf}
                                onChange={(e) => set("snf", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <FlaskConical size={10} /> Protein (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.protein}
                                onChange={(e) => set("protein", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Waves size={10} /> Water (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.water}
                                onChange={(e) => set("water", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <TrendingUp size={10} /> Rate (₹/L)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.rate_applied}
                                onChange={(e) => set("rate_applied", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>

                        <div>
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <TrendingUp size={10} /> Total Amount (₹)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.total_amount}
                                onChange={(e) => set("total_amount", e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200/60 shrink-0 bg-gray-50/60 rounded-b-2xl">
                    <button onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 ${saving ? "bg-gray-300" : "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"}`}>
                        {saving ? "Saving…" : "Update Entry"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Delete Confirmation Modal ──────────────────────────────
function DeleteConfirmModal({ entry, isOpen, onClose, onConfirm, showFlash }) {
    const { t } = useTranslation();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/milk-entries/${entry.entry_id}`);
            showFlash("success", "Entry deleted successfully!");
            onConfirm();
            onClose();
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to delete entry.");
        } finally {
            setDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-rose-50/50 to-white/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30 shrink-0">
                            <Trash2 size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Confirm Deletion</h2>
                            <p className="text-[10px] text-gray-400">This action cannot be undone</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-4">
                    <p className="text-sm text-gray-600">
                        Are you sure you want to delete this milk entry?
                    </p>
                    {entry && (
                        <div className="mt-4 p-3 bg-gray-50/80 rounded-xl border border-gray-200/60">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <p className="text-gray-400">Seller</p>
                                    <p className="font-medium text-gray-800">{entry.seller_name || `ID:${entry.seller_id}`}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Date</p>
                                    <p className="font-medium text-gray-800">{fmtDate(entry.entry_date)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Quantity</p>
                                    <p className="font-medium text-gray-800">{entry.quantity} L</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Amount</p>
                                    <p className="font-medium text-gray-800">₹{parseFloat(entry.total_amount || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200/60">
                    <button onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                        Cancel
                    </button>
                    <button onClick={handleDelete} disabled={deleting}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all duration-200 ${deleting ? "bg-gray-300 shadow-gray-300/30" : "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40"}`}>
                        {deleting ? "Deleting…" : "Delete Entry"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AllMilkEntries() {
    const { t } = useTranslation();
    const { appName } = useAppConfig();
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();
    const isAdmin = user?.role === "admin";

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(today());
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeMode, setRangeMode] = useState("daily");
    const [searchName, setSearchName] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [editingEntry, setEditingEntry] = useState(null);
    const [deletingEntry, setDeletingEntry] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [flash, setFlash] = useState(null);
    const [flashPhase, setFlashPhase] = useState('hidden');

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setFlashPhase('visible');
        setTimeout(() => setFlashPhase('hidden'), 3200);
        setTimeout(() => setFlash(null), 3500);
    };

    const dismissFlash = () => {
        setFlashPhase('hidden');
        setFlash(null);
    };

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return {
            from: mon.toISOString().split("T")[0],
            to: sun.toISOString().split("T")[0],
        };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        return {
            from: new Date(y, m, 1).toISOString().split("T")[0],
            to: new Date(y, m + 1, 0).toISOString().split("T")[0],
        };
    };

    const fetchEntries = async (from, to) => {
        setLoading(true);
        try {
            const base = from === to ? `/milk-entries?date=${from}` : `/milk-entries?from=${from}&to=${to}`;
            const { data } = await api.get(base);
            setEntries(data);
        } catch {
            showFlash("error", "Failed to load entries.");
        } finally {
            setLoading(false);
        }
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        let newFrom = fromDate, newTo = toDate;
        if (mode === "daily") { newFrom = selectedDate; newTo = selectedDate; }
        else if (mode === "weekly") { const r = getWeekRange(selectedDate); newFrom = r.from; newTo = r.to; }
        else if (mode === "monthly") { const r = getMonthRange(selectedDate); newFrom = r.from; newTo = r.to; }
        setFromDate(newFrom);
        setToDate(newTo);
        fetchEntries(newFrom, newTo);
    };

    useEffect(() => {
        fetchEntries(selectedDate, selectedDate);
        setCurrentPage(1);
    }, [selectedDate]);

    const handleDateChange = (e) => {
        const val = e.target.value;
        setSelectedDate(val);
        setFromDate(val);
        setToDate(val);
        setRangeMode("daily");
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setShowEditModal(true);
    };

    const handleDelete = (entry) => {
        setDeletingEntry(entry);
        setShowDeleteModal(true);
    };

    const handleEditSave = () => {
        fetchEntries(fromDate, toDate);
    };

    const handleDeleteConfirm = () => {
        fetchEntries(fromDate, toDate);
    };

    // Filter and paginate entries
    const filteredEntries = searchName.trim()
        ? entries.filter(e => (e.seller_name || "").toLowerCase().includes(searchName.toLowerCase()))
        : entries;

    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Calculate stats
    const totalEntries = entries.length;
    const totalCow = entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalBuffalo = entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalAmount = entries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const uniqueSellers = new Set(entries.map(e => e.seller_id)).size;

    // Table columns with proper alignment
    const COLS = [
        { label: "#", align: "center" },
        { label: "Seller", align: "left" },
        { label: "Code", align: "center" },
        { label: "Date", align: "center" },
        { label: "Shift", align: "center" },
        { label: "Milk Type", align: "center" },
        { label: "Qty (L)", align: "right" },
        { label: "Fat %", align: "right" },
        { label: "SNF %", align: "right" },
        { label: "Protein %", align: "right" },
        { label: "Water %", align: "right" },
        { label: "Rate (₹)", align: "right" },
        { label: "Amount (₹)", align: "right" },
        { label: "Time", align: "center" },
        { label: "Actions", align: "center" }
    ];

    // Fixed pixel widths (no fr units) so header and row columns line up exactly,
    // and Seller/Code get real breathing room instead of being squeezed.
    const GRID = "50px 240px 110px 110px 90px 100px 85px 75px 75px 80px 85px 95px 120px 90px 110px";
    const TABLE_MIN_WIDTH = "1450px";

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('milk_entry', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            {flash && (
                <div className="fixed top-4 right-4 z-[9999] pointer-events-none" style={{ maxWidth: "min(92vw, 420px)" }}>
                    <div
                        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl text-base font-semibold shadow-2xl backdrop-blur-sm border
                        ${flash.type === "success" ? "bg-emerald-50/95 border-emerald-200/70 text-emerald-700" : "bg-rose-50/95 border-rose-200/70 text-rose-600"}`}
                        style={{
                            transform: flashPhase === "visible" ? "translateX(0)" : "translateX(150%)",
                            opacity: flashPhase === "visible" ? 1 : 0,
                            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease",
                        }}
                    >
                        {flash.type === "error" && <AlertTriangle size={18} className="shrink-0" />}
                        {flash.type === "success" && <BadgeCheck size={18} className="shrink-0" />}
                        <span className="flex-1">{flash.msg}</span>
                        <button onClick={dismissFlash} className="opacity-50 hover:opacity-100 transition shrink-0">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <main className="h-screen max-w-screen mx-auto px-4 py-3 flex flex-col gap-2">
                {/* ── Header ── */}
                <div className="flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-3">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            All Milk Entries
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">{appName} · Manage all entries</p>
                    </div>
                    <button
                        onClick={() => fetchEntries(fromDate, toDate)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200"
                    >
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>

                {/* ── Stat Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
                    <StatCard
                        label="Total Entries"
                        value={totalEntries}
                        icon={<Droplets size={16} className="text-blue-700" />}
                        color="blue"
                    />
                    <StatCard
                        label="Cow Milk (L)"
                        value={totalCow.toFixed(1)}
                        icon={<Milk size={16} className="text-amber-700" />}
                        color="amber"
                    />
                    <StatCard
                        label="Buffalo Milk (L)"
                        value={totalBuffalo.toFixed(1)}
                        icon={<Milk size={16} className="text-slate-700" />}
                        color="slate"
                    />
                    <StatCard
                        label="Total Amount"
                        value={`₹${totalAmount.toFixed(2)}`}
                        icon={<TrendingUp size={16} className="text-violet-700" />}
                        color="violet"
                    />
                    <StatCard
                        label="Unique Sellers"
                        value={uniqueSellers}
                        icon={<User size={16} className="text-emerald-700" />}
                        color="emerald"
                    />
                </div>

                {/* ── Filters ── */}
                <div className="flex flex-wrap items-center gap-3 shrink-0 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Range:</span>
                        <select
                            value={rangeMode}
                            onChange={(e) => handleRangeModeChange(e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>

                    {rangeMode === "custom" ? (
                        <>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">From</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => { setFromDate(e.target.value); setRangeMode("custom"); }}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition w-36"
                                />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">To</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => { setToDate(e.target.value); setRangeMode("custom"); }}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition w-36"
                                />
                            </div>
                            <button
                                onClick={() => fetchEntries(fromDate, toDate)}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition"
                            >
                                Apply
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Date</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={handleDateChange}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition w-36"
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-0.5 ml-auto">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <Search size={10} /> Search
                        </span>
                        <input
                            type="text"
                            value={searchName}
                            onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
                            placeholder="Search seller…"
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition w-44"
                        />
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden min-h-0">
                    <div className="flex-1 overflow-auto min-h-0">
                        <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                            <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50 sticky top-0 z-10" style={{ gridTemplateColumns: GRID }}>
                                {COLS.map((col, li) => (
                                    <div
                                        key={col.label || `col-${li}`}
                                        className={`px-3 py-2.5 flex items-center text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0 ${col.align === "right" ? "justify-end" :
                                            col.align === "center" ? "justify-center" : "justify-start"
                                            }`}
                                    >
                                        {col.label}
                                    </div>
                                ))}
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : entries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                                    <Droplets size={48} className="text-gray-200" />
                                    <p className="text-sm font-medium">No entries found for this period.</p>
                                </div>
                            ) : (
                                <div>
                                    {paginatedEntries.map((r, i) => {
                                        const globalIndex = (currentPage - 1) * pageSize + i + 1;
                                        const isWaterRisk = waterRisk(r.water);
                                        return (
                                            <div
                                                key={r.entry_id || i}
                                                className="grid border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors"
                                                style={{ gridTemplateColumns: GRID }}
                                            >
                                                <TableCell align="center" className="text-gray-400 text-xs font-mono">
                                                    {globalIndex}
                                                </TableCell>
                                                <TableCell align="left" className="font-medium text-gray-800 text-sm">
                                                    <span className="truncate block max-w-[200px]" title={r.seller_name || `ID:${r.seller_id}`}>
                                                        {r.seller_name || `ID:${r.seller_id}`}
                                                    </span>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <span className="font-mono text-xs text-gray-700 bg-gray-50/80 border border-gray-200/60 px-2 py-0.5 rounded-md backdrop-blur-sm font-bold whitespace-nowrap">
                                                        {r.seller_code || "—"}
                                                    </span>
                                                </TableCell>
                                                <TableCell align="center" className="text-gray-500 text-xs">
                                                    {fmtDate(r.entry_date)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-sm whitespace-nowrap ${r.shift === "morning" ? "bg-amber-50/80 text-amber-700 border-amber-200/60" : "bg-indigo-50/80 text-indigo-600 border-indigo-200/60"
                                                        }`}>
                                                        {r.shift === "morning" ? "Morning" : "Evening"}
                                                    </span>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-sm whitespace-nowrap ${r.milk_type === "cow" ? "bg-amber-50/80 text-amber-700 border-amber-200/60" : "bg-slate-100/80 text-slate-700 border-slate-200/60"
                                                        }`}>
                                                        {r.milk_type === "cow" ? "Cow" : "Buffalo"}
                                                    </span>
                                                </TableCell>
                                                <TableCell align="right" className="text-blue-700 font-mono font-bold text-sm">
                                                    {parseFloat(r.quantity || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" className="text-amber-700 font-mono font-bold text-sm">
                                                    {parseFloat(r.fat || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" className="text-violet-700 font-mono font-bold text-sm">
                                                    {parseFloat(r.snf || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" className="text-pink-600 font-mono text-sm">
                                                    {parseFloat(r.protein || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" className={`font-mono text-sm ${isWaterRisk ? "text-rose-600 font-bold" : "text-emerald-600"}`}>
                                                    {parseFloat(r.water || 0).toFixed(2)}
                                                    {isWaterRisk && <span className="ml-1 text-rose-500">⚠</span>}
                                                </TableCell>
                                                <TableCell align="right" className="text-gray-700 font-mono text-sm">
                                                    ₹{parseFloat(r.rate_applied || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right" className="text-gray-900 font-extrabold text-sm">
                                                    ₹{parseFloat(r.total_amount || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="center" className="text-gray-400 text-xs">
                                                    {fmtTime(r.entry_time)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isAdmin && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEdit(r)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 border border-blue-200/60 hover:border-blue-300/80 transition backdrop-blur-sm shadow-sm"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(r)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-500 border border-rose-200/60 hover:border-rose-300/80 transition backdrop-blur-sm shadow-sm"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {!isAdmin && (
                                                            <span className="text-[9px] text-gray-400">Read-only</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Pagination ── */}
                    {filteredEntries.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 border-t border-gray-200/60 bg-white/80 backdrop-blur-sm shrink-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce((acc, p, idx, arr) => {
                                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, i) =>
                                            p === '...'
                                                ? <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">…</span>
                                                : <button key={p} onClick={() => setCurrentPage(p)}
                                                    className={`w-6 h-6 rounded-lg text-xs font-bold transition border shadow-sm
                                                        ${currentPage === p ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30' : 'bg-white/50 text-gray-500 border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50'}`}>
                                                    {p}
                                                </button>
                                        )}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm"
                                >
                                    <ChevronRight size={14} />
                                </button>
                                <span className="text-xs text-gray-400 ml-1">
                                    {filteredEntries.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredEntries.length)}`} of {filteredEntries.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Rows:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                    className="border border-gray-200/60 rounded-lg px-2 py-0.5 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ── Edit Modal ── */}
            <EditEntryModal
                entry={editingEntry}
                isOpen={showEditModal}
                onClose={() => { setShowEditModal(false); setEditingEntry(null); }}
                onSave={handleEditSave}
                showFlash={showFlash}
            />

            {/* ── Delete Modal ── */}
            <DeleteConfirmModal
                entry={deletingEntry}
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setDeletingEntry(null); }}
                onConfirm={handleDeleteConfirm}
                showFlash={showFlash}
            />
        </div>
    );
}