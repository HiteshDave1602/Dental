import React, { useEffect } from 'react';
import { X, ClipboardList, IndianRupee, Zap, CalendarClock, FileText } from 'lucide-react';
import { useFormik } from 'formik';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { planValidationSchema } from '../../utils/formValidation';

const CreatePlanModal = ({ isOpen, onClose, plan, onSubmit, isSaving = false, error = '' }) => {
    const formik = useFormik({
        initialValues: {
            name: '',
            price_rupee: '',
            credits: '',
            duration_days: '',
            description: '',
        },
        validationSchema: planValidationSchema,
        onSubmit: async (values) => {
            if (!onSubmit) {
                onClose();
                return;
            }

            await onSubmit({
                name: values.name.trim(),
                price_rupee: Number(values.price_rupee),
                credits: Number(values.credits),
                duration_days: Number(values.duration_days),
                description: values.description.trim(),
            });
        },
    });

    // formik is stable per-mount; only plan/isOpen changes should re-seed values
    useEffect(() => {
        formik.setValues({
            name: plan?.name || '',
            price_rupee: plan?.price_rupee ?? plan?.price ?? '',
            credits: plan?.credits ?? '',
            duration_days: plan?.duration_days ?? '',
            description: plan?.description || '',
        });
        formik.setTouched({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formik is stable per-mount; only plan/isOpen changes should re-seed values
    }, [plan, isOpen]);

    if (!isOpen) return null;

    const isEdit = !!plan;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[520px] max-h-[90vh] flex flex-col bg-white rounded-[20px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-6 lg:p-8 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">
                        {isEdit ? `Edit Subscription Plan: ${plan.name}` : 'Create New Subscription Plan'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={formik.handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Plan Name</label>
                            <Input
                                placeholder="e.g. Premium Plus"
                                name="name"
                                value={formik.values.name}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.name && formik.errors.name}
                                icon={ClipboardList}
                                className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all text-slate-700 font-medium text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Price (INR)</label>
                                <Input
                                    placeholder="0.00"
                                    name="price_rupee"
                                    value={formik.values.price_rupee}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    error={formik.touched.price_rupee && formik.errors.price_rupee}
                                    icon={IndianRupee}
                                    className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all text-slate-700 font-medium text-sm"
                                    min="0"
                                    step="0.01"
                                    type="number"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Duration (Days)</label>
                                <Input
                                    placeholder="e.g. 30"
                                    name="duration_days"
                                    value={formik.values.duration_days}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    error={formik.touched.duration_days && formik.errors.duration_days}
                                    icon={CalendarClock}
                                    className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all text-slate-700 font-medium text-sm"
                                    min="1"
                                    step="1"
                                    type="number"
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Credits</label>
                            <Input
                                placeholder="e.g. 5000"
                                name="credits"
                                value={formik.values.credits}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={formik.touched.credits && formik.errors.credits}
                                icon={Zap}
                                className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all text-slate-700 font-medium text-sm"
                                min="0"
                                step="1"
                                type="number"
                            />
                        </div>

                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Description</label>
                            <div className="relative">
                                <div className="absolute left-4 top-3.5 text-slate-400 transition-colors duration-200">
                                    <FileText size={18} />
                                </div>
                                <textarea
                                    name="description"
                                    placeholder="Describe the plan features and target audience..."
                                    value={formik.values.description}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    className={`w-full min-h-[120px] bg-white border rounded-lg focus:ring-clinical-blue focus:ring-4 focus:ring-clinical-blue/10 focus:border-clinical-blue transition-all pl-12 pr-5 py-3 text-slate-700 font-medium text-sm outline-none resize-none ${formik.touched.description && formik.errors.description ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10' : 'border-slate-200'}`}
                                ></textarea>
                            </div>
                            {formik.touched.description && formik.errors.description && (
                                <p className="text-xs text-rose-600 ml-1 font-medium">{formik.errors.description}</p>
                            )}
                        </div>

                        {error ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                                {error}
                            </div>
                        ) : null}
                    </div>

                    <div className="p-6 lg:p-8 bg-slate-50/50 flex items-center justify-end gap-5 border-t border-slate-50 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
                        >
                            Cancel
                        </button>
                        <Button
                            type="submit"
                            className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : isEdit ? 'Update Plan' : 'Save Plan'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePlanModal;