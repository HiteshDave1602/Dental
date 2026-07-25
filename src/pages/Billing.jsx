import React, { useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, Waypoints } from 'lucide-react';
import { cn } from '../utils/utils';
import Input from '../components/ui/Input';
import api, { extractErrorMessage } from '../Script/api';

const STATUS_CLASS = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    paused: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    expired: 'bg-rose-50 text-rose-700 border-rose-200',
};

const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

/**
 * Subscriptions, from the API.
 *
 * This page previously rendered a hardcoded array — invented revenue figures
 * and made-up clinician names ("Dr. Sarah Smith", "$128,450.00") shown as
 * though they were real records. In an admin panel for a medical product that
 * is worse than an empty page, so it now reports only what the backend has,
 * and says plainly when there is nothing.
 */
const Billing = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [subscriptions, setSubscriptions] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [subsRes, plansRes] = await Promise.all([
                    api.subscriptions.list({ page: 1, size: 100 }),
                    api.plans.list().catch(() => ({ data: [] })),
                ]);
                if (cancelled) return;
                const body = subsRes.data ?? {};
                setSubscriptions(body.items ?? body.data ?? []);
                const planBody = plansRes.data ?? {};
                setPlans(planBody.items ?? planBody.data ?? (Array.isArray(planBody) ? planBody : []));
            } catch (err) {
                if (!cancelled) setError(extractErrorMessage(err, 'Failed to load subscriptions.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const planById = useMemo(
        () => Object.fromEntries(plans.map((p) => [String(p.id), p])),
        [plans],
    );

    const activeCount = subscriptions.filter((s) => s.status === 'active').length;

    // Monthly recurring revenue from active subscriptions, priced from the
    // plans the subscriptions actually reference.
    const mrr = subscriptions
        .filter((s) => s.status === 'active')
        .reduce((sum, s) => sum + Number(planById[String(s.plan_id)]?.price_rupee ?? 0), 0);

    const filtered = subscriptions.filter((s) => {
        if (!searchTerm) return true;
        const needle = searchTerm.toLowerCase();
        const plan = planById[String(s.plan_id)]?.name ?? '';
        return String(s.user_id).toLowerCase().includes(needle)
            || plan.toLowerCase().includes(needle)
            || String(s.status).toLowerCase().includes(needle);
    });

    const stats = [
        {
            title: 'Monthly Recurring Revenue',
            value: mrr ? `₹${mrr.toLocaleString()}` : '—',
            trend: `${activeCount} active subscription${activeCount === 1 ? '' : 's'}`,
            icon: TrendingUp,
            iconClass: 'bg-[#eefcfb] text-[#0d9488]',
        },
        {
            title: 'Subscriptions',
            value: String(subscriptions.length),
            trend: `${plans.length} plan${plans.length === 1 ? '' : 's'} configured`,
            icon: Waypoints,
            iconClass: 'bg-indigo-50 text-indigo-500',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">
                    Billing &amp; Subscriptions
                </h1>
                <p className="text-sm text-slate-400">Subscription records and plan revenue.</p>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.map((stat) => (
                    <div key={stat.title} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{stat.title}</p>
                                <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '…' : stat.value}</p>
                                <p className="text-xs text-slate-400 mt-1">{loading ? '' : stat.trend}</p>
                            </div>
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.iconClass)}>
                                <stat.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-50">
                    <div className="relative max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search by plan, status or user id…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 pl-9 bg-white border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <p className="p-8 text-center text-sm text-slate-400">Loading subscriptions…</p>
                ) : filtered.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                        {subscriptions.length === 0
                            ? 'No subscriptions yet.'
                            : 'No subscriptions match that search.'}
                    </p>
                ) : (
                    <table className="w-full">
                        <thead className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            <tr className="border-b border-slate-50">
                                <th className="p-4">Plan</th>
                                <th className="p-4">User</th>
                                <th className="p-4">Price</th>
                                <th className="p-4">Started</th>
                                <th className="p-4">Ends</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s) => {
                                const plan = planById[String(s.plan_id)];
                                return (
                                    <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                        <td className="p-4 text-sm font-semibold text-slate-700">{plan?.name ?? '—'}</td>
                                        <td className="p-4 text-xs text-slate-500 font-mono">{String(s.user_id).slice(0, 8)}…</td>
                                        <td className="p-4 text-sm text-slate-700">
                                            {plan?.price_rupee != null ? `₹${Number(plan.price_rupee).toLocaleString()}` : '—'}
                                        </td>
                                        <td className="p-4 text-sm text-slate-500">{formatDate(s.start_date)}</td>
                                        <td className="p-4 text-sm text-slate-500">{formatDate(s.end_date)}</td>
                                        <td className="p-4">
                                            <span className={cn(
                                                'text-xs px-2 py-1 rounded-full border font-semibold',
                                                STATUS_CLASS[s.status] || 'bg-slate-100 text-slate-600 border-slate-200',
                                            )}>
                                                {s.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Billing;
