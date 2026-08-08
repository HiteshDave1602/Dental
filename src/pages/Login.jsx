import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { Mail, Lock, Eye, EyeOff, Microscope, UserRound } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import dentalVideo from '../assets/Untitled design.mp4';
import { loginValidationSchema, signupValidationSchema } from '../utils/authValidation';

const Login = () => {
    const navigate = useNavigate();
    const { setAuth, setUser } = useGlobal();
    const [isRegistering, setIsRegistering] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const formik = useFormik({
        initialValues: { name: '', email: '', password: '' },
        validationSchema: isRegistering ? signupValidationSchema : loginValidationSchema,
        onSubmit: (values) => {
        setIsLoading(true);

        setAuth({ isAuthenticated: true, token: 'local-dashboard-access' });
        setUser({
            name: isRegistering ? values.name || 'New Administrator' : values.email || 'Demo Administrator',
            role: 'System Administrator',
            email: values.email,
        });
        setIsLoading(false);
        navigate('/dashboard');
        },
    });
    const formData = formik.values;
    const updateField = (field) => (event) => formik.setFieldValue(field, event.target.value);

    const switchMode = () => {
        setIsRegistering((current) => !current);
        setShowPassword(false);
        formik.setTouched({});
    };

    const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:bg-white focus:ring-4 focus:ring-teal-500/10';

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f9f8] px-5 py-10">
            <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
            <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />

            <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-900/10 md:min-h-[570px] md:grid-cols-2">
                <aside className={`relative min-h-[310px] overflow-hidden p-7 text-white transition-all duration-700 md:min-h-full md:p-10 ${isRegistering ? 'md:order-2' : 'md:order-1'}`}>
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
                            <p className="mb-3 text-sm font-semibold text-white/75">{isRegistering ? 'Already a member?' : 'New to ImplaScan?'}</p>
                            <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                                {isRegistering ? 'Welcome back.' : 'Hello, welcome!'}
                            </h1>
                            <p className="mt-4 text-sm leading-6 text-white/80">
                                {isRegistering ? 'Sign in to continue managing your dental analysis workspace.' : 'Create an account and bring clarity to every implant analysis.'}
                            </p>
                            <button
                                type="button"
                                onClick={switchMode}
                                className="mt-7 rounded-xl border border-white/75 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white hover:text-[#0d9488] focus:outline-none focus:ring-4 focus:ring-white/30"
                            >
                                {isRegistering ? 'Login' : 'Register'}
                            </button>
                        </div>
                    </div>
                </aside>

                <div className={`flex items-center justify-center px-7 py-10 transition-all duration-700 sm:px-12 md:px-14 ${isRegistering ? 'md:order-1' : 'md:order-2'}`}>
                    <div className="w-full max-w-sm">
                        <div className="mb-8">
                            <p className="text-sm font-semibold text-[#0d9488]">{isRegistering ? 'GET STARTED' : 'ADMIN PORTAL'}</p>
                            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{isRegistering ? 'Create account' : 'Login'}</h2>
                            <p className="mt-2 text-sm text-slate-500">{isRegistering ? 'Set up your ImplaScan workspace.' : 'Use your credentials to access the dashboard.'}</p>
                        </div>

                        <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
                            {isRegistering && (
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span>
                                    <div className="relative">
                                        <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input className={`${inputClass} pl-11`} name="name" value={formik.values.name} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="Dr. Jane Smith" />
                                    </div>
                                    {formik.touched.name && formik.errors.name && <p className="mt-1 text-xs font-medium text-red-600">{formik.errors.name}</p>}
                                </label>
                            )}
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input className={`${inputClass} pl-11`} name="email" type="email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="admin@implascan.com" aria-invalid={Boolean(formik.touched.email && formik.errors.email)} />
                                </div>
                                {formik.touched.email && formik.errors.email && <p className="mt-1 text-xs font-medium text-red-600">{formik.errors.email}</p>}
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input className={`${inputClass} px-11`} type={showPassword ? 'text' : 'password'} value={formData.password} onChange={updateField('password')} placeholder="••••••••" required />
                                    <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </label>

                            {!isRegistering && <div className="flex justify-end"><button type="button" className="text-sm font-semibold text-[#0d9488] hover:underline">Forgot password?</button></div>}

                            <button type="submit" disabled={isLoading} className="mt-2 w-full rounded-xl bg-[#0d9488] py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:bg-[#0c857a] disabled:cursor-wait disabled:opacity-75">
                                {isLoading ? 'Please wait…' : isRegistering ? 'Create account' : 'Login'}
                            </button>
                        </form>

                        <p className="mt-7 text-center text-sm text-slate-500">
                            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button type="button" onClick={switchMode} className="font-bold text-[#0d9488] hover:underline">{isRegistering ? 'Login' : 'Register'}</button>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Login;
