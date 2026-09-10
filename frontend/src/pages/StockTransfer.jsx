// src/pages/StockTransfer.jsx
import React, { useState, useEffect, useRef } from "react";
import {
    ArrowRightLeft, Package, Milk, ShoppingCart, Send, CheckCircle2,
    XCircle, Clock, Plus, Trash2, X, AlertTriangle, BadgeCheck,
    Filter, Building2, Truck, Inbox, Upload, ShieldCheck, ShieldOff,
    Eye, RefreshCw, Save
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from "../context/PermissionContext";
import AccessDenied from "../components/AccessDenied";

// ── helpers ────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── Shared UI primitives (mirrors Settings page) ───────────────
function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" {...rest}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl pointer-events-none" />
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

const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-800 font-semibold text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm " +
    "placeholder:font-normal placeholder:text-gray-300";

const selectCls =
    "px-4 py-3 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-800 font-semibold text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm";

const primaryBtnCls =
    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white " +
    "shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50";

const secondaryBtnCls =
    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 " +
    "text-gray-600 hover:bg-gray-50/80 transition shadow-sm";

const pillBtnCls = (active) =>
    `px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150
     ${active
        ? "bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30"
        : "bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm"}`;

const Field = ({ label, icon, children }) => (
    <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {icon}{label}
        </span>
        {children}
    </div>
);

const TinyInput = React.forwardRef(function TinyInput({ className = "", style = {}, ...props }, ref) {
    return (
        <input
            ref={ref}
            {...props}
            style={{ minWidth: 0, ...style }}
            className={`px-3 py-2 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-sm text-gray-700 shadow-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                placeholder:text-gray-300 placeholder:font-normal ${className}`}
        />
    );
});

function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors shrink-0 shadow-sm
                ${checked ? "bg-emerald-500" : "bg-gray-300"}`}
        >
            <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform
                ${checked ? "translate-x-7" : "translate-x-1"}`} />
        </button>
    );
}

// ── Flash (matches Settings flash banner) ──────────────────────
function FlashBanner({ flash, onClose }) {
    if (!flash) return null;
    const isError = flash.type === "error";
    return (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
            ${isError
                ? "bg-rose-50/80 border border-rose-200/60 text-rose-600"
                : "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"}`}>
            {isError ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
            {flash.msg}
            <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 transition">
                <X size={16} />
            </button>
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        pending: "bg-amber-50/80 border-amber-200/60 text-amber-700",
        approved: "bg-emerald-50/80 border-emerald-200/60 text-emerald-700",
        rejected: "bg-rose-50/80 border-rose-200/60 text-rose-600",
        cancelled: "bg-gray-100/80 border-gray-200/60 text-gray-500",
    };
    const icons = {
        pending: <Clock size={10} />,
        approved: <CheckCircle2 size={10} />,
        rejected: <XCircle size={10} />,
        cancelled: <XCircle size={10} />,
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${map[status] || map.pending}`}>
            {icons[status]}{status}
        </span>
    );
}

function TypePill({ type }) {
    const map = {
        milk: { cls: "bg-blue-50/80 border-blue-200/60 text-blue-700", icon: <Milk size={10} />, label: "Milk" },
        product: { cls: "bg-violet-50/80 border-violet-200/60 text-violet-700", icon: <ShoppingCart size={10} />, label: "Product" },
        cattle_feed: { cls: "bg-emerald-50/80 border-emerald-200/60 text-emerald-700", icon: <Package size={10} />, label: "Feed" },
    };
    const t = map[type] || map.milk;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${t.cls}`}>
            {t.icon}{t.label}
        </span>
    );
}

// ── Item picker ────────────────────────────────────────────────
function ItemPicker({ options, value, onChange, onSelect, placeholder }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = options.filter(o =>
        (o.item_name || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative">
            <TinyInput
                value={open ? search : value}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); onChange && onChange(e.target.value); }}
                onFocus={() => { setOpen(true); setSearch(""); }}
                placeholder={placeholder}
                className="w-full"
            />
            {open && (
                <div className="absolute z-[9999] top-full left-0 mt-1 w-full bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-gray-400 text-center">No matches</p>
                    ) : filtered.map((o) => (
                        <button
                            key={`${o.stock_type}-${o.ref_id}`}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelect(o);
                                setOpen(false);
                                setSearch("");
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 text-left transition"
                        >
                            <div>
                                <p className="text-xs font-medium text-gray-800">{o.item_name}</p>
                                <p className="text-[10px] text-gray-400">
                                    Stock: {parseFloat(o.quantity || 0).toFixed(2)} {o.unit || ""}
                                </p>
                            </div>
                            <span className="text-[10px] text-violet-600 font-bold">
                                ₹{parseFloat(o.rate || o.mrp_rate || 0).toFixed(2)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function StockTransfer() {
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();

    const [transfers, setTransfers] = useState([]);
    const [centres, setCentres] = useState([]);
    const [availableStock, setAvailableStock] = useState({ products: [], feeds: [], milk: { available_milk: 0 } });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [selectedDate, setSelectedDate] = useState(today());
    const [direction, setDirection] = useState("incoming");
    const [statusFilter, setStatusFilter] = useState("pending");
    const [searchName, setSearchName] = useState("");

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null);

    const emptyForm = () => ({
        to_centre_id: "",
        transfer_date: today(),
        requires_approval: true,
        remarks: "",
        items: [],
    });
    const [form, setForm] = useState(emptyForm());

    const [flash, setFlash] = useState(null);
    const flashTimer = useRef(null);
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 3500);
    };

    // ── fetchers ──
    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("from", selectedDate);
            params.set("to", selectedDate);
            if (direction !== "all") params.set("direction", direction);
            if (statusFilter !== "all") params.set("status", statusFilter);
            const { data } = await api.get(`/stock-transfers?${params.toString()}`);
            setTransfers(data);
        } catch (err) {
            console.error(err.response?.data);
            showFlash("error", err.response?.data?.message || "Failed to load transfers.");
        } finally {
            setLoading(false);
        }
    };

    const fetchCentres = async () => {
        try {
            const { data } = await api.get("/stock-transfers/eligible-centres");
            setCentres(data);
        } catch { /* ignore */ }
    };

    const fetchStock = async (centreId, date) => {
        try {
            const { data } = await api.get(`/stock/transferable?centre_id=${centreId}&date=${date}`);
            setAvailableStock(data);
        } catch { /* ignore */ }
    };

    useEffect(() => { fetchTransfers(); }, [selectedDate, direction, statusFilter]);
    useEffect(() => { fetchCentres(); fetchStock(user?.centre_id, selectedDate); }, []);

    useEffect(() => {
        if (showCreateModal) fetchStock(user?.centre_id, form.transfer_date);
    }, [showCreateModal, form.transfer_date]);

    // ── stock cap helper: max qty allowed for a row, minus what's already
    // allocated to that same item in other rows of this same transfer ──
    const getMaxQty = (item, stock, items = form.items) => {
        if (item.stock_type === "milk") {
            const type = item.milk_type || "cow";
            const base = type === "buffalo"
                ? parseFloat(stock.milk?.available_buffalo || 0)
                : parseFloat(stock.milk?.available_cow || 0);
            const usedElsewhere = items
                .filter(o => o._key !== item._key && o.stock_type === "milk" && (o.milk_type || "cow") === type)
                .reduce((sum, o) => sum + (parseFloat(o.quantity) || 0), 0);
            return Math.max(0, base - usedElsewhere);
        }
        if (item.max_qty == null || item.max_qty === "") return null;
        const usedElsewhere = items
            .filter(o => o._key !== item._key && o.stock_type === item.stock_type && o.ref_id === item.ref_id)
            .reduce((sum, o) => sum + (parseFloat(o.quantity) || 0), 0);
        return Math.max(0, parseFloat(item.max_qty) - usedElsewhere);
    };

    // ── items CRUD ──
    const addItem = (stock_type) => {
        setForm(p => ({
            ...p,
            items: [...p.items, {
                _key: Date.now() + Math.random(),
                stock_type,
                ref_id: null,
                item_name: "",
                milk_type: stock_type === "milk" ? "cow" : null,
                unit: stock_type === "milk" ? "L" : "",
                quantity: "",
                rate: "",
                max_qty: stock_type === "milk" ? availableStock.milk?.available_cow : null,
            }],
        }));
    };

    const updateItem = (key, field, value) => {
        setForm(p => {
            const items = p.items.map(it => {
                if (it._key !== key) return it;
                const updated = { ...it, [field]: value };
                if (field === "quantity" || field === "milk_type") {
                    const max = getMaxQty(updated, availableStock, p.items);
                    if (max != null && updated.quantity !== "" && parseFloat(updated.quantity) > max) {
                        updated.quantity = max > 0 ? String(max) : "";
                    }
                }
                return updated;
            });
            return { ...p, items };
        });
    };

    const removeItem = (key) => {
        setForm(p => ({ ...p, items: p.items.filter(it => it._key !== key) }));
    };

    const selectStock = (key, option) => {
        setForm(p => {
            const items = p.items.map(it => {
                if (it._key !== key) return it;
                const updated = {
                    ...it,
                    ref_id: option.ref_id,
                    item_name: option.item_name,
                    unit: option.unit || "L",
                    rate: option.rate || option.mrp_rate || "",
                    max_qty: option.quantity,
                };
                const max = getMaxQty(updated, availableStock, p.items);
                if (max != null && updated.quantity !== "" && parseFloat(updated.quantity) > max) {
                    updated.quantity = max > 0 ? String(max) : "";
                }
                return updated;
            });
            return { ...p, items };
        });
    };

    // ── actions ──
    const handleCreate = async () => {
        if (!form.to_centre_id) { showFlash("error", "Select destination centre."); return; }
        const validItems = form.items.filter(i =>
            i.quantity && parseFloat(i.quantity) > 0 &&
            (i.stock_type === "milk" ? true : i.ref_id)
        );
        if (validItems.length === 0) { showFlash("error", "Add at least one valid item."); return; }

        setSaving(true);
        try {
            await api.post("/stock-transfers", {
                to_centre_id: Number(form.to_centre_id),
                transfer_date: form.transfer_date,
                requires_approval: form.requires_approval ? 1 : 0,
                remarks: form.remarks,
                items: validItems.map(i => ({
                    stock_type: i.stock_type,
                    ref_id: i.ref_id || null,
                    item_name: i.item_name || (i.stock_type === "milk" ? `${i.milk_type} milk` : ""),
                    milk_type: i.milk_type || null,
                    unit: i.unit || "L",
                    quantity: parseFloat(i.quantity),
                    rate: parseFloat(i.rate || 0),
                    total_amount: parseFloat(i.quantity) * parseFloat(i.rate || 0),
                })),
            });
            showFlash("success", form.requires_approval
                ? "Transfer request sent. Awaiting recipient approval."
                : "Transfer completed successfully.");
            setShowCreateModal(false);
            setForm(emptyForm());
            fetchTransfers();
            fetchStock(user?.centre_id, selectedDate);
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to create transfer.");
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (t) => {
        if (!window.confirm(`Approve transfer ${t.transfer_no} from ${t.from_centre_name}?`)) return;
        try {
            await api.put(`/stock-transfers/${t.transfer_id}/approve`);
            showFlash("success", "Transfer approved.");
            fetchTransfers();
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Approval failed.");
        }
    };

    const handleReject = async (t) => {
        const reason = window.prompt("Reason for rejection (optional):", "");
        if (reason === null) return;
        try {
            await api.put(`/stock-transfers/${t.transfer_id}/reject`, { rejection_reason: reason });
            showFlash("success", "Transfer rejected.");
            fetchTransfers();
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Rejection failed.");
        }
    };

    const handleCancel = async (t) => {
        if (!window.confirm(`Cancel transfer ${t.transfer_no}?`)) return;
        try {
            await api.delete(`/stock-transfers/${t.transfer_id}`);
            showFlash("success", "Transfer cancelled.");
            fetchTransfers();
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Cancellation failed.");
        }
    };

    const openDetail = async (t) => {
        try {
            const { data } = await api.get(`/stock-transfers/${t.transfer_id}`);
            setShowDetailModal(data);
        } catch {
            showFlash("error", "Failed to load transfer details.");
        }
    };

    const filtered = searchName.trim()
        ? transfers.filter(t => {
            const term = searchName.toLowerCase();
            return (t.from_centre_name || "").toLowerCase().includes(term) ||
                (t.to_centre_name || "").toLowerCase().includes(term) ||
                (t.transfer_no || "").toLowerCase().includes(term);
        })
        : transfers;

    const COLS = ["Transfer No", "Route", "Items", "Qty", "Date", "Status", "Actions"];
    const GRID = "140px minmax(0,1fr) 70px 80px 110px 130px 190px";

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('stock_transfer', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar (matches Settings) ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Stock Transfer
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Move milk, products and cattle feed between centres in the dairy
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={fetchTransfers} className={secondaryBtnCls}>
                            <RefreshCw size={15} /> Refresh
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowCreateModal(true); setForm(emptyForm()); }}
                            disabled={!can('stock_transfer', 'C')}
                            className={primaryBtnCls}
                        >
                            <Plus size={15} /> New Transfer
                        </button>
                    </div>
                </div>

                {/* ── Flash ── */}
                <FlashBanner flash={flash} onClose={() => setFlash(null)} />

                {/* ── Filter ── */}
                <SectionCard title="Filter Transfers" icon={<Filter size={16} className="text-white" />}>
                    <div className="flex flex-wrap items-center gap-4">
                        <Field label="Direction" icon={<ArrowRightLeft size={10} />}>
                            <div className="flex gap-2">
                                {[
                                    { val: "incoming", label: "Incoming", icon: <Inbox size={12} /> },
                                    { val: "outgoing", label: "Outgoing", icon: <Upload size={12} /> },
                                    { val: "all", label: "All", icon: <Filter size={12} /> },
                                ].map(d => (
                                    <button key={d.val} type="button" onClick={() => setDirection(d.val)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 text-xs font-semibold transition-all duration-150
                                            ${direction === d.val
                                                ? "bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30"
                                                : "bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm"}`}>
                                        {d.icon}{d.label}
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <Field label="Status" icon={<Clock size={10} />}>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                                <option value="all">All statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </Field>

                        <Field label="Date" icon={<Clock size={10} />}>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={inputCls} />
                        </Field>

                        <Field label="Search" icon={<Filter size={10} />}>
                            <input
                                type="text"
                                value={searchName}
                                onChange={e => setSearchName(e.target.value)}
                                placeholder="Transfer no, centre…"
                                className={inputCls}
                            />
                        </Field>

                        <div className="ml-auto self-end text-xs text-gray-400 font-medium pb-3">
                            {filtered.length} {filtered.length === 1 ? "transfer" : "transfers"}
                        </div>
                    </div>
                </SectionCard>

                {/* ── Transfers List ── */}
                <SectionCard title="Transfers" icon={<ArrowRightLeft size={16} className="text-white" />}>
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
                            <ArrowRightLeft size={28} />
                            <p className="text-sm">No transfers found</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-gray-200/60 bg-white/30 backdrop-blur-sm overflow-hidden shadow-sm">
                            <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50"
                                style={{ gridTemplateColumns: GRID }}>
                                {COLS.map((label) => (
                                    <div key={label} className="px-4 py-3 flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200/60 last:border-r-0">
                                        {label}
                                    </div>
                                ))}
                            </div>

                            {filtered.map((t, idx) => {
                                const isIncoming = Number(t.to_centre_id) === Number(user?.centre_id);                                const canApprove = isIncoming && t.status === "pending" && t.requires_approval && can('stock_transfer', 'U');
                                const canCancel = !isIncoming && t.status === "pending" && can('stock_transfer', 'D');
                                return (
                                    <div key={t.transfer_id}
                                        className={`grid hover:bg-gray-50/50 transition
                                            ${idx !== filtered.length - 1 ? "border-b border-gray-200/60" : ""}`}
                                        style={{ gridTemplateColumns: GRID }}>

                                        <div className="px-4 py-3 flex items-center border-r border-gray-200/60">
                                            <span className="font-mono text-xs text-gray-700 bg-gray-50/80 border border-gray-200/60 px-2 py-1 rounded-lg backdrop-blur-sm font-bold">
                                                {t.transfer_no}
                                            </span>
                                        </div>

                                        <div className="px-4 py-3 flex items-center border-r border-gray-200/60 gap-2 min-w-0">
                                            <span className="text-xs font-semibold text-gray-700 truncate">{t.from_centre_name}</span>
                                            <ArrowRightLeft size={11} className="text-gray-400 shrink-0" />
                                            <span className="text-xs font-semibold text-gray-700 truncate">{t.to_centre_name}</span>
                                        </div>

                                        <div className="px-4 py-3 flex items-center border-r border-gray-200/60">
                                            <span className="text-xs font-bold text-gray-700">{t.item_count}</span>
                                        </div>

                                        <div className="px-4 py-3 flex items-center border-r border-gray-200/60">
                                            <span className="text-xs font-bold text-blue-700 font-mono">{parseFloat(t.total_qty || 0).toFixed(1)}</span>
                                        </div>

                                        <div className="px-4 py-3 flex items-center border-r border-gray-200/60">
                                            <span className="text-xs text-gray-600">{fmtDate(t.transfer_date)}</span>
                                        </div>

                                        <div className="px-4 py-3 flex items-center border-r border-gray-200/60 gap-1">
                                            <StatusBadge status={t.status} />
                                            {!t.requires_approval && (
                                                <span title="No approval required" className="text-emerald-500">
                                                    <ShieldOff size={11} />
                                                </span>
                                            )}
                                        </div>

                                        <div className="px-4 py-3 flex items-center gap-1.5">
                                            <button type="button" onClick={() => openDetail(t)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white/60 hover:bg-gray-50/80 text-gray-600 border border-gray-200/60 transition shadow-sm">
                                                <Eye size={10} /> View
                                            </button>
                                            {canApprove && (
                                                <>
                                                    <button type="button" onClick={() => handleApprove(t)}
                                                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 transition shadow-sm">
                                                        Approve
                                                    </button>
                                                    <button type="button" onClick={() => handleReject(t)}
                                                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 border border-rose-200/60 transition shadow-sm">
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            {canCancel && (
                                                <button type="button" onClick={() => handleCancel(t)}
                                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 border border-rose-200/60 transition shadow-sm">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>

                {/* ── Bottom save-style footer (matches Settings) ── */}
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => { setShowCreateModal(true); setForm(emptyForm()); }}
                        disabled={!can('stock_transfer', 'C')}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                    >
                        <Plus size={16} /> New Transfer
                    </button>
                </div>
            </main>

            {/* ── Create Transfer Modal ── */}
            {showCreateModal && (
    <CreateTransferModal
        form={form}
        setForm={setForm}
        centres={centres}
        availableStock={availableStock}
        user={user}
        saving={saving}
        onClose={() => { setShowCreateModal(false); setForm(emptyForm()); }}
        onSubmit={handleCreate}
        addItem={addItem}
        updateItem={updateItem}
        removeItem={removeItem}
        selectStock={selectStock}
        getMaxQty={getMaxQty}
    />
)}

            {/* ── Detail Modal ── */}
            {showDetailModal && (
                <DetailModal transfer={showDetailModal} onClose={() => setShowDetailModal(null)} />
            )}
        </div>
    );
}

// ── Create Transfer Modal ──────────────────────────────────────
function CreateTransferModal({
    form, setForm, centres, availableStock, user, saving,
    onClose, onSubmit, addItem, updateItem, removeItem, selectStock, getMaxQty,
}) {
    const selectedDest = centres.find(c => String(c.centre_id) === String(form.to_centre_id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-gray-50/50 to-white/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20 shrink-0">
                            <ArrowRightLeft size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">New Stock Transfer</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">From your centre to another centre in the dairy</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Destination Centre" icon={<Building2 size={10} />}>
                            <select
                                value={form.to_centre_id}
                                onChange={(e) => setForm(p => ({ ...p, to_centre_id: e.target.value }))}
                                className={selectCls + " w-full"}
                            >
                                <option value="">Select centre…</option>
                                {centres.map(c => (
                                    <option key={c.centre_id} value={c.centre_id}>
                                        {c.centre_name} ({c.centre_code})
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Transfer Date" icon={<Clock size={10} />}>
                            <input
                                type="date"
                                value={form.transfer_date}
                                onChange={(e) => setForm(p => ({ ...p, transfer_date: e.target.value }))}
                                className={inputCls}
                            />
                        </Field>

                        <Field label="Approval Required" icon={form.requires_approval ? <ShieldCheck size={10} /> : <ShieldOff size={10} />}>
                            <div className="flex items-center justify-between gap-4 h-[46px] px-4 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm shadow-sm">
                                <span className="text-xs font-semibold text-gray-600">
                                    {form.requires_approval ? "Recipient must approve" : "Auto-apply"}
                                </span>
                                <Toggle
                                    checked={form.requires_approval}
                                    onChange={() => setForm(p => ({ ...p, requires_approval: !p.requires_approval }))}
                                />
                            </div>
                        </Field>
                    </div>

                    {/* Source stock summary */}
                    <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 backdrop-blur-sm p-4">
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">
                            Available at your centre ({user?.centre_name || "source"})
                        </p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="px-2.5 py-1 rounded-lg bg-white/70 border border-blue-200/60 text-blue-700 font-semibold shadow-sm">
                                Milk: {parseFloat(availableStock.milk?.available_milk || 0).toFixed(2)} L
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-white/70 border border-violet-200/60 text-violet-700 font-semibold shadow-sm">
                                Products: {availableStock.products.length}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-white/70 border border-emerald-200/60 text-emerald-700 font-semibold shadow-sm">
                                Feeds: {availableStock.feeds.length}
                            </span>
                        </div>
                    </div>

                    {/* Add item buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Add item:</span>
                        <button type="button" onClick={() => addItem("milk")}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50/80 hover:bg-blue-100/80 text-blue-700 border border-blue-200/60 transition shadow-sm">
                            <Milk size={12} /> Milk
                        </button>
                        <button type="button" onClick={() => addItem("product")}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-50/80 hover:bg-violet-100/80 text-violet-700 border border-violet-200/60 transition shadow-sm">
                            <ShoppingCart size={12} /> Product
                        </button>
                        <button type="button" onClick={() => addItem("cattle_feed")}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 transition shadow-sm">
                            <Package size={12} /> Cattle Feed
                        </button>
                    </div>

                    {/* Items table */}
                    {form.items.length === 0 ? (
                        <div className="text-center py-10 text-gray-300 text-sm border border-dashed border-gray-200/60 rounded-xl bg-white/30">
                            No items added yet. Use the buttons above.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="grid gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1"
                                style={{ gridTemplateColumns: "80px minmax(0,1fr) 90px 90px 100px 100px 36px" }}>
                                <span>Type</span>
                                <span>Item</span>
                                <span>Qty</span>
                                <span>Rate</span>
                                <span>Total</span>
                                <span>Milk Type</span>
                                <span />
                            </div>
                            {form.items.map((it) => {
                                const total = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
                                return (
                                    <div key={it._key} className="grid gap-2 items-start"
                                        style={{ gridTemplateColumns: "80px minmax(0,1fr) 90px 90px 100px 100px 36px" }}>
                                        <div className="h-[42px] flex items-center justify-center">
                                            <TypePill type={it.stock_type} />
                                        </div>

                                        <div>
                                            {it.stock_type === "milk" ? (
                                                <TinyInput value={it.item_name || `${it.milk_type} milk`} readOnly className="w-full bg-blue-50/30 border-blue-200/60 text-blue-700" />
                                            ) : (
                                                <ItemPicker
                                                    options={it.stock_type === "product" ? availableStock.products : availableStock.feeds}
                                                    value={it.item_name}
                                                    onSelect={(o) => selectStock(it._key, o)}
                                                    onChange={(v) => updateItem(it._key, "item_name", v)}
                                                    placeholder={`Search ${it.stock_type === "product" ? "product" : "feed"}…`}
                                                />
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <TinyInput
                                                value={it.quantity}
                                                onChange={(e) => updateItem(it._key, "quantity", e.target.value)}
                                                placeholder="0.0" type="number" step="0.01" min="0"
                                                max={getMaxQty(it, availableStock) ?? undefined}
                                                className="w-full bg-blue-50/30 border-blue-200/60 text-blue-700"
                                            />
                                            {getMaxQty(it, availableStock) != null && (
                                                <span className="text-[9px] text-gray-400 pl-1">
                                                    Max: {parseFloat(getMaxQty(it, availableStock)).toFixed(2)} {it.unit}
                                                </span>
                                            )}
                                        </div>

                                        <TinyInput
                                            value={it.rate}
                                            onChange={(e) => updateItem(it._key, "rate", e.target.value)}
                                            placeholder="₹0.00" type="number" step="0.01"
                                            className="w-full bg-amber-50/30 border-amber-200/60 text-amber-700"
                                        />

                                        <div className={`h-[42px] px-2 flex items-center rounded-xl border text-xs font-bold whitespace-nowrap shadow-sm
                                            ${total ? "bg-emerald-50/80 border-emerald-200/60 text-emerald-700" : "bg-gray-50/80 border-gray-200/60 text-gray-300"}`}>
                                            {total ? `₹${total.toFixed(2)}` : "—"}
                                        </div>

                                        {it.stock_type === "milk" ? (
                                            <select
                                                value={it.milk_type || "cow"}
                                                onChange={(e) => updateItem(it._key, "milk_type", e.target.value)}
                                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-2 py-2 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full h-[42px]"
                                            >
                                                <option value="cow">Cow</option>
                                                <option value="buffalo">Buffalo</option>
                                                <option value="mixed">Mixed</option>
                                            </select>
                                        ) : (
                                            <div className="h-[42px]" />
                                        )}

                                        <button type="button" onClick={() => removeItem(it._key)}
                                            className="w-9 h-[42px] flex items-center justify-center rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 transition border border-rose-200/60 backdrop-blur-sm shadow-sm">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Remarks */}
                    <Field label="Remarks (optional)" icon={<Filter size={10} />}>
                        <textarea
                            value={form.remarks}
                            onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))}
                            rows={2}
                            placeholder="Reason / notes for the recipient centre…"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-800 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition resize-none placeholder:text-gray-300 placeholder:font-normal"
                        />
                    </Field>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/60 shrink-0 bg-gray-50/60">
                    <div className="text-xs text-gray-500">
                        {selectedDest
                            ? <>To: <span className="font-bold text-gray-700">{selectedDest.centre_name}</span></>
                            : "Select a destination centre"}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className={secondaryBtnCls}>Cancel</button>
                        <button onClick={onSubmit} disabled={saving} className={primaryBtnCls}>
                            <Send size={14} />
                            {saving ? "Sending…" : (form.requires_approval ? "Send Request" : "Transfer Now")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Detail Modal ───────────────────────────────────────────────
function DetailModal({ transfer, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-gray-50/50 to-white/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20 shrink-0">
                            <ArrowRightLeft size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 font-mono">{transfer.transfer_no}</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                {transfer.from_centre_name} <ArrowRightLeft size={10} className="inline mx-1" /> {transfer.to_centre_name}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-gray-200/60 bg-white/50 p-3.5 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</p>
                            <p className="font-semibold text-gray-800 mt-1">{fmtDate(transfer.transfer_date)}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200/60 bg-white/50 p-3.5 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</p>
                            <div className="mt-1"><StatusBadge status={transfer.status} /></div>
                        </div>
                        <div className="rounded-xl border border-gray-200/60 bg-white/50 p-3.5 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Created By</p>
                            <p className="font-semibold text-gray-800 mt-1">{transfer.created_by_name || "—"}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200/60 bg-white/50 p-3.5 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Approval</p>
                            <p className="font-semibold text-gray-800 mt-1">
                                {transfer.requires_approval ? "Required" : "Not required"}
                            </p>
                        </div>
                        {transfer.approved_by_name && (
                            <div className="rounded-xl border border-gray-200/60 bg-white/50 p-3.5 shadow-sm col-span-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Approved By</p>
                                <p className="font-semibold text-gray-800 mt-1">
                                    {transfer.approved_by_name} · {transfer.approved_at ? new Date(transfer.approved_at).toLocaleString("en-IN") : ""}
                                </p>
                            </div>
                        )}
                        {transfer.rejection_reason && (
                            <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 p-3.5 shadow-sm col-span-2">
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Rejection Reason</p>
                                <p className="text-gray-700 mt-1">{transfer.rejection_reason}</p>
                            </div>
                        )}
                        {transfer.remarks && (
                            <div className="rounded-xl border border-gray-200/60 bg-white/50 p-3.5 shadow-sm col-span-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Remarks</p>
                                <p className="text-gray-700 mt-1">{transfer.remarks}</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Items</p>
                        <div className="space-y-2">
                            {transfer.items?.map(it => (
                                <div key={it.item_id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 shadow-sm">
                                    <TypePill type={it.stock_type} />
                                    <span className="flex-1 text-xs font-semibold text-gray-800 truncate">{it.item_name}</span>
                                    <span className="text-xs font-mono text-blue-700 font-bold">
                                        {parseFloat(it.quantity).toFixed(2)} {it.unit}
                                    </span>
                                    <span className="text-xs font-mono text-gray-500">@ ₹{parseFloat(it.rate || 0).toFixed(2)}</span>
                                    <span className="text-xs font-mono text-emerald-700 font-bold">
                                        ₹{parseFloat(it.total_amount || 0).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}