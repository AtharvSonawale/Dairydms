// src/pages/admin/PortSettings.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Save, BadgeCheck, AlertTriangle, X,
    RefreshCw, Plug, Wifi, Server,
    Database, Globe, Network, Terminal,
    Check, Shield, Activity
} from 'lucide-react';
import api from '../../api/axios';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── Default port configuration ────────────────────────────────
const SERVER_DEFAULTS = {
    // Application Ports
    app_port: '5000',
    frontend_port: '3000',

    // Database
    db_host: 'localhost',
    db_port: '3306',
    db_name: '',
    db_user: '',
    db_password: '',

    // Serial / Hardware
    serial_port: 'COM3',
    serial_baud_rate: '9600',
    serial_data_bits: '8',
    serial_stop_bits: '1',
    serial_parity: 'none',

    // Network
    cors_origin: 'http://localhost:3000',
    api_base_url: 'http://localhost:5000',

    // SMTP / Email
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_secure: 'false',
};

const BAUD_RATES = ['300', '600', '1200', '2400', '4800', '9600', '14400', '19200', '38400', '57600', '115200'];
const DATA_BITS = ['5', '6', '7', '8'];
const STOP_BITS = ['1', '1.5', '2'];
const PARITY_OPTIONS = ['none', 'even', 'odd', 'mark', 'space'];

// ── Sub-components ────────────────────────────────────────────
function SectionCard({ title, icon, children, tourId }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour={tourId}>
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

function PortInput({ value, onChange, placeholder, type = 'text', disabled, mono, className = '' }) {
    return (
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                placeholder:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed
                ${mono ? 'font-mono' : ''} ${className}`}
        />
    );
}

function PortSelect({ value, onChange, options, disabled }) {
    return (
        <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                disabled:opacity-50 disabled:cursor-not-allowed font-mono"
        >
            {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    );
}

function StatusBadge({ status }) {
    const map = {
        connected: { color: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500', label: 'Connected' },
        disconnected: { color: 'bg-rose-50 text-rose-600 border-rose-100', dot: 'bg-rose-400', label: 'Disconnected' },
        unknown: { color: 'bg-gray-50 text-gray-500 border-gray-100', dot: 'bg-gray-300', label: 'Unknown' },
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

    const [form, setForm] = useState(SERVER_DEFAULTS);
    const [savedState, setSavedState] = useState(SERVER_DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState({});
    const [testResults, setTestResults] = useState({});
    const [flash, setFlash] = useState(null);
    const [showPasswords, setShowPasswords] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('all');

    const SECTIONS = [
        { key: 'all', label: 'All Sections' },
        { key: 'app', label: 'Application Ports' },
        { key: 'db', label: 'Database Connection' },
        { key: 'serial', label: 'Serial Port / RS232' },
        { key: 'network', label: 'Network & CORS' },
        { key: 'smtp', label: 'SMTP / Email Server' },
    ];
    
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Load saved port settings on mount ─────────────────────
    useEffect(() => {
        setLoading(true);
        api.get('/settings/ports')
            .then(({ data }) => {
                const merged = { ...SERVER_DEFAULTS, ...data };
                setForm(merged);
                setSavedState(merged);
            })
            .catch(() => { /* keep defaults */ })
            .finally(() => setLoading(false));
    }, []);

    // ── Tour ──────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="app-ports"]',
                    popover: { title: 'Application Ports', description: 'Set the ports your backend server and frontend dev server run on.' },
                },
                {
                    element: '[data-tour="db-ports"]',
                    popover: { title: 'Database Connection', description: 'Configure your MySQL/MariaDB host, port, and credentials.' },
                },
                {
                    element: '[data-tour="serial-ports"]',
                    popover: { title: 'Serial / RS232', description: 'Configure the COM port and baud rate for your milk analyzer machine.' },
                },
                {
                    element: '[data-tour="network-ports"]',
                    popover: { title: 'Network & CORS', description: 'Set your API base URL and allowed CORS origins.' },
                },
                {
                    element: '[data-tour="smtp-ports"]',
                    popover: { title: 'SMTP / Email', description: 'Configure email server settings for notifications.' },
                },
            ],
        });
        driverObj.drive();
    };

    // ── Test connection helpers ───────────────────────────────
    const testConnection = async (type) => {
        setTesting(p => ({ ...p, [type]: true }));
        setTestResults(p => ({ ...p, [type]: null }));
        try {
            const { data } = await api.post('/settings/ports/test', { type, config: form });
            setTestResults(p => ({ ...p, [type]: data.success ? 'connected' : 'disconnected' }));
            showFlash(data.success ? 'success' : 'error', data.message || (data.success ? 'Connection successful.' : 'Connection failed.'));
        } catch {
            setTestResults(p => ({ ...p, [type]: 'disconnected' }));
            showFlash('error', 'Connection test failed.');
        } finally {
            setTesting(p => ({ ...p, [type]: false }));
        }
    };

    // ── Save ──────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/settings/ports', form);
            setSavedState(form);
            showFlash('success', 'Port settings saved successfully.');
        } catch {
            showFlash('error', 'Failed to save port settings.');
        } finally {
            setSaving(false);
        }
    };

    // ── Reset ─────────────────────────────────────────────────
    const handleReset = () => {
        setForm(savedState);
        setTestResults({});
        showFlash('success', 'Reset to last saved values.');
    };

    const togglePassword = (key) =>
        setShowPasswords(p => ({ ...p, [key]: !p[key] }));

    if (loading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Plug size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">Port Settings</h1>
                            <p className="text-xs text-gray-400 mt-0.5">Configure server, database, serial, and network ports</p>
                        </div>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-xs font-medium ml-1">
                            Admin Only
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={activeSection}
                            onChange={e => setActiveSection(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition font-medium"
                        >
                            {SECTIONS.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={startTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <button
                            onClick={handleReset}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                        >
                            <RefreshCw size={13} /> Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={13} />}
                            {saving ? 'Saving…' : 'Save'}
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

                {/* ── Application Ports ── */}
                {(activeSection === 'all' || activeSection === 'app') && (
                    <SectionCard title="Application Ports" icon={<Server size={15} className="text-white" />} tourId="app-ports">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <PortField label="Backend Server Port" hint="Port your Node/Express server listens on" required>
                                <PortInput
                                    value={form.app_port}
                                    onChange={e => set('app_port', e.target.value)}
                                    placeholder="5000"
                                    type="number"
                                    mono
                                />
                            </PortField>
                            <PortField label="Frontend Dev Port" hint="Port your React dev server runs on">
                                <PortInput
                                    value={form.frontend_port}
                                    onChange={e => set('frontend_port', e.target.value)}
                                    placeholder="3000"
                                    type="number"
                                    mono
                                />
                            </PortField>
                            <PortField label="Status">
                                <div className="flex items-center gap-3 h-[38px] px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                    <Activity size={13} className="text-gray-400" />
                                    <StatusBadge status={testResults.app || 'unknown'} />
                                    <button
                                        onClick={() => testConnection('app')}
                                        disabled={testing.app}
                                        className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50 font-semibold"
                                    >
                                        {testing.app ? '…' : 'Test'}
                                    </button>
                                </div>
                            </PortField>
                        </div>
                    </SectionCard>
                )}

                {/* ── Database ── */}
                {(activeSection === 'all' || activeSection === 'db') && (
                    <SectionCard title="Database Connection" icon={<Database size={15} className="text-white" />} tourId="db-ports">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                            <PortField label="DB Host" hint="Hostname or IP of your database server" required>
                                <PortInput
                                    value={form.db_host}
                                    onChange={e => set('db_host', e.target.value)}
                                    placeholder="localhost"
                                    mono
                                />
                            </PortField>
                            <PortField label="DB Port" hint="Default MySQL port is 3306" required>
                                <PortInput
                                    value={form.db_port}
                                    onChange={e => set('db_port', e.target.value)}
                                    placeholder="3306"
                                    type="number"
                                    mono
                                />
                            </PortField>
                            <PortField label="Database Name" required>
                                <PortInput
                                    value={form.db_name}
                                    onChange={e => set('db_name', e.target.value)}
                                    placeholder="dms_db"
                                    mono
                                />
                            </PortField>
                            <PortField label="DB Username" required>
                                <PortInput
                                    value={form.db_user}
                                    onChange={e => set('db_user', e.target.value)}
                                    placeholder="root"
                                    mono
                                />
                            </PortField>
                            <PortField label="DB Password">
                                <div className="relative">
                                    <PortInput
                                        value={form.db_password}
                                        onChange={e => set('db_password', e.target.value)}
                                        placeholder="••••••••"
                                        type={showPasswords.db ? 'text' : 'password'}
                                        mono
                                        className="w-full pr-16"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePassword('db')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded transition"
                                    >
                                        {showPasswords.db ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </PortField>
                            <PortField label="Connection Status">
                                <div className="flex items-center gap-3 h-[38px] px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                    <Database size={13} className="text-gray-400" />
                                    <StatusBadge status={testResults.db || 'unknown'} />
                                    <button
                                        onClick={() => testConnection('db')}
                                        disabled={testing.db}
                                        className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50 font-semibold"
                                    >
                                        {testing.db ? '…' : 'Test'}
                                    </button>
                                </div>
                            </PortField>
                        </div>
                        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                            <span>These values are stored in the database for reference. Your actual server uses the <span className="font-mono font-semibold">.env</span> file for live DB connections.</span>
                        </div>
                    </SectionCard>
                )}

                {/* ── Serial / RS232 ── */}
                {(activeSection === 'all' || activeSection === 'serial') && (
                    <SectionCard title="Serial Port / RS232 (Milk Analyzer)" icon={<Terminal size={15} className="text-white" />} tourId="serial-ports">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                            <PortField label="COM Port" hint="e.g. COM3 on Windows, /dev/ttyUSB0 on Linux" required>
                                <PortInput
                                    value={form.serial_port}
                                    onChange={e => set('serial_port', e.target.value)}
                                    placeholder="COM3"
                                    mono
                                />
                            </PortField>
                            <PortField label="Baud Rate" hint="Match the baud rate of your device">
                                <PortSelect
                                    value={form.serial_baud_rate}
                                    onChange={e => set('serial_baud_rate', e.target.value)}
                                    options={BAUD_RATES}
                                />
                            </PortField>
                            <PortField label="Data Bits">
                                <PortSelect
                                    value={form.serial_data_bits}
                                    onChange={e => set('serial_data_bits', e.target.value)}
                                    options={DATA_BITS}
                                />
                            </PortField>
                            <PortField label="Stop Bits">
                                <PortSelect
                                    value={form.serial_stop_bits}
                                    onChange={e => set('serial_stop_bits', e.target.value)}
                                    options={STOP_BITS}
                                />
                            </PortField>
                            <PortField label="Parity">
                                <PortSelect
                                    value={form.serial_parity}
                                    onChange={e => set('serial_parity', e.target.value)}
                                    options={PARITY_OPTIONS}
                                />
                            </PortField>
                            <PortField label="Connection Status">
                                <div className="flex items-center gap-3 h-[38px] px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                    <Plug size={13} className="text-gray-400" />
                                    <StatusBadge status={testResults.serial || 'unknown'} />
                                    <button
                                        onClick={() => testConnection('serial')}
                                        disabled={testing.serial}
                                        className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50 font-semibold"
                                    >
                                        {testing.serial ? '…' : 'Test'}
                                    </button>
                                </div>
                            </PortField>
                        </div>

                        {/* Summary strip */}
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-xs font-mono text-gray-600">
                            <span className="font-semibold text-gray-800">{form.serial_port}</span>
                            <span className="text-gray-300">·</span>
                            <span>{form.serial_baud_rate} baud</span>
                            <span className="text-gray-300">·</span>
                            <span>{form.serial_data_bits}-{form.serial_parity.charAt(0).toUpperCase()}-{form.serial_stop_bits}</span>
                        </div>
                    </SectionCard>
                )}

                {/* ── Network & CORS ── */}
                {(activeSection === 'all' || activeSection === 'network') && (
                    <SectionCard title="Network & CORS" icon={<Network size={15} className="text-white" />} tourId="network-ports">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <PortField label="API Base URL" hint="Full URL of your backend API including port" required>
                                <PortInput
                                    value={form.api_base_url}
                                    onChange={e => set('api_base_url', e.target.value)}
                                    placeholder="http://localhost:5000"
                                    mono
                                />
                            </PortField>
                            <PortField label="CORS Allowed Origin" hint="Frontend URL allowed to make API requests" required>
                                <PortInput
                                    value={form.cors_origin}
                                    onChange={e => set('cors_origin', e.target.value)}
                                    placeholder="http://localhost:3000"
                                    mono
                                />
                            </PortField>
                        </div>
                        <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                            <Globe size={13} className="shrink-0 mt-0.5" />
                            <span>For production, set CORS origin to your actual domain e.g. <span className="font-mono font-semibold">https://yourdomain.com</span>. Use <span className="font-mono font-semibold">*</span> only for development.</span>
                        </div>
                    </SectionCard>
                )}

                {/* ── SMTP / Email ── */}
                {(activeSection === 'all' || activeSection === 'smtp') && (
                    <SectionCard title="SMTP / Email Server" icon={<Wifi size={15} className="text-white" />} tourId="smtp-ports">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                            <PortField label="SMTP Host" hint="e.g. smtp.gmail.com">
                                <PortInput
                                    value={form.smtp_host}
                                    onChange={e => set('smtp_host', e.target.value)}
                                    placeholder="smtp.gmail.com"
                                    mono
                                />
                            </PortField>
                            <PortField label="SMTP Port" hint="587 for TLS, 465 for SSL, 25 for plain">
                                <PortInput
                                    value={form.smtp_port}
                                    onChange={e => set('smtp_port', e.target.value)}
                                    placeholder="587"
                                    type="number"
                                    mono
                                />
                            </PortField>
                            <PortField label="Secure (SSL/TLS)">
                                <div className="flex gap-2">
                                    {['true', 'false'].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => set('smtp_secure', val)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition
                                            ${form.smtp_secure === val
                                                    ? val === 'true'
                                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                                        : 'bg-rose-50 border-rose-300 text-rose-700'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                        >
                                            {form.smtp_secure === val && <Check size={11} />}
                                            {val === 'true' ? 'SSL/TLS' : 'Plain'}
                                        </button>
                                    ))}
                                </div>
                            </PortField>
                            <PortField label="SMTP Username / Email">
                                <PortInput
                                    value={form.smtp_user}
                                    onChange={e => set('smtp_user', e.target.value)}
                                    placeholder="you@gmail.com"
                                    mono
                                />
                            </PortField>
                            <PortField label="SMTP Password">
                                <div className="relative">
                                    <PortInput
                                        value={form.smtp_password}
                                        onChange={e => set('smtp_password', e.target.value)}
                                        placeholder="••••••••"
                                        type={showPasswords.smtp ? 'text' : 'password'}
                                        mono
                                        className="w-full pr-16"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePassword('smtp')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded transition"
                                    >
                                        {showPasswords.smtp ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </PortField>
                            <PortField label="Connection Status">
                                <div className="flex items-center gap-3 h-[38px] px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                    <Wifi size={13} className="text-gray-400" />
                                    <StatusBadge status={testResults.smtp || 'unknown'} />
                                    <button
                                        onClick={() => testConnection('smtp')}
                                        disabled={testing.smtp}
                                        className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50 font-semibold"
                                    >
                                        {testing.smtp ? '…' : 'Test'}
                                    </button>
                                </div>
                            </PortField>
                        </div>
                        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-700">
                            <Shield size={13} className="shrink-0 mt-0.5" />
                            <span>For Gmail, use an App Password instead of your account password. Enable 2FA on your Google account first, then generate an App Password from your Google Account security settings.</span>
                        </div>
                    </SectionCard>
                )}

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
                        {saving ? 'Saving…' : 'Save All Port Settings'}
                    </button>
                </div>

            </main>
        </div>
    );
}