// src/pages/admin/Settings.jsx
import { useState, useEffect, useRef } from 'react';
import { getPrintSettings, fetchPrintSettings, savePrintSettings, DEFAULT_PRINT_SETTINGS } from "../../utils/printSettings";
import { fetchReceiptTemplate, saveReceiptTemplate, DEFAULT_RECEIPT_TEMPLATE } from "../../utils/receiptTemplate";
import {
    Settings, Type, Save,
    BadgeCheck, AlertTriangle, X,
    Check, Lock, Unlock, RefreshCw,
    Users, Building2, Upload, Languages, Percent, Truck, Eye,
    Home, FileText,
} from 'lucide-react';
import api from '../../api/axios';
import { useAppConfig } from '../../context/AppConfigContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTranslation } from 'react-i18next';

// ── All pages with their CRUD labels ─────────────────────────
const ALL_PAGES = [
    {
        groupKey: 'dashboard',
        pages: [
            { key: 'operator_dashboard', ops: ['C', 'R', 'U', 'D'] }
        ]
    },
    {
        groupKey: 'milkCollection',
        pages: [
            { key: 'milk_entry', ops: ['C', 'R', 'U', 'D'] },
            { key: 'walkin_sales', ops: ['C', 'R', 'U', 'D'] },
            { key: 'walkin_payments', ops: ['C', 'R', 'U', 'D'] },
            { key: 'named_buyers', ops: ['C', 'R', 'U', 'D'] },
            { key: 'tank_dispatch', ops: ['C', 'R', 'U', 'D'] },
            { key: 'owner_usage', ops: ['C', 'R', 'U', 'D'] },
        ],
    },
    {
        groupKey: 'sellersPayments',
        pages: [
            { key: 'seller_register', ops: ['C', 'R', 'U', 'D'] },
            { key: 'seller_payments', ops: ['C', 'R', 'U', 'D'] },
            { key: 'cash_advance', ops: ['C', 'R', 'U', 'D'] },
            { key: 'cash_deposit', ops: ['C', 'R', 'U', 'D'] },
        ],
    },
    {
        groupKey: 'products',
        pages: [
            { key: 'products', ops: ['C', 'R', 'U', 'D'] },
            { key: 'product_purchases', ops: ['C', 'R', 'U', 'D'] },
            { key: 'product_sales', ops: ['C', 'R', 'U', 'D'] },
        ],
    },
    {
        groupKey: 'reportsAnalytics',
        pages: [
            { key: 'sum_report', ops: ['R'] },
            { key: 'daily_collection', ops: ['R'] },
            { key: 'utpadak_bonus_register', ops: ['C', 'R', 'U', 'D'] },
            { key: 'gavali_bonus_register', ops: ['C', 'R', 'U', 'D'] },
        ],
    },
    {
        groupKey: 'rates',
        pages: [
            { key: 'rate_chart', ops: ['C', 'R', 'U', 'D'] },
            { key: 'premium_rates', ops: ['C', 'R', 'U', 'D'] },
        ],
    },
];

const buildDefaultAccess = () => {
    const acc = {};
    ALL_PAGES.forEach(group => {
        group.pages.forEach(page => {
            if (page.key === 'milk_entry') {
                acc[page.key] = { C: true, R: true, U: false, D: false };
            } else {
                const obj = {};
                page.ops.forEach(op => { obj[op] = true; });
                acc[page.key] = obj;
            }
        });
    });
    return acc;
};

const OP_COLORS = {
    C: { active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'bg-white text-gray-300 border-gray-200', label: 'Create' },
    R: { active: 'bg-blue-500 text-white border-blue-500', inactive: 'bg-white text-gray-300 border-gray-200', label: 'Read' },
    U: { active: 'bg-amber-500 text-white border-amber-500', inactive: 'bg-white text-gray-300 border-gray-200', label: 'Update' },
    D: { active: 'bg-rose-500 text-white border-rose-500', inactive: 'bg-white text-gray-300 border-gray-200', label: 'Delete' },
};

const TEXT_SIZES = [
    { key: 'sm', label: 'settings.textSm' },
    { key: 'base', label: 'settings.textMd' },
    { key: 'lg', label: 'settings.textLg' },
];

const LANGUAGES = [
    { key: 'en', label: 'English', native: 'English' },
    { key: 'mr', label: 'Marathi', native: 'मराठी' },
    { key: 'hi', label: 'Hindi', native: 'हिंदी' },
];

// Pages that can be hidden per-platform, independent of CRUD role permissions.
// Every role gets its OWN key, even for pages that look identical across
// roles (e.g. Milk Entry) — this is what makes toggling a page off for
// Operators independent from toggling it off for Admins. Keys here must
// match the page_key values AppLayout.dart / SellerDashboardPage.dart use.
const VISIBILITY_SECTIONS = [
    // ══════════════════════════ ADMIN ══════════════════════════
    {
        groupKey: 'adminDashboard',
        label: 'Dashboard',
        role: 'Admin',
        pages: [
            { key: 'admin_dashboard', label: 'Dashboard' },
        ],
    },
    {
        groupKey: 'administration',
        label: 'Administration',
        role: 'Admin',
        pages: [
            { key: 'admin_settings', label: 'Settings' },
            { key: 'admin_centres', label: 'Centres' },
            { key: 'admin_premium_rates', label: 'Premium Rates' },
            { key: 'admin_operators', label: 'Operators' },
            { key: 'admin_admin_list', label: 'Admin List' },
            { key: 'admin_port_settings', label: 'Port Settings' },
            { key: 'admin_commission_settings', label: 'Commission Settings' },
            { key: 'admin_clear_data', label: 'Clear All Data' },
        ],
    },
    {
        groupKey: 'adminSellersPayments',
        label: 'Sellers & Rates',
        role: 'Admin',
        pages: [
            { key: 'admin_seller_register', label: 'Sellers' },
            { key: 'admin_rate_chart', label: 'Rate Chart' },
            { key: 'admin_seller_payments', label: 'Seller Payments' },
        ],
    },
    {
        groupKey: 'adminMilkCollection',
        label: 'Milk Collection',
        role: 'Admin',
        pages: [
            { key: 'admin_milk_entry', label: 'Milk Entry' },
            { key: 'admin_utpadak_milk_entry', label: 'Utpadak Milk Entry' },
            { key: 'admin_gavali_milk_entry', label: 'Gavali Milk Entry' },
            { key: 'admin_owner_usage', label: 'Owner Usage' },
            { key: 'admin_tank_dispatch', label: 'Tank Dispatch' },
        ],
    },
    {
        groupKey: 'adminWalkinSales',
        label: 'Walk-in Sales',
        role: 'Admin',
        pages: [
            { key: 'admin_walkin_sales', label: 'Walk-in Sale' },
            { key: 'admin_walkin_payments', label: 'Walk-in Payments' },
            { key: 'admin_named_buyers', label: 'Named Buyers' },
            { key: 'admin_walkin_seller_report', label: 'Seller Report' },
            { key: 'admin_walkin_named_buyer_reports', label: 'Named Buyer Reports' },
            { key: 'admin_walkin_anon_reports', label: 'Anon Reports' },
        ],
    },
    {
        groupKey: 'adminProducts',
        label: 'Products',
        role: 'Admin',
        pages: [
            { key: 'admin_products', label: 'Catalogue' },
            { key: 'admin_product_purchases', label: 'Purchase' },
            { key: 'admin_product_sales', label: 'Sales' },
            { key: 'admin_product_purchase_payment', label: 'Product Purchase Payment' },
        ],
    },
    {
        groupKey: 'adminCattleFeed',
        label: 'Cattle Feed',
        role: 'Admin',
        pages: [
            { key: 'admin_cattle_feed_catalogue', label: 'Catalogue' },
            { key: 'admin_cattle_feed_purchase', label: 'Purchase' },
            { key: 'admin_cattle_feed_sales', label: 'Sales' },
            { key: 'admin_cattle_feed_purchase_payment', label: 'Cattlefeed Purchase Payment' },
        ],
    },
    {
        groupKey: 'adminFinance',
        label: 'Finance',
        role: 'Admin',
        pages: [
            { key: 'admin_cash_advance', label: 'Cash Advance' },
            { key: 'admin_cash_deposit', label: 'Cash Deposit' },
        ],
    },
    {
        groupKey: 'adminBonusRegister',
        label: 'Bonus Register',
        role: 'Admin',
        pages: [
            { key: 'admin_utpadak_bonus_register', label: 'Utpadak Bonus' },
            { key: 'admin_gavali_bonus_register', label: 'Gavali Bonus' },
        ],
    },
    {
        groupKey: 'adminReports',
        label: 'Reports',
        role: 'Admin',
        pages: [
            { key: 'admin_sum_report', label: 'Summary Report' },
            { key: 'admin_farmer_ledger', label: 'Farmer Ledger' },
        ],
    },
    {
        groupKey: 'adminExpenses',
        label: 'Expenses',
        role: 'Admin',
        pages: [
            { key: 'admin_expenses', label: 'Expenses' },
            { key: 'admin_expenses_report', label: 'Expenses Report' },
        ],
    },

    // ══════════════════════════ OPERATOR ══════════════════════════
    {
        groupKey: 'operatorDashboard',
        label: 'Dashboard',
        role: 'Operator',
        pages: [
            { key: 'operator_dashboard', label: 'Dashboard' },
        ],
    },
    {
        groupKey: 'operatorSettings',
        label: 'Settings',
        role: 'Operator',
        pages: [
            { key: 'operator_settings', label: 'Settings' },
        ],
    },
    {
        groupKey: 'operatorSellersPayments',
        label: 'Sellers & Rates',
        role: 'Operator',
        pages: [
            { key: 'operator_seller_register', label: 'Sellers' },
            { key: 'operator_rate_chart', label: 'Rate Chart' },
            { key: 'operator_seller_payments', label: 'Seller Payments' },
        ],
    },
    {
        groupKey: 'operatorMilkCollection',
        label: 'Milk Collection',
        role: 'Operator',
        pages: [
            { key: 'operator_milk_entry', label: 'Milk Entry' },
            { key: 'operator_owner_usage', label: 'Owner Usage' },
            { key: 'operator_tank_dispatch', label: 'Tank Dispatch' },
        ],
    },
    {
        groupKey: 'operatorWalkinSales',
        label: 'Walk-in Sales',
        role: 'Operator',
        pages: [
            { key: 'operator_walkin_sales', label: 'Walk-in Sale' },
            { key: 'operator_walkin_payments', label: 'Walk-in Payments' },
            { key: 'operator_named_buyers', label: 'Named Buyers' },
        ],
    },
    {
        groupKey: 'operatorProducts',
        label: 'Products',
        role: 'Operator',
        pages: [
            { key: 'operator_products', label: 'Catalogue' },
            { key: 'operator_product_purchases', label: 'Purchase' },
            { key: 'operator_product_sales', label: 'Sales' },
        ],
    },
    {
        groupKey: 'operatorFinance',
        label: 'Finance',
        role: 'Operator',
        pages: [
            { key: 'operator_cash_advance', label: 'Cash Advance' },
            { key: 'operator_cash_deposit', label: 'Cash Deposit' },
        ],
    },
    {
        groupKey: 'operatorReports',
        label: 'Reports',
        role: 'Operator',
        pages: [
            { key: 'operator_sum_report', label: 'Summary Report' },
        ],
    },

    // ══════════════════════════ FARMER ══════════════════════════
    {
        groupKey: 'farmerPortal',
        label: 'Farmer Portal',
        role: 'Farmer',
        pages: [
            { key: 'farmer_dashboard', label: 'Dashboard' },
            { key: 'farmer_settings', label: 'Settings' },
            { key: 'farmer_bills', label: 'My Milk Bills' },
            { key: 'farmer_finance', label: 'Advance & Deposit' },
            { key: 'farmer_milk_entries', label: 'My Milk Entries' },
            { key: 'farmer_cattle_feed', label: 'My Cattle Feed' },
            { key: 'farmer_product_purchases', label: 'My Product Purchases' },
        ],
    },
];

// Flattened lookup used for loading/saving, since the API deals in a flat
// { page_key: { web, flutter } } map regardless of section grouping.
const VISIBILITY_PAGES = VISIBILITY_SECTIONS.flatMap(section => section.pages);

// ── Saved-state defaults ──────────────────────────────────────
const SERVER_DEFAULTS = {
    appName: 'MilkApp',
    logoUrl: '',
    textSize: 'base',
    language: 'en',
    fatOnlyAutofill: false,
    fssaiCode: ''
};

function FontSizeInput({ value, onChange, min = 8, max = 40 }) {
    return (
        <label className="flex items-center gap-1.5 text-[10px] text-gray-400 shrink-0">
            <span>Size</span>
            <input
                type="number"
                min={min}
                max={max}
                step="0.5"
                value={value}
                onChange={e => onChange(Number(e.target.value) || min)}
                className="w-14 px-1.5 py-1 rounded-lg border border-gray-200/60 bg-white/50 text-xs text-gray-700 text-center
                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
            />
            <span>px</span>
        </label>
    );
}

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

export default function AdminSettings() {
    const { t } = useTranslation();
    const { updateConfig } = useAppConfig();

    const [appName, setAppName] = useState(SERVER_DEFAULTS.appName);
    const [logoUrl, setLogoUrl] = useState(SERVER_DEFAULTS.logoUrl);
    const [logoPreview, setLogoPreview] = useState(SERVER_DEFAULTS.logoUrl);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const [textSize, setTextSize] = useState(SERVER_DEFAULTS.textSize);
    const [language, setLanguage] = useState(SERVER_DEFAULTS.language);
    const [fatOnlyAutofill, setFatOnlyAutofill] = useState(SERVER_DEFAULTS.fatOnlyAutofill);
    const [fssaiCode, setFssaiCode] = useState(SERVER_DEFAULTS.fssaiCode);

    const [savedState, setSavedState] = useState(SERVER_DEFAULTS);

    const [operators, setOperators] = useState([]);
    const [selectedOp, setSelectedOp] = useState(null);
    const [opAccess, setOpAccess] = useState({});
    const [loadingOps, setLoadingOps] = useState(false);

    const [saving, setSaving] = useState(false);
    const [pageVisibility, setPageVisibility] = useState({});
    const [loadingVisibility, setLoadingVisibility] = useState(false);
    const [flash, setFlash] = useState(null);
    const [printerType, setPrinterType] = useState(DEFAULT_PRINT_SETTINGS.printerType);
    const [paperWidthMm, setPaperWidthMm] = useState(DEFAULT_PRINT_SETTINGS.paperWidthMm);
    const [autoPrint, setAutoPrint] = useState(DEFAULT_PRINT_SETTINGS.autoPrint ?? true);
    const [receiptTpl, setReceiptTpl] = useState(DEFAULT_RECEIPT_TEMPLATE);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startSettingsTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="app-identity"]',
                    popover: { title: t('settings.appIdentity'), description: t('settings.tour.appIdentity') },
                },
                {
                    element: '[data-tour="text-size"]',
                    popover: { title: t('settings.textSize'), description: t('settings.tour.textSize') },
                },
                {
                    element: '[data-tour="language"]',
                    popover: { title: t('settings.language'), description: t('settings.tour.language') },
                },
                {
                    element: '[data-tour="dispatch-settings"]',
                    popover: { title: t('settings.dispatchSettings'), description: t('settings.tour.dispatchSettings') },
                },
                {
                    element: '[data-tour="operator-access"]',
                    popover: { title: t('settings.operatorAccess'), description: t('settings.tour.operatorAccess') },
                },
                {
                    element: '[data-tour="save-btn"]',
                    popover: { title: t('actions.save'), description: t('settings.tour.save') },
                },
            ],
        });
        driverObj.drive();
    };

    // ── Load global settings ──────────────────────────────────
    useEffect(() => {
        Promise.all([
            api.get('/settings/global'),
            api.get('/settings/app'),
        ])
            .then(([globalRes, appRes]) => {
                const data = globalRes.data;
                const appData = appRes.data;
                const snap = {
                    appName: data.app_name || SERVER_DEFAULTS.appName,
                    logoUrl: data.logo_url || SERVER_DEFAULTS.logoUrl,
                    textSize: appData.text_size || SERVER_DEFAULTS.textSize,
                    language: appData.language || SERVER_DEFAULTS.language,
                    fatOnlyAutofill: data.fat_only_autofill === '1' || data.fat_only_autofill === true,
                };
                setAppName(snap.appName);
                setLogoUrl(snap.logoUrl);
                setLogoPreview(snap.logoUrl);
                setTextSize(snap.textSize);
                setLanguage(snap.language);
                setFatOnlyAutofill(snap.fatOnlyAutofill);
                setSavedState(snap);
            })
            .catch(() => { /* keep defaults */ });

        // Load FSSAI code
        api.get('/settings/dispatch')
            .then(({ data }) => {
                setFssaiCode(data.fssai_code || '');
            })
            .catch(() => { /* keep defaults */ });
    }, []);

    // ── Fetch operators ──────────────────────────────────────
    useEffect(() => {
        setLoadingOps(true);
        api.get('/operators')
            .then(({ data }) => setOperators(data))
            .catch(() => { })
            .finally(() => setLoadingOps(false));
    }, []);

    // ── Load page visibility ─────────────────────────────────
    useEffect(() => {
        setLoadingVisibility(true);
        api.get('/settings/page-visibility')
            .then(({ data }) => {
                const merged = {};
                VISIBILITY_PAGES.forEach(p => {
                    merged[p.key] = data[p.key] || { web: true, flutter: true };
                });
                setPageVisibility(merged);
            })
            .catch(() => {
                const merged = {};
                VISIBILITY_PAGES.forEach(p => { merged[p.key] = { web: true, flutter: true }; });
                setPageVisibility(merged);
            })
            .finally(() => setLoadingVisibility(false));
    }, []);

    // ── Load print (receipt) settings ─────────────────────────
    useEffect(() => {
        fetchPrintSettings().then(({ printerType, paperWidthMm, autoPrint }) => {
            setPrinterType(printerType);
            setPaperWidthMm(paperWidthMm);
            setAutoPrint(autoPrint ?? true);
        });
    }, []);

    // ── Load receipt template (was missing — meant font sizes and
    // every other receipt field silently reset to defaults on load) ──
    useEffect(() => {
        fetchReceiptTemplate().then(setReceiptTpl);
    }, []);

    // ── Load permissions for selected operator ──────────────
    useEffect(() => {
        if (!selectedOp) { setOpAccess({}); return; }
        api.get(`/settings/permissions/${selectedOp}`)
            .then(({ data }) => {
                const merged = buildDefaultAccess();
                Object.entries(data).forEach(([k, v]) => { merged[k] = v; });
                setOpAccess(merged);
            })
            .catch(() => setOpAccess(buildDefaultAccess()));
    }, [selectedOp]);

    // ── Logo handlers ────────────────────────────────────────
    const processLogoFile = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            showFlash('error', t('settings.logoTypeError')); return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showFlash('error', t('settings.logoSizeError')); return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setLogoPreview(ev.target.result);
            setLogoUrl(ev.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleLogoChange = (e) => {
        processLogoFile(e.target.files[0]);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processLogoFile(e.dataTransfer.files[0]);
    };

    // ── Access toggles ────────────────────────────────────────
    const toggleOp = (pageKey, op) => {
        setOpAccess(prev => ({
            ...prev,
            [pageKey]: { ...prev[pageKey], [op]: !prev[pageKey]?.[op] },
        }));
    };

    const toggleAllPage = (pageKey) => {
        const current = opAccess[pageKey];
        const allOn = current && Object.values(current).every(Boolean);
        const pageInfo = ALL_PAGES.flatMap(g => g.pages).find(p => p.key === pageKey);
        if (!pageInfo) return;
        const newObj = {};
        pageInfo.ops.forEach(op => { newObj[op] = !allOn; });
        setOpAccess(prev => ({ ...prev, [pageKey]: newObj }));
    };

    const toggleVisibility = (pageKey, platform) => {
        setPageVisibility(prev => ({
            ...prev,
            [pageKey]: { ...prev[pageKey], [platform]: !prev[pageKey]?.[platform] },
        }));
    };

    // ── Save ──────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            // Dairy-wide branding + business rules
            await api.post('/settings/global', {
                app_name: appName,
                logo_url: logoUrl,
                fat_only_autofill: fatOnlyAutofill ? '1' : '0',
            });

            // FSSAI code
            await api.post('/settings/dispatch', {
                fssai_code: fssaiCode,
            });

            // Personal preferences (this admin/operator only)
            await api.post('/settings/app', {
                text_size: textSize,
                language: language,
            });

            const newSnap = {
                appName,
                logoUrl,
                textSize,
                language,
                fatOnlyAutofill,
                fssaiCode
            };
            setSavedState(newSnap);

            updateConfig({ appName, logoUrl, textSize, language, fatOnlyAutofill });

            if (selectedOp) {
                await api.post(`/settings/permissions/${selectedOp}`, { access: opAccess });
            }

            await api.post('/settings/page-visibility', { visibility: pageVisibility });

            await savePrintSettings({ printerType, paperWidthMm, autoPrint });
            await saveReceiptTemplate(receiptTpl);

            showFlash('success', t('settings.savedSuccess'));
        } catch {
            showFlash('error', t('settings.savedError'));
        } finally {
            setSaving(false);
        }
    };

    // ── Reset ─────────────────────────────────────────────────
    const handleReset = () => {
        setAppName(savedState.appName);
        setLogoUrl(savedState.logoUrl);
        setLogoPreview(savedState.logoUrl);
        setTextSize(savedState.textSize);
        setLanguage(savedState.language);
        setFatOnlyAutofill(savedState.fatOnlyAutofill);
        setFssaiCode(SERVER_DEFAULTS.fssaiCode);
        setPrinterType(DEFAULT_PRINT_SETTINGS.printerType);
        setPaperWidthMm(DEFAULT_PRINT_SETTINGS.paperWidthMm);
        if (selectedOp) setOpAccess(buildDefaultAccess());
        showFlash('success', t('settings.resetSuccess'));
        const reset = {};
        VISIBILITY_PAGES.forEach(p => { reset[p.key] = { web: true, flutter: true }; });
        setPageVisibility(reset);
    };

    // ── Render permission grid ───────────────────────────────
    const renderAccessGrid = (pageKey, ops) => (
        <div className="flex items-center gap-1.5">
            {ops.map(op => {
                const active = opAccess[pageKey]?.[op] ?? false;
                const colors = OP_COLORS[op];
                return (
                    <button
                        key={op}
                        onClick={() => toggleOp(pageKey, op)}
                        title={colors.label}
                        className={`w-8 h-8 rounded-lg border text-[10px] font-bold transition-all duration-150 flex items-center justify-center
                            ${active ? colors.active : colors.inactive}`}
                    >
                        {op}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('settings.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('settings.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startSettingsTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('settings.startTour')}
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <RefreshCw size={15} /> {t('actions.resetDefaults')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            data-tour="save-btn"
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={15} />}
                            {saving ? t('actions.saving') : t('actions.save')}
                        </button>
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

                {/* ── App Identity ── */}
                <SectionCard title={t('settings.appIdentity')} icon={<Building2 size={16} className="text-white" />} data-tour="app-identity">
                    <div className="flex flex-col lg:flex-row gap-8">

                        {/* App Name */}
                        <div className="flex-1 min-w-0">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                {t('settings.appName')}
                            </label>
                            <input
                                type="text"
                                value={appName}
                                onChange={e => setAppName(e.target.value)}
                                placeholder={t('settings.appNamePlaceholder')}
                                maxLength={60}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-800 font-semibold text-sm
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm placeholder:font-normal placeholder:text-gray-300"
                            />
                            <p className="text-[11px] text-gray-400 mt-2">{t('settings.appNameHint')}</p>

                            {/* Live preview */}
                            <div className="mt-4 flex items-center gap-3 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-sm">
                                {logoPreview
                                    ? <img src={logoPreview} alt="logo" className="w-8 h-8 rounded-lg object-contain" />
                                    : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                                        <Building2 size={14} />
                                    </div>
                                }
                                <span className="text-sm font-bold text-gray-800 truncate">
                                    {appName || t('settings.appName')}
                                </span>
                                <span className="ml-auto text-[10px] text-gray-400 shrink-0">{t('settings.livePreview')}</span>
                            </div>
                        </div>

                        {/* Logo Upload */}
                        <div className="lg:w-72 shrink-0">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                {t('settings.appLogo')}
                            </label>

                            {logoPreview ? (
                                <div className="relative group flex flex-col items-center justify-center gap-3
                                    rounded-xl border-2 border-gray-200/60 bg-white/50 backdrop-blur-sm p-5 h-[140px] shadow-sm">
                                    <img
                                        src={logoPreview}
                                        alt="App logo"
                                        className="max-h-20 max-w-full object-contain rounded-lg"
                                    />
                                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-gray-800 hover:bg-gray-100 transition shadow-sm"
                                        >
                                            {t('actions.change')}
                                        </button>
                                        <button
                                            onClick={() => { setLogoPreview(''); setLogoUrl(''); }}
                                            className="px-3 py-1.5 bg-rose-500 rounded-lg text-xs font-semibold text-white hover:bg-rose-600 transition shadow-sm"
                                        >
                                            {t('actions.remove')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex flex-col items-center justify-center gap-2 h-[140px] rounded-xl border-2 border-dashed cursor-pointer transition-all
                                        ${isDragging
                                            ? 'border-gray-900 bg-gray-100/50 backdrop-blur-sm shadow-lg'
                                            : 'border-gray-200/60 bg-white/50 backdrop-blur-sm hover:border-gray-400 hover:bg-gray-50/50'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm
                                        ${isDragging ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gray-200/50'}`}>
                                        <Upload size={16} className={isDragging ? 'text-white' : 'text-gray-500'} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-semibold text-gray-600">
                                            {isDragging ? t('settings.logoDragging') : t('settings.logoDropHint')}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{t('settings.logoSizeHint')}</p>
                                    </div>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleLogoChange}
                            />
                            <p className="text-[11px] text-gray-400 mt-2">{t('settings.logoHint')}</p>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Text Size ── */}
                <SectionCard title={t('settings.textSize')} icon={<Type size={16} className="text-white" />} data-tour="text-size">
                    <div className="flex gap-3 flex-wrap">
                        {TEXT_SIZES.map(sz => (
                            <button
                                key={sz.key}
                                onClick={() => setTextSize(sz.key)}
                                className={`flex flex-col items-center gap-2 px-8 py-4 rounded-xl border-2 transition-all duration-150 min-w-[100px]
                                    ${textSize === sz.key
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                        : 'bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm'}`}
                            >
                                <span className={`font-bold ${sz.key === 'sm' ? 'text-xs' : sz.key === 'lg' ? 'text-base' : 'text-sm'}
                                    ${textSize === sz.key ? 'text-white' : 'text-gray-800'}`}>
                                    Aa
                                </span>
                                <span className="text-xs font-medium">{t(sz.label)}</span>
                                {textSize === sz.key && <Check size={12} className="text-emerald-400" />}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">{t('settings.textSizeHint')}</p>
                </SectionCard>

                {/* ── Language ── */}
                <SectionCard title={t('settings.language')} icon={<Languages size={16} className="text-white" />} data-tour="language">
                    <div className="flex gap-3 flex-wrap">
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.key}
                                onClick={() => setLanguage(lang.key)}
                                className={`flex flex-col items-center gap-1.5 px-6 py-4 rounded-xl border-2 transition-all duration-150 min-w-[110px]
                                    ${language === lang.key
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                        : 'bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm'}`}
                            >
                                <span className={`text-lg font-bold ${language === lang.key ? 'text-white' : 'text-gray-800'}`}>
                                    {lang.native}
                                </span>
                                <span className="text-xs font-medium">{lang.label}</span>
                                {language === lang.key && <Check size={12} className="text-emerald-400" />}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">{t('settings.languageHint')}</p>
                </SectionCard>

                {/* ── Fat-Only Rate Auto-Fill ── */}
                <SectionCard title={t('settings.fatOnlyAutofill.title')} icon={<Percent size={16} className="text-white" />} data-tour="fat-only-autofill">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="max-w-lg">
                            <p
                                className="text-sm text-gray-700"
                                dangerouslySetInnerHTML={{ __html: t('settings.fatOnlyAutofill.description') }}
                            />
                            <p
                                className="text-[11px] text-gray-400 mt-2"
                                dangerouslySetInnerHTML={{ __html: t('settings.fatOnlyAutofill.hint') }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setFatOnlyAutofill(v => !v)}
                            className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors shrink-0 shadow-sm
                                ${fatOnlyAutofill ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform
                                ${fatOnlyAutofill ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {fatOnlyAutofill && (
                        <div className="mt-4 flex items-center gap-2 bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-xl px-4 py-2.5 text-xs text-amber-700 shadow-sm">
                            <AlertTriangle size={13} /> {t('settings.fatOnlyAutofill.activeNotification')}
                        </div>
                    )}
                </SectionCard>

                {/* ── Dispatch Settings - FSSAI Code Only ── */}
                <SectionCard
                    title={t('settings.dispatchSettings')}
                    icon={<Truck size={16} className="text-white" />}
                    data-tour="dispatch-settings"
                >
                    <div className="max-w-md">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {t('settings.fssaiCode')}
                        </label>
                        <input
                            type="text"
                            value={fssaiCode}
                            onChange={e => setFssaiCode(e.target.value)}
                            placeholder="e.g. 11111111111111"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-800 font-semibold text-sm
                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm placeholder:font-normal placeholder:text-gray-300"
                        />
                        <p className="text-[11px] text-gray-400 mt-2">{t('settings.fssaiCodeHint')}</p>
                    </div>
                </SectionCard>

                {/* ── Receipt Printer ── */}
                <SectionCard
                    title="Receipt Printer"
                    icon={<Truck size={16} className="text-white" />}
                    data-tour="print-settings"
                >
                    <div className="flex flex-col gap-5 max-w-xl">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Printer Type
                            </label>
                            <div className="flex gap-3">
                                {[
                                    { key: 'thermal', label: 'Thermal Roll' },
                                    { key: 'a4', label: 'A4 Sheet' },
                                ].map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setPrinterType(key)}
                                        className={`px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150
                                            ${printerType === key
                                                ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                                : 'bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {printerType === 'thermal' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    Paper Width
                                </label>
                                <div className="flex items-center gap-3">
                                    {[58, 80].map((w) => (
                                        <button
                                            key={w}
                                            type="button"
                                            onClick={() => setPaperWidthMm(w)}
                                            className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150
                                                ${paperWidthMm === w
                                                    ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                                    : 'bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm'}`}
                                        >
                                            {w}mm
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min={40}
                                        max={120}
                                        value={paperWidthMm}
                                        onChange={(e) => setPaperWidthMm(Number(e.target.value) || 80)}
                                        className="w-24 px-3 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-800 font-semibold text-sm text-center
                                            focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-400 mt-2">
                                    Match this to your roll's actual width (printed on the box — 58mm or 80mm are the two common sizes). This is applied to receipt printing so it doesn't print with extra blank space or get cut off.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
                            <div>
                                <label className="text-sm text-gray-700">Auto-print receipt after recording a sale</label>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    Skips the manual "Print Receipt" click — the receipt opens the print dialog automatically right after Save. The browser's print dialog will still appear once; that's a browser security limit, not a setting.
                                </p>
                            </div>
                            <button type="button" onClick={() => setAutoPrint(v => !v)}
                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shrink-0 shadow-sm ${autoPrint ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${autoPrint ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Receipt Format ── */}
                <SectionCard title="Receipt Format" icon={<FileText size={16} className="text-white" />} data-tour="receipt-format">
                    <p className="text-[11px] text-gray-400 mb-5">
                        Controls what appears on every printed receipt — Cattle Feed sales, Product sales, and any future receipt type all use this same format.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Fields */}
                        <div className="flex flex-col gap-4">

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Transaction ID prefix
                                </label>
                                <input type="text" value={receiptTpl.txnPrefix} maxLength={10}
                                    onChange={e => setReceiptTpl(p => ({ ...p, txnPrefix: e.target.value.toUpperCase() }))}
                                    placeholder="KDM"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    IDs are generated as PREFIX/FinancialYear/Number, e.g. "{receiptTpl.txnPrefix || 'KDM'}/2627/1". The financial year and running number are added automatically.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Product label (currently "Feed")
                                </label>
                                <input type="text" value={receiptTpl.productLabel}
                                    onChange={e => setReceiptTpl(p => ({ ...p, productLabel: e.target.value }))}
                                    placeholder="Feed"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Replaces "Feed" on the sales page and receipts (e.g. change to "Product").
                                </p>
                            </div>

                           <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show top symbol (e.g. श्री)</label>
                                <div className="flex items-center gap-3">
                                    {receiptTpl.showTopSymbol && (
                                        <FontSizeInput value={receiptTpl.topSymbolFontSize}
                                            onChange={v => setReceiptTpl(p => ({ ...p, topSymbolFontSize: v }))} />
                                    )}
                                    <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showTopSymbol: !p.showTopSymbol }))}
                                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showTopSymbol ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                        <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showTopSymbol ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                            {receiptTpl.showTopSymbol && (
                                <input type="text" value={receiptTpl.topSymbolText}
                                    onChange={e => setReceiptTpl(p => ({ ...p, topSymbolText: e.target.value }))}
                                    placeholder="श्री"
                                    className="px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            )}

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show app/dairy name</label>
                                <div className="flex items-center gap-3">
                                    {receiptTpl.showAppName && (
                                        <FontSizeInput value={receiptTpl.appNameFontSize}
                                            onChange={v => setReceiptTpl(p => ({ ...p, appNameFontSize: v }))} />
                                    )}
                                    <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showAppName: !p.showAppName }))}
                                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showAppName ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                        <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showAppName ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 -mt-2">Uses the app name set in "App Identity" above.</p>

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show centre name</label>
                                <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showCentreName: !p.showCentreName }))}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showCentreName ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showCentreName ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {receiptTpl.showCentreName && (
                                <input type="text" value={receiptTpl.centreNameOverride}
                                    onChange={e => setReceiptTpl(p => ({ ...p, centreNameOverride: e.target.value }))}
                                    placeholder="Leave blank to use your registered centre name"
                                    className="px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            )}

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show transaction ID</label>
                                <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showTransactionId: !p.showTransactionId }))}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showTransactionId ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showTransactionId ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {receiptTpl.showTransactionId && (
                                <input type="text" value={receiptTpl.transactionIdLabel}
                                    onChange={e => setReceiptTpl(p => ({ ...p, transactionIdLabel: e.target.value }))}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            )}

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show date &amp; time row</label>
                                <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showDateTime: !p.showDateTime }))}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showDateTime ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showDateTime ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show seller code next to name</label>
                                <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showSellerCode: !p.showSellerCode }))}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showSellerCode ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showSellerCode ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Footer text</label>
                                <input type="text" value={receiptTpl.footerText}
                                    onChange={e => setReceiptTpl(p => ({ ...p, footerText: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Item table text</label>
                                <div className="flex items-center gap-3">
                                    <FontSizeInput value={receiptTpl.tableHeaderFontSize}
                                        onChange={v => setReceiptTpl(p => ({ ...p, tableHeaderFontSize: v }))} />
                                    <span className="text-[10px] text-gray-300">header</span>
                                    <FontSizeInput value={receiptTpl.tableBodyFontSize}
                                        onChange={v => setReceiptTpl(p => ({ ...p, tableBodyFontSize: v }))} />
                                    <span className="text-[10px] text-gray-300">rows</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Grand total row</label>
                                <FontSizeInput value={receiptTpl.grandTotalFontSize}
                                    onChange={v => setReceiptTpl(p => ({ ...p, grandTotalFontSize: v }))} />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show GST line</label>
                                <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showGst: !p.showGst }))}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showGst ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showGst ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {receiptTpl.showGst && (
                                <input type="text" value={receiptTpl.gstText}
                                    onChange={e => setReceiptTpl(p => ({ ...p, gstText: e.target.value }))}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            )}

                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-gray-700">Show signatory line</label>
                                <button type="button" onClick={() => setReceiptTpl(p => ({ ...p, showSignatory: !p.showSignatory }))}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm ${receiptTpl.showSignatory ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${receiptTpl.showSignatory ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {receiptTpl.showSignatory && (
                                <input type="text" value={receiptTpl.signatoryText}
                                    onChange={e => setReceiptTpl(p => ({ ...p, signatoryText: e.target.value }))}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            )}
                        </div>

                        {/* Live preview */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Preview</label>
                            <div className="rounded-xl border border-gray-200/60 bg-white p-5 shadow-sm text-[13px]" style={{ fontFamily: 'Arial, sans-serif' }}>
                                <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 12 }}>
                                    {receiptTpl.showTopSymbol && <div style={{ fontSize: receiptTpl.topSymbolFontSize, fontWeight: 700 }}>{receiptTpl.topSymbolText}</div>}
                                    {receiptTpl.showAppName && <div style={{ fontSize: receiptTpl.appNameFontSize, fontWeight: 700, marginTop: 2 }}>{appName || 'MilkApp'}</div>}
                                    {receiptTpl.showCentreName && <div style={{ fontSize: receiptTpl.centreNameFontSize, color: '#555', marginTop: 2 }}>{receiptTpl.centreNameOverride || 'Your Centre Name'}</div>}
                                </div>
                                {receiptTpl.showTransactionId && (
                                    <div style={{ textAlign: 'center', fontSize: receiptTpl.transactionIdFontSize, color: '#666', marginBottom: 10 }}>
                                        {receiptTpl.transactionIdLabel}: {receiptTpl.txnPrefix || 'KDM'}/2627/1
                                    </div>
                                )}
                                {receiptTpl.showDateTime && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: receiptTpl.dateTimeFontSize, borderBottom: '1px dashed #ddd', paddingBottom: 6, marginBottom: 10 }}>
                                        <span>23/08/2026</span><span>10:45 AM</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: receiptTpl.sellerNameFontSize, marginBottom: 12 }}>
                                    <span style={{ fontWeight: 600 }}>Ramesh Kumar Patil</span>
                                    {receiptTpl.showSellerCode && <span style={{ fontSize: receiptTpl.sellerCodeFontSize, color: '#666' }}>SC-001</span>}
                                </div>
                                <div style={{ borderTop: '1px dashed #ccc', paddingTop: 10, fontSize: receiptTpl.tableBodyFontSize, color: '#999', textAlign: 'center' }}>[ item table here ]</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: receiptTpl.footerFontSize, color: '#666', marginTop: 14, paddingTop: 8, borderTop: '1px solid #eee' }}>
                                    <span>{receiptTpl.footerText}</span>
                                    {receiptTpl.showGst && <span>{receiptTpl.gstText}</span>}
                                </div>
                                {receiptTpl.showSignatory && (
                                    <div style={{ textAlign: 'right', fontSize: receiptTpl.signatoryFontSize, marginTop: 20, paddingTop: 6, borderTop: '1px solid #111', width: 140, marginLeft: 'auto' }}>
                                        {receiptTpl.signatoryText}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Per-Operator Access ── */}
                <SectionCard
                    title={t('settings.operatorAccess')}
                    icon={<Users size={16} className="text-white" />}
                    data-tour="operator-access"
                >
                    <div className="mb-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {t('settings.selectOperator')}
                        </p>
                        {loadingOps ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                {t('settings.loadingOperators')}
                            </div>
                        ) : operators.length === 0 ? (
                            <p className="text-sm text-gray-400">{t('settings.noOperators')}</p>
                        ) : (
                            <div className="flex gap-2 flex-wrap">
                                {operators.map(op => (
                                    <button
                                        key={op.operator_id}
                                        onClick={() => setSelectedOp(
                                            selectedOp === op.operator_id ? null : op.operator_id
                                        )}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all duration-150
                                            ${selectedOp === op.operator_id
                                                ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                                : 'bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-400 hover:bg-gray-50/50 shadow-sm'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                            ${selectedOp === op.operator_id ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                                            {op.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium">{op.name}</span>
                                        {!op.is_active && (
                                            <span className="text-[10px] text-gray-400">({t('status.inactive')})</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedOp ? (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('settings.accessFor')}: <span className="text-gray-800 normal-case">
                                        {operators.find(o => o.operator_id === selectedOp)?.name}
                                    </span>
                                </p>
                                <button
                                    onClick={() => setOpAccess(buildDefaultAccess())}
                                    className="text-xs text-gray-400 hover:text-gray-600 underline transition"
                                >
                                    {t('settings.resetToDefaults')}
                                </button>
                            </div>

                            <div className="flex flex-col gap-5">
                                {ALL_PAGES.map(group => (
                                    <div key={group.groupKey}>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            {t(`settings.permissions.groups.${group.groupKey}`)}
                                        </p>
                                        <div className="rounded-xl border border-gray-200/60 bg-white/30 backdrop-blur-sm overflow-hidden shadow-sm">
                                            {group.pages.map((page, idx) => {
                                                const current = opAccess[page.key] || {};
                                                const allOn = page.ops.every(op => current[op]);
                                                return (
                                                    <div
                                                        key={page.key}
                                                        className={`flex items-center justify-between px-4 py-3
                                                            ${idx !== group.pages.length - 1 ? 'border-b border-gray-200/60' : ''}
                                                            hover:bg-gray-50/50 transition`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleAllPage(page.key)}
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all duration-150 shrink-0
                                                                    ${allOn
                                                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 text-white shadow-sm'
                                                                        : 'bg-white/60 backdrop-blur-sm border-gray-200/60 text-gray-300 hover:border-gray-400'}`}
                                                                title={allOn ? t('settings.revokeAll') : t('settings.grantAll')}
                                                            >
                                                                {allOn ? <Unlock size={12} /> : <Lock size={12} />}
                                                            </button>
                                                            <span className="text-sm font-medium text-gray-700">
                                                                {t(`settings.permissions.pages.${page.key}`)}
                                                            </span>
                                                        </div>
                                                        {renderAccessGrid(page.key, page.ops)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-300 gap-2">
                            <Users size={28} />
                            <p className="text-sm">{t('settings.selectOperatorHint')}</p>
                        </div>
                    )}
                </SectionCard>

                {/* ── Page Visibility (Flutter/Web, grouped by portal/role) ── */}
                <SectionCard
                    title="Page Visibility"
                    icon={<Eye size={16} className="text-white" />}
                    data-tour="page-visibility"
                >
                    <p className="text-[11px] text-gray-400 mb-5">
                        Turn a page off here and it disappears for every user in that role — regardless of
                        individual operator permissions. The "Flutter" toggle controls the mobile app; the
                        "Web" toggle controls this dashboard. Sections below match the sidebar groups shown
                        to each portal.
                    </p>
                    {loadingVisibility ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                            {t('settings.loadingOperators')}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {VISIBILITY_SECTIONS.map(section => (
                                <div key={section.groupKey}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            {section.label}
                                        </p>
                                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md
                                            ${section.role === 'Admin'
                                                ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm'
                                                : section.role === 'Farmer'
                                                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm'
                                                    : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm'}`}>
                                            {section.role}
                                        </span>
                                    </div>
                                    <div className="rounded-xl border border-gray-200/60 bg-white/30 backdrop-blur-sm overflow-hidden shadow-sm">
                                        {section.pages.map((page, idx) => {
                                            const v = pageVisibility[page.key] || { web: true, flutter: true };
                                            return (
                                                <div
                                                    key={page.key}
                                                    className={`flex items-center justify-between px-4 py-3
                                                        ${idx !== section.pages.length - 1 ? 'border-b border-gray-200/60' : ''}
                                                        hover:bg-gray-50/50 transition`}
                                                >
                                                    <span className="text-sm font-medium text-gray-700">{page.label}</span>
                                                    <div className="flex items-center gap-5">
                                                        <label className="flex items-center gap-2 text-xs text-gray-500">
                                                            Web
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleVisibility(page.key, 'web')}
                                                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm
                                                                    ${v.web ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                            >
                                                                <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform
                                                                    ${v.web ? 'translate-x-6' : 'translate-x-1'}`} />
                                                            </button>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-xs text-gray-500">
                                                            Flutter
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleVisibility(page.key, 'flutter')}
                                                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shadow-sm
                                                                    ${v.flutter ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                            >
                                                                <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform
                                                                    ${v.flutter ? 'translate-x-6' : 'translate-x-1'}`} />
                                                            </button>
                                                        </label>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* ── Save footer ── */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                    >
                        {saving
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Save size={16} />}
                        {saving ? t('actions.saving') : t('actions.saveAll')}
                    </button>
                </div>

            </main>
        </div>
    );
}