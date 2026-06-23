// pages/AdminSignup.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export default function AdminSignup() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        mobile: '',
        dairy_id: '',
        centre_id: '',
        // New dairy creation fields
        createNewDairy: false,
        dairy_name: '',
        dairy_code: '',
        dairy_address: '',
        dairy_contact: '',
        centre_name: '',
        centre_code: '',
        centre_address: '',
        centre_contact: ''
    });
    const [dairies, setDairies] = useState([]);
    const [centres, setCentres] = useState([]);
    const [loadingDairies, setLoadingDairies] = useState(false);
    const [loadingCentres, setLoadingCentres] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Fetch dairies on component mount
    useEffect(() => {
        fetchDairies();
    }, []);

    // Fetch centres when dairy is selected
    useEffect(() => {
        if (form.dairy_id && !form.createNewDairy) {
            fetchCentres(form.dairy_id);
        } else {
            setCentres([]);
        }
    }, [form.dairy_id, form.createNewDairy]);

    const fetchDairies = async () => {
        setLoadingDairies(true);
        try {
            const response = await api.get('/auth/dairies/active');
            setDairies(response.data);
        } catch (err) {
            console.error('Error fetching dairies:', err);
            setError('Failed to load dairies');
        } finally {
            setLoadingDairies(false);
        }
    };

    const fetchCentres = async (dairyId) => {
        setLoadingCentres(true);
        try {
            const response = await api.get(`/auth/centres/active?dairyId=${dairyId}`);
            setCentres(response.data);
        } catch (err) {
            console.error('Error fetching centres:', err);
            setError('Failed to load centres');
        } finally {
            setLoadingCentres(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({
            ...form,
            [name]: type === 'checkbox' ? checked : value
        });
        // Reset selections when switching to new dairy mode
        if (name === 'createNewDairy') {
            if (checked) {
                setForm(prev => ({
                    ...prev,
                    createNewDairy: true,
                    dairy_id: '',
                    centre_id: ''
                }));
            } else {
                setForm(prev => ({
                    ...prev,
                    createNewDairy: false,
                    dairy_id: '',
                    centre_id: ''
                }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const submitData = { ...form };

            // Validate based on mode
            if (form.createNewDairy) {
                if (!form.dairy_name || !form.dairy_code || !form.centre_name || !form.centre_code) {
                    setError('Please fill in all required fields for new dairy');
                    setLoading(false);
                    return;
                }
                // Send new dairy creation data
                submitData.createNewDairy = true;
                // Remove unused fields
                delete submitData.dairy_id;
                delete submitData.centre_id;
            } else {
                if (!form.centre_id) {
                    setError('Please select a centre');
                    setLoading(false);
                    return;
                }
                submitData.createNewDairy = false;
                // Remove new dairy fields if not needed
                delete submitData.dairy_name;
                delete submitData.dairy_code;
                delete submitData.dairy_address;
                delete submitData.dairy_contact;
                delete submitData.centre_name;
                delete submitData.centre_code;
                delete submitData.centre_address;
                delete submitData.centre_contact;
            }

            const { data } = await api.post('/auth/admin/signup', submitData);
            login(data);
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-start justify-center px-4 py-8"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');`}</style>

            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl p-6 shadow-sm">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">D</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-900 leading-none">Dairy Management</p>
                        <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
                <p className="text-sm text-gray-500 mb-6">Set up your admin account to get started</p>

                {error && (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-5">
                        <span className="text-rose-400 text-sm">⚠</span>
                        <p className="text-sm text-rose-700">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Personal Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="name"
                                type="text"
                                value={form.name}
                                onChange={handleChange}
                                required
                                placeholder="Enter your full name"
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder="Enter your email"
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Mobile <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                                name="mobile"
                                type="tel"
                                value={form.mobile}
                                onChange={handleChange}
                                placeholder="+91XXXXXXXXXX"
                                pattern="^\+?[0-9]{10,15}$"
                                maxLength={15}
                                title="Enter a valid mobile number"
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    placeholder="Min 6 characters"
                                    className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 pr-16 text-sm
                                    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Dairy Selection Mode */}
                    <div className="flex items-center gap-3 py-2">
                        <input
                            type="checkbox"
                            name="createNewDairy"
                            checked={form.createNewDairy}
                            onChange={handleChange}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            id="createNewDairy"
                        />
                        <label htmlFor="createNewDairy" className="text-sm font-medium text-gray-700">
                            Create a new dairy (No existing dairy found?)
                        </label>
                    </div>

                    {!form.createNewDairy ? (
                        // Existing Dairy and Centre Selection
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Select Dairy <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="dairy_id"
                                        value={form.dairy_id}
                                        onChange={handleChange}
                                        required
                                        className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                    >
                                        <option value="">Select a dairy</option>
                                        {dairies.map(dairy => (
                                            <option key={dairy.dairy_id} value={dairy.dairy_id}>
                                                {dairy.dairy_name} ({dairy.dairy_code})
                                            </option>
                                        ))}
                                    </select>
                                    {loadingDairies && (
                                        <p className="text-xs text-gray-400">Loading dairies...</p>
                                    )}
                                    {dairies.length === 0 && !loadingDairies && (
                                        <p className="text-xs text-amber-600">
                                            No dairies found. Check "Create a new dairy" option.
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Select Centre <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="centre_id"
                                        value={form.centre_id}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.dairy_id || loadingCentres}
                                        className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition
                                        disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select a centre</option>
                                        {centres.map(centre => (
                                            <option key={centre.centre_id} value={centre.centre_id}>
                                                {centre.centre_name} ({centre.centre_code})
                                            </option>
                                        ))}
                                    </select>
                                    {loadingCentres && (
                                        <p className="text-xs text-gray-400">Loading centres...</p>
                                    )}
                                    {!form.dairy_id && (
                                        <p className="text-xs text-gray-400">Please select a dairy first</p>
                                    )}
                                    {form.dairy_id && centres.length === 0 && !loadingCentres && (
                                        <p className="text-xs text-amber-600">
                                            No centres found for this dairy.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        // New Dairy and Centre Creation Form
                        <>
                            <div className="border-t border-gray-200 pt-4 mt-2">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">New Dairy Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">
                                            Dairy Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="dairy_name"
                                            type="text"
                                            value={form.dairy_name}
                                            onChange={handleChange}
                                            required
                                            placeholder="Enter dairy name"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">
                                            Dairy Code <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="dairy_code"
                                            type="text"
                                            value={form.dairy_code}
                                            onChange={handleChange}
                                            required
                                            placeholder="e.g., GVD001"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                        <p className="text-xs text-gray-400">Unique code for the dairy</p>
                                    </div>

                                    <div className="flex flex-col gap-1.5 md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Dairy Address <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            name="dairy_address"
                                            type="text"
                                            value={form.dairy_address}
                                            onChange={handleChange}
                                            placeholder="Enter dairy address"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">
                                            Dairy Contact <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            name="dairy_contact"
                                            type="tel"
                                            value={form.dairy_contact}
                                            onChange={handleChange}
                                            placeholder="+91XXXXXXXXXX"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4 mt-2">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">New Centre Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">
                                            Centre Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="centre_name"
                                            type="text"
                                            value={form.centre_name}
                                            onChange={handleChange}
                                            required
                                            placeholder="Enter centre name"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">
                                            Centre Code <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="centre_code"
                                            type="text"
                                            value={form.centre_code}
                                            onChange={handleChange}
                                            required
                                            placeholder="e.g., MCC001"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                        <p className="text-xs text-gray-400">Unique code for the centre</p>
                                    </div>

                                    <div className="flex flex-col gap-1.5 md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Centre Address <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            name="centre_address"
                                            type="text"
                                            value={form.centre_address}
                                            onChange={handleChange}
                                            placeholder="Enter centre address"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">
                                            Centre Contact <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            name="centre_contact"
                                            type="tel"
                                            value={form.centre_contact}
                                            onChange={handleChange}
                                            placeholder="+91XXXXXXXXXX"
                                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || (!form.createNewDairy && !form.centre_id) || (form.createNewDairy && (!form.dairy_name || !form.dairy_code || !form.centre_name || !form.centre_code))}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl
                        text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                        {loading && (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="text-sm text-center text-gray-400 mt-6">
                    Already have an account?{' '}
                    <Link to="/" className="text-blue-600 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>

                <p className="text-sm text-center text-gray-400 mt-4">
                    Operator?{' '}
                    <Link to="/operator/login" className="text-blue-600 font-medium hover:underline">
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    );
}