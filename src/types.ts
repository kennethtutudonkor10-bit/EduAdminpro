/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Student {
  id: string;
  name: string;
  classId: string; // e.g., 'Senior High 1A', 'Senior High 1B', 'Junior High 3'
  gender: 'Male' | 'Female';
  status: 'Enrolled' | 'Suspended' | 'Withdrawn' | 'Active' | 'Graduated' | 'On Leave';
  photo?: string;
  phoneNumber?: string;
}

export interface Score {
  studentId: string;
  subjectId: string; // e.g., 'Mathematics', 'Science', 'English Literature', 'History'
  termId: string;    // e.g., 'Term 1', 'Term 2', 'Term 3'
  remark?: string;
  [customColumnId: string]: any; // Score details mapped by AssessmentColumn ID or string keys
}

export interface AssessmentColumn {
  id: string;
  name: string;
  maxScore: number;
}

export interface GradingScale {
  grade: string;
  minScore: number;
  badgeBg: string;
  badgeText: string;
}

export interface ValidationLog {
  id: string;
  type: 'success' | 'warning' | 'info';
  message: string;
  description: string;
  timestamp: string;
}

export interface ClassConfig {
  id: string;
  name: string;
}

export interface SubjectConfig {
  id: string;
  name: string;
}

export interface TermConfig {
  id: string;
  name: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  category: 'grade' | 'student' | 'remark' | 'setting' | 'other';
  timestamp: string; // formatted date-time or time-ago string
}

export type StaffCategory = 'Teaching' | 'Non-Teaching';
export type StaffEmploymentStatus = 'Active' | 'On Leave';
export type NonTeachingRole = 'Accountant/Bursar' | 'Secretary' | 'Driver' | 'Security' | 'Catering/Cook';

export interface StaffRecord {
  staffId: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  dateJoined: string;
  employmentStatus: StaffEmploymentStatus;
  staffCategory: StaffCategory;
  // Category-specific sub-attributes
  assignedClass?: string; // e.g. "Senior High 1A", "Class 5", "JHS 1"
  subjectsTaught?: string[]; // array of subject name strings or custom ID strings
  specificRole?: NonTeachingRole | string;
  photo?: string;
  department?: 'Science' | 'Mathematics' | 'Humanities' | 'Languages' | 'Admin';
  isCoordinator?: boolean;
}

export type PaymentMethod = 'Cash' | 'MoMo';

export interface FinancialRecord {
  id: string; // unique ledger ID
  studentId: string;
  studentName: string;
  classId: string;
  academicYear: string;
  termId: string;
  billAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  balance: number; // outstanding balance (billAmount - paidAmount)
  lastUpdated: string;
}

export interface AttendanceRecord {
  date: string; // e.g. "2026-06-05"
  termId: string; // Term 1, Term 2, etc.
  classId: string; // Senior High 1A, etc.
  attendance: Record<string, 'Present' | 'Absent'>; // studentId -> status
}

