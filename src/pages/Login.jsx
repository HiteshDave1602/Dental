import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Microscope } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Login = () => {
    const navigate = useNavigate();
    const { setAuth, setUser } = useGlobal();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const currentUser = {
            name: formData.email || 'Demo Administrator',
            role: 'System Administrator',
            email: formData.email,
        };

        setAuth({ isAuthenticated: true, token: 'local-dashboard-access' });
        setUser(currentUser);
        setIsLoading(false);
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-clinical-blue/5 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-clinical-teal/5 rounded-full blur-3xl animate-pulse delay-700"></div>

            <div className="z-10 w-full max-w-[520px] px-6 flex flex-col items-center">
                {/* Logo & Header */}
                <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-16 h-16 bg-[#0d9488] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-teal-500/20 mb-6 group transition-transform hover:scale-105 duration-300">
                        <Microscope size={32} className="group-hover:rotate-12 transition-transform duration-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">ImplaScan Admin</h1>
                    <p className="text-slate-500 text-center font-medium">Enter your credentials to access the analysis dashboard.</p>
                </div>

                {/* Login Card */}
                <div className="w-full bg-white rounded-2xl shadow-2xl shadow-slate-200/60 p-10 border border-slate-200/60 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                    <form onSubmit={handleLogin} className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-800 ml-1">Email Address</label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                                placeholder="admin@implascan.com"
                                icon={Mail}
                                className="bg-slate-50/50 border-slate-200 h-14 rounded-xl focus:bg-white transition-all text-base"
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-800 ml-1">Password</label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
                                    placeholder="••••••••"
                                    icon={Lock}
                                    className="bg-slate-50/50 border-slate-200 h-14 rounded-xl focus:bg-white transition-all pr-12 text-base"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-clinical-teal focus:ring-clinical-teal/20 transition-all cursor-pointer" />
                                <span className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">Remember me</span>
                            </label>
                            <button type="button" className="text-sm font-bold text-[#0d9488] hover:underline transition-all">Forgot password?</button>
                        </div>

                        {error ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                                {error}
                            </div>
                        ) : null}

                        <Button
                            type="submit"
                            className="w-full h-14 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-xl font-bold text-base shadow-lg shadow-teal-500/25 transition-all active:scale-[0.98]"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Signing in...</span>
                                </div>
                            ) : (
                                "Sign in to Dashboard"
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-50 flex justify-center">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                            <ShieldCheck size={14} className="text-[#0d9488]" />
                            SECURE ADMIN PORTAL
                        </div>
                    </div>
                </div>

                {/* Navigation Footer */}
                <div className="mt-12 flex items-center justify-center gap-8 w-full">
                    <button className="text-[13px] text-slate-400 font-semibold hover:text-slate-600 transition-colors">Terms of Service</button>
                    <button className="text-[13px] text-slate-400 font-semibold hover:text-slate-600 transition-colors">Privacy Policy</button>
                    <button className="text-[13px] text-slate-400 font-semibold hover:text-slate-600 transition-colors">Support</button>
                </div>
            </div>
        </div>
    );
};

export default Login;
