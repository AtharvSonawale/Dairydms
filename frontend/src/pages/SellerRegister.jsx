import * as XLSX from 'xlsx';
import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    Users, Save, User, Phone, CreditCard, MapPin, Landmark,
    Calendar, AlertTriangle, ChevronDown, Settings, Pencil,
    Trash2, Hash, Building2, X, BadgeCheck, ExternalLink,
    Wallet, Banknote, Milk, Sprout, MapPinned, Lock,
    UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Download, RotateCcw, Import,
    Home, Search, ArrowUp, ArrowDown, ArrowUpDown, Image as ImageIcon
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const fmt = (d, t) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const MILK_TYPES = ["cow", "buffalo", "both"];
const SELLER_TYPES = ["Utpadak", "Gavali"];

const columnMap = {
    'seller code': 'seller_code',
    'seller_code': 'seller_code',
    'code': 'seller_code',
    'name': 'name',
    'seller name': 'name',
    'full name': 'name',
    'mobile': 'mobile',
    'phone': 'mobile',
    'aadhaar': 'aadhaar',
    'pan': 'pan_number',
    'pan number': 'pan_number',
    'seller id code': 'seller_id_code',
    'seller_id_code': 'seller_id_code',
    'id code': 'seller_id_code',
    'seller type': 'seller_type',
    'seller_type': 'seller_type',
    'type': 'seller_type',
    'milk type': 'milk_type',
    'milk_type': 'milk_type',
    'jamin': 'jamin',
    'bank account': 'bank_account',
    'bank_account': 'bank_account',
    'account no': 'bank_account',
    'bank name': 'bank_name',
    'bank_name': 'bank_name',
    'account holder': 'account_holder_name',
    'account_holder_name': 'account_holder_name',
    'branch': 'branch_name',
    'branch_name': 'branch_name',
    'ifsc': 'ifsc_code',
    'ifsc_code': 'ifsc_code',
    'address': 'address',
    'pincode': 'pincode',
    'advance enabled': 'advance_enabled',
    'advance_enabled': 'advance_enabled',
    'advance deduction': 'advance_deduction',
    'advance_deduction': 'advance_deduction',
    'product sale enabled': 'product_sale_enabled',
    'product_sale_enabled': 'product_sale_enabled',
    'deposit enabled': 'deposit_enabled',
    'deposit_enabled': 'deposit_enabled',
    'deposit per litre': 'deposit_per_litre',
    'deposit_per_litre': 'deposit_per_litre',
    'cattle feed enabled': 'cattle_feed_sale_enabled',
    'cattle_feed_sale_enabled': 'cattle_feed_sale_enabled',
    'password': 'password',
    'cheque': 'cheque',
    'cheque image': 'cheque',
    'cheque_image': 'cheque',
};

// ── Sample farmers used to populate the downloadable import template ──────
const SAMPLE_FARMER_ROWS = [
    ["1", "Ramesh Kumar Patil", "9876543210", "123456789012", "ABCDE1234F", "100234567890",
        "Utpadak", "cow", "Patil Wadi, Gat No. 45", "12345678901", "State Bank of India",
        "Ramesh Kumar Patil", "Pune Main Branch", "SBIN0001234",
        "At Post Wadgaon, Tal. Haveli, Dist. Pune", "411041",
        1, 500, 1, 1, 2.5, 0, "farmer@123"],
    ["2", "Sunita Vitthal Jadhav", "9822345671", "234567890123", "BCDEF2345G", "100234567891",
        "Gavali", "buffalo", "Jadhav Mala, Gat No. 12", "23456789012", "Bank of Maharashtra",
        "Sunita Vitthal Jadhav", "Haveli Branch", "MAHB0001122",
        "At Post Manjari, Tal. Haveli, Dist. Pune", "412307",
        1, 300, 0, 1, 2, 0, "farmer@456"],
    ["3", "Ganesh Baburao Shinde", "9765432109", "345678901234", "CDEFG3456H", "100234567892",
        "Utpadak", "both", "Shinde Vasti, Gat No. 78", "34567890123", "Punjab National Bank",
        "Ganesh Baburao Shinde", "Shivajinagar Branch", "PUNB0123400",
        "At Post Wagholi, Tal. Haveli, Dist. Pune", "412207",
        0, "", 1, 0, "", 1, "farmer@789"],
    ["4", "Anita Sanjay More", "9988776655", "456789012345", "DEFGH4567I", "100234567893",
        "Gavali", "cow", "More Wadi, Gat No. 33", "45678901234", "HDFC Bank",
        "Anita Sanjay More", "Kharadi Branch", "HDFC0001357",
        "At Post Kharadi, Tal. Haveli, Dist. Pune", "411014",
        1, 250, 1, 1, 3, 1, "farmer@321"],
    ["5", "Prakash Dattatray Kale", "9112233445", "567890123456", "EFGHI5678J", "100234567894",
        "Utpadak", "buffalo", "Kale Nagar, Gat No. 9", "56789012345", "ICICI Bank",
        "Prakash Dattatray Kale", "Viman Nagar Branch", "ICIC0002468",
        "At Post Viman Nagar, Tal. Haveli, Dist. Pune", "411014",
        1, 400, 0, 0, "", 0, "farmer@654"],
];

// ── Import parsing helpers ────────────────────────────────────
const parseBoolField = (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const s = String(val).trim().toLowerCase();
    if (['1', 'yes', 'y', 'true', 'enabled', 'on'].includes(s)) return 1;
    if (['0', 'no', 'n', 'false', 'disabled', 'off'].includes(s)) return 0;
    const n = Number(s);
    return Number.isNaN(n) ? undefined : (n ? 1 : 0);
};

const parseDecimalField = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const cleaned = String(val).replace(/[^\d.]/g, '');
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
};

const normalizeSellerType = (val) => {
    const s = String(val || '').trim().toLowerCase();
    if (s === 'gavali') return 'Gavali';
    if (s === 'utpadak') return 'Utpadak';
    return val ? String(val).trim() : 'Utpadak';
};

const normalizeMilkType = (val) => {
    const s = String(val || '').trim().toLowerCase();
    if (['cow', 'buffalo'].includes(s)) return s;
    return 'both';
};

const EMPTY_FORM = {
    seller_code: "",
    name: "",
    mobile: "",
    aadhaar: "",
    pan_number: "",
    seller_id_code: "",
    seller_type: "Utpadak",
    milk_type: "both",
    jamin: "",
    bank_account: "",
    bank_name: "",
    account_holder_name: "",
    branch_name: "",
    ifsc_code: "",
    address: "",
    pincode: "",
    password: "",
    advance_enabled: 1,
    advance_deduction: "",
    deposit_enabled: 0,
    deposit_per_litre: "",
    bank_account_confirm: "",
    product_sale_enabled: 0,
    cattle_feed_sale_enabled: 0,
    is_active: 1,
    cheque: "",
};

const milkBadge = (t, translate) =>
    t === "cow" ? "bg-amber-50/80 text-amber-700 border border-amber-200/60 backdrop-blur-sm"
        : t === "buffalo" ? "bg-blue-50/80 text-blue-700 border border-blue-200/60 backdrop-blur-sm"
            : "bg-violet-50/80 text-violet-700 border border-violet-200/60 backdrop-blur-sm";

const sellerTypeBadge = (t) =>
    t === "Utpadak"
        ? "bg-emerald-50/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm"
        : "bg-orange-50/80 text-orange-700 border border-orange-200/60 backdrop-blur-sm";

// ── Field ─────────────────────────────────────────────────────
const Field = ({ label, name, type = "text", value, onChange, placeholder, required, children, t, ...rest }) => (
    <div className="flex flex-col gap-1" {...rest}>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        {children ?? (
            <input name={name} type={type} value={value} onChange={onChange}
                placeholder={placeholder} required={required}
                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                    placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition" />
        )}
    </div>
);

// ── TableCell ─────────────────────────────────────────────────
function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-3 flex items-center min-w-0 overflow-hidden text-slate-600 border-r border-gray-100/60 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── flash / toast timing ────────────────────────────────────────
const FLASH_DURATION = 3500;
const FLASH_ANIM_MS = 420;

// ── Sliding toast alert ──────────────────────────────────────
function FlashToast({ flash, phase, onClose }) {
    if (!flash) return null;
    const isVisible = phase === "visible";
    return (
        <div
            className="fixed top-4 right-4 z-[9999] pointer-events-none"
            style={{ maxWidth: "min(92vw, 420px)" }}
        >
            <div
                className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl text-base font-semibold shadow-2xl backdrop-blur-sm border
                    ${flash.type === "success" ? "bg-emerald-50/95 border-emerald-200/70 text-emerald-700" : "bg-rose-50/95 border-rose-200/70 text-rose-600"}`}
                style={{
                    transform: isVisible ? "translateX(0)" : "translateX(150%)",
                    opacity: isVisible ? 1 : 0,
                    transition: `transform ${FLASH_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FLASH_ANIM_MS}ms ease`,
                }}
            >
                {flash.type === "error" && <AlertTriangle size={18} className="shrink-0" />}
                {flash.type === "success" && <BadgeCheck size={18} className="shrink-0" />}
                <span className="flex-1">{flash.msg}</span>
                <button onClick={onClose} className="opacity-50 hover:opacity-100 transition shrink-0">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

// ── Cheque Upload Component ──────────────────────────────────
function ChequeUpload({ value, onChange, label = "Cheque Image" }) {
    const [preview, setPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Initialize preview from value prop
    useEffect(() => {
        if (value && typeof value === 'string' && value.length > 0) {
            setPreview(value);
        } else {
            setPreview(null);
        }
    }, [value]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (JPEG, PNG, etc.)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                setPreview(base64);
                onChange(base64);
                setIsUploading(false);
            };
            reader.onerror = () => {
                alert('Failed to read file');
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            alert('Error uploading file');
            setIsUploading(false);
        }
    };

    const handleRemove = () => {
        setPreview(null);
        onChange('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {label}
            </label>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                >
                    <ImageIcon size={16} />
                    {preview ? 'Change Image' : 'Upload Cheque'}
                </button>
                {preview && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="text-rose-500 hover:text-rose-700 text-sm font-medium transition"
                    >
                        Remove
                    </button>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />
                {isUploading && (
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                )}
            </div>
            {preview && (
                <div className="relative mt-2 w-32 h-32 rounded-xl overflow-hidden border border-gray-200/60 shadow-sm">
                    <img
                        src={preview}
                        alt="Cheque"
                        className="w-full h-full object-cover"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Seller Form Modal ───────────────────────────────────────
function SellerFormModal({ isOpen, onClose, form, setForm, editingId, saving, onSave, onCancel, t, hasPassword }) {
    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (e.target.tagName !== "INPUT") return;
        e.preventDefault();

        const formEl = e.currentTarget;
        const focusable = Array.from(
            formEl.querySelectorAll('input:not([type="hidden"]):not(:disabled)')
        ).filter(el => el.offsetParent !== null);

        const idx = focusable.indexOf(e.target);
        if (idx > -1 && idx < focusable.length - 1) {
            focusable[idx + 1].focus();
        } else if (typeof formEl.requestSubmit === "function") {
            formEl.requestSubmit();
        } else {
            onSave(e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-gray-50/50 to-white/50">
                    <div>
                        <h2 className="text-sm font-bold text-gray-800">
                            {editingId ? 'Edit Seller' : 'Register New Seller'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {editingId ? 'Update seller details' : 'Fill in the details to register a new seller'}
                        </p>
                    </div>
                    <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form onSubmit={onSave} onKeyDown={handleFormKeyDown} className="space-y-5">
                        {/* Row 1 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Full Name" name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" required t={t}>
                                <input name="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))} placeholder="Enter full name" required maxLength={60}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Seller Code" name="seller_code" value={form.seller_code} onChange={handleChange} placeholder="Auto-generated" required t={t}>
                                <input name="seller_code" value={form.seller_code}
                                    onChange={e => setForm(p => ({ ...p, seller_code: e.target.value.replace(/\s/g, "").toUpperCase() }))}
                                    placeholder="Auto-generated" maxLength={20}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 placeholder:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Mobile" name="mobile" value={form.mobile} onChange={handleChange} placeholder="+91XXXXXXXXXX" type="tel" required t={t}>
                                <input name="mobile" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/(?!^\+)[^\d]/g, "").slice(0, 13) }))} placeholder="+91XXXXXXXXXX" type="tel" required maxLength={13}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                        </div>

                        {/* Row 2 - Aadhaar, PAN, Seller ID Code */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Aadhaar" name="aadhaar" value={form.aadhaar} onChange={handleChange} placeholder="XXXX XXXX XXXX" t={t}>
                                <input name="aadhaar" value={form.aadhaar}
                                    onChange={e => setForm(p => ({ ...p, aadhaar: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                                    placeholder="XXXX XXXX XXXX" maxLength={12}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>

                            <Field label="PAN Number" name="pan_number" value={form.pan_number} onChange={handleChange} placeholder="e.g. ABCDE1234F" t={t}>
                                <input name="pan_number" value={form.pan_number}
                                    onChange={e => setForm(p => ({ ...p, pan_number: e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase() }))}
                                    placeholder="e.g. ABCDE1234F" maxLength={12}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{form.pan_number.length}/12</p>
                            </Field>

                            <Field label="Seller ID Code" name="seller_id_code" value={form.seller_id_code} onChange={handleChange} placeholder="Up to 18 digits" t={t}>
                                <input name="seller_id_code" value={form.seller_id_code}
                                    onChange={e => setForm(p => ({ ...p, seller_id_code: e.target.value.replace(/\D/g, "").slice(0, 18) }))}
                                    placeholder="Up to 18 digits" maxLength={18} inputMode="numeric"
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{form.seller_id_code.length}/18</p>
                            </Field>
                        </div>

                        {/* Row 3 - Seller Type & Milk Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Seller Type" required t={t}>
                                <div className="flex gap-2">
                                    {SELLER_TYPES.map((type) => (
                                        <label key={type} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm
                                            ${form.seller_type === type
                                                ? type === "Utpadak" ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800" : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/60 text-orange-800"
                                                : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
                                            <input type="radio" name="seller_type" value={type} checked={form.seller_type === type} onChange={handleChange} className="hidden" />
                                            {type === "Utpadak" ? "Utpadak" : "Gavali"}
                                        </label>
                                    ))}
                                </div>
                            </Field>

                            <Field label="Milk Type" required t={t}>
                                <div className="flex gap-2">
                                    {MILK_TYPES.map((type) => (
                                        <label key={type} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm                                                ${form.milk_type === type
                                            ? type === "cow" ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-800"
                                                : type === "buffalo" ? "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-800"
                                                    : "bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-800"
                                            : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
                                            <input type="radio" name="milk_type" value={type} checked={form.milk_type === type} onChange={handleChange} className="hidden" />
                                            {type === "cow" ? "Cow" : type === "buffalo" ? "Buffalo" : "Both"}
                                        </label>
                                    ))}
                                </div>
                            </Field>
                        </div>

                        {/* Row 4 - Jamin, Bank Account, Confirm Account */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Jamin" name="jamin" value={form.jamin} onChange={handleChange} placeholder="Enter jamin name" t={t}>
                                <input name="jamin" value={form.jamin}
                                    onChange={e => setForm(p => ({ ...p, jamin: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                    placeholder="Enter jamin name" maxLength={60}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Bank Account No" name="bank_account" value={form.bank_account} onChange={handleChange} placeholder="Enter bank account number" t={t}>
                                <input name="bank_account" value={form.bank_account} onChange={e => setForm(p => ({ ...p, bank_account: e.target.value.replace(/\D/g, "") }))}
                                    placeholder="Enter bank account number" maxLength={20}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Confirm Account No" name="bank_account_confirm" value={form.bank_account_confirm} onChange={handleChange} placeholder="Confirm bank account number" t={t}>
                                <input name="bank_account_confirm" value={form.bank_account_confirm}
                                    onChange={e => setForm(p => ({ ...p, bank_account_confirm: e.target.value.replace(/\D/g, "") }))}
                                    placeholder="Confirm bank account number" maxLength={20}
                                    className={`border rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition w-full
                                        ${form.bank_account_confirm && form.bank_account !== form.bank_account_confirm ? "border-rose-300 bg-rose-50/50 focus:ring-rose-400" : "border-gray-200/60 bg-white/50 backdrop-blur-sm focus:bg-white"}`} />
                                {form.bank_account_confirm && form.bank_account !== form.bank_account_confirm &&
                                    <p className="text-xs text-rose-500 mt-1">Account numbers do not match</p>}
                            </Field>
                        </div>

                        {/* Row 5 - Bank Name, IFSC, Account Holder, Branch */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <Field label="Bank Name" name="bank_name" value={form.bank_name} onChange={handleChange} placeholder="e.g. SBI, HDFC" t={t}>
                                <input name="bank_name" value={form.bank_name}
                                    onChange={e => setForm(p => ({ ...p, bank_name: e.target.value.replace(/[^a-zA-Z\s.]/g, "") }))}
                                    placeholder="e.g. SBI, HDFC" maxLength={50}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="IFSC Code" name="ifsc_code" value={form.ifsc_code} onChange={handleChange} placeholder="e.g. SBIN0001234" t={t}>
                                <input name="ifsc_code" value={form.ifsc_code}
                                    onChange={e => setForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. SBIN0001234" maxLength={11}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Account Holder Name" name="account_holder_name" value={form.account_holder_name} onChange={handleChange} placeholder="As per bank passbook" t={t}>
                                <input name="account_holder_name" value={form.account_holder_name}
                                    onChange={e => setForm(p => ({ ...p, account_holder_name: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                    placeholder="As per bank passbook" maxLength={100}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Branch Name" name="branch_name" value={form.branch_name} onChange={handleChange} placeholder="e.g. Pune Main Branch" t={t}>
                                <input name="branch_name" value={form.branch_name}
                                    onChange={e => setForm(p => ({ ...p, branch_name: e.target.value.replace(/[^a-zA-Z0-9\s.]/g, "") }))}
                                    placeholder="e.g. Pune Main Branch" maxLength={100}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                        </div>

                        {/* Row 6 - Address, Pincode, Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Address" name="address" value={form.address} onChange={handleChange} placeholder="Enter full address" t={t}>
                                <input name="address" value={form.address} onChange={handleChange}
                                    placeholder="Enter full address" minLength={10} maxLength={200}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{form.address.length}/200</p>
                            </Field>
                            <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} placeholder="e.g. 411001" t={t}>
                                <input name="pincode" value={form.pincode}
                                    onChange={e => setForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                    placeholder="e.g. 411001" maxLength={6} inputMode="numeric"
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                            </Field>
                            <Field label="Password" name="password" value={form.password} onChange={handleChange}
                                placeholder={hasPassword ? "••••••• (already set — leave blank to keep)" : "Password not set yet"} t={t}>
                                <div className="relative">
                                    <input name="password" type="password" value={form.password}
                                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        placeholder={hasPassword ? "••••••• (already set — leave blank to keep)" : "Password not set yet"}
                                        maxLength={100} autoComplete="new-password"
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                                <p className={`text-[10px] mt-1 ${hasPassword ? "text-emerald-600" : "text-amber-600"}`}>
                                    {hasPassword ? "Password is set. Enter a new one to change it." : "No password set yet for this seller."}
                                </p>
                            </Field>
                        </div>

                        {/* Row 7 - Cheque Image */}
                        <div className="grid grid-cols-1 gap-4">
                            <ChequeUpload
                                value={form.cheque}
                                onChange={(val) => setForm(p => ({ ...p, cheque: val }))}
                                label="Cheque Image"
                            />
                        </div>

                        {/* Row 8 - Cash Advance */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Cash Advance" t={t}>
                                <div className="flex gap-2">
                                    {[{ label: "Enabled", val: 1 }, { label: "Disabled", val: 0 }].map(({ label, val }) => (
                                        <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm ${form.advance_enabled === val
                                            ? val === 1 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700"
                                            : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
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
                                <Field label="Advance Recovery" name="advance_deduction" value={form.advance_deduction} onChange={handleChange} placeholder="Enter amount per litre" t={t}>
                                    <input name="advance_deduction" value={form.advance_deduction}
                                        onChange={e => setForm(p => ({ ...p, advance_deduction: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") }))}
                                        placeholder="Enter amount per litre" inputMode="decimal" maxLength={10}
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full" />
                                </Field>
                            )}
                        </div>

                        {/* Row 9 - Deposit per Litre */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Deposit per Litre" t={t}>
                                <div className="flex gap-2">
                                    {[{ label: "Enabled", val: 1 }, { label: "Disabled", val: 0 }].map(({ label, val }) => (
                                        <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm
                                        ${form.deposit_enabled === val
                                                ? val === 1 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700"
                                                : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
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
                                <Field label="Deposit Rate" t={t}>
                                    <input
                                        name="deposit_per_litre"
                                        value={form.deposit_per_litre}
                                        onChange={e => setForm(p => ({ ...p, deposit_per_litre: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") }))}
                                        placeholder="Enter amount per litre"
                                        inputMode="decimal"
                                        maxLength={6}
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm font-mono text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-full"
                                    />
                                    {form.deposit_per_litre && (
                                        <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                                            ₹{parseFloat(form.deposit_per_litre || 0).toFixed(2)} per litre collected
                                        </p>
                                    )}
                                    {!form.deposit_per_litre && (
                                        <p className="text-[10px] text-gray-400 mt-1">Enter the deposit amount per litre</p>
                                    )}
                                </Field>
                            )}
                        </div>

                        {/* Row 10 - Product Sale & Cattle Feed Sale Toggles */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Product Sale" t={t}>
                                <div className="flex gap-2">
                                    {[{ label: "Enabled", val: 1 }, { label: "Disabled", val: 0 }].map(({ label, val }) => (
                                        <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm
                ${form.product_sale_enabled === val
                                                ? val === 1 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700"
                                                : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
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

                            <Field label="Cattle Feed Sale" t={t}>
                                <div className="flex gap-2">
                                    {[{ label: "Enabled", val: 1 }, { label: "Disabled", val: 0 }].map(({ label, val }) => (
                                        <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm
                                            ${form.cattle_feed_sale_enabled === val
                                                ? val === 1 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700"
                                                : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
                                            <input
                                                type="radio"
                                                name="cattle_feed_sale_enabled"
                                                value={val}
                                                checked={form.cattle_feed_sale_enabled === val}
                                                onChange={() => setForm(p => ({
                                                    ...p,
                                                    cattle_feed_sale_enabled: val,
                                                }))}
                                                className="hidden"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </Field>
                        </div>

                        {/* Row 11 - Active Status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Seller Status" t={t}>
                                <div className="flex gap-2">
                                    {[{ label: "Active", val: 1 }, { label: "Inactive", val: 0 }].map(({ label, val }) => (
                                        <label key={val} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm
                                            ${(form.is_active ?? 1) === val
                                                ? val === 1 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-800" : "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700"
                                                : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50"}`}>
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

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100/60">
                            <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50">
                                {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                <Save size={14} />
                                {saving ? "Saving..." : editingId ? "Update Seller" : "Register Seller"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
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
    const [flashPhase, setFlashPhase] = useState("idle");
    const flashHideTimer = useRef(null);
    const flashClearTimer = useRef(null);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState(() => sessionStorage.getItem('sellerRegister_filter') || "all");
    const [sellerTypeFilter, setSellerTypeFilter] = useState(() => sessionStorage.getItem('sellerRegister_sellerTypeFilter') || "all_types");
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('sellerRegister_searchTerm') || "");
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(() => {
        const saved = sessionStorage.getItem('sellerRegister_currentPage');
        const n = saved ? parseInt(saved, 10) : 1;
        return Number.isNaN(n) || n < 1 ? 1 : n;
    });
    const [hasPassword, setHasPassword] = useState(false);
    const [codeSortDirection, setCodeSortDirection] = useState('asc');

    // Cycles: none -> ascending -> descending -> none
    const toggleCodeSort = () => {
        setCodeSortDirection((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
        setCurrentPage(1);
    };

    // Numeric-aware compare: numeric codes sort by value, non-numeric codes
    // fall back to a string comparison and are placed after numeric ones.
    const compareSellerCodes = (a, b) => {
        const aCode = a.seller_code || "";
        const bCode = b.seller_code || "";
        const aNum = /^\d+$/.test(aCode) ? parseInt(aCode, 10) : null;
        const bNum = /^\d+$/.test(bCode) ? parseInt(bCode, 10) : null;

        if (aNum !== null && bNum !== null) return aNum - bNum;
        if (aNum !== null) return -1;
        if (bNum !== null) return 1;
        return aCode.localeCompare(bCode);
    };

    const showFlash = (type, msg) => {
        clearTimeout(flashHideTimer.current);
        clearTimeout(flashClearTimer.current);
        setFlash({ type, msg });
        setFlashPhase("idle");
        requestAnimationFrame(() => requestAnimationFrame(() => setFlashPhase("visible")));
        flashHideTimer.current = setTimeout(() => {
            setFlashPhase("idle");
            flashClearTimer.current = setTimeout(() => setFlash(null), FLASH_ANIM_MS);
        }, FLASH_DURATION);
    };

    const dismissFlash = () => {
        clearTimeout(flashHideTimer.current);
        clearTimeout(flashClearTimer.current);
        setFlashPhase("idle");
        flashClearTimer.current = setTimeout(() => setFlash(null), FLASH_ANIM_MS);
    };
    const handleFilterChange = (f) => { setFilter(f); setCurrentPage(1); };
    const handleSellerTypeFilterChange = (f) => { setSellerTypeFilter(f); setCurrentPage(1); };
    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importData, setImportData] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importErrors, setImportErrors] = useState([]);
    const [parsingFile, setParsingFile] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [missingRequiredColumns, setMissingRequiredColumns] = useState(false);
    const [importMode, setImportMode] = useState('add');
    const [deleteMissingOnUpdate, setDeleteMissingOnUpdate] = useState(false);

    // ── Search Function ──
    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    // ── Clear Search ──
    const clearSearch = () => {
        setSearchTerm("");
        setCurrentPage(1);
    };

    // ── Filtered sellers with search ──
    const filteredSellers = useMemo(() => {
        let result = sellers;

        // Apply milk type filter
        if (filter !== "all") {
            result = result.filter((s) => s.milk_type === filter);
        }

        // Apply seller type filter
        if (sellerTypeFilter !== "all_types") {
            result = result.filter((s) => s.seller_type === sellerTypeFilter);
        }

        // Apply search filter (name or seller_code)
        if (searchTerm.trim() !== "") {
            const term = searchTerm.trim().toLowerCase();
            result = result.filter((s) => {
                const nameMatch = s.name?.toLowerCase().includes(term);
                const codeMatch = s.seller_code?.toLowerCase().includes(term);
                return nameMatch || codeMatch;
            });
        }

        // Apply seller code sort
        if (codeSortDirection) {
            result = [...result].sort((a, b) =>
                codeSortDirection === 'asc' ? compareSellerCodes(a, b) : compareSellerCodes(b, a)
            );
        }

        return result;
    }, [sellers, filter, sellerTypeFilter, searchTerm, codeSortDirection]);

    const totalPages = Math.ceil(filteredSellers.length / pageSize);

    // Clamp restored page if it's no longer valid (list shrank, filters changed, etc.)
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    useEffect(() => {
        sessionStorage.setItem('sellerRegister_filter', filter);
    }, [filter]);

    useEffect(() => {
        sessionStorage.setItem('sellerRegister_sellerTypeFilter', sellerTypeFilter);
    }, [sellerTypeFilter]);

    useEffect(() => {
        sessionStorage.setItem('sellerRegister_searchTerm', searchTerm);
    }, [searchTerm]);

    const paginated = filteredSellers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const processFile = (file) => {
        if (!file) return;
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
            setImportErrors([t('sellerRegister.invalidFileFormat') || 'Please upload a .xlsx, .xls, or .csv file.']);
            return;
        }
        setImportFile(file);
        setImportErrors([]);
        setImportData([]);
        setMissingRequiredColumns(false);
        setParsingFile(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

                if (json.length === 0) {
                    setImportErrors([t('sellerRegister.emptyFileError') || 'The file is empty or has no data.']);
                    setParsingFile(false);
                    return;
                }

                const headers = Object.keys(json[0]);
                const mappedHeaders = headers.map(h => {
                    const lower = h.trim().toLowerCase();
                    return columnMap[lower] || null;
                });

                const nameIdx = mappedHeaders.indexOf('name');
                const mobileIdx = mappedHeaders.indexOf('mobile');
                if (nameIdx === -1 || mobileIdx === -1) {
                    setMissingRequiredColumns(true);
                    setImportErrors([t('sellerRegister.missingRequiredColumns') || 'Required columns "Name" and "Mobile" not found.']);
                    setParsingFile(false);
                    return;
                }
                if (importMode === 'update' && mappedHeaders.indexOf('seller_code') === -1) {
                    setMissingRequiredColumns(true);
                    setImportErrors([t('sellerRegister.missingSellerCodeColumn') || 'Required column "Seller Code" not found — it is needed to match existing sellers when updating.']);
                    setParsingFile(false);
                    return;
                }

                const BOOL_FIELDS = ['advance_enabled', 'product_sale_enabled', 'deposit_enabled', 'cattle_feed_sale_enabled'];
                const DECIMAL_FIELDS = ['advance_deduction', 'deposit_per_litre'];

                // Track auto-generated seller codes locally so multiple blank rows
                // in the same file don't collide with each other — previously they
                // all received the identical "next" code and were flagged as duplicates.
                const existingCodeNums = sellers
                    .map(s => s.seller_code)
                    .filter(c => /^\d+$/.test(c))
                    .map(c => parseInt(c, 10));
                let nextCodeCounter = existingCodeNums.length > 0 ? Math.max(...existingCodeNums) + 1 : 1;

                const rows = json.map((row, idx) => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        const field = mappedHeaders[i];
                        if (!field) return;
                        let val = row[h];
                        if (BOOL_FIELDS.includes(field)) {
                            val = parseBoolField(val);
                        } else if (DECIMAL_FIELDS.includes(field)) {
                            val = parseDecimalField(val);
                        } else if (field === 'seller_type') {
                            val = normalizeSellerType(val);
                        } else if (field === 'milk_type') {
                            val = normalizeMilkType(val);
                        } else if (typeof val === 'string') {
                            val = val.trim();
                        }
                        obj[field] = val;
                    });
                    BOOL_FIELDS.forEach(f => {
                        if (obj[f] === undefined) obj[f] = (f === 'advance_enabled' ? 1 : 0);
                    });
                    if (!obj.seller_type) obj.seller_type = 'Utpadak';
                    if (!obj.milk_type) obj.milk_type = 'both';

                    // Strip leading zeros from a user-provided seller code (e.g. "01" -> "1"),
                    // but leave a lone "0" untouched.
                    if (obj.seller_code && /^0+[0-9]+$/.test(String(obj.seller_code).trim())) {
                        obj.seller_code = String(obj.seller_code).trim().replace(/^0+/, '');
                    }

                    // Generate seller_code if not provided (never auto-generate when updating existing sellers)
                    if (importMode === 'add' && (!obj.seller_code || obj.seller_code.trim() === '')) {
                        obj.seller_code = String(nextCodeCounter);
                        nextCodeCounter++;
                    }

                    return { ...obj, _rowIndex: idx + 1 };
                });

                // All per-row validations removed — every parsed row is accepted as-is.
                rows.forEach((row) => {
                    if (row.mobile) {
                        row.mobile = String(row.mobile).replace(/[^\d]/g, "");
                    }
                    row._valid = true;
                });
                setImportErrors([]);
                setImportData(rows);
            } catch (err) {
                setImportErrors([t('sellerRegister.parseError', { error: err.message }) || 'Failed to parse file: ' + err.message]);
            } finally {
                setParsingFile(false);
            }
        };
        reader.onerror = () => {
            setImportErrors([t('sellerRegister.fileReadError') || 'Could not read the file.']);
            setParsingFile(false);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileUpload = (e) => processFile(e.target.files[0]);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processFile(e.dataTransfer.files[0]);
    };
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

    const downloadTemplate = () => {
        const headers = ["Seller Code", "Name", "Mobile", "Aadhaar", "PAN", "Seller ID Code",
            "Seller Type", "Milk Type", "Jamin", "Bank Account", "Bank Name", "Account Holder",
            "Branch", "IFSC", "Address", "Pincode", "Advance Enabled", "Advance Deduction",
            "Product Sale Enabled", "Deposit Enabled", "Deposit Per Litre",
            "Cattle Feed Enabled", "Password"];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...SAMPLE_FARMER_ROWS]);
        ws['!cols'] = headers.map(() => ({ wch: 20 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Farmers");
        XLSX.writeFile(wb, "farmer_import_template.xlsx");
    };

    const resetImport = () => {
        setImportFile(null);
        setImportData([]);
        setImportErrors([]);
        setMissingRequiredColumns(false);
        setImportResult(null);
        setDeleteMissingOnUpdate(false);
    };

    const handleExportData = () => {
        if (sellers.length === 0) {
            showFlash("error", t('sellerRegister.noSellersToExport') || 'No sellers to export.');
            return;
        }
        const headers = ["Seller Code", "Name", "Mobile", "Aadhaar", "PAN", "Seller ID Code",
            "Seller Type", "Milk Type", "Jamin", "Bank Account", "Bank Name", "Account Holder",
            "Branch", "IFSC", "Address", "Pincode", "Advance Enabled", "Advance Deduction",
            "Product Sale Enabled", "Deposit Enabled", "Deposit Per Litre", "Cattle Feed Enabled"];

        // Sort by seller code ascending. Numeric codes ("001", "052") sort numerically;
        // any non-numeric codes fall back to a plain string comparison and are placed after.
        const sortedSellers = [...sellers].sort((a, b) => {
            const aCode = a.seller_code || "";
            const bCode = b.seller_code || "";
            const aNum = /^\d+$/.test(aCode) ? parseInt(aCode, 10) : null;
            const bNum = /^\d+$/.test(bCode) ? parseInt(bCode, 10) : null;

            if (aNum !== null && bNum !== null) return aNum - bNum;
            if (aNum !== null) return -1;   // numeric codes sort before non-numeric
            if (bNum !== null) return 1;
            return aCode.localeCompare(bCode);
        });

        const rows = sortedSellers.map(s => [
            s.seller_code || "", s.name || "", s.mobile || "", s.aadhaar || "", s.pan_number || "",
            s.seller_id_code || "", s.seller_type || "Utpadak", s.milk_type || "both", s.jamin || "",
            s.bank_account || "", s.bank_name || "", s.account_holder_name || "", s.branch_name || "",
            s.ifsc_code || "", s.address || "", s.pincode || "",
            s.advance_enabled ? 1 : 0, s.advance_deduction || "",
            s.product_sale_enabled ? 1 : 0, s.deposit_enabled ? 1 : 0, s.deposit_per_litre || "",
            s.cattle_feed_sale_enabled ? 1 : 0,
        ]);
        // Password intentionally excluded from export for security.
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = headers.map(() => ({ wch: 20 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Farmers");
        XLSX.writeFile(wb, `sellers_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showFlash("success", t('sellerRegister.exportSuccess') || 'Farmer data exported successfully.');
    };

    const handleImportSave = async () => {
        if (importData.length === 0) return;

        const validRows = importData.filter(r => r._valid);
        if (validRows.length === 0) {
            setImportErrors([t('sellerRegister.noValidRows') || 'No valid rows to import.']);
            return;
        }

        setImportLoading(true);
        try {
            const endpoint = importMode === 'update' ? '/sellers/bulk-update' : '/sellers/import';
            const payload = importMode === 'update'
                ? { sellers: validRows, deleteMissing: deleteMissingOnUpdate }
                : { sellers: validRows };
            const response = await api.post(endpoint, payload);
            const { added, updated, inserted, deleted, skipped, errors: importResultErrors } = response.data;

            if (importResultErrors && importResultErrors.length > 0) {
                setImportErrors(importResultErrors.map(e => `Row ${e.row}: ${e.error}`));
            } else {
                setImportErrors([]);
            }

            setImportResult({
                added: importMode === 'update' ? (updated + (inserted || 0)) : added,
                updated: importMode === 'update' ? updated : undefined,
                inserted: importMode === 'update' ? inserted : undefined,
                deleted: importMode === 'update' ? (deleted || 0) : undefined,
                skipped,
                mode: importMode,
            });
            await fetchSellers(true);

            // Close modal if all were added
            if (skipped === 0) {
                setTimeout(() => {
                    setShowImportModal(false);
                    resetImport();
                }, 2000);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
            setImportErrors([errorMsg]);
        } finally {
            setImportLoading(false);
        }
    };

    const startSellerRegisterTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="add-seller-btn"]',
                    popover: { title: 'Add Seller', description: 'Click here to register a new seller.' },
                },
                {
                    element: '[data-tour="seller-stats"]',
                    popover: { title: 'Total Sellers', description: 'See your total sellers, broken down by milk type.' },
                },
                {
                    element: '[data-tour="filter-tabs"]',
                    popover: { title: 'Filter', description: 'Filter the seller list by cow, buffalo, or both milk type.' },
                },
                {
                    element: '[data-tour="search-input"]',
                    popover: { title: 'Search Sellers', description: 'Search for sellers by their name or seller code.' },
                },
                {
                    element: '[data-tour="seller-table"]',
                    popover: { title: 'Actions', description: 'Click a seller\'s name to view their profile, or use Edit/Delete here.' },
                },
            ],
        });
        driverObj.drive();
    };

    const fetchSellers = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get("/sellers");
            setSellers(data);
        } catch (err) {
            showFlash("error", t('sellerRegister.loadError') || 'Failed to load sellers.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { fetchSellers(); }, [t]);

    // Persist the current page across unmount/remount (e.g. navigating to a
    // seller profile and back), so the list doesn't snap back to page 1.
    useEffect(() => {
        sessionStorage.setItem('sellerRegister_currentPage', String(currentPage));
    }, [currentPage]);

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );
    if (!can('seller_register', 'R')) return <AccessDenied />;

    const openAdd = () => {
        const codes = sellers.map(s => s.seller_code).filter(c => /^\d+$/.test(c)).map(c => parseInt(c, 10));
        const next = codes.length > 0 ? Math.max(...codes) + 1 : 1;
        setForm({ ...EMPTY_FORM, seller_code: String(next).padStart(3, "0") });
        setEditingId(null);
        setHasPassword(false);
        setShowForm(true);
    };
    const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setHasPassword(false); };

    const openEdit = (s) => {
        setForm({
            seller_code: s.seller_code || "",
            name: s.name || "",
            mobile: s.mobile || "",
            aadhaar: s.aadhaar || "",
            pan_number: s.pan_number || "",
            seller_id_code: s.seller_id_code || "",
            seller_type: s.seller_type || "Utpadak",
            milk_type: s.milk_type || "both",
            jamin: s.jamin || "",
            bank_account: s.bank_account || "",
            bank_account_confirm: s.bank_account || "",
            bank_name: s.bank_name || "",
            account_holder_name: s.account_holder_name || "",
            branch_name: s.branch_name || "",
            ifsc_code: s.ifsc_code || "",
            address: s.address || "",
            pincode: s.pincode || "",
            password: "",
            advance_enabled: Number(s.advance_enabled ?? 1) ? 1 : 0,
            advance_deduction: s.advance_deduction || "",
            deposit_enabled: Number(s.deposit_enabled ?? 0) ? 1 : 0,
            deposit_per_litre: s.deposit_per_litre || "",
            product_sale_enabled: Number(s.product_sale_enabled ?? 0) ? 1 : 0,
            cattle_feed_sale_enabled: Number(s.cattle_feed_sale_enabled ?? 0) ? 1 : 0,
            is_active: Number(s.is_active ?? 1) ? 1 : 0,
            cheque: s.cheque || "",
        });
        setEditingId(s.seller_id);
        setHasPassword(!!s.has_password);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.seller_code || !form.seller_code.trim()) { showFlash("error", "Seller code is required."); return; }
        const nameParts = form.name.trim().split(/\s+/);
        if (!form.name || nameParts.length < 2) { showFlash("error", "Please enter the full name (first and last name)."); return; }
        if (/\d/.test(form.name)) { showFlash("error", "Name should not contain numbers."); return; }
        const mobileClean = form.mobile.replace(/^\+/, "");
        if (!/^\d{10,12}$/.test(mobileClean)) { showFlash("error", "Please enter a valid mobile number (10-12 digits)."); return; }
        if (form.pan_number && !/^[a-zA-Z0-9]{1,12}$/.test(form.pan_number)) { showFlash("error", "PAN number must be alphanumeric and up to 12 characters."); return; }
        if (form.seller_id_code && !/^\d{1,18}$/.test(form.seller_id_code)) { showFlash("error", "Seller ID Code must be numeric and up to 18 digits."); return; }
        if (form.bank_account && form.bank_account.length < 10) { showFlash("error", "Bank account number must be at least 10 digits."); return; }
        if (form.bank_account && form.bank_account !== form.bank_account_confirm) { showFlash("error", "Bank account numbers do not match."); return; }
        if (form.address && form.address.length < 10) { showFlash("error", "Address must be at least 10 characters."); return; }
        if (form.address && form.address.length > 200) { showFlash("error", "Address cannot exceed 200 characters."); return; }
        if (form.pincode && !/^\d{6}$/.test(form.pincode)) { showFlash("error", "Pincode must be a valid 6-digit number."); return; }
        if (form.password && form.password.length < 6) { showFlash("error", "Password must be at least 6 characters."); return; }

        // Check for duplicates (max 2 allowed)
        if (form.bank_account) {
            const existingBankAccounts = sellers.filter(s => s.bank_account === form.bank_account);
            if (existingBankAccounts.length >= 2) {
                showFlash("error", "Bank Account number already exists for 2 sellers (max 2 allowed)");
                return;
            }
        }

        if (form.pan_number) {
            const existingPan = sellers.filter(s => s.pan_number === form.pan_number);
            if (existingPan.length >= 2) {
                showFlash("error", "PAN number already exists for 2 sellers (max 2 allowed)");
                return;
            }
        }

        if (form.aadhaar) {
            const existingAadhaar = sellers.filter(s => s.aadhaar === form.aadhaar);
            if (existingAadhaar.length >= 2) {
                showFlash("error", "Aadhaar number already exists for 2 sellers (max 2 allowed)");
                return;
            }
        }

        setSaving(true);
        try {
            const payload = { ...form };
            if (!payload.password) delete payload.password;
            if (editingId) { await api.put(`/sellers/${editingId}`, payload); showFlash("success", "Seller updated successfully."); }
            else { await api.post("/sellers", payload); showFlash("success", "Seller registered successfully."); }
            await fetchSellers(true);
            closeForm();
        } catch (err) {
            showFlash("error", err.response?.data?.error || err.response?.data?.message || "Failed to save seller.");
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        try { await api.delete(`/sellers/${deleteId}`); await fetchSellers(true); showFlash("success", "Seller deleted successfully."); }
        catch (err) { showFlash("error", err.response?.data?.error || "Failed to delete seller."); }
        finally { setDeleteId(null); }
    };

    const TABLE_COLS = [
        { label: 'Seller', icon: <User size={11} /> },
        { label: 'Code', icon: <Hash size={11} />, sortKey: 'seller_code' },
        { label: 'Mobile', icon: <Phone size={11} /> },
        { label: 'Aadhaar', icon: <CreditCard size={11} /> },
        { label: 'PAN', icon: <CreditCard size={11} /> },
        { label: 'Seller ID Code', icon: <Hash size={11} /> },
        { label: 'Type', icon: <ChevronDown size={11} /> },
        { label: 'Milk', icon: <ChevronDown size={11} /> },
        { label: 'Jamin', icon: <User size={11} /> },
        { label: 'Bank Account', icon: <Landmark size={11} /> },
        { label: 'Acc. Holder', icon: <User size={11} /> },
        { label: 'Bank IFSC', icon: <Building2 size={11} /> },
        { label: 'Branch', icon: <Building2 size={11} /> },
        { label: 'Address', icon: <MapPin size={11} /> },
        { label: 'Pincode', icon: <MapPinned size={11} /> },
        { label: 'Cheque', icon: <ImageIcon size={11} /> },
        { label: 'Advance', icon: <Wallet size={11} /> },
        { label: 'Adv Recovery', icon: <Banknote size={11} /> },
        { label: 'Dep/L', icon: <Banknote size={11} /> },
        { label: 'Status', icon: <Settings size={11} /> },
        { label: 'Registered', icon: <Calendar size={11} /> },
        { label: 'Actions', icon: <Settings size={11} /> },
    ];

    const GRID = "210px 100px 100px 120px 110px 140px 85px 85px 90px 120px 110px 120px 100px 115px 80px 80px 65px 95px 75px 75px 85px 100px";

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <FlashToast flash={flash} phase={flashPhase} onClose={dismissFlash} />
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Seller Register
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Manage your sellers —{" "}
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={startSellerRegisterTour}
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                            <BadgeCheck size={15} /> Take a Tour
                        </button>
                        <button onClick={openAdd} data-tour="add-seller-btn"
                            className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200">
                            <span className="text-base leading-none">+</span> Add Seller
                        </button>
                        <button onClick={() => { setImportMode('add'); setShowImportModal(true); }}
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                            <Import size={16} /> Import Farmers
                        </button>
                        <button onClick={() => { setImportMode('update'); setShowImportModal(true); }}
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                            <RotateCcw size={16} /> Update Farmers
                        </button>
                        <button onClick={handleExportData}
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                            <Download size={16} /> Export Farmer Data
                        </button>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6" data-tour="seller-stats">
                    {[
                        { label: 'Total Sellers', value: sellers.length, icon: <Users size={16} />, color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700" },
                        { label: 'Cow Sellers', value: sellers.filter((s) => s.milk_type === "cow").length, icon: <Milk size={16} />, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                        { label: 'Buffalo Sellers', value: sellers.filter((s) => s.milk_type === "buffalo").length, icon: <Milk size={16} />, color: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700" },
                        { label: 'Both Sellers', value: sellers.filter((s) => s.milk_type === "both").length, icon: <Milk size={16} />, color: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700" },
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

                {/* ── Filter Tabs and Search ── */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4" data-tour="filter-tabs">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Milk Type Filters */}
                        <span className="text-xs text-gray-400 font-medium mr-1">Milk:</span>
                        {["all", "cow", "buffalo", "both"].map((f) => (
                            <button key={f} onClick={() => handleFilterChange(f)}
                                className={`text-xs font-semibold px-4 py-1.5 rounded-full transition border shadow-sm
                    ${filter === f ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30" : "bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-300 hover:bg-gray-50/50"}`}>
                                {f === "all" ? "All" : f === "cow" ? "Cow" : f === "buffalo" ? "Buffalo" : "Both"}
                                {f !== "all" && <span className="ml-1.5 opacity-60">{sellers.filter((s) => s.milk_type === f).length}</span>}
                            </button>
                        ))}

                        {/* Divider */}
                        <span className="w-px h-6 bg-gray-200 mx-2"></span>

                        {/* Seller Type Filters */}
                        <span className="text-xs text-gray-400 font-medium mr-1">Type:</span>
                        {["all_types", "Utpadak", "Gavali"].map((f) => (
                            <button key={f} onClick={() => handleSellerTypeFilterChange(f)}
                                className={`text-xs font-semibold px-4 py-1.5 rounded-full transition border shadow-sm
                    ${sellerTypeFilter === f ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30" : "bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-300 hover:bg-gray-50/50"}`}>
                                {f === "all_types" ? "All" : f === "Utpadak" ? "Utpadak" : "Gavali"}
                                {f !== "all_types" && <span className="ml-1.5 opacity-60">{sellers.filter((s) => s.seller_type === f).length}</span>}
                            </button>
                        ))}
                    </div>

                    {/* ── Search Input ── */}
                    <div className="flex items-center gap-2 ml-auto w-full sm:w-auto" data-tour="search-input">
                        <div className="relative flex-1 sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search by name or code..."
                                className="w-full pl-9 pr-8 py-1.5 rounded-full border border-gray-200/60 bg-white/50 backdrop-blur-sm text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                            {filteredSellers.length} sellers
                        </span>
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="w-full overflow-x-auto rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 bg-white/80 backdrop-blur-sm" data-tour="seller-table">
                    <div className="min-w-[1760px]">
                        <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50" style={{ gridTemplateColumns: GRID }}>
                            {TABLE_COLS.map(({ label, icon, sortKey }) => (
                                <div key={label} className="px-3 py-3 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
                                    {sortKey === 'seller_code' ? (
                                        <button type="button" onClick={toggleCodeSort}
                                            className="flex items-center gap-1.5 hover:text-gray-800 transition">
                                            {icon}{label}
                                            {codeSortDirection === 'asc' ? <ArrowUp size={11} />
                                                : codeSortDirection === 'desc' ? <ArrowDown size={11} />
                                                    : <ArrowUpDown size={11} className="opacity-40" />}
                                        </button>
                                    ) : (
                                        <>{icon}{label}</>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : filteredSellers.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="flex justify-center mb-3">
                                {searchTerm.trim() !== "" ? (
                                    <Search size={40} className="text-gray-300" />
                                ) : (
                                    <Sprout size={40} className="text-gray-200" />
                                )}
                            </div>
                            <p className="text-gray-500 text-sm font-medium">
                                {searchTerm.trim() !== ""
                                    ? `No sellers found matching "${searchTerm}"`
                                    : "No sellers found"}
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                                {searchTerm.trim() !== ""
                                    ? "Try a different search term"
                                    : "Add your first seller"}
                            </p>
                            {searchTerm.trim() !== "" && (
                                <button
                                    onClick={clearSearch}
                                    className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {paginated.map((s) => (
                                <div key={s.seller_id}
                                    className="grid border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors group"
                                    style={{ gridTemplateColumns: GRID }}>

                                    {/* Name — link to profile */}
                                    <TableCell>
                                        <Link to={`/seller/${s.seller_id}`} className="flex items-center gap-2 min-w-0 overflow-hidden group/link">
                                            <span className="min-w-0 text-gray-800 font-medium truncate group-hover/link:text-gray-900 group-hover/link:underline underline-offset-2 transition">
                                                {s.name}
                                            </span>
                                            <ExternalLink size={10} className="text-gray-300 group-hover/link:text-gray-500 shrink-0 transition" />
                                        </Link>
                                    </TableCell>

                                    <TableCell>
                                        <span className="font-mono text-xs text-gray-500 bg-gray-50/80 border border-gray-200/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                                            {s.seller_code || "—"}
                                        </span>
                                    </TableCell>

                                    <TableCell className="text-blue-600 font-mono text-xs font-medium">{s.mobile || "—"}</TableCell>
                                    <TableCell className="text-violet-600 font-mono text-xs">{s.aadhaar || "—"}</TableCell>

                                    <TableCell className="text-rose-600 font-mono text-xs">{s.pan_number || "—"}</TableCell>

                                    <TableCell className="text-indigo-600 font-mono text-xs">{s.seller_id_code || "—"}</TableCell>

                                    <TableCell>
                                        {s.seller_type
                                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sellerTypeBadge(s.seller_type)}`}>
                                                {s.seller_type === "Utpadak" ? "Utpadak" : "Gavali"}
                                            </span>
                                            : "—"}
                                    </TableCell>

                                    <TableCell>
                                        {s.milk_type
                                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${milkBadge(s.milk_type)}`}>
                                                {s.milk_type === "cow" ? "Cow" : s.milk_type === "buffalo" ? "Buffalo" : "Both"}
                                            </span>
                                            : "—"}
                                    </TableCell>

                                    <TableCell className="text-gray-500 text-xs">
                                        <span className="truncate block max-w-[80px]" title={s.jamin || ""}>{s.jamin || "—"}</span>
                                    </TableCell>

                                    <TableCell className="text-amber-700 font-mono text-xs">
                                        <span className="truncate block max-w-[110px]" title={s.bank_account || ""}>{s.bank_account || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-gray-600 text-xs">
                                        <span className="truncate block max-w-[100px]" title={s.account_holder_name || ""}>{s.account_holder_name || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-gray-700">{s.bank_name || "—"}</span>
                                            {s.ifsc_code && <span className="font-mono text-[10px] text-gray-400">{s.ifsc_code}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-gray-500 text-xs">
                                        <span className="truncate block max-w-[90px]" title={s.branch_name || ""}>{s.branch_name || "—"}</span>
                                    </TableCell>

                                    <TableCell className="text-gray-500 text-xs">
                                        <span className="truncate block max-w-[100px]" title={s.address || ""}>{s.address || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-gray-500 font-mono text-xs">{s.pincode || "—"}</TableCell>

                                    {/* Cheque Column */}
                                    <TableCell>
                                        {s.cheque ? (
                                            <button
                                                onClick={() => window.open(s.cheque, '_blank')}
                                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition"
                                            >
                                                <ImageIcon size={14} />
                                                <span>View</span>
                                            </button>
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm
                                            ${s.advance_enabled === 0 || s.advance_enabled === false
                                                ? "bg-rose-50/80 text-rose-600 border-rose-200/60"
                                                : "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"}`}>
                                            {s.advance_enabled === 0 || s.advance_enabled === false ? "Off" : "On"}
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
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border backdrop-blur-sm
                                            ${s.is_active ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60" : "bg-gray-50/80 text-gray-400 border-gray-200/60"}`}>
                                            {s.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-gray-400 font-mono text-xs">{fmt(s.created_at)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => openEdit(s)}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 text-xs font-semibold transition border border-blue-200/60 backdrop-blur-sm shadow-sm">
                                                <Pencil size={12} /> Edit
                                            </button>
                                            <button onClick={() => setDeleteId(s.seller_id)}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-500 text-xs font-semibold transition border border-rose-200/60 backdrop-blur-sm shadow-sm">
                                                <Trash2 size={12} /> Del
                                            </button>
                                        </div>
                                    </TableCell>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* ── Pagination ── */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                            Prev
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
                                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition border shadow-sm
                                ${currentPage === p ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30" : "bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-300 hover:bg-gray-50/50"}`}>
                                            {p}
                                        </button>
                                )}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                            Next
                        </button>
                        <span className="text-xs text-gray-400 ml-1">
                            {filteredSellers.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredSellers.length)}`} of {filteredSellers.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Rows per page</span>
                            <input
                                type="number" min={1} max={filteredSellers.length || 1}
                                value={pageSize}
                                onChange={e => {
                                    const v = Math.max(1, parseInt(e.target.value) || 1);
                                    setPageSize(v);
                                    setCurrentPage(1);
                                }}
                                className="w-14 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-center text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            <span>• <strong className="text-gray-600">{sellers.length}</strong> {sellers.length === 1 ? 'seller' : 'sellers'}</span>
                            <span>• Click name for profile</span>
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-6 mt-4 border-t border-gray-200/40">
                    <span>· Role: <strong className="text-gray-600">Admin</strong></span>
                    <span>· Total sellers: <strong className="text-gray-600">{sellers.length}</strong></span>
                    <span>· Active: <strong className="text-emerald-600">{sellers.filter(s => s.is_active).length}</strong></span>
                </div>

            </main>

            {/* ── Seller Form Modal ── */}
            <SellerFormModal
                isOpen={showForm}
                onClose={closeForm}
                form={form}
                setForm={setForm}
                editingId={editingId}
                saving={saving}
                onSave={handleSave}
                onCancel={closeForm}
                t={t}
                hasPassword={hasPassword}
            />

            {/* ── Delete Modal ── */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-14 h-14 rounded-full bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shadow-sm">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <h2 className="text-gray-800 font-bold text-base">Delete Seller</h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                Are you sure you want to delete this seller? This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setDeleteId(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">Cancel</button>
                            <button onClick={handleDelete}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 active:scale-95">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Import Modal ── */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="flex items-center rounded-xl justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-gray-50/50 to-white/50">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shrink-0 shadow-lg shadow-gray-900/20">
                                    <FileSpreadsheet size={16} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-800">
                                        {importMode === 'update' ? 'Update Farmers' : 'Import Farmers'}
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {importMode === 'update'
                                            ? 'Bulk-update existing sellers — match rows by Seller Code'
                                            : 'Bulk-add sellers from an Excel or CSV file'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setShowImportModal(false); resetImport(); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="flex gap-2 mb-4">
                                {[{ key: 'add', label: 'Add New Sellers' },
                                { key: 'update', label: 'Update Existing Sellers' }].map(({ key, label }) => (
                                    <button key={key} type="button"
                                        onClick={() => { setImportMode(key); resetImport(); }}
                                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition shadow-sm
                                            ${importMode === key ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900" : "bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:bg-gray-50/50"}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {importMode === 'update' && (
                                <label className="flex items-start gap-2 mb-4 p-3 rounded-xl border border-rose-200/60 bg-rose-50/60 backdrop-blur-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={deleteMissingOnUpdate}
                                        onChange={e => setDeleteMissingOnUpdate(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span className="text-xs text-rose-700 leading-relaxed">
                                        <strong>Full sync mode:</strong> any seller currently in the system whose Seller Code
                                        does <u>not</u> appear in this file will be permanently deleted, along with all their
                                        milk entries, bills, advances, deposits, and sales history. Leave this unchecked to
                                        only add/update the rows present in the file.
                                    </span>
                                </label>
                            )}
                            {!importFile ? (
                                /* Drag & drop zone */
                                <label
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-12 px-6 cursor-pointer transition shadow-sm
                            ${isDragging ? "border-gray-900 bg-gray-100/50 backdrop-blur-sm" : "border-gray-200/60 bg-white/50 backdrop-blur-sm hover:border-gray-400 hover:bg-gray-50/50"}`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-sm
                            ${isDragging ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white" : "bg-gray-200/50 text-gray-400"}`}>
                                        <UploadCloud size={22} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-gray-700">
                                            {isDragging ? "Drop the file here" : "Drag & drop your file here"}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">or click to browse — .xlsx, .xls, or .csv</p>
                                    </div>
                                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                                </label>
                            ) : (
                                /* Selected file chip */
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm shadow-sm mb-4">
                                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-200/60 flex items-center justify-center shrink-0 shadow-sm">
                                        <FileSpreadsheet size={16} className="text-emerald-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate">{importFile.name}</p>
                                        <p className="text-xs text-gray-400">{(importFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    {parsingFile && (
                                        <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin shrink-0" />
                                    )}
                                    <button onClick={resetImport}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 backdrop-blur-sm hover:bg-gray-100/80 text-gray-500 text-xs font-medium transition border border-gray-200/60 shadow-sm shrink-0">
                                        <RotateCcw size={12} /> Replace
                                    </button>
                                </div>
                            )}

                            {/* Stat pills */}
                            {importData.length > 0 && (
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100/80 text-gray-600 border border-gray-200/60 backdrop-blur-sm shadow-sm">
                                        {importData.length} row(s) found
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm shadow-sm">
                                        <CheckCircle2 size={11} />
                                        {importData.filter(r => r._valid).length} valid
                                    </span>
                                    {importData.filter(r => !r._valid).length > 0 && (
                                        <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-rose-50/80 text-rose-600 border border-rose-200/60 backdrop-blur-sm shadow-sm">
                                            <XCircle size={11} />
                                            {importData.filter(r => !r._valid).length} invalid
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Errors */}
                            {importErrors.length > 0 && (
                                <div className="mb-4 p-3 bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 rounded-xl text-sm text-rose-600 max-h-40 overflow-y-auto shadow-sm">
                                    {importErrors.map((err, i) => <div key={i}>• {err}</div>)}
                                </div>
                            )}

                            {/* Preview Table */}
                            {importData.length > 0 && (
                                <div className="border border-gray-200/60 rounded-xl overflow-auto max-h-96 shadow-sm bg-white/50 backdrop-blur-sm">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gradient-to-r from-gray-50/50 to-white/50 sticky top-0">
                                            <tr>
                                                {Object.keys(importData[0]).filter(k => !k.startsWith('_')).map(key => (
                                                    <th key={key} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200/60">
                                                        {key}
                                                    </th>
                                                ))}
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200/60">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importData.map((row, idx) => {
                                                const valid = row._valid;
                                                return (
                                                    <tr key={idx} className={`border-b border-gray-100/60 ${valid ? 'hover:bg-emerald-50/30' : 'bg-rose-50/20'}`}>
                                                        {Object.keys(row).filter(k => !k.startsWith('_')).map(key => (
                                                            <td key={key} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                                                                {row[key] !== undefined && row[key] !== null ? String(row[key]) : ''}
                                                            </td>
                                                        ))}
                                                        <td className="px-3 py-2">
                                                            {valid
                                                                ? <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={12} /> Valid</span>
                                                                : <span className="flex items-center gap-1 text-rose-500 font-semibold"><XCircle size={12} /> Invalid</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center rounded-xl justify-between gap-3 px-6 py-4 border-t border-gray-200/60 shrink-0 bg-gradient-to-r from-gray-50/50 to-white/50">
                            <button onClick={downloadTemplate}
                                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition">
                                <Download size={12} /> Download sample template
                            </button>
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setShowImportModal(false); resetImport(); }}
                                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                    Cancel
                                </button>
                                <button onClick={handleImportSave} disabled={importLoading || importData.length === 0 || missingRequiredColumns || importData.filter(r => r._valid).length === 0}
                                    className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50">
                                    {importLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    <Save size={14} />
                                    {importMode === 'update'
                                        ? (importLoading ? 'Updating...' : 'Update All')
                                        : (importLoading ? 'Saving...' : 'Save All')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Import Result Popup ── */}
            {importResult && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-sm
                    ${importResult.skipped === 0
                                    ? "bg-emerald-50/80 border-emerald-200/60"
                                    : "bg-amber-50/80 border-amber-200/60"}`}>
                                {importResult.skipped === 0
                                    ? <BadgeCheck size={24} className="text-emerald-500" />
                                    : <AlertTriangle size={24} className="text-amber-500" />}
                            </div>
                            <h2 className="text-gray-800 font-bold text-base">Import Complete</h2>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                <span className="font-semibold text-emerald-600">{importResult.added}</span> {importResult.mode === 'update' ? 'seller(s) added/updated' : 'seller(s) added'}
                                {importResult.deleted > 0 && (
                                    <>, <span className="font-semibold text-rose-600">{importResult.deleted}</span> removed (not in file)</>
                                )}
                                {importResult.skipped > 0 && (
                                    <>, <span className="font-semibold text-amber-600">{importResult.skipped}</span> skipped</>
                                )}
                                .
                            </p>
                            {importResult.skipped > 0 && (
                                <p className="text-xs text-gray-400">See the details in the import window for why.</p>
                            )}
                        </div>
                        <button onClick={() => setImportResult(null)}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 active:scale-95">
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}