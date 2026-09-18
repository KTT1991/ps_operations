import { useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  GanttChartSquare,
  Package,
  Truck,
  GraduationCap,
  Search,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  Wrench,
  Users,
  Activity,
  Award,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  {
    id: 'operations',
    title: 'Operations Control Center',
    category: 'Operations',
    icon: Activity,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    link: '/operations',
    description: 'Real-time operational command center tracking active offshore campaigns, mobilized crew deployments, allocated equipment, and urgent return schedules.',
    highlights: [
      {
        title: 'Active Project Status Cards',
        desc: 'Interactive campaign cards displaying active offshore progress, mobilization score, client details, and deployed tool counts.'
      },
      {
        title: 'Equipment Allocation Board',
        desc: 'Direct visibility into which equipment units are currently in use across offshore sites, with instant Load Out return actions.'
      },
      {
        title: 'Equipment Returning Soon',
        desc: 'Automated 14-day lookahead tracking assets scheduled to return to base, triggering timely demob and maintenance staging.'
      }
    ]
  },
  {
    id: 'maintenance',
    title: 'Maintenance & Work Orders',
    category: 'Logistics & Tech',
    icon: Wrench,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    link: '/maintenance',
    description: 'Digital job card system managing preventive maintenance, repairs, certification testing, calibration, and technician allocation.',
    highlights: [
      {
        title: 'Job Card Life Cycle',
        desc: 'Full status workflow from Scheduled, In Progress, to Completed or Pending Parts, with detailed pass/fail inspection results.'
      },
      {
        title: 'Certificates & Expiries',
        desc: 'Tracks certification test dates, proof load certificates, and next inspection milestones directly inside expandable work order rows.'
      },
      {
        title: 'Cost & KPI Overview',
        desc: 'Real-time month-to-date maintenance expenditure tracking (Cost MTD) and technician workload distribution.'
      }
    ]
  },
  {
    id: 'manpower',
    title: 'Manpower & Resource Planning',
    category: 'Crew & HR',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    link: '/manpower',
    description: 'Workforce availability tracker and crew allocation planner covering onshore, offshore, maintenance, and training statuses.',
    highlights: [
      {
        title: '7-State Availability Tracker',
        desc: 'One-click filtering by Available, Onshore, Offshore, Maintenance, Standby, On Leave, and Training with live headcount counts.'
      },
      {
        title: 'Critical Expiry Alerts',
        desc: 'Automatic warning badges on personnel cards whenever mandatory safety credentials have fewer than 30 days of validity remaining.'
      },
      {
        title: 'Bulk Status Updates & Gantt',
        desc: 'Select multiple crew members simultaneously to batch-update locations, assignments, or view employee schedule chronologies.'
      }
    ]
  },
  {
    id: 'training',
    title: 'Training & Compliance Matrix',
    category: 'Safety & Compliance',
    icon: GraduationCap,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    link: '/training',
    description: 'Workforce competency engine managing offshore certificates (BOSIET, H2S, Medical, First Aid) with full course names and safe Append Mode Excel sync.',
    highlights: [
      {
        title: 'Full Course Name Display',
        desc: 'Course codes serve purely as reference; the system prioritizes displaying the full official Course Title across all matrix views and passports.'
      },
      {
        title: 'Append-Only Excel Import',
        desc: 'Upload Training Records spreadsheets with zero data loss. Missing employees and position titles are automatically created and synchronized.'
      },
      {
        title: 'Employee Training Passport',
        desc: 'Print and export certified training passports for client offshore mobilization sign-offs and safety audits with one click.'
      }
    ]
  },
  {
    id: 'assets',
    title: 'Asset & Equipment Inventory',
    category: 'Logistics',
    icon: Package,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    link: '/assets',
    description: 'Centralized registry of all certified tools, machinery, and instrumentation with real-time status cards and maintenance tracking.',
    highlights: [
      {
        title: 'Status-Colored Asset Cards',
        desc: 'Visual indicators for Available, In Use, Under Maintenance, Reserved, Damaged, and Standby with instant category filtering.'
      },
      {
        title: 'Maintenance Due Tracking',
        desc: 'Automated countdown flags highlighting overdue calibrations, recertifications, and upcoming mechanical inspections.'
      },
      {
        title: 'Excel & PDF Export',
        desc: 'Generate audited inventory sheets, manifests, and equipment specification summaries ready for field logistics.'
      }
    ]
  },
  {
    id: 'projects',
    title: 'Projects & Timeline Gantt',
    category: 'Operations',
    icon: GanttChartSquare,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    link: '/projects',
    description: 'Visual project scheduling and chronological duration mapping with mobilization staging indicators.',
    highlights: [
      {
        title: 'Gantt Timeline Visualization',
        desc: 'Horizontal bar mapping displaying exact campaign durations, offshore execution dates, and demobilization windows.'
      },
      {
        title: 'Mobilization Phase Bars',
        desc: 'Dedicated pre-departure indicators representing staging and testing periods before full vessel deployment.'
      },
      {
        title: 'Status Classification',
        desc: 'Color-coded tags distinguishing Active, Mobilization, and Completed offshore campaigns.'
      }
    ]
  },
  {
    id: 'loading',
    title: 'Equipment Loading (Load In / Out)',
    category: 'Logistics',
    icon: Truck,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    link: '/operations',
    description: 'Chain of custody tracking system monitoring physical movement of tools between central depots and offshore sites.',
    highlights: [
      {
        title: 'Load In Movement',
        desc: 'Dispatches assets to designated project sites and automatically updates current location records to that offshore installation.'
      },
      {
        title: 'Load Out & Return',
        desc: 'Logs asset return to central base or warehouse upon job completion, triggering post-job maintenance inspections.'
      },
      {
        title: 'Manifest Management',
        desc: 'Generates exportable cargo manifests and packing sheets with verified quantities and item serials.'
      }
    ]
  },
  {
    id: 'reports',
    title: 'Resource Explorer & Search',
    category: 'Intelligence',
    icon: Search,
    color: 'text-teal-600 bg-teal-50 border-teal-200',
    link: '/reports',
    description: 'Cross-functional intelligence search linking assets, crew records, and project allocations.',
    highlights: [
      {
        title: 'Asset Timeline Explorer',
        desc: 'Look up any asset number to view complete chronological allocation logs and past project deployments.'
      },
      {
        title: 'Personnel Work History',
        desc: 'Inspect crew service records, past offshore campaigns, and current project assignments.'
      },
      {
        title: 'Project Resource Snapshot',
        desc: 'Instant consolidated view of all tooling, machinery, and certified crew allocated to any specific project.'
      }
    ]
  }
];

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = sections.filter(sec => {
    const matchesTab = activeTab === 'all' || sec.category.toLowerCase().includes(activeTab.toLowerCase());
    const matchesSearch =
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.highlights.some(h => h.title.toLowerCase().includes(searchQuery.toLowerCase()) || h.desc.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  System User Guide & SOP
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                  OpsCenter v2.5
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Standard operating procedures for offshore campaigns, manpower planning, maintenance job cards, and compliance.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-64 flex-shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guide topics..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:border-orange-500/80 transition-all shadow-2xs text-slate-700 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Filter Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Filter by category:</span>
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'operations', label: 'Operations' },
            { id: 'logistics', label: 'Logistics & Tech' },
            { id: 'crew', label: 'Crew & HR' },
            { id: 'safety', label: 'Safety & Training' },
            { id: 'intelligence', label: 'Reports' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Guide Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div
              key={sec.id}
              className="bg-white border border-slate-200/80 hover:border-slate-300/90 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Module Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-700 flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-slate-700" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {sec.category}
                      </span>
                      <h2 className="text-sm font-semibold text-slate-800 leading-snug">
                        {sec.title}
                      </h2>
                    </div>
                  </div>
                  <Link
                    to={sec.link}
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-orange-600 px-2.5 py-1 rounded-md hover:bg-slate-50 transition-colors flex-shrink-0 border border-transparent hover:border-slate-200"
                    title={`Open ${sec.title}`}
                  >
                    <span>Go to Page</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Link>
                </div>

                {/* Module Description */}
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  {sec.description}
                </p>

                {/* Feature Highlights List */}
                <div className="mt-4 space-y-2 bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                  {sec.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold text-slate-700 text-[11.5px]">{h.title}: </strong>
                        <span className="text-slate-500 text-[11.5px] leading-relaxed">{h.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Standard Operating Procedure
                </span>
                <Link
                  to={sec.link}
                  className="font-medium text-slate-600 hover:text-orange-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform"
                >
                  Open module
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Frequently Asked Questions / Key Procedures */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-100 pb-3">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <span>Key Operational Workflows & System Guidelines</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/70 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-slate-600" />
              <span>1. Course Name & Upload Policy</span>
            </div>
            <p className="text-slate-500 text-[11.5px] leading-relaxed">
              Course Codes exist solely as internal references. All compliance matrix tables and passports display <strong>Full Course Names</strong>. When uploading Excel files, use <strong>Append Mode</strong> so existing history remains untouched.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/70 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-slate-600" />
              <span>2. Maintenance & Returning Assets</span>
            </div>
            <p className="text-slate-500 text-[11.5px] leading-relaxed">
              Check the <strong>Equipment Returning Soon</strong> widget on Operations to stage upcoming demobilizations. Once tools return, record Load Out and generate a <strong>Job Card</strong> in Maintenance.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/70 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-600" />
              <span>3. Crew Scheduling & Offshore Readiness</span>
            </div>
            <p className="text-slate-500 text-[11.5px] leading-relaxed">
              Before mobilizing crew, verify that amber warning badges are resolved. Personnel with safety credentials expiring within 30 days must be scheduled for refresher courses prior to deployment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
