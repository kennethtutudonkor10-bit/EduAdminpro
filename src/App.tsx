/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  FileText, 
  Settings, 
  Bell, 
  HelpCircle, 
  X,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Info,
  Briefcase,
  CreditCard,
  Calendar,
  Bot,
  Code2,
  Sliders,
  Trash2,
  Palette
} from 'lucide-react';
import { Student, Score, ActivityLog, AssessmentColumn, StaffRecord, StaffEmploymentStatus, FinancialRecord, AttendanceRecord, PaymentMethod } from './types';
import { 
  initialStudents, 
  initialScores, 
  generateRemarks,
  classes,
  subjects as defaultSubjects,
  terms,
  initialActivityLogs,
  calculateStudentTotal,
  initialStaffRecords,
  initialFinancialLedger,
  initialAttendanceRecords
} from './data';

import DashboardView from './components/DashboardView';
import GradebookView from './components/GradebookView';
import StudentRegisterView from './components/StudentRegisterView';
import TerminalReportsView from './components/TerminalReportsView';
import SystemSettingsView from './components/SystemSettingsView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import StaffDirectoryView from './components/StaffDirectoryView';
import FeesTrackerView from './components/FeesTrackerView';
import AttendanceRegisterView from './components/AttendanceRegisterView';
import AIAgentConsoleView from './components/AIAgentConsoleView';
import EulaModal from './components/EulaModal';

import { billingService, StorePurchaseStatus } from './lib/billingService';
// Reliable write-through to the local DB: retries + an offline outbox so a
// transient failure can no longer silently drop an edit. localStorage stays the
// immediate cache. dbPost/dbDelete keep the same call signatures as before.
import { dbPost, dbDelete, startSync, onSyncStatus } from './lib/syncQueue';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  // First-launch EULA gate — blocks the entire UI until the user accepts
  const [termsAccepted, setTermsAccepted] = useState<boolean>(() => {
    return localStorage.getItem('edu_admin_terms_accepted') === 'true';
  });

  const handleAcceptTerms = () => {
    localStorage.setItem('edu_admin_terms_accepted', 'true');
    // Persist to DB so it survives localStorage clears
    dbPost('/api/db/settings', { key: 'terms_accepted', value: 'true' });
    setTermsAccepted(true);
  };

  // Premium subscription state machine
  const [isPremiumUser, setIsPremiumUser] = useState<boolean>(() => {
    const saved = localStorage.getItem('edu_admin_is_premium');
    return saved === 'true';
  });

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [localizedPrice, setLocalizedPrice] = useState<string | null>(null);
  
  // Refined Payment states
  const [paymentChannel, setPaymentChannel] = useState<'store' | 'momo'>('store');
  const [momoPhoneNumber, setMomoPhoneNumber] = useState('0244123456');
  const [momoProvider, setMomoProvider] = useState('MTN MoMo');
  
  // Coupon verification states
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  // Navigation active view state
  const [activeView, setActiveView] = useState<'dashboard' | 'register' | 'gradebook' | 'reports' | 'settings' | 'privacy' | 'staff' | 'fees' | 'attendance' | 'ai-agent'>('dashboard');

  // Load persistence states
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('edu_admin_students');
    return saved ? JSON.parse(saved) : initialStudents;
  });

  const [scores, setScores] = useState<Score[]>(() => {
    const saved = localStorage.getItem('edu_admin_scores');
    return saved ? JSON.parse(saved) : initialScores;
  });

  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>(() => {
    const saved = localStorage.getItem('edu_admin_staff_records');
    return saved ? JSON.parse(saved) : initialStaffRecords;
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('edu_admin_activity_logs');
    return saved ? JSON.parse(saved) : initialActivityLogs;
  });

  const [financialLedger, setFinancialLedger] = useState<FinancialRecord[]>(() => {
    const saved = localStorage.getItem('edu_admin_financial_ledger');
    return saved ? JSON.parse(saved) : initialFinancialLedger;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('edu_admin_attendance_records');
    return saved ? JSON.parse(saved) : initialAttendanceRecords;
  });

  // Custom Dynamic Customizers States
  const [subjectsState, setSubjectsState] = useState<string[]>(() => {
    const saved = localStorage.getItem('edu_admin_subjects');
    return saved ? JSON.parse(saved) : defaultSubjects;
  });

  const [assessmentColumns, setAssessmentColumns] = useState<AssessmentColumn[]>(() => {
    const saved = localStorage.getItem('edu_admin_assessment_columns');
    return saved ? JSON.parse(saved) : [
      { id: 'test1', name: 'Test 1', maxScore: 30 },
      { id: 'test2', name: 'Test 2', maxScore: 30 },
      { id: 'hw', name: 'HW', maxScore: 30 },
      { id: 'exam', name: 'Final Exam', maxScore: 100 }
    ];
  });

  const [caWeight, setCaWeight] = useState<number>(() => {
    const saved = localStorage.getItem('edu_admin_ca_weight');
    return saved ? parseInt(saved) : 30;
  });

  const [examWeight, setExamWeight] = useState<number>(() => {
    const saved = localStorage.getItem('edu_admin_exam_weight');
    return saved ? parseInt(saved) : 70;
  });

  const [isGradesLocked, setIsGradesLocked] = useState<boolean>(() => {
    const saved = localStorage.getItem('edu_admin_grades_locked');
    return saved ? saved === 'true' : false;
  });

  // Customizable institution and operator profile states
  const [schoolName, setSchoolName] = useState<string>(() => {
    return localStorage.getItem('edu_admin_school_name') || 'EDUADMIN PROGRESSIVE ACADEMY';
  });

  const [academicYear, setAcademicYear] = useState<string>(() => {
    return localStorage.getItem('edu_admin_academic_year') || '2025/2026 Academic Year';
  });

  const [registrarName, setRegistrarName] = useState<string>(() => {
    return localStorage.getItem('edu_admin_registrar_name') || 'District Registrar';
  });

  const [registrarKey, setRegistrarKey] = useState<string>(() => {
    return localStorage.getItem('edu_admin_registrar_key') || 'ADMIN_ID_9921';
  });

  const [regionalDivision, setRegionalDivision] = useState<string>(() => {
    return localStorage.getItem('edu_admin_regional_division') || 'District Registry, HQ Center Section • Ghana West Africa';
  });

  const [activeSubject, setActiveSubject] = useState('Core Mathematics');
  const [activeTerm, setActiveTerm] = useState('Term 1');
  const [activeClass, setActiveClass] = useState('Senior High 1A');

  const [adminAvatar, setAdminAvatar] = useState<string>(() => {
    return localStorage.getItem('edu_admin_avatar') || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDST01DQ1AGFU2H2AoSh-uZNwa1Ek7OlnF3K_x7M4wxwd8MumvDvQle20OdIY8NOmKloObEtwnqjhHRJgOy3Cf8T7wnLwZrhANPabMJUmioM0PqQUlZvIc2JE54kPB8nMSXAlirb5AgbI3lxPNjeUjlYJ6UjBEFkphNxz8D5fOL0rQavvQk4gXAYNRjkCo_1BSDUPSbnbjlrV_nl6RqgoNUyVQEc3qa_LaycQGP_qiavZlxWlA-LE26gwCy6dH3n7AajlWcVrvA2dV';
  });

  const [schoolLogo, setSchoolLogo] = useState<string>(() => {
    return localStorage.getItem('edu_admin_school_logo') || '';
  });

  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('edu_admin_gemini_key') || '';
  });

  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('edu_admin_webhook_url') || '';
  });

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('edu_admin_theme') || 'default';
  });

  // Time-machine and dynamic tier subjects configuration
  const [tierSubjects, setTierSubjects] = useState<Record<'pre-school' | 'primary' | 'senior-high', string[]>>(() => {
    const saved = localStorage.getItem('edu_admin_tier_subjects');
    return saved ? JSON.parse(saved) : {
      'pre-school': ["Numeracy", "Literacy", "Creative Arts", "Sensory Play", "Socio-Emotional Play"],
      'primary': ["Mathematics", "English Language", "Integrated Science", "Social Studies", "R.M.E", "I.C.T."],
      'senior-high': ["Core Mathematics", "Elective Physics", "Elective Chemistry", "Elective Biology", "Social Studies", "English Language"]
    };
  });

  const [isCustomizeSubjectsOpen, setIsCustomizeSubjectsOpen] = useState(false);
  const [selectedCustomizerTier, setSelectedCustomizerTier] = useState<'pre-school' | 'primary' | 'senior-high'>('senior-high');
  const [newCustomSubjectName, setNewCustomSubjectName] = useState('');

  // Helper function to resolve class tiers
  const getTierForClass = (classId: string): 'pre-school' | 'primary' | 'senior-high' => {
    const norm = classId.toLowerCase();
    if (norm.includes('kindergarten') || norm.includes('preschool') || norm.includes('pre-school') || norm.includes('kg')) {
      return 'pre-school';
    }
    if (norm.includes('senior') || norm.includes('shs') || norm.includes('sh') || norm.includes('grade 11') || norm.includes('grade 12')) {
      return 'senior-high';
    }
    return 'primary';
  };

  // Time Machine and Snapshots archival state engine
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(() => {
    return localStorage.getItem('edu_admin_selected_academic_year') || '2025-2026';
  });

  const [snapshots, setSnapshots] = useState<Record<string, {
    sessionKey: string;
    academicYear: string;
    term: string;
    timestamp: string;
    students: Student[];
    subjects: string[];
    assessmentColumns: AssessmentColumn[];
    scores: Score[];
    caWeight: number;
    examWeight: number;
  }>>(() => {
    const saved = localStorage.getItem('edu_admin_snapshots');
    return saved ? JSON.parse(saved) : {};
  });

  // Navigate to student direct reports card states
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string>('');
  const [selectedReportTerm, setSelectedReportTerm] = useState<string>('Term 1');

  // Interactive Toast states list
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Trigger Toast function
  const triggerToast = (message: string, type: 'success' | 'info' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Sync to local storage when state updates
  useEffect(() => {
    localStorage.setItem('edu_admin_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('edu_admin_scores', JSON.stringify(scores));
  }, [scores]);

  useEffect(() => {
    localStorage.setItem('edu_admin_ca_weight', caWeight.toString());
  }, [caWeight]);

  useEffect(() => {
    localStorage.setItem('edu_admin_exam_weight', examWeight.toString());
  }, [examWeight]);

  useEffect(() => {
    localStorage.setItem('edu_admin_grades_locked', isGradesLocked.toString());
  }, [isGradesLocked]);

  useEffect(() => {
    localStorage.setItem('edu_admin_school_name', schoolName);
    dbPost('/api/db/settings', { key: 'school_name', value: schoolName });
  }, [schoolName]);

  useEffect(() => {
    localStorage.setItem('edu_admin_academic_year', academicYear);
  }, [academicYear]);

  useEffect(() => {
    localStorage.setItem('edu_admin_registrar_name', registrarName);
    dbPost('/api/db/settings', { key: 'registrar_name', value: registrarName });
  }, [registrarName]);

  useEffect(() => {
    localStorage.setItem('edu_admin_registrar_key', registrarKey);
    dbPost('/api/db/settings', { key: 'registrar_key', value: registrarKey });
  }, [registrarKey]);

  useEffect(() => {
    localStorage.setItem('edu_admin_regional_division', regionalDivision);
    dbPost('/api/db/settings', { key: 'regional_division', value: regionalDivision });
  }, [regionalDivision]);

  useEffect(() => {
    localStorage.setItem('edu_admin_activity_logs', JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    localStorage.setItem('edu_admin_is_premium', isPremiumUser.toString());
  }, [isPremiumUser]);

  useEffect(() => {
    localStorage.setItem('edu_admin_subjects', JSON.stringify(subjectsState));
  }, [subjectsState]);

  useEffect(() => {
    localStorage.setItem('edu_admin_tier_subjects', JSON.stringify(tierSubjects));
  }, [tierSubjects]);

  useEffect(() => {
    localStorage.setItem('edu_admin_avatar', adminAvatar);
  }, [adminAvatar]);

  useEffect(() => {
    localStorage.setItem('edu_admin_school_logo', schoolLogo);
    if (schoolLogo) dbPost('/api/db/settings', { key: 'school_logo', value: schoolLogo });
  }, [schoolLogo]);

  useEffect(() => {
    localStorage.setItem('edu_admin_gemini_key', geminiApiKey);
    dbPost('/api/db/settings', { key: 'gemini_api_key', value: geminiApiKey });
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('edu_admin_webhook_url', webhookUrl);
    dbPost('/api/db/settings', { key: 'webhook_url', value: webhookUrl });
  }, [webhookUrl]);

  useEffect(() => {
    localStorage.setItem('edu_admin_theme', currentTheme);
    const themeClasses = ['theme-default', 'theme-yellow', 'theme-red', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange'];
    themeClasses.forEach(cls => document.body.classList.remove(cls));
    document.body.classList.add(`theme-${currentTheme}`);
  }, [currentTheme]);

  useEffect(() => {
    localStorage.setItem('edu_admin_assessment_columns', JSON.stringify(assessmentColumns));
  }, [assessmentColumns]);

  useEffect(() => {
    localStorage.setItem('edu_admin_staff_records', JSON.stringify(staffRecords));
  }, [staffRecords]);

  useEffect(() => {
    localStorage.setItem('edu_admin_financial_ledger', JSON.stringify(financialLedger));
  }, [financialLedger]);

  useEffect(() => {
    localStorage.setItem('edu_admin_attendance_records', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  // ── Background DB sync: retry queued writes, surface only on state change ────
  useEffect(() => {
    const stop = startSync();
    let prevPending = 0;
    const off = onSyncStatus((pending) => {
      if (pending > 0 && prevPending === 0) {
        triggerToast('Saved locally — syncing to the database when reachable…', 'info');
      } else if (pending === 0 && prevPending > 0) {
        triggerToast('All changes synced to the database.', 'success');
      }
      prevPending = pending;
    });
    return () => { stop(); off(); };
  }, []);

  // ── DB startup: load persisted data, seed if empty ──────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, scRes, fRes] = await Promise.all([
          fetch('/api/db/students'),
          fetch('/api/db/scores'),
          fetch('/api/db/financial'),
        ]);
        if (!sRes.ok) return;
        const [dbStudents, dbScores, dbFinancial] = await Promise.all([
          sRes.json(), scRes.json(), fRes.json(),
        ]);
        if (dbStudents.length > 0) {
          setStudents(dbStudents);
          if (dbScores.length > 0) setScores(dbScores);
          if (dbFinancial.length > 0) setFinancialLedger(dbFinancial);
        } else {
          // DB is empty on first launch — seed it from current localStorage state
          const snap = {
            students: JSON.parse(localStorage.getItem('edu_admin_students') || '[]'),
            scores: JSON.parse(localStorage.getItem('edu_admin_scores') || '[]'),
            financialRecords: JSON.parse(localStorage.getItem('edu_admin_financial_ledger') || '[]'),
          };
          dbPost('/api/db/seed', snap);
        }
        // Load saved settings from DB
        const settingsRes = await fetch('/api/db/settings');
        if (settingsRes.ok) {
          const savedSettings: Record<string, string> = await settingsRes.json();
          if (savedSettings.school_logo) setSchoolLogo(savedSettings.school_logo);
          if (savedSettings.school_name) setSchoolName(savedSettings.school_name);
          if (savedSettings.registrar_name) setRegistrarName(savedSettings.registrar_name);
          if (savedSettings.registrar_key) setRegistrarKey(savedSettings.registrar_key);
          if (savedSettings.regional_division) setRegionalDivision(savedSettings.regional_division);
          if (savedSettings.gemini_api_key) setGeminiApiKey(savedSettings.gemini_api_key);
          if (savedSettings.webhook_url) setWebhookUrl(savedSettings.webhook_url);
          if (savedSettings.terms_accepted === 'true') {
            localStorage.setItem('edu_admin_terms_accepted', 'true');
            setTermsAccepted(true);
          }
        }

        // Load staff and attendance from DB
        const [staffRes, attendanceRes] = await Promise.all([
          fetch('/api/db/staff'),
          fetch('/api/db/attendance'),
        ]);
        if (staffRes.ok) {
          const dbStaff = await staffRes.json();
          if (dbStaff.length > 0) setStaffRecords(dbStaff);
        }
        if (attendanceRes.ok) {
          const dbAttendance = await attendanceRes.json();
          if (dbAttendance.length > 0) setAttendanceRecords(dbAttendance);
        }
      } catch {
        // Server not reachable — localStorage fallback already active
      }
    };
    load();
  }, []);

  const handleAddStaff = (newStaff: StaffRecord) => {
    setStaffRecords(prev => [newStaff, ...prev]);
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Workforce updated: Registered staff member ${newStaff.fullName} (${newStaff.staffId})`,
      category: 'setting',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
    dbPost('/api/db/staff', newStaff);
  };

  const handleDeleteStaff = (staffId: string) => {
    setStaffRecords(prev => prev.filter(s => s.staffId !== staffId));
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Workforce updated: Removed staff record ID: ${staffId}`,
      category: 'setting',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
    dbDelete(`/api/db/staff/${staffId}`);
  };

  const handleUpdateStaffStatus = (staffId: string, status: StaffEmploymentStatus) => {
    setStaffRecords(prev => {
      const updated = prev.map(s => s.staffId === staffId ? { ...s, employmentStatus: status } : s);
      const record = updated.find(s => s.staffId === staffId);
      if (record) dbPost('/api/db/staff', record);
      return updated;
    });
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Workforce updated: Staff ID: ${staffId} status set to ${status}`,
      category: 'setting',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const handleRecordPayment = (studentId: string, amount: number, method: PaymentMethod, momoPhone?: string, momoProvider?: string) => {
    const studentObj = students.find(s => s.id === studentId);
    const studentName = studentObj ? studentObj.name : 'Unknown Student';
    const classId = studentObj ? studentObj.classId : 'Unassigned';

    const existingRecord = financialLedger.find(
      f => f.studentId === studentId && f.termId === activeTerm && f.academicYear === selectedAcademicYear
    );

    let syncRecord: FinancialRecord;

    if (existingRecord) {
      const newPaid = existingRecord.paidAmount + amount;
      syncRecord = {
        ...existingRecord,
        paidAmount: newPaid,
        paymentMethod: method,
        balance: Math.max(0, existingRecord.billAmount - newPaid),
        lastUpdated: new Date().toISOString(),
      };
      setFinancialLedger(prev =>
        prev.map(f => f.id === syncRecord.id ? syncRecord : f)
      );
    } else {
      const standardBill = classId.includes('Junior') ? 1200 : 1800;
      syncRecord = {
        id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        studentId,
        studentName,
        classId,
        academicYear: selectedAcademicYear,
        termId: activeTerm,
        billAmount: standardBill,
        paidAmount: amount,
        paymentMethod: method,
        balance: Math.max(0, standardBill - amount),
        lastUpdated: new Date().toISOString(),
      };
      setFinancialLedger(prev => [syncRecord, ...prev]);
    }

    dbPost('/api/db/financial', syncRecord);

    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Financial transaction processed: GH₵ ${amount} received via ${method} for ${studentName}`,
      category: 'other',
      timestamp: new Date().toISOString(),
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const handleUpdateBulkInvoice = (classId: string, amount: number) => {
    const classEnrolled = students.filter(s => s.classId === classId && s.status === 'Enrolled');
    const syncBatch: FinancialRecord[] = [];

    setFinancialLedger(prev => {
      let updatedList = [...prev];

      classEnrolled.forEach(student => {
        const index = updatedList.findIndex(
          f => f.studentId === student.id &&
               f.termId === activeTerm &&
               f.academicYear === selectedAcademicYear
        );

        if (index >= 0) {
          const record = updatedList[index];
          const updated = {
            ...record,
            billAmount: amount,
            balance: Math.max(0, amount - record.paidAmount),
            lastUpdated: new Date().toISOString(),
          };
          updatedList[index] = updated;
          syncBatch.push(updated);
        } else {
          const newRecord: FinancialRecord = {
            id: `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            studentId: student.id,
            studentName: student.name,
            classId: student.classId,
            academicYear: selectedAcademicYear,
            termId: activeTerm,
            billAmount: amount,
            paidAmount: 0,
            paymentMethod: 'Cash',
            balance: amount,
            lastUpdated: new Date().toISOString(),
          };
          updatedList.push(newRecord);
          syncBatch.push(newRecord);
        }
      });

      return updatedList;
    });

    syncBatch.forEach(record => dbPost('/api/db/financial', record));

    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Invoicing update: Billed GH₵ ${amount} reference standard to entire class cohort: ${classId}`,
      category: 'other',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const handleSaveAttendance = (date: string, classId: string, attendanceMap: Record<string, 'Present' | 'Absent'>) => {
    setAttendanceRecords(prev => {
      const index = prev.findIndex(
        r => r.date === date && r.classId === classId && r.termId === activeTerm
      );
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = { ...updated[index], attendance: attendanceMap };
        return updated;
      } else {
        return [{ date, termId: activeTerm, classId, attendance: attendanceMap }, ...prev];
      }
    });
    dbPost('/api/db/attendance', { date, termId: activeTerm, classId, attendance: attendanceMap });

    const presentCount = Object.values(attendanceMap).filter(v => v === 'Present').length;
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Attendance registry commit: Marked daily roll for ${classId} on ${date}. Present: ${presentCount}`,
      category: 'other',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  // Selector calculations & snapshot managers
  const isSelectedSessionReadOnly = () => {
    const liveYear = '2025-2026';
    const liveTerm = 'Term 2';
    
    const getYearWeight = (yr: string) => {
      if (yr.includes('2024-2025')) return 2024;
      if (yr.includes('2025-2026')) return 2025;
      if (yr.includes('2026-2027')) return 2026;
      return 2025;
    };
    
    const getTermWeight = (t: string) => {
      if (t.includes('1')) return 1;
      if (t.includes('2')) return 2;
      if (t.includes('3')) return 3;
      return 1;
    };
    
    const selectedWeight = getYearWeight(selectedAcademicYear) * 10 + getTermWeight(activeTerm);
    const liveWeight = getYearWeight(liveYear) * 10 + getTermWeight(liveTerm);
    
    return selectedWeight < liveWeight;
  };

  const handleSessionChange = (year: string, term: string) => {
    setSelectedAcademicYear(year);
    localStorage.setItem('edu_admin_selected_academic_year', year);
    setActiveTerm(term);
    setSelectedReportTerm(term);

    // Sync title display dynamically for standard headers
    setAcademicYear(`${year} Session ${term}`);

    const key = `Session_${year}_${term}`;
    const snap = snapshots[key];
    if (snap) {
      setStudents(snap.students);
      setSubjectsState(snap.subjects);
      setAssessmentColumns(snap.assessmentColumns);
      setScores(snap.scores);
      if (snap.caWeight !== undefined) setCaWeight(snap.caWeight);
      if (snap.examWeight !== undefined) setExamWeight(snap.examWeight);
      
      const newLog: ActivityLog = {
        id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action: `Switched global session: Loaded historical snapshot for ${year} ${term}`,
        category: 'setting',
        timestamp: new Date().toISOString()
      };
      setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
      triggerToast(`📁 Loaded historical snapshot for ${year} ${term}!`, 'success');
    } else {
      setStudents(initialStudents);
      setSubjectsState(defaultSubjects);
      setAssessmentColumns([
        { id: 'test1', name: 'Test 1', maxScore: 30 },
        { id: 'test2', name: 'Test 2', maxScore: 30 },
        { id: 'hw', name: 'HW', maxScore: 30 },
        { id: 'exam', name: 'Final Exam', maxScore: 100 }
      ]);
      const matchedScores = initialScores.filter(s => s.termId === term);
      setScores(matchedScores.length > 0 ? matchedScores : initialScores);
      
      const newLog: ActivityLog = {
        id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action: `Switched global session: Swapped session workspace to ${year} ${term}`,
        category: 'setting',
        timestamp: new Date().toISOString()
      };
      setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
      triggerToast(`ℹ️ No snapshot found for ${year} ${term}. Displaying initialized template.`, 'info');
    }
  };

  const handleSaveSnapshot = () => {
    const sessionKey = `Session_${selectedAcademicYear}_${activeTerm}`;
    const timestampStr = new Date().toISOString();
    
    const newSnapshot = {
      sessionKey,
      academicYear: selectedAcademicYear,
      term: activeTerm,
      timestamp: timestampStr,
      students: students,
      subjects: subjectsState,
      assessmentColumns: assessmentColumns,
      scores: scores,
      caWeight: caWeight,
      examWeight: examWeight
    };
    
    const updated = {
      ...snapshots,
      [sessionKey]: newSnapshot
    };
    
    setSnapshots(updated);
    localStorage.setItem('edu_admin_snapshots', JSON.stringify(updated));
    
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: `Saved snapshot: Archival record created for ${selectedAcademicYear} ${activeTerm}`,
      category: 'setting',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
    
    triggerToast(`💾 Snapshot successfully saved for ${selectedAcademicYear} ${activeTerm}!`, 'success');
  };

  const handleRestoreSnapshot = (sessionKey: string) => {
    const snap = snapshots[sessionKey];
    if (snap) {
      setSelectedAcademicYear(snap.academicYear);
      localStorage.setItem('edu_admin_selected_academic_year', snap.academicYear);
      setActiveTerm(snap.term);
      setSelectedReportTerm(snap.term);
      setStudents(snap.students);
      setSubjectsState(snap.subjects);
      setAssessmentColumns(snap.assessmentColumns);
      setScores(snap.scores);
      if (snap.caWeight !== undefined) setCaWeight(snap.caWeight);
      if (snap.examWeight !== undefined) setExamWeight(snap.examWeight);
      
      const newLog: ActivityLog = {
        id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action: `Restored snapshot: Loaded archival snapshot for ${snap.academicYear} ${snap.term}`,
        category: 'setting',
        timestamp: new Date().toISOString()
      };
      setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
      
      triggerToast(`📁 Recovered archived database snapshots for ${snap.academicYear} ${snap.term}!`, 'success');
    } else {
      triggerToast(`❌ Error: Snapshot path not found.`, 'error');
    }
  };

  const handleDeleteSnapshot = (sessionKey: string) => {
    const updated = { ...snapshots };
    delete updated[sessionKey];
    setSnapshots(updated);
    localStorage.setItem('edu_admin_snapshots', JSON.stringify(updated));
    triggerToast(`Pruned snapshot ${sessionKey} from archival directories.`, 'info');
  };

  // Unified secure function to permanently unlock premium features across both channels
  const unlockAllApplicationFeatures = (customMessage?: string, customActivity?: string) => {
    setIsPremiumUser(true);
    localStorage.setItem('edu_admin_is_premium', 'true');
    setIsUpgradeModalOpen(false);
    setIsBillingLoading(false);
    
    // Log activity secure payload
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: customActivity || 'Premium status activated: unlocked professional reporting coordinates (premium_upgrade_pro)',
      category: 'setting',
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
    triggerToast(customMessage || "License unlocked successfully! Welcome to EduAdmin Pro Tier.", "success");
  };

  // Dual-Tier coupon/developer code verification handler
  const handleVerifyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }
    
    const developerMasterCode = "KEN-DEV-PRO-2026";
    const promoCodes = ["PROMO-WINNER-FREE", "GH-SCHOOLS-2026", "AI-CLASSLEDGER"];
    
    if (code === developerMasterCode) {
      setCouponError(null);
      setCouponCode('');
      unlockAllApplicationFeatures(
        "🔑 Developer Master Access Verified. System fully unlocked for all use.",
        "Developer coupon code bypass matching 'KEN-DEV-PRO-2026' succeeded"
      );
    } else if (promoCodes.includes(code)) {
      setCouponError(null);
      setCouponCode('');
      unlockAllApplicationFeatures(
        "🎉 Congratulations! Your promotional winner coupon has been successfully applied. All premium features are unlocked for full use!",
        "Promotional coupon code match succeeded"
      );
    } else {
      setCouponError("❌ Invalid or expired code. Please verify your entry and try again.");
      triggerToast("❌ Invalid or expired code. Please verify your entry and try again.", "error");
    }
  };

  // Transaction Event Handlers listening for Play and Windows catalog signals
  useEffect(() => {
    const unsubscribe = billingService.registerTransactionListener((event) => {
      if (event.status === 'SUCCESS') {
        unlockAllApplicationFeatures();
      } else if (event.status === 'FAILURE') {
        setIsBillingLoading(false);
        triggerToast(event.error || "Billing flow declined or disconnected by user.", "error");
      }
    });

    const loadPriceDetails = async () => {
      try {
        const details = await billingService.queryProductDetails("premium_upgrade_pro");
        if (details.oneTimePurchaseOfferDetails) {
          setLocalizedPrice(details.oneTimePurchaseOfferDetails.formattedPrice);
        }
      } catch (err) {
        console.error("Store dynamic query failed: ", err);
      }
    };

    loadPriceDetails();

    return () => {
      unsubscribe();
    };
  }, []);

  // Logging activities function
  const logActivity = (action: string, category: 'grade' | 'student' | 'remark' | 'setting' | 'other' = 'other') => {
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      category,
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  // Score callbacks
  const handleUpdateScore = (updatedScore: Score) => {
    const student = students.find(s => s.id === updatedScore.studentId);
    const name = student ? student.name : updatedScore.studentId;
    logActivity(`Grade committed: ${updatedScore.subjectId} score adjusted for ${name} (${updatedScore.termId})`, 'grade');

    setScores(prev => {
      const idx = prev.findIndex(
        s => s.studentId === updatedScore.studentId &&
             s.subjectId === updatedScore.subjectId &&
             s.termId === updatedScore.termId
      );
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = updatedScore;
        return copy;
      } else {
        return [...prev, updatedScore];
      }
    });
    dbPost('/api/db/scores', updatedScore);
  };

  // Register callbacks
  const handleAddStudent = (createdStudent: Student) => {
    setStudents(prev => [...prev, createdStudent]);
    logActivity(`Student added: ${createdStudent.name} registered in ${createdStudent.classId}`, 'student');
    dbPost('/api/save-student', createdStudent);
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    logActivity(`Student updated: ${updatedStudent.name}'s registry details revised`, 'student');
    dbPost('/api/save-student', updatedStudent);
  };

  const handleDeleteStudent = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const name = student ? student.name : studentId;
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setScores(prev => prev.filter(s => s.studentId !== studentId));
    logActivity(`Student removed: ID ${studentId} (${name}) deleted from database`, 'student');
    dbDelete(`/api/db/students/${studentId}`);
  };

  // Bulk actions triggers: fill empty comments dynamically matching the user's score metrics
  const handleBatchFillRemarks = (subject: string, term: string, classId: string) => {
    if (isGradesLocked) {
      triggerToast("Academic records locked. Cannot run batch remarks calculations.", "error");
      return;
    }

    const activeCohort = students.filter(s => s.classId === classId && s.status === 'Enrolled');
    let updatedCount = 0;
    const syncBatch: Score[] = [];

    const newScores = scores.map(scoreItem => {
      const isMatchedCohort = activeCohort.some(student => student.id === scoreItem.studentId);
      if (isMatchedCohort && scoreItem.subjectId === subject && scoreItem.termId === term) {
        const total = calculateStudentTotal(scoreItem, assessmentColumns);
        const calculatedGrade = total >= 80 ? 'A' :
                                total >= 75 ? 'A-' :
                                total >= 70 ? 'B+' :
                                total >= 65 ? 'B' :
                                total >= 60 ? 'C+' :
                                total >= 55 ? 'C' :
                                total >= 50 ? 'C-' :
                                total >= 40 ? 'D' : 'F';
        updatedCount++;
        const updated = { ...scoreItem, remark: generateRemarks(calculatedGrade) };
        syncBatch.push(updated);
        return updated;
      }
      return scoreItem;
    });

    setScores(newScores);

    if (syncBatch.length > 0) {
      dbPost('/api/db/scores/batch', { scores: syncBatch });
    }

    logActivity(`Batch remarks generated: Automatically evaluated comments for ${subject} (${term})`, 'remark');
    triggerToast(`Batch calculations complete! Generated feedback commentary for ${updatedCount} cohort students.`, "success");
  };

  const handleToggleGradesLock = () => {
    setIsGradesLocked(!isGradesLocked);
    logActivity(`Grade records ${isGradesLocked ? 'unlocked' : 'locked'} under authorized registrar protocols`, 'other');
    triggerToast(
      isGradesLocked 
        ? "Unlocked! Cohort records are now open to local administrative edits." 
        : "Locked! Assessment records bound and sealed to prevent accidental writeovers.",
      isGradesLocked ? 'info' : 'success'
    );
  };

  return (
    <div className="flex theme-app-bg bg-[#f8f9ff] text-[#0b1c30] font-sans h-screen w-screen overflow-hidden antialiased">
      {!termsAccepted && <EulaModal onAccept={handleAcceptTerms} />}
      
      {/* Side Navigation Bar Sidebar */}
      <aside className="hidden md:flex flex-col h-screen w-60 shrink-0 theme-bg-sidebar border-r border-[#c3c6d7]/30 z-30 select-none">
        
        {/* Brand Header */}
        <div className="p-4 h-14 flex items-center mb-4 border-b border-[#38485a]/25 shrink-0">
          <label 
            className="font-extrabold text-[20px] tracking-tight text-white flex items-center gap-2 cursor-pointer select-none group relative w-full"
            title="Click to upload custom school logo"
          >
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64String = reader.result as string;
                    setSchoolLogo(base64String);
                    triggerToast("School brand logo updated successfully!", "success");
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            {schoolLogo ? (
              <img 
                src={schoolLogo} 
                alt="School Logo" 
                className="w-7 h-7 object-cover rounded-md border border-white/20 group-hover:opacity-85 transition-opacity" 
              />
            ) : (
              <span className="theme-bg-accent text-white p-1 rounded-md text-[10px] font-black w-7 h-7 flex items-center justify-center uppercase shrink-0">
                DR
              </span>
            )}
            <span className="group-hover:text-blue-300 transition-colors">EduAdmin Pro</span>
          </label>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <button 
            onClick={() => setActiveView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'dashboard'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveView('gradebook')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'gradebook'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Grading Grid</span>
          </button>
          <button 
            onClick={() => setActiveView('fees')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'fees'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Fees Tracker</span>
          </button>
          <button 
            onClick={() => setActiveView('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'attendance'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Attendance Register</span>
          </button>
          <button 
            onClick={() => setActiveView('staff')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'staff'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Staff Directory</span>
          </button>
          <button 
            onClick={() => setActiveView('register')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'register'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Register</span>
          </button>
          <button 
            onClick={() => setActiveView('reports')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'reports'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Print Hub</span>
          </button>
          <button 
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'settings'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Custom Settings</span>
          </button>
          <button 
            onClick={() => setActiveView('ai-agent')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeView === 'ai-agent'
                ? 'theme-bg-accent text-white shadow-md'
                : 'theme-sidebar-link'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>AI Agent Console</span>
          </button>
        </nav>

        {/* Bottom utility */}
        <div className="p-4 border-t border-[#38485a]/25 space-y-3">
          <button 
            onClick={() => setActiveView('privacy')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
              activeView === 'privacy' ? 'theme-bg-accent/20 text-white shadow-xs' : 'theme-sidebar-link'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>System safety norms active</span>
          </button>
          
          <a 
            href="mailto:kennethdonkortutu@gmail.com" 
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs theme-sidebar-link transition-all group"
          >
            <Code2 className="w-4 h-4 theme-text-accent group-hover:scale-110 transition-transform shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[10.5px] leading-tight text-white">Developer Support</span>
              <span className="text-[9.5px] theme-sidebar-text group-hover:text-white transition-colors truncate">kennethdonkortutu@gmail.com</span>
            </div>
          </a>

          <div className="text-[10px] theme-sidebar-text font-semibold px-2">
            Local Time &bull; Active Session
          </div>
        </div>
      </aside>

      {/* Main app viewport container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Header toolbar */}
        <header className="h-14 theme-card-bg bg-white border-b theme-border border-[#c3c6d7]/35 px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-on-background capitalize">
              {activeView === 'dashboard' && 'Executive summaries Dashboard'}
              {activeView === 'register' && 'Active Student Registry List'}
              {activeView === 'staff' && 'Institutional Workforce Directory'}
              {activeView === 'gradebook' && 'Master Scores Spreadsheet Grid'}
              {activeView === 'reports' && 'Printable terminal performance reports'}
              {activeView === 'fees' && 'Smart Fees Ledger & Invoicing'}
              {activeView === 'attendance' && 'Student Daily Attendance log'}
              {activeView === 'settings' && 'Systems Configurations panel'}
              {activeView === 'privacy' && 'Regulatory safety compliance provisions'}
              {activeView === 'ai-agent' && 'Autonomous AI Agent Database Console'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            
            {/* Small screens navigation links toolbar */}
            <div className="flex md:hidden items-center gap-1 bg-[#f8f9ff] border border-outline-variant/65 rounded-md p-0.5">
              <button 
                onClick={() => setActiveView('dashboard')}
                title="Dashboard" 
                className={`p-1.5 rounded ${activeView === 'dashboard' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('register')}
                title="Student Register" 
                className={`p-1.5 rounded ${activeView === 'register' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <Users className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('staff')}
                title="Staff Directory" 
                className={`p-1.5 rounded ${activeView === 'staff' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <Briefcase className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('gradebook')}
                title="Gradebook" 
                className={`p-1.5 rounded ${activeView === 'gradebook' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('reports')}
                title="Terminal Reports" 
                className={`p-1.5 rounded ${activeView === 'reports' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <FileText className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('settings')}
                title="Settings" 
                className={`p-1.5 rounded ${activeView === 'settings' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('ai-agent')}
                title="AI Agent Console" 
                className={`p-1.5 rounded ${activeView === 'ai-agent' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <Bot className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveView('privacy')}
                title="Privacy Policy" 
                className={`p-1.5 rounded ${activeView === 'privacy' ? 'bg-[#2563eb] text-white' : 'text-slate-600'}`}
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            </div>

            {/* Notification icons notifications */}
            <button className="p-2 hover:bg-slate-100 transition-colors rounded-full text-slate-500 relative cursor-pointer group">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border border-white"></span>
            </button>
            
            {/* Help guidelines link */}
            <button 
              onClick={() => triggerToast("Launching Academic Database guide, please refer to the support portal.", "info")}
              className="p-2 hover:bg-slate-100 transition-colors rounded-full text-slate-500 cursor-pointer hidden sm:inline-block"
            >
              <HelpCircle className="w-4.5 h-4.5" />
            </button>

            {/* Theme Selector Widget */}
            <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4 select-none mr-1.5">
              <Palette className="w-4 h-4 text-slate-500 theme-text-accent" />
              <select 
                value={currentTheme} 
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrentTheme(val);
                  
                  const themeLabels: Record<string, string> = {
                    default: 'Default (Premium Slate)',
                    yellow: 'Sunshine Yellow',
                    red: 'Crimson Red',
                    blue: 'Sky Blue',
                    green: 'Forest Green',
                    purple: 'Purple',
                    orange: 'Sunset Orange'
                  };
                  const label = themeLabels[val] || val;
                  triggerToast(`System Theme: Swapped workspace skin to ${label}`, "success");
                  
                  // Dispatch global event for terminal logs
                  window.dispatchEvent(new CustomEvent('edu_admin_theme_changed', { detail: { themeName: label } }));
                }}
                className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 theme-border-accent"
              >
                <option value="default">Default Premium</option>
                <option value="yellow">Sunshine Yellow</option>
                <option value="red">Ruby Red</option>
                <option value="blue">Ocean Sky Blue</option>
                <option value="green">Forest Green</option>
                <option value="purple">Royal Purple</option>
                <option value="orange">Sunset Orange</option>
              </select>
            </div>

            {/* User Avatar */}
            <label 
              className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 select-none cursor-pointer hover:border-primary transition-all shrink-0 relative block group"
              title="Click to upload custom profile avatar"
            >
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64String = reader.result as string;
                      setAdminAvatar(base64String);
                      triggerToast("Admin profile avatar updated successfully!", "success");
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <img 
                alt="Administrator Avatar" 
                className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" 
                referrerPolicy="no-referrer"
                src={adminAvatar}
              />
            </label>
          </div>
        </header>

        {/* Global Academic Session Time-Machine Filter Widget */}
        <div className="theme-bg-accent-light bg-[#eff6ff] border-b theme-border border-[#bfdbfe]/65 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none" id="time-machine-global-header">
          <div className="flex items-center gap-2">
            <span className="theme-bg-accent theme-text-accent-contrast bg-[#2563eb] text-white px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-wider animate-pulse">
              Time Machine
            </span>
            <span className="text-xs font-bold theme-text-accent text-[#1e40af]">
              Global Session Context:
            </span>
            <div className="text-[10px] theme-bg-accent-light theme-text-accent bg-sky-100 text-[#0369a1] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 font-mono">
              <span>ACTIVE: 2025-2026 Term 2</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Academic Year Selector */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Academic Year:</span>
              <select
                value={selectedAcademicYear}
                onChange={(e) => handleSessionChange(e.target.value, activeTerm)}
                className="text-xs font-bold border border-[#bcd5f5] bg-white rounded px-2.5 py-1 text-slate-800 pr-7 focus:outline-hidden focus:ring-1 focus:ring-[#2563eb] h-7 cursor-pointer"
                id="session-academic-year-select"
              >
                {["2024-2025", "2025-2026", "2026-2027"].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Term Selector */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Term:</span>
              <select
                value={activeTerm}
                onChange={(e) => handleSessionChange(selectedAcademicYear, e.target.value)}
                className="text-xs font-bold border border-[#bcd5f5] bg-white rounded px-2.5 py-1 text-slate-800 pr-7 focus:outline-hidden focus:ring-1 focus:ring-[#2563eb] h-7 cursor-pointer"
                id="session-term-select"
              >
                {["Term 1", "Term 2", "Term 3"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Status Protective Seal badge */}
            {isSelectedSessionReadOnly() ? (
              <span className="text-[9.5px] bg-[#fef3c7] text-[#92400e] font-black px-2 py-1 rounded-sm border border-[#fde68a] uppercase tracking-wide flex items-center gap-1">
                <span>🔒 READ-ONLY HISTORICAL</span>
              </span>
            ) : (
              <span className="text-[9.5px] bg-[#dcfce7] text-[#15803d] font-black px-2 py-1 rounded-sm border border-[#bbf7d0] uppercase tracking-wide flex items-center gap-1">
                <span>⚡ WRITEABLE</span>
              </span>
            )}
          </div>
        </div>

        {/* Primary screen render controller view */}
        <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col" id="master-view-container">
          {activeView === 'dashboard' && (
            <DashboardView 
              students={students}
              scores={scores}
              onNavigateToGradebook={() => setActiveView('gradebook')}
              onNavigateToRegister={() => setActiveView('register')}
              activityLogs={activityLogs}
              subjects={subjectsState}
              assessmentColumns={assessmentColumns}
              snapshots={snapshots}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              financialLedger={financialLedger}
              attendanceRecords={attendanceRecords}
              staffRecords={staffRecords}
              activeTerm={activeTerm}
              selectedAcademicYear={selectedAcademicYear}
              onNavigateToFees={() => setActiveView('fees')}
              onNavigateToAttendance={() => setActiveView('attendance')}
            />
          )}

          {activeView === 'register' && (
            <StudentRegisterView 
              students={students}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onTriggerToast={triggerToast}
              isReadOnly={isSelectedSessionReadOnly()}
            />
          )}

          {activeView === 'gradebook' && (
            <GradebookView 
              students={students}
              scores={scores}
              onUpdateScore={handleUpdateScore}
              onBatchFillRemarks={handleBatchFillRemarks}
              caWeight={caWeight}
              examWeight={examWeight}
              isGradesLocked={isGradesLocked}
              onToggleGradesLock={handleToggleGradesLock}
              activeSubject={activeSubject}
              setActiveSubject={setActiveSubject}
              activeTerm={activeTerm}
              setActiveTerm={setActiveTerm}
              activeClass={activeClass}
              setActiveClass={setActiveClass}
              onTriggerToast={triggerToast}
              onNavigateToReportCard={(studentId, termId) => {
                if (!isPremiumUser) {
                  setIsUpgradeModalOpen(true);
                  return;
                }
                setSelectedReportStudentId(studentId);
                setSelectedReportTerm(termId);
                setActiveView('reports');
              }}
              isPremiumUser={isPremiumUser}
              onTriggerUpgradeModal={() => setIsUpgradeModalOpen(true)}
              subjects={tierSubjects[getTierForClass(activeClass)] || []}
              onCustomizeSubjects={() => setIsCustomizeSubjectsOpen(true)}
              assessmentColumns={assessmentColumns}
              isReadOnly={isSelectedSessionReadOnly()}
              onSaveSnapshot={handleSaveSnapshot}
              snapshots={snapshots}
              onRestoreSnapshot={handleRestoreSnapshot}
              selectedAcademicYear={selectedAcademicYear}
              onNavigateToReports={() => setActiveView('reports')}
            />
          )}

          {activeView === 'reports' && (
            <TerminalReportsView 
              students={students}
              scores={scores}
              caWeight={caWeight}
              examWeight={examWeight}
              onTriggerToast={triggerToast}
              selectedStudentId={selectedReportStudentId}
              setSelectedStudentId={setSelectedReportStudentId}
              selectedTerm={selectedReportTerm}
              setSelectedTerm={setSelectedReportTerm}
              schoolName={schoolName}
              academicYear={`${selectedAcademicYear} Academic Year`}
              registrarName={registrarName}
              registrarKey={registrarKey}
              regionalDivision={regionalDivision}
              isPremiumUser={isPremiumUser}
              onTriggerUpgradeModal={() => setIsUpgradeModalOpen(true)}
              subjects={tierSubjects[getTierForClass(students.find(s => s.id === selectedReportStudentId)?.classId || 'Senior High 1A')]}
              assessmentColumns={assessmentColumns}
              staffRecords={staffRecords}
              attendanceRecords={attendanceRecords}
            />
          )}

          {activeView === 'settings' && (
            <SystemSettingsView
              caWeight={caWeight}
              setCaWeight={setCaWeight}
              examWeight={examWeight}
              setExamWeight={setExamWeight}
              onTriggerToast={triggerToast}
              schoolName={schoolName}
              setSchoolName={setSchoolName}
              academicYear={academicYear}
              setAcademicYear={setAcademicYear}
              registrarName={registrarName}
              setRegistrarName={setRegistrarName}
              registrarKey={registrarKey}
              setRegistrarKey={setRegistrarKey}
              regionalDivision={regionalDivision}
              setRegionalDivision={setRegionalDivision}
              onLogActivity={logActivity}
              schoolLogo={schoolLogo}
              setSchoolLogo={setSchoolLogo}
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              webhookUrl={webhookUrl}
              setWebhookUrl={setWebhookUrl}
              subjects={subjectsState}
              setSubjects={setSubjectsState}
              assessmentColumns={assessmentColumns}
              setAssessmentColumns={setAssessmentColumns}
            />
          )}

          {activeView === 'privacy' && (
            <PrivacyPolicyView 
              onBackToDashboard={() => setActiveView('dashboard')}
            />
          )}

          {activeView === 'staff' && (
            <StaffDirectoryView 
              staffRecords={staffRecords}
              onAddStaff={handleAddStaff}
              onDeleteStaff={handleDeleteStaff}
              onUpdateStaffStatus={handleUpdateStaffStatus}
              onTriggerToast={triggerToast}
              subjects={tierSubjects['senior-high']}
            />
          )}

          {activeView === 'fees' && (
            <FeesTrackerView 
              students={students}
              financialLedger={financialLedger}
              onRecordPayment={handleRecordPayment}
              onUpdateBulkInvoice={handleUpdateBulkInvoice}
              onTriggerToast={triggerToast}
              activeTerm={activeTerm}
              selectedAcademicYear={selectedAcademicYear}
              momoPhoneNumber={momoPhoneNumber}
              momoProvider={momoProvider}
            />
          )}

          {activeView === 'attendance' && (
            <AttendanceRegisterView 
              students={students}
              attendanceRecords={attendanceRecords}
              onSaveAttendance={handleSaveAttendance}
              onTriggerToast={triggerToast}
              activeTerm={activeTerm}
              selectedAcademicYear={selectedAcademicYear}
            />
          )}

          {activeView === 'ai-agent' && (
            <AIAgentConsoleView 
              students={students}
              scores={scores}
              financialLedger={financialLedger}
              onTriggerToast={triggerToast}
              onUpdateScores={(updatedScores) => {
                setScores(updatedScores);
                localStorage.setItem('edu_admin_scores', JSON.stringify(updatedScores));
              }}
              onUpdateFinancialLedger={(updatedLedger) => {
                setFinancialLedger(updatedLedger);
                localStorage.setItem('edu_admin_financial_ledger', JSON.stringify(updatedLedger));
              }}
              activeClass={activeClass}
              activeSubject={activeSubject}
              activeTerm={activeTerm}
              selectedAcademicYear={selectedAcademicYear}
              classTier={
                getTierForClass(activeClass) === 'pre-school' ? 'Pre-School' :
                getTierForClass(activeClass) === 'senior-high' ? 'Senior High' : 'Primary'
              }
              geminiApiKey={geminiApiKey}
              onNavigateToSettings={() => setActiveView('settings')}
            />
          )}
        </main>
      </div>

      {/* Interactive Customize Subjects Modal Overlay */}
      {isCustomizeSubjectsOpen && (
        <div id="customize-subjects-modal-overlay" className="fixed inset-0 z-50 bg-[#0c1827]/70 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="absolute inset-0" onClick={() => setIsCustomizeSubjectsOpen(false)} />
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant max-w-md w-full overflow-hidden animate-fade-in text-left relative z-10">
            {/* Modal Header */}
            <div className="bg-[#1e3a8a] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-200" />
                  <span>Customize Subjects Catalog</span>
                </h3>
                <p className="text-[10px] text-blue-205 text-blue-200 font-medium font-sans mt-0.5 uppercase tracking-wider">
                  Configure academic tier departments &amp; syllabi
                </p>
              </div>
              <button 
                onClick={() => setIsCustomizeSubjectsOpen(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer p-1.5 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              
              {/* Tier Selection Tab bar */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Select Academic Tier</label>
                <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setSelectedCustomizerTier('pre-school')}
                    className={`py-2 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      selectedCustomizerTier === 'pre-school'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Preschool
                  </button>
                  <button
                    onClick={() => setSelectedCustomizerTier('primary')}
                    className={`py-2 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      selectedCustomizerTier === 'primary'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Primary School
                  </button>
                  <button
                    onClick={() => setSelectedCustomizerTier('senior-high')}
                    className={`py-2 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      selectedCustomizerTier === 'senior-high'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    SHS Tier
                  </button>
                </div>
              </div>

              {/* Subject lists */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-wide text-slate-500 block">
                  Active Subjects ({tierSubjects[selectedCustomizerTier].length})
                </label>
                <div className="max-h-44 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {tierSubjects[selectedCustomizerTier].map((subj) => (
                    <div 
                      key={subj} 
                      className="flex items-center justify-between text-xs font-bold bg-white border border-slate-100 px-3 py-2 rounded-lg text-slate-700"
                    >
                      <span>{subj}</span>
                      <button
                        onClick={() => {
                          const updated = { ...tierSubjects };
                          updated[selectedCustomizerTier] = updated[selectedCustomizerTier].filter(s => s !== subj);
                          setTierSubjects(updated);
                          triggerToast(`Removed custom subject ${subj} from ${selectedCustomizerTier} list.`, 'info');
                        }}
                        className="text-slate-450 hover:text-red-650 text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 cursor-pointer"
                        title={`Remove ${subj}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {tierSubjects[selectedCustomizerTier].length === 0 && (
                    <p className="text-[11px] text-slate-400 font-medium text-center py-4 italic">
                      No subjects configured for this tier yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Add form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newCustomSubjectName.trim()) return;
                  const nameTrimmed = newCustomSubjectName.trim();
                  
                  if (tierSubjects[selectedCustomizerTier].some(s => s.toLowerCase() === nameTrimmed.toLowerCase())) {
                    triggerToast(`Subject "${nameTrimmed}" already exists in ${selectedCustomizerTier} list.`, 'error');
                    return;
                  }

                  const updated = { ...tierSubjects };
                  updated[selectedCustomizerTier] = [...updated[selectedCustomizerTier], nameTrimmed];
                  setTierSubjects(updated);
                  setNewCustomSubjectName('');
                  triggerToast(`Successfully added "${nameTrimmed}" to ${selectedCustomizerTier} syllabus catalog.`, 'success');
                }}
                className="space-y-1.5 pt-3 border-t border-slate-100"
              >
                <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Add New Subject</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Elective ICT"
                    value={newCustomSubjectName}
                    onChange={(e) => setNewCustomSubjectName(e.target.value)}
                    className="flex-1 text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="bg-[#1e3a8a] hover:bg-[#111827] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Add Subject
                  </button>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsCustomizeSubjectsOpen(false)}
                className="px-5 py-2 bg-primary hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Upgrade Modal Popup */}
      {isUpgradeModalOpen && (
        <div id="premium-upgrade-modal-backdrop" className="fixed inset-0 z-50 bg-[#0b1c30]/75 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant/60 max-w-md w-full overflow-hidden animate-fade-in relative text-left">
            
            {/* Header banner background */}
            <div className="bg-gradient-to-r from-[#0b1d2d] to-[#1e3a8a] text-white p-6 relative">
              <button 
                onClick={() => setIsUpgradeModalOpen(false)}
                className="absolute right-4 top-4 text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors cursor-pointer"
                aria-label="Close premium upgrade modal"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-3 text-2xl">
                <span>🌟</span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white leading-tight">Unlock Pro Reporting &amp; Automation</h2>
              <p className="text-[11px] text-zinc-300 font-medium font-sans mt-1 uppercase tracking-wider">
                EduAdmin Premium Services Activation
              </p>
            </div>

            {/* Modal Contents */}
            <div className="p-6 space-y-4 text-xs text-on-surface">
              <p className="text-on-surface-variant leading-relaxed text-[12.5px] font-medium">
                Upgrade to the Premium Tier to generate unlimited automated terminal reports, access high-speed grading grids, and activate automated SMS notifications to parents.
              </p>
              
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <h4 className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Professional Suite Includes:</h4>
                <div className="grid grid-cols-1 gap-2 text-zinc-700 font-semibold">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold shrink-0">✓</span>
                    <span>Academic Gradebook Mass Entry Matrix</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold shrink-0">✓</span>
                    <span>High-Fidelity Terminal Report PDF Compiler</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold shrink-0">✓</span>
                    <span>Parent Portal SMS Integration Relay</span>
                  </div>
                </div>
              </div>

              {/* Tabs for Payment Channels */}
              <div className="border-b border-slate-150 pt-1">
                <div className="flex gap-4">
                  <button
                    onClick={() => setPaymentChannel('store')}
                    className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      paymentChannel === 'store'
                        ? 'border-[#2563eb] text-[#2563eb]'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    💻 Windows Store
                  </button>
                  <button
                    onClick={() => setPaymentChannel('momo')}
                    className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      paymentChannel === 'momo'
                        ? 'border-[#2563eb] text-[#2563eb]'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    📱 Mobile Money (MoMo)
                  </button>
                </div>
              </div>

              {paymentChannel === 'store' ? (
                <div className="space-y-3 animate-fade-in">
                  {/* Pricing card */}
                  <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">PREMIUM_UPGRADE_PRO</p>
                      <p className="font-semibold text-slate-800 text-xs">Lifetime License Activation</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Instant activation upon successful payment</p>
                    </div>
                    <div className="text-right shrink-0">
                      {localizedPrice ? (
                        <span className="text-xl font-black text-[#2563eb]">{localizedPrice}</span>
                      ) : (
                        <span className="text-xs text-[#2563eb] animate-pulse font-bold">Loading...</span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={async () => {
                        try {
                          setIsBillingLoading(true);
                          const result = await billingService.requestPurchaseAsync("premium_upgrade_pro");
                          if (result.status === StorePurchaseStatus.succeeded) {
                            unlockAllApplicationFeatures();
                          } else {
                            triggerToast(result.extendedError || `Store transaction cancelled (${result.status}).`, "error");
                            setIsBillingLoading(false);
                          }
                        } catch (err) {
                          triggerToast("Store interaction timed out.", "error");
                          setIsBillingLoading(false);
                        }
                      }}
                      disabled={isBillingLoading}
                      className="w-full py-3.5 bg-[#2563eb] hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isBillingLoading ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Querying Store Gateway...</span>
                        </>
                      ) : (
                        <span>{localizedPrice ? `Pay via Windows Store (${localizedPrice})` : "Upgrade to Pro"}</span>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-medium">
                      Secured by Microsoft. Permanent license tied to your account.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in text-left">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Mobile Money Carrier Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={momoProvider}
                        onChange={(e) => setMomoProvider(e.target.value)}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-750 font-bold focus:outline-hidden focus:border-primary text-xs focus:outline-hidden"
                      >
                        <option value="MTN MoMo">MTN MoMo</option>
                        <option value="Telecel Cash">Telecel Cash</option>
                        <option value="AT Money">AT Money</option>
                        <option value="Orange Money">Orange Money</option>
                        <option value="AirtelTigo Cash">AirtelTigo Cash</option>
                      </select>
                      <input
                        type="text"
                        value={momoPhoneNumber}
                        onChange={(e) => setMomoPhoneNumber(e.target.value)}
                        placeholder="e.g. 0244123456"
                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-750 font-bold focus:outline-hidden focus:border-primary text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-outline-variant/60 rounded-xl p-3 flex items-center justify-between text-xs font-semibold gap-3">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Callback channel: Paystack / MoMo</span>
                      <span className="text-on-background font-bold text-xs">Direct Carrier Billing</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#16a34a]">
                        {localizedPrice || "GH₵ 250"}
                      </span>
                    </div>
                  </div>

                  {/* MoMo Action trigger */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={async () => {
                        if (!momoPhoneNumber || momoPhoneNumber.trim().length < 8) {
                          triggerToast("Please enter a valid Mobile Money number format.", "error");
                          return;
                        }
                        try {
                          setIsBillingLoading(true);
                          const response = await billingService.processMoMoPayment(momoPhoneNumber, momoProvider);
                          if (response.status === 'success') {
                            unlockAllApplicationFeatures();
                          } else {
                            triggerToast(response.errorMessage || "Mobile Money transaction was declined.", "error");
                            setIsBillingLoading(false);
                          }
                        } catch (err) {
                          triggerToast("Mobile Money connection timed out.", "error");
                          setIsBillingLoading(false);
                        }
                      }}
                      disabled={isBillingLoading}
                      className="w-full py-3.5 bg-[#16a34a] hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isBillingLoading ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Sending USSD Prompt...</span>
                        </>
                      ) : (
                        <span>Pay with {momoProvider} ({localizedPrice || "GH₵ 250"})</span>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-medium">
                      You'll receive a prompt on your phone. Enter your MoMo PIN to confirm.
                    </p>
                  </div>
                </div>
              )}

              {/* Coupon Validation Section */}
              <div className="pt-3.5 border-t border-slate-150 space-y-2 text-left">
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  Discount Coupon / Developer Master Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value);
                      if (couponError) setCouponError(null);
                    }}
                    placeholder="Enter Developer Code or Promotional Coupon..."
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-250 rounded-lg text-slate-750 font-bold focus:outline-hidden focus:border-primary text-xs focus:outline-hidden"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleVerifyCoupon();
                      }
                    }}
                  />
                  <button
                    onClick={handleVerifyCoupon}
                    className="px-4 py-2.5 bg-[#0f172a] hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    Verify Code
                  </button>
                </div>
                {couponError && (
                  <p className="text-[10px] font-semibold text-rose-600 transition-all animate-fade-in animate-duration-150">
                    {couponError}
                  </p>
                )}
              </div>

              {/* Maybe Later secondary action */}
              <button 
                onClick={() => setIsUpgradeModalOpen(false)}
                disabled={isBillingLoading}
                className="w-full py-2 bg-transparent hover:bg-slate-100 text-slate-500 font-bold rounded-xl transition-all text-xs cursor-pointer"
              >
                Maybe Later
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Floating notifications Stack overlay */}
      <div className="fixed top-18 right-6 z-50 flex flex-col gap-2 pointer-events-none text-xs font-semibold animate-duration-150">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`flex items-center gap-3 p-4 rounded-xl shadow-lg border pointer-events-auto bg-white max-w-sm transition-all duration-300 animate-slide-in`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-700 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-650 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-650 shrink-0" />}
            <span className="text-[#0b1c30] flex-1 font-semibold">{toast.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-1 hover:bg-slate-150 rounded text-[#0b1c30] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
