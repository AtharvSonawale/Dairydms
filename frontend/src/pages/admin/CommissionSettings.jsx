import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Percent, Milk, Save, RefreshCw, AlertTriangle, BadgeCheck, Info, Calculator, Home, Settings, X } from "lucide-react";
import api from "../../api/axios";
import { usePermission } from "../../context/PermissionContext";
import AccessDenied from "../../components/AccessDenied";

const DEFAULTS = {
    cow: { base_fat: 4.0, base_snf: 8.5, base_commission: 0, fat_step_cut: 0, snf_step_cut: 0, is_active: true },
    buffalo: { base_fat: 6.5, base_snf: 9.0, base_commission: 0, fat_step_cut: 0, snf_step_cut: 0, is_active: true },
};

function round2(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }

function computeCommission(setting, fat, snf) {
    if (!setting) return 0;
    const fatSteps = round2(((parseFloat(fat) || 0) - parseFloat(setting.base_fat)) / 0.1);
    const snfSteps = round2(((parseFloat(snf) || 0) - parseFloat(setting.base_snf)) / 0.1);
    let commission = parseFloat(setting.base_commission || 0)
        + fatSteps * parseFloat(setting.fat_step_cut || 0)
        + snfSteps * parseFloat(setting.snf_step_cut || 0);
    return Math.max(0, round2(commission));
}

function MilkTypeCard({ label, accentIcon, data, onChange, preview, onPreviewChange, t }) {
    const commission = computeCommission(data, preview.fat, preview.snf);
    const effectiveRate = round2((parseFloat(preview.rate) || 0) + commission);

    return (
        <div className="relative overflow-hidden rounded-2xl border bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentIcon} flex items-center justify-center shadow-lg`}>
                        <Milk size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                        <p className="text-[10px] text-gray-400">{t('commission.perLitreAddOn') || 'Per-litre commission add-on'}</p>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={!!data.is_active}
                        onChange={e => onChange('is_active', e.target.checked)}
                        className="w-4 h-4 rounded accent-violet-600" />
                    {t('commission.active') || 'Active'}
                </label>
            </div>

            <div className="px-5 py-5 flex flex-col gap-4 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('commission.baseFat') || 'Base Fat %'}</label>
                        <input type="number" step="0.01" value={data.base_fat}
                            onChange={e => onChange('base_fat', e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('commission.baseSnf') || 'Base SNF'}</label>
                        <input type="number" step="0.01" value={data.base_snf}
                            onChange={e => onChange('base_snf', e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            {t('commission.baseCommission') || 'Standard Commission (\u20B9/L at base Fat & SNF)'}
                        </label>
                        <input type="number" step="0.01" value={data.base_commission}
                            onChange={e => onChange('base_commission', e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('commission.fatStepCut') || 'Fat Step Cut (per 0.1)'}</label>
                        <input type="number" step="0.01" value={data.fat_step_cut}
                            onChange={e => onChange('fat_step_cut', e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('commission.snfStepCut') || 'SNF Step Cut (per 0.1)'}</label>
                        <input type="number" step="0.01" value={data.snf_step_cut}
                            onChange={e => onChange('snf_step_cut', e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-violet-100/50 shadow-lg shadow-violet-200/30 px-4 py-3 flex flex-col gap-2">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-violet-400/10 blur-3xl" />
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 uppercase tracking-wider relative z-10">
                        <Calculator size={11} /> {t('commission.tryIt') || 'Try it out'}
                    </div>
                    <div className="grid grid-cols-3 gap-2 relative z-10">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-gray-400 uppercase">{t('commission.fat') || 'Fat'}</span>
                            <input type="number" step="0.01" value={preview.fat}
                                onChange={e => onPreviewChange('fat', e.target.value)}
                                className="border border-violet-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-gray-400 uppercase">{t('commission.snf') || 'SNF'}</span>
                            <input type="number" step="0.01" value={preview.snf}
                                onChange={e => onPreviewChange('snf', e.target.value)}
                                className="border border-violet-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-gray-400 uppercase">{t('commission.milkRate') || 'Milk Rate ₹'}</span>
                            <input type="number" step="0.01" value={preview.rate}
                                onChange={e => onPreviewChange('rate', e.target.value)}
                                className="border border-violet-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 mt-1 border-t border-violet-200/60 relative z-10">
                        <span className="text-xs text-violet-600">
                            {t('commission.commissionAdded') || 'Commission'}: <strong>₹{commission.toFixed(2)}</strong>/L
                        </span>
                        <span className="text-sm font-bold text-violet-800">
                            {t('commission.effectiveRate') || 'Effective Rate'}: ₹{effectiveRate.toFixed(2)}/L
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CommissionSettings() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    const [settings, setSettings] = useState({ cow: { ...DEFAULTS.cow }, buffalo: { ...DEFAULTS.buffalo } });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [preview, setPreview] = useState({
        cow: { fat: 4.0, snf: 8.5, rate: 37 },
        buffalo: { fat: 6.5, snf: 9.0, rate: 45 },
    });

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/commission/settings');
                if (data) setSettings(data);
            } catch (err) {
                console.error('Failed to fetch commission settings:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (type, key, value) => {
        setSettings(prev => ({ ...prev, [type]: { ...prev[type], [key]: value } }));
    };

    const handlePreviewChange = (type, key, value) => {
        setPreview(prev => ({ ...prev, [type]: { ...prev[type], [key]: value } }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/commission/settings', settings);
            showFlash('success', t('commission.saveSuccess') || 'Commission settings saved successfully!');
        } catch (err) {
            showFlash('error', err.response?.data?.error || t('commission.saveError') || 'Failed to save commission settings.');
        } finally {
            setSaving(false);
        }
    };

    if (permLoading || loading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('commission_settings', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('commission.pageTitle') || 'Gavali Commission Settings'}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('commission.pageSubtitle') || "Configure the per-litre commission added to Gavali sellers' milk rate"}
                        </p>
                    </div>

                    {can('commission_settings', 'W') && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? (t('commission.saving') || 'Saving…') : (t('commission.saveSettings') || 'Save Settings')}
                        </button>
                    )}
                </div>

                {/* ── Info Banner ── */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg shadow-blue-200/30 px-5 py-4 flex items-start gap-3">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-400/10 blur-3xl" />
                    <Info size={18} className="text-blue-500 mt-0.5 shrink-0 relative z-10" />
                    <div className="text-xs text-blue-700 leading-relaxed relative z-10">
                        <p className="font-semibold mb-1">{t('commission.howItWorks') || 'How commission works'}</p>
                        <p>
                            {t('commission.howItWorksDesc') ||
                                'Commission only applies to Gavali sellers — Utpadak sellers are never affected. At the base Fat & SNF, the standard commission is added to the milk rate per litre. For every 0.1 step above or below the base Fat, the Fat Step Cut is added or subtracted. The same applies to SNF with the SNF Step Cut. The resulting commission (never below \u20B90) is added to the milk rate before the payable amount is calculated.'}
                        </p>
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success"
                            ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button
                            onClick={() => setFlash(null)}
                            className="ml-auto opacity-50 hover:opacity-100 transition"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Commission Cards ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <MilkTypeCard
                        label={t('commission.cowMilk') || "Cow's Milk"}
                        accentIcon="from-amber-500 to-amber-600"
                        data={settings.cow}
                        onChange={(key, value) => handleChange('cow', key, value)}
                        preview={preview.cow}
                        onPreviewChange={(key, value) => handlePreviewChange('cow', key, value)}
                        t={t}
                    />
                    <MilkTypeCard
                        label={t('commission.buffaloMilk') || "Buffalo's Milk"}
                        accentIcon="from-indigo-500 to-indigo-600"
                        data={settings.buffalo}
                        onChange={(key, value) => handleChange('buffalo', key, value)}
                        preview={preview.buffalo}
                        onPreviewChange={(key, value) => handlePreviewChange('buffalo', key, value)}
                        t={t}
                    />
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('commission.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('commission.footerMilkTypes', { defaultValue: 'Milk types' })}: <strong className="text-gray-600">Cow & Buffalo</strong></span>
                    <span>· {t('commission.footerApplicable', { defaultValue: 'Applicable to' })}: <strong className="text-gray-600">Gavali sellers only</strong></span>
                </div>

            </main>
        </div>
    );
}