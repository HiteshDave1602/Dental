import React, { useEffect, useState } from 'react';
import { X, User, Mail, Shield, Zap } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api, { extractErrorMessage, notifySuccess } from '../../Script/api';

const CreateUserModal = ({ isOpen, onClose, onCreated }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        planId: '',
    });
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setFormData({ username: '', email: '', password: '', planId: '' });
        setError('');
        setSaving(false);

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
    }, [isOpen]);

    if (!isOpen) return null;

    const canSubmit = () => formData.username.trim() && formData.email.trim() && formData.password.trim().length >= 6;

    const handleSubmit = async () => {
        setError('');
        setSaving(true);
        try {
            const userPayload = {
                username: formData.username.trim(),
                email: formData.email.trim(),
                password: formData.password.trim(),
            };
            const userRes = await api.admin.createUser(userPayload);
            const createdUser = userRes.data?.data ?? userRes.data ?? {};
            const userId = createdUser.id;

            if (userId && formData.planId) {
                try {
                    await api.subscriptions.create({
                        user_id: userId,
                        plan_id: formData.planId,
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
    };

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

                <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Username</label>
                        <Input
                            placeholder="e.g. Dr. Jane Doe"
                            value={formData.username}
                            onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                            icon={User}
                            className="h-12 bg-white border-slate-200 rounded-lg transition-all text-slate-700 font-medium text-sm"
                            required
                        />
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                        <Input
                            placeholder="e.g. jane@clinic.com"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                            icon={Mail}
                            className="h-12 bg-white border-slate-200 rounded-lg transition-all text-slate-700 font-medium text-sm"
                            required
                        />
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Password</label>
                        <Input
                            placeholder="Min. 6 characters"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                            icon={Shield}
                            className="h-12 bg-white border-slate-200 rounded-lg transition-all text-slate-700 font-medium text-sm"
                            required
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
                                value={formData.planId}
                                onChange={(e) => setFormData((prev) => ({ ...prev, planId: e.target.value }))}
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
                        onClick={onClose}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleSubmit}
                        className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                        disabled={saving || !canSubmit()}
                    >
                        {saving ? 'Creating...' : 'Create User'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateUserModal;