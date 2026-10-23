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

  const planCredits = planData?.plan_credits || 0;
  const usedPercent = planCredits
    ? Math.max(0, Math.min(100, Math.round(((planCredits - (planData.credits || 0)) / planCredits) * 100)))
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
              {planData.credits ?? 0} of {planCredits} credits left · {planData.cases_available ?? 0} cases available
              {planData.end_date && ` · ends ${new Date(planData.end_date).toLocaleDateString('en-IN')}`}
            </p>
          </>
        ) : (
          <p className="text-[#12344D]/60 mt-3 text-sm">No subscription data found.</p>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <article key={plan.id} className="glass-card p-4">
            <h3 className="employee-heading text-[#12344D]">{plan.name}</h3>
            <p className="text-2xl text-[#072ac8] mt-2">
              {plan.price_inr === 0 ? 'Free' : `₹${plan.price_inr.toLocaleString('en-IN')}`}
            </p>
            <p className="text-sm text-[#12344D]/70 mt-2">
              {plan.credits} credits · {plan.duration_days} days
            </p>
            <p className="text-xs text-[#12344D]/50 mt-1">{plan.description}</p>
            {planData && plan.id !== planData.plan_id && (
              <button className="mt-3 w-full h-9 rounded-full border border-[#6ab0e3] text-[#072ac8] text-sm font-semibold hover:bg-[#c1e5ff]">
                Upgrade
              </button>
            )}
            {planData && plan.id === planData.plan_id && (
              <p className="mt-3 text-xs text-emerald-600">✓ Current Plan</p>
            )}
          </article>
        ))}
      </section>

      {/* <section className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#9cd5ff]/40 bg-[#f6fbfe]">
          <h3 className="employee-heading text-[#12344D]">Transaction History</h3>
        </div>
        <div className="p-4 text-sm text-[#12344D]/60">
          View your full credit transaction history on the{' '}
          <a href="/credits" className="font-semibold text-[#072ac8] underline decoration-[#9cd5ff] underline-offset-4 hover:text-[#12344D]">
            Credit History page
          </a>.
        </div>
      </section> */}
    </div>
  );
};

export default EmployeeSubscription;
