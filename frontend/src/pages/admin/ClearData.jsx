// src/pages/admin/ClearData.jsx
import { useState } from 'react';
import { Trash2, AlertTriangle, BadgeCheck, X } from 'lucide-react';
import api from '../../api/axios';

const TABLES = [
    'bill_milk_entries', 'bill_product_sales', 'bill_cash_advance_snapshot', 'bill_master',
    'milk_entries', 'seller_payments', 'seller_deposits', 'cash_advance',
    'product_sales', 'product_purchases', 'walkin_sales', 'tank_dispatch',
    'owner_usage', 'bonus_register', 'bonus_payments', 'bonus_slabs', 'bonus_events',
    'gavali_bonus_payments', 'gavali_bonus_events',
    'generated_rates',
    // New additions:
    'bill_walkin_sales', 'bill_deposit_snapshot', 'walkin_payments'
];

const CONFIRM_PHRASE = 'DELETE ALL DATA';

export default function ClearData() {
    const [input, setInput] = useState('');
    const [clearing, setClearing] = useState(false);
    const [flash, setFlash] = useState(null);

    const matched = input === CONFIRM_PHRASE;

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 4000);
    };

    const handleClear = async () => {
        if (!matched || clearing) return;
        setClearing(true);
        try {
            await api.post('/settings/clear-all-data');
            setInput('');
            showFlash('success', 'All data cleared successfully. Database is now empty.');
        } catch (err) {
            showFlash('error', err.response?.data?.error || 'Failed to clear data.');
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-md shadow-rose-200">
                        <Trash2 size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">Clear All Data</h1>
                        <p className="text-xs text-gray-400 mt-0.5">Permanently wipe all operational records</p>
                    </div>
                </div>

                {/* Flash */}
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

                {/* Warning */}
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-3">
                        <AlertTriangle size={15} />
                        This action is permanent and cannot be undone
                    </div>
                    <ul className="flex flex-col gap-1.5">
                        {[
                            'All milk entries, payments, and bills will be deleted',
                            'All seller advance, deposit, and walk-in records will be cleared',
                            'All product sales, purchases, and tank dispatch records will be wiped',
                            'All bonus events, slabs, registers, and payments will be removed',
                            'All generated rates and operational snapshots will be removed',
                            'Sellers, operators, admins, rates, products, and settings will be preserved',
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-rose-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Tables list */}
                <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Tables that will be cleared
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {TABLES.map(t => (
                            <span key={t}
                                className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-500">
                                {t}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Confirm + Delete */}
                <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex flex-col gap-4">
                    <div>
                        <p className="text-xs text-gray-500 mb-2">
                            Type <strong className="font-mono text-rose-600">{CONFIRM_PHRASE}</strong> to confirm
                        </p>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Type here…"
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono transition
                                focus:outline-none focus:ring-2
                                ${matched
                                    ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-200'
                                    : 'border-gray-200 bg-gray-50 text-gray-700 focus:ring-gray-200'}`}
                        />
                        {matched && (
                            <p className="text-xs text-rose-500 mt-1.5 font-medium">
                                Phrase matched — click below to proceed
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleClear}
                        disabled={!matched || clearing}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                            bg-rose-600 text-white text-sm font-semibold
                            hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {clearing
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Trash2 size={14} />}
                        {clearing ? 'Clearing…' : 'Clear All Data Permanently'}
                    </button>
                </div>

            </main>
        </div>
    );
}