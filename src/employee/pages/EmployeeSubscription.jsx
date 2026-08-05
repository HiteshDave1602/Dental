import { useEffect, useState } from 'react';
import api from '../../Script/api';

const EmployeeSubscription = () => {
  const [planData, setPlanData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [myPlanRes, plansRes] = await Promise.all([
          api.employee.subscription.myPlan(),
          api.employee.subscription.plans(),
        ]);
        if (!mounted) return;
        setPlanData(myPlanRes.data?.data || null);
        setPlans(plansRes.data?.data || []);
      } catch {
        // fall back to empty
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const usedPercent = planData
    ? planData.cases_limit === -1
      ? 20
      : Math.min(100, Math.round((planData.cases_used_this_month / planData.cases_limit) * 100))
    : 0;

  return (
    <div className="space-y-5 text-[#12344D]">
      <section className="glass-card p-5">
        <h2 className="employee-heading text-[#12344D] text-lg">Current Plan</h2>
        {loading ? (
          <p className="text-[#12344D]/60 mt-3 text-sm">Loading plan...</p>
        ) : planData ? (
          <>
            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <span className="px-3 py-1 rounded-full bg-[#c1e5ff] text-[#0a2472] border border-[#6ab0e3]">
                {planData.display_name} - {planData.status}
              </span>
            </div>
            <div className="mt-4 h-2 bg-[#c1e5ff] rounded-full overflow-hidden">
              <div className="h-full bg-[#6ab0e3]" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="text-xs text-[#12344D]/60 mt-2">
              {planData.cases_used_this_month} of{' '}
              {planData.cases_limit === -1 ? 'unlimited' : planData.cases_limit} cases used this month
              {planData.cases_remaining !== null && ` · ${planData.cases_remaining} remaining`}
            </p>
          </>
        ) : (
          <p className="text-[#12344D]/60 mt-3 text-sm">No subscription data found.</p>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <article
            key={plan.key}
            className={`glass-card p-4 ${plan.highlight ? 'border-[#6ab0e3] shadow-[0_0_16px_rgba(37,65,178,.25)]' : ''}`}
          >
            <h3 className="employee-heading text-[#12344D]">{plan.name}</h3>
            <p className="text-2xl text-[#072ac8] mt-2">
              {plan.price_inr === 0 ? 'Free' : `₹${plan.price_inr.toLocaleString('en-IN')}`}
            </p>
            <p className="text-sm text-[#12344D]/70 mt-2">
              Limit: {plan.cases_limit === -1 ? 'Unlimited' : plan.cases_limit} cases/month
            </p>
            <p className="text-xs text-[#12344D]/50 mt-1">{plan.description}</p>
            {planData && plan.key !== planData.plan && (
              <button className="mt-3 w-full h-9 rounded-full border border-[#6ab0e3] text-[#072ac8] text-sm font-semibold hover:bg-[#c1e5ff]">
                Upgrade
              </button>
            )}
            {planData && plan.key === planData.plan && (
              <p className="mt-3 text-xs text-emerald-600">✓ Current Plan</p>
            )}
          </article>
        ))}
      </section>

      <section className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#9cd5ff]/40 bg-[#f6fbfe]">
          <h3 className="employee-heading text-[#12344D]">Payment History</h3>
        </div>
        <div className="p-4 text-sm text-[#12344D]/60">
          Payment history will appear here after your first transaction.
        </div>
      </section>
    </div>
  );
};

export default EmployeeSubscription;
