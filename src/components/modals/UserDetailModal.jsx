import React, { useEffect, useState } from 'react';
import { X, User, Mail, Shield, Coins, AlertTriangle, Hash, Zap } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api, { extractErrorMessage, notifySuccess } from '../../Script/api';
import { cn } from '../../utils/utils';

const UserDetailModal = ({ isOpen, onClose, userId }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
    });

    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [assigningPlan, setAssigningPlan] = useState(false);
    const [planError, setPlanError] = useState('');

    useEffect(() => {
        if (!isOpen || !userId) return;
        let mounted = true;

        const load = async () => {
            setLoading(true);
            setError('');
            setUser(null);
            try {
                const res = await api.admin.getUser(userId);
                const data = res.data?.data ?? res.data;
                if (mounted) {
                    setUser(data);
                    setFormData({
                        username: data?.username || '',
                        email: data?.email || '',
                        password: '',
                    });
                }
            } catch (err) {
                if (mounted) setError(extractErrorMessage(err, 'Failed to load user details.'));
            } finally {
                if (mounted) setLoading(false);
            }
        };

        const loadPlans = async () => {
            try {
                const res = await api.plans.list({ page: 1, size: 100, is_archived: false });
                const body = res.data ?? {};
                const items = body.items ?? body.data ?? (Array.isArray(body) ? body : []);
                if (mounted) setPlans(Array.isArray(items) ? items : []);
            } catch {
                if (mounted) setPlans([]);
            }
        };

        load();
        loadPlans();
        return () => { mounted = false; };
    }, [isOpen, userId]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = {
                username: formData.username.trim(),
                email: formData.email.trim(),
            };
            if (formData.password.trim()) {
                payload.password = formData.password.trim();
            }
            const res = await api.admin.updateUser(userId, payload);
            const updated = res.data?.data ?? res.data ?? { ...user, ...payload };
            setUser(updated);
            setEditing(false);
            setFormData((prev) => ({ ...prev, password: '' }));
            notifySuccess('User updated successfully');
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to update user.'));
        } finally {
            setSaving(false);
        }
    };

    const handleAssignPlan = async () => {
        if (!selectedPlanId) return;
        setAssigningPlan(true);
        setPlanError('');
        try {
            await api.subscriptions.create({
                user_id: userId,
                plan_id: selectedPlanId,
                status: 'active',
            });
            notifySuccess('Plan assigned successfully');
            const res = await api.admin.getUser(userId);
            const data = res.data?.data ?? res.data;
            setUser(data);
            setSelectedPlanId('');
        } catch (err) {
            setPlanError(extractErrorMessage(err, 'Failed to assign plan.'));
        } finally {
            setAssigningPlan(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[520px] max-h-[90vh] flex flex-col bg-white rounded-[20px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="p-6 lg:p-8 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">
                        {editing ? 'Edit User' : 'User Details'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {loading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="h-3 w-20 bg-slate-100 rounded mb-2" />
                                    <div className="h-10 w-full bg-slate-100 rounded-lg" />
                                </div>
                            ))}
                        </div>
                    ) : error && !user ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                            {error}
                        </div>
                    ) : user ? (
                        <>
                            {/* User header card */}
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                                <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 border-2 border-white shadow-sm">
                                    {(user.username || user.email || '?').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-bold text-slate-900 truncate">
                                        {user.username || 'Unnamed'}
                                    </p>
                                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                                </div>
                                <span className={cn(
                                    "text-[11px] px-2.5 py-1 rounded-lg font-bold",
                                    user.is_admin ? "bg-teal-50 text-teal-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {user.is_admin ? 'Admin' : 'User'}
                                </span>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-blue-50 rounded-xl text-center">
                                    <Coins size={16} className="mx-auto text-blue-500 mb-1" />
                                    <p className="text-lg font-bold text-slate-900">{Number(user.credits ?? 0).toLocaleString()}</p>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Credits</p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-xl text-center">
                                    <AlertTriangle size={16} className="mx-auto text-amber-500 mb-1" />
                                    <p className="text-lg font-bold text-slate-900">{Number(user.credits_on_hold ?? 0).toLocaleString()}</p>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">On Hold</p>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-xl text-center">
                                    <Hash size={16} className="mx-auto text-emerald-500 mb-1" />
                                    <p className="text-lg font-bold text-slate-900">{user.cases_count ?? 0}</p>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Cases</p>
                                </div>
                            </div>

                            {/* Plan info */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <Shield size={16} className="text-slate-400" />
                                <span className="text-sm font-semibold text-slate-700">Active Plan:</span>
                                <span className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize",
                                    user.active_plan && user.active_plan !== 'free' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                                )}>
                                    {user.active_plan || 'free'}
                                </span>
                            </div>

                            {/* Assign plan */}
                            <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Zap size={12} /> Assign / Change Plan
                                </label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={selectedPlanId}
                                            onChange={(e) => setSelectedPlanId(e.target.value)}
                                            className="w-full h-11 bg-white border border-slate-200 rounded-lg pl-3 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-clinical-blue focus:ring-4 focus:ring-clinical-blue/10 appearance-none cursor-pointer"
                                        >
                                            <option value="">Select a plan...</option>
                                            {plans.map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name}{plan.price_rupee != null ? ` — ₹${Number(plan.price_rupee).toLocaleString()}/mo` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <Button
                                        onClick={handleAssignPlan}
                                        className="h-11 px-4 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm whitespace-nowrap flex-shrink-0"
                                        disabled={assigningPlan || !selectedPlanId}
                                    >
                                        {assigningPlan ? 'Assigning...' : 'Assign'}
                                    </Button>
                                </div>
                                {plans.length === 0 && (
                                    <p className="text-xs text-amber-600 ml-1 font-medium">No plans available. Create one from the Subscription Plans page first.</p>
                                )}
                                {planError && (
                                    <p className="text-xs text-rose-600 ml-1 font-medium">{planError}</p>
                                )}
                            </div>

                            {error && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                                    {error}
                                </div>
                            )}

                            {/* Edit form */}
                            {editing && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                                    <Input
                                        label="Username"
                                        icon={User}
                                        value={formData.username}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                                        className="h-12 bg-white border-slate-200 rounded-lg text-sm"
                                    />
                                    <Input
                                        label="Email"
                                        icon={Mail}
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                        className="h-12 bg-white border-slate-200 rounded-lg text-sm"
                                    />
                                    <Input
                                        label="New Password (leave blank to keep current)"
                                        type="password"
                                        icon={Shield}
                                        value={formData.password}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                                        className="h-12 bg-white border-slate-200 rounded-lg text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-6 lg:p-8 bg-slate-50/50 flex items-center justify-end gap-5 border-t border-slate-50 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
                    >
                        {editing ? 'Cancel' : 'Close'}
                    </button>
                    {editing ? (
                        <Button
                            onClick={handleSave}
                            className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setEditing(true)}
                            className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                        >
                            Edit User
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDetailModal;
