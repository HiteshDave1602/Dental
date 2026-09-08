import { useMemo, useState } from 'react';
import { Eye, Smile, X } from 'lucide-react';
import { cn } from '../../utils/utils';

// FDI notation, as drawn in the standard quadrant chart: Upper Right (18→11)
// next to Upper Left (21→28); Lower Right (48→41) next to Lower Left (31→38).
const upperTeeth = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const lowerTeeth = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

// Tap a tooth, then pick its instance from the panel that appears below —
// hovering an instance option there also asks the 3D viewer to highlight that
// instance's mesh (scan body included), so the user can see exactly which
// implant they're about to place before committing to a tooth.
// `onActiveToothChange` lets a parent follow the tooth the user is working on
// (SuperimposeStep opens the per-tooth implant-library card beside the chart).
// Optional — TeethAssignmentPanel doesn't pass it.
const ToothChart = ({ instances = [], toothInstanceMap = {}, onAssignInstance, onPreviewInstance, onActiveToothChange }) => {
  const [activeTooth, setActiveTooth] = useState(null);

  const selectTooth = (tooth) => {
    setActiveTooth(tooth);
    onActiveToothChange?.(tooth);
  };

  const toothToInstance = useMemo(() => {
    const map = {};
    Object.entries(toothInstanceMap).forEach(([idx, tooth]) => { if (tooth) map[tooth] = Number(idx); });
    return map;
  }, [toothInstanceMap]);
  const assignedInstanceIndexes = useMemo(() => new Set(Object.keys(toothInstanceMap).map(Number)), [toothInstanceMap]);

  const assignedCount = Object.keys(toothInstanceMap).length;
  const totalInstances = instances.length;
  const progressPct = totalInstances ? Math.round((assignedCount / totalInstances) * 100) : 0;
  const activeInstance = activeTooth ? toothToInstance[activeTooth] : undefined;
  const options = activeTooth
    ? instances.filter((inst) => !assignedInstanceIndexes.has(inst.index) || inst.index === activeInstance)
    : [];

  const handleAssign = (instanceIndex) => {
    onAssignInstance(activeTooth, instanceIndex);
    // Keep the tooth active when a parent is listening: assigning an instance is
    // what unlocks the library picker for that tooth, so closing the row here
    // would immediately hide the next thing the user needs.
    if (onActiveToothChange) {
      onActiveToothChange(instanceIndex === null ? null : activeTooth);
      if (instanceIndex === null) setActiveTooth(null);
    } else {
      setActiveTooth(null);
    }
    onPreviewInstance?.(null);
  };

  const renderRow = (ids) => (
    <div className="grid grid-cols-8 gap-1.5">
      {ids.map((id) => {
        const inst = toothToInstance[id];
        const isAssigned = inst !== undefined;
        const isActive = activeTooth === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => selectTooth(activeTooth === id ? null : id)}
            className={cn(
              'relative h-8 rounded-xl border text-[10px] font-bold flex items-center justify-center shadow-sm transition-all duration-150 hover:scale-[1.08] active:scale-95',
              isAssigned
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white shadow-emerald-500/30'
                : isActive
                  ? 'bg-gradient-to-br from-[#6ab0e3] to-[#072ac8] border-[#072ac8] text-white ring-2 ring-[#072ac8]/30 scale-105'
                  : 'bg-white border-[#9cd5ff] text-[#12344D]/70 hover:border-[#072ac8] hover:text-[#072ac8]'
            )}
          >
            {id}
            {isAssigned && (
              <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[#15803d] text-white text-[8px] font-bold flex items-center justify-center border-2 border-white shadow">
                {inst}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="glass-card p-3.5 space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#6ab0e3] to-[#072ac8] text-white shadow-sm">
            <Smile size={14} />
          </span>
          <h3 className="employee-heading text-sm text-[#12344D]">Assign Teeth</h3>
        </div>
        <span
          className={cn(
            'text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0',
            assignedCount === totalInstances && totalInstances > 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-[#c1e5ff]/60 text-[#072ac8]'
          )}
        >
          {assignedCount} / {totalInstances}
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[#e3f2ff] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6ab0e3] to-emerald-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="text-[10px] text-[#12344D]/60">Tap a tooth, then pick its instance below.</p>

      <div className="space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[#072ac8]/70">Upper Jaw · Right 18→11 · Left 21→28</p>
        {renderRow(upperTeeth)}
      </div>
      <div className="space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[#072ac8]/70">Lower Jaw · Right 48→41 · Left 31→38</p>
        {renderRow(lowerTeeth)}
      </div>

      {activeTooth && (
        <div className="rounded-xl border border-[#9cd5ff] bg-gradient-to-br from-[#f6fbfe] to-[#eaf6ff] p-2.5 space-y-2 shadow-inner">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#12344D]">Tooth {activeTooth}</p>
            {options.length > 0 && (
              <span className="flex items-center gap-1 text-[9px] text-[#12344D]/50">
                <Eye size={11} /> hover to preview
              </span>
            )}
          </div>
          {options.length === 0 ? (
            <p className="text-[10px] text-[#12344D]/60">All instances are already assigned elsewhere.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {options.map((inst) => (
                <button
                  key={inst.index}
                  type="button"
                  onMouseEnter={() => onPreviewInstance?.(inst.index)}
                  onMouseLeave={() => onPreviewInstance?.(null)}
                  onFocus={() => onPreviewInstance?.(inst.index)}
                  onBlur={() => onPreviewInstance?.(null)}
                  onClick={() => handleAssign(inst.index)}
                  className={cn(
                    'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all',
                    inst.index === activeInstance
                      ? 'bg-gradient-to-r from-[#6ab0e3] to-[#072ac8] text-white border-transparent shadow-sm'
                      : 'border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/50 hover:border-[#072ac8]'
                  )}
                >
                  #{inst.index}{inst.vendor_name ? ` · ${inst.vendor_name}` : ''}
                </button>
              ))}
            </div>
          )}
          {activeInstance !== undefined && (
            <button
              type="button"
              onClick={() => handleAssign(null)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:text-rose-700"
            >
              <X size={11} /> Remove assignment
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ToothChart;
