# MyPathFinder Frontend

React + Vite SPA containing both panels of the product.

## Prerequisites

This is the top of a three-part stack and does nothing useful alone:

| Service | Port | Repo |
|---|---|---|
| This SPA | 5174 | here |
| Middleware API | 8000 | `pathfinder` |
| Alignment compute service | 9000 | `dental-backend` |

Start the middleware and the compute service first — see the middleware's
README, which covers configuration and the shared secrets between the two
backends.

## Routing split

Host-based, not path-based:

- `admin.*` hosts render the **admin panel**
- every other host renders the **employee panel** (the dentist-facing app)

Add to your hosts file:

```txt
127.0.0.1 admin.localhost
```

Then:

```bash
npm install
npm run dev
```

- Employee panel: <http://localhost:5174/>
- Admin panel: <http://admin.localhost:5174/login>

Point the SPA at the middleware with `VITE_API_URL` in `.env` (defaults to
`http://127.0.0.1:8000`).

## The two panels

**Admin** — manages implant libraries, plans, subscriptions and users. The
important field on a library is **Alignment Vendor**: it maps the library to
an implant system the compute service can detect. A library without one cannot
be used for analysis, so the form offers only vendors the engine actually
reports. Tolerance is configured per library, in **degrees**.

There is no admin sign-up screen. The first admin is created from a shell on
the middleware (`python -m scripts.manage create-admin`).

**Employee** — the dentist's case workflow, in three steps:

1. **Patient Info** — creates the case.
2. **Scan & Teeth** — pick teeth on the chart, assign each to a library, and
   upload the patient scan. Uploading submits an alignment job.
3. **Alignment Review** — the 3D viewer (`src/employee/pathfinder/`): watch
   detection complete, delete false positives, add missed implants by clicking
   the scan, swap the displayed scan body, then calculate angles, clock the
   analogs, and place correctors.

Placing correctors records the results against the case, which is what makes
them appear in **My Cases** (expand a row to see per-tooth angles, tolerance
status and corrector sizes).

The review is scoped to its case and its state lives server-side, so
refreshing mid-review resumes rather than starting over.

## Notable code

- `src/Script/api.js` — the whole API surface, one function per endpoint, plus
  `extractErrorMessage` (use it: axios's own message is generic and hides what
  the backend actually said).
- `src/employee/pathfinder/Viewer3D.jsx` — react-three-fiber viewer. The
  trickiest code here: render-priority cascade, mesh cache-busting, live
  rotation preview, seed-point picking. Inline comments explain each
  non-obvious choice.
- `src/components/AlignmentVendorSelect.jsx` — the library-to-engine mapping
  control; degrades to a text input if the engine is unreachable.

Meshes are cache-busted by query string (`?v=…`) because several are rewritten
server-side at stable URLs — keep that pattern or the viewer shows stale
geometry.
