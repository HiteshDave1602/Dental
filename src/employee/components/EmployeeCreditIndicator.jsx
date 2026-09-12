import { useEffect, useState } from 'react';
import { Coins, AlertTriangle } from 'lucide-react';
import api, { notifyUsageExhausted } from '../../Script/api';

const EmployeeCreditIndicator = ({ autoHold = 0, compact = false }) => {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        api.employee.subscription.myPlan()
            .then((res) => {
                if (!mounted) return;
                const plan = res.data?.data || null;
                setPlan(plan);
                notifyUsageExhausted(plan);
            })
            .catch(() => {})
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    if (loading) return null;
    if (!plan) return null;

    const available = Number(plan.credits ?? 0);
    const projected = Math.max(0, available - Number(autoHold || 0));
    const low = projected < Number(autoHold || 0) || projected <= 0;

    if (compact) {
        return (
            <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    low
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
                title={`${available} credits available${autoHold ? `, ${autoHold} will be held` : ''}`}
            >
                <Coins size={12} />
                {available} credits
                {autoHold > 0 && <span className="opacity-70">→ {projected}</span>}
            </span>
        );
    }

    return (
        <div className="rounded-xl border border-[#9cd5ff]/70 bg-[#f6fbfe] p-4">
            <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-content-center rounded-xl bg-[#c1e5ff] text-[#072ac8]">
                    <Coins size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#12344D]/60">Credit Balance</p>
                    <p className="employee-heading text-2xl font-black text-[#12344D]">
                        {plan.credits ?? 0}
                        {autoHold > 0 && (
                            <span className="text-sm font-semibold text-[#12344D]/60">
                                {' '}
                                → <span className="text-[#072ac8]">{projected}</span> after upload
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {autoHold > 0 && (
                <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                    low
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                        Uploading this scan will hold{' '}
                        <span className="font-bold">{autoHold} credits</span>. Your balance after
                        processing: <span className="font-bold">{projected}</span>.
                        {low && ' You may run out of credits for this case.'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default EmployeeCreditIndicator;
