import React, { useEffect, useState } from 'react';
import { X, User, Mail, Shield, Zap, Eye, EyeOff } from 'lucide-react';
import { useFormik } from 'formik';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api, { extractErrorMessage, notifySuccess } from '../../Script/api';
import { userValidationSchema } from '../../utils/formValidation';

const CreateUserModal = ({ isOpen, onClose, onCreated }) => {
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const formik = useFormik({
        initialValues: { username: '', email: '', password: '', planId: '' },
        validationSchema: userValidationSchema,
        onSubmit: async (values) => {
            setError('');
            setSaving(true);
            try {
                const userPayload = {
                    username: values.username.trim(),
                    email: values.email.trim(),
                    password: values.password.trim(),
                };
                const userRes = await api.admin.createUser(userPayload);
                const createdUser = userRes.data?.data ?? userRes.data ?? {};
                const userId = createdUser.id;

                if (userId && values.planId) {
                    try {
                        await api.subscriptions.create({
                            user_id: userId,
                            plan_id: values.planId,
                            status: 'active',
                        });
                    } catch (err) {
                        notifySuccess('User created, but plan assignment failed.');
                        setError(`User created successfully, but plan assignment failed: ${extractErrorMessage(err, 'Plan assignment error.')}`);
                    }
                }
                notifySuccess('User created successfully');
                onClose();
                onCreated?.();
            } catch (err) {
                setError(extractErrorMessage(err, 'Failed to create user.'));
            } finally {
                setSaving(false);
            }
        },
    });

    // formik is stable per-mount; only isOpen changes should reset the form
    useEffect(() => {
        if (!isOpen) return;
        formik.resetForm({ values: { username: '', email: '', password: '', planId: '' } });
        setError('');
        setSaving(false);
        setShowPassword(false);

        let mounted = true;
        setLoadingPlans(true);
        (async () => {
            try {
                const res = await api.plans.list({ page: 1, size: 100, is_archived: false });
                const body = res.data ?? {};
                const items = body.items ?? body.data ?? (Array.isArray(body) ? body : []);
                if (mounted) setPlans(Array.isArray(items) ? items : []);
            } catch {
                if (mounted) setPlans([]);
            } finally {
                if (mounted) setLoadingPlans(false);
            }
        })();
        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formik is stable per-mount; only isOpen changes should reset the form
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[520px] max-h-[90vh] flex flex-col bg-white rounded-[20px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-6 lg:p-8 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">Create New User</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={formik.handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Username</label>
                            <Input
                                placeholder="e.g. Dr. Jane Doe"
                                name="username"
                                value={formik.values.username}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.username && formik.errors.username}
                                icon={User}
                                className="h-12 bg-white border-slate-200 rounded-lg transition-all text-slate-700 font-medium text-sm"
                            />
                        </div>

                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                            <Input
                                placeholder="e.g. jane@clinic.com"
                                type="email"
                                name="email"
                                value={formik.values.email}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.email && formik.errors.email}
                                icon={Mail}
                                className="h-12 bg-white border-slate-200 rounded-lg transition-all text-slate-700 font-medium text-sm"
                            />
                        </div>

                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Password</label>
                            <Input
                                placeholder="Min. 6 characters"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formik.values.password}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.password && formik.errors.password}
                                icon={Shield}
                                rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                onRightIconClick={() => setShowPassword((current) => !current)}
                                rightIconLabel={showPassword ? 'Hide password' : 'Show password'}
                                className="h-12 bg-white border-slate-200 rounded-lg transition-all text-slate-700 font-medium text-sm"
                            />
                        </div>

                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                Assign Plan <span className="normal-case text-slate-300">(optional)</span>
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Zap size={18} />
                                </div>
                                <select
                                    name="planId"
                                    value={formik.values.planId}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    className="w-full h-12 bg-white border border-slate-200 rounded-lg pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-clinical-blue focus:ring-4 focus:ring-clinical-blue/10 appearance-none cursor-pointer"
                                    disabled={loadingPlans}
                                >
                                    <option value="">No plan (free tier)</option>
                                    {plans.map((plan) => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name}{plan.price_rupee != null ? ` — ₹${Number(plan.price_rupee).toLocaleString()}/mo` : ''}{plan.credits != null ? ` · ${Number(plan.credits).toLocaleString()} credits` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {loadingPlans && (
                                <p className="text-xs text-slate-400 ml-1 font-medium">Loading plans...</p>
                            )}
                            {plans.length === 0 && !loadingPlans && (
                                <p className="text-xs text-amber-600 ml-1 font-medium">No plans available. Create one from the Subscription Plans page first.</p>
                            )}
                        </div>

                        {error ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                                {error}
                            </div>
                        ) : null}
                    </div>

                    <div className="p-6 lg:p-8 bg-slate-50/50 flex items-center justify-end gap-5 border-t border-slate-50 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
                        >
                            Cancel
                        </button>
                        <Button
                            type="submit"
                            className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                            disabled={saving || !formik.isValid}
                        >
                            {saving ? 'Creating...' : 'Create User'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;