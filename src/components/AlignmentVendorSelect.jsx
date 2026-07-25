import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../Script/api';

/**
 * Picks the alignment engine vendor this library maps to.
 *
 * A library's `alignment_vendor_id` must match a vendor registered on the
 * alignment engine exactly — cases whose teeth use a library without a valid
 * mapping cannot be aligned at all. That makes free text the wrong control,
 * so this fetches the live list and offers only real ids.
 *
 * If the engine is unreachable the field degrades to a plain text input
 * rather than blocking library creation, and says so.
 */
const AlignmentVendorSelect = ({ value, onChange, className = '' }) => {
    const [vendors, setVendors] = useState([]);
    const [state, setState] = useState('loading'); // loading | ready | unavailable

    useEffect(() => {
        let cancelled = false;
        api.libraries
            .alignmentVendors()
            .then((res) => {
                if (cancelled) return;
                const list = res.data?.vendors || [];
                setVendors(list);
                setState(res.data?.available && list.length ? 'ready' : 'unavailable');
            })
            .catch(() => {
                if (!cancelled) setState('unavailable');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const inputClasses =
        'h-12 w-full bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all px-5 text-slate-700 font-medium text-sm';

    return (
        <div className={`space-y-2.5 ${className}`}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                Alignment Vendor
            </label>

            {state === 'ready' ? (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClasses}
                >
                    <option value="">Not mapped — cases cannot be aligned</option>
                    {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                            {vendor.name} ({vendor.id})
                        </option>
                    ))}
                </select>
            ) : (
                <>
                    <input
                        type="text"
                        placeholder={state === 'loading' ? 'Loading vendors…' : 'e.g. pathfinder'}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={state === 'loading'}
                        className={inputClasses}
                    />
                    {state === 'unavailable' && (
                        <p className="flex items-start gap-1.5 text-[11px] text-amber-600 px-1">
                            <AlertTriangle size={13} className="mt-px flex-shrink-0" />
                            <span>
                                The alignment service is unreachable, so the vendor list could not be
                                loaded. Enter the id manually, or set it later once the service is up.
                            </span>
                        </p>
                    )}
                </>
            )}

            <p className="text-[11px] text-slate-400 px-1">
                Links this library to the implant system the alignment engine detects. Required for a
                case using this library to be analysed.
            </p>
        </div>
    );
};

export default AlignmentVendorSelect;
