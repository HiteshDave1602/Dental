import React, { useEffect, useState } from 'react';
import { X, CalendarDays, Wallet, User } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api, { extractErrorMessage, notifySuccess } from '../../Script/api';
import { cn } from '../../utils/utils';

const STATUS_OPTIONS = ['active', 'pending', 'paused', 'cancelled', 'expired'];

const SubscriptionDetailModal = ({ isOpen, onClose, subscriptionId, onUpdated }) => {
    const [sub, setSub] = useState(null);
    const [user, setUser] = useState(null);
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        status: 'active',
        start_date: '',
        end_date: '',
    });

    const loadDetail = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.subscriptions.get(subscriptionId);
            const data = res.data?.data ?? res.data;

            let userData = null;
            let planData = null;

            if (data?.user_id) {
                try {
                    const userRes = await api.admin.getUser(data.user_id);
                    userData = userRes.data?.data ?? userRes.data;
                } catch { /* user might be deleted */ }
            }
            if (data?.plan_id) {
                try {
                    const planRes = await api.plans.get(data.plan_id);
                    planData = planRes.data?.data ?? planRes.data;
                } catch { /* plan might be deleted */ }
            }

            setSub(data);
            setUser(userData);
            setPlan(planData);
            setFormData({
                status: data?.status || 'active',
                start_date: data?.start_date ? String(data.start_date).slice(0, 10) : '',
                end_date: data?.end_date ? String(data.end_date).slice(0, 10) : '',
            });
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to load subscription details.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && subscriptionId) loadDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, subscriptionId]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = {
                status: formData.status,
                start_date: formData.start_date || null,
                end_date: formData.end_date || null,
            };
            await api.subscriptions.update(subscriptionId, payload);
            notifySuccess('Subscription updated');
            onUpdated?.();
            await loadDetail();
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to update subscription.'));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const formatDate = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[520px] max-h-[90vh] flex flex-col bg-white rounded-[20px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-6 lg:p-8 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">Subscription Details</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

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
                    ) : error && !sub ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                            {error}
                        </div>
                    ) : sub ? (
                        <>
                            {/* Plan & User */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <Wallet size={16} className="text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                        {plan?.name ?? '—'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {plan?.price_rupee != null ? `₹${Number(plan.price_rupee).toLocaleString()}/mo` : 'Price n/a'}
                                        {plan?.credits != null ? ` · ${Number(plan.credits).toLocaleString()} credits` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <User size={16} className="text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                        {user?.username || String(sub.user_id).slice(0, 8) + '…'}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono truncate">{user?.email || sub.user_id}</p>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                                        <CalendarDays size={12} /> Started
                                    </p>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{formatDate(sub.start_date)}</p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-xl">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                                        <CalendarDays size={12} /> Ends
                                    </p>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{formatDate(sub.end_date)}</p>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                                    {error}
                                </div>
                            )}

                            {/* Edit form */}
                            <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                                    <div className="flex flex-wrap gap-2">
                                        {STATUS_OPTIONS.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setFormData((prev) => ({ ...prev, status: option }))}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all',
                                                    formData.status === option
                                                        ? 'bg-[#0d9488] text-white shadow-lg shadow-teal-500/20'
                                                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                                                )}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <Input
                                    label="Start Date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                                    className="h-11 bg-white border-slate-200 rounded-lg text-sm"
                                />
                                <Input
                                    label="End Date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                                    className="h-11 bg-white border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                        </>
                    ) : null}
                </div>

                <div className="p-6 lg:p-8 bg-slate-50/50 flex items-center justify-end gap-5 border-t border-slate-50 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
                    >
                        Close
                    </button>
                    <Button
                        onClick={handleSave}
                        className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionDetailModal;
