// src/pages/admin/Settings.jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings, Type, Save,
    BadgeCheck, AlertTriangle, X,
    Check, Lock, Unlock, RefreshCw,
    Users, Building2, Upload, Languages, Percent, Truck
} from 'lucide-react';
import api from '../../api/axios';
import { useAppConfig } from '../../context/AppConfigContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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

// ── Saved-state defaults ──────────────────────────────────────
const SERVER_DEFAULTS = {
    appName: 'MilkApp',
    logoUrl: '',
    textSize: 'base',
    language: 'en',
    fatOnlyAutofill: false,
    fssaiCode: '11521040000016'
};

function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" {...rest}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                    {icon}
                </div>
                <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
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
    const [flash, setFlash] = useState(null);

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
        api.get('/settings/global')
            .then(({ data }) => {
                const snap = {
                    appName: data.app_name || SERVER_DEFAULTS.appName,
                    logoUrl: data.logo_url || SERVER_DEFAULTS.logoUrl,
                    textSize: data.text_size || SERVER_DEFAULTS.textSize,
                    language: data.language || SERVER_DEFAULTS.language,
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
                setFssaiCode(data.fssai_code || SERVER_DEFAULTS.fssaiCode);
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
        if (selectedOp) setOpAccess(buildDefaultAccess());
        showFlash('success', t('settings.resetSuccess'));
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
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Settings size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('settings.title')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">{t('settings.subtitle')}</p>
                        </div>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-xs font-medium ml-1">
                            {t('settings.adminOnly')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={startSettingsTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> {t('settings.startTour')}
                        </button>
                        <button
                            onClick={handleReset}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                        >
                            <RefreshCw size={13} /> {t('actions.resetDefaults')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            data-tour="save-btn"
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={13} />}
                            {saving ? t('actions.saving') : t('actions.save')}
                        </button>
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border border-rose-200 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* ── App Identity ── */}
                <SectionCard title={t('settings.appIdentity')} icon={<Building2 size={15} className="text-white" />} data-tour="app-identity">
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
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-800 font-semibold text-sm
                                    focus:outline-none focus:border-gray-900 transition placeholder:font-normal placeholder:text-gray-300"
                            />
                            <p className="text-[11px] text-gray-400 mt-2">{t('settings.appNameHint')}</p>

                            {/* Live preview */}
                            <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                {logoPreview
                                    ? <img src={logoPreview} alt="logo" className="w-8 h-8 rounded-lg object-contain" />
                                    : <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
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
                                    rounded-xl border-2 border-gray-200 bg-gray-50 p-5 h-[140px]">
                                    <img
                                        src={logoPreview}
                                        alt="App logo"
                                        className="max-h-20 max-w-full object-contain rounded-lg"
                                    />
                                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-gray-800 hover:bg-gray-100 transition"
                                        >
                                            {t('actions.change')}
                                        </button>
                                        <button
                                            onClick={() => { setLogoPreview(''); setLogoUrl(''); }}
                                            className="px-3 py-1.5 bg-rose-500 rounded-lg text-xs font-semibold text-white hover:bg-rose-600 transition"
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
                                            ? 'border-gray-900 bg-gray-100'
                                            : 'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
                                        ${isDragging ? 'bg-gray-900' : 'bg-gray-200'}`}>
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
                <SectionCard title={t('settings.textSize')} icon={<Type size={15} className="text-white" />} data-tour="text-size">
                    <div className="flex gap-3 flex-wrap">
                        {TEXT_SIZES.map(sz => (
                            <button
                                key={sz.key}
                                onClick={() => setTextSize(sz.key)}
                                className={`flex flex-col items-center gap-2 px-8 py-4 rounded-xl border-2 transition-all duration-150 min-w-[100px]
                                    ${textSize === sz.key
                                        ? 'bg-gray-900 border-gray-900 text-white'
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'}`}
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
                <SectionCard title={t('settings.language')} icon={<Languages size={15} className="text-white" />} data-tour="language">
                    <div className="flex gap-3 flex-wrap">
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.key}
                                onClick={() => setLanguage(lang.key)}
                                className={`flex flex-col items-center gap-1.5 px-6 py-4 rounded-xl border-2 transition-all duration-150 min-w-[110px]
                                    ${language === lang.key
                                        ? 'bg-gray-900 border-gray-900 text-white'
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'}`}
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
                <SectionCard title={t('settings.fatOnlyAutofill.title')} icon={<Percent size={15} className="text-white" />} data-tour="fat-only-autofill">
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
                            className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors shrink-0
                                ${fatOnlyAutofill ? 'bg-emerald-500' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform
                                ${fatOnlyAutofill ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {fatOnlyAutofill && (
                        <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                            <AlertTriangle size={13} /> {t('settings.fatOnlyAutofill.activeNotification')}
                        </div>
                    )}
                </SectionCard>

                {/* ── Dispatch Settings - FSSAI Code Only ── */}
                <SectionCard
                    title={t('settings.dispatchSettings')}
                    icon={<Truck size={15} className="text-white" />}
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
                            placeholder="11521040000016"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-800 font-semibold text-sm
                                focus:outline-none focus:border-gray-900 transition placeholder:font-normal placeholder:text-gray-300"
                        />
                        <p className="text-[11px] text-gray-400 mt-2">{t('settings.fssaiCodeHint')}</p>
                    </div>
                </SectionCard>

                {/* ── Per-Operator Access ── */}
                <SectionCard
                    title={t('settings.operatorAccess')}
                    icon={<Users size={15} className="text-white" />}
                    data-tour="operator-access"
                >
                    <div className="mb-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {t('settings.selectOperator')}
                        </p>
                        {loadingOps ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-4 h-4 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
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
                                                ? 'bg-gray-900 border-gray-900 text-white'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'}`}
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
                                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                                            {group.pages.map((page, idx) => {
                                                const current = opAccess[page.key] || {};
                                                const allOn = page.ops.every(op => current[op]);
                                                return (
                                                    <div
                                                        key={page.key}
                                                        className={`flex items-center justify-between px-4 py-3
                                                            ${idx !== group.pages.length - 1 ? 'border-b border-gray-50' : ''}
                                                            hover:bg-gray-50/50 transition`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleAllPage(page.key)}
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all duration-150 shrink-0
                                                                    ${allOn
                                                                        ? 'bg-gray-900 border-gray-900 text-white'
                                                                        : 'bg-white border-gray-200 text-gray-300 hover:border-gray-400'}`}
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

                {/* ── Save footer ── */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl bg-black text-white hover:bg-gray-800 transition disabled:opacity-50 shadow-md shadow-black/10"
                    >
                        {saving
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Save size={14} />}
                        {saving ? t('actions.saving') : t('actions.saveAll')}
                    </button>
                </div>

            </main>
        </div>
    );
}