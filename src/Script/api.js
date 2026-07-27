import axios from 'axios';
import { toast } from 'react-toastify';
import { DEMO_MODE } from '../config/demoMode';

const API_BASE_URL =
    import.meta.env.VITE_ENV === 'PROD'
        ? import.meta.env.VITE_BASE_URL_PRODUCTION
        : import.meta.env.VITE_BASE_URL_DEVELOPMENT;

const FALLBACK_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const RESOLVED_BASE_URL = API_BASE_URL || FALLBACK_BASE_URL;

/**
 * Resolve a backend-supplied URL against the API origin.
 *
 * The alignment payload deliberately mixes both forms, and that is not going to
 * change: `artifacts.composite` and `artifacts.instances[]` are relative proxy
 * paths, while `artifacts.scene` is absolute because the compute service has to
 * fetch the very same signed URL from outside the browser.
 *
 * Concatenating the base onto an absolute URL produced
 * `https://api.example.comhttps//api.example.com/...`, which fails DNS
 * resolution and crashed the 3D viewer with "Could not load". Anything already
 * carrying a scheme — or protocol-relative — is returned untouched.
 */
export const assetUrl = (path) => {
    if (!path) return path;
    if (/^(https?:)?\/\//i.test(path)) return path;
    return `${RESOLVED_BASE_URL}${path}`;
};

/**
 * `assetUrl` plus a cache-busting marker.
 *
 * The viewer re-requests a mesh when its rotation or scan body changes, and the
 * URL is identical each time, so the browser would serve the stale copy. The
 * separator has to be chosen rather than assumed: a presigned storage URL
 * already carries `?X-Amz-...`, and a second `?` makes the signature part of
 * the path, which the store rejects as unsigned.
 */
export const assetUrlWithVersion = (path, version) => {
    const url = assetUrl(path);
    if (!url || version === undefined || version === null || version === '') return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
};

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

// A 401 means the session is gone, so clear it and send the user to login.
// Previously this only showed a toast, leaving them on an authenticated-looking
// shell where every subsequent request failed.
const handleUnauthorized = (tokenKey, loginPath) => (error) => {
    if (!DEMO_MODE && error.response?.status === 401) {
        sessionStorage.removeItem(tokenKey);
        notifyError('Session expired. Please login again.');
        if (!window.location.pathname.startsWith(loginPath)) {
            window.location.assign(loginPath);
        }
    }
    return Promise.reject(error);
};

apiClient.interceptors.response.use(
    (response) => response,
    handleUnauthorized('token', '/login')
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
    handleUnauthorized(EMPLOYEE_TOKEN_KEY, '/login')
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

// ── Alignment review, scoped to a case ──────────────────────────────────────
//
// Every call below targets /user/cases/{caseId}/alignment/*. The scan comes
// from the case (uploaded in the wizard), so there is no separate job creation
// or mesh upload here — a job is submitted server-side when the scan lands.
// This replaced a standalone /api/* adapter whose jobs lived in memory and were
// never linked to a case, so a refresh lost the work.

const alignmentBase = (caseId) => `/user/cases/${caseId}/alignment`;
const unwrap = (res) => res.data?.data ?? res.data;

// The full viewer payload: instances, artifact URLs, and any angle/corrector
// results already computed — so a refresh mid-workflow restores the view.
export const getAlignmentState = async (caseId) =>
    unwrap(await employeeService.get(`${alignmentBase(caseId)}/viewer`));

// Detection progress. Alignment takes minutes, so the workflow polls this until
// the job reaches awaiting_review.
export const getAlignmentStatus = async (caseId) =>
    unwrap(await employeeService.get(`${alignmentBase(caseId)}/status`));

// Vendors registered on the engine, for the per-instance scan-body dropdowns.
export const listVendors = async (caseId) => {
    const data = unwrap(await employeeService.get(`${alignmentBase(caseId)}/vendors`));
    return Array.isArray(data) ? data : data?.vendors || [];
};

// Replace one instance's SCAN BODY with another registered vendor's.
// Display/export-only: the computation vendor, analogs, correctors and angle
// results are untouched, so nothing needs recomputing afterwards.
export const setInstanceVendor = async (caseId, instanceIndex, vendorId) =>
    unwrap(await employeeService.post(
        `${alignmentBase(caseId)}/instances/${instanceIndex}/scan-body`,
        { vendor_id: vendorId },
    ));

// Per-instance analog clocking. Does NOT invalidate angle or corrector results
// (rotation is about the insertion axis).
export const rotateAnalog = async (caseId, instanceIndex, angleDeg) =>
    unwrap(await employeeService.post(
        `${alignmentBase(caseId)}/instances/${instanceIndex}/rotation`,
        { angle_deg: angleDeg },
    ));

// Remove a wrongly-placed instance. Invalidates angle results.
export const deleteInstance = async (caseId, instanceIndex) =>
    unwrap(await employeeService.delete(`${alignmentBase(caseId)}/instances/${instanceIndex}`));

// Targeted search for a missed implant around a clicked 3D point. Runs
// asynchronously on the engine; poll the viewer until it settles.
export const searchAroundPoint = async (caseId, x, y, z, _searchRadius = null, vendorId = null) =>
    unwrap(await employeeService.post(`${alignmentBase(caseId)}/instances/search`, {
        x, y, z, vendor_id: vendorId || null,
    }));

export const calculateAngles = async (caseId) =>
    unwrap(await employeeService.post(`${alignmentBase(caseId)}/angles`));

// Final step: places correctors AND records the results against the case's
// teeth, so they appear in My Cases.
export const placeAngleCorrectors = async (caseId) =>
    unwrap(await employeeService.post(`${alignmentBase(caseId)}/correctors`));

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
        // The vendor bundle: the complete CAD asset set for one implant system
        // as a single .zip. This is what actually makes a library usable — the
        // older per-file uploads could never produce a runnable vendor.
        //
        // Slow on purpose: the alignment service downloads and unpacks the
        // archive before answering, so a bundle that cannot work is rejected
        // here rather than days later through a dentist's stuck case. Allow a
        // generous timeout and show the returned message, which names the
        // offending asset.
        uploadBundle: async (libraryId, file) => {
            const payload = new FormData();
            payload.append('file', file);
            return apiService.postMultipart(`/admin/libraries/${libraryId}/bundle`, payload, {
                timeout: 180000,
            });
        },
        listBundles: async (libraryId) => apiService.get(`/admin/libraries/${libraryId}/bundles`),
        // Vendors registered on the alignment engine. A library's
        // alignment_vendor_id must be one of these ids or its cases cannot be
        // aligned, so the library form selects from this list.
        // Returns { vendors: [{id, name, description}], available }.
        alignmentVendors: async () => apiService.get('/admin/alignment-vendors'),
        // Assets are no longer served from a public static path, so they have
        // to be fetched with the admin token and saved from the response body
        // rather than linked to directly.
        downloadAsset: async (libraryId, assetId) =>
            apiClient.get(`/admin/libraries/${libraryId}/assets/${assetId}`, { responseType: 'blob' }),
        // Retires a library from new selections. Rows are kept, so cases that
        // already reference it are unaffected.
        setArchived: async (libraryId, isArchived) =>
            apiService.patch(`/admin/libraries/${libraryId}/archive`, { is_archived: isArchived }),
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

    // NOTE: the `pathfinder` block that used to sit here has been removed. It
    // re-exported the alignment helpers off this object, but two of its entries
    // — `createJob` and `getJob` — were deleted when the workflow moved to being
    // case-scoped, and the shorthand references to them survived. Object
    // shorthand for a name that does not exist is valid syntax, so the bundler
    // built it happily and the browser threw `createJob is not defined` while
    // evaluating this module — which meant the ENTIRE app failed to load, not
    // just alignment.
    //
    // Nothing consumed `api.pathfinder`: every caller imports the named exports
    // above directly (see PathfinderWorkflow.jsx). Re-adding stubs would have
    // resurrected the pre-case-scoped flow, so the dead block is simply gone.

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
