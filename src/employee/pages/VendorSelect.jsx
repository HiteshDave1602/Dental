import { useCallback, useEffect, useState } from 'react';
import { Boxes, ChevronLeft, Loader2 } from 'lucide-react';
import api, { extractErrorMessage, notifyError } from '../../Script/api';
import { useCaseStore } from '../../store/caseStore';

const Spinner = () => (
  <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
);

const VendorSelect = ({ onBack, onComplete }) => {
  const { caseId, selectedVendorIds, setSelectedVendorIds } = useCaseStore();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.employee.alignment.vendors(caseId);
        if (!cancelled) setVendors(list);
      } catch (e) {
        if (!cancelled) setError(extractErrorMessage(e, 'Could not load implant systems'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleVendor = useCallback((vendorId) => {
    setSelectedVendorIds(
      selectedVendorIds.includes(vendorId)
        ? selectedVendorIds.filter((id) => id !== vendorId)
        : [...selectedVendorIds, vendorId]
    );
  }, [selectedVendorIds, setSelectedVendorIds]);

  const handleContinue = async () => {
    if (!caseId) {
      notifyError('No active case');
      return;
    }
    if (selectedVendorIds.length === 0) {
      notifyError('Select at least one implant system');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.employee.cases.setVendors(caseId, selectedVendorIds);
      const result = res.data?.data ?? res.data;
      if (result?.submitted === false && result?.error) {
        notifyError(`Vendor saved but alignment could not start: ${result.error}`);
      }
      onComplete();
    } catch (e) {
      notifyError(extractErrorMessage(e, 'Failed to save vendor selection'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <article className="glass-card p-5">
        <h2 className="employee-heading text-lg text-[#12344D]">Select Implant System</h2>
        <p className="text-sm text-[#12344D]/60 mt-1">
          Pick the implant system(s) used in this case. The alignment engine will detect matching scan bodies.
        </p>

        {loading && (
          <div className="flex items-center gap-2 mt-6 text-sm text-[#12344D]/60">
            <Loader2 size={16} className="animate-spin" />
            Loading implant systems...
          </div>
        )}

        {error && (
          <div className="mt-4 text-xs rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2">
            {error}
          </div>
        )}

        {!loading && !error && vendors.length === 0 && (
          <div className="mt-6 text-sm text-[#12344D]/60">
            No implant systems registered. Contact your administrator.
          </div>
        )}

        {!loading && !error && vendors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {vendors.map((v) => {
              const selected = selectedVendorIds.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVendor(v.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    selected
                      ? 'border-[#072ac8] bg-[#072ac8]/5 ring-2 ring-[#072ac8]/20'
                      : 'border-[#9cd5ff]/60 bg-[#f6fbfe] hover:border-[#072ac8]/40'
                  }`}
                >
                  <Boxes
                    size={20}
                    className={`mt-0.5 shrink-0 ${selected ? 'text-[#072ac8]' : 'text-[#6ab0e3]'}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${selected ? 'text-[#072ac8]' : 'text-[#12344D]'}`}>
                      {v.name}
                    </p>
                    {v.description && (
                      <p className="text-xs text-[#12344D]/50 mt-0.5 line-clamp-2">{v.description}</p>
                    )}
                  </div>
                  <div className={`ml-auto shrink-0 h-5 w-5 rounded-full border-2 grid place-content-center transition-colors ${
                    selected ? 'border-[#072ac8] bg-[#072ac8]' : 'border-[#9cd5ff]'
                  }`}>
                    {selected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </article>

      {/* Navigation */}
      <div className="sticky bottom-0 z-10 -mx-3 mt-6 flex items-center justify-between gap-3 border-t border-[#9cd5ff]/60 bg-[#FCFDF6]/95 px-3 py-3 pr-20 backdrop-blur sm:-mx-4 sm:px-4 sm:pr-24 lg:-mx-6 lg:px-6">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="h-10 shrink-0 px-5 rounded-full border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/40 disabled:opacity-40 inline-flex items-center gap-2"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <button
          type="button"
          disabled={submitting || selectedVendorIds.length === 0}
          onClick={handleContinue}
          className="h-10 px-6 rounded-full bg-[#072ac8] text-white hover:bg-[#0a2472] disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </section>
  );
};

export default VendorSelect;
