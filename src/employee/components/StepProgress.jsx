import { Check } from 'lucide-react';
import { cn } from '../../utils/utils';

// Three steps, matching the wizard. The previous five described a
// superimpose / results / download flow that no longer exists — the alignment
// review covers all of it — so they advertised stages the user never reached.
const labels = ['Patient Info', 'Scan & Teeth', 'Alignment Review'];

const StepProgress = ({ activeStep }) => {
  return (
    <div className="glass-card p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-1">
        {labels.map((label, index) => {
          const stepNumber = index + 1;
          const complete = stepNumber < activeStep;
          const active = stepNumber === activeStep;
          return (
            <div key={label} className="flex flex-row sm:flex-col items-center sm:items-center justify-between sm:justify-start gap-2 text-left sm:text-center">
              <div className="w-auto sm:w-full flex items-center justify-center gap-2">
                {index > 0 ? (
                  <div className={cn('hidden sm:block h-[2px] w-full', stepNumber <= activeStep ? 'bg-gradient-to-r from-cyan-400 to-violet-500' : 'bg-slate-700')} />
                ) : null}
                <div
                  className={cn(
                    'h-9 w-9 rounded-full border text-xs font-semibold grid place-content-center shrink-0',
                    complete ? 'bg-cyan-500 border-cyan-300 text-slate-950' : '',
                    active ? 'border-cyan-300 text-cyan-200 pulse-cyan' : '',
                    !complete && !active ? 'border-slate-600 text-slate-400' : ''
                  )}
                >
                  {complete ? <Check size={16} /> : stepNumber}
                </div>
                {index < labels.length - 1 ? (
                  <div className={cn('hidden sm:block h-[2px] w-full', stepNumber < activeStep ? 'bg-gradient-to-r from-cyan-400 to-violet-500' : 'bg-slate-700')} />
                ) : null}
              </div>
              <p className="text-xs text-slate-300 flex-1 sm:flex-none">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepProgress;
