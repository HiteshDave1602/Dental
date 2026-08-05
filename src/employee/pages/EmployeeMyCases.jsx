import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import api, { notifyError } from '../../Script/api';

const STATUS_CLASS = {
  completed: 'bg-[#6ab0e3] text-white border-[#6ab0e3]',
  processing: 'bg-[#9cd5ff]/35 text-[#12344D] border-[#6ab0e3]/55',
  pending: 'bg-[#c1e5ff]/60 text-[#12344D] border-[#9cd5ff]',
  failed: 'bg-[#12344D] text-white border-[#12344D]',
};

const TOLERANCE_CLASS = {
  within: 'text-emerald-600',
  marginal: 'text-amber-600',
  exceeds: 'text-rose-600',
};

const EmployeeMyCases = () => {
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Alignment results per case, loaded on demand. Previously this page showed
  // nothing about a case's analysis at all — the review workflow's output was
  // never written back anywhere the dentist could see it.
  const [expanded, setExpanded] = useState(null);
  const [results, setResults] = useState({});   // caseId -> analysis | 'loading' | 'none'

  const toggleResults = async (caseId) => {
    if (expanded === caseId) {
      setExpanded(null);
      return;
    }
    setExpanded(caseId);
    if (results[caseId]) return;

    setResults((prev) => ({ ...prev, [caseId]: 'loading' }));
    try {
      const res = await api.employee.analysis.results(caseId);
      setResults((prev) => ({ ...prev, [caseId]: res.data?.data ?? res.data ?? 'none' }));
    } catch {
      setResults((prev) => ({ ...prev, [caseId]: 'none' }));
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.employee.cases.list(params);
      setCases(res.data?.data || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      notifyError('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadCases();
  };

  const exportAll = () => {
    const csv = [
      ['Case ID', 'Patient', 'Age', 'Date', 'Status'].join(','),
      ...cases.map((c) => [c.case_reference, c.patient_name, c.patient_age, c.case_date, c.status].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cases.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 text-[#12344D]">
      <section className="glass-card p-4 flex flex-wrap gap-3 items-center justify-between">
        <h2 className="employee-heading text-[#12344D]">
          Case History <span className="text-[#072ac8]">({total})</span>
        </h2>
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full lg:w-auto">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-3 text-[#12344D]/50" />
            <input
              className="glass-input h-10 pl-8 pr-3 w-full placeholder:text-[#12344D]/50"
              placeholder="Search patient"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="glass-input h-10 px-3 w-full"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <button type="submit" className="glass-input h-10 px-3 w-full text-[#072ac8] text-sm font-semibold hover:bg-[#c1e5ff]/40">Search</button>
          <button type="button" onClick={exportAll} className="gradient-btn h-10 px-4 text-white font-semibold w-full">Export CSV</button>
        </form>
      </section>

      <section className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-[#12344D]/60">Loading cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#12344D]/60">No cases found.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 p-3 md:hidden">
              {cases.map((row) => (
                <article key={row.id} className="rounded-xl border border-[#9cd5ff] bg-[#c1e5ff]/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[#12344D] font-semibold">{row.case_reference}</p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_CLASS[row.status] || 'border-[#9cd5ff] text-[#12344D]/60'}`}>{row.status}</span>
                  </div>
                  <p className="text-sm text-[#12344D]/80 mt-2">{row.patient_name} · Age {row.patient_age}</p>
                  <p className="text-xs text-[#12344D]/60 mt-1">Teeth: {(row.teeth || []).map((t) => t.tooth_number).join(', ') || '—'}</p>
                  <p className="text-xs text-[#12344D]/60 mt-1">Date: {row.case_date || '—'}</p>
                </article>
              ))}
            </div>

            <table className="hidden md:table w-full table-fixed">
              <thead className="bg-[#c1e5ff]/30 text-left text-xs font-semibold uppercase tracking-wider text-[#12344D]/60">
                <tr>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age</th>
                  <th className="p-3">Teeth</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Results</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((row) => {
                  const analysis = results[row.id];
                  const isOpen = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-t border-[#9cd5ff]/40 hover:bg-[#c1e5ff]/35">
                        <td className="p-3 text-[#12344D] break-words font-semibold">{row.case_reference}</td>
                        <td className="p-3 text-[#12344D]/80 break-words">{row.patient_name}</td>
                        <td className="p-3 text-[#12344D]/80">{row.patient_age}</td>
                        <td className="p-3 text-[#12344D]/80 break-words">{(row.teeth || []).map((t) => t.tooth_number).join(', ') || '—'}</td>
                        <td className="p-3 text-[#12344D]/80 break-words">{row.case_date || '—'}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_CLASS[row.status] || 'border-[#9cd5ff] text-[#12344D]/60'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => toggleResults(row.id)}
                            className="text-xs text-[#072ac8] hover:text-[#0a2472] inline-flex items-center gap-1"
                          >
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isOpen ? 'Hide' : 'View'} angles
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-t border-[#9cd5ff]/40 bg-[#f6fbfe]">
                          <td colSpan={7} className="p-3">
                            {analysis === 'loading' && (
                              <p className="text-xs text-[#12344D]/60">Loading results…</p>
                            )}
                            {analysis === 'none' && (
                              <p className="text-xs text-[#12344D]/60">
                                No analysis recorded yet. Open the case and complete the alignment review.
                              </p>
                            )}
                            {analysis && analysis !== 'loading' && analysis !== 'none' && (
                              <div className="space-y-2">
                                <div className="text-xs text-[#12344D]/60">
                                  {analysis.total_implants} implant(s) · average{' '}
                                  <span className="text-[#12344D] font-semibold">{analysis.average_angle}°</span>
                                  {analysis.engine_version ? ` · engine ${analysis.engine_version}` : ''}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {(analysis.results || []).map((r) => (
                                    <div key={r.id} className="rounded-lg border border-[#9cd5ff]/70 bg-white p-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[#12344D] font-semibold">Tooth {r.tooth_number}</span>
                                        <span className={TOLERANCE_CLASS[r.tolerance_status] || 'text-[#12344D]/80'}>
                                          {Number(r.insertion_angle).toFixed(2)}° · {r.tolerance_status}
                                        </span>
                                      </div>
                                      <div className="text-[#12344D]/60 mt-1">
                                        {r.library_name || '—'}
                                        {r.corrector_angle_deg != null && (
                                          <> · corrector {r.corrector_angle_deg}°</>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </section>

      {total > 20 && (
        <div className="flex items-center justify-center gap-3">
          <button
            className="glass-input h-9 px-4 text-sm text-[#12344D] disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            Previous
          </button>
          <span className="text-sm text-[#12344D]/60">Page {page}</span>
          <button
            className="glass-input h-9 px-4 text-sm text-[#12344D] disabled:opacity-40"
            disabled={cases.length < 20}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default EmployeeMyCases;
