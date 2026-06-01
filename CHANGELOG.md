# CHANGELOG.md

---

## v3.0 — 2026-05-30 (CURRENT)

### 🆕 New Features
- **Resource Planning page** (`/planning`) — Conflict detection engine
  - Project Readiness Checker: select project → auto-check all required assets & employees against mobilization date
  - Equipment Availability: pick any date → see which assets are available with reason
  - Manpower Availability: pick any date → see who's available, cert expiry alerts
- **Equipment Movement** (`/movement`) — Send Out / Receive In
  - Updates asset status, location, currentProject in real-time
  - Export movement log to Excel
- **Bulk Import** (`/import`) — 2,812 real PS SKL assets preloaded
  - One-click import to Firebase when ready
  - Download Excel template for manual imports

### 🔧 Fixed
- **Light/Dark Mode** — Complete rewrite of `index.css` using CSS custom properties
  - All pages now use `var(--t-text)`, `var(--t-bg2)` etc. — no hardcoded dark colors
  - Persists theme choice in `localStorage`
  - Role badge always readable (solid background) in both modes
- **Maintenance page** — Redesigned as Job Card system
  - 1 asset can have multiple work types per job (Load Test + VS + MPI together)
  - Certificate date fields: Load Test Date, VS Date, MPI Date, HT Date (+ add custom)
  - Click row to expand detail view with cert dates and custom fields
- **Projects ↔ Timeline linked** — Both pages use `projectsService` from same Firestore collection
  - Add/edit in Projects → shows in Timeline immediately (and vice versa)
  - "→ Timeline" button in Projects modal
- **Firebase crash fix** — Demo mode never imports Firebase Auth modules
- **classList null fix** — NavLink render function corrected in Layout.jsx
- **Manpower certs** — Flexible, no hardcoded HUET/BOSIET
  - Preset buttons (BOSIET, Medical, CompEx...) + free-text custom cert
  - Each cert has expiry date + cert number field

### 🗂️ Files Changed
- `src/App.jsx` — added /planning route
- `src/index.css` — full rewrite with CSS variables
- `src/components/shared/Layout.jsx` — dark/light toggle, Resource Planning in nav
- `src/components/dashboard/Dashboard.jsx` — CSS vars throughout
- `src/components/projects/ProjectsPage.jsx` — linked to Timeline, CSS vars
- `src/components/projects/TimelinePage.jsx` — shared projectsService, CSS vars, EN locale
- `src/components/maintenance/MaintenancePage.jsx` — Job Card redesign
- `src/components/manpower/ManpowerPage.jsx` — flexible certs
- `src/components/assets/AssetsPage.jsx` — pagination (50/page), custom fields, CSS vars
- `src/components/planning/ResourcePlanningPage.jsx` — NEW
- `src/components/operations/MovementPage.jsx` — NEW
- `src/components/assets/BulkImportPage.jsx` — NEW
- `src/data/assetData.js` — NEW (2,812 real assets)
- `src/contexts/ThemeContext.jsx` — NEW
- `src/contexts/AuthContext.jsx` — demo mode never calls Firebase

---

## v2.0 — 2026-05-26

### Added
- Dark/Light toggle button (initial version)
- Project Timeline (Gantt chart)
- Equipment Tracking with history timeline
- Maintenance type: Load Test, Visual, MPI focus
- Flexible custom fields for assets and employees
- Firebase service layer with demo fallback

---

## v1.0 — 2026-05-24 (Initial)

### Added
- Executive Dashboard with KPI cards, charts, alerts
- Asset Management (sample data)
- Project Management
- Maintenance Management
- Manpower Management
- Inventory Management
- Operations Control Center
- Reports & Export (Excel + PDF)
- Firebase Auth (Email/Password)
- Role-based access (Admin, Ops Manager, Maintenance, Technician, Executive)
- Demo mode with localStorage session
- GitHub Actions CI/CD workflow
