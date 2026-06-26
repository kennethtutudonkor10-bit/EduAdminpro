/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Score, GradingScale, ValidationLog, ActivityLog, AssessmentColumn } from './types';

export const initialActivityLogs: ActivityLog[] = [
  {
    id: "act-01",
    action: "Grade committed: Mathematics score for Adomako, Akwasi (SH-001) Term 1",
    category: "grade",
    timestamp: "2026-06-02T13:15:30.000Z"
  },
  {
    id: "act-02",
    action: "Batch remark generated: Science Term 1 cohort validation completed",
    category: "remark",
    timestamp: "2026-06-02T12:40:00.000Z"
  },
  {
    id: "act-03",
    action: "Student added: Owusu, Beatrice enrolled in Senior High 1B",
    category: "student",
    timestamp: "2026-06-02T11:12:15.000Z"
  },
  {
    id: "act-04",
    action: "Academic weights updated: CA set to 30%, Exam set to 70%",
    category: "setting",
    timestamp: "2026-06-02T10:05:00.000Z"
  },
  {
    id: "act-05",
    action: "System configuration saved: Institutional branding adjusted",
    category: "setting",
    timestamp: "2026-06-02T09:30:10.000Z"
  },
  {
    id: "act-06",
    action: "Grade book locked: Prevented auxiliary writeovers",
    category: "other",
    timestamp: "2026-06-01T16:45:00.000Z"
  },
  {
    id: "act-07",
    action: "Scores adjusted: Exam score updated for Ibrahim, Kwame (SH-008) in History",
    category: "grade",
    timestamp: "2026-06-01T14:22:00.000Z"
  },
  {
    id: "act-08",
    action: "Student status modified: Appiah, Vivian set to Suspended status",
    category: "student",
    timestamp: "2026-06-01T11:05:40.000Z"
  },
  {
    id: "act-09",
    action: "Terminal report reviewed: Advisory feedback logged for Boateng, Serwaa",
    category: "remark",
    timestamp: "2026-06-01T09:15:00.000Z"
  }
];

export const initialStudents: Student[] = [
  { id: "SH-001", name: "Adomako, Akwasi", classId: "Senior High 1A", gender: "Male", status: "Enrolled" },
  { id: "SH-002", name: "Boateng, Serwaa", classId: "Senior High 1A", gender: "Female", status: "Enrolled" },
  { id: "SH-003", name: "Dankwa, Emmanuel", classId: "Senior High 1A", gender: "Male", status: "Enrolled" },
  { id: "SH-004", name: "Essien, Martha", classId: "Senior High 1A", gender: "Female", status: "Enrolled" },
  { id: "SH-005", name: "Frimpong, Kofi", classId: "Senior High 1A", gender: "Male", status: "Enrolled" },
  { id: "SH-006", name: "Gyamfi, Yaa", classId: "Senior High 1A", gender: "Female", status: "Enrolled" },
  { id: "SH-007", name: "Hassan, Fatima", classId: "Senior High 1A", gender: "Female", status: "Enrolled" },
  { id: "SH-008", name: "Ibrahim, Kwame", classId: "Senior High 1A", gender: "Male", status: "Enrolled" },
  { id: "SH-009", name: "Kusi, Belinda", classId: "Senior High 1A", gender: "Female", status: "Enrolled" },
  { id: "SH-010", name: "Lartey, John", classId: "Senior High 1A", gender: "Male", status: "Enrolled" },
  { id: "SH-011", name: "Mensah, David", classId: "Senior High 1A", gender: "Male", status: "Enrolled" },
  { id: "SH-012", name: "Nimo, Grace", classId: "Senior High 1A", gender: "Female", status: "Enrolled" },
  // Extra students for different classes to make the app realistic
  { id: "SH-013", name: "Owusu, Beatrice", classId: "Senior High 2B", gender: "Female", status: "Enrolled" },
  { id: "SH-014", name: "Osei, Kingsley", classId: "Senior High 2B", gender: "Male", status: "Enrolled" },
  { id: "SH-015", name: "Addison, Raymond", classId: "Senior High 2B", gender: "Male", status: "Enrolled" },
  { id: "SH-016", name: "Appiah, Vivian", classId: "Senior High 2B", gender: "Female", status: "Suspended" },
  { id: "SH-017", name: "Baffour, Rita", classId: "Grade 5", gender: "Female", status: "Enrolled" },
  { id: "SH-018", name: "Asare, Richard", classId: "Grade 5", gender: "Male", status: "Withdrawn" },
  { id: "SH-019", name: "Gallo, Francesco", classId: "Grade 5", gender: "Male", status: "Enrolled" },
  // Pre-school students
  { id: "KG-001", name: "Dankwa, Junior", classId: "Kindergarten 1", gender: "Male", status: "Enrolled" },
  { id: "KG-002", name: "Mensah, Bella", classId: "Kindergarten 2", gender: "Female", status: "Enrolled" }
];

export const initialScores: Score[] = [
  // Mathematics Term 1 SH 1A
  { studentId: "SH-001", subjectId: "Mathematics", termId: "Term 1", test1: 25, test2: 22, hw: 28, exam: 62 },
  { studentId: "SH-002", subjectId: "Mathematics", termId: "Term 1", test1: 20, test2: 18, hw: 25, exam: 55 },
  { studentId: "SH-003", subjectId: "Mathematics", termId: "Term 1", test1: 15, test2: 12, hw: 20, exam: 45 },
  { studentId: "SH-004", subjectId: "Mathematics", termId: "Term 1", test1: 28, test2: 29, hw: 30, exam: 68 },
  { studentId: "SH-005", subjectId: "Mathematics", termId: "Term 1", test1: 10, test2: 11, hw: 15, exam: 30 },
  { studentId: "SH-006", subjectId: "Mathematics", termId: "Term 1", test1: 22, test2: 21, hw: 24, exam: 50 },
  { studentId: "SH-007", subjectId: "Mathematics", termId: "Term 1", test1: 18, test2: 20, hw: 22, exam: 48 },
  { studentId: "SH-008", subjectId: "Mathematics", termId: "Term 1", test1: 30, test2: 28, hw: 29, exam: 65 },
  { studentId: "SH-009", subjectId: "Mathematics", termId: "Term 1", test1: 24, test2: 23, hw: 22, exam: 52 },
  { studentId: "SH-010", subjectId: "Mathematics", termId: "Term 1", test1: 12, test2: 14, hw: 10, exam: 25 },
  { studentId: "SH-011", subjectId: "Mathematics", termId: "Term 1", test1: 26, test2: 24, hw: 27, exam: 60 },
  { studentId: "SH-012", subjectId: "Mathematics", termId: "Term 1", test1: 19, test2: 17, hw: 18, exam: 40 },
  
  // A few missing values to test warnings/logs (e.g., SH-042 from validation log pattern, but we can do SH-010 for test purposes)
  // Let's create scores for other subjects to make selection changes actually dynamic and rich
  { studentId: "SH-001", subjectId: "Science", termId: "Term 1", test1: 28, test2: 27, hw: 29, exam: 66 },
  { studentId: "SH-002", subjectId: "Science", termId: "Term 1", test1: 22, test2: 24, hw: 21, exam: 58 },
  { studentId: "SH-003", subjectId: "Science", termId: "Term 1", test1: 18, test2: 15, hw: 19, exam: 42 },
  { studentId: "SH-004", subjectId: "Science", termId: "Term 1", test1: 29, test2: 30, hw: 28, exam: 69 },
  { studentId: "SH-005", subjectId: "Science", termId: "Term 1", test1: 14, test2: 12, hw: 13, exam: 35 },

  // Senior High 1B Math Term 1
  { studentId: "SH-013", subjectId: "Mathematics", termId: "Term 1", test1: 24, test2: 26, hw: 25, exam: 59 },
  { studentId: "SH-014", subjectId: "Mathematics", termId: "Term 1", test1: 21, test2: 19, hw: 20, exam: 52 },
  { studentId: "SH-015", subjectId: "Mathematics", termId: "Term 1", test1: 18, test2: 17, hw: 22, exam: 46 },
  { studentId: "SH-016", subjectId: "Mathematics", termId: "Term 1", test1: null, test2: 14, hw: 15, exam: 38 } // Missing score warning
];

export const gradingScale: GradingScale[] = [
  { grade: "A", minScore: 80, badgeBg: "bg-green-100 text-green-800", badgeText: "#15803d" },
  { grade: "A-", minScore: 75, badgeBg: "bg-emerald-100 text-emerald-800", badgeText: "#047857" },
  { grade: "B+", minScore: 70, badgeBg: "bg-blue-100 text-blue-800", badgeText: "#1d4ed8" },
  { grade: "B", minScore: 65, badgeBg: "bg-indigo-100 text-indigo-800", badgeText: "#4338ca" },
  { grade: "C+", minScore: 60, badgeBg: "bg-orange-100 text-orange-800", badgeText: "#c2410c" },
  { grade: "C", minScore: 55, badgeBg: "bg-amber-100 text-amber-800", badgeText: "#b45309" },
  { grade: "C-", minScore: 50, badgeBg: "bg-yellow-100 text-yellow-800", badgeText: "#a16207" },
  { grade: "D", minScore: 40, badgeBg: "bg-purple-100 text-purple-800", badgeText: "#7e22ce" },
  { grade: "F", minScore: 0, badgeBg: "bg-red-100 text-red-800", badgeText: "#b91c1c" }
];

export const subjects = ["Mathematics", "Science", "English Literature", "History"];
export const terms = ["Term 1", "Term 2", "Term 3"];
export const classes = [
  "Kindergarten 1",
  "Kindergarten 2",
  "Grade 1A",
  "Grade 3B",
  "Grade 5",
  "Senior High 1A",
  "Senior High 2B"
];

/**
 * Calculates weighted score out of 100
 * Supports BOTH legacy caWeight/examWeight and dynamic columns array.
 */
export function calculateStudentTotal(
  score: Score, 
  caWeightOrColumns?: number | AssessmentColumn[], 
  examWeight: number = 70
): number {
  if (Array.isArray(caWeightOrColumns)) {
    // Dynamic Columns mode!
    const columns = caWeightOrColumns;
    let studentSum = 0;
    let totalMax = 0;
    columns.forEach(col => {
      // Find dynamic scores, or fall back to legacy properties for old records compatibility
      let val = score[col.id];
      if (val === undefined || val === null) {
        // Fallback for compatibility (e.g., if col.id is 'test1' and it is stored as 'test1')
        val = score[col.id] ?? 0;
      }
      studentSum += Number(val ?? 0);
      totalMax += col.maxScore;
    });
    return totalMax > 0 ? Math.round((studentSum / totalMax) * 100) : 0;
  }

  // Legacy fallback math
  const caWeight = typeof caWeightOrColumns === 'number' ? caWeightOrColumns : 30;
  const t1 = score.test1 ?? 0;
  const t2 = score.test2 ?? 0;
  const hw = score.hw ?? 0;
  const exam = score.exam ?? 0;

  const caAvg = (t1 + t2 + hw) / 3;
  const caContribution = caAvg * (caWeight / 100);
  const examContribution = exam * (examWeight / 100);

  return Math.round(caContribution + examContribution);
}

export function calculateGrade(scoreValue: number): string {
  for (const scale of gradingScale) {
    if (scoreValue >= scale.minScore) {
      return scale.grade;
    }
  }
  return "F";
}

export function getGradeBadgeColors(grade: string): { bg: string; text: string } {
  const scale = gradingScale.find(s => s.grade === grade);
  if (scale) {
    return { bg: scale.badgeBg, text: scale.badgeText };
  }
  return { bg: "bg-red-100 text-red-800", text: "#b91c1c" };
}

/**
 * Compute ordinal position ranks (e.g., "1st", "2nd", "3rd", "4th"..."12th", etc.)
 * grouped by the same subject, class, and term.
 */
export function calculateRankPositions(
  studentIds: string[],
  scoresList: Score[],
  subjectId: string,
  termId: string,
  caWeightOrColumns?: number | AssessmentColumn[],
  examWeight: number = 70
): Record<string, string> {
  const calculatedTotals = studentIds.map(stId => {
    const score = scoresList.find(s => s.studentId === stId && s.subjectId === subjectId && s.termId === termId) || {
      studentId: stId,
      subjectId,
      termId
    };
    return {
      studentId: stId,
      total: calculateStudentTotal(score, caWeightOrColumns, examWeight)
    };
  });

  // Sort descending by total score
  calculatedTotals.sort((a, b) => b.total - a.total);

  const ranks: Record<string, string> = {};
  
  calculatedTotals.forEach((item, index) => {
    // Ordinal numbers formatting
    const rankNum = index + 1;
    let rankStr = `${rankNum}th`;
    if (rankNum % 10 === 1 && rankNum % 100 !== 11) {
      rankStr = `${rankNum}st`;
    } else if (rankNum % 10 === 2 && rankNum % 100 !== 12) {
      rankStr = `${rankNum}nd`;
    } else if (rankNum % 10 === 3 && rankNum % 100 !== 13) {
      rankStr = `${rankNum}rd`;
    }
    ranks[item.studentId] = rankStr;
  });

  return ranks;
}

export const defaultValidationLogs: ValidationLog[] = [
  {
    id: "log-1",
    type: "success",
    message: "Auto-Calc Complete",
    description: "All student grades and statistical positions resolved.",
    timestamp: "12:04 PM"
  },
  {
    id: "log-2",
    type: "warning",
    message: "Missing Score",
    description: "ID SH-016: Math Test 1 is blank/null in alternate classes.",
    timestamp: "12:05 PM"
  },
  {
    id: "log-3",
    type: "info",
    message: "System Integrity",
    description: "Cloud live sync session validated.",
    timestamp: "12:06 PM"
  }
];

export function generateRemarks(grade: string): string {
  if (grade.startsWith("A")) return "Excellent performance, keep up the outstanding execution.";
  if (grade.startsWith("B")) return "Strong effort demonstrated. Very competent and alert.";
  if (grade.startsWith("C")) return "Satisfactory competency. Room for further growth.";
  if (grade.startsWith("D")) return "Developing. Consistent personal tutoring highly advised.";
  return "Incomplete or failing benchmark. Intensive remediation required.";
}

import { StaffRecord } from './types';

export const initialStaffRecords: StaffRecord[] = [
  {
    staffId: "STF-101",
    fullName: "Mr. James Kofi",
    phoneNumber: "+233 24 456 7890",
    email: "james.kofi@eduadmin.edu.gh",
    dateJoined: "2021-09-01",
    employmentStatus: "Active",
    staffCategory: "Teaching",
    assignedClass: "Senior High 1A",
    subjectsTaught: ["Mathematics", "History"]
  },
  {
    staffId: "STF-102",
    fullName: "Mrs. Beatrice Owusu",
    phoneNumber: "+233 20 123 4567",
    email: "beatrice.owusu@eduadmin.edu.gh",
    dateJoined: "2022-01-15",
    employmentStatus: "Active",
    staffCategory: "Teaching",
    assignedClass: "Senior High 2B",
    subjectsTaught: ["Science", "English Literature"]
  },
  {
    staffId: "STF-103",
    fullName: "Rev. Father Anthony",
    phoneNumber: "+233 27 987 6543",
    email: "rev.anthony@eduadmin.edu.gh",
    dateJoined: "2020-08-20",
    employmentStatus: "Active",
    staffCategory: "Teaching",
    assignedClass: "Grade 5",
    subjectsTaught: ["History", "English Literature"]
  },
  {
    staffId: "STF-104",
    fullName: "Mad. Elizabeth Taylor",
    phoneNumber: "+233 55 555 1234",
    email: "elizabeth.taylor@eduadmin.edu.gh",
    dateJoined: "2024-03-10",
    employmentStatus: "On Leave",
    staffCategory: "Teaching",
    assignedClass: "Unassigned",
    subjectsTaught: ["Mathematics"]
  },
  // Non-teaching
  {
    staffId: "STF-201",
    fullName: "Mr. Samuel Dankwa",
    phoneNumber: "+233 24 999 8888",
    email: "samuel.bursar@eduadmin.edu.gh",
    dateJoined: "2019-05-12",
    employmentStatus: "Active",
    staffCategory: "Non-Teaching",
    specificRole: "Accountant/Bursar"
  },
  {
    staffId: "STF-202",
    fullName: "Miss Gloria Mensah",
    phoneNumber: "+233 26 777 6666",
    email: "gloria.secretary@eduadmin.edu.gh",
    dateJoined: "2023-11-01",
    employmentStatus: "Active",
    staffCategory: "Non-Teaching",
    specificRole: "Secretary"
  },
  {
    staffId: "STF-203",
    fullName: "Osei Bonsu Kwame",
    phoneNumber: "+233 20 888 1111",
    email: "bonsu.driver@eduadmin.edu.gh",
    dateJoined: "2021-04-18",
    employmentStatus: "Active",
    staffCategory: "Non-Teaching",
    specificRole: "Driver"
  }
];

import { FinancialRecord, AttendanceRecord } from './types';

export const initialFinancialLedger: FinancialRecord[] = [
  {
    id: "TX-1001",
    studentId: "SH-001",
    studentName: "Adomako, Akwasi",
    classId: "Senior High 1A",
    academicYear: "2025-2026",
    termId: "Term 1",
    billAmount: 1800,
    paidAmount: 1800,
    paymentMethod: "MoMo",
    balance: 0,
    lastUpdated: "2026-06-02T10:00:00.000Z"
  },
  {
    id: "TX-1002",
    studentId: "SH-002",
    studentName: "Boateng, Serwaa",
    classId: "Senior High 1A",
    academicYear: "2025-2026",
    termId: "Term 1",
    billAmount: 1800,
    paidAmount: 1200,
    paymentMethod: "Cash",
    balance: 600,
    lastUpdated: "2026-06-02T11:30:00.000Z"
  },
  {
    id: "TX-1003",
    studentId: "SH-003",
    studentName: "Dankwa, Emmanuel",
    classId: "Senior High 1A",
    academicYear: "2025-2026",
    termId: "Term 1",
    billAmount: 1800,
    paidAmount: 800,
    paymentMethod: "MoMo",
    balance: 1000,
    lastUpdated: "2026-06-01T09:12:00.000Z"
  },
  {
    id: "TX-1004",
    studentId: "SH-004",
    studentName: "Essien, Martha",
    classId: "Senior High 1A",
    academicYear: "2025-2026",
    termId: "Term 1",
    billAmount: 1800,
    paidAmount: 1800,
    paymentMethod: "MoMo",
    balance: 0,
    lastUpdated: "2026-06-02T14:15:00.000Z"
  },
  {
    id: "TX-1005",
    studentId: "SH-005",
    studentName: "Frimpong, Kofi",
    classId: "Senior High 1A",
    academicYear: "2025-2026",
    termId: "Term 1",
    billAmount: 1800,
    paidAmount: 0,
    paymentMethod: "Cash",
    balance: 1800,
    lastUpdated: "2026-05-28T08:00:00.000Z"
  },
  {
    id: "TX-1006",
    studentId: "SH-013",
    studentName: "Owusu, Beatrice",
    classId: "Senior High 1B",
    academicYear: "2025-2026",
    termId: "Term 1",
    billAmount: 1500,
    paidAmount: 1500,
    paymentMethod: "MoMo",
    balance: 0,
    lastUpdated: "2026-06-02T12:00:00.000Z"
  }
];

export const initialAttendanceRecords: AttendanceRecord[] = [
  {
    date: "2026-06-01",
    termId: "Term 1",
    classId: "Senior High 1A",
    attendance: {
      "SH-001": "Present",
      "SH-002": "Present",
      "SH-003": "Absent",
      "SH-004": "Present",
      "SH-005": "Present",
      "SH-006": "Present",
      "SH-007": "Present",
      "SH-008": "Present",
      "SH-009": "Present",
      "SH-010": "Present",
      "SH-011": "Present",
      "SH-012": "Present"
    }
  },
  {
    date: "2026-06-02",
    termId: "Term 1",
    classId: "Senior High 1A",
    attendance: {
      "SH-001": "Present",
      "SH-002": "Absent",
      "SH-003": "Present",
      "SH-004": "Present",
      "SH-005": "Present",
      "SH-006": "Present",
      "SH-007": "Absent",
      "SH-008": "Present",
      "SH-009": "Present",
      "SH-010": "Present",
      "SH-011": "Present",
      "SH-012": "Present"
    }
  }
];

