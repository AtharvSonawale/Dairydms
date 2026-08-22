// src/pages/farmer/Settings.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings, Type, Save,
    BadgeCheck, AlertTriangle, X,
    Check, Languages, Home, Droplets
} from 'lucide-react';
import api from '../../api/axios';
import { useAppConfig } from '../../context/AppConfigContext';

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

const SERVER_DEFAULTS = { textSize: 'base', language: 'en' };

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

function StatCard({ label, value, icon, color }) {
    const colorMap = {
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        gray: "from-gray-50 to-gray-100/50 border-gray-200/60 text-gray-700",
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color] || colorMap.gray} shadow-sm p-4 flex items-center gap-3`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">{icon}</div>
            <div className="relative z-10 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-1">{value}</p>
            </div>
        </div>
    );
}

export default function FarmerSettings() {
    const { t } = useTranslation();
    const { updateConfig } = useAppConfig();

    const [textSize, setTextSize] = useState(SERVER_DEFAULTS.textSize);
    const [language, setLanguage] = useState(SERVER_DEFAULTS.language);
    const [savedState, setSavedState] = useState(SERVER_DEFAULTS);

    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Load this farmer's own preferences ──
    useEffect(() => {
        api.get('/settings/app')
            .then(({ data }) => {
                const snap = {
                    textSize: data.text_size || SERVER_DEFAULTS.textSize,
                    language: data.language || SERVER_DEFAULTS.language,
                };
                setTextSize(snap.textSize);
                setLanguage(snap.language);
                setSavedState(snap);
            })
            .catch(() => { /* keep defaults */ });
    }, []);

    // ── Save ──────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/settings/app', {
                text_size: textSize,
                language: language,
            });

            setSavedState({ textSize, language });
            updateConfig({ textSize, language });

            showFlash('success', t('settings.savedSuccess'));
        } catch {
            showFlash('error', t('settings.savedError'));
        } finally {
            setSaving(false);
        }
    };

    // ── Reset ─────────────────────────────────────────────────
    const handleReset = () => {
        setTextSize(savedState.textSize);
        setLanguage(savedState.language);
        showFlash('success', t('settings.resetSuccess'));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('settings.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('settings.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 text-xs font-bold hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <X size={15} /> {t('actions.resetDefaults')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-200
                                ${saving ? "bg-gray-300 cursor-not-allowed shadow-gray-300/30" : "bg-gradient-to-br from-gray-900 to-gray-800 shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 active:scale-95"}`}
                        >
                            {saving
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={15} />}
                            {saving ? t('actions.saving') : t('actions.save')}
                        </button>
                    </div>
                </div>

                {/* ── Stats Bar ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <StatCard
                        label={t('settings.currentTextSize', { defaultValue: 'Text Size' })}
                        value={TEXT_SIZES.find(s => s.key === textSize)?.label ? t(TEXT_SIZES.find(s => s.key === textSize).label) : textSize}
                        icon={<Type size={16} />}
                        color="blue"
                    />
                    <StatCard
                        label={t('settings.currentLanguage', { defaultValue: 'Language' })}
                        value={LANGUAGES.find(l => l.key === language)?.native || language}
                        icon={<Languages size={16} />}
                        color="emerald"
                    />
                    <StatCard
                        label={t('settings.status', { defaultValue: 'Status' })}
                        value={savedState.textSize === textSize && savedState.language === language ? t('settings.saved', { defaultValue: 'Saved' }) : t('settings.unsaved', { defaultValue: 'Unsaved changes' })}
                        icon={savedState.textSize === textSize && savedState.language === language ? <BadgeCheck size={16} /> : <AlertTriangle size={16} />}
                        color={savedState.textSize === textSize && savedState.language === language ? "emerald" : "amber"}
                    />
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold backdrop-blur-sm shadow-sm
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

                {/* ── Text Size ── */}
                <SectionCard title={t('settings.textSize')} icon={<Type size={16} className="text-white" />}>
                    <div className="flex gap-4 flex-wrap">
                        {TEXT_SIZES.map(sz => (
                            <button
                                key={sz.key}
                                onClick={() => setTextSize(sz.key)}
                                className={`relative flex flex-col items-center gap-2 px-8 py-5 rounded-2xl border-2 transition-all duration-200 min-w-[110px]
                                    ${textSize === sz.key
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-700 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                        : 'bg-white/80 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-300/80 hover:shadow-md'}`}
                            >
                                <span className={`font-bold ${sz.key === 'sm' ? 'text-xs' : sz.key === 'lg' ? 'text-base' : 'text-sm'}
                                    ${textSize === sz.key ? 'text-white' : 'text-gray-800'}`}>
                                    Aa
                                </span>
                                <span className="text-xs font-bold">{t(sz.label)}</span>
                                {textSize === sz.key && (
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <Check size={10} className="text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-200/60 flex items-center gap-2">
                        <BadgeCheck size={12} className="text-emerald-500" />
                        {t('settings.textSizeHint')}
                    </p>
                </SectionCard>

                {/* ── Language ── */}
                <SectionCard title={t('settings.language')} icon={<Languages size={16} className="text-white" />}>
                    <div className="flex gap-4 flex-wrap">
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.key}
                                onClick={() => setLanguage(lang.key)}
                                className={`relative flex flex-col items-center gap-1.5 px-6 py-5 rounded-2xl border-2 transition-all duration-200 min-w-[120px]
                                    ${language === lang.key
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-700 border-gray-900 text-white shadow-lg shadow-gray-900/30'
                                        : 'bg-white/80 backdrop-blur-sm border-gray-200/60 text-gray-700 hover:border-gray-300/80 hover:shadow-md'}`}
                            >
                                <span className={`text-xl font-bold ${language === lang.key ? 'text-white' : 'text-gray-800'}`}>
                                    {lang.native}
                                </span>
                                <span className="text-xs font-bold">{lang.label}</span>
                                {language === lang.key && (
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <Check size={10} className="text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-200/60 flex items-center gap-2">
                        <BadgeCheck size={12} className="text-emerald-500" />
                        {t('settings.languageHint')}
                    </p>
                </SectionCard>

                {/* ── Save footer ── */}
                <div className="flex justify-end pt-2 border-t border-gray-200/60">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-200
                            ${saving ? "bg-gray-300 cursor-not-allowed shadow-gray-300/30" : "bg-gradient-to-br from-gray-900 to-gray-800 shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 active:scale-95"}`}
                    >
                        {saving
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Save size={15} />}
                        {saving ? t('actions.saving') : t('actions.saveAll')}
                    </button>
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('settings.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.farmer', { defaultValue: 'Farmer' })}</strong></span>
                    <span>· {t('settings.footerSettings', { defaultValue: 'Settings saved locally' })}</span>
                </div>

            </main>
        </div>
    );
}