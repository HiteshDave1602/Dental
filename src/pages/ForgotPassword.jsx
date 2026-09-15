import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import api from '../Script/api';
import dentalVideo from '../assets/Untitled design.mp4';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:bg-white focus:ring-4 focus:ring-teal-500/10';

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!email.trim()) return;
        setIsLoading(true);
        try {
            await api.auth.forgotPassword(email.trim());
        } catch {
            // Enumeration-safe endpoint: the backend deliberately returns the
            // same success body whether or not the account exists, and treats
            // errors (rate limits, unknown emails) the same way. Always show
            // the generic success message so the response can never be used to
            // enumerate accounts.
        } finally {
            setIsLoading(false);
            setEmailSent(true);
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
                            <p className="mb-3 text-sm font-semibold text-white/75">Trouble signing in?</p>
                            <h1 className="text-3xl font-bold leading-tight md:text-4xl">Let&apos;s get you back in.</h1>
                            <p className="mt-4 text-sm leading-6 text-white/80">
                                Enter the email tied to your account and we&apos;ll send you a secure link to reset your password.
                            </p>
                        </div>
                    </div>
                </aside>

                <div className="flex items-center justify-center px-7 py-10 sm:px-12 md:px-14">
                    <div className="w-full max-w-sm">
                        <div className="mb-8">
                            <p className="text-sm font-semibold text-[#0d9488]">ADMIN PORTAL</p>
                            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Forgot password</h2>
                            <p className="mt-2 text-sm text-slate-500">We&apos;ll email you a link to reset your administrator password.</p>
                        </div>

                        {emailSent ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                    <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                                    <p className="text-sm leading-5 text-emerald-800">
                                        If an account exists for <span className="font-bold">{email.trim()}</span>, an administrator password reset link has been sent.
                                    </p>
                                </div>
                                <Link
                                    to="/login"
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:bg-[#0c857a]"
                                >
                                    <ArrowLeft size={18} />
                                    Back to login
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            className={`${inputClass} pl-11`}
                                            type="email"
                                            name="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            placeholder="admin@implascan.com"
                                            required
                                        />
                                    </div>
                                </label>

                                <button
                                    type="submit"
                                    disabled={isLoading || !email.trim()}
                                    className="mt-2 w-full rounded-xl bg-[#0d9488] py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:bg-[#0c857a] disabled:cursor-wait disabled:opacity-75"
                                >
                                    {isLoading ? 'Please wait…' : 'Send reset link'}
                                </button>
                            </form>
                        )}

                        <p className="mt-7 flex items-center justify-center gap-1.5 text-center text-sm text-slate-500">
                            <KeyRound size={14} className="text-slate-400" />
                            <Link to="/login" className="font-bold text-[#0d9488] hover:underline">Back to login</Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default ForgotPassword;