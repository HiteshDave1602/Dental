import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CirclePlay,
  Clock3,
  Crown,
  FolderKanban,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../Script/api';

const STATUS_CLASS = {
  completed: 'bg-[#6ab0e3] text-white border-[#6ab0e3]',
  processing: 'bg-[#9cd5ff]/35 text-[#12344D] border-[#6ab0e3]/55',
  pending: 'bg-[#c1e5ff]/60 text-[#12344D] border-[#9cd5ff]',
  failed: 'bg-[#12344D] text-white border-[#12344D]',
  deleted: 'bg-[#9cd5ff]/20 text-[#12344D]/65 border-[#9cd5ff]/50',
};

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, plan: 'free' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [casesRes, planRes] = await Promise.all([
          api.employee.cases.list({ page: 1, limit: 10 }),
          api.employee.subscription.myPlan(),
        ]);

        if (!mounted) return;

        const caseList = casesRes.data?.data || [];
        const planData = planRes.data?.data || {};

        setCases(caseList);
        setStats({
          total: casesRes.data?.pagination?.total || caseList.length,
          completed: caseList.filter((item) => item.status === 'completed').length,
          pending: caseList.filter((item) => item.status === 'pending').length,
          plan: planData.display_name || 'Free',
          casesUsed: planData.cases_used_this_month || 0,
          casesLimit: planData.cases_limit === -1 ? '∞' : planData.cases_limit,
        });
      } catch {
        // Silently fall back to the empty dashboard state.
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const statCards = [
    { label: 'Total Cases', value: stats.total, icon: FolderKanban },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2 },
    { label: 'In Progress', value: stats.pending, icon: Clock3 },
    { label: 'Current Plan', value: stats.plan, icon: Crown },
  ];

  return (
    <div className="space-y-6 text-[#12344D]">
      <section className="relative overflow-hidden rounded-2xl bg-[#2541b2] p-6 shadow-[0_14px_35px_rgba(37,65,178,0.3)] md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/30 bg-[#c1e5ff]/20 shadow-[inset_0_0_45px_rgba(255,255,255,0.12)]" />
        <div className="pointer-events-none absolute -bottom-24 right-28 h-52 w-52 rounded-full border border-white/20 bg-[#9cd5ff]/15" />
        <div className="pointer-events-none absolute -bottom-10 right-[42%] h-24 w-24 rounded-full border border-white/25 bg-white/10" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.22em] text-[#c1e5ff]">
              MyPathFinder workspace
            </p>
            <h2 className="employee-heading text-2xl font-bold text-white md:text-3xl">
              Good morning, Doctor
            </h2>
            <p className="mt-2 text-white/80">
              {loading
                ? 'Loading cases...'
                : `${stats.pending} case${stats.pending !== 1 ? 's' : ''} in progress`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/new-case')}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-[#12344D] shadow-lg shadow-[#6ab0e3]/25 transition-all hover:-translate-y-0.5 hover:bg-[#c1e5ff] focus:outline-none focus:ring-4 focus:ring-[#9cd5ff]/35"
          >
            <Plus size={18} /> New Case
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, index) => {
          const StatIcon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group rounded-2xl border border-[#0a2472] bg-white p-5 shadow-[0_10px_30px_rgba(10,36,114,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(10,36,114,0.28)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#12344D]/60">{stat.label}</p>
                  <p className="employee-heading mt-3 text-3xl font-bold capitalize text-[#12344D]">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
                <div className="grid h-11 w-11 place-content-center rounded-xl bg-[#c1e5ff] text-[#0a2472] transition-colors group-hover:bg-[#0a2472] group-hover:text-white">
                  <StatIcon size={21} />
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#c1e5ff]">
                <div
                  className="h-full rounded-full bg-[#6ab0e3]"
                  style={{ width: `${Math.min(38 + index * 16, 88)}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#0a2472] bg-white shadow-[0_10px_30px_rgba(10,36,114,0.18)]">
        <div className="border-b border-[#9cd5ff]/40 bg-[#f6fbfe] px-5 py-4 sm:px-6 sm:py-5">
          <span className="inline-flex rounded-full bg-[#6ab0e3] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
            Quick guide
          </span>
          <h3 className="employee-heading mt-3 text-lg font-semibold text-[#12344D] sm:text-2xl">
            How MyPathFinder Works
          </h3>
          <p className="mt-1 text-xs text-[#12344D]/70 sm:text-sm">
            Watch the step-by-step guide before starting your first case
          </p>
        </div>
        <div className="relative m-4 aspect-video overflow-hidden rounded-xl bg-white shadow-[0_6px_18px_rgba(10,36,114,0.12)] ring-1 ring-[#9cd5ff]/40 sm:m-5">
          <a
            href="https://www.youtube.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="Watch the MyPathFinder guide"
            className="group absolute inset-0 z-[2] grid place-content-center"
          >
            <div className="grid h-16 w-16 place-content-center rounded-full border border-[#6ab0e3]/40 bg-[#c1e5ff]/40 text-[#12344D] shadow-xl transition-all group-hover:scale-110 group-hover:bg-[#6ab0e3] group-hover:text-white sm:h-20 sm:w-20">
              <CirclePlay size={34} />
            </div>
          </a>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#0a2472] bg-white shadow-[0_10px_30px_rgba(10,36,114,0.18)]">
        <div className="flex items-center justify-between border-b border-[#9cd5ff]/50 bg-[#c1e5ff]/45 px-5 py-4">
          <div>
            <h3 className="employee-heading text-lg font-bold text-[#12344D]">Recent Cases</h3>
            <p className="mt-0.5 text-xs text-[#12344D]/55">Your latest patient case activity</p>
          </div>
          {stats.casesUsed !== undefined && (
            <p className="rounded-full bg-[#6ab0e3] px-3 py-1.5 text-xs font-medium text-white">
              {stats.casesUsed} of {stats.casesLimit} cases used this month
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#12344D]/60">Loading cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#12344D]/60">
            No cases yet.{' '}
            <button
              type="button"
              onClick={() => navigate('/new-case')}
              className="font-semibold text-[#6ab0e3] underline decoration-[#9cd5ff] underline-offset-4 hover:text-[#12344D]"
            >
              Create your first case
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 p-3 md:hidden">
              {cases.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-[#9cd5ff]/55 bg-[#c1e5ff]/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#12344D]">{row.case_reference}</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        STATUS_CLASS[row.status] || STATUS_CLASS.pending
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#12344D]/80">
                    {row.patient_name} · Age {row.patient_age}
                  </p>
                  <p className="mt-1 text-xs text-[#12344D]/60">
                    Teeth: {(row.teeth || []).map((tooth) => tooth.tooth_number).join(', ') || '—'}
                  </p>
                  <p className="mt-1 text-xs text-[#12344D]/60">
                    Date: {row.case_date || '—'}
                  </p>
                </article>
              ))}
            </div>
            <div className="hidden md:block">
              <table className="w-full table-fixed">
                <thead className="bg-[#c1e5ff]/30 text-left text-xs font-semibold uppercase tracking-wider text-[#12344D]/60">
                  <tr>
                    <th className="p-4">Case ID</th>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Age</th>
                    <th className="p-4">Teeth</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[#9cd5ff]/35 transition-colors hover:bg-[#c1e5ff]/35"
                    >
                      <td className="break-words p-4 font-semibold text-[#12344D]">
                        {row.case_reference}
                      </td>
                      <td className="break-words p-4 text-[#12344D]/80">{row.patient_name}</td>
                      <td className="p-4 text-[#12344D]/80">{row.patient_age}</td>
                      <td className="break-words p-4 text-[#12344D]/80">
                        {(row.teeth || []).map((tooth) => tooth.tooth_number).join(', ') || '—'}
                      </td>
                      <td className="break-words p-4 text-[#12344D]/80">
                        {row.case_date || '—'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${
                            STATUS_CLASS[row.status] || STATUS_CLASS.pending
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default EmployeeDashboard;
