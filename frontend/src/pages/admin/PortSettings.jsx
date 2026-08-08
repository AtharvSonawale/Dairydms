// src/pages/admin/PortSettings.jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Save, BadgeCheck, AlertTriangle, X,
    RefreshCw, Plug, Terminal, ScanLine, PowerOff
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour={tourId}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                    {icon}
                </div>
                <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
                {headerRight && <div className="ml-auto">{headerRight}</div>}
            </div>
            <div className="p-6">{children}</div>
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
            className={`border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
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
        connected: { color: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500', label: t('portSettings.connectionStatus.connected') },
        disconnected: { color: 'bg-rose-50 text-rose-600 border-rose-100', dot: 'bg-rose-400', label: t('portSettings.connectionStatus.disconnected') },
        unknown: { color: 'bg-gray-50 text-gray-500 border-gray-100', dot: 'bg-gray-300', label: t('portSettings.connectionStatus.unknown') },
    };
    const s = map[status] || map.unknown;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>
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
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Plug size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('portSettings.title')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">{t('portSettings.subtitle')}</p>
                        </div>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-xs font-medium ml-1">
                            {t('portSettings.adminOnly')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> {t('portSettings.startTour')}
                        </button>
                        <button
                            onClick={handleReset}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                        >
                            <RefreshCw size={13} /> {t('portSettings.reset')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={13} />}
                            {saving ? t('portSettings.saving') : t('portSettings.save')}
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

                {/* ── Serial / RS232 ── */}
                <SectionCard
                    title={t('portSettings.serialSection')}
                    icon={<Terminal size={15} className="text-white" />}
                    tourId="serial-ports"
                    headerRight={
                        <button
                            data-tour="scan-btn"
                            onClick={scanPorts}
                            disabled={scanning}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition disabled:opacity-50"
                        >
                            <ScanLine size={13} className={scanning ? 'animate-pulse' : ''} />
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
                                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50
                    focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition font-mono w-full"
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
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-2 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition whitespace-nowrap flex-shrink-0"
                                >
                                    {manualPortEntry ? t('portSettings.comPort.useList') : t('portSettings.comPort.typeManually')}
                                </button>
                                {availablePorts.find(p => p.path === form.serial_port)?.isOpen && (
                                    <button
                                        type="button"
                                        onClick={closeSelectedPort}
                                        disabled={closingPort}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                                    >
                                        <PowerOff size={11} />
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
                            <div className="flex items-center gap-3 h-[38px] px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                <Plug size={13} className="text-gray-400" />
                                <StatusBadge status={testResult || 'unknown'} t={t} />
                                <button
                                    onClick={testConnection}
                                    disabled={testing || !form.serial_port}
                                    className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50 font-semibold"
                                >
                                    {testing ? '…' : t('portSettings.connectionStatus.test')}
                                </button>
                            </div>
                        </PortField>
                    </div>

                    {/* Summary strip */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-xs font-mono text-gray-600">
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
                        {saving ? t('portSettings.saving') : t('portSettings.saveAll')}
                    </button>
                </div>

            </main>
        </div>
    );
}