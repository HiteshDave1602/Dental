import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const today = () => new Date().toISOString().split('T')[0];

const DEFAULT_PATIENT = { fullName: '', age: '', caseDate: today(), notes: '' };

export const useCaseStore = create(
  persist(
    (set, get) => ({
      // ── Workflow ─────────────────────────────────────────────────────────────
      currentStep: 1,
      isResuming: false, // transient — NOT persisted; set by resumeCase, cleared on unmount

      // ── Patient / Case ───────────────────────────────────────────────────────
      patientData: DEFAULT_PATIENT,
      caseId: null,    // backend UUID
      caseRef: null,   // human readable PF-XXXX

      // ── Vendors ─────────────────────────────────────────────────────────────
      selectedVendorIds: [],

      // ── Teeth ────────────────────────────────────────────────────────────────
      selectedTeeth: [],
      activeTooth: null,

      // Per-tooth in-progress selections (shown in dropdowns while picking)
      toothBrandSelections: {},
      toothAngleSelections: {},  // { toothNumber: angleValue (float) | null }

      // Final confirmed assignment per tooth
      // { [toothNumber]: { company_name, library_id, angle_alignment, manufacturer_id } }
      toothAssignments: {},

      // Pathfinder Phase C: maps a detected implant instance to the tooth it
      // sits at. { [instanceIndex]: toothNumber }
      toothInstanceMap: {},

      // ── Actions ──────────────────────────────────────────────────────────────
      setStep: (step) => set({ currentStep: step }),

      setPatientData: (data) => set({ patientData: data }),

      setCaseCreated: (caseId, caseRef) => set({ caseId, caseRef }),

      setSelectedVendorIds: (ids) => set({ selectedVendorIds: ids }),

      toggleTooth: (tooth) =>
        set((s) => {
          const exists = s.selectedTeeth.includes(tooth);
          const next = exists
            ? s.selectedTeeth.filter((t) => t !== tooth)
            : [...s.selectedTeeth, tooth];
          const activeTooth = exists
            ? s.activeTooth === tooth
              ? next[0] ?? null
              : s.activeTooth
            : s.activeTooth ?? tooth;
          return { selectedTeeth: next, activeTooth };
        }),

      setActiveTooth: (tooth) => set({ activeTooth: tooth }),

      setToothBrand: (tooth, brand) =>
        set((s) => ({
          toothBrandSelections: { ...s.toothBrandSelections, [tooth]: brand },
          // Reset angle when brand changes
          toothAngleSelections: { ...s.toothAngleSelections, [tooth]: null },
        })),

      setToothAngle: (tooth, angle) =>
        set((s) => ({
          toothAngleSelections: { ...s.toothAngleSelections, [tooth]: angle },
        })),

      assignLibrary: (toothNumber, assignment) =>
        set((s) => ({
          toothAssignments: { ...s.toothAssignments, [toothNumber]: assignment },
        })),

      removeAssignment: (toothNumber) =>
        set((s) => {
          const next = { ...s.toothAssignments };
          delete next[toothNumber];
          return { toothAssignments: next };
        }),

      clearTeeth: () =>
        set({
          selectedTeeth: [], activeTooth: null,
          toothBrandSelections: {}, toothAngleSelections: {}, toothAssignments: {},
        }),

      setToothInstanceMap: (map) => set({ toothInstanceMap: map }),

      assignToothToInstance: (instanceIndex, toothNumber) =>
        set((s) => ({
          toothInstanceMap: {
            ...s.toothInstanceMap,
            [instanceIndex]: toothNumber,
          },
        })),

      clearToothInstanceMap: () => set({ toothInstanceMap: {} }),

      resumeCase: (caseData) =>
        set({
          isResuming: true,
          currentStep: caseData.current_step || 1,
          caseId: caseData.id,
          caseRef: caseData.case_reference,
          patientData: {
            fullName: caseData.patient_name || '',
            age: caseData.patient_age?.toString() || '',
            caseDate: caseData.case_date || today(),
            notes: caseData.doctor_notes || '',
          },
          selectedVendorIds: caseData.selected_vendor_ids || [],
          selectedTeeth: [],
          activeTooth: null,
          toothBrandSelections: {},
          toothAngleSelections: {},
          toothAssignments: {},
          toothInstanceMap: {},
        }),

      resetCase: () =>
        set({
          isResuming: false,
          currentStep: 1,
          patientData: { ...DEFAULT_PATIENT, caseDate: today() },
          caseId: null,
          caseRef: null,
          selectedVendorIds: [],
          selectedTeeth: [],
          activeTooth: null,
          toothBrandSelections: {},
          toothAngleSelections: {},
          toothAssignments: {},
          toothInstanceMap: {},
        }),
    }),
    {
      name: 'mpf-employee-case',
      partialize: (s) => ({
        currentStep: s.currentStep,
        patientData: s.patientData,
        caseId: s.caseId,
        caseRef: s.caseRef,
        selectedVendorIds: s.selectedVendorIds,
        selectedTeeth: s.selectedTeeth,
        activeTooth: s.activeTooth,
        toothBrandSelections: s.toothBrandSelections,
        toothAngleSelections: s.toothAngleSelections,
        toothAssignments: s.toothAssignments,
        toothInstanceMap: s.toothInstanceMap,
      }),
    }
  )
);
