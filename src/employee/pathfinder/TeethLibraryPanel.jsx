import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, RotateCcw, X } from 'lucide-react';
import api from '../../Script/api';
import { useCaseStore } from '../../store/caseStore';
import { useLibraryData } from '../../hooks/useLibraryData';
import ToothChart from '../components/ToothChart';

// Teeth + implant-library selection for the Angle Calculation step.
//
// This replaces the old "Select Teeth" checkbox list: instead of ticking
// "Instance #1…#4" (numbers that mean nothing to a technician), the user taps
// the FDI tooth number the implant sits at and maps a detected instance to it.
// The set of teeth mapped here IS the set of instances the angle calculation
// runs on, so assigning a tooth and selecting a tooth are now one action.
//
// Each assigned tooth can then be given an implant library (brand → library),
// which is what the report and downstream ordering key off.
function TeethLibraryPanel({ caseId, instances = [], onPreviewInstance }) {
  const toothInstanceMap = useCaseStore((s) => s.toothInstanceMap);
  const setToothInstanceMap = useCaseStore((s) => s.setToothInstanceMap);
  const clearToothInstanceMap = useCaseStore((s) => s.clearToothInstanceMap);
  const toothAssignments = useCaseStore((s) => s.toothAssignments);
  const assignLibrary = useCaseStore((s) => s.assignLibrary);
  const removeAssignment = useCaseStore((s) => s.removeAssignment);
  const toothBrandSelections = useCaseStore((s) => s.toothBrandSelections);
  const setToothBrand = useCaseStore((s) => s.setToothBrand);

  // The tooth whose library card is open. Driven by ToothChart's own selection.
  const [activeTooth, setActiveTooth] = useState(null);

  const {
    brands, brandsLoading, brandsError, fetchBrands,
    displayedLibraries, anglesLoading, anglesError,
    fetchAnglesForBrand, restoreForTooth,
  } = useLibraryData();

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  // Hydrate any tooth mapping already saved server-side for this case, so a
  // refresh mid-workflow doesn't lose the assignments (same behaviour the old
  // Phase C panel had).
  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.employee.cases.getTeeth(caseId);
        const payload = res?.data?.data ?? res?.data ?? [];
        const rows = Array.isArray(payload) ? payload : payload?.teeth || [];
        if (cancelled || !rows.length) return;
        const hydrated = { ...useCaseStore.getState().toothInstanceMap };
        rows.forEach((row) => {
          if (row?.instance_index !== undefined && row?.instance_index !== null) {
            hydrated[row.instance_index] = String(row.tooth_number);
          }
        });
        setToothInstanceMap(hydrated);
      } catch {
        // Nothing saved yet for this case.
      }
    })();
    return () => { cancelled = true; };
  }, [caseId, setToothInstanceMap]);

  // Drop mappings pointing at instances that no longer exist (deleted in the
  // review step, or re-detected) — a stale index would be computed against
  // nothing.
  useEffect(() => {
    const valid = new Set(instances.map((i) => i.index));
    const stale = Object.keys(toothInstanceMap).some((idx) => !valid.has(Number(idx)));
    if (!stale) return;
    const next = {};
    Object.entries(toothInstanceMap).forEach(([idx, tooth]) => {
      if (valid.has(Number(idx))) next[idx] = tooth;
    });
    setToothInstanceMap(next);
  }, [instances, toothInstanceMap, setToothInstanceMap]);

  const total = instances.length;
  const assignedCount = Object.keys(toothInstanceMap).length;
  const progressPct = total ? Math.round((assignedCount / total) * 100) : 0;

  // A tooth holds at most one instance, so assigning it drops any earlier
  // mapping onto the same tooth.
  const handleAssignInstance = useCallback((toothNumber, instanceIndex) => {
    const next = {};
    Object.entries(toothInstanceMap).forEach(([idx, tooth]) => {
      if (tooth !== toothNumber) next[idx] = tooth;
    });
    if (instanceIndex !== null && instanceIndex !== undefined) {
      next[instanceIndex] = toothNumber;
    } else {
      removeAssignment(toothNumber);
    }
    setToothInstanceMap(next);
  }, [toothInstanceMap, setToothInstanceMap, removeAssignment]);

  // Re-open a tooth: restore the brand/angle cascade it was left on so its
  // library card comes back with the right list already loaded.
  const handleActiveToothChange = useCallback((tooth) => {
    setActiveTooth(tooth);
    if (!tooth) return;
    const brand = toothBrandSelections[tooth] || toothAssignments[tooth]?.company_name || '';
    if (brand) restoreForTooth(brand, toothAssignments[tooth]?.angle_alignment ?? null);
  }, [toothBrandSelections, toothAssignments, restoreForTooth]);

  const handleClear = () => {
    clearToothInstanceMap();
    setActiveTooth(null);
  };

  const handleBrandChange = (tooth, brand) => {
    setToothBrand(tooth, brand);
    removeAssignment(tooth);
    fetchAnglesForBrand(brand);
  };

  const activeBrandForTooth = activeTooth
    ? (toothBrandSelections[activeTooth] ?? toothAssignments[activeTooth]?.company_name ?? '')
    : '';
  const activeLibraryId = activeTooth ? toothAssignments[activeTooth]?.library_id : undefined;
  // The library card only makes sense once the tooth actually holds an implant.
  const activeToothInstance = activeTooth
    ? Object.entries(toothInstanceMap).find(([, t]) => t === activeTooth)?.[0]
    : undefined;

  if (total === 0) {
    return (
      <div className="glass-card p-3.5 space-y-1">
        <h3 className="employee-heading text-sm text-[#12344D]">Teeth &amp; Library</h3>
        <p className="text-xs text-[#12344D]/60">
          No implant instances were detected in this scan, so there is nothing to assign.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header — what this panel is for, and how far along it is */}
      <div className="glass-card p-3.5 space-y-2 bg-gradient-to-br from-white to-[#f0f9ff]">
        <h3 className="employee-heading text-sm text-[#12344D]">Teeth &amp; Library</h3>
        <p className="text-xs text-[#12344D]/60">
          Pick the teeth you want, then assign an implant library to each.
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            assignedCount === total
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-[#c1e5ff]/60 text-[#072ac8]'
          }`}>
            {assignedCount} / {total} instances
          </span>
          <button
            type="button"
            onClick={handleClear}
            disabled={assignedCount === 0}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={12} /> Clear
          </button>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#e3f2ff] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6ab0e3] to-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ToothChart
        instances={instances}
        toothInstanceMap={toothInstanceMap}
        onAssignInstance={handleAssignInstance}
        onPreviewInstance={onPreviewInstance}
        onActiveToothChange={handleActiveToothChange}
      />

      {/* Per-tooth implant library — brand first, then the matching libraries */}
      {activeTooth && activeToothInstance !== undefined && (
        <div className="glass-card p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#6ab0e3] to-[#072ac8] text-white shadow-sm">
                <BookOpen size={14} />
              </span>
              <h3 className="employee-heading text-sm text-[#12344D]">Library for Tooth {activeTooth}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTooth(null)}
              className="text-[#12344D]/40 hover:text-[#12344D]"
              aria-label="Close library picker"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#072ac8]/70">Brand</p>
            <select
              className="glass-input h-9 w-full px-2 text-xs"
              value={activeBrandForTooth}
              disabled={brandsLoading}
              onChange={(e) => handleBrandChange(activeTooth, e.target.value)}
            >
              <option value="">{brandsLoading ? 'Loading brands…' : 'Select a brand'}</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {brandsError && <p className="text-[10px] text-rose-600">{brandsError}</p>}
          {anglesError && <p className="text-[10px] text-rose-600">{anglesError}</p>}

          {anglesLoading && (
            <p className="flex items-center gap-1.5 text-[10px] text-[#12344D]/60">
              <Loader2 size={12} className="animate-spin" /> Loading libraries…
            </p>
          )}

          {!anglesLoading && activeBrandForTooth && displayedLibraries.length === 0 && !anglesError && (
            <p className="text-[10px] text-[#12344D]/60">No libraries published for this brand yet.</p>
          )}

          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {displayedLibraries.map((lib) => {
              const selected = lib.id === activeLibraryId;
              return (
                <button
                  key={lib.id}
                  type="button"
                  onClick={() => assignLibrary(activeTooth, {
                    company_name: lib.company_name,
                    library_id: lib.id,
                    angle_alignment: lib.angle_alignment,
                    manufacturer_id: lib.manufacturer_id,
                  })}
                  className={`w-full text-left rounded-xl border px-2.5 py-2 transition-all ${
                    selected
                      ? 'border-[#072ac8] bg-[#072ac8]/5 ring-2 ring-[#072ac8]/20'
                      : 'border-[#9cd5ff]/70 bg-[#f6fbfe] hover:border-[#072ac8]/50'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#12344D]">{lib.company_name}</p>
                  <p className="text-[10px] text-[#12344D]/70">
                    {lib.manufacturer_id || 'N/A'} · {lib.angle_alignment}°
                  </p>
                  {lib.tolerance_degree != null && (
                    <p className="text-[10px] text-[#12344D]/50">Tolerance: {lib.tolerance_degree}°</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="px-1 text-[10px] text-[#12344D]/50">
        Only the teeth assigned here are included in the angle calculation below.
      </p>
    </div>
  );
}

export default TeethLibraryPanel;
