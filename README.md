# OGS OpsCenter — Oil & Gas Operations Management System

Enterprise-grade operations platform for Oil & Gas service companies, built with React + Firebase.

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- Firebase account (free tier works)
- Git + GitHub account
- VS Code

---

## ⚙️ Step 1: Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/oilgas-ops.git
cd oilgas-ops
npm install
```

---

## 🔥 Step 2: Firebase Setup

### 2.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → Name it `oilgas-ops`
3. Disable Google Analytics (optional) → **Create project**

### 2.2 Enable Firestore Database
1. Click **Firestore Database** → **Create database**
2. Choose **Start in test mode** (we'll add rules later)
3. Select region: **asia-southeast1** (Singapore)

### 2.3 Enable Authentication
1. Click **Authentication** → **Get started**
2. Enable **Email/Password** provider

### 2.4 Get Firebase Config
1. Click ⚙️ **Project Settings** → **General**
2. Scroll to **Your apps** → Click `</>` (Web)
3. Register app name: `oilgas-ops-web`
4. Copy the `firebaseConfig` values

### 2.5 Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase values:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_COMPANY_NAME=Your Company Name
```

### 2.6 Create Admin User
1. Firebase Console → **Authentication** → **Users** → **Add user**
2. Enter email & password for your admin account
3. Copy the User UID

### 2.7 Set User Role in Firestore
In Firestore, create document: `users/{YOUR_UID}`
```json
{
  "role": "admin",
  "name": "Your Name",
  "email": "your@email.com"
}
```

---

## 💻 Step 3: Run Locally

```bash
npm run dev
```

Open: http://localhost:5173

> **Note:** If Firebase is not configured, the app runs in **Demo Mode** automatically with sample data.

---

## 📤 Step 4: Deploy to Firebase Hosting

### 4.1 Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```
- Select your project
- Public directory: `dist`
- Single-page app: **Yes**
- Auto builds: **No**

### 4.2 Deploy
```bash
npm run build
firebase deploy
```

Your app will be live at: `https://your-project.web.app`

---

## 🔄 Step 5: GitHub + Auto-Deploy CI/CD

### 5.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: OGS OpsCenter"
git remote add origin https://github.com/YOUR_USERNAME/oilgas-ops.git
git push -u origin main
```

### 5.2 Add GitHub Secrets
Go to: GitHub repo → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:
| Secret Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Your API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | your-project-id |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `VITE_FIREBASE_APP_ID` | Your app ID |
| `VITE_COMPANY_NAME` | Your Company Name |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON |

### 5.3 Get Firebase Service Account
1. Firebase Console → ⚙️ **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Copy the entire JSON content → Paste as `FIREBASE_SERVICE_ACCOUNT` secret

Now every push to `main` auto-deploys! ✅

---

## 🔒 Step 6: Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 📋 System Modules

| Module | Features |
|---|---|
| 🏠 Dashboard | KPI cards, utilization trend, asset status donut, project progress, alerts |
| 📡 Operations Center | Live equipment board, project status, personnel deployment, alert feed |
| 📦 Asset Management | Full CRUD, status tracking, calibration alerts, Excel/PDF export |
| 🗂️ Project Management | Project cards, readiness %, equipment/manpower allocation |
| 🔧 Maintenance | PM/CM/Calibration records, cost tracking, downtime analysis |
| 👥 Manpower | Personnel cards, cert expiry tracking, utilization, skill matrix |
| 📦 Inventory | Stock levels, reorder alerts, safety stock, value tracking |
| 📊 Reports | 7 report types, Excel + PDF export, calibration/shortage previews |

---

## 👤 User Roles

| Role | Access |
|---|---|
| `admin` | Full access — all modules, CRUD |
| `operations_manager` | All modules, edit projects/assets/manpower |
| `maintenance` | Assets (view), maintenance (edit), inventory |
| `technician` | Own assignments, status updates |
| `executive` | Dashboard + reports (read-only) |

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Charts:** Recharts
- **Export:** SheetJS (Excel), jsPDF (PDF)
- **Hosting:** Firebase Hosting
- **CI/CD:** GitHub Actions

---

## 📁 Project Structure

```
src/
├── components/
│   ├── dashboard/      # Executive Dashboard
│   ├── assets/         # Asset Management
│   ├── projects/       # Project Management  
│   ├── maintenance/    # Maintenance Records
│   ├── manpower/       # Personnel Management
│   ├── inventory/      # Spare Parts Inventory
│   ├── operations/     # Operations Control Center
│   ├── reports/        # Reports & Export
│   └── shared/         # Layout, Login, shared UI
├── contexts/           # Auth context
├── data/               # Sample data
├── services/           # Firebase CRUD services
└── utils/              # Export utilities
```

---

## 🆘 Troubleshooting

**App shows demo mode:** Firebase not configured — edit `.env.local` with your real values

**Login fails:** Check Firebase Auth is enabled, user exists in Authentication

**Data not saving:** Check Firestore rules, user has correct role in `users` collection

**Build fails:** Run `npm install` again, check Node.js version ≥18

---

## 📞 Support

Built for Oil & Gas operations teams. Customize the sample data in `src/data/sampleData.js` to match your company's actual assets and projects.
