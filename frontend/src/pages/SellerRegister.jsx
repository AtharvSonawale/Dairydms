import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    Users, Save, User, Phone, CreditCard, MapPin, Landmark,
    Calendar, AlertTriangle, ChevronDown, Settings, Pencil,
    Trash2, Hash, Building2, X, BadgeCheck, ExternalLink,
    Wallet, Banknote,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const fmt = (d, t) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const MILK_TYPES = ["cow", "buffalo", "mixed"];
const SELLER_TYPES = ["Utpadak", "Gavali"];

const EMPTY_FORM = {
    seller_code: "",
    name: "",
    mobile: "",
    aadhaar: "",
    seller_type: "Utpadak",
    milk_type: "mixed",
    jamin: "",
    bank_account: "",
    bank_name: "",
    ifsc_code: "",
    address: "",
    advance_enabled: 1,
    advance_deduction: "",
    deposit_enabled: 0,
    deposit_per_litre: "",
    bank_account_confirm: "",
    product_sale_enabled: 0,
    is_active: 1,
};

const milkBadge = (t, translate) =>
    t === "cow" ? "bg-amber-50 text-amber-700 border border-amber-100"
        : t === "buffalo" ? "bg-blue-50 text-blue-700 border border-blue-100"
            : "bg-violet-50 text-violet-700 border border-violet-100";

const sellerTypeBadge = (t) =>
    t === "Utpadak"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
        : "bg-orange-50 text-orange-700 border border-orange-100";

// ── Field ─────────────────────────────────────────────────────
const Field = ({ label, name, type = "text", value, onChange, placeholder, required, children, t }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        {children ?? (
            <input name={name} type={type} value={value} onChange={onChange}
                placeholder={placeholder} required={required}
                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                    placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition" />
        )}
    </div>
);

// ── TableCell ─────────────────────────────────────────────────
function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-3 flex items-center text-slate-600 border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function SellerRegister() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();

    const [form, setForm] = useState(EMPTY_FORM);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [flash, setFlash] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState("all");
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 3500); };
    const handleFilterChange = (f) => { setFilter(f); setCurrentPage(1); };
    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const fetchSellers = async () => {
        setLoading(true);
        try { const { data } = await api.get("/sellers"); setSellers(data); }
        catch { showFlash("error", t('sellerRegister.loadError')); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchSellers(); }, [t]);

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );
    if (!can('seller_register', 'R')) return <AccessDenied />;

    const openAdd = () => {
        const codes = sellers.map(s => s.seller_code).filter(c => /^S\d+$/.test(c)).map(c => parseInt(c.slice(1)));
        const next = codes.length > 0 ? Math.max(...codes) + 1 : 1;
        setForm({ ...EMPTY_FORM, seller_code: "S" + String(next).padStart(3, "0") });
        setEditingId(null);
        setShowForm(true);
    };
    const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };

    const openEdit = (s) => {
        setForm({
            seller_code: s.seller_code || "",
            name: s.name || "",
            mobile: s.mobile || "",
            aadhaar: s.aadhaar || "",
            seller_type: s.seller_type || "Utpadak",
            milk_type: s.milk_type || "mixed",
            jamin: s.jamin || "",
            bank_account: s.bank_account || "",
            bank_account_confirm: s.bank_account || "",
            bank_name: s.bank_name || "",
            ifsc_code: s.ifsc_code || "",
            address: s.address || "",
            advance_enabled: s.advance_enabled ?? 1,
            advance_deduction: s.advance_deduction || "",
            deposit_enabled: s.deposit_enabled ?? 0,
            deposit_per_litre: s.deposit_per_litre || "",
            product_sale_enabled: s.product_sale_enabled ?? 0,
            is_active: s.is_active ?? 1,
        });
        setEditingId(s.seller_id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const nameParts = form.name.trim().split(/\s+/);
        if (!form.name || nameParts.length < 2) { showFlash("error", t('sellerRegister.nameFullNameError')); return; }
        if (/\d/.test(form.name)) { showFlash("error", t('sellerRegister.nameNoNumbersError')); return; }
        const mobileClean = form.mobile.replace(/^\+/, "");
        if (!/^\d{10,12}$/.test(mobileClean)) { showFlash("error", t('sellerRegister.mobileInvalidError')); return; }
        if (form.bank_account && form.bank_account.length < 10) { showFlash("error", t('sellerRegister.bankAccountMinError')); return; }
        if (form.bank_account && form.bank_account !== form.bank_account_confirm) { showFlash("error", t('sellerRegister.bankAccountMismatchError')); return; }
        if (form.address && form.address.length < 10) { showFlash("error", t('sellerRegister.addressMinError')); return; }
        if (form.address && form.address.length > 200) { showFlash("error", t('sellerRegister.addressMaxError')); return; }
        setSaving(true);
        try {
            if (editingId) { await api.put(`/sellers/${editingId}`, form); showFlash("success", t('sellerRegister.updateSuccess')); }
            else { await api.post("/sellers", form); showFlash("success", t('sellerRegister.createSuccess')); }
            await fetchSellers();
            closeForm();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('sellerRegister.saveError'));
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        try { await api.delete(`/sellers/${deleteId}`); await fetchSellers(); showFlash("success", t('sellerRegister.deleteSuccess')); }
        catch (err) { showFlash("error", err.response?.data?.error || t('sellerRegister.deleteError')); }
        finally { setDeleteId(null); }
    };

    const filtered = filter === "all" ? sellers : sellers.filter((s) => s.milk_type === filter);
    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const TABLE_COLS = [
        { label: t('sellerRegister.seller'), icon: <User size={11} /> },
        { label: t('sellerRegister.code'), icon: <Hash size={11} /> },
        { label: t('sellerRegister.mobile'), icon: <Phone size={11} /> },
        { label: t('sellerRegister.aadhaar'), icon: <CreditCard size={11} /> },
        { label: t('sellerRegister.type'), icon: <ChevronDown size={11} /> },
        { label: t('sellerRegister.milk'), icon: <ChevronDown size={11} /> },
        { label: t('sellerRegister.jamin'), icon: <User size={11} /> },
        { label: t('sellerRegister.bankAccount'), icon: <Landmark size={11} /> },
        { label: t('sellerRegister.bankIfsc'), icon: <Building2 size={11} /> },
        { label: t('sellerRegister.address'), icon: <MapPin size={11} /> },
        { label: t('sellerRegister.advance'), icon: <Wallet size={11} /> },
        { label: t('sellerRegister.advRecovery'), icon: <Banknote size={11} /> },
        { label: t('sellerRegister.depPerL'), icon: <Banknote size={11} /> },
        { label: t('sellerRegister.status'), icon: <Settings size={11} /> },
        { label: t('sellerRegister.registered'), icon: <Calendar size={11} /> },
        { label: t('sellerRegister.actions'), icon: <Settings size={11} /> },
    ];

    const GRID = "180px 60px 100px 120px 85px 85px 90px 120px 120px 115px 65px 95px 75px 72px 85px 100px";

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Users size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('sellerRegister.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('sellerRegister.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>
                    <button onClick={openAdd}
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition bg-black text-white hover:bg-gray-800">
                        <span className="text-base leading-none">+</span> {t('sellerRegister.addSeller')}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                        { label: t('sellerRegister.totalSellers'), value: sellers.length, icon: <Users size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('sellerRegister.cowSellers'), value: sellers.filter((s) => s.milk_type === "cow").length, icon: <span className="text-sm"></span>, color: "text-amber-600 bg-amber-50 border-amber-100" },
                        { label: t('sellerRegister.buffaloSellers'), value: sellers.filter((s) => s.milk_type === "buffalo").length, icon: <span className="text-sm"></span>, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                        { label: t('sellerRegister.mixedSellers'), value: sellers.filter((s) => s.milk_type === "mixed").length, icon: <span className="text-sm"></span>, color: "text-violet-600 bg-violet-50 border-violet-100" },
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
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium mb-4
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="font-semibold text-gray-800">{editingId ? t('sellerRegister.editSeller') : t('sellerRegister.registerNewSeller')}</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{editingId ? t('sellerRegister.editDesc') : t('sellerRegister.registerDesc')}</p>
                            </div>
                            <button onClick={closeForm} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {/* Row 1 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label={t('sellerRegister.fullName')} name="name" value={form.name} onChange={handleChange} placeholder={t('sellerRegister.namePlaceholder')} required t={t}>
                                    <input name="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))} placeholder={t('sellerRegister.namePlaceholder')} required maxLength={60}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerRegister.sellerCode')} name="seller_code" value={form.seller_code} onChange={handleChange} placeholder={t('sellerRegister.codeAutoGenerated')} required t={t}>
                                    <input value={form.seller_code} readOnly
                                        className="border border-gray-200 bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-500 font-mono cursor-not-allowed w-full" />
                                </Field>
                                <Field label={t('sellerRegister.mobile')} name="mobile" value={form.mobile} onChange={handleChange} placeholder="+91XXXXXXXXXX" type="tel" required t={t}>
                                    <input name="mobile" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/(?!^\+)[^\d]/g, "").slice(0, 13) }))} placeholder="+91XXXXXXXXXX" type="tel" required maxLength={13}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                            </div>

                            {/* Row 2 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label={t('sellerRegister.aadhaar')} name="aadhaar" value={form.aadhaar} onChange={handleChange} placeholder="XXXX XXXX XXXX" t={t}>
                                    <input name="aadhaar" value={form.aadhaar}
                                        onChange={e => setForm(p => ({ ...p, aadhaar: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                                        placeholder="XXXX XXXX XXXX" maxLength={12}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>

                                {/* Seller Type */}
                                <Field label={t('sellerRegister.sellerType')} required t={t}>
                                    <div className="flex gap-2">
                                        {SELLER_TYPES.map((type) => (
                                            <label key={type} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${form.seller_type === type
                                                    ? type === "Utpadak" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-orange-50 border-orange-300 text-orange-800"
                                                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                                                <input type="radio" name="seller_type" value={type} checked={form.seller_type === type} onChange={handleChange} className="hidden" />
                                                {type === "Utpadak" ? t('sellerRegister.utpadak') : t('sellerRegister.gavali')}
                                            </label>
                                        ))}
                                    </div>
                                </Field>

                                {/* Milk Type */}
                                <Field label={t('sellerRegister.milkType')} required t={t}>
                                    <div className="flex gap-2">
                                        {MILK_TYPES.map((type) => (
                                            <label key={type} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${form.milk_type === type
                                                    ? type === "cow" ? "bg-amber-50 border-amber-300 text-amber-800"
                                                        : type === "buffalo" ? "bg-blue-50 border-blue-300 text-blue-800"
                                                            : "bg-violet-50 border-violet-300 text-violet-800"
                                                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                                                <input type="radio" name="milk_type" value={type} checked={form.milk_type === type} onChange={handleChange} className="hidden" />
                                                {type === "cow" ? t('sellerRegister.cow') : type === "buffalo" ? t('sellerRegister.buffalo') : t('sellerRegister.mixed')}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>

                            {/* Row 3 */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <Field label={t('sellerRegister.jamin')} name="jamin" value={form.jamin} onChange={handleChange} placeholder={t('sellerRegister.jaminPlaceholder')} t={t}>
                                    <input name="jamin" value={form.jamin}
                                        onChange={e => setForm(p => ({ ...p, jamin: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                        placeholder={t('sellerRegister.jaminPlaceholder')} maxLength={60}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerRegister.bankAccountNo')} name="bank_account" value={form.bank_account} onChange={handleChange} placeholder={t('sellerRegister.bankAccountPlaceholder')} t={t}>
                                    <input name="bank_account" value={form.bank_account} onChange={e => setForm(p => ({ ...p, bank_account: e.target.value.replace(/\D/g, "") }))}
                                        placeholder={t('sellerRegister.bankAccountPlaceholder')} maxLength={20}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerRegister.confirmAccountNo')} name="bank_account_confirm" value={form.bank_account_confirm} onChange={handleChange} placeholder={t('sellerRegister.confirmAccountPlaceholder')} t={t}>
                                    <input name="bank_account_confirm" value={form.bank_account_confirm}
                                        onChange={e => setForm(p => ({ ...p, bank_account_confirm: e.target.value.replace(/\D/g, "") }))}
                                        placeholder={t('sellerRegister.confirmAccountPlaceholder')} maxLength={20}
                                        className={`border rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black transition w-full
                                        ${form.bank_account_confirm && form.bank_account !== form.bank_account_confirm ? "border-red-300 bg-red-50 focus:ring-red-400" : "border-gray-200 bg-gray-50 focus:bg-white"}`} />
                                    {form.bank_account_confirm && form.bank_account !== form.bank_account_confirm &&
                                        <p className="text-xs text-red-500 mt-1">{t('sellerRegister.accountMismatch')}</p>}
                                </Field>
                                <Field label={t('sellerRegister.bankName')} name="bank_name" value={form.bank_name} onChange={handleChange} placeholder="e.g. SBI, HDFC" t={t}>
                                    <input name="bank_name" value={form.bank_name}
                                        onChange={e => setForm(p => ({ ...p, bank_name: e.target.value.replace(/[^a-zA-Z\s.]/g, "") }))}
                                        placeholder="e.g. SBI, HDFC" maxLength={50}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerRegister.ifscCode')} name="ifsc_code" value={form.ifsc_code} onChange={handleChange} placeholder="e.g. SBIN0001234" t={t}>
                                    <input name="ifsc_code" value={form.ifsc_code}
                                        onChange={e => setForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. SBIN0001234" maxLength={11}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                            </div>

                            {/* Row 4 */}
                            <Field label={t('sellerRegister.address')} name="address" value={form.address} onChange={handleChange} placeholder={t('sellerRegister.addressPlaceholder')} t={t}>
                                <input name="address" value={form.address} onChange={handleChange}
                                    placeholder={t('sellerRegister.addressPlaceholder')} minLength={10} maxLength={200}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{form.address.length}/200</p>
                            </Field>

                            {/* Row 5 - Cash Advance */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerRegister.cashAdvance')} t={t}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerRegister.enabled'), val: 1 }, { label: t('sellerRegister.disabled'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition ${form.advance_enabled === val
                                                ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"
                                                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                                                <input type="radio" name="advance_enabled" value={val}
                                                    checked={form.advance_enabled === val}
                                                    onChange={() => setForm((p) => ({ ...p, advance_enabled: val, advance_deduction: val === 0 ? "" : p.advance_deduction }))}
                                                    className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                                {form.advance_enabled === 1 && (
                                    <Field label={t('sellerRegister.advanceRecovery')} name="advance_deduction" value={form.advance_deduction} onChange={handleChange} placeholder={t('sellerRegister.advanceRecoveryPlaceholder')} t={t}>
                                        <input name="advance_deduction" value={form.advance_deduction}
                                            onChange={e => setForm(p => ({ ...p, advance_deduction: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") }))}
                                            placeholder={t('sellerRegister.advanceRecoveryPlaceholder')} inputMode="decimal" maxLength={10}
                                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                    </Field>
                                )}
                            </div>

                            {/* Deposit per Litre */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerRegister.depositPerLitre')} t={t}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerRegister.enabled'), val: 1 }, { label: t('sellerRegister.disabled'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                            ${form.deposit_enabled === val
                                                    ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"
                                                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                                                <input type="radio" name="deposit_enabled" value={val}
                                                    checked={form.deposit_enabled === val}
                                                    onChange={() => setForm(p => ({ ...p, deposit_enabled: val, deposit_per_litre: val === 0 ? "" : p.deposit_per_litre }))}
                                                    className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                                {form.deposit_enabled === 1 && (
                                    <Field label={t('sellerRegister.depositRate')} t={t}>
                                        <input
                                            name="deposit_per_litre"
                                            value={form.deposit_per_litre}
                                            onChange={e => setForm(p => ({ ...p, deposit_per_litre: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") }))}
                                            placeholder={t('sellerRegister.depositRatePlaceholder')}
                                            inputMode="decimal"
                                            maxLength={6}
                                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full"
                                        />
                                        {form.deposit_per_litre && (
                                            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                                                {t('sellerRegister.depositPreview')} ₹{parseFloat(form.deposit_per_litre || 0).toFixed(2)} {t('sellerRegister.depositPerLitreCollected')}
                                            </p>
                                        )}
                                        {!form.deposit_per_litre && (
                                            <p className="text-[10px] text-gray-400 mt-1">{t('sellerRegister.depositHint')}</p>
                                        )}
                                    </Field>
                                )}
                            </div>

                            {/* Product Sale Toggle */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerRegister.productSale')} t={t}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerRegister.enabled'), val: 1 }, { label: t('sellerRegister.disabled'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                    ${form.product_sale_enabled === val
                                                    ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"
                                                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                                                <input
                                                    type="radio"
                                                    name="product_sale_enabled"
                                                    value={val}
                                                    checked={form.product_sale_enabled === val}
                                                    onChange={() => setForm(p => ({
                                                        ...p,
                                                        product_sale_enabled: val,
                                                    }))}
                                                    className="hidden"
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>

                            {/* Active Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerRegister.sellerStatus')} t={t}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerRegister.active'), val: 1 }, { label: t('sellerRegister.inactive'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${(form.is_active ?? 1) === val
                                                    ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"
                                                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                                                <input type="radio" name="is_active" value={val}
                                                    checked={(form.is_active ?? 1) === val}
                                                    onChange={() => setForm(p => ({ ...p, is_active: val }))}
                                                    className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={closeForm} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition">{t('sellerRegister.cancel')}</button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl text-white bg-black hover:bg-gray-800 transition disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    <Save size={13} />
                                    {saving ? t('sellerRegister.saving') : editingId ? t('sellerRegister.updateSeller') : t('sellerRegister.registerSeller')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 mb-4">
                    {["all", "cow", "buffalo", "mixed"].map((f) => (
                        <button key={f} onClick={() => handleFilterChange(f)}
                            className={`text-xs font-semibold px-4 py-1.5 rounded-full transition border
                                ${filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                            {f === "all" ? t('sellerRegister.all') : f === "cow" ? t('sellerRegister.cow') : f === "buffalo" ? t('sellerRegister.buffalo') : t('sellerRegister.mixed')}
                            {f !== "all" && <span className="ml-1.5 opacity-60">{sellers.filter((s) => s.milk_type === f).length}</span>}
                        </button>
                    ))}
                    <span className="ml-auto text-xs text-gray-400">{filtered.length} {t('sellerRegister.sellers')}</span>
                </div>

                {/* Table */}
                <div className="w-full overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                    <div className="min-w-[1600px] bg-white">
                        <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                            {TABLE_COLS.map(({ label, icon }) => (
                                <div key={label} className="px-3 py-3 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                    {icon}{label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-3xl mb-3">🧑‍🌾</p>
                            <p className="text-gray-500 text-sm font-medium">{t('sellerRegister.noSellersFound')}</p>
                            <p className="text-gray-400 text-xs mt-1">{t('sellerRegister.addFirstSeller')}</p>
                        </div>
                    ) : (
                        <>
                            {[...paginated].reverse().map((s) => (
                                <div key={s.seller_id}
                                    className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors group"
                                    style={{ gridTemplateColumns: GRID }}>

                                    {/* Name — link to profile */}
                                    <TableCell>
                                        <Link to={`/seller/${s.seller_id}`} className="flex items-center gap-2 group/link">
                                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs shrink-0 group-hover/link:bg-black group-hover/link:text-white transition">
                                                {s.name?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <span className="text-gray-800 font-medium truncate group-hover/link:text-black group-hover/link:underline underline-offset-2 transition">
                                                {s.name}
                                            </span>
                                            <ExternalLink size={10} className="text-gray-300 group-hover/link:text-gray-500 shrink-0 transition" />
                                        </Link>
                                    </TableCell>

                                    <TableCell>
                                        <span className="font-mono text-xs text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">
                                            {s.seller_code || "—"}
                                        </span>
                                    </TableCell>

                                    <TableCell className="text-blue-600 font-mono text-xs font-medium">{s.mobile || "—"}</TableCell>
                                    <TableCell className="text-violet-600 font-mono text-xs">{s.aadhaar || "—"}</TableCell>

                                    <TableCell>
                                        {s.seller_type
                                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sellerTypeBadge(s.seller_type)}`}>
                                                {s.seller_type === "Utpadak" ? t('sellerRegister.utpadak') : t('sellerRegister.gavali')}
                                            </span>
                                            : "—"}
                                    </TableCell>

                                    <TableCell>
                                        {s.milk_type
                                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${milkBadge(s.milk_type, t)}`}>
                                                {s.milk_type === "cow" ? t('sellerRegister.cow') : s.milk_type === "buffalo" ? t('sellerRegister.buffalo') : t('sellerRegister.mixed')}
                                            </span>
                                            : "—"}
                                    </TableCell>

                                    <TableCell className="text-gray-500 text-xs">
                                        <span className="truncate block max-w-[80px]" title={s.jamin || ""}>{s.jamin || "—"}</span>
                                    </TableCell>

                                    <TableCell className="text-amber-700 font-mono text-xs">
                                        <span className="truncate block max-w-[110px]" title={s.bank_account || ""}>{s.bank_account || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-gray-700">{s.bank_name || "—"}</span>
                                            {s.ifsc_code && <span className="font-mono text-[10px] text-gray-400">{s.ifsc_code}</span>}
                                        </div>
                                    </TableCell>

                                    <TableCell className="text-gray-500 text-xs">
                                        <span className="truncate block max-w-[100px]" title={s.address || ""}>{s.address || "—"}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border
                                            ${s.advance_enabled === 0 || s.advance_enabled === false
                                                ? "bg-red-50 text-red-600 border-red-100"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                                            {s.advance_enabled === 0 || s.advance_enabled === false ? t('sellerRegister.off') : t('sellerRegister.on')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-amber-700 font-mono text-xs">
                                        {s.advance_deduction ? "₹" + parseFloat(s.advance_deduction).toLocaleString("en-IN") : "—"}
                                    </TableCell>
                                    <TableCell className="text-blue-600 font-mono text-xs">
                                        {s.deposit_enabled && s.deposit_per_litre
                                            ? `₹${parseFloat(s.deposit_per_litre).toFixed(2)}/L`
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border
                                            ${s.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-50 text-gray-400 border-gray-100"}`}>
                                            {s.is_active ? t('sellerRegister.active') : t('sellerRegister.inactive')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-gray-400 font-mono text-xs">{fmt(s.created_at, t)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => openEdit(s)}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium transition border border-blue-100">
                                                <Pencil size={11} /> {t('sellerRegister.edit')}
                                            </button>
                                            <button onClick={() => setDeleteId(s.seller_id)}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium transition border border-red-100">
                                                <Trash2 size={11} /> {t('sellerRegister.del')}
                                            </button>
                                        </div>
                                    </TableCell>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Pagination controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                            {t('sellerRegister.prev')}
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
                                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition border
                                ${currentPage === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                                            {p}
                                        </button>
                                )}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                            {t('sellerRegister.next')}
                        </button>
                        <span className="text-xs text-gray-400 ml-1">
                            {filtered.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)}`} {t('sellerRegister.of')} {filtered.length}
                        </span>
                    </div>

                    {/* Page size + legend */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('sellerRegister.rowsPerPage')}</span>
                            <input
                                type="number" min={1} max={filtered.length || 1}
                                value={pageSize}
                                onChange={e => {
                                    const v = Math.max(1, parseInt(e.target.value) || 1);
                                    setPageSize(v);
                                    setCurrentPage(1);
                                }}
                                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            <span>• <strong className="text-gray-600">{sellers.length}</strong> {sellers.length === 1 ? t('sellerRegister.seller') : t('sellerRegister.sellers')}</span>
                            <span>• {t('sellerRegister.clickNameTip')}</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Delete Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                                <Trash2 size={22} className="text-red-500" />
                            </div>
                            <h2 className="text-gray-800 font-semibold text-base">{t('sellerRegister.deleteModalTitle')}</h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                {t('sellerRegister.deleteModalWarning')}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setDeleteId(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">{t('sellerRegister.cancel')}</button>
                            <button onClick={handleDelete}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-100 transition active:scale-95">{t('sellerRegister.yesDelete')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}