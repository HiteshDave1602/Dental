import { useMemo } from 'react';
import { cn } from '../../utils/utils';
import { getToothLabel, getToothType, lowerTeeth, upperTeeth } from '../utils/teeth';

const shapeByType = {
  molar: 'M12 2 C4 2, 2 7, 2 12 C2 18, 6 22, 12 22 C18 22, 22 18, 22 12 C22 7, 20 2, 12 2 Z',
  premolar: 'M12 3 C6 3, 4 8, 4 12 C4 17, 7 21, 12 21 C17 21, 20 17, 20 12 C20 8, 18 3, 12 3 Z',
  canine: 'M12 2 L18 9 C19 12, 18 17, 15 20 C13 22, 11 22, 9 20 C6 17, 5 12, 6 9 Z',
  incisor: 'M7 3 H17 C19 3, 20 6, 20 8 V14 C20 18, 16 22, 12 22 C8 22, 4 18, 4 14 V8 C4 6, 5 3, 7 3 Z',
};

const Tooth = ({ id, selected, onToggle }) => {
  const type = getToothType(id);
  return (
    <button
      title={getToothLabel(id)}
      onClick={() => onToggle(id)}
      className="flex flex-col items-center gap-1"
      type="button"
    >
      <svg viewBox="0 0 24 24" className="h-10 w-10">
        <path
          d={shapeByType[type]}
          className={cn(
            'transition-all duration-200',
            selected ? 'fill-[#6ab0e3] stroke-[#072ac8] drop-shadow-[0_0_10px_rgba(106,176,227,.8)]' : 'fill-transparent stroke-[#9cd5ff] hover:stroke-[#072ac8]'
          )}
          strokeWidth="1.2"
        />
      </svg>
      <span className={cn('text-[11px]', selected ? 'text-[#072ac8] font-semibold' : 'text-[#12344D]/60')}>{id}</span>
    </button>
  );
};

const ToothChart = ({ selectedTeeth, onToggle, onClear }) => {
  const selectedList = useMemo(() => [...selectedTeeth].sort((a, b) => Number(a) - Number(b)), [selectedTeeth]);

  return (
    <div>

    </div>
    // <div className="glass-card p-4 space-y-4">
    //   <h3 className="employee-heading text-base text-[#12344D]">Select Affected Teeth</h3>
    //   <p className="text-xs text-[#12344D]/60">Upper Jaw</p>
    //   <div className="grid grid-cols-8 gap-2">
    //     {upperTeeth.map((id) => <Tooth key={id} id={id} selected={selectedTeeth.includes(id)} onToggle={onToggle} />)}
    //   </div>
    //   <p className="text-xs text-[#12344D]/60 pt-2">Lower Jaw</p>
    //   <div className="grid grid-cols-8 gap-2">
    //     {lowerTeeth.map((id) => <Tooth key={id} id={id} selected={selectedTeeth.includes(id)} onToggle={onToggle} />)}
    //   </div>
    //   <div className="flex items-center justify-between pt-2">
    //     <div className="flex flex-wrap gap-2">
    //       {selectedList.length ? selectedList.map((id) => (
    //         <span key={id} className="px-2 py-1 rounded-full bg-[#c1e5ff] text-[#0a2472] border border-[#6ab0e3] text-xs">{id}</span>
    //       )) : <span className="text-xs text-[#12344D]/50">No teeth selected</span>}
    //     </div>
    //     <button type="button" onClick={onClear} className="text-xs text-[#072ac8] font-semibold hover:underline">Clear Selection</button>
    //   </div>
    // </div>
  );
};

export default ToothChart;  