// CattleFeedSales.jsx
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Package, Save, User, AlertTriangle,
    BadgeCheck, RefreshCw, X, TrendingUp,
    ShoppingCart, Layers, Banknote, Users, FileDown,
    Zap, Settings, Trash2, GripVertical, Plus, ImagePlus,
    Home, Tag, UserCircle2
} from "lucide-react";
// AFTER
import api from "../../api/axios";
import { usePermission } from '../../context/PermissionContext';
import { useAppConfig } from '../../context/AppConfigContext';
import AccessDenied from '../../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { printSalesPDF } from '../../components/CattleFeedSalesPDF';
import { printReceipt } from '../../components/CattleFeedReceipt';
import { getPrintSettings } from '../../utils/printSettings';

// ── focus helper ──────────────────────────────────────────────
function focusNextField(current) {
    const container = current?.closest('[data-entry-form]');
    if (!container) return;
    const focusable = Array.from(
        container.querySelectorAll('input, button, select, textarea')
    ).filter(el => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
    const idx = focusable.indexOf(current);
    if (idx > -1 && idx < focusable.length - 1) {
        focusable[idx + 1].focus();
    }
}

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
const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const imgUrl = (url) =>
    url
        ? (url.startsWith('http') || url.startsWith('data:') ? url
            : `${import.meta.env.VITE_API_URL || ''}${url}`)
        : null;

const EMPTY_FORM = { seller_id: "", seller_code: "" };
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
            className={`border border-gray-200/60 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-white/50 backdrop-blur-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm
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
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-2xl max-h-[90vh] flex flex-col">

                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Zap size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">{t('cattleFeedSales.speedConfig.title')}</h2>
                            <p className="text-[10px] text-gray-400">{t('cattleFeedSales.speedConfig.desc')}</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition">
                        <X size={15} />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Left form */}
                    <div className="w-64 shrink-0 border-r border-gray-200/60 px-5 py-4 flex flex-col gap-4 overflow-y-auto">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {editingId ? t('cattleFeedSales.speedConfig.editEntry') : t('cattleFeedSales.speedConfig.addNew')}
                        </p>

                        {!editingId && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.feed')}</label>
                                <select
                                    value={form.feed_id}
                                    onChange={e => setForm(p => ({ ...p, feed_id: e.target.value }))}
                                    className="border border-gray-200/60 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm">
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
                                className="border border-gray-200/60 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.sortOrder')}</label>
                            <input
                                type="number"
                                min="0"
                                value={form.sort_order}
                                onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                                className="border border-gray-200/60 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.speedConfig.image')}</label>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-2 border border-dashed border-gray-300/60 hover:border-amber-400/60 rounded-xl px-3 py-2.5 text-xs text-gray-500 hover:text-amber-600 transition">
                                <ImagePlus size={13} />
                                {form.preview ? t('cattleFeedSales.speedConfig.changeImage') : t('cattleFeedSales.speedConfig.uploadImage')}
                            </button>
                            {form.preview && (
                                <div className="relative mt-1">
                                    <img src={form.preview} alt="preview"
                                        className="w-full h-28 object-cover rounded-xl border border-gray-200/60" />
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
                                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 transition shadow-sm">
                                    {t('cattleFeedSales.speedConfig.cancel')}
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-amber-500 to-amber-600 text-white hover:shadow-lg hover:shadow-amber-500/30 transition disabled:opacity-50 shadow-sm">
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
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition shadow-sm
                                            ${editingId === sp.id ? 'border-amber-300/80 bg-amber-50/80' : 'border-gray-200/60 bg-gray-50/50 hover:bg-gray-100/50'}`}>
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
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50/80 hover:bg-blue-100/80 text-blue-500 transition shadow-sm">
                                                <Settings size={11} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(sp.id)}
                                                disabled={deletingId === sp.id}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 transition disabled:opacity-50 shadow-sm">
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

function SpeedStripInForm({ onTap, t }) {
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
        <div className="pb-4 mb-4 border-b border-gray-200/60">
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
                        className="w-12 border border-gray-200/60 rounded-lg px-1.5 py-0.5 text-xs text-gray-700 text-center bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
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
                            className={`relative flex flex-col rounded-xl border overflow-hidden transition shadow-sm
                                ${outOfStock
                                    ? 'border-gray-200/60 opacity-50 cursor-not-allowed'
                                    : 'border-amber-200/60 hover:border-amber-400/80 hover:shadow-md active:scale-95'}`}>

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
                                        className="w-full bg-amber-50/80 text-amber-800 font-semibold text-center px-1 py-1 leading-tight truncate"
                                        style={{ fontSize: nameFontSize }}>
                                        {sp.display_name || sp.feed_name}
                                    </div>
                                    {sp.supplier_name && (
                                        <div
                                            className="w-full bg-amber-100/80 text-amber-600 text-center px-1 py-0.5 leading-tight truncate"
                                            style={{ fontSize: supplierFontSize }}>
                                            {sp.supplier_name}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full bg-amber-50/80 px-2 py-1.5">
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
    const { appName } = useAppConfig();
    const [centreName, setCentreName] = useState("");
    const [productLabel, setProductLabel] = useState("");

    useEffect(() => {
        api.get('/settings/system-info')
            .then(({ data }) => setCentreName(data?.centre?.centre_name || ""))
            .catch(() => { });
        api.get('/settings/receipt-template')
            .then(({ data }) => setProductLabel(data?.productLabel || ""))
            .catch(() => { });
    }, []);

    const BUYER_MODES = [
        { val: "seller", label: t('cattleFeedSales.form.sellerBuys') || 'Seller', icon: <Users size={18} /> },
        { val: "named", label: t('cattleFeedSales.form.named') || 'Named', icon: <Tag size={18} /> },
        { val: "anon", label: t('cattleFeedSales.form.anon') || 'Anonymous', icon: <UserCircle2 size={18} /> },
    ];

    const [form, setForm] = useState({ buyer_mode: "seller", seller_id: "", seller_code: "" });
    const [namedBuyers, setNamedBuyers] = useState([]);
    const [namedBuyerSearch, setNamedBuyerSearch] = useState("");
    const [namedBuyerId, setNamedBuyerId] = useState("");
    const [namedBuyerDropdownOpen, setNamedBuyerDropdownOpen] = useState(false);
    const [namedBuyerHighlight, setNamedBuyerHighlight] = useState(-1);
    const [lines, setLines] = useState([{ ...EMPTY_LINE, _key: Date.now() }]);
    const [sales, setSales] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [feeds, setFeeds] = useState([]);
    const [sellerSearch, setSellerSearch] = useState("");
    const [sellerCodeInput, setSellerCodeInput] = useState("");
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
    const [printStatus, setPrintStatus] = useState(null);
    const sellerCodeRef = useRef(null);

    // Edit modal state
    const [editSellerSearch, setEditSellerSearch] = useState("");
    const [editBuyerSearch, setEditBuyerSearch] = useState("");
    const [editSellerDrop, setEditSellerDrop] = useState(false);
    const [editBuyerDrop, setEditBuyerDrop] = useState(false);

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
                        description: t('cattleFeedSales.tourDateDesc')
                    },
                },
                {
                    element: '[data-tour="sales-stats"]',
                    popover: {
                        title: t('cattleFeedSales.stats.todaySales'),
                        description: t('cattleFeedSales.tourStatsDesc')
                    },
                },
                {
                    element: '[data-tour="sales-form"]',
                    popover: {
                        title: t('cattleFeedSales.form.title'),
                        description: t('cattleFeedSales.tourFormDesc')
                    },
                },
                {
                    element: '[data-tour="sales-table"]',
                    popover: {
                        title: t('cattleFeedSales.table.headers.seller'),
                        description: t('cattleFeedSales.tourTableDesc')
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

    const setEditLine = (key, k, v) =>
        setEditingSale(prev => ({
            ...prev,
            items: prev.items.map(l => l._key === key ? { ...l, [k]: v } : l),
        }));

    const addEditLine = () =>
        setEditingSale(prev => ({
            ...prev,
            items: [...prev.items, { feed_id: "", quantity: "", rate: "", _key: `new-${Date.now()}` }],
        }));

    const removeEditLine = (key) =>
        setEditingSale(prev => ({
            ...prev,
            items: prev.items.length > 1 ? prev.items.filter(l => l._key !== key) : prev.items,
        }));

    const isEditFormReady = () => {
        if (!editingSale) return false;
        if (editingSale.buyer_mode === "seller" && !editingSale.seller_id) return false;
        if (editingSale.buyer_mode === "named" && !editingSale.buyer_id && !editBuyerSearch.trim()) return false;
        const valid = editingSale.items.filter(l => l.feed_id && l.quantity && l.rate);
        return valid.length > 0;
    };

    const handleEditSave = async () => {
        if (!editingSale || !isEditFormReady()) return;
        setEditSaving(true);
        try {
            await api.put(`/cattle-feed-sales/transaction/${editingSale.transaction_id}`, {
                buyer_mode: editingSale.buyer_mode,
                seller_id: editingSale.buyer_mode === "seller" ? Number(editingSale.seller_id) : null,
                buyer_id: editingSale.buyer_mode === "named" ? (editingSale.buyer_id || null) : null,
                buyer_name: editingSale.buyer_mode === "named" ? editBuyerSearch.trim() : null,
                sale_date: editingSale.sale_date,
                items: editingSale.items
                    .filter(l => l.feed_id && l.quantity && l.rate)
                    .map(item => ({
                        sale_id: item.sale_id || undefined,
                        feed_id: Number(item.feed_id),
                        quantity: parseFloat(item.quantity),
                        rate: parseFloat(item.rate),
                    })),
            });
            await Promise.all([
                fetchSales(selectedDate),
                fetchFeeds(),
                fetchNamedBuyers(),
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

    const fetchNamedBuyers = async () => {
        try {
            const { data } = await api.get("/cattle-feed-sales/named-buyers");
            setNamedBuyers(data);
        } catch { /* silent */ }
    };

    const saveFeedNamedBuyer = async (name) => {
        try {
            const { data } = await api.post("/cattle-feed-sales/named-buyers", { name: name.trim() });
            await fetchNamedBuyers();
            return data;
        } catch (err) {
            if (err.response?.status === 409) {
                const existing = namedBuyers.find(b => b.name.toLowerCase() === name.toLowerCase());
                if (existing) return existing;
            }
            showFlash('error', 'Failed to register buyer');
            return null;
        }
    };

    useEffect(() => { fetchSellers(); fetchFeeds(); fetchNamedBuyers(); }, []);
    useEffect(() => { fetchSales(selectedDate); }, [selectedDate]);

    // ── FIXED: Seller filtering - search by name OR code (partial match) ──
    const filteredSellers = (() => {
        const sorted = [...sellers]
            .filter((s) => s.cattle_feed_sale_enabled == 1)
            .sort((a, b) => a.name.localeCompare(b.name));
        if (!sellerSearch.trim() && !sellerCodeInput.trim()) return sorted.slice(0, 5);
        const searchTerm = sellerSearch.trim() || sellerCodeInput.trim();
        const matched = sorted.filter((s) =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.seller_code || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matched.slice(0, 10);
    })();

    // ── FIXED: Handle seller code change - partial match and auto-select ──
    const handleSellerCodeChange = (code) => {
        setSellerCodeInput(code);
        if (!code.trim()) {
            set("seller_id", "");
            setSellerSearch("");
            setShowSellerDrop(false);
            return;
        }

        // Find exact match by code
        const exactMatch = sellers.find(
            (s) => s.cattle_feed_sale_enabled == 1 &&
                (s.seller_code || "").toLowerCase() === code.trim().toLowerCase()
        );
        if (exactMatch) {
            set("seller_id", exactMatch.seller_id);
            setSellerSearch(exactMatch.name);
            setShowSellerDrop(false);
        } else {
            // Show dropdown with partial matches
            set("seller_id", "");
            setShowSellerDrop(true);
        }
    };

    // ── FIXED: Handle seller search - partial match on name ──
    const handleSellerSearchChange = (val) => {
        setSellerSearch(val);
        setShowSellerDrop(true);
        setHighlightedIdx(-1);
        if (!val) {
            set("seller_id", "");
            setSellerCodeInput("");
            return;
        }

        // Check if the search matches a seller name exactly or code
        const exactMatch = sellers.find(
            (s) => s.cattle_feed_sale_enabled == 1 &&
                (s.name.toLowerCase() === val.trim().toLowerCase() ||
                    (s.seller_code || "").toLowerCase() === val.trim().toLowerCase())
        );
        if (exactMatch) {
            set("seller_id", exactMatch.seller_id);
            setSellerSearch(exactMatch.name);
            setSellerCodeInput(exactMatch.seller_code || "");
            setShowSellerDrop(false);
        } else {
            set("seller_id", "");
        }
    };

    const handleSellerSelect = (seller) => {
        set("seller_id", seller.seller_id);
        setSellerSearch(seller.name);
        setSellerCodeInput(seller.seller_code || "");
        setShowSellerDrop(false);
    };

    const selectedSeller = sellers.find((s) => String(s.seller_id) === String(form.seller_id));

    const handleSave = async () => {
        if (form.buyer_mode === "seller" && !form.seller_id) { showFlash("error", t('cattleFeedSales.form.selectSeller')); return; }
        if (form.buyer_mode === "named" && !namedBuyerId && !namedBuyerSearch.trim()) { showFlash("error", "Buyer name is required."); return; }

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
            const { data: created } = await api.post("/cattle-feed-sales", {
                buyer_mode: form.buyer_mode,
                seller_id: form.buyer_mode === "seller" ? Number(form.seller_id) : null,
                buyer_id: form.buyer_mode === "named" ? (namedBuyerId || null) : null,
                buyer_name: form.buyer_mode === "named" ? namedBuyerSearch.trim() : null,
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

            // ── Auto-print the receipt immediately, no manual click ──
            const { autoPrint } = getPrintSettings();
            if (autoPrint && created?.items?.length) {
                const first = created.items[0];
                const txnForPrint = {
                    transaction_id: created.transaction_id,
                    seller_name: first.seller_name,
                    seller_code: first.seller_code,
                    sale_date: first.sale_date,
                    created_at: first.created_at,
                    fulfillment_token: created.fulfillment_token,
                    items: created.items.map(item => ({
                        sale_id: item.sale_id,
                        feed_name: item.feed_name,
                        unit: item.unit,
                        quantity: item.quantity,
                        rate: item.rate,
                        total_amount: item.total_amount,
                    })),
                };
                handlePrintReceipt(txnForPrint);
            }

            setForm({ buyer_mode: form.buyer_mode, seller_id: "", seller_code: "" });
            setLines([{ ...EMPTY_LINE, _key: Date.now() }]);
            setLineFeedSearch({});
            setShowFeedDrop({});
            setSellerSearch("");
            setSellerCodeInput("");
            setNamedBuyerId("");
            setNamedBuyerSearch("");
            if (form.buyer_mode === "seller") sellerCodeRef.current?.focus();
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || t('cattleFeedSales.form.saveFailed');
            showFlash("error", msg);
        } finally {
            setSaving(false);
        }
    };

    const isFormReady = () => {
        if (form.buyer_mode === "seller" && !form.seller_id) return false;
        if (form.buyer_mode === "named" && !namedBuyerId && !namedBuyerSearch.trim()) return false;
        const validLines = lines.filter(l => l.feed_id && l.quantity && l.rate);
        if (validLines.length === 0) return false;
        for (const l of validLines) {
            const feed = feeds.find(f => String(f.feed_id) === String(l.feed_id));
            if (feed && parseFloat(l.quantity) > parseFloat(feed.current_stock || 0)) return false;
        }
        return true;
    };

    // ── FIXED: Form keydown handler with Enter navigation ──
    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (showSellerDrop) return;
        if (Object.values(showFeedDrop).some(Boolean)) return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();

        // Check if we're on the last field (Save button)
        const container = e.target.closest('[data-entry-form]');
        if (!container) return;
        const focusable = Array.from(
            container.querySelectorAll('input, button, select, textarea')
        ).filter(el => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
        const idx = focusable.indexOf(e.target);

        // If we're at the last focusable element or form is ready, save
        if (idx === focusable.length - 1 || isFormReady()) {
            if (saving) return;
            handleSave();
        } else {
            // Move to next field
            focusNextField(e.target);
        }
    };

    const handleDownloadPDF = () => {
        const baseData = rangeMode === "daily" ? sales : (pdfReady ? rangeEntries : sales);
        printSalesPDF(baseData, rangeMode, fromDate, toDate, t, productLabel);
    };

    const handlePrintReceipt = (txn) => {
        printReceipt(txn, t, appName, centreName, {
            onStart: () => setPrintStatus('preparing'),
            onReady: () => setPrintStatus('printing'),
            onDone: () => setPrintStatus(null),
        });
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
        productLabel || t('cattleFeedSales.table.headers.feed'),
        t('cattleFeedSales.table.headers.qty'),
        t('cattleFeedSales.table.headers.rate'),
        t('cattleFeedSales.table.headers.total'),
        t('cattleFeedSales.table.headers.time'),
        t('cattleFeedSales.table.headers.actions'),
    ];
    const GRID = "1.4fr 1.6fr 80px 80px 100px 70px 100px";

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('cattle_feed_sales', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">

            {printStatus && (
                <div className="fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/95 backdrop-blur-sm text-white text-sm font-medium shadow-2xl shadow-gray-900/30">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    {printStatus === 'preparing'
                        ? (t('cattleFeedSales.receipt.preparing') || 'Preparing receipt…')
                        : (t('cattleFeedSales.receipt.sendingToPrinter') || 'Sending to printer…')}
                </div>
            )}

            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('cattleFeedSales.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('cattleFeedSales.pageSubtitle', {
                                date: new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="sales-header-actions">
                        <button
                            onClick={startSalesTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('cattleFeedSales.takeTour')}
                        </button>
                        <button
                            onClick={() => setSpeedConfigOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-50/80 text-amber-700 border border-amber-200/60 hover:bg-amber-100/80 transition shadow-sm"
                        >
                            <Settings size={15} /> {t('cattleFeedSales.speedConfigButton')}
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
                                className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cattleFeedSales.downloadPDF')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold">
                                    {[
                                        { v: "daily", l: t('cattleFeedSales.rangeDay') },
                                        { v: "weekly", l: t('cattleFeedSales.rangeWeek') },
                                        { v: "monthly", l: t('cattleFeedSales.rangeMonth') },
                                        { v: "custom", l: t('cattleFeedSales.rangeCustom') }
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition-all duration-200 ${rangeMode === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate} onChange={e => { const v = e.target.value; setFromDate(v); setPdfReady(false); fetchRangeEntries(v, toDate); }}
                                            className="border border-gray-200/60 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate} onChange={e => { const v = e.target.value; setToDate(v); setPdfReady(false); fetchRangeEntries(fromDate, v); }}
                                            className="border border-gray-200/60 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl whitespace-nowrap hidden sm:inline shadow-sm">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </span>
                                )}

                                {loadingRange ? (
                                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100/80 text-gray-400 text-xs font-semibold">
                                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /></svg>
                                        {t('cattleFeedSales.loading')}
                                    </div>
                                ) : (
                                    <button onClick={handleDownloadPDF} disabled={loadingRange}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white text-xs font-semibold hover:shadow-lg hover:shadow-rose-500/30 disabled:opacity-40 transition shadow-sm">
                                        <FileDown size={13} /> PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
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

                {/* ── Stats ── */}
                <div className="grid grid-cols-3 gap-3" data-tour="sales-stats">
                    <StatCard
                        label={t('cattleFeedSales.stats.todaySales')}
                        value={sales.length}
                        icon={<ShoppingCart size={14} />}
                        color="text-blue-600 bg-blue-50/80 border-blue-200/60"
                    />
                    <StatCard
                        label={t('cattleFeedSales.stats.totalRevenue')}
                        value={"₹" + totalRevenue.toFixed(2)}
                        icon={<TrendingUp size={14} />}
                        color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60"
                    />
                    <StatCard
                        label={t('cattleFeedSales.stats.sellersServed')}
                        value={uniqueSellers}
                        icon={<Users size={14} />}
                        color="text-violet-600 bg-violet-50/80 border-violet-200/60"
                    />
                </div>

                {/* ── Entry Form ── */}
                {can('cattle_feed_sales', 'C') && (
                    <SectionCard
                        title={t('cattleFeedSales.form.title')}
                        icon={<ShoppingCart size={16} className="text-white" />}
                        data-tour="sales-form"
                    >
                        <div data-entry-form onKeyDown={handleFormKeyDown}>
                            {/* ── Buyer mode selector ── */}
                            <div className="flex gap-2 mb-4">
                                {BUYER_MODES.map(({ val, label, icon }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                            set("buyer_mode", val);
                                            set("seller_id", "");
                                            setSellerSearch("");
                                            setSellerCodeInput("");
                                            setNamedBuyerId("");
                                            setNamedBuyerSearch("");
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition
                    ${form.buyer_mode === val
                                                ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30"
                                                : "bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-400 hover:bg-gray-50/80 shadow-sm"}`}
                                    >
                                        {icon}<span>{label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* ── Seller row with Code and Name fields (seller mode only) ── */}
                            {form.buyer_mode === "seller" && (
                                <div className="flex items-start gap-3 flex-wrap pb-4 mb-4 border-b border-gray-200/60">
                                    <Field label={t('cattleFeedSales.form.sellerCode')} icon={<User size={12} />}>
                                        <TinyInput
                                            ref={sellerCodeRef}
                                            value={sellerCodeInput}
                                            onChange={(e) => handleSellerCodeChange(e.target.value)}
                                            placeholder="SC-001"
                                            className="text-[13px] font-mono w-24"
                                        />
                                    </Field>

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
                                                onChange={(e) => handleSellerSearchChange(e.target.value)}
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
                                                        if (highlightedIdx >= 0 && filteredSellers[highlightedIdx]) {
                                                            const sel = filteredSellers[highlightedIdx];
                                                            handleSellerSelect(sel);
                                                            focusNextField(e.currentTarget);
                                                        } else {
                                                            setShowSellerDrop(false);
                                                            focusNextField(e.currentTarget);
                                                        }
                                                    } else if (e.key === "Escape") {
                                                        setShowSellerDrop(false);
                                                    }
                                                }}
                                                placeholder={t('cattleFeedSales.form.sellerPlaceholder')}
                                                className="pr-7 w-full"
                                            />
                                            {showSellerDrop && !form.seller_id && filteredSellers.length > 0 && (
                                                <div className="absolute top-full left-0 mt-1 w-64 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 overflow-hidden">
                                                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200/60">
                                                        {sellerSearch.trim() || sellerCodeInput.trim()
                                                            ? `${filteredSellers.length} ${t('cattleFeedSales.form.sellerMatches', { count: filteredSellers.length })}`
                                                            : t('cattleFeedSales.form.sellersAZ')}
                                                    </p>
                                                    {filteredSellers.map((s, idx) => (
                                                        <button key={s.seller_id} type="button"
                                                            onMouseEnter={() => setHighlightedIdx(idx)}
                                                            onClick={() => {
                                                                handleSellerSelect(s);
                                                                focusNextField(e.currentTarget);
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition
                                    ${highlightedIdx === idx ? "bg-gray-100/80" : "hover:bg-gray-50/80"}`}>
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition
                                    ${highlightedIdx === idx ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-gray-100/80 text-gray-600"}`}>
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
                                                    onClick={() => { set("seller_id", ""); setSellerSearch(""); setSellerCodeInput(""); }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </Field>
                                </div>
                            )}

                            {form.buyer_mode === "named" && (
                                <div className="flex items-start gap-3 flex-wrap pb-4 mb-4 border-b border-gray-200/60">
                                    <Field label={t('cattleFeedSales.form.buyerName') || "Buyer Name"} icon={<User size={12} />}>
                                        <div className="relative" style={{ width: "220px" }}>
                                            <TinyInput
                                                value={namedBuyerSearch}
                                                onFocus={() => { setNamedBuyerDropdownOpen(true); setNamedBuyerHighlight(-1); }}
                                                onBlur={() => setTimeout(() => setNamedBuyerDropdownOpen(false), 150)}
                                                onChange={(e) => {
                                                    setNamedBuyerSearch(e.target.value);
                                                    setNamedBuyerId("");
                                                    setNamedBuyerDropdownOpen(true);
                                                }}
                                                placeholder={t('cattleFeedSales.form.buyerPlaceholder') || "Search or add buyer..."}
                                                className="pr-7 w-full"
                                            />
                                            {namedBuyerDropdownOpen && (() => {
                                                const filtered = namedBuyerSearch
                                                    ? namedBuyers.filter(b => b.name.toLowerCase().includes(namedBuyerSearch.toLowerCase()))
                                                    : namedBuyers.slice(0, 5);
                                                const showRegister = namedBuyerSearch.trim() &&
                                                    !namedBuyers.find(b => b.name.toLowerCase() === namedBuyerSearch.toLowerCase());
                                                return (filtered.length > 0 || showRegister) ? (
                                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 overflow-hidden">
                                                        {filtered.map((b) => (
                                                            <button key={b.buyer_id} type="button"
                                                                onClick={() => { setNamedBuyerId(b.buyer_id); setNamedBuyerSearch(b.name); setNamedBuyerDropdownOpen(false); }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50/80 transition">
                                                                <div className="w-6 h-6 rounded-full bg-gray-100/80 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                                    {b.name?.charAt(0)?.toUpperCase()}
                                                                </div>
                                                                <span className="font-medium text-gray-800 text-xs">{b.name}</span>
                                                            </button>
                                                        ))}
                                                        {showRegister && (
                                                            <button type="button"
                                                                onClick={async () => {
                                                                    const nb = await saveFeedNamedBuyer(namedBuyerSearch.trim());
                                                                    if (nb) { setNamedBuyerId(nb.buyer_id); setNamedBuyerSearch(nb.name); }
                                                                    setNamedBuyerDropdownOpen(false);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t border-gray-100 hover:bg-emerald-50 transition">
                                                                <Plus size={12} className="text-emerald-600" />
                                                                <span className="font-medium text-emerald-700 text-xs">
                                                                    {t('cattleFeedSales.form.registerBuyer', { name: namedBuyerSearch }) || `Register "${namedBuyerSearch}"`}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </Field>
                                </div>
                            )}

                            {form.buyer_mode === "anon" && (
                                <div className="flex items-start gap-3 flex-wrap pb-4 mb-4 border-b border-gray-200/60">
                                    <Field label={t('cattleFeedSales.form.buyer') || "Buyer"} icon={<UserCircle2 size={12} />}>
                                        <div className="h-[35px] px-3 flex items-center gap-1.5 rounded-xl bg-gray-100/80 border border-gray-200/60 text-gray-400 text-sm font-medium">
                                            <UserCircle2 size={14} /> {t('cattleFeedSales.form.anonymous') || "Anonymous"}
                                        </div>
                                    </Field>
                                </div>
                            )}

                            {/* Speed strip */}
                            <SpeedStripInForm onTap={(sp) => handleAddSpeedLines([{
                                feed_id: String(sp.feed_id),
                                quantity: "1",
                                rate: String(sp.mrp_rate || sp.rate || ""),
                                mrp_rate: String(sp.mrp_rate || ""),
                                _key: Date.now() + Math.random(),
                            }])} t={t} />

                            {/* Feed lines */}
                            <div className="flex flex-col gap-3 mb-4">
                                <div className="grid gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1"
                                    style={{ gridTemplateColumns: "minmax(0, 220px) 80px 80px 90px 28px" }}>
                                    <span>{productLabel || t('cattleFeedSales.form.feed')}</span>
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
                                                    <div className="absolute top-full left-0 mt-1 w-72 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-[9999] overflow-hidden max-h-52 overflow-y-auto">
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
                                                                    focusNextField(e.currentTarget);
                                                                }}
                                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 text-left transition">
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
                                                    <p className={`text-[10px] font-medium mt-0.5 ${parseFloat(lineFeed.current_stock) <= 0 ? "text-rose-500" : "text-emerald-600"}`}>
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
                                                    ? "bg-rose-50/80 border-rose-300 text-rose-700"
                                                    : "bg-blue-50/80 border-blue-200/60 text-blue-700"}`}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        focusNextField(e.target);
                                                    }
                                                }}
                                            />

                                            <TinyInput
                                                value={line.rate}
                                                onChange={(e) => setLine(line._key, "rate", e.target.value)}
                                                placeholder="₹0.00" type="number" step="0.01"
                                                className="w-full bg-amber-50/80 border-amber-200/60 text-amber-700"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        focusNextField(e.target);
                                                    }
                                                }}
                                            />

                                            <div className={`h-[35px] px-2 flex items-center rounded-xl border text-xs font-bold whitespace-nowrap shadow-sm
                        ${lt ? "bg-emerald-50/80 border-emerald-200/60 text-emerald-700" : "bg-gray-50/80 border-gray-200/60 text-gray-300"}`}>
                                                {lt ? `₹${lt}` : "—"}
                                            </div>

                                            <button type="button" onClick={() => removeLine(line._key)}
                                                disabled={lines.length === 1}
                                                className="w-7 h-[35px] flex items-center justify-center rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 disabled:opacity-20 transition shadow-sm">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-between mb-4">
                                <button type="button" onClick={addLine}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-dashed border-gray-300/60 hover:border-gray-500/60 px-3 py-1.5 rounded-xl transition">
                                    <span className="text-base leading-none">+</span> {t('cattleFeedSales.form.addFeed')}
                                </button>
                                {grandFormTotal > 0 && (
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                        <span className="text-xs text-gray-400 font-medium">
                                            {`${lines.filter(l => l.feed_id).length} feeds · `}
                                        </span>
                                        {t('cattleFeedSales.form.grandTotal')}
                                        <span className="text-emerald-700">₹{grandFormTotal.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-200/60">
                                <p className="text-xs text-gray-400">
                                    {`${sales.length} ${t('cattleFeedSales.table.entries', { count: sales.length })} on `}
                                    {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    {totalRevenue > 0 && (
                                        <span className="ml-2 text-emerald-600 font-semibold">
                                            {t('cattleFeedSales.table.totalRevenue', { amount: totalRevenue.toFixed(2) })}
                                        </span>
                                    )}
                                </p>
                                <button type="button" onClick={handleSave} disabled={saving}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all
                ${saving ? "bg-gray-300 cursor-not-allowed" : "bg-gradient-to-br from-gray-900 to-gray-800 hover:shadow-lg hover:shadow-gray-900/30 active:scale-95"}`}>
                                    <Save size={15} />
                                    {saving ? t('cattleFeedSales.form.saving') : t('cattleFeedSales.form.recordSale')}
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                )}

                {/* ── Sales Table ── */}
                <SectionCard
                    title={t('cattleFeedSales.table.salesList')}
                    icon={<ShoppingCart size={16} className="text-white" />}
                    data-tour="sales-table"
                >
                    <div className="grid border-b border-gray-200/60 bg-gray-50/80 rounded-t-xl" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
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
                                        className="grid border-b border-gray-200/60 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}>

                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {(() => {
                                                    const displayName = txn.buyer_type === 'seller' ? txn.seller_name
                                                        : txn.buyer_type === 'named' ? (txn.registered_buyer_name || txn.buyer_name)
                                                            : 'Anonymous';
                                                    return (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                                                                {(displayName || "?").charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={`font-medium text-xs truncate ${txn.buyer_type === 'anon' ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                                                                    {displayName}
                                                                </span>
                                                                {txn.buyer_type === 'seller' && txn.seller_code && (
                                                                    <span className="text-[10px] text-gray-400 font-mono">{txn.seller_code}</span>
                                                                )}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
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
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100/80 hover:bg-gray-900 hover:text-white text-gray-400 transition shadow-sm"
                                                    title={t('cattleFeedSales.table.printReceipt')}>
                                                    <FileDown size={11} />
                                                </button>
                                                {can('cattle_feed_sales', 'U') && (
                                                    <button
                                                        onClick={() => {
                                                            const mode = txn.buyer_type || 'seller';
                                                            setEditingSale({
                                                                transaction_id: txn.transaction_id,
                                                                buyer_mode: mode,
                                                                seller_id: mode === 'seller' ? String(txn.seller_id || '') : '',
                                                                buyer_id: mode === 'named' ? String(txn.buyer_id || '') : '',
                                                                sale_date: txn.sale_date,
                                                                items: txn.items.map(item => ({
                                                                    sale_id: item.sale_id,
                                                                    feed_id: String(item.feed_id),
                                                                    quantity: String(item.quantity),
                                                                    rate: String(item.rate),
                                                                    _key: `existing-${item.sale_id}`,
                                                                })),
                                                            });
                                                            setEditSellerSearch(mode === 'seller' ? (txn.seller_name || '') : '');
                                                            setEditBuyerSearch(mode === 'named' ? (txn.registered_buyer_name || txn.buyer_name || '') : '');
                                                            setEditSellerDrop(false);
                                                            setEditBuyerDrop(false);
                                                        }}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-50/80 hover:bg-blue-100/80 text-blue-500 transition shadow-sm"
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
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 transition shadow-sm"
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
                        <div className="grid border-t-2 border-gray-200/60 bg-gray-50/80 rounded-b-xl"
                            style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-200/60">
                                {t('cattleFeedSales.table.entries', { count: activeData.length })}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 text-xs font-bold text-blue-600 border-r border-gray-200/60 flex flex-col gap-0.5">
                                {qtyByUnitEntries.length === 0 ? "—"
                                    : qtyByUnitEntries.map(([u, q]) => (
                                        <span key={u}>{q.toFixed(2)} {u}</span>
                                    ))}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-200/60" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-200/60">
                                {t('cattleFeedSales.table.totalRevenue', { amount: totalRevenue.toFixed(2) })}
                            </div>
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </SectionCard>

                {/* ── Legend ── */}
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

            {/* ── Edit Sale Modal (fully editable) ── */}
            {editingSale && can('cattle_feed_sales', 'U') && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-[560px] max-h-[88vh] overflow-y-auto flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('cattleFeedSales.editModal.title')}</h2>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    {t('cattleFeedSales.editModal.subtitle', { id: editingSale.transaction_id })}
                                </p>
                            </div>
                            <button onClick={() => setEditingSale(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100/80 transition">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Date */}
                        <Field label={t('cattleFeedSales.editModal.saleDate') || "Sale Date"}>
                            <TinyInput
                                type="date"
                                value={editingSale.sale_date}
                                onChange={(e) => setEditingSale(prev => ({ ...prev, sale_date: e.target.value }))}
                                className="w-40"
                            />
                        </Field>

                        {/* Buyer mode selector */}
                        <div className="flex gap-2">
                            {["seller", "named", "anon"].map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => {
                                        setEditingSale(prev => ({ ...prev, buyer_mode: mode, seller_id: "", buyer_id: "" }));
                                        setEditSellerSearch("");
                                        setEditBuyerSearch("");
                                    }}
                                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition
                            ${editingSale.buyer_mode === mode
                                            ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-sm"
                                            : "bg-white/60 text-gray-500 border-gray-200/60 hover:border-gray-400"}`}
                                >
                                    {mode === "seller" ? t('cattleFeedSales.editModal.seller') || "Seller" : mode === "named" ? t('cattleFeedSales.editModal.named') || "Named" : t('cattleFeedSales.editModal.anon') || "Anonymous"}
                                </button>
                            ))}
                        </div>

                        {/* Seller picker */}
                        {editingSale.buyer_mode === "seller" && (
                            <Field label={t('cattleFeedSales.editModal.seller') || "Seller"}>
                                <div className="relative w-full">
                                    <TinyInput
                                        value={editSellerSearch}
                                        onFocus={() => setEditSellerDrop(true)}
                                        onBlur={() => setTimeout(() => setEditSellerDrop(false), 150)}
                                        onChange={(e) => {
                                            setEditSellerSearch(e.target.value);
                                            setEditSellerDrop(true);
                                            setEditingSale(prev => ({ ...prev, seller_id: "" }));
                                        }}
                                        placeholder={t('cattleFeedSales.editModal.sellerPlaceholder') || "Search seller..."}
                                        className="w-full"
                                    />
                                    {editSellerDrop && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                                            {sellers
                                                .filter(s => s.cattle_feed_sale_enabled == 1)
                                                .filter(s => !editSellerSearch.trim() ||
                                                    s.name.toLowerCase().includes(editSellerSearch.toLowerCase()) ||
                                                    (s.seller_code || "").toLowerCase().includes(editSellerSearch.toLowerCase()))
                                                .slice(0, 10)
                                                .map(s => (
                                                    <button key={s.seller_id} type="button"
                                                        onMouseDown={() => {
                                                            setEditingSale(prev => ({ ...prev, seller_id: String(s.seller_id) }));
                                                            setEditSellerSearch(s.name);
                                                            setEditSellerDrop(false);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50/80 transition">
                                                        <span className="font-medium text-gray-800 text-xs">{s.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono">{s.seller_code}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </Field>
                        )}

                        {/* Named buyer picker */}
                        {editingSale.buyer_mode === "named" && (
                            <Field label={t('cattleFeedSales.editModal.buyerName') || "Buyer Name"}>
                                <div className="relative w-full">
                                    <TinyInput
                                        value={editBuyerSearch}
                                        onFocus={() => setEditBuyerDrop(true)}
                                        onBlur={() => setTimeout(() => setEditBuyerDrop(false), 150)}
                                        onChange={(e) => {
                                            setEditBuyerSearch(e.target.value);
                                            setEditBuyerDrop(true);
                                            setEditingSale(prev => ({ ...prev, buyer_id: "" }));
                                        }}
                                        placeholder={t('cattleFeedSales.editModal.buyerPlaceholder') || "Search or add buyer..."}
                                        className="w-full"
                                    />
                                    {editBuyerDrop && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                                            {namedBuyers
                                                .filter(b => !editBuyerSearch.trim() || b.name.toLowerCase().includes(editBuyerSearch.toLowerCase()))
                                                .slice(0, 10)
                                                .map(b => (
                                                    <button key={b.buyer_id} type="button"
                                                        onMouseDown={() => {
                                                            setEditingSale(prev => ({ ...prev, buyer_id: String(b.buyer_id) }));
                                                            setEditBuyerSearch(b.name);
                                                            setEditBuyerDrop(false);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50/80 transition">
                                                        <span className="font-medium text-gray-800 text-xs">{b.name}</span>
                                                    </button>
                                                ))}
                                            {editBuyerSearch.trim() && !namedBuyers.find(b => b.name.toLowerCase() === editBuyerSearch.toLowerCase()) && (
                                                <div className="px-3 py-2 text-[11px] text-emerald-600 border-t border-gray-100">
                                                    {t('cattleFeedSales.editModal.registerBuyer', { name: editBuyerSearch }) || `Will register "${editBuyerSearch}" as a new buyer on save`}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Field>
                        )}

                        {editingSale.buyer_mode === "anon" && (
                            <div className="h-[35px] px-3 flex items-center rounded-xl bg-gray-100/80 border border-gray-200/60 text-gray-400 text-sm font-medium w-fit">
                                {t('cattleFeedSales.editModal.anonymous') || "Anonymous buyer"}
                            </div>
                        )}

                        {/* Line items — fully editable */}
                        <div className="flex flex-col gap-2">
                            <div className="grid gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1"
                                style={{ gridTemplateColumns: "1fr 90px 90px 28px" }}>
                                <span>{t('cattleFeedSales.editModal.feed') || "Feed"}</span>
                                <span>{t('cattleFeedSales.editModal.qty') || "Qty"}</span>
                                <span>{t('cattleFeedSales.editModal.rate') || "Rate"}</span>
                                <span />
                            </div>
                            {editingSale.items.map((item) => (
                                <div key={item._key} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 90px 90px 28px" }}>
                                    <select
                                        value={item.feed_id}
                                        onChange={(e) => setEditLine(item._key, "feed_id", e.target.value)}
                                        className="border border-gray-200/60 bg-white/50 rounded-xl px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                                    >
                                        <option value="">{t('cattleFeedSales.editModal.selectFeed') || "Select feed…"}</option>
                                        {feeds.map(f => (
                                            <option key={f.feed_id} value={f.feed_id}>
                                                {f.feed_name} (stock: {parseFloat(f.current_stock).toFixed(1)} {f.unit})
                                            </option>
                                        ))}
                                    </select>
                                    <TinyInput
                                        type="number" step="0.01" value={item.quantity}
                                        onChange={(e) => setEditLine(item._key, "quantity", e.target.value)}
                                        className="bg-blue-50/80 border-blue-200/60 text-blue-700"
                                    />
                                    <TinyInput
                                        type="number" step="0.01" value={item.rate}
                                        onChange={(e) => setEditLine(item._key, "rate", e.target.value)}
                                        className="bg-amber-50/80 border-amber-200/60 text-amber-700"
                                    />
                                    <button type="button" onClick={() => removeEditLine(item._key)}
                                        disabled={editingSale.items.length === 1}
                                        className="w-7 h-[35px] flex items-center justify-center rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 disabled:opacity-20 transition">
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={addEditLine}
                                className="self-start flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-dashed border-gray-300/60 hover:border-gray-500 px-3 py-1.5 rounded-xl transition">
                                <Plus size={12} /> {t('cattleFeedSales.editModal.addLine') || "Add Line"}
                            </button>
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/60">
                            <span className="text-xs text-emerald-600 font-medium">{t('cattleFeedSales.editModal.grandTotal')}</span>
                            <span className="text-sm font-bold text-emerald-700">
                                ₹{editingSale.items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)), 0).toFixed(2)}
                            </span>
                        </div>

                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setEditingSale(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                                {t('cattleFeedSales.editModal.cancel')}
                            </button>
                            <button onClick={handleEditSave} disabled={editSaving || !isEditFormReady()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-gray-900 to-gray-800 hover:shadow-lg hover:shadow-gray-900/30 disabled:opacity-50 transition shadow-sm">
                                {editSaving ? t('cattleFeedSales.editModal.saving') : t('cattleFeedSales.editModal.saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Delete Modal ── */}
            {confirmDelete && can('cattle_feed_sales', 'D') && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-full max-w-[340px] flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shrink-0">
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
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                                {t('cattleFeedSales.deleteModal.cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 hover:shadow-lg hover:shadow-rose-500/30 transition shadow-sm">
                                {t('cattleFeedSales.deleteModal.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}