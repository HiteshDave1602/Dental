import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import api, { notifyError, notifySuccess } from '../Script/api';
import dentalVideo from '../assets/Untitled design.mp4';

const ResetPassword = () => {
    const navigate = useNavigate();
    const token = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resetFailed, setResetFailed] = useState(null);

    const minLength = 8;
    const maxLength = 256;
    const isTooShort = newPassword.length > 0 && newPassword.length < minLength;
    const isMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
    const isValid = newPassword.length >= minLength && newPassword.length <= maxLength && confirmPassword === newPassword;

    const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:bg-white focus:ring-4 focus:ring-teal-500/10';

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!token) return;
        if (!isValid) return;
        setIsLoading(true);
        setResetFailed(null);
        try {
            await api.auth.resetPassword(token, newPassword);
            notifySuccess('Password reset successfully. Please login with your new password.');
            navigate('/login');
        } catch (err) {
            const detail = err?.response?.data?.detail;
            const message = typeof detail === 'string' ? detail : 'Unable to reset password. The link may be invalid or expired.';
            setResetFailed(message);
            notifyError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f9f8] px-5 py-10">
            <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
            <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />

            <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-900/10 md:min-h-[570px] md:grid-cols-2">
                <aside className="relative min-h-[310px] overflow-hidden p-7 text-white md:min-h-full md:p-10">
                    <video
                        className="absolute inset-0 h-full w-full object-cover"
                        src={dentalVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-[#075e57]/90 via-[#0d9488]/75 to-[#1f9bbf]/55" />
                    <div className="relative flex h-full flex-col justify-between">
                        <div className="max-w-xs pt-14 md:pt-0">
                            <p className="mb-3 text-sm font-semibold text-white/75">Admin Portal</p>
                            <h1 className="text-3xl font-bold leading-tight md:text-4xl">Set a new password.</h1>
                            <p className="mt-4 text-sm leading-6 text-white/80">
                                {token
                                    ? 'Choose a strong password for your account. This link is valid for a limited time.'
                                    : 'This reset link is missing or incomplete. Request a new one from the login page.'}
                            </p>
                        </div>
                    </div>
                </aside>

                <div className="flex items-center justify-center px-7 py-10 sm:px-12 md:px-14">
                    <div className="w-full max-w-sm">
                        <div className="mb-8">
                            <p className="text-sm font-semibold text-[#0d9488]">ADMIN PORTAL</p>
                            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Reset password</h2>
                            <p className="mt-2 text-sm text-slate-500">{token ? 'Enter a new password for your account.' : 'The reset link is invalid or expired.'}</p>
                        </div>

                        {!token && (
                            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
                                <p className="text-sm leading-5 text-amber-800">
                                    The reset link is missing a token. Please request a new link to continue.
                                </p>
                            </div>
                        )}

                        {resetFailed && (
                            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
                                    <p className="text-sm leading-5 text-red-800">{resetFailed}</p>
                                </div>
                                <Link
                                    to="/forgot-password"
                                    className="ml-8 text-sm font-bold text-[#0d9488] hover:underline"
                                >
                                    Request a new link
                                </Link>
                            </div>
                        )}

                        {token ? (
                            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-slate-700">New password</span>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            className={`${inputClass} pl-11 pr-11`}
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(event) => setNewPassword(event.target.value)}
                                            placeholder="Minimum 8 characters"
                                            minLength={minLength}
                                            maxLength={maxLength}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((current) => !current)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {isTooShort && <p className="mt-1 text-xs font-medium text-red-600">Password must be at least {minLength} characters.</p>}
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-slate-700">Confirm new password</span>
                                    <div className="relative">
                                        <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            className={`${inputClass} pl-11`}
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(event) => setConfirmPassword(event.target.value)}
                                            placeholder="Repeat your new password"
                                            minLength={minLength}
                                            maxLength={maxLength}
                                            required
                                        />
                                    </div>
                                    {isMismatch && <p className="mt-1 text-xs font-medium text-red-600">Passwords do not match.</p>}
                                </label>

                                <button
                                    type="submit"
                                    disabled={isLoading || !isValid}
                                    className="mt-2 w-full rounded-xl bg-[#0d9488] py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:bg-[#0c857a] disabled:cursor-wait disabled:opacity-75"
                                >
                                    {isLoading ? 'Please wait…' : 'Reset password'}
                                </button>
                            </form>
                        ) : (
                            <Link
                                to="/forgot-password"
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:bg-[#0c857a]"
                            >
                                <KeyRound size={18} />
                                Request a new link
                            </Link>
                        )}

                        <p className="mt-7 text-center text-sm text-slate-500">
                            <Link to="/login" className="font-bold text-[#0d9488] hover:underline">
                                <ArrowLeft size={14} className="mr-1 inline" />
                                Back to login
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default ResetPassword;