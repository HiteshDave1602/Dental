import { useEffect, useState } from 'react';
import {
  Coins,
  AlertTriangle,
  Mail,
  Crown,
  CalendarDays,
  Hash,
} from 'lucide-react';
import api from '../../Script/api';
import { useEmployee } from '../../context/EmployeeContext';

const EmployeeProfile = () => {
  const { employeeUser } = useEmployee();

  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [meRes, planRes] = await Promise.all([
          api.employee.auth.me().catch(() => null),
          api.employee.subscription.myPlan(),
        ]);
        if (!mounted) return;

        const meData = meRes?.data?.data || meRes?.data;
        setUser(meData);
        setPlan(planRes.data?.data || null);
      } catch {
        // fall back to context user
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const displayName = user?.full_name || user?.name || employeeUser?.name || 'User';
  const displayEmail = user?.email || employeeUser?.email || '—';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const usedPercent = plan
    ? plan.cases_limit === -1
      ? 0
      : Math.min(100, Math.round(((plan.cases_used_this_month || 0) / plan.cases_limit) * 100))
    : 0;

  return (
    <div className="space-y-5 text-[#12344D]">
      {/* User Info */}
      <section className="glass-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-content-center rounded-2xl bg-[#2541b2] text-2xl font-bold text-white shadow-lg shadow-[#2541b2]/30">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="employee-heading text-xl font-bold text-[#12344D]">
              {loading ? 'Loading...' : displayName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#12344D]/70">
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} className="text-[#6ab0e3]" />
                {loading ? '—' : displayEmail}
              </span>
              {plan && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <Crown size={14} className="text-[#6ab0e3]" />
                    <span className="inline-flex items-center rounded-full bg-[#c1e5ff] px-2.5 py-0.5 text-xs font-semibold text-[#0a2472] border border-[#6ab0e3]">
                      {plan.display_name || plan.plan || 'Free'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-[#6ab0e3]" />
                    {plan.status === 'active' ? 'Active' : plan.status || '—'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Credit Balance + Usage */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Credit Balance */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 place-content-center rounded-xl bg-[#c1e5ff] text-[#072ac8]">
              <Coins size={20} />
            </div>
            <h3 className="employee-heading text-base font-bold text-[#12344D]">Credit Balance</h3>
          </div>

          {loading ? (
            <p className="text-sm text-[#12344D]/60">Loading...</p>
          ) : plan ? (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className="employee-heading text-4xl font-black text-[#12344D]">
                  {plan.credits ?? 0}
                </span>
                <span className="mb-1 text-sm text-[#12344D]/60">credits available</span>
              </div>
              {(plan.credits_on_hold ?? 0) > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-700">
                    <span className="font-semibold">{plan.credits_on_hold}</span> credit{plan.credits_on_hold !== 1 ? 's' : ''} on hold
                  </span>
                </div>
              )}
              {plan.price_inr !== undefined && (
                <p className="text-xs text-[#12344D]/50">
                  Plan price: ₹{(plan.price_inr || 0).toLocaleString('en-IN')}/month
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#12344D]/60">No plan data found.</p>
          )}
        </div>

        {/* Usage Stats */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 place-content-center rounded-xl bg-[#c1e5ff] text-[#072ac8]">
              <Hash size={20} />
            </div>
            <h3 className="employee-heading text-base font-bold text-[#12344D]">Case Usage</h3>
          </div>

          {loading ? (
            <p className="text-sm text-[#12344D]/60">Loading...</p>
          ) : plan ? (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className="employee-heading text-4xl font-black text-[#12344D]">
                  {plan.cases_used_this_month ?? 0}
                </span>
                <span className="mb-1 text-sm text-[#12344D]/60">
                  of {plan.cases_limit === -1 ? '∞' : plan.cases_limit ?? 0} cases
                </span>
              </div>

              {plan.cases_limit !== -1 && (
                <div className="h-2.5 bg-[#c1e5ff] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6ab0e3] rounded-full transition-all duration-500"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[#12344D]/60">
                <span>{usedPercent}% used this month</span>
                {plan.cases_remaining !== null && plan.cases_remaining !== undefined && (
                  <span className="font-semibold text-[#072ac8]">
                    {plan.cases_remaining} remaining
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#12344D]/60">No usage data found.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default EmployeeProfile;
