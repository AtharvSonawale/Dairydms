// src/pages/operator/Settings.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings, Type, Save,
    BadgeCheck, AlertTriangle, X,
    Check, Languages, Percent
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

const SERVER_DEFAULTS = { textSize: 'base', language: 'en', fatOnlyAutofill: false };

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

export default function OperatorSettings() {
    const { t } = useTranslation();
    const { appName, logoUrl, updateConfig } = useAppConfig();

    const [textSize, setTextSize] = useState(SERVER_DEFAULTS.textSize);
    const [language, setLanguage] = useState(SERVER_DEFAULTS.language);
    const [fatOnlyAutofill, setFatOnlyAutofill] = useState(SERVER_DEFAULTS.fatOnlyAutofill);
    const [savedState, setSavedState] = useState(SERVER_DEFAULTS);

    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Load this operator's own preferences + the dairy's fat-autofill rule ──
    useEffect(() => {
        api.get('/settings/app')
            .then(({ data }) => {
                const snap = {
                    textSize: data.text_size || SERVER_DEFAULTS.textSize,
                    language: data.language || SERVER_DEFAULTS.language,
                };
                setTextSize(snap.textSize);
                setLanguage(snap.language);
                setSavedState(prev => ({ ...prev, ...snap }));
            })
            .catch(() => { /* keep defaults */ });

        api.get('/settings/global')
            .then(({ data }) => {
                const fat = data.fat_only_autofill === '1' || data.fat_only_autofill === true;
                setFatOnlyAutofill(fat);
                setSavedState(prev => ({ ...prev, fatOnlyAutofill: fat }));
            })
            .catch(() => { /* keep defaults */ });
    }, []);

    // ── Save ──────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            // Personal preferences (this operator only)
            await api.post('/settings/app', {
                text_size: textSize,
                language: language,
            });

            // Dairy-wide business rule — resend the CURRENT app_name/logo_url
            // unchanged so this save can never overwrite branding, which this
            // page doesn't expose.
            await api.post('/settings/global', {
                app_name: appName,
                logo_url: logoUrl,
                fat_only_autofill: fatOnlyAutofill ? '1' : '0',
            });

            setSavedState({ textSize, language, fatOnlyAutofill });
            updateConfig({ textSize, language, fatOnlyAutofill });

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
        setFatOnlyAutofill(savedState.fatOnlyAutofill);
        showFlash('success', t('settings.resetSuccess'));
    };

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

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
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                        >
                            {t('actions.resetDefaults')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
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

                {/* ── Text Size ── */}
                <SectionCard title={t('settings.textSize')} icon={<Type size={15} className="text-white" />}>
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
                <SectionCard title={t('settings.language')} icon={<Languages size={15} className="text-white" />}>
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
                <SectionCard title={t('settings.fatOnlyAutofill.title')} icon={<Percent size={15} className="text-white" />}>
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