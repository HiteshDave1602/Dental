import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL =
    import.meta.env.VITE_ENV === 'PROD'
        ? import.meta.env.VITE_BASE_URL_PRODUCTION
        : import.meta.env.VITE_BASE_URL_DEVELOPMENT;

const FALLBACK_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const RESOLVED_BASE_URL = API_BASE_URL || FALLBACK_BASE_URL;

// Backend error `detail` is inconsistently shaped: a plain string for most
// validation errors, or a `{code, message}` dict for alignment-job failures
// (see analysis/alignment routers) — this normalizes both to display text.
export const extractErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    // FastAPI 422 returns detail as an array of {loc, msg, type} objects.
    if (Array.isArray(detail)) {
        return detail.map((d) => d?.msg || d?.message).filter(Boolean).join(', ') || fallback;
    }
    return (typeof detail === 'object' ? detail?.message : detail) || fallback;
};

const apiClient = axios.create({
    baseURL: RESOLVED_BASE_URL,
});

export const notifyError = (text, backgroundColor = '#FEE2E2', color = '#B91C1C') => toast.error(text, {
    position: 'bottom-right',
    style: {
        backgroundColor,
        color,
    },
});

export const notifySuccess = (text, backgroundColor = '#DCFCE7', color = '#166534') => toast.success(text, {
    position: 'bottom-right',
    style: {
        backgroundColor,
        color,
    },
});

apiClient.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            notifyError('Session expired. Please login again.');
        }
        return Promise.reject(error);
    }
);

const buildFormData = (payload) => {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            formData.append(key, value);
        }
    });

    return formData;
};

export const apiService = {
    get: (url, params, config = {}) => apiClient.get(url, { ...config, params }),
    post: (url, data, config = {}) => apiClient.post(url, data, config),
    put: (url, data, config = {}) => apiClient.put(url, data, config),
    patch: (url, data, config = {}) => apiClient.patch(url, data, config),
    delete: (url, config = {}) => apiClient.delete(url, config),
    postForm: (url, data, config = {}) => {
        const form = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                form.append(key, value);
            }
        });

        return apiClient.post(url, form, {
            ...config,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(config.headers || {}),
            },
        });
    },
    postMultipart: (url, payload, config = {}) => {
        const formData = payload instanceof FormData ? payload : buildFormData(payload);
        return apiClient.post(url, formData, config);
    },
    putMultipart: (url, payload, config = {}) => {
        const formData = payload instanceof FormData ? payload : buildFormData(payload);
        return apiClient.put(url, formData, config);
    },
};

const EMPLOYEE_TOKEN_KEY = 'employee_token';

const employeeClient = axios.create({
    baseURL: RESOLVED_BASE_URL,
});

employeeClient.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem(EMPLOYEE_TOKEN_KEY);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

employeeClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            notifyError('Session expired. Please login again.');
        }
        return Promise.reject(error);
    }
);

export const employeeService = {
    get: (url, params, config = {}) => employeeClient.get(url, { ...config, params }),
    post: (url, data, config = {}) => employeeClient.post(url, data, config),
    put: (url, data, config = {}) => employeeClient.put(url, data, config),
    patch: (url, data, config = {}) => employeeClient.patch(url, data, config),
    delete: (url, config = {}) => employeeClient.delete(url, config),
    postMultipart: (url, payload, config = {}) => {
        const formData = payload instanceof FormData ? payload : buildFormData(payload);
        return employeeClient.post(url, formData, config);
    },
};

// ── Pathfinder (scan-body alignment) API ─────────────────────────────────────
// Ported from the standalone `pathfinder` frontend (originally raw `fetch` +
// VITE_API_BASE). Re-implemented on top of `employeeService` (axios) so every
// call carries the employee bearer token and hits RESOLVED_BASE_URL. The
// backend surface is the interactive alignment API: /api/jobs, /api/vendors,
// plus per-instance operations. Each function returns the parsed JSON body
// (axios `res.data`) to match the shapes the ported components expect.

// Create an alignment job: uploads the scene mesh (STL/PLY/OBJ) and one or more
// vendor selections. `vendor_id` is repeated once per vendor (FastAPI decodes
// repeated form keys into a list[str]), so the FormData is built by hand rather
// than via postMultipart (which can't emit duplicate keys).
export const createJob = async (sceneFile, vendorIds) => {
    const form = new FormData();
    form.append('scene', sceneFile);
    (Array.isArray(vendorIds) ? vendorIds : [vendorIds]).forEach((id) => {
        if (id) form.append('vendor_id', id);
    });
    const res = await employeeService.post('/api/jobs', form);
    return res.data;
};

// Replace one instance's SCAN BODY with another registered vendor's. Scan-body
// + display/export-only: the backend rewrites aligned_instance_NN.stl (+ scene
// composite) and stores the override as scan_body_vendor_id. Computation
// vendor, analog STLs, correctors, and angle_results are untouched — no
// recalculation needed afterward.
export const setInstanceVendor = async (jobId, instanceIndex, vendorId) => {
    const res = await employeeService.post(
        `/api/jobs/${jobId}/instances/${instanceIndex}/vendor`,
        { vendor_id: vendorId },
        { headers: { 'Content-Type': 'application/json' } }
    );
    return res.data;
};

// Full registry of vendors ([{id, name, description}]) — NOT job-scoped.
export const listVendors = async () => {
    const res = await employeeService.get('/api/vendors');
    return res.data?.vendors || [];
};

// Admin library company names shaped like the pathfinder vendor list
// ({id, name}) so the ported UI (UploadForm presets + per-instance scan-body
// dropdowns) can consume them in place of the /api/vendors endpoint.
export const listCompanyVendors = async () => {
    const res = await employeeService.get('/admin/brands');
    const raw = res.data?.data ?? res.data ?? [];
    return raw.map((b) =>
        typeof b === 'string'
            ? { id: b, name: b }
            : { id: b.id ?? b.company_name ?? b.name, name: b.company_name ?? b.name ?? b.id }
    );
};

// Set the per-instance z-axis rotation (clocking). One angle clocks BOTH analog
// STLs (pure + with-scan-body) plus the cube+analogs composite. Does NOT
// invalidate angle_results or corrector_results.
export const rotateAnalog = async (jobId, instanceIndex, angleDeg) => {
    const res = await employeeService.post(
        `/api/jobs/${jobId}/instances/${instanceIndex}/rotate-analog`,
        { angle_deg: angleDeg },
        { headers: { 'Content-Type': 'application/json' } }
    );
    return res.data;
};

export const getJob = async (jobId) => {
    const res = await employeeService.get(`/api/jobs/${jobId}`);
    return res.data;
};

// Trigger post-processing to calculate insertion angles and generate the final composite.
export const calculateAngles = async (jobId) => {
    const res = await employeeService.post(`/api/jobs/${jobId}/calculate-angles`);
    return res.data;
};

// User-guided targeted search for a missed instance. The user clicks a 3D point
// in the viewer; this runs constrained registration in a sphere around it.
// Returns { accepted, instance?, reason?, angle_results_invalidated }.
export const searchAroundPoint = async (jobId, x, y, z, searchRadius = null, vendorId = null) => {
    const body = { x, y, z };
    if (searchRadius !== null && searchRadius !== undefined) body.search_radius = searchRadius;
    if (vendorId) body.vendor_id = vendorId;
    const res = await employeeService.post(`/api/jobs/${jobId}/search-around-point`, body, {
        headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
};

// Remove a wrongly-placed instance (false positive). Invalidates angle_results.
export const deleteInstance = async (jobId, instanceIndex) => {
    const res = await employeeService.delete(`/api/jobs/${jobId}/instances/${instanceIndex}`);
    return res.data;
};

// Place pre-modeled angle-corrector STLs on each analog instance. Requires
// calculateAngles() to have been called first.
export const placeAngleCorrectors = async (jobId) => {
    const res = await employeeService.post(`/api/jobs/${jobId}/place-angle-correctors`);
    return res.data;
};

const api = {
    auth: {
        login: async (email, password) => apiService.postForm('/admin/auth/login', {
            username: email,
            password,
        }),
        signup: async (payload) => apiService.post('/admin/auth/signup', payload),
    },

    admin: {
        getCurrentAdmin: async (token) => apiService.get('/admin/auth/current_admin', undefined, token ? {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        } : {}),
        updateCurrentAdmin: async (payload, token) => apiService.put('/admin/auth/update', payload, token ? {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        } : {}),
        // Admin-only aggregations (admin-token scoped)
        dashboardStats: async () => apiService.get('/admin/stats'),
        listUsers: async (params) => apiService.get('/admin/users', params),
    },

    libraries: {
        list: async () => apiService.get('/admin/libraries'),
        create: async (payload) => apiService.postMultipart('/admin/libraries', payload),
        update: async (libraryId, payload) => apiService.putMultipart(`/admin/libraries/${libraryId}`, payload),
        uploadAsset: async (libraryId, payload) => apiService.postMultipart(`/admin/libraries/${libraryId}/assets`, payload),
        // Vendors registered on the alignment engine. A library's
        // alignment_vendor_id must be one of these ids or its cases cannot be
        // aligned, so the library form selects from this list.
        // Returns { vendors: [{id, name, description}], available }.
        alignmentVendors: async () => apiService.get('/admin/alignment-vendors'),
    },

    all_libraries: {
        // params: { page, size, search, company_name }
        list: async (params) => employeeService.get('/admin/all_libraries', params),
        // company_name required; angle_alignment optional — when provided returns only matching libraries
        listByCompany: async (companyName, angleAlignment = null) =>
            employeeService.get('/admin/libraries_by_company', {
                company_name: companyName,
                ...(angleAlignment !== null ? { angle_alignment: angleAlignment } : {}),
            }),
        // Distinct angle_alignment values for a brand (with library count per angle)
        anglesByBrand: async (companyName) =>
            employeeService.get('/admin/angles_by_brand', { company_name: companyName }),
        getById: async (libraryId) => employeeService.get(`/admin/library/${libraryId}`),
        listByAngle: async (angleAlignment) => employeeService.get('/admin/libraries_by_angle', { angle_alignment: angleAlignment }),
        brands: async () => employeeService.get('/admin/brands'),
    },

    plans: {
        list: async (params) => apiService.get('/plans', params),
        get: async (planId) => apiService.get(`/plans/${planId}`),
        create: async (payload) => apiService.post('/plans', payload),
        update: async (planId, payload) => apiService.patch(`/plans/${planId}`, payload),
        remove: async (planId) => apiService.delete(`/plans/${planId}`),
    },

    subscriptions: {
        list: async (params) => apiService.get('/subscriptions', params),
        get: async (subscriptionId) => apiService.get(`/subscriptions/${subscriptionId}`),
        create: async (payload) => apiService.post('/subscriptions', payload),
        update: async (subscriptionId, payload) => apiService.patch(`/subscriptions/${subscriptionId}`, payload),
        remove: async (subscriptionId) => apiService.delete(`/subscriptions/${subscriptionId}`),
    },

    // ── Pathfinder (scan-body alignment) ──────────────────────────────────────
    pathfinder: {
        createJob,
        setInstanceVendor,
        listVendors,
        rotateAnalog,
        getJob,
        calculateAngles,
        searchAroundPoint,
        deleteInstance,
        placeAngleCorrectors,
    },

    // ── Employee / User Panel ─────────────────────────────────────────────────
    employee: {
        auth: {
            register: async (payload) => employeeService.post('/user/auth/register', payload),
            login: async (payload) => employeeService.post('/user/auth/login', payload),
            logout: async () => employeeService.post('/user/auth/logout'),
            me: async () => employeeService.get('/user/auth/me'),
        },
        profile: {
            get: async () => employeeService.get('/user/profile'),
            update: async (payload) => employeeService.put('/user/profile', payload),
            changePassword: async (payload) => employeeService.put('/user/profile/change-password', payload),
        },
        cases: {
            list: async (params) => employeeService.get('/user/cases', params),
            create: async (payload) => employeeService.post('/user/cases', payload),
            get: async (caseId) => employeeService.get(`/user/cases/${caseId}`),
            update: async (caseId, payload) => employeeService.put(`/user/cases/${caseId}`, payload),
            remove: async (caseId) => employeeService.delete(`/user/cases/${caseId}`),
            getTeeth: async (caseId) => employeeService.get(`/user/cases/${caseId}/teeth`),
            addTeeth: async (caseId, teeth) => employeeService.post(`/user/cases/${caseId}/teeth`, teeth),
            updateTooth: async (caseId, toothId, payload) => employeeService.put(`/user/cases/${caseId}/teeth/${toothId}`, payload),
            uploadScan: async (caseId, file) => {
                const form = new FormData();
                form.append('file', file);
                return employeeService.post(`/user/cases/${caseId}/upload-scan`, form);
            },
            updateStep: async (caseId, step) =>
                employeeService.patch(`/user/cases/${caseId}/step`, { current_step: step }),
        },
        analysis: {
            calculate: async (caseId) => employeeService.post(`/user/analysis/calculate/${caseId}`),
            results: async (caseId) => employeeService.get(`/user/analysis/${caseId}/results`),
        },
        alignment: {
            status: async (caseId) => employeeService.get(`/user/cases/${caseId}/alignment/status`),
        },
        subscription: {
            myPlan: async () => employeeService.get('/user/subscription/my-plan'),
            plans: async () => employeeService.get('/user/subscription/plans'),
            usage: async () => employeeService.get('/user/subscription/usage'),
        },
    },
};

export default api;