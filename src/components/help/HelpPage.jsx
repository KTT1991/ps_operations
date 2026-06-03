
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, LayoutDashboard, GanttChartSquare, Package, Truck, Search } from 'lucide-react';

const GuideSection = ({ title, icon, children }) => {
  const Icon = icon;
  return (
    <div className="bg-white dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/60 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 ease-in-out mb-8">
      <div className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/60 flex items-center gap-4">
        {Icon && <Icon className="w-7 h-7 text-orange-500 flex-shrink-0" />}
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">{title}</h2>
      </div>
      <div className="p-6">
         <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed prose-strong:font-semibold prose-p:text-gray-700 dark:prose-p:text-gray-300">
            {children}
        </div>
      </div>
    </div>
  );
};

export default function HelpPage() {
    const introContent = `This guide provides an overview of the features and functionalities of the Project & Asset Management System.

> คู่มือนี้ให้ภาพรวมเกี่ยวกับฟีเจอร์และฟังก์ชันการทำงานของระบบบริหารจัดการโครงการและสินทรัพย์`;
    
    const dashboardContent = `The Dashboard provides a high-level overview of all critical information.

> แดชบอร์ดคือหน้าแรกที่คุณจะเห็นหลังจากเข้าสู่ระบบ ซึ่งจะให้ภาพรวมข้อมูลที่สำคัญทั้งหมดในระดับสูง

- **Project Overview (ภาพรวมโครงการ):** A list of all active and upcoming projects. You can see their status and key details at a glance.

> > รายชื่อโครงการที่กำลังดำเนินการและที่กำลังจะมาถึง คุณสามารถดูสถานะและรายละเอียดสำคัญได้อย่างรวดเร็ว

- **Equipment Status (สถานะอุปกรณ์):** A summary of your asset inventory, categorized by status (e.g., Available, In Use, Maintenance).

> > สรุปรายการสินทรัพย์ของคุณ โดยจัดหมวดหมู่ตามสถานะ (เช่น Available, In Use, Maintenance)

- **Project Readiness (ความพร้อมของโครงการ):** A chart showing the readiness level of upcoming projects.

> > แผนภูมิแสดงระดับความพร้อมของโครงการที่กำลังจะมาถึง`;

    const timelineContent = `This page provides a Gantt-chart-like visualization of all projects over time.

> หน้านี้แสดงภาพรวมโครงการทั้งหมดในรูปแบบแผนภูมิแกนต์ (Gantt chart) ตามช่วงเวลา

- **Reading the Chart (การอ่านแผนภูมิ):** Each bar represents a project's duration. A thinner, darker bar inside represents the mobilization phase.

> > แต่ละแท่งแสดงถึงระยะเวลาของโครงการ โดยแท่งที่เล็กและสีเข้มกว่าด้านในแสดงถึงช่วงเวลาการเตรียมการ (Mobilization)

- **Color Codes (ความหมายของสี):**
  - 🟢 **Green (สีเขียว):** Active projects. (โครงการที่กำลังดำเนินการ)
  - 🔵 **Blue (สีน้ำเงิน):** Preparing/mobilization phase. (ช่วงเตรียมการ)
  - 🔴 **Red (สีแดง):** Delayed projects. (โครงการที่ล่าช้า)`;
    
    const assetMgmtContent = `This section allows you to manage the master list of all company assets.

> ส่วนนี้ช่วยให้คุณสามารถจัดการรายการสินทรัพย์หลักทั้งหมดของบริษัทได้

- **Key Fields (ฟิลด์สำคัญ):** Includes \`assetNo\`, \`name\`, \`type\`, \`status\`, and the default \`location\`.

> > ประกอบด้วย \`assetNo\` (รหัสเฉพาะ), \`name\` (ชื่อ), \`type\` (ประเภท), \`status\` (สถานะ), และ \`location\` (ตำแหน่งที่ตั้งเริ่มต้น)`;

    const loadingContent = `This module is crucial for tracking the physical location of assets.

> โมดูลนี้มีความสำคัญอย่างยิ่งสำหรับการติดตามตำแหน่งทางกายภาพของสินทรัพย์

- **Load In (การนำเข้า):** When an asset is physically moved to a project site, a "Load In" record is created. This action updates the asset's \`currentLocation\` field to the project's site location.

> > เมื่อสินทรัพย์ถูกย้ายไปยังหน้างานโครงการ จะมีการสร้างบันทึก "Load In" การกระทำนี้จะอัปเดตฟิลด์ \`currentLocation\` ของสินทรัพย์ให้เป็นที่ตั้งของหน้างานโครงการ

- **Load Out (การนำออก):** When an asset is returned from a site, a "Load Out" record is created. This action clears the \`currentLocation\` field, and its location effectively reverts to its default \`location\` or 'Depot'.

> > เมื่อสินทรัพย์ถูกส่งคืนจากหน้างาน จะมีการสร้างบันทึก "Load Out" การกระทำนี้จะล้างค่าในฟิลด์ \`currentLocation\` และตำแหน่งของมันจะกลับไปเป็นค่าเริ่มต้น (\`location\`) หรือ 'Depot'`;

    const explorerContent = `This is a powerful search tool to find information across Assets, Manpower, and Projects.

> นี่คือเครื่องมือค้นหาที่มีประสิทธิภาพเพื่อค้นหาข้อมูลจากทรัพยากรทั้งหมดในระบบ: สินทรัพย์, บุคลากร, และโครงการ

---

#### 🛠️ Asset Explorer Tab / แท็บสำรวจสินทรัพย์

**Purpose (วัตถุประสงค์):** To search for any asset and view its history.

> เพื่อค้นหาสินทรัพย์ใดๆ และดูประวัติของมัน

**How to Use (วิธีใช้งาน):**

1.  Enter an Asset No, Name, or Type.
2.  The system displays a table of matching assets.
3.  Click on any row to drill down into the **Asset Timeline** view.

**Asset Timeline View (มุมมองไทม์ไลน์สินทรัพย์):** This view shows the asset's current status, location, assigned project, and a full history trail.

> มุมมองนี้แสดงสถานะ, ตำแหน่ง, โครงการที่ได้รับมอบหมายล่าสุด และเส้นทางประวัติทั้งหมดของสินทรัพย์

---

#### 👷 Manpower History Tab / แท็บประวัติบุคลากร

**Purpose (วัตถุประสงค์):** To find an employee and view their work history.

> เพื่อค้นหาพนักงานและดูประวัติการทำงานของพวกเขา

**How to Use (วิธีใช้งาน):**

1.  Enter an employee's Name or Position.
2.  The system displays a table of matching employees.
3.  Click on a row to see that employee's **Work History**.

---

#### 🏗️ Project View Tab / แท็บมุมมองโครงการ

**Purpose (วัตถุประสงค์):** To get a quick snapshot of all resources assigned to a specific project.

> เพื่อดูภาพรวมอย่างรวดเร็วของทรัพยากรทั้งหมดที่ถูกมอบหมายให้กับโครงการใดโครงการหนึ่ง`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
            <BookOpen className="w-10 h-10 text-orange-500 flex-shrink-0" />
            <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100">User Guide</h1>
                <p className="mt-1 text-base text-gray-500 dark:text-gray-400">คู่มือการใช้งานระบบ</p>
            </div>
        </div>
        
        <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed prose-strong:font-semibold mb-8">
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{introContent}</ReactMarkdown>
        </div>

        <GuideSection title="1. Dashboard / แดชบอร์ด" icon={LayoutDashboard}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{dashboardContent}</ReactMarkdown>
        </GuideSection>

        <GuideSection title="2. Project Timeline / ไทม์ไลน์โครงการ" icon={GanttChartSquare}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{timelineContent}</ReactMarkdown>
        </GuideSection>
        
        <GuideSection title="3. Asset Management / การจัดการสินทรัพย์" icon={Package}>
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{assetMgmtContent}</ReactMarkdown>
        </GuideSection>

        <GuideSection title="4. Equipment Loading / การนำเข้า-ออกอุปกรณ์" icon={Truck}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{loadingContent}</ReactMarkdown>
        </GuideSection>

        <GuideSection title="5. Resource Explorer / เครื่องมือสำรวจทรัพยากร" icon={Search}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{explorerContent}</ReactMarkdown>
        </GuideSection>

      </div>
    </div>
  );
}
