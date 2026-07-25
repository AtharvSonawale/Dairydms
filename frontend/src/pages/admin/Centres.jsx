import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, X, BadgeCheck, MapPin, Phone, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function Centres() {
    const { t } = useTranslation();
    const { user, login } = useAuth();

    const [centres, setCentres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [flash, setFlash] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [switching, setSwitching] = useState(null);
    const [form, setForm] = useState({ centre_name: '', centre_code: '', address: '', contact_number: '' });

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchCentres = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/centres');
            setCentres(data);
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to load centres.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCentres(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/centres', form);
            showFlash('success', 'Centre created successfully.');
            setModalOpen(false);
            setForm({ centre_name: '', centre_code: '', address: '', contact_number: '' });
            fetchCentres();
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to create centre.');
        } finally {
            setSaving(false);
        }
    };

    const handleSwitch = async (centre_id) => {
        setSwitching(centre_id);
        try {
            const { data } = await api.post('/centres/switch', { centre_id });
            login(data); // same response shape as adminLogin -- reuse as-is
            showFlash('success', `Switched to ${data.centre_name}.`);
            // Reload so every page refetches data scoped to the new centre_id
            setTimeout(() => window.location.reload(), 600);
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to switch centre.');
            setSwitching(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Building2 size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">Centres</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Manage centres within your dairy. Switch to work within a different centre.
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                            bg-violet-600 text-white hover:bg-violet-700 transition">
                        <Plus size={14} /> New Centre
                    </button>
                </div>

                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border border-rose-200 text-rose-600'}`}>
                        {flash.msg}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-full flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : centres.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Building2 size={32} />
                            <p className="text-sm">No centres found.</p>
                        </div>
                    ) : centres.map(c => (
                        <div key={c.centre_id}
                            className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition
                                ${c.is_current ? 'border-violet-300 ring-2 ring-violet-100' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{c.centre_name}</p>
                                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">{c.centre_code}</p>
                                </div>
                                {c.is_current && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                                        <BadgeCheck size={10} /> Current
                                    </span>
                                )}
                            </div>
                            {c.address && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <MapPin size={12} className="shrink-0" /> {c.address}
                                </p>
                            )}
                            {c.contact_number && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <Phone size={12} className="shrink-0" /> {c.contact_number}
                                </p>
                            )}
                            {!c.is_current && (
                                <button
                                    onClick={() => handleSwitch(c.centre_id)}
                                    disabled={switching === c.centre_id}
                                    className="mt-1 inline-flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl
                                        bg-gray-900 text-white hover:bg-gray-800 transition disabled:opacity-50">
                                    {switching === c.centre_id
                                        ? <RefreshCw size={12} className="animate-spin" />
                                        : <RefreshCw size={12} />}
                                    Switch to this centre
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-sm font-bold text-gray-900">New Centre</h2>
                            <button onClick={() => setModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Centre Name</label>
                                <input required value={form.centre_name}
                                    onChange={e => setForm(p => ({ ...p, centre_name: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Centre Code</label>
                                <input required value={form.centre_code}
                                    onChange={e => setForm(p => ({ ...p, centre_code: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Address (optional)</label>
                                <input value={form.address}
                                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contact Number (optional)</label>
                                <input value={form.contact_number}
                                    onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {saving ? 'Creating...' : 'Create Centre'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}