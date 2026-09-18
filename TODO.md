# TODO.md
**Last Updated:** 2026-05-30

---

## 🔴 HIGH PRIORITY — Must do before production

- [ ] **Firebase Setup** — Create Firebase project, fill `.env.local`
  - Enable Firestore (asia-southeast1)
  - Enable Email/Password Auth
  - Create admin user in Authentication
  - Add user doc in Firestore `users/{uid}` with role: "admin"

- [ ] **Bulk Import Assets** — After Firebase ready
  - Go to `/import` → Click "นำเข้า 2,812 Assets"
  - Or run seed script manually

- [ ] **Add Real Employee Data** — Currently using sample data
  - Go to Manpower → Add each technician
  - Add their actual certificates with expiry dates
  - Assign to projects

- [ ] **Deploy to Firebase Hosting**
  ```bash
  npm run build
  npx firebase deploy
  ```

- [ ] **Setup GitHub Actions** — Add secrets to GitHub repo
  - VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc.
  - FIREBASE_SERVICE_ACCOUNT (JSON from Firebase Console)

---

## 🟡 MEDIUM PRIORITY — Next development phase

- [ ] **Resource Planning — assign resources to projects**
  - Currently: checker reads `project.requiredEquipment[]` and `project.requiredTechnicians[]`
  - Need UI in Projects page to select which assets/people are required
  - Then ResourcePlanning auto-checks conflict

- [ ] **Asset availableDate field**
  - Equipment Movement (Send Out) should auto-set `asset.availableDate = project.endDate`
  - Currently user must manually enter available date

- [ ] **Maintenance → link to Asset**
  - When maintenance completed, auto-update `asset.maintenanceDue` to next date
  - Auto-update `asset.status` (In Use → Available when maintenance done)

- [ ] **Project Readiness % auto-calculate**
  - Currently: manual input
  - Should auto = (assigned resources / required resources) × 100

- [ ] **Email Alerts**
  - Firebase Functions for cert expiry / maintenance due reminders
  - Daily operations summary email

- [ ] **QR Code scanning**
  - `/assets/{id}` QR code generation (already has `qrcode` library in package.json)
  - Mobile scan → jump to asset detail

---

## 🟢 LOW PRIORITY — Future features

- [ ] **Inventory module** — Re-enable when ready (currently hidden in nav)
- [ ] **Predictive maintenance** — Based on maintenance history patterns
- [ ] **AI asset allocation** — Suggest best available asset for upcoming project
- [ ] **Mobile PWA** — Already responsive, need offline capability
- [ ] **Multi-language** — EN/TH toggle
- [ ] **Reporting dashboard** — Scheduled weekly/monthly auto-reports

---

## ✅ DONE

- [x] Light/Dark mode — CSS variables, persists localStorage
- [x] All pages use var(--t-text) not hardcoded slate colors
- [x] Maintenance — Job Card style, multi work-type, cert date fields
- [x] Projects ↔ Timeline — linked (same Firestore collection)
- [x] Resource Planning page — conflict detection, availability checker
- [x] Equipment Movement — Send Out / Receive In
- [x] Bulk Import — 2,812 real assets ready
- [x] Flexible custom fields — assets and employees
- [x] Flexible cert fields — employees (no hardcoded HUET)
- [x] Role badge — visible in both dark and light mode
- [x] Firebase crash fix — demo mode never calls Firebase APIs
- [x] classList bug fix — Layout.jsx NavLink render function
