// src/pages/admin/PortSettings.jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Save, BadgeCheck, AlertTriangle, X,
    RefreshCw, Plug, Terminal, ScanLine, PowerOff,
    Home, Settings,
} from 'lucide-react';
import api from '../../api/axios';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── Default serial configuration ──────────────────────────────
const SERIAL_DEFAULTS = {
    serial_port: '',
    serial_baud_rate: '9600',
    serial_data_bits: '8',
    serial_stop_bits: '1',
    serial_parity: 'none',
    kg_unit_label: 'Kg',
    ltr_unit_label: 'Ltr',
    default_weight_unit: 'ltr',
};

const MACHINE_TYPES = [
    { value: 'weight_gavali', labelKey: 'portSettings.machineType.weightGavali' },
    { value: 'weight_utpadak', labelKey: 'portSettings.machineType.weightUtpadak' },
    { value: 'weight', labelKey: 'portSettings.machineType.weightDefault' },
    { value: 'fat', labelKey: 'portSettings.machineType.fat' },
];

const BAUD_RATES = ['300', '600', '1200', '2400', '4800', '9600', '14400', '19200', '38400', '57600', '115200'];
const DATA_BITS = ['5', '6', '7', '8'];
const STOP_BITS = ['1', '1.5', '2'];
const PARITY_OPTIONS = ['none', 'even', 'odd', 'mark', 'space'];

// ── Sub-components ────────────────────────────────────────────
function SectionCard({ title, icon, children, tourId, headerRight }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" data-tour={tourId}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
                {headerRight && <div className="ml-auto">{headerRight}</div>}
            </div>
            <div className="p-6 relative z-10">{children}</div>
        </div>
    );
}

function PortField({ label, hint, children, required }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>
            {children}
            {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
        </div>
    );
}

function PortSelect({ value, onChange, options, disabled, renderLabel, placeholder, className = '' }) {
    return (
        <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                disabled:opacity-50 disabled:cursor-not-allowed font-mono ${className}`}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(opt => (
                <option key={opt} value={opt}>{renderLabel ? renderLabel(opt) : opt}</option>
            ))}
        </select>
    );
}

function StatusBadge({ status, t }) {
    const map = {
        connected: { color: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60', dot: 'bg-emerald-500', label: t('portSettings.connectionStatus.connected') },
        disconnected: { color: 'bg-rose-50/80 text-rose-600 border-rose-200/60', dot: 'bg-rose-400', label: t('portSettings.connectionStatus.disconnected') },
        unknown: { color: 'bg-gray-50/80 text-gray-500 border-gray-200/60', dot: 'bg-gray-300', label: t('portSettings.connectionStatus.unknown') },
    };
    const s = map[status] || map.unknown;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${s.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'connected' ? 'animate-pulse' : ''}`} />
            {s.label}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function PortSettings() {
    const { t } = useTranslation();

    const [machineType, setMachineType] = useState('weight_utpadak');
    // Holds settings for BOTH machine types, keyed by 'weight' | 'fat',
    // so switching the dropdown doesn't lose unsaved-but-loaded data.
    const [byMachine, setByMachine] = useState({
        weight_gavali: { ...SERIAL_DEFAULTS },
        weight_utpadak: { ...SERIAL_DEFAULTS },
        weight: { ...SERIAL_DEFAULTS },
        fat: { ...SERIAL_DEFAULTS },
    });
    const [savedByMachine, setSavedByMachine] = useState({
        weight_gavali: { ...SERIAL_DEFAULTS },
        weight_utpadak: { ...SERIAL_DEFAULTS },
        weight: { ...SERIAL_DEFAULTS },
        fat: { ...SERIAL_DEFAULTS },
    });
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [flash, setFlash] = useState(null);
    const [loading, setLoading] = useState(true);
    const [availablePorts, setAvailablePorts] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [closingPort, setClosingPort] = useState(false);
    const [manualPortEntry, setManualPortEntry] = useState(false);
    const form = byMachine[machineType];
    const set = (k, v) =>
        setByMachine(p => ({ ...p, [machineType]: { ...p[machineType], [k]: v } }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Load saved port settings + available ports on mount ───
    useEffect(() => {
        setLoading(true);
        api.get('/settings/ports')
            .then(({ data }) => {
                const next = {
                    weight_gavali: { ...SERIAL_DEFAULTS, ...(data?.weight_gavali || {}) },
                    weight_utpadak: { ...SERIAL_DEFAULTS, ...(data?.weight_utpadak || {}) },
                    weight: { ...SERIAL_DEFAULTS, ...(data?.weight || {}) },
                    fat: { ...SERIAL_DEFAULTS, ...(data?.fat || {}) },
                };
                setByMachine(next);
                setSavedByMachine(next);
            })
            .catch(() => { /* keep defaults */ })
            .finally(() => setLoading(false));

        scanPorts();
    }, []);

    // ── Tour ──────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="machine-type"]',
                    popover: {
                        title: t('portSettings.tour.step1.title'),
                        description: t('portSettings.tour.step1.description'),
                    },
                },
                {
                    element: '[data-tour="scan-btn"]',
                    popover: {
                        title: t('portSettings.tour.step2.title'),
                        description: t('portSettings.tour.step2.description'),
                    },
                },
                {
                    element: '[data-tour="serial-ports"]',
                    popover: {
                        title: t('portSettings.tour.step3.title'),
                        description: t('portSettings.tour.step3.description'),
                    },
                },
            ],
        });
        driverObj.drive();
    };

    // ── Scan for available serial ports ────────────────────────
    const scanPorts = async () => {
        setScanning(true);
        try {
            const { data } = await api.get('/settings/ports/available');
            const ports = data?.ports || [];
            setAvailablePorts(ports);
            if (ports.length === 0) {
                showFlash('error', t('portSettings.flash.noPortsDetected'));
            } else {
                showFlash('success', t('portSettings.flash.foundPorts', { count: ports.length }));
            }
        } catch {
            showFlash('error', t('portSettings.flash.scanFailed'));
        } finally {
            setScanning(false);
        }
    };

    // ── Test the currently selected machine's serial connection ─
    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const { data } = await api.post('/settings/ports/test', { config: form });
            setTestResult(data.success ? 'connected' : 'disconnected');
            let msg = data.message || (data.success ? t('portSettings.flash.connectionSuccess') : t('portSettings.flash.connectionFailed'));
            if (!data.success && /access denied/i.test(msg)) {
                msg += ' ' + t('portSettings.flash.connectionInUse');
            } else if (!data.success && /(error code 121|timeout)/i.test(msg)) {
                msg += ' ' + t('portSettings.flash.connectionNoDevice');
            }
            showFlash(data.success ? 'success' : 'error', msg);
            if (data.success) scanPorts(); // refresh open/closed state in the dropdown
        } catch {
            setTestResult('disconnected');
            showFlash('error', t('portSettings.flash.testFailed'));
        } finally {
            setTesting(false);
        }
    };

    // ── Close the currently selected port (if held open by this server) ─
    const closeSelectedPort = async () => {
        if (!form.serial_port) return;
        setClosingPort(true);
        try {
            const { data } = await api.post('/settings/ports/close', { serial_port: form.serial_port });
            showFlash(data.success ? 'success' : 'error', data.message || t('portSettings.flash.portClosed'));
            setTestResult(null);
            await scanPorts();
        } catch {
            showFlash('error', t('portSettings.flash.closeFailed'));
        } finally {
            setClosingPort(false);
        }
    };

    // ── Save ──────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.serial_port) {
            showFlash('error', t('portSettings.flash.selectPort'));
            return;
        }

        setSaving(true);
        try {
            await api.post('/settings/ports', { ...form, machine_type: machineType });
            setSavedByMachine(p => ({ ...p, [machineType]: form }));
            const machineLabel = MACHINE_TYPES.find(m => m.value === machineType)?.labelKey;
            showFlash('success', t('portSettings.flash.saveSuccess', { machineType: machineLabel ? t(machineLabel) : machineType }));
        } catch (err) {
            showFlash('error', err.response?.data?.error || t('portSettings.flash.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    // ── Reset ─────────────────────────────────────────────────
    const handleReset = () => {
        setByMachine(p => ({ ...p, [machineType]: savedByMachine[machineType] }));
        setTestResult(null);
        showFlash('success', t('portSettings.flash.resetSuccess'));
    };

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('portSettings.pageBreadcrumb', { defaultValue: 'System Configuration' })}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('portSettings.adminOnly')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('portSettings.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">{t('portSettings.subtitle')}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('portSettings.startTour')}
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <RefreshCw size={15} /> {t('portSettings.reset')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={15} />}
                            {saving ? t('portSettings.saving') : t('portSettings.save')}
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

                {/* ── Serial / RS232 ── */}
                <SectionCard
                    title={t('portSettings.serialSection')}
                    icon={<Terminal size={16} className="text-white" />}
                    tourId="serial-ports"
                    headerRight={
                        <button
                            data-tour="scan-btn"
                            onClick={scanPorts}
                            disabled={scanning}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            <ScanLine size={14} className={scanning ? 'animate-pulse' : ''} />
                            {scanning ? t('portSettings.scanning') : t('portSettings.scanPorts')}
                        </button>
                    }
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                        {/* First row - all fields */}
                        <PortField
                            label={t('portSettings.machineType.label')}
                            hint={t('portSettings.machineType.hint')}
                            required
                        >
                            <div data-tour="machine-type">
                                <PortSelect
                                    value={machineType}
                                    onChange={e => {
                                        setMachineType(e.target.value);
                                        localStorage.setItem('lastMachineType', e.target.value);
                                    }}
                                    options={MACHINE_TYPES.map(m => m.value)}
                                    renderLabel={v => t(MACHINE_TYPES.find(m => m.value === v)?.labelKey || v)}
                                    className="w-full"
                                />
                            </div>
                        </PortField>
                        <PortField
                            label={t('portSettings.comPort.label')}
                            hint={t('portSettings.comPort.hint')}
                            required
                        >
                            <div className="flex items-center gap-2">
                                {manualPortEntry ? (
                                    <input
                                        type="text"
                                        value={form.serial_port}
                                        onChange={e => set('serial_port', e.target.value.toUpperCase())}
                                        placeholder="e.g. COM11"
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                            focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition font-mono w-full"
                                    />
                                ) : (
                                    <PortSelect
                                        value={form.serial_port}
                                        onChange={e => set('serial_port', e.target.value)}
                                        options={availablePorts.length ? availablePorts.map(p => p.path) : ['']}
                                        renderLabel={path => {
                                            const p = availablePorts.find(ap => ap.path === path);
                                            return p?.isOpen ? `${path} (open)` : path;
                                        }}
                                        placeholder={availablePorts.length ? undefined : t('portSettings.comPort.noPortsFound')}
                                        className="w-full"
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => setManualPortEntry(v => !v)}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-2 rounded-lg bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm whitespace-nowrap flex-shrink-0"
                                >
                                    {manualPortEntry ? t('portSettings.comPort.useList') : t('portSettings.comPort.typeManually')}
                                </button>
                                {availablePorts.find(p => p.path === form.serial_port)?.isOpen && (
                                    <button
                                        type="button"
                                        onClick={closeSelectedPort}
                                        disabled={closingPort}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-2 rounded-lg bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 text-rose-600 hover:bg-rose-100/80 transition shadow-sm disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                                    >
                                        <PowerOff size={12} />
                                        {closingPort ? t('portSettings.comPort.closing') : t('portSettings.comPort.closePort')}
                                    </button>
                                )}
                            </div>
                        </PortField>
                        <PortField
                            label={t('portSettings.baudRate.label')}
                            hint={t('portSettings.baudRate.hint')}
                        >
                            <PortSelect
                                value={form.serial_baud_rate}
                                onChange={e => set('serial_baud_rate', e.target.value)}
                                options={BAUD_RATES}
                                className="w-full"
                            />
                        </PortField>
                        <PortField label={t('portSettings.dataBits.label')}>
                            <PortSelect
                                value={form.serial_data_bits}
                                onChange={e => set('serial_data_bits', e.target.value)}
                                options={DATA_BITS}
                                className="w-full"
                            />
                        </PortField>
                        <PortField label={t('portSettings.stopBits.label')}>
                            <PortSelect
                                value={form.serial_stop_bits}
                                onChange={e => set('serial_stop_bits', e.target.value)}
                                options={STOP_BITS}
                                className="w-full"
                            />
                        </PortField>
                        <PortField label={t('portSettings.parity.label')}>
                            <PortSelect
                                value={form.serial_parity}
                                onChange={e => set('serial_parity', e.target.value)}
                                options={PARITY_OPTIONS}
                                className="w-full"
                            />
                        </PortField>
                        {machineType !== 'fat' && (
                            <PortField label="Default Weight Unit" hint="Which reading auto-fills Quantity in Milk Entry">
                                <PortSelect
                                    value={form.default_weight_unit}
                                    onChange={e => set('default_weight_unit', e.target.value)}
                                    options={['ltr', 'kg']}
                                    renderLabel={v => v === 'ltr' ? 'Liters (Ltr)' : 'Kilograms (Kg)'}
                                    className="w-full"
                                />
                            </PortField>
                        )}
                        <PortField label={t('portSettings.connectionStatus.label')}>
                            <div className="flex items-center gap-3 h-[42px] px-4 py-2.5 rounded-xl bg-white/50 backdrop-blur-sm border border-gray-200/60 shadow-sm">
                                <Plug size={14} className="text-gray-400" />
                                <StatusBadge status={testResult || 'unknown'} t={t} />
                                <button
                                    onClick={testConnection}
                                    disabled={testing || !form.serial_port}
                                    className="ml-auto text-[10px] px-3 py-1 rounded-lg bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 text-blue-600 hover:bg-blue-100/80 transition shadow-sm disabled:opacity-50 font-semibold"
                                >
                                    {testing ? '…' : t('portSettings.connectionStatus.test')}
                                </button>
                            </div>
                        </PortField>
                    </div>

                    {/* Summary strip */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-white/50 backdrop-blur-sm border border-gray-200/60 text-xs font-mono text-gray-600 shadow-sm">
                        <span className="font-semibold text-gray-800">
                            {t(MACHINE_TYPES.find(m => m.value === machineType)?.labelKey)}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="font-semibold text-gray-800">{form.serial_port || t('portSettings.comPort.noPortSelected')}</span>
                        <span className="text-gray-300">·</span>
                        <span>{form.serial_baud_rate} {t('portSettings.summary.baud')}</span>
                        <span className="text-gray-300">·</span>
                        <span>{form.serial_data_bits}-{form.serial_parity.charAt(0).toUpperCase()}-{form.serial_stop_bits}</span>
                    </div>
                </SectionCard>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('portSettings.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('portSettings.footerPort', { defaultValue: 'Port' })}: <strong className="text-gray-600">{form.serial_port || t('portSettings.comPort.noPortSelected')}</strong></span>
                    <span>· {t('portSettings.footerMachine', { defaultValue: 'Machine type' })}: <strong className="text-gray-600">{t(MACHINE_TYPES.find(m => m.value === machineType)?.labelKey)}</strong></span>
                </div>

                {/* ── Save footer ── */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2.5 text-sm font-semibold px-6 py-3 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                    >
                        {saving
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Save size={16} />}
                        {saving ? t('portSettings.saving') : t('portSettings.saveAll')}
                    </button>
                </div>

            </main>
        </div>
    );
}