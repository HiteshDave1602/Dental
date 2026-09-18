import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import api, { notifyUsageExhausted } from '../../Script/api';

const EmployeeCreditIndicator = () => {
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
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EmployeeCreditIndicator;