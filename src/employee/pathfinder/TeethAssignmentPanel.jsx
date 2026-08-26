import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import api, { extractErrorMessage, notifyError, notifySuccess } from '../../Script/api';
import { useCaseStore } from '../../store/caseStore';
import ToothChart from '../components/ToothChart';

// Phase C of the Pathfinder review: match each detected implant instance
// (from placeCorrectors) to the tooth it sits at (Universal Numbering,
// 1-32), via a visual arch chart, then persist the mapping through the
// case's teeth endpoint. Runs after Phase A (detection review) and Phase B
// (angles / correctors) both complete.
function TeethAssignmentPanel({ caseId, instances = [], onComplete, onPreviewInstance }) {
  const toothInstanceMap = useCaseStore((s) => s.toothInstanceMap);
  const setToothInstanceMap = useCaseStore((s) => s.setToothInstanceMap);
  const clearToothInstanceMap = useCaseStore((s) => s.clearToothInstanceMap);

  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [validationError, setValidationError] = useState('');

  // Hydrate from whatever was already saved server-side for this case, so
  // reopening the panel (or a refresh, before local persistence would have
  // kicked in) restores prior assignments. Backend rows win per-instance;
  // any in-progress local-only entries (not yet saved) are left alone.
  useEffect(() => {
    if (!caseId) { setIsHydrating(false); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.employee.cases.getTeeth(caseId);
        const payload = res?.data?.data ?? res?.data ?? [];
        const rows = Array.isArray(payload) ? payload : payload?.teeth || [];
        if (!cancelled && rows.length) {
          const current = useCaseStore.getState().toothInstanceMap;
          const hydrated = { ...current };
          rows.forEach((row) => {
            if (row?.instance_index !== undefined && row?.instance_index !== null) {
              hydrated[row.instance_index] = row.tooth_number;
            }
          });
          setToothInstanceMap(hydrated);
        }
      } catch {
        // No teeth saved yet for this case — nothing to hydrate.
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId, setToothInstanceMap]);

  // If an instance gets deleted back in Phase A/B (re-detection, manual
  // removal), drop any mapping that still points at it — a stale index would
  // silently save against an instance that no longer exists.
  useEffect(() => {
    const validIndexes = new Set(instances.map((i) => i.index));
    const hasStale = Object.keys(toothInstanceMap).some((idx) => !validIndexes.has(Number(idx)));
    if (hasStale) {
      const next = {};
      Object.entries(toothInstanceMap).forEach(([idx, tooth]) => {
        if (validIndexes.has(Number(idx))) next[idx] = tooth;
      });
      setToothInstanceMap(next);
    }
  }, [instances, toothInstanceMap, setToothInstanceMap]);

  const totalInstances = instances.length;
  const assignedCount = Object.keys(toothInstanceMap).length;

  // A tooth can only ever hold one instance, so assigning it drops any prior
  // mapping that pointed at the same tooth from a different instance.
  const handleAssignInstance = (toothNumber, instanceIndex) => {
    const next = {};
    Object.entries(toothInstanceMap).forEach(([idx, tooth]) => {
      if (tooth !== toothNumber) next[idx] = tooth;
    });
    if (instanceIndex !== null && instanceIndex !== undefined) {
      next[instanceIndex] = toothNumber;
    }
    setToothInstanceMap(next);
    setValidationError('');
  };

  const handleClear = () => {
    clearToothInstanceMap();
    setValidationError('');
    setSaveError('');
  };

  const handleSaveAndFinish = async () => {
    if (assignedCount !== totalInstances) {
      setValidationError(`Assign a tooth to every detected instance before finishing (${assignedCount} / ${totalInstances} done).`);
      return;
    }
    const toothNumbers = Object.values(toothInstanceMap);
    if (new Set(toothNumbers).size !== toothNumbers.length) {
      setValidationError('A tooth cannot be assigned to more than one instance.');
      return;
    }

    setValidationError('');
    setSaveError('');
    setIsSaving(true);
    try {
      const teethArray = Object.entries(toothInstanceMap).map(([instanceIndex, toothNumber]) => ({
        tooth_number: Number(toothNumber),
        instance_index: Number(instanceIndex),
      }));
      await api.employee.cases.addTeeth(caseId, teethArray);
      // Mirrors every other phase transition in the wizard (steps 2/3/4 all
      // call updateStep on completion) — marks the case wizard as finished.
      // Best-effort: teeth are already saved, so a step-tracking hiccup here
      // shouldn't block the user from finishing.
      api.employee.cases.updateStep(caseId, 5).catch(() => {});
      notifySuccess('Teeth assignments saved');
      onComplete?.();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to save teeth assignments. Please try again.');
      setSaveError(msg);
      notifyError(msg);
      // Keep the current mapping intact so the user can just retry.
    } finally {
      setIsSaving(false);
    }
  };

  // This panel sits in the ~380px viewer sidebar (beside the 3D view, right
  // under Visibility Controls), not full-width — so it stays compact: smaller
  // type, tighter padding, and a stacked (not side-by-side) button row.
  if (totalInstances === 0) {
    return (
      <div className="glass-card p-3.5 space-y-2.5">
        <h3 className="employee-heading text-sm text-[#12344D]">Phase C — Assign Teeth</h3>
        <p className="text-xs text-[#12344D]/60">
          No implant instances were detected, so there is nothing to assign.
        </p>
        <button
          type="button"
          onClick={() => onComplete?.()}
          className="gradient-btn h-9 w-full text-sm text-white font-semibold shadow-md shadow-[#072ac8]/20 hover:shadow-lg transition-shadow"
        >
          Finish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="glass-card p-3.5 space-y-1 bg-gradient-to-br from-white to-[#f0f9ff]">
        <h3 className="employee-heading text-sm text-[#12344D]">Phase C — Assign Teeth</h3>
        <p className="text-xs text-[#12344D]/60">
          Match each detected instance to the tooth it was placed at.
        </p>
      </div>

      {isHydrating ? (
        <div className="glass-card p-3 text-xs text-[#12344D]/60 flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-[#9cd5ff] border-t-[#072ac8] animate-spin" />
          Loading saved assignments…
        </div>
      ) : (
        <>
          <ToothChart
            instances={instances}
            toothInstanceMap={toothInstanceMap}
            onAssignInstance={handleAssignInstance}
            onPreviewInstance={onPreviewInstance}
          />

          {validationError && (
            <div className="flex items-start gap-1.5 text-xs rounded-xl border border-amber-300 bg-amber-50 text-amber-700 px-2.5 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {validationError}
            </div>
          )}
          {saveError && (
            <div className="flex items-start gap-1.5 text-xs rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-2.5 py-2">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSaveAndFinish}
              disabled={isSaving}
              className="gradient-btn h-9 w-full text-sm text-white font-semibold shadow-md shadow-[#072ac8]/20 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center justify-center gap-2 transition-shadow"
            >
              {isSaving ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {isSaving ? 'Saving…' : 'Save & Finish'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isSaving || assignedCount === 0}
              className="h-9 w-full text-sm rounded-full border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/40 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={13} /> Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default TeethAssignmentPanel;
