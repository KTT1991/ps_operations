# HANDOVER.md — OGS OpsCenter
**For:** Next AI or developer continuing this project
**Date:** 2026-05-30
**Version:** v3.0-FINAL

---

## 1. Project Overview

**OGS OpsCenter** is an enterprise Oil & Gas Operations & Asset Management System built for **PS SKL** (a Thai oil & gas service company operating in the Gulf of Thailand, Myanmar, Oman, Labuan, and domestic refineries).

**What it does:**
- Track 2,812 pieces of equipment (CCU, pipe work, valves, hoses, pumps, etc.)
- Manage offshore/onshore projects with Gantt timeline
- Job Card–based maintenance with certificate tracking (Load Test, VS, MPI, HT dates)
- Resource conflict detection — know if equipment/people are double-booked
- Equipment movement log (Send Out / Receive In)
- Manpower with flexible certifications (no hardcoded HUET — each person has custom certs)
- Export to Excel and PDF

**Tech Stack:**
- Frontend: React 18 + Vite + Tailwind CSS
- Database: Firebase Firestore (NoSQL)
- Auth: Firebase Authentication (Email/Password)
- Hosting: Firebase Hosting
- CI/CD: GitHub Actions

---

## 2. Current Progress

| What | Status |
|---|---|
| UI — all 11 pages | ✅ Complete |
| Dark/Light mode | ✅ Complete (CSS variables) |
| Demo mode (no Firebase needed) | ✅ Works |
| 2,812 real assets preloaded | ✅ In `src/data/assetData.js` |
| Resource conflict detection | ✅ Complete |
| Firebase integration | ⏳ Needs real credentials in `.env.local` |
| Production deploy | ⏳ Not yet deployed |
| Real employee data | ⏳ Sample data only |

---

## 3. File Structure

```
oilgas-ops/
├── src/
│   ├── App.jsx                          # Routes (11 pages)
│   ├── main.jsx                         # Entry + providers
│   ├── index.css                        # Tailwind + CSS variables for dark/light
│   ├── firebase.js                      # Firebase init (safe for demo mode)
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx              # Login / role / demo session
│   │   └── ThemeContext.jsx             # Dark/Light toggle + localStorage
│   │
│   ├── services/
│   │   └── firebaseService.js           # CRUD for all collections + demo fallback
│   │
│   ├── data/
│   │   ├── assetData.js                 # ⭐ 2,812 real PS SKL assets (parsed from Excel)
│   │   └── sampleData.js               # Sample projects, employees, maintenance, KPIs
│   │
│   ├── utils/
│   │   └── exportUtils.js              # Excel (SheetJS) + PDF (jsPDF) exports
│   │
│   └── components/
│       ├── shared/
│       │   ├── Layout.jsx              # Sidebar + topbar + dark/light toggle
│       │   └── LoginPage.jsx           # Login + demo quick-login buttons
│       ├── dashboard/Dashboard.jsx     # KPIs, charts, alerts
│       ├── assets/
│       │   ├── AssetsPage.jsx          # Asset list, pagination 50/page, custom fields
│       │   └── BulkImportPage.jsx      # One-click import 2,812 assets to Firebase
│       ├── projects/
│       │   ├── ProjectsPage.jsx        # Project cards (linked to Timeline)
│       │   └── TimelinePage.jsx        # Gantt chart (linked to Projects)
│       ├── maintenance/MaintenancePage.jsx  # Job Card style, multi work-type, cert dates
│       ├── manpower/ManpowerPage.jsx        # Flexible certs, custom fields
│       ├── operations/
│       │   ├── OperationsPage.jsx      # Live board, equipment allocation
│       │   └── MovementPage.jsx        # Send Out / Receive In
│       ├── planning/
│       │   └── ResourcePlanningPage.jsx # ⭐ Conflict detection, availability check
│       ├── reports/ReportsPage.jsx     # 7 report types, Excel + PDF
│       └── inventory/InventoryPage.jsx # Hidden in nav — future use
│
├── .env.local              # Firebase credentials (NOT committed to git)
├── .env.example            # Template for credentials
├── firebase.json           # Firebase hosting config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
├── .github/workflows/firebase-deploy.yml  # CI/CD auto-deploy on push
├── PROJECT_STATUS.md       # Current module status
├── TODO.md                 # Pending tasks with priority
├── CHANGELOG.md            # Version history
└── HANDOVER.md             # This file
```

---

## 4. Database Structure (Firestore)

### Collection: `assets`
```js
{
  id: "PCC-10K-DUALPOT-001",   // Asset No. from Excel — used as document ID
  name: "DUAL POT STRAINER 4\" 10K",
  category: "CCU",
  type: "CCU",
  serialNumber: "SN-001",
  manufacturer: "Vendor Name",
  status: "Available",          // Available | In Use | Under Maintenance | Damaged | Reserved | Standby | Disposal
  location: "PS Songkhla — Workshop",
  currentProject: "PRJ-001",   // null when available
  availableDate: "2026-06-15", // when it returns from project
  maintenanceDue: "2026-12-31",
  certificationExpiry: "2027-01-01",
  condition: "Good",
  utilization: 0,
  customFields: [              // user-added fields
    { key: "SWL", value: "25 Tons" },
    { key: "WLL", value: "25 Tons" }
  ],
  notes: "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

### Collection: `projects`
```js
{
  id: "PRJ-2026-001",
  name: "Offshore Platform A — Annual Shutdown",
  clientName: "PTT E&P",
  type: "Offshore",             // Offshore | Onshore | Shutdown | Emergency
  siteLocation: "Gulf of Thailand — Block B5",
  status: "Active",             // Planned | Preparing | Mobilizing | Active | Demobilizing | Delayed | Completed
  riskLevel: "Medium",          // Low | Medium | High
  projectManager: "EMP-001",   // employee ID
  mobilizationDate: "2026-01-15",
  startDate: "2026-01-20",
  endDate: "2026-03-01",
  demobilizationDate: "2026-03-07",
  budget: 4500000,
  readiness: 95,               // 0-100 (currently manual — should auto-calculate)
  requiredEquipment: ["PCC-10K-001", "PCC-10K-002"],   // asset IDs needed
  requiredTechnicians: ["EMP-001", "EMP-002"],          // employee IDs needed
  description: "Annual inspection...",
  createdAt: serverTimestamp()
}
```

### Collection: `employees`
```js
{
  id: "EMP-001",
  name: "Somchai Wiriyaporn",
  position: "Senior Instrumentation Engineer",
  department: "Operations",
  email: "somchai@psops.com",
  phone: "+66-81-234-5678",
  availability: "Assigned",    // Available | Assigned | Offshore | On Leave | Training
  currentProject: "PRJ-2026-001",
  rotation: "28/28",
  utilization: 90,
  certFields: [                // FLEXIBLE — user adds whatever certs they have
    { label: "BOSIET", expiry: "2026-10-01", certNo: "BST-2024-001" },
    { label: "Medical", expiry: "2026-08-15", certNo: "" },
    { label: "H2S Safety", expiry: "2027-01-01", certNo: "" }
  ],
  skills: ["Welding", "Rigging", "NDT"],
  customFields: [
    { key: "Gate Pass No.", value: "GP-2026-001" }
  ],
  notes: ""
}
```

### Collection: `maintenance`
```js
{
  id: "MNT-001",
  assetId: "PCC-10K-001",
  jobCardNo: "JC-2026-001",
  workTypes: ["Load Test", "Visual Inspection (VS)"],  // multi-select
  description: "Annual Load Test per API 4F",
  technician: "EMP-001",
  status: "Completed",         // Scheduled | In Progress | Pending Parts | Pending Approval | Completed | Cancelled
  startDate: "2026-05-01",
  endDate: "2026-05-03",
  result: "Pass",              // Pass | Fail | Conditional Pass | Pending Lab Result
  cost: 45000,
  remarks: "All within spec",
  certFields: [                // flexible cert dates per job
    { label: "Load Test Date", date: "2026-05-03", certNo: "LT-2026-001" },
    { label: "VS Date", date: "2026-05-02", certNo: "VS-2026-001" }
  ],
  customFields: [
    { key: "SWL", value: "25 Tons" },
    { key: "Test Load", value: "27.5 Tons (110%)" }
  ]
}
```

### Collection: `users` (for role-based access)
```js
{
  // document ID = Firebase Auth UID
  role: "admin",               // admin | operations_manager | maintenance | technician | executive
  name: "Admin User",
  email: "admin@psops.com"
}
```

---

## 5. Environment Variables

File: `.env.local` (never commit this)

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_COMPANY_NAME=PS SKL Operations
```

**Demo mode trigger:** if `VITE_FIREBASE_API_KEY` is missing or equals `demo-key`, the system auto-switches to demo mode using localStorage and `src/data/assetData.js`.

---

## 6. How Demo Mode Works

```
AuthContext.jsx checks:
  if API key is 'demo-key' or missing → isDemoMode = true
  
Login → checks DEMO_USERS object (no Firebase call)
       → stores session in localStorage

firebaseService.js checks:
  if isDemoMode → uses in-memory clone of assetData.js / sampleData.js
               → CRUD operations modify memory (lost on refresh)
  if Firebase configured → uses real Firestore
```

Demo accounts (password: `demo123`):
- `admin@demo.com` — full access
- `manager@demo.com` — operations manager
- `tech@demo.com` — technician
- `exec@demo.com` — executive viewer

---

## 7. Role Permissions

| Role | Can do |
|---|---|
| `admin` | Everything — all CRUD, delete |
| `operations_manager` | View all, edit projects/assets/manpower |
| `maintenance` | View assets, edit maintenance, view inventory |
| `technician` | View own assignments, update status |
| `executive` | Dashboard + reports (read-only) |

Enforced by: `firestore.rules` (server-side) + UI hiding (client-side)

---

## 8. Resource Planning Logic

The conflict detection in `ResourcePlanningPage.jsx` works as follows:

**Equipment conflict check (`isAvailableOn`):**
1. Status = Available → ✅ OK
2. Status = Damaged → ❌ Not deployable
3. Status = Under Maintenance → check `asset.availableDate` vs `project.mobilizationDate`
4. Status = In Use → check `asset.availableDate` vs `project.mobilizationDate`
5. If return date is after mobilization → ❌ CONFLICT

**Manpower conflict check (`isEmployeeAvailable`):**
1. availability = Available → ✅ OK
2. availability = On Leave / Training → ❌
3. Any `certFields[].expiry` < mobilization date → ❌ Cert expired
4. Has `currentProject` → find project's endDate → if overlaps → ❌ Double-booking

**Gap:** `project.requiredEquipment[]` and `project.requiredTechnicians[]` must be populated first. Currently manual — no UI to assign resources to projects from ResourcePlanning page itself.

---

## 9. Pending Tasks (Priority Order)

### Must-do before production:
1. Create Firebase project + fill `.env.local`
2. Create admin user in Firebase Auth + `users/{uid}` doc in Firestore
3. Go to `/import` → import 2,812 assets
4. Add real employee data with actual certifications
5. `npm run build && npx firebase deploy`
6. Add GitHub secrets for auto-deploy

### Next development priorities:
1. **Auto-assign resources to projects** — UI in Projects page to select `requiredEquipment[]` and `requiredTechnicians[]` by picking from asset/employee lists
2. **Equipment Movement → auto-set availableDate** — when Send Out, set `asset.availableDate = project.endDate` automatically
3. **Project readiness % auto-calculate** — `(assigned/required) × 100` instead of manual input
4. **Maintenance → auto-update asset.maintenanceDue** — when job card marked Completed, push next maintenance date to asset record

---

## 10. Known Issues

| Issue | Impact | Fix |
|---|---|---|
| Project `readiness` % is manual | Medium | Calculate from requiredEquipment/Technicians assigned vs total |
| `availableDate` on assets not auto-set from movement | Medium | Equipment Movement → set `asset.availableDate = project.endDate` on Send Out |
| Resource Planning reads `requiredEquipment[]` but no UI to set it | Medium | Add multi-select in Projects modal |
| Light mode: some inline `style={{color:'...'}}` with hex values may still be dark | Low | Review any remaining hardcoded `#94a3b8` or `#64748b` inline styles |
| Bulk import: Firebase batch quota may limit single-run import of 2,812 items | Medium | Import is done in batches of 50 — may take 1-2 minutes |
| Timeline `parseISO` returns Invalid Date for empty string | Low | Already handled with try/catch — gracefully skips |

---

## 11. Quick Reference: Key Decisions Made

| Decision | Reason |
|---|---|
| Asset document ID = Asset No. (e.g. PCC-10K-001) | Easier to search, no random IDs |
| Demo mode uses memory clone of assetData.js | No Firebase needed to test |
| Inventory hidden | Duplicate of existing store system — future dev |
| No hardcoded HUET/BOSIET in employee form | PS SKL staff have different certs per role |
| Maintenance = Job Card (not per-check-type) | 1 job often does multiple tests simultaneously |
| Projects and Timeline share same Firestore collection | Add once, show everywhere |
| CSS variables (`--t-text`, `--t-bg2`) for all theme colors | Single source of truth for dark/light |
