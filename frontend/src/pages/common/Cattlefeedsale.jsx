import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Package, Save, User, AlertTriangle,
    BadgeCheck, RefreshCw, X, TrendingUp,
    ShoppingCart, Layers, Banknote, Users, FileDown,
    Zap, Settings, Trash2, GripVertical, Plus, ImagePlus,
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

const imgUrl = (url) =>
    url
        ? (url.startsWith('http') || url.startsWith('data:') ? url
            : `${import.meta.env.VITE_API_URL || ''}${url}`)
        : null;

const EMPTY_FORM = { seller_id: "" };
const EMPTY_LINE = { feed_id: "", quantity: "", rate: "", mrp_rate: "" };

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

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Speed Feed Config Modal ────────────────────────────────
function SpeedFeedConfigModal({ open, onClose, feeds, showFlash }) {
    const { t } = useTranslation();
    const [speedFeeds, setSpeedFeeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const fileRef = useRef(null);

    const fetchSpeed = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/cattle-feed-sales/speed-feeds');
            setSpeedFeeds(data);
        } catch { showFlash('error', t('cattleFeedSales.speedConfig.loadError')); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (open) fetchSpeed(); }, [open]);

    const [form, setForm] = useState({
        feed_id: '', display_name: '', sort_order: '0', imageBase64: null, preview: null, imageRemoved: false
    });

    const resetForm = () => setForm({
        feed_id: '', display_name: '', sort_order: '0', imageBase64: null, preview: null, imageRemoved: false
    });

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showFlash('error', t('cattleFeedSales.speedConfig.onlyImages')); return; }
        if (file.size > 5 * 1024 * 1024) { showFlash('error', t('cattleFeedSales.speedConfig.imageTooLarge')); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const MAX = 400;
                const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                setForm(p => ({ ...p, imageBase64: compressed, preview: compressed, imageRemoved: false }));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSave = async () => {
        if (!form.feed_id && !editingId) {
            showFlash('error', t('cattleFeedSales.speedConfig.selectFeed'));
            return;
        }
        setSaving(true);
        try {
            const payload = {
                display_name: form.display_name,
                sort_order: form.sort_order,
            };
            if (form.imageBase64) {
                payload.image_url = form.imageBase64;
            } else if (form.imageRemoved) {
                payload.image_url = null;
            }

            if (editingId) {
                await api.put(`/cattle-feed-sales/speed-feeds/${editingId}`, payload);
                showFlash('success', t('cattleFeedSales.speedConfig.saveSuccess'));
            } else {
                await api.post('/cattle-feed-sales/speed-feeds', {
                    ...payload,
                    feed_id: form.feed_id,
                });
                showFlash('success', t('cattleFeedSales.speedConfig.addSuccess'));
            }
            resetForm();
            setEditingId(null);
            await fetchSpeed();
        } catch (err) {
            showFlash('error', err.response?.data?.error || t('cattleFeedSales.speedConfig.saveError'));
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            await api.delete(`/cattle-feed-sales/speed-feeds/${id}`);
            showFlash('success', t('cattleFeedSales.speedConfig.deleteSuccess'));
            await fetchSpeed();
        } catch { showFlash('error', t('cattleFeedSales.speedConfig.deleteError')); }
        finally { setDeletingId(null); }
    };

    const startEdit = (sp) => {
        setEditingId(sp.id);
        setForm({
            feed_id: sp.feed_id,
            display_name: sp.display_name || '',
            sort_order: String(sp.sort_order || 0),
            imageBase64: null,
            preview: imgUrl(sp.image_url),
            imageRemoved: false,
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] flex flex-col">

                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                            <Zap size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">{t('cattleFeedSales.speedConfig.title')}</h2>
                            <p className="text-[10px] text-gray-400">{t('cattleFeedSales.speedConfig.desc')}</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                        <X size={15} />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Left form */}
                    <div className="w-64 shrink-0 border-r border-gray-100 px-5 py-4 flex flex-col gap-4 overflow-y-auto">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {editingId ? t('cattleFeedSales.speedConfig.editEntry') : t('cattleFeedSales.speedConfig.addNew')}
                        </p>

                        {!editingId && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.feed')}</label>
                                <select
                                    value={form.feed_id}
                                    onChange={e => setForm(p => ({ ...p, feed_id: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 transition">
                                    <option value="">{t('cattleFeedSales.speedConfig.selectFeed')}</option>
                                    {feeds
                                        .filter(f => !speedFeeds.find(sp => sp.feed_id === f.feed_id))
                                        .map(f => (
                                            <option key={f.feed_id} value={f.feed_id}>
                                                {f.feed_name}{f.supplier_name ? ` — ${f.supplier_name}` : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.displayName')}</label>
                            <input
                                type="text"
                                value={form.display_name}
                                onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                                placeholder={t('cattleFeedSales.speedConfig.displayPlaceholder')}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.sortOrder')}</label>
                            <input
                                type="number"
                                min="0"
                                value={form.sort_order}
                                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.image')}</label>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-2 border border-dashed border-gray-300 hover:border-amber-400 rounded-xl px-3 py-2 text-xs text-gray-500 hover:text-amber-600 transition">
                                <ImagePlus size={13} />
                                {form.preview ? t('cattleFeedSales.speedConfig.changeImage') : t('cattleFeedSales.speedConfig.uploadImage')}
                            </button>
                            {form.preview && (
                                <div className="relative mt-1">
                                    <img src={form.preview} alt="preview"
                                        className="w-full h-28 object-cover rounded-xl border border-gray-100" />
                                    <button
                                        type="button"
                                        onClick={() => setForm(p => ({ ...p, imageBase64: null, preview: null, imageRemoved: true }))}
                                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center">
                                        <X size={10} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 mt-auto">
                            {editingId && (
                                <button
                                    onClick={() => { setEditingId(null); resetForm(); }}
                                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                                    {t('cattleFeedSales.speedConfig.cancel')}
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50">
                                {saving
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Plus size={12} />}
                                {editingId ? t('cattleFeedSales.speedConfig.update') : t('cattleFeedSales.speedConfig.add')}
                            </button>
                        </div>
                    </div>

                    {/* Right list */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                            {t('cattleFeedSales.speedConfig.count', { count: speedFeeds.length })}
                        </p>

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
                            </div>
                        ) : speedFeeds.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-300">
                                <Zap size={28} />
                                <p className="text-xs">{t('cattleFeedSales.speedConfig.noFeeds')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {speedFeeds.map(sp => (
                                    <div key={sp.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition
                                            ${editingId === sp.id ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                                        <GripVertical size={12} className="text-gray-300 shrink-0" />

                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                                            {sp.image_url
                                                ? <img src={imgUrl(sp.image_url)} alt={sp.feed_name}
                                                    className="w-full h-full object-cover" />
                                                : <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Package size={16} />
                                                </div>}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">
                                                {sp.display_name || sp.feed_name}
                                            </p>
                                            <p className="text-[10px] text-gray-400 truncate">{sp.feed_name}</p>
                                            {sp.supplier_name && (
                                                <p className="text-[10px] text-indigo-500 truncate">
                                                    {t('cattleFeedSales.speedConfig.supplier', { name: sp.supplier_name })}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-emerald-600 font-mono">
                                                    {t('cattleFeedSales.speedConfig.rate', { rate: parseFloat(sp.mrp_rate || 0).toFixed(2) })}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {t('cattleFeedSales.speedConfig.stock', { amount: parseFloat(sp.current_stock || 0).toFixed(1), unit: sp.unit })}
                                                </span>
                                                <span className="text-[10px] text-gray-300">#{sp.sort_order}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => startEdit(sp)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition">
                                                <Settings size={11} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(sp.id)}
                                                disabled={deletingId === sp.id}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 transition disabled:opacity-50">
                                                {deletingId === sp.id
                                                    ? <span className="w-3 h-3 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
                                                    : <Trash2 size={11} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SpeedStripInForm({ onTap }) {
    const { t } = useTranslation();
    const [speedFeeds, setSpeedFeeds] = useState([]);
    const [cols, setCols] = useState(7);
    const stripRef = useRef(null);
    const [cardWidth, setCardWidth] = useState(80);

    useEffect(() => {
        api.get('/cattle-feed-sales/speed-feeds')
            .then(({ data }) => {
                const active = data.filter(sp => sp.is_active);
                setSpeedFeeds(active);
                if (active.length > 5) setCols(Math.min(active.length, 10));
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!stripRef.current) return;
        const gap = 8;
        const totalGap = gap * (cols - 1);
        const available = stripRef.current.offsetWidth - totalGap;
        setCardWidth(Math.floor(available / cols));
    }, [cols, speedFeeds.length]);

    if (speedFeeds.length === 0) return null;

    const nameFontSize = Math.max(9, Math.round(cardWidth * 0.13));
    const rateFontSize = Math.max(9, Math.round(cardWidth * 0.12));
    const supplierFontSize = Math.max(8, Math.round(cardWidth * 0.1));

    return (
        <div className="pb-4 mb-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap size={10} className="text-amber-500" />
                    {t('cattleFeedSales.speedStrip.quick', { count: speedFeeds.length })}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">{t('cattleFeedSales.speedStrip.cols')}</span>
                    <input
                        type="number" min="2" max="12" value={cols}
                        onChange={e => setCols(Math.max(2, Math.min(12, parseInt(e.target.value) || 5)))}
                        className="w-12 border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs text-gray-700 text-center focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                </div>
            </div>

            <div
                ref={stripRef}
                className="grid"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '8px' }}
            >
                {speedFeeds.map(sp => {
                    const outOfStock = parseFloat(sp.current_stock || 0) <= 0;
                    const hasImage = !!sp.image_url;
                    return (
                        <button
                            key={sp.id}
                            type="button"
                            disabled={outOfStock}
                            onClick={() => onTap(sp)}
                            style={{ width: cardWidth }}
                            className={`relative flex flex-col rounded-xl border overflow-hidden transition
                                ${outOfStock
                                    ? 'border-gray-100 opacity-50 cursor-not-allowed'
                                    : 'border-amber-200 hover:border-amber-400 active:scale-95'}`}>

                            {hasImage ? (
                                <>
                                    <div style={{ width: cardWidth, height: cardWidth }} className="shrink-0 relative">
                                        <img
                                            src={imgUrl(sp.image_url)}
                                            alt=""
                                            style={{ width: cardWidth, height: cardWidth }}
                                            className="object-cover"
                                        />
                                        <div className="absolute bottom-0 right-0 bg-black/60 text-white rounded-tl-lg px-1.5 py-0.5 font-mono font-bold leading-none"
                                            style={{ fontSize: rateFontSize }}>
                                            ₹{parseFloat(sp.mrp_rate || 0).toFixed(0)}
                                        </div>
                                        {outOfStock && (
                                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                                <span className="text-[9px] font-bold text-rose-400 text-center leading-tight px-1">{t('cattleFeedSales.speedStrip.outOfStock')}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className="w-full bg-amber-50 text-amber-800 font-semibold text-center px-1 py-1 leading-tight truncate"
                                        style={{ fontSize: nameFontSize }}>
                                        {sp.display_name || sp.feed_name}
                                    </div>
                                    {sp.supplier_name && (
                                        <div
                                            className="w-full bg-amber-100 text-amber-600 text-center px-1 py-0.5 leading-tight truncate"
                                            style={{ fontSize: supplierFontSize }}>
                                            {sp.supplier_name}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full bg-amber-50 px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-1">
                                        <span
                                            className="text-amber-800 font-semibold truncate"
                                            style={{ fontSize: nameFontSize }}>
                                            {sp.display_name || sp.feed_name}
                                        </span>
                                        <span
                                            className="text-amber-600 font-mono font-bold shrink-0"
                                            style={{ fontSize: rateFontSize }}>
                                            {outOfStock ? t('cattleFeedSales.speedStrip.outOfStock') : `₹${parseFloat(sp.mrp_rate || 0).toFixed(0)}`}
                                        </span>
                                    </div>
                                    {sp.supplier_name && (
                                        <div
                                            className="text-amber-500 truncate leading-tight mt-0.5"
                                            style={{ fontSize: supplierFontSize }}>
                                            {sp.supplier_name}
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CattleFeedSales() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();
    const [form, setForm] = useState({ seller_id: "" });
    const [lines, setLines] = useState([{ ...EMPTY_LINE, _key: Date.now() }]);
    const [sales, setSales] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [feeds, setFeeds] = useState([]);
    const [sellerSearch, setSellerSearch] = useState("");
    const [showSellerDrop, setShowSellerDrop] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);
    const [lineFeedSearch, setLineFeedSearch] = useState({});
    const [showFeedDrop, setShowFeedDrop] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [selectedDate, setSelectedDate] = useState(today());
    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [speedConfigOpen, setSpeedConfigOpen] = useState(false);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleAddSpeedLines = (newLines) => {
        setLines(prev => {
            const existingEmpty = prev.filter(l => !l.feed_id && !l.quantity && !l.rate);
            const existingFilled = prev.filter(l => l.feed_id || l.quantity || l.rate);
            const mapped = newLines.map(l => ({ ...l, _key: Date.now() + Math.random() }));
            return [...existingFilled, ...mapped, ...(existingEmpty.length ? [] : [{ ...EMPTY_LINE, _key: Date.now() }])];
        });
    };

    const setLine = (key, k, v) =>
        setLines(prev => prev.map(l => l._key === key ? { ...l, [k]: v } : l));

    const addLine = () =>
        setLines(prev => [...prev, { ...EMPTY_LINE, _key: Date.now() }]);

    const removeLine = (key) =>
        setLines(prev => prev.length > 1 ? prev.filter(l => l._key !== key) : prev);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startSalesTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="sales-header-actions"]',
                    popover: {
                        title: t('cattleFeedSales.dateLabel'),
                        description: t('cattleFeedSales.tourDateDesc', 'Pick a date or range, switch between daily/weekly/monthly, and download a PDF report. Use Speed Config to set up quick‑tap feed buttons.')
                    },
                },
                {
                    element: '[data-tour="sales-stats"]',
                    popover: {
                        title: t('cattleFeedSales.stats.todaySales'),
                        description: t('cattleFeedSales.tourStatsDesc', 'Live counts of sales, total revenue, and unique sellers served.')
                    },
                },
                {
                    element: '[data-tour="sales-form"]',
                    popover: {
                        title: t('cattleFeedSales.form.title'),
                        description: t('cattleFeedSales.tourFormDesc', 'Search for a seller, add feed lines via the quick strip or search, and record the sale. Totals update automatically.')
                    },
                },
                {
                    element: '[data-tour="sales-table"]',
                    popover: {
                        title: t('cattleFeedSales.table.headers.seller'),
                        description: t('cattleFeedSales.tourTableDesc', 'List of all sales in the selected period. Print receipts, edit quantities/rates, or delete a sale (stock is reversed).')
                    },
                },
            ],
        });
        driverObj.drive();
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
        return { from: new Date(y, m, 1).toISOString().split("T")[0], to: new Date(y, m + 1, 0).toISOString().split("T")[0] };
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        setPdfReady(false);
        let newFrom = fromDate, newTo = toDate;
        if (mode === "daily") { newFrom = selectedDate; newTo = selectedDate; }
        else if (mode === "weekly") { const r = getWeekRange(selectedDate); newFrom = r.from; newTo = r.to; }
        else if (mode === "monthly") { const r = getMonthRange(selectedDate); newFrom = r.from; newTo = r.to; }
        setFromDate(newFrom);
        setToDate(newTo);
        if (mode !== "daily" && mode !== "custom") fetchRangeEntries(newFrom, newTo);
    };

    const fetchRangeEntries = async (from = fromDate, to = toDate) => {
        setLoadingRange(true);
        try {
            const url = from === to
                ? `/cattle-feed-sales/transactions?date=${from}`
                : `/cattle-feed-sales/transactions?from=${from}&to=${to}`;
            const { data } = await api.get(url);
            setRangeEntries(data);
            setPdfReady(true);
        } catch {
            showFlash("error", t('cattleFeedSales.messages.loadRangeFailed'));
        } finally {
            setLoadingRange(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingSale) return;
        setEditSaving(true);
        try {
            await api.put(`/cattle-feed-sales/transaction/${editingSale.transaction_id}`, {
                items: editingSale.items.map(item => ({
                    sale_id: item.sale_id,
                    quantity: parseFloat(item.quantity),
                    rate: parseFloat(item.rate),
                })),
                sale_date: editingSale.sale_date,
            });
            await Promise.all([
                fetchSales(selectedDate),
                fetchFeeds(),
                fetchRangeEntries(fromDate, toDate),
            ]);
            setEditingSale(null);
            showFlash("success", t('cattleFeedSales.messages.saleUpdated'));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cattleFeedSales.messages.updateFailed'));
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const saleId = confirmDelete.id;
        setConfirmDelete(null);
        setDeletingId(saleId);
        try {
            await api.delete(`/cattle-feed-sales/${saleId}`);
            await fetchSales(selectedDate);
            await fetchFeeds();
            await fetchRangeEntries(fromDate, toDate);
            showFlash("success", t('cattleFeedSales.messages.saleDeleted'));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cattleFeedSales.messages.deleteFailed'));
        } finally {
            setDeletingId(null);
        }
    };

    const lineTotal = (line) =>
        line.quantity && line.rate
            ? (parseFloat(line.quantity || 0) * parseFloat(line.rate || 0)).toFixed(2)
            : null;

    const grandFormTotal = lines.reduce((sum, l) => {
        const t = lineTotal(l);
        return sum + (t ? parseFloat(t) : 0);
    }, 0);

    const fetchSellers = async () => {
        try {
            const { data } = await api.get("/sellers");
            setSellers(data);
        } catch { /* silent */ }
    };

    const fetchFeeds = async () => {
        try {
            const { data } = await api.get("/cattle-feeds");
            setFeeds(data);
        } catch { /* silent */ }
    };

    const fetchSales = async (date) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/cattle-feed-sales/transactions?date=${date}`);
            setSales(data);
        } catch {
            showFlash("error", t('cattleFeedSales.messages.loadSalesFailed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSellers(); fetchFeeds(); }, []);
    useEffect(() => { fetchSales(selectedDate); }, [selectedDate]);

    const filteredSellers = (() => {
        const sorted = [...sellers]
            .filter((s) => s.product_sale_enabled == 1)
            .sort((a, b) => a.name.localeCompare(b.name));
        if (!sellerSearch.trim()) return sorted.slice(0, 5);
        const matched = sorted.filter((s) =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            String(s.seller_id) === sellerSearch.trim() ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase())
        );
        return matched.slice(0, 5);
    })();

    const handleSellerSearchChange = (val) => {
        setSellerSearch(val);
        if (!val) { set("seller_id", ""); return; }
        const exact = sellers.find(
            (s) =>
                s.product_sale_enabled == 1 &&
                (String(s.seller_id) === val.trim() ||
                    (s.seller_code || "").toLowerCase() === val.trim().toLowerCase())
        );
        if (exact) {
            set("seller_id", exact.seller_id);
            setSellerSearch(exact.name);
        }
    };

    const selectedSeller = sellers.find((s) => String(s.seller_id) === String(form.seller_id));

    const handleSave = async () => {
        if (!form.seller_id) { showFlash("error", t('cattleFeedSales.form.selectSeller')); return; }

        const validLines = lines.filter(l => l.feed_id && l.quantity && l.rate);
        if (validLines.length === 0) {
            showFlash("error", t('cattleFeedSales.form.addAtLeastOneFeed'));
            return;
        }

        for (const l of validLines) {
            const feed = feeds.find(f => String(f.feed_id) === String(l.feed_id));
            if (feed && parseFloat(l.quantity) > parseFloat(feed.current_stock || 0)) {
                showFlash("error", t('cattleFeedSales.form.insufficientStock', {
                    feed: feed.feed_name,
                    available: parseFloat(feed.current_stock).toFixed(2),
                    unit: feed.unit,
                }));
                return;
            }
        }

        if (saving) return;
        setSaving(true);
        try {
            await api.post("/cattle-feed-sales", {
                seller_id: Number(form.seller_id),
                sale_date: selectedDate,
                lines: validLines.map(l => ({
                    feed_id: Number(l.feed_id),
                    quantity: parseFloat(l.quantity),
                    rate: parseFloat(l.rate),
                })),
            });
            await fetchSales(selectedDate);
            await fetchFeeds();
            showFlash("success", t('cattleFeedSales.form.saleRecorded'));
            setForm(EMPTY_FORM);
            setLines([{ ...EMPTY_LINE, _key: Date.now() }]);
            setLineFeedSearch({});
            setShowFeedDrop({});
            setSellerSearch("");
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || t('cattleFeedSales.form.saveFailed');
            showFlash("error", msg);
        } finally {
            setSaving(false);
        }
    };

    const isFormReady = () => {
        if (!form.seller_id) return false;
        const validLines = lines.filter(l => l.feed_id && l.quantity && l.rate);
        if (validLines.length === 0) return false;
        for (const l of validLines) {
            const feed = feeds.find(f => String(f.feed_id) === String(l.feed_id));
            if (feed && parseFloat(l.quantity) > parseFloat(feed.current_stock || 0)) return false;
        }
        return true;
    };

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (showSellerDrop) return;
        if (Object.values(showFeedDrop).some(Boolean)) return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (saving || !isFormReady()) return;
        handleSave();
    };

    const handleDownloadPDF = () => {
        const baseData = rangeMode === "daily" ? sales : (pdfReady ? rangeEntries : sales);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        const fmtT = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
        const modeLabel = rangeMode === "daily" ? t('cattleFeedSales.rangeDay')
            : rangeMode === "weekly" ? t('cattleFeedSales.rangeWeek')
                : rangeMode === "monthly" ? t('cattleFeedSales.rangeMonth') : t('cattleFeedSales.rangeCustom');
        const periodLabel = fromDate === toDate ? fmtD(fromDate) : `${fmtD(fromDate)} ${t('cattleFeedSales.pdf.report').toLowerCase()} ${fmtD(toDate)}`;
        const totalRevenueCalc = baseData.reduce((a, txn) => a + parseFloat(txn.total_amount || 0), 0);
        const qtyByUnit = baseData.reduce((acc, txn) => {
            txn.items.forEach((item) => {
                const unit = item.unit || "units";
                acc[unit] = (acc[unit] || 0) + parseFloat(item.quantity || 0);
            });
            return acc;
        }, {});
        const uniqueSellersCount = [...new Set(baseData.map((txn) => txn.seller_id))].length;

        const rows = [...baseData].reverse().map((txn, i) => {
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
                        <div>${txn.seller_name || `ID:${txn.seller_id}`}</div>
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
                <div style="font-size:16px;font-weight:700;color:#000">${baseData.length}</div>
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
                    ${t('cattleFeedSales.pdf.grandTotal')} — ${baseData.length} ${t('cattleFeedSales.pdf.entries')} · ${uniqueSellersCount} ${t('cattleFeedSales.pdf.sellerCount', { count: uniqueSellersCount })}
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

    const handlePrintReceipt = (txn) => {
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

    const activeData = rangeMode === "daily" ? sales : (pdfReady ? rangeEntries : []);
    const totalRevenue = activeData.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const qtyByUnit = activeData.reduce((acc, s) => {
        const unit = s.unit || "units";
        acc[unit] = (acc[unit] || 0) + parseFloat(s.quantity || 0);
        return acc;
    }, {});
    const qtyByUnitEntries = Object.entries(qtyByUnit);
    const uniqueSellers = [...new Set(activeData.map((s) => s.seller_id))].length;

    const COLS = [
        t('cattleFeedSales.table.headers.seller'),
        t('cattleFeedSales.table.headers.feed'),
        t('cattleFeedSales.table.headers.qty'),
        t('cattleFeedSales.table.headers.rate'),
        t('cattleFeedSales.table.headers.total'),
        t('cattleFeedSales.table.headers.time'),
        t('cattleFeedSales.table.headers.actions'),
    ];
    const GRID = "1.4fr 1.6fr 80px 80px 100px 70px 100px";

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('cattle_feed_sales', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <ShoppingCart size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('cattleFeedSales.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('cattleFeedSales.pageSubtitle', {
                                    date: new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="sales-header-actions">
                        <button
                            onClick={startSalesTour}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> {t('cattleFeedSales.takeTour')}
                        </button>
                        <button
                            onClick={() => setSpeedConfigOpen(true)}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition border border-amber-200">
                            <Settings size={13} /> {t('cattleFeedSales.speedConfigButton')}
                        </button>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") { setFromDate(d); setToDate(d); }
                                    else if (rangeMode === "weekly") { const r = getWeekRange(d); setFromDate(r.from); setToDate(r.to); }
                                    else if (rangeMode === "monthly") { const r = getMonthRange(d); setFromDate(r.from); setToDate(r.to); }
                                }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.downloadPDF')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[
                                        { v: "daily", l: t('cattleFeedSales.rangeDay') },
                                        { v: "weekly", l: t('cattleFeedSales.rangeWeek') },
                                        { v: "monthly", l: t('cattleFeedSales.rangeMonth') },
                                        { v: "custom", l: t('cattleFeedSales.rangeCustom') }
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate} onChange={e => { const v = e.target.value; setFromDate(v); setPdfReady(false); fetchRangeEntries(v, toDate); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate} onChange={e => { const v = e.target.value; setToDate(v); setPdfReady(false); fetchRangeEntries(fromDate, v); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap hidden sm:inline">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </span>
                                )}

                                {loadingRange ? (
                                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold">
                                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /></svg>
                                        {t('cattleFeedSales.loading')}
                                    </div>
                                ) : (
                                    <button onClick={handleDownloadPDF} disabled={loadingRange}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                        <FileDown size={13} /> PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-3" data-tour="sales-stats">
                    {[
                        { label: t('cattleFeedSales.stats.todaySales'), value: sales.length, icon: <ShoppingCart size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('cattleFeedSales.stats.totalRevenue'), value: "₹" + totalRevenue.toFixed(2), icon: <TrendingUp size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                        { label: t('cattleFeedSales.stats.sellersServed'), value: uniqueSellers, icon: <Users size={14} />, color: "text-violet-600 bg-violet-50 border-violet-100" },
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
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Entry Form */}
                {can('cattle_feed_sales', 'C') && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5" data-tour="sales-form" onKeyDown={handleFormKeyDown}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                            {t('cattleFeedSales.form.title')}
                        </p>

                        {/* Seller row */}
                        <div className="flex items-start gap-3 flex-wrap pb-4 mb-4 border-b border-gray-100">
                            <Field label={t('cattleFeedSales.form.seller')} icon={<User size={12} />}>
                                <div className="relative" style={{ width: "220px" }}>
                                    <TinyInput
                                        value={sellerSearch}
                                        onFocus={() => { setShowSellerDrop(true); setHighlightedIdx(-1); }}
                                        onBlur={() => setTimeout(() => {
                                            setShowSellerDrop(false);
                                            setForm(prev => {
                                                if (!prev.seller_id) setSellerSearch("");
                                                return prev;
                                            });
                                        }, 150)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSellerSearch(val);
                                            setHighlightedIdx(-1);
                                            setShowSellerDrop(true);
                                            if (!val) { set("seller_id", ""); return; }
                                            const exact = sellers.find(
                                                (s) =>
                                                    s.product_sale_enabled == 1 &&
                                                    (String(s.seller_id) === val.trim() ||
                                                        (s.seller_code || "").toLowerCase() === val.trim().toLowerCase())
                                            );
                                            if (exact) { set("seller_id", exact.seller_id); setSellerSearch(exact.name); setShowSellerDrop(false); }
                                        }}
                                        onKeyDown={(e) => {
                                            if (!showSellerDrop || filteredSellers.length === 0) return;
                                            if (e.key === "ArrowDown") {
                                                e.preventDefault();
                                                setHighlightedIdx(i => Math.min(i + 1, filteredSellers.length - 1));
                                            } else if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                setHighlightedIdx(i => Math.max(i - 1, 0));
                                            } else if (e.key === "Enter") {
                                                e.preventDefault();
                                                const sel = highlightedIdx >= 0 ? filteredSellers[highlightedIdx] : filteredSellers[0];
                                                if (sel) {
                                                    set("seller_id", sel.seller_id);
                                                    setSellerSearch(sel.name);
                                                    setShowSellerDrop(false);
                                                }
                                            } else if (e.key === "Escape") {
                                                setShowSellerDrop(false);
                                            }
                                        }}
                                        placeholder={t('cattleFeedSales.form.sellerPlaceholder')}
                                        className="pr-7 w-full"
                                    />
                                    {showSellerDrop && !form.seller_id && filteredSellers.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                {sellerSearch.trim()
                                                    ? t('cattleFeedSales.form.sellerMatches', { count: filteredSellers.length })
                                                    : t('cattleFeedSales.form.sellersAZ')}
                                            </p>
                                            {filteredSellers.map((s, idx) => (
                                                <button key={s.seller_id} type="button"
                                                    onMouseEnter={() => setHighlightedIdx(idx)}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        set("seller_id", s.seller_id);
                                                        setSellerSearch(s.name);
                                                        setShowSellerDrop(false);
                                                    }}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition
                            ${highlightedIdx === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition
                            ${highlightedIdx === idx ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                                                        {s.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-xs">{s.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-mono">{s.seller_code}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {form.seller_id && (
                                        <button type="button"
                                            onClick={() => { set("seller_id", ""); setSellerSearch(""); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {selectedSeller && (
                                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                        {t('cattleFeedSales.form.sellerId', { id: selectedSeller.seller_id, type: selectedSeller.seller_type || "—" })}
                                    </p>
                                )}
                            </Field>
                        </div>

                        {/* Speed strip */}
                        <SpeedStripInForm onTap={(sp) => handleAddSpeedLines([{
                            feed_id: String(sp.feed_id),
                            quantity: "1",
                            rate: String(sp.mrp_rate || sp.rate || ""),
                            mrp_rate: String(sp.mrp_rate || ""),
                            _key: Date.now() + Math.random(),
                        }])} />

                        {/* Feed lines */}
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="grid gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1"
                                style={{ gridTemplateColumns: "minmax(0, 220px) 80px 80px 90px 28px" }}>
                                <span>{t('cattleFeedSales.form.feed')}</span>
                                <span>{t('cattleFeedSales.form.qty')}</span>
                                <span>{t('cattleFeedSales.form.rate')}</span>
                                <span>{t('cattleFeedSales.form.total')}</span>
                                <span />
                            </div>

                            {lines.map((line) => {
                                const lineFeed = feeds.find(f => String(f.feed_id) === String(line.feed_id));
                                const lt = lineTotal(line);
                                const searchVal = lineFeedSearch[line._key] !== undefined
                                    ? lineFeedSearch[line._key]
                                    : (lineFeed?.feed_name || "");

                                return (
                                    <div key={line._key} className="grid gap-2 items-start"
                                        style={{ gridTemplateColumns: "minmax(0, 220px) 80px 80px 90px 28px" }}>

                                        <div className="relative">
                                            <TinyInput
                                                value={searchVal}
                                                onChange={(e) => {
                                                    setLineFeedSearch(p => ({ ...p, [line._key]: e.target.value }));
                                                    setShowFeedDrop(p => ({ ...p, [line._key]: true }));
                                                }}
                                                onFocus={() => {
                                                    setLineFeedSearch(p => ({ ...p, [line._key]: "" }));
                                                    setShowFeedDrop(p => ({ ...p, [line._key]: true }));
                                                }}
                                                onBlur={() => setTimeout(() => {
                                                    setShowFeedDrop(p => ({ ...p, [line._key]: false }));
                                                    setLineFeedSearch(p => { const n = { ...p }; delete n[line._key]; return n; });
                                                }, 150)}
                                                placeholder={t('cattleFeedSales.form.feedPlaceholder')}
                                                className="w-full"
                                            />
                                            {showFeedDrop[line._key] && (
                                                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-52 overflow-y-auto">
                                                    {(lineFeedSearch[line._key]?.trim()
                                                        ? feeds.filter(f => f.feed_name.toLowerCase().includes(lineFeedSearch[line._key].toLowerCase()))
                                                        : feeds
                                                    ).map((f) => (
                                                        <button key={f.feed_id} type="button"
                                                            onMouseDown={() => {
                                                                setLine(line._key, "feed_id", String(f.feed_id));
                                                                setLine(line._key, "rate", f.mrp_rate ? String(f.mrp_rate) : (f.rate ? String(f.rate) : ""));
                                                                setLine(line._key, "mrp_rate", f.mrp_rate ? String(f.mrp_rate) : "");
                                                                setLineFeedSearch(prev => { const n = { ...prev }; delete n[line._key]; return n; });
                                                                setShowFeedDrop(prev => ({ ...prev, [line._key]: false }));
                                                            }}
                                                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition">
                                                            <div>
                                                                <p className="text-xs font-medium text-gray-800">{f.feed_name}</p>
                                                                <p className="text-[10px] text-gray-400">
                                                                    {f.supplier_name && <span className="text-violet-500 font-semibold">{f.supplier_name}</span>}
                                                                    {f.supplier_name && " · "}
                                                                    {t('cattleFeedSales.form.stockLabel', { amount: parseFloat(f.current_stock || 0).toFixed(1), unit: f.unit })}
                                                                </p>
                                                            </div>
                                                            <span className="text-[10px] text-violet-600 font-semibold">
                                                                ₹{parseFloat(f.mrp_rate || 0).toFixed(2)}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {lineFeed && (
                                                <p className={`text-[10px] font-medium mt-0.5 ${parseFloat(lineFeed.current_stock) <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                                                    {t('cattleFeedSales.form.stockLabel', { amount: parseFloat(lineFeed.current_stock || 0).toFixed(2), unit: lineFeed.unit })}
                                                    {parseFloat(lineFeed.current_stock) <= 0 && ` · ${t('cattleFeedSales.form.outOfStock')}`}
                                                </p>
                                            )}
                                        </div>

                                        <TinyInput
                                            value={line.quantity}
                                            onChange={(e) => setLine(line._key, "quantity", e.target.value)}
                                            placeholder="0.0" type="number" step="0.01"
                                            className={`w-full ${lineFeed && parseFloat(line.quantity) > parseFloat(lineFeed.current_stock || 0)
                                                ? "bg-red-50 border-red-300 text-red-700"
                                                : "bg-blue-50 border-blue-200 text-blue-700"}`}
                                        />

                                        <TinyInput
                                            value={line.rate}
                                            onChange={(e) => setLine(line._key, "rate", e.target.value)}
                                            placeholder="₹0.00" type="number" step="0.01"
                                            className="w-full bg-amber-50 border-amber-200 text-amber-700"
                                        />

                                        <div className={`h-[35px] px-2 flex items-center rounded-xl border text-xs font-bold whitespace-nowrap
                                        ${lt ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-300"}`}>
                                            {lt ? t('cattleFeedSales.form.lineTotal', { amount: lt }) : "—"}
                                        </div>

                                        <button type="button" onClick={() => removeLine(line._key)}
                                            disabled={lines.length === 1}
                                            className="w-7 h-[35px] flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-400 disabled:opacity-20 transition">
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <button type="button" onClick={addLine}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 hover:border-gray-500 px-3 py-1.5 rounded-xl transition">
                                <span className="text-base leading-none">+</span> {t('cattleFeedSales.form.addFeed')}
                            </button>
                            {grandFormTotal > 0 && (
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                    <span className="text-xs text-gray-400 font-medium">
                                        {t('cattleFeedSales.form.feedCount', { count: lines.filter(l => l.feed_id).length })} ·
                                    </span>
                                    {t('cattleFeedSales.form.grandTotal')}
                                    <span className="text-emerald-700">₹{grandFormTotal.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                {t('cattleFeedSales.table.entries', { count: sales.length })} {t('cattleFeedSales.form.saleOn')}{" "}
                                {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                {totalRevenue > 0 && (
                                    <span className="ml-2 text-emerald-600 font-semibold">
                                        {t('cattleFeedSales.form.totalRevenueText', { amount: totalRevenue.toFixed(2) })}
                                    </span>
                                )}
                            </p>
                            <button type="button" onClick={handleSave} disabled={saving}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                                ${saving ? "bg-gray-300 cursor-not-allowed" : "bg-black hover:bg-gray-800 active:scale-95"}`}>
                                <Save size={15} />
                                {saving ? t('cattleFeedSales.form.saving') : t('cattleFeedSales.form.recordSale')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Sales Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="sales-table">

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
                    ) : activeData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <ShoppingCart size={32} />
                            <p className="text-sm">
                                {rangeMode === "daily"
                                    ? t('cattleFeedSales.table.noSalesDay')
                                    : t('cattleFeedSales.table.noSalesRange')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {[...activeData].reverse().map((txn, i) => (
                                    <div key={txn.transaction_id || i}
                                        className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}>

                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                    {(txn.seller_name || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-gray-800 font-medium text-xs truncate">{txn.seller_name}</span>
                                                    {txn.seller_code && <span className="text-[10px] text-gray-400 font-mono">{txn.seller_code}</span>}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {txn.items.map(item => (
                                                    <div key={item.sale_id} className="flex items-center gap-1.5">
                                                        <Package size={10} className="text-gray-400 shrink-0" />
                                                        <span className="text-xs text-gray-700 truncate">{item.feed_name}</span>
                                                        <span className="text-[10px] text-gray-400">{item.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-blue-600 font-mono font-semibold text-xs">
                                            <div className="flex flex-col gap-1">
                                                {txn.items.map(item => (
                                                    <span key={item.sale_id}>{parseFloat(item.quantity).toFixed(2)}</span>
                                                ))}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-amber-700 font-mono text-xs font-semibold">
                                            <div className="flex flex-col gap-1">
                                                {txn.items.map(item => (
                                                    <span key={item.sale_id}>₹{parseFloat(item.rate).toFixed(2)}</span>
                                                ))}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-gray-900 font-bold text-xs">
                                            ₹{parseFloat(txn.total_amount).toFixed(2)}
                                        </TableCell>

                                        <TableCell className="text-gray-400 font-mono text-xs">
                                            {fmtTime(txn.created_at)}
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handlePrintReceipt(txn)}
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-400 transition"
                                                    title={t('cattleFeedSales.table.printReceipt')}>
                                                    <FileDown size={11} />
                                                </button>
                                                {can('cattle_feed_sales', 'U') && (
                                                    <button
                                                        onClick={() => setEditingSale({
                                                            transaction_id: txn.transaction_id,
                                                            seller_name: txn.seller_name,
                                                            items: txn.items.map(item => ({
                                                                sale_id: item.sale_id,
                                                                feed_name: item.feed_name,
                                                                quantity: String(item.quantity),
                                                                rate: String(item.rate),
                                                            })),
                                                            sale_date: txn.sale_date,
                                                        })}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition"
                                                        title={t('cattleFeedSales.table.edit')}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                )}
                                                {can('cattle_feed_sales', 'D') && (
                                                    <button
                                                        onClick={() => setConfirmDelete({
                                                            id: txn.items[0].sale_id,
                                                            label: `${txn.seller_name} — ${txn.items.map(i => i.feed_name).join(", ")}`,
                                                        })}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 transition"
                                                        title={t('cattleFeedSales.table.delete')}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeData.length > 0 && (
                        <div className="grid border-t-2 border-gray-100 bg-gray-50/80"
                            style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                {t('cattleFeedSales.table.entries', { count: activeData.length })}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-blue-600 border-r border-gray-100 flex flex-col gap-0.5">
                                {qtyByUnitEntries.length === 0 ? "—"
                                    : qtyByUnitEntries.map(([u, q]) => (
                                        <span key={u}>{q.toFixed(2)} {u}</span>
                                    ))}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-100">
                                ₹{totalRevenue.toFixed(2)}
                            </div>
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span dangerouslySetInnerHTML={{
                        __html: t('cattleFeedSales.legend.salesCount', {
                            count: activeData.length,
                            label: rangeMode === "daily" ? t('cattleFeedSales.table.salesToday') : t('cattleFeedSales.table.salesInRange')
                        })
                    }} />
                    <span>{t('cattleFeedSales.legend.stockAutoUpdate')}</span>
                    <span>{t('cattleFeedSales.legend.clickFeedCard')}</span>
                </div>

            </main>

            <SpeedFeedConfigModal
                open={speedConfigOpen}
                onClose={() => setSpeedConfigOpen(false)}
                feeds={feeds}
                showFlash={showFlash}
            />

            {/* Edit Sale Modal */}
            {editingSale && can('cattle_feed_sales', 'U') && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[500px] flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('cattleFeedSales.editModal.title')}</h2>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    {t('cattleFeedSales.editModal.subtitle', { id: editingSale.transaction_id })}
                                </p>
                            </div>
                            <button onClick={() => setEditingSale(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('cattleFeedSales.editModal.seller')}</p>
                            <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
                                {editingSale.seller_name}
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            {editingSale.items.map((item, index) => (
                                <div key={item.sale_id} className="grid grid-cols-3 gap-2 items-center">
                                    <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('cattleFeedSales.editModal.feed')}</p>
                                        <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
                                            {item.feed_name}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cattleFeedSales.editModal.qty')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => {
                                                const newItems = [...editingSale.items];
                                                newItems[index].quantity = e.target.value;
                                                setEditingSale({ ...editingSale, items: newItems });
                                            }}
                                            className="border border-blue-200 bg-blue-50 rounded-xl px-3 py-2 text-sm text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cattleFeedSales.editModal.rate')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.rate}
                                            onChange={(e) => {
                                                const newItems = [...editingSale.items];
                                                newItems[index].rate = e.target.value;
                                                setEditingSale({ ...editingSale, items: newItems });
                                            }}
                                            className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2 text-sm text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                            <span className="text-xs text-emerald-600 font-medium">{t('cattleFeedSales.editModal.grandTotal')}</span>
                            <span className="text-sm font-bold text-emerald-700">
                                ₹{editingSale.items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)), 0).toFixed(2)}
                            </span>
                        </div>

                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setEditingSale(null)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                {t('cattleFeedSales.editModal.cancel')}
                            </button>
                            <button onClick={handleEditSave} disabled={editSaving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50 transition">
                                {editSaving ? t('cattleFeedSales.editModal.saving') : t('cattleFeedSales.editModal.saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDelete && can('cattle_feed_sales', 'D') && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[340px] flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('cattleFeedSales.deleteModal.title')}</h2>
                                <p className="text-gray-400 text-xs mt-1 leading-relaxed" dangerouslySetInnerHTML={{
                                    __html: t('cattleFeedSales.deleteModal.warning', { label: confirmDelete.label })
                                }} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                {t('cattleFeedSales.deleteModal.cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition">
                                {t('cattleFeedSales.deleteModal.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}