# 📖 User Guide / คู่มือการใช้งาน

This guide provides an overview of the features and functionalities of the Project & Asset Management System.

> คู่มือนี้ให้ภาพรวมเกี่ยวกับฟีเจอร์และฟังก์ชันการทำงานของระบบบริหารจัดการโครงการและสินทรัพย์

---

### 🌟 1. Dashboard / แดชบอร์ด

The Dashboard provides a high-level overview of all critical information.

> แดชบอร์ดคือหน้าแรกที่คุณจะเห็นหลังจากเข้าสู่ระบบ ซึ่งจะให้ภาพรวมข้อมูลที่สำคัญทั้งหมดในระดับสูง

- **Project Overview (ภาพรวมโครงการ):** A list of all active and upcoming projects. You can see their status and key details at a glance.
 > > รายชื่อโครงการที่กำลังดำเนินการและที่กำลังจะมาถึง คุณสามารถดูสถานะและรายละเอียดสำคัญได้อย่างรวดเร็ว

- **Equipment Status (สถานะอุปกรณ์):** A summary of your asset inventory, categorized by status (e.g., Available, In Use, Maintenance).
 > > สรุปรายการสินทรัพย์ของคุณ โดยจัดหมวดหมู่ตามสถานะ (เช่น Available, In Use, Maintenance)

- **Project Readiness (ความพร้อมของโครงการ):** A chart showing the readiness level of upcoming projects.
> > แผนภูมิแสดงระดับความพร้อมของโครงการที่กำลังจะมาถึง

---

### 📅 2. Project Timeline / ไทม์ไลน์โครงการ

This page provides a Gantt-chart-like visualization of all projects over time.

> หน้านี้แสดงภาพรวมโครงการทั้งหมดในรูปแบบแผนภูมิแกนต์ (Gantt chart) ตามช่วงเวลา

- **Reading the Chart (การอ่านแผนภูมิ):** Each bar represents a project's duration. A thinner, darker bar inside represents the mobilization phase.
> > แต่ละแท่งแสดงถึงระยะเวลาของโครงการ โดยแท่งที่เล็กและสีเข้มกว่าด้านในแสดงถึงช่วงเวลาการเตรียมการ (Mobilization)

- **Color Codes (ความหมายของสี):**
  - 🟢 **Green (สีเขียว):** Active projects. (โครงการที่กำลังดำเนินการ)
  - 🔵 **Blue (สีน้ำเงิน):** Preparing/mobilization phase. (ช่วงเตรียมการ)
  - 🔴 **Red (สีแดง):** Delayed projects. (โครงการที่ล่าช้า)

---

### 📦 3. Asset Management / การจัดการสินทรัพย์

This section allows you to manage the master list of all company assets.

> ส่วนนี้ช่วยให้คุณสามารถจัดการรายการสินทรัพย์หลักทั้งหมดของบริษัทได้

- **Key Fields (ฟิลด์สำคัญ):** Includes `assetNo`, `name`, `type`, `status`, and the default `location`.
> > ประกอบด้วย `assetNo` (รหัสเฉพาะ), `name` (ชื่อ), `type` (ประเภท), `status` (สถานะ), และ `location` (ตำแหน่งที่ตั้งเริ่มต้น)

---

### 🚚 4. Equipment Loading / การนำเข้า-ออกอุปกรณ์

This module is crucial for tracking the physical location of assets.

> โมดูลนี้มีความสำคัญอย่างยิ่งสำหรับการติดตามตำแหน่งทางกายภาพของสินทรัพย์

- **Load In (การนำเข้า):** When an asset is physically moved to a project site, a "Load In" record is created. This action updates the asset's `currentLocation` field to the project's site location.
> > เมื่อสินทรัพย์ถูกย้ายไปยังหน้างานโครงการ จะมีการสร้างบันทึก "Load In" การกระทำนี้จะอัปเดตฟิลด์ `currentLocation` ของสินทรัพย์ให้เป็นที่ตั้งของหน้างานโครงการ

- **Load Out (การนำออก):** When an asset is returned from a site, a "Load Out" record is created. This action clears the `currentLocation` field, and its location effectively reverts to its default `location` or 'Depot'.
> > เมื่อสินทรัพย์ถูกส่งคืนจากหน้างาน จะมีการสร้างบันทึก "Load Out" การกระทำนี้จะล้างค่าในฟิลด์ `currentLocation` และตำแหน่งของมันจะกลับไปเป็นค่าเริ่มต้น (`location`) หรือ 'Depot'

---

### 🔍 5. Resource Explorer / เครื่องมือสำรวจทรัพยากร

This is a powerful search tool to find information across Assets, Manpower, and Projects.

> นี่คือเครื่องมือค้นหาที่มีประสิทธิภาพเพื่อค้นหาข้อมูลจากทรัพยากรทั้งหมดในระบบ: สินทรัพย์, บุคลากร, และโครงการ

#### 5.1 🛠️ Asset Explorer Tab / แท็บสำรวจสินทรัพย์

- **Purpose (วัตถุประสงค์):** To search for any asset and view its history.
> > เพื่อค้นหาสินทรัพย์ใดๆ และดูประวัติของมัน

- **How to Use (วิธีใช้งาน):**
  1. Enter an Asset No, Name, or Type.
  2. The system displays a table of matching assets.
  3. Click on any row to drill down into the **Asset Timeline** view.
> > 1. ป้อนรหัสสินทรัพย์, ชื่อ, หรือประเภท
> > 2. ระบบจะแสดงตารางของสินทรัพย์ที่ตรงกัน
> > 3. คลิกที่แถวใดก็ได้เพื่อเจาะลึกไปยังมุมมอง **Asset Timeline**

- **Asset Timeline View (มุมมองไทม์ไลน์สินทรัพย์):** This view shows the asset's current status, location, assigned project, and a full history trail.
> > มุมมองนี้แสดงสถานะ, ตำแหน่ง, โครงการที่ได้รับมอบหมายล่าสุด และเส้นทางประวัติทั้งหมดของสินทรัพย์

#### 5.2 👷 Manpower History Tab / แท็บประวัติบุคลากร

- **Purpose (วัตถุประสงค์):** To find an employee and view their work history.
> > เพื่อค้นหาพนักงานและดูประวัติการทำงานของพวกเขา

- **How to Use (วิธีใช้งาน):**
  1. Enter an employee's Name or Position.
  2. The system displays a table of matching employees.
  3. Click on a row to see that employee's **Work History**.
> > 1. ป้อนชื่อหรือตำแหน่งของพนักงาน
> > 2. ระบบจะแสดงตารางของพนักงานที่ตรงกัน
> > 3. คลิกที่แถวเพื่อดู **ประวัติการทำงาน** ของพนักงานคนนั้น

#### 5.3 🏗️ Project View Tab / แท็บมุมมองโครงการ

- **Purpose (วัตถุประสงค์):** To get a quick snapshot of all resources assigned to a specific project.
> > เพื่อดูภาพรวมอย่างรวดเร็วของทรัพยากรทั้งหมดที่ถูกมอบหมายให้กับโครงการใดโครงการหนึ่ง

- **How to Use (วิธีใช้งาน):**
  1. Enter a Project No, Name, or Client Name.
  2. The system displays a table of matching projects.
  3. Click on a row to see the **Project Snapshot**.
> > 1. ป้อนรหัสโครงการ, ชื่อโครงการ, หรือชื่อลูกค้า
> > 2. ระบบจะแสดงตารางของโครงการที่ตรงกัน
> > 3. คลิกที่แถวเพื่อดู **ภาพรวมโครงการ**

- **Project Snapshot View (มุมมองภาพรวมโครงการ):** Lists all assets and manpower currently assigned to the selected project.
> > แสดงรายการสินทรัพย์และบุคลากรทั้งหมดที่ถูกมอบหมายให้กับโครงการที่เลือกในปัจจุบัน
