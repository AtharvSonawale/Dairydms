import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Package, Save, Plus, AlertTriangle, BadgeCheck,
    RefreshCw, X, Pencil, Check, Layers, Hash,
    TrendingUp, TrendingDown, Search, Archive, IndianRupee,
    Wheat,
} from "lucide-react";
import api from "../../api/axios";
import { usePermission } from '../../context/PermissionContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import AccessDenied from '../../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const fmtStock = (v) => parseFloat(v || 0).toFixed(2);
const fmtCurrency = (v) => v ? `₹${fmtStock(v)}` : "-";

const EMPTY_NEW = {
    feed_name: "",
    unit: "",
    supplier_name: "",
    rate: "",
    mrp_rate: ""
};

function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1">
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

// ── Inline Edit Row ───────────────────────────────────────────
function FeedRow({ feed, onSave, onDelete, t, can }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({
        feed_name: feed.feed_name,
        unit: feed.unit,
        current_stock: fmtStock(feed.current_stock),
        supplier_name: feed.supplier_name || "",
        rate: feed.rate ? fmtStock(feed.rate) : "",
        mrp_rate: feed.mrp_rate ? fmtStock(feed.mrp_rate) : "",
    });
    const [saving, setSaving] = useState(false);
    const nameRef = useRef(null);

    const startEdit = () => {
        setDraft({
            feed_name: feed.feed_name,
            unit: feed.unit,
            current_stock: fmtStock(feed.current_stock),
            supplier_name: feed.supplier_name || "",
            rate: feed.rate ? fmtStock(feed.rate) : "",
            mrp_rate: feed.mrp_rate ? fmtStock(feed.mrp_rate) : "",
        });
        setEditing(true);
        setTimeout(() => nameRef.current?.focus(), 50);
    };

    const cancelEdit = () => setEditing(false);

    const handleSave = async () => {
        if (!draft.feed_name.trim()) return;
        if (!draft.unit.trim()) return;
        setSaving(true);
        await onSave(feed.feed_id, {
            feed_name: draft.feed_name.trim(),
            unit: draft.unit.trim(),
            current_stock: parseFloat(draft.current_stock) || 0,
            supplier_name: draft.supplier_name.trim() || null,
            rate: parseFloat(draft.rate) || null,
            mrp_rate: parseFloat(draft.mrp_rate) || null,
        });
        setSaving(false);
        setEditing(false);
    };

    const stockVal = parseFloat(feed.current_stock || 0);
    const stockColor =
        stockVal <= 0
            ? "text-red-500 bg-red-50 border-red-100"
            : stockVal < 5
                ? "text-amber-600 bg-amber-50 border-amber-100"
                : "text-emerald-600 bg-emerald-50 border-emerald-100";

    const GRID = "2fr 1fr 120px 150px 100px 100px 90px 90px 50px";

    return (
        <div
            className={`grid border-b border-gray-50 transition-colors min-w-max ${editing ? "bg-blue-50/40" : "hover:bg-gray-50/60"}`}
            style={{ gridTemplateColumns: GRID }}
        >
            {/* Feed Name */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {editing ? (
                    <input
                        ref={nameRef}
                        value={draft.feed_name}
                        onChange={(e) => setDraft((d) => ({ ...d, feed_name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                        className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-900
                            bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    />
                ) : (
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
                            <Wheat size={13} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{feed.feed_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{t('cattleFeedCatalogue.idLabel', { id: feed.feed_id })}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Unit */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {editing ? (
                    <input
                        value={draft.unit}
                        onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                        placeholder={t('cattleFeedCatalogue.unitPlaceholder')}
                        className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900
                            bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    />
                ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold font-mono">
                        {feed.unit}
                    </span>
                )}
            </div>

            {/* Stock */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {editing ? (
                    <div className="flex items-center gap-1.5 w-full">
                        <input
                            value={draft.current_stock}
                            onChange={(e) => setDraft((d) => ({ ...d, current_stock: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                            type="number" step="0.01" placeholder="0.00"
                            className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900
                                bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">{draft.unit || feed.unit}</span>
                    </div>
                ) : (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono ${stockColor}`}>
                        {fmtStock(feed.current_stock)}
                        <span className="font-normal text-[10px]">{feed.unit}</span>
                    </span>
                )}
            </div>

            {/* Supplier */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {editing ? (
                    <input
                        value={draft.supplier_name}
                        onChange={(e) => setDraft((d) => ({ ...d, supplier_name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                        placeholder={t('cattleFeedCatalogue.supplierPlaceholder')}
                        className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    />
                ) : (
                    <span className="text-sm text-gray-700">{feed.supplier_name || "-"}</span>
                )}
            </div>

            {/* Rate */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {editing ? (
                    <div className="flex items-center gap-1 w-full">
                        <IndianRupee size={12} className="text-gray-400" />
                        <input
                            value={draft.rate}
                            onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                            type="number" step="0.01" placeholder="0.00"
                            className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                        />
                    </div>
                ) : (
                    <span className="text-sm font-mono text-gray-700">{fmtCurrency(feed.rate)}</span>
                )}
            </div>

            {/* MRP */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {editing ? (
                    <div className="flex items-center gap-1 w-full">
                        <IndianRupee size={12} className="text-gray-400" />
                        <input
                            value={draft.mrp_rate}
                            onChange={(e) => setDraft((d) => ({ ...d, mrp_rate: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                            type="number" step="0.01" placeholder="0.00"
                            className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                        />
                    </div>
                ) : (
                    <span className="text-sm font-mono text-gray-700">{fmtCurrency(feed.mrp_rate)}</span>
                )}
            </div>

            {/* Status */}
            <div className="px-4 py-3 flex items-center border-r border-gray-50">
                {stockVal <= 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500">
                        <TrendingDown size={11} /> {t('cattleFeedCatalogue.statusOut')}
                    </span>
                ) : stockVal < 5 ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500">
                        <AlertTriangle size={11} /> {t('cattleFeedCatalogue.statusLow')}
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                        <TrendingUp size={11} /> {t('cattleFeedCatalogue.statusOk')}
                    </span>
                )}
            </div>

            {/* Edit / Save / Cancel */}
            <div className="px-3 py-3 flex items-center gap-1.5 border-r border-gray-50">
                {can('cattle_feeds', 'U') && (editing ? (
                    <>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Check size={11} />}
                            {saving ? t('cattleFeedCatalogue.saving') : t('cattleFeedCatalogue.save')}
                        </button>
                        <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                        >
                            <X size={13} />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={startEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-400 hover:text-gray-800 transition"
                    >
                        <Pencil size={11} /> {t('cattleFeedCatalogue.edit')}
                    </button>
                ))}
            </div>

            {/* Delete */}
            <div className="px-3 py-3 flex items-center">
                {!editing && can('cattle_feeds', 'D') && (
                    <button
                        onClick={() => onDelete(feed)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        title={t('cattleFeedCatalogue.removeFeed')}
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CattleFeedCatalogue() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();
    const [feeds, setFeeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [newFeed, setNewFeed] = useState(EMPTY_NEW);
    const [savingNew, setSavingNew] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="feed-actions"]',
                    popover: {
                        title: t('cattleFeedCatalogue.tour.actions.title'),
                        description: t('cattleFeedCatalogue.tour.actions.description'),
                    },
                },
                {
                    element: '[data-tour="feed-stats"]',
                    popover: {
                        title: t('cattleFeedCatalogue.tour.stats.title'),
                        description: t('cattleFeedCatalogue.tour.stats.description'),
                    },
                },
                {
                    element: '[data-tour="feeds-table"]',
                    popover: {
                        title: t('cattleFeedCatalogue.tour.table.title'),
                        description: t('cattleFeedCatalogue.tour.table.description'),
                    },
                },
            ],
        });
        driverObj.drive();
    };

    // fetch
    const fetchFeeds = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/cattle-feeds");
            setFeeds(data);
        } catch {
            showFlash("error", t('cattleFeedCatalogue.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFeeds(); }, []);

    // filter
    const filtered = search.trim()
        ? feeds.filter(
            (f) =>
                f.feed_name.toLowerCase().includes(search.toLowerCase()) ||
                f.unit.toLowerCase().includes(search.toLowerCase()) ||
                (f.supplier_name && f.supplier_name.toLowerCase().includes(search.toLowerCase())) ||
                String(f.feed_id).includes(search.trim())
        )
        : feeds;

    // add new feed
    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newFeed.feed_name.trim() || !newFeed.unit.trim()) return;
        setSavingNew(true);
        try {
            await api.post("/cattle-feeds", {
                feed_name: newFeed.feed_name.trim(),
                unit: newFeed.unit.trim(),
                supplier_name: newFeed.supplier_name.trim() || null,
                rate: parseFloat(newFeed.rate) || null,
                mrp_rate: parseFloat(newFeed.mrp_rate) || null,
            });
            await fetchFeeds();
            setNewFeed(EMPTY_NEW);
            setShowAdd(false);
            showFlash("success", t('cattleFeedCatalogue.addSuccess', { name: newFeed.feed_name.trim() }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cattleFeedCatalogue.addError'));
        } finally {
            setSavingNew(false);
        }
    };

    // inline save (edit)
    const handleSave = async (feedId, payload) => {
        try {
            await api.put(`/cattle-feeds/${feedId}`, payload);
            await fetchFeeds();
            showFlash("success", t('cattleFeedCatalogue.updateSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cattleFeedCatalogue.updateError'));
        }
    };

    // delete
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/cattle-feeds/${deleteTarget.feed_id}`);
            await fetchFeeds();
            showFlash("success", t('cattleFeedCatalogue.deleteSuccess', { name: deleteTarget.feed_name }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cattleFeedCatalogue.deleteError'));
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    // stats
    const totalFeeds = feeds.length;
    const outOfStock = feeds.filter((f) => parseFloat(f.current_stock || 0) <= 0).length;
    const lowStock = feeds.filter((f) => {
        const s = parseFloat(f.current_stock || 0);
        return s > 0 && s < 5;
    }).length;
    const totalStock = feeds.reduce((a, f) => a + parseFloat(f.current_stock || 0), 0);

    const COLS = [
        t('cattleFeedCatalogue.table.feedName'),
        t('cattleFeedCatalogue.table.unit'),
        t('cattleFeedCatalogue.table.stock'),
        t('cattleFeedCatalogue.table.supplier'),
        t('cattleFeedCatalogue.table.rate'),
        t('cattleFeedCatalogue.table.mrp'),
        t('cattleFeedCatalogue.table.status'),
        t('cattleFeedCatalogue.table.actions'),
        "",
    ];
    const GRID = "2fr 1fr 120px 150px 100px 100px 90px 90px 50px";

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('cattle_feeds', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-700 flex items-center justify-center shadow-md shadow-gray-200">
                            <Wheat size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('cattleFeedCatalogue.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('cattleFeedCatalogue.pageSubtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2" data-tour="feed-actions">
                        <button
                            onClick={startTour}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> {t('cattleFeedCatalogue.takeTour')}
                        </button>
                        {can('cattle_feeds', 'C') && (
                            <button
                                onClick={() => { setShowAdd(true); setNewFeed(EMPTY_NEW); }}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 active:scale-95 transition shadow-md"
                            >
                                <Plus size={14} /> {t('cattleFeedCatalogue.addFeed')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="feed-stats">
                    {[
                        { label: t('cattleFeedCatalogue.stats.totalFeeds'), value: totalFeeds, icon: <Package size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('cattleFeedCatalogue.stats.lowStock'), value: lowStock, icon: <AlertTriangle size={14} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                        { label: t('cattleFeedCatalogue.stats.outOfStock'), value: outOfStock, icon: <TrendingDown size={14} />, color: "text-red-500 bg-red-50 border-red-100" },
                        { label: t('cattleFeedCatalogue.stats.totalStock'), value: totalStock.toFixed(1), icon: <Layers size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
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

                {/* Search + Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="feeds-table">

                    {/* Search bar */}
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                        <Search size={15} className="text-gray-300 shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('cattleFeedCatalogue.searchPlaceholder')}
                            className="flex-1 text-sm text-gray-800 bg-transparent placeholder:text-gray-300
                                focus:outline-none"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500 transition">
                                <X size={14} />
                            </button>
                        )}
                        <span className="text-[11px] text-gray-400 font-medium shrink-0">
                            {t('cattleFeedCatalogue.resultCount', { count: filtered.length, total: feeds.length })}
                        </span>
                    </div>

                    {/* Scrollable table area */}
                    <div className="overflow-x-auto">
                        {/* Table header */}
                        <div className="grid border-b border-gray-100 bg-gray-50/80 min-w-max" style={{ gridTemplateColumns: GRID }}>
                            {COLS.map((label) => (
                                <div key={label} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-300">
                                <Wheat size={36} />
                                <p className="text-sm">
                                    {search ? t('cattleFeedCatalogue.noMatch') : t('cattleFeedCatalogue.noFeeds')}
                                </p>
                                {!search && (
                                    <button
                                        onClick={() => setShowAdd(true)}
                                        className="mt-2 text-xs font-semibold text-gray-500 border border-dashed border-gray-300 px-4 py-2 rounded-xl hover:border-gray-500 hover:text-gray-700 transition"
                                    >
                                        {t('cattleFeedCatalogue.addFirstFeed')}
                                    </button>
                                )}
                            </div>
                        ) : (
                            filtered.map((f) => (
                                <FeedRow
                                    key={f.feed_id}
                                    feed={f}
                                    onSave={handleSave}
                                    onDelete={setDeleteTarget}
                                    t={t}
                                    can={can}
                                />
                            ))
                        )}

                        {/* Footer summary */}
                        {filtered.length > 0 && (
                            <div className="grid border-t-2 border-gray-100 bg-gray-50/80 min-w-max" style={{ gridTemplateColumns: GRID }}>
                                <div className="px-4 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                    {t('cattleFeedCatalogue.footerCount', { count: filtered.length })}
                                </div>
                                <div className="px-4 py-2.5 border-r border-gray-100" />
                                <div className="px-4 py-2.5 text-xs font-bold text-emerald-600 border-r border-gray-100">
                                    {filtered.reduce((a, f) => a + parseFloat(f.current_stock || 0), 0).toFixed(1)} {t('cattleFeedCatalogue.footerTotal')}
                                </div>
                                <div className="px-4 py-2.5 border-r border-gray-100" />
                                <div className="px-4 py-2.5 border-r border-gray-100" />
                                <div className="px-4 py-2.5 border-r border-gray-100" />
                                <div className="px-4 py-2.5 border-r border-gray-100" />
                                <div className="px-4 py-2.5 border-r border-gray-100" />
                                <div className="px-4 py-2.5" />
                            </div>
                        )}
                    </div>{/* end scrollable */}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• {t('cattleFeedCatalogue.legendEdit')}</span>
                    <span>• {t('cattleFeedCatalogue.legendStatus')}</span>
                    <span>• {t('cattleFeedCatalogue.legendStockUpdate')}</span>
                </div>

            </main>

            {/* Add Feed Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-96 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('cattleFeedCatalogue.addModal.title')}</h2>
                                <p className="text-gray-400 text-xs mt-0.5">{t('cattleFeedCatalogue.addModal.subtitle')}</p>
                            </div>
                            <button
                                onClick={() => setShowAdd(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="flex flex-col gap-3">
                            <Field label={t('cattleFeedCatalogue.addModal.feedName') + " *"} icon={<Package size={11} />}>
                                <input
                                    value={newFeed.feed_name}
                                    onChange={(e) => setNewFeed((p) => ({ ...p, feed_name: e.target.value }))}
                                    placeholder={t('cattleFeedCatalogue.addModal.feedNamePlaceholder')}
                                    required autoFocus
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('cattleFeedCatalogue.addModal.unit') + " *"} icon={<Hash size={11} />}>
                                    <input
                                        value={newFeed.unit}
                                        onChange={(e) => setNewFeed((p) => ({ ...p, unit: e.target.value }))}
                                        placeholder={t('cattleFeedCatalogue.addModal.unitPlaceholder')}
                                        required
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </Field>
                                <Field label={t('cattleFeedCatalogue.addModal.currentStock')} icon={<Layers size={11} />}>
                                    <input
                                        value={newFeed.current_stock || ""}
                                        onChange={(e) => setNewFeed((p) => ({ ...p, current_stock: e.target.value }))}
                                        type="number" step="0.01" placeholder="0.00"
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </Field>
                            </div>

                            <Field label={t('cattleFeedCatalogue.addModal.supplierName')} icon={<Package size={11} />}>
                                <input
                                    value={newFeed.supplier_name}
                                    onChange={(e) => setNewFeed((p) => ({ ...p, supplier_name: e.target.value }))}
                                    placeholder={t('cattleFeedCatalogue.addModal.supplierPlaceholder')}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('cattleFeedCatalogue.addModal.rate')} icon={<IndianRupee size={11} />}>
                                    <input
                                        value={newFeed.rate}
                                        onChange={(e) => setNewFeed((p) => ({ ...p, rate: e.target.value }))}
                                        type="number" step="0.01" placeholder="0.00"
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </Field>
                                <Field label={t('cattleFeedCatalogue.addModal.mrp')} icon={<IndianRupee size={11} />}>
                                    <input
                                        value={newFeed.mrp_rate}
                                        onChange={(e) => setNewFeed((p) => ({ ...p, mrp_rate: e.target.value }))}
                                        type="number" step="0.01" placeholder="0.00"
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </Field>
                            </div>

                            <div className="flex gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                                >
                                    {t('cattleFeedCatalogue.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingNew}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingNew && (
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {savingNew ? t('cattleFeedCatalogue.adding') : t('cattleFeedCatalogue.addFeed')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 flex flex-col gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1">
                            <AlertTriangle size={18} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-gray-800 font-semibold text-base">{t('cattleFeedCatalogue.deleteModal.title')}</h2>
                            <p className="text-gray-400 text-sm mt-1">
                                {t('cattleFeedCatalogue.deleteModal.warning', { name: deleteTarget.feed_name })}
                            </p>
                            {parseFloat(deleteTarget.current_stock || 0) > 0 && (
                                <p className="text-amber-600 text-xs font-semibold mt-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                    {t('cattleFeedCatalogue.deleteModal.stockWarning', {
                                        stock: fmtStock(deleteTarget.current_stock),
                                        unit: deleteTarget.unit,
                                    })}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                            >
                                {t('cattleFeedCatalogue.cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting && (
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {deleting ? t('cattleFeedCatalogue.removing') : t('cattleFeedCatalogue.yesRemove')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}