import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function ForgotPassword() {
    const [step, setStep] = useState("email"); // "email" | "otp" | "reset" | "done"
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setStep('otp');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP. Check your email.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/verify-otp', { email, otp });
            setStep('reset');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid or expired OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/reset-password', { email, otp, password });
            setStep('done');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition";

    return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');`}</style>

            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-8 shadow-sm">

                {/* Logo */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">A</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-900 leading-none">Dairy Management</p>
                        <p className="text-xs text-gray-400 mt-0.5">Password Recovery</p>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {["email", "otp", "reset"].map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition
                                ${step === s || (step === "done" && i === 2)
                                    ? "bg-blue-600 text-white"
                                    : ["otp", "reset", "done"].indexOf(step) > i
                                        ? "bg-emerald-500 text-white"
                                        : "bg-gray-100 text-gray-400"}`}>
                                {["otp", "reset", "done"].indexOf(step) > i ? "✓" : i + 1}
                            </div>
                            {i < 2 && <div className={`flex-1 h-px w-8 ${["otp", "reset", "done"].indexOf(step) > i ? "bg-emerald-400" : "bg-gray-200"}`} />}
                        </div>
                    ))}
                    <span className="text-xs text-gray-400 ml-1">
                        {step === "email" ? "Enter email" : step === "otp" ? "Verify OTP" : step === "reset" ? "New password" : "Done"}
                    </span>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-5">
                        <span className="text-rose-400 text-sm">⚠</span>
                        <p className="text-sm text-rose-700">{error}</p>
                    </div>
                )}

                {/* Step: Email */}
                {step === "email" && (
                    <>
                        <h1 className="text-xl font-bold text-gray-900 mb-1">Forgot password?</h1>
                        <p className="text-sm text-gray-500 mb-5">Enter your registered email and we'll send you a reset OTP.</p>
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                    placeholder="Enter your email" className={inputClass} />
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                                {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        </form>
                    </>
                )}

                {/* Step: OTP */}
                {step === "otp" && (
                    <>
                        <h1 className="text-xl font-bold text-gray-900 mb-1">Check your email</h1>
                        <p className="text-sm text-gray-500 mb-5">We sent a 6-digit OTP to <strong className="text-gray-700">{email}</strong>. Enter it below.</p>
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">OTP Code</label>
                                <input type="text" inputMode="numeric" maxLength={6} value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required
                                    placeholder="Enter 6-digit OTP"
                                    className={`${inputClass} tracking-[0.3em] text-center text-lg font-bold`} />
                            </div>
                            <button type="submit" disabled={loading || otp.length < 6}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                                {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                                className="w-full text-sm text-gray-400 hover:text-gray-600 transition">
                                ← Use a different email
                            </button>
                        </form>
                    </>
                )}

                {/* Step: Reset */}
                {step === "reset" && (
                    <>
                        <h1 className="text-xl font-bold text-gray-900 mb-1">Set new password</h1>
                        <p className="text-sm text-gray-500 mb-5">Choose a strong password for your account.</p>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">New Password</label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={password}
                                        onChange={e => setPassword(e.target.value)} required
                                        placeholder="At least 6 characters"
                                        className={`${inputClass} pr-16`} />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                                        {showPass ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                                <input type="password" value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)} required
                                    placeholder="Repeat your password" className={inputClass} />
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="text-xs text-rose-500 mt-0.5">Passwords do not match</p>
                                )}
                            </div>
                            <button type="submit" disabled={loading || password !== confirmPassword}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                                {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    </>
                )}

                {/* Step: Done */}
                {step === "done" && (
                    <div className="text-center py-4">
                        <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-emerald-500 text-2xl">✓</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-1">Password reset!</h1>
                        <p className="text-sm text-gray-500 mb-6">Your password has been updated successfully. You can now sign in.</p>
                        <Link to="/"
                            className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition">
                            Back to Sign In
                        </Link>
                    </div>
                )}

                {step !== "done" && (
                    <p className="text-sm text-center text-gray-400 mt-6">
                        Remember it?{' '}
                        <Link to="/" className="text-blue-600 font-medium hover:underline">Sign in</Link>
                    </p>
                )}
            </div>
        </div>
    );
}