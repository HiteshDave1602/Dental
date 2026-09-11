import React, { useEffect, useState } from 'react';
import {
    Plus,
    Check,
    Rocket,
    Building2,
    ClipboardList,
    MoreHorizontal,
    Trash2
} from 'lucide-react';
import { cn } from '../utils/utils';
import Button from '../components/ui/Button';
import CreatePlanModal from '../components/modals/CreatePlanModal';
import api, { extractErrorMessage } from '../Script/api';

const planIcons = [ClipboardList, Rocket, Building2];

const formatPlanPrice = (price) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(Number(price || 0));

const getPlanCollection = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
};

const SubscriptionPlans = () => {
    const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [modalError, setModalError] = useState('');
    const [isSavingPlan, setIsSavingPlan] = useState(false);

    const loadPlans = async () => {
        setLoading(true);
        setPageError('');

        try {
            const response = await api.plans.list({ page: 1, size: 20, is_archived: false });
            const items = getPlanCollection(response.data).map((plan, index) => ({
                ...plan,
                icon: planIcons[index % planIcons.length],
                features: [
                    { text: `${Number(plan.credits || 0).toLocaleString()} credits included`, included: true },
                    { text: 'Admin-managed subscription plan', included: true },
                    { text: plan.description || 'No description provided', included: true },
                ],
            }));
            setPlans(items);
        } catch (err) {
            setPageError(extractErrorMessage(err, 'Failed to load plans.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const performanceData = plans.map((plan, index) => ({
        name: plan.name,
        count: `${Number(plan.credits || 0).toLocaleString()} credits`,
        percentage: plans.length ? Math.max(15, Math.round(((index + 1) / plans.length) * 100)) : 0,
        color: index % 3 === 0 ? 'bg-clinical-teal/40' : index % 3 === 1 ? 'bg-[#0d9488]' : 'bg-clinical-blue/30',
    }));

    const handleSavePlan = async (payload) => {
        setModalError('');
        setIsSavingPlan(true);

        try {
            if (selectedPlan?.id) {
                await api.plans.update(selectedPlan.id, payload);
            } else {
                await api.plans.create(payload);
            }

            setIsCreatePlanModalOpen(false);
            setSelectedPlan(null);
            await loadPlans();
        } catch (err) {
            setModalError(extractErrorMessage(err, 'Failed to save plan.'));
        } finally {
            setIsSavingPlan(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        try {
            await api.plans.remove(planId);
            await loadPlans();
        } catch (err) {
            setPageError(extractErrorMessage(err, 'Failed to delete or archive plan.'));
        }
    };

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#0d9488] rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                        <ClipboardList size={24} />
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Subscription Plans</h1>
                </div>

                <Button
                    onClick={() => {
                        setSelectedPlan(null);
                        setModalError('');
                        setIsCreatePlanModalOpen(true);
                    }}
                    className="h-12 px-6 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
                    <Plus size={20} />
                    Create New Plan
                </Button>
            </div>

            <div className="mb-16">
                <div className="mb-10">
                    <h2 className="text-[32px] font-bold text-slate-900 tracking-tight mb-3">Manage Tiers</h2>
                    <p className="text-slate-500 font-medium text-lg max-w-3xl leading-relaxed">
                        Configure and monitor your service levels. Updates to plans will be reflected immediately for new subscribers. Existing users will maintain their current billing cycle.
                    </p>
                </div>

                {pageError ? (
                    <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-600">
                        {pageError}
                    </div>
                ) : null}

                {loading ? (
                    <div className="rounded-[32px] border border-slate-100 bg-white px-8 py-16 text-center text-sm font-medium text-slate-500 shadow-xl shadow-slate-200/40">
                        Loading plans...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {plans.map((plan) => (
                            <div
                                key={plan.id || plan.name}
                                className={cn(
                                    'relative bg-white rounded-[32px] p-8 lg:p-10 transition-all duration-500 h-fit',
                                    !plan.is_archived
                                        ? 'ring-2 ring-[#0d9488] shadow-[0_20px_50px_rgba(13,148,136,0.15)] scale-[1.02] z-10'
                                        : 'border border-slate-100 shadow-xl shadow-slate-200/40 hover:translate-y-[-8px]'
                                )}
                            >
                                {!plan.is_archived ? (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#0d9488] text-white text-[11px] font-black tracking-[0.1em] px-5 py-2 rounded-full shadow-lg">
                                        ACTIVE
                                    </div>
                                ) : null}

                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                                        <p className="text-slate-500 font-medium">{plan.description || 'No description provided'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDeletePlan(plan.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                        <div className={cn(
                                            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                                            !plan.is_archived ? 'bg-[#eefcfb] text-[#0d9488]' : 'bg-slate-50 text-slate-400'
                                        )}>
                                            <plan.icon size={24} />
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl lg:text-5xl font-black text-slate-900">
                                            {formatPlanPrice(plan.price_rupee)}
                                        </span>
                                        <span className="text-lg font-bold text-slate-400">/mo</span>
                                    </div>
                                    <div className="inline-block mt-4 bg-emerald-50 text-[#0d9488] text-[11px] font-bold px-3 py-1.5 rounded-lg tracking-wide">
                                        {Number(plan.credits || 0).toLocaleString()} Credits/mo
                                    </div>
                                </div>

                                <div className="space-y-4 mb-10">
                                    {plan.features.map((feature, idx) => (
                                        <div key={`${plan.id || plan.name}-${idx}`} className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-50 text-[#0d9488]">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{feature.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    variant={!plan.is_archived ? 'default' : 'outline'}
                                    onClick={() => {
                                        setSelectedPlan(plan);
                                        setModalError('');
                                        setIsCreatePlanModalOpen(true);
                                    }}
                                    className={cn(
                                        'w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm lg:text-base',
                                        !plan.is_archived
                                            ? 'bg-[#0d9488] hover:bg-[#0c857a] text-white shadow-lg shadow-teal-500/20'
                                            : 'bg-slate-50 border-transparent text-slate-900 hover:bg-slate-100'
                                    )}
                                >
                                    <MoreHorizontal size={20} className="rotate-90 md:rotate-0" />
                                    Edit Plan
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/40 border border-slate-100 p-8 lg:p-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                    <div>
                        <h3 className="text-xl lg:text-2xl font-bold text-slate-900 mb-2">Plan Performance</h3>
                        <p className="text-slate-500 font-medium">Distribution of active subscriptions across tiers.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
                    {performanceData.map((item) => (
                        <div key={item.name} className="space-y-4 group">
                            <div className="flex items-center justify-between">
                                <span className="text-[15px] font-bold text-slate-900">{item.name}</span>
                                <span className="text-sm font-bold text-slate-400">{item.count}</span>
                            </div>
                            <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden p-[2px]">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-1000 ease-out shadow-sm', item.color)}
                                    style={{ width: `${item.percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <CreatePlanModal
                isOpen={isCreatePlanModalOpen}
                plan={selectedPlan}
                onSubmit={handleSavePlan}
                isSaving={isSavingPlan}
                error={modalError}
                onClose={() => {
                    setIsCreatePlanModalOpen(false);
                    setSelectedPlan(null);
                    setModalError('');
                }}
            />
        </div>
    );
};

export default SubscriptionPlans;
