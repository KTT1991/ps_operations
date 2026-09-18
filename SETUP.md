# OGS OpsCenter v3 — Quick Setup

## รันทันที (Demo Mode)
```bash
npm install
npm run dev
```
เปิด http://localhost:5173 แล้ว login ด้วย:
- admin@demo.com / demo123  → Admin
- manager@demo.com / demo123 → Ops Manager
- tech@demo.com / demo123   → Technician
- exec@demo.com / demo123   → Executive

## เปลี่ยนไปใช้ Firebase จริง
1. แก้ไฟล์ .env.local ใส่ค่าจาก Firebase Console
2. npm run dev → ระบบสลับเป็น Firebase อัตโนมัติ
3. ไปที่หน้า "Bulk Import" → กด "นำเข้า 2,812 Assets"

## Deploy ขึ้น Firebase Hosting
```bash
npm run build
npx firebase-tools deploy
```

## ไฟล์สำคัญ
- src/data/assetData.js    → ข้อมูล 2,812 assets จาก Excel ของคุณ
- src/data/sampleData.js   → sample projects, employees, maintenance
- .env.local               → Firebase config (อย่า commit ไฟล์นี้!)
