/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Search,
  FileText,
  User,
  GraduationCap,
  CheckCircle,
  Stamp,
  Award,
  BookOpen,
  Users
} from 'lucide-react';
import { Student, Score, AssessmentColumn, StaffRecord, AttendanceRecord } from '../types';
import { 
  calculateStudentTotal, 
  calculateGrade, 
  generateRemarks,
  calculateRankPositions
} from '../data';

interface TerminalReportsViewProps {
  students: Student[];
  scores: Score[];
  caWeight: number;
  examWeight: number;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
  selectedStudentId?: string;
  setSelectedStudentId?: (id: string) => void;
  selectedTerm?: string;
  setSelectedTerm?: (term: string) => void;
  schoolName?: string;
  academicYear?: string;
  registrarName?: string;
  registrarKey?: string;
  regionalDivision?: string;
  isPremiumUser?: boolean;
  onTriggerUpgradeModal?: () => void;
  
  // Custom Dynamic Customizers Props
  subjects: string[];
  assessmentColumns: AssessmentColumn[];
  staffRecords?: StaffRecord[];
  attendanceRecords?: AttendanceRecord[];
}

export default function TerminalReportsView({
  students,
  scores,
  caWeight,
  examWeight,
  onTriggerToast,
  selectedStudentId,
  setSelectedStudentId,
  selectedTerm,
  setSelectedTerm,
  schoolName = 'EDUADMIN PROGRESSIVE ACADEMY',
  academicYear = '2025/2026 Academic Year',
  registrarName = 'District Registrar',
  registrarKey = 'ADMIN_ID_9921',
  regionalDivision = 'District Registry, HQ Center Section • Ghana West Africa',
  isPremiumUser = false,
  onTriggerUpgradeModal,
  subjects,
  assessmentColumns,
  staffRecords = [],
  attendanceRecords = []
}: TerminalReportsViewProps) {
  const enrolledStudents = students.filter(s => s.status === 'Enrolled');
  const classOptions = [...new Set(enrolledStudents.map(s => s.classId))].sort();

  // Local state fallbacks if props are not provided or empty
  const [localStudentId, setLocalStudentId] = useState<string>(
    enrolledStudents[0]?.id || ''
  );
  const [localTerm, setLocalTerm] = useState('Term 1');
  const [bulkClass, setBulkClass] = useState<string>(classOptions[0] || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [printingClass, setPrintingClass] = useState<string | null>(null);

  const filteredStudents = studentSearch.trim()
    ? enrolledStudents.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : enrolledStudents;

  useEffect(() => {
    if (!printingClass) return;
    const timer = setTimeout(() => {
      window.print();
      setPrintingClass(null);
    }, 120);
    return () => clearTimeout(timer);
  }, [printingClass]);

  // Resolve active states
  const currentStudentId = (selectedStudentId !== undefined && selectedStudentId !== '') 
    ? selectedStudentId 
    : (localStudentId || enrolledStudents[0]?.id || '');
  
  const currentTerm = (selectedTerm !== undefined && selectedTerm !== '') 
    ? selectedTerm 
    : (localTerm || 'Term 1');

  const handleStudentChange = (id: string) => {
    if (setSelectedStudentId) {
      setSelectedStudentId(id);
    } else {
      setLocalStudentId(id);
    }
  };

  const handleTermChange = (term: string) => {
    if (setSelectedTerm) {
      setSelectedTerm(term);
    } else {
      setLocalTerm(term);
    }
  };

  const activeStudent = students.find(s => s.id === currentStudentId);

  // Look up the active teaching staff member whose assignedClass matches the student's classId
  const matchingTeacher = activeStudent 
    ? staffRecords.find(staff => staff.staffCategory === 'Teaching' && staff.assignedClass === activeStudent.classId)
    : undefined;

  const classTeacherName = matchingTeacher ? matchingTeacher.fullName : "Class Instructor";

  // Dynamic Attendance calculations over active term
  const studentClass = activeStudent ? activeStudent.classId : '';
  const termAttendance = attendanceRecords.filter(
    r => r.classId === studentClass && r.termId === currentTerm
  );

  const totalSchoolDays = termAttendance.length;
  const daysPresent = activeStudent 
    ? termAttendance.filter(r => r.attendance[activeStudent.id] === 'Present').length 
    : 0;
  const attendancePercentage = totalSchoolDays > 0 
    ? Math.round((daysPresent / totalSchoolDays) * 100) 
    : 95; // default fallback if no attendance lists saved yet

  const displayPresent = totalSchoolDays > 0 ? daysPresent : 62;
  const displayTotal = totalSchoolDays > 0 ? totalSchoolDays : 65;
  const displayPercent = totalSchoolDays > 0 ? attendancePercentage : 95;
  const isFallbackAttendance = totalSchoolDays === 0;

  // Filter student scores for active selected term
  const studentTermScores = scores.filter(
    s => s.studentId === currentStudentId && s.termId === currentTerm
  );

  // Build report stats
  let totalWeightedScore = 0;
  let subjectsCount = 0;
  let passCount = 0;

  const reportRows = subjects.map(subj => {
    const score = studentTermScores.find(s => s.subjectId === subj) || {
      studentId: currentStudentId,
      subjectId: subj,
      termId: currentTerm
    };

    const hasValue = assessmentColumns.some(col => score[col.id] !== undefined && score[col.id] !== null);
    const total = calculateStudentTotal(score, assessmentColumns);
    const grade = calculateGrade(total);

    if (hasValue) {
      totalWeightedScore += total;
      subjectsCount++;
      if (total >= 45) {
        passCount++;
      }
    }

    // Get rank position for this specific student in this specific subject (dynamically using assessment columns)
    const subjectRanks = calculateRankPositions(
      enrolledStudents.map(s => s.id),
      scores,
      subj,
      currentTerm,
      assessmentColumns
    );

    const rank = subjectRanks[currentStudentId] || "N/A";

    return {
      subject: subj,
      scoresMap: assessmentColumns.reduce((acc, col) => {
        acc[col.id] = score[col.id];
        return acc;
      }, {} as Record<string, any>),
      total,
      grade,
      rank,
      remark: generateRemarks(grade),
      hasValue
    };
  });

  const termAverage = subjectsCount > 0 ? Math.round(totalWeightedScore / subjectsCount) : 0;
  const overallGrade = calculateGrade(termAverage);

  const handlePrint = () => {
    window.print();
    onTriggerToast("Triggering localized layout compilation to print interface.", "info");
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full text-on-surface" id="terminal-reports-view-container">
      
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-on-background">Terminal Performance Summaries</h2>
          <p className="text-xs text-on-surface-variant font-medium">Compile and distribute high-fidelity student report cards.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Print report action button */}
          <button
            onClick={handlePrint}
            className="font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer transition-all bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            title="Print Summary Report Card"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          {/* Bulk class print */}
          <div className="flex items-center gap-1.5">
            <select
              value={bulkClass}
              onChange={e => setBulkClass(e.target.value)}
              className="text-xs font-semibold border border-outline-variant rounded-lg px-2 py-2.5 bg-white text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => {
                if (!bulkClass) return;
                onTriggerToast(`Compiling ${bulkClass} class report cards for print…`, 'info');
                setPrintingClass(bulkClass);
              }}
              className="font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer transition-all bg-slate-700 hover:bg-slate-900 text-white"
              title={`Bulk print all students in ${bulkClass}`}
            >
              <Users className="w-4 h-4" />
              <span>Bulk Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inputs controls panel */}
      <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl flex flex-col md:flex-row gap-4 items-stretch md:items-center print:hidden">
        
        {/* Select student with live search */}
        <div className="flex-grow flex flex-col gap-1.5">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider text-slate-500">Select Student</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              className="pl-8 pr-3 py-2 w-full text-xs border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary rounded-md bg-white text-on-surface"
            />
          </div>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <select
              value={currentStudentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="pl-9 pr-8 py-2 w-full text-xs font-semibold border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary rounded-md bg-white text-on-surface"
              size={filteredStudents.length > 0 && studentSearch ? Math.min(filteredStudents.length + 1, 6) : 1}
            >
              {filteredStudents.length === 0 ? (
                <option disabled value="">No students match "{studentSearch}"</option>
              ) : (
                filteredStudents.map(student => (
                  <option key={student.id} value={student.id}>{student.name} ({student.id})</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Select Term */}
        <div className="w-full md:w-48 flex flex-col">
          <label className="text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider text-slate-500">Report Term</label>
          <select 
            value={currentTerm}
            onChange={(e) => handleTermChange(e.target.value)}
            className="px-3 py-2 w-full text-xs font-semibold border border-outline-variant focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary rounded-md bg-white pr-8 text-on-surface"
          >
            {["Term 1", "Term 2", "Term 3"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Main Printable Report visual component — hidden during bulk print */}
      <div className={printingClass ? 'print:hidden' : ''}>
      {activeStudent ? (
        <div className="bg-white border border-outline-variant p-8 rounded-2xl shadow-xs max-w-4xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0 font-sans text-on-surface">
          
          {/* Institution Crest Board Header */}
          <div className="flex justify-between items-start pb-6 border-b-2 border-primary-container">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded">EduAdmin Official Report</span>
              <h1 className="text-2xl font-black text-on-background tracking-tight">{schoolName}</h1>
              <p className="text-xs text-on-surface-variant font-medium">{regionalDivision}</p>
            </div>
            {/* Stamp Logo Mock */}
            <div className="w-14 h-14 bg-[#2563eb] rounded-full text-white flex flex-col items-center justify-center border-4 border-primary-fixed shrink-0 shadow-xs">
              <Stamp className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface-container-low/50 p-4 rounded-xl text-xs font-medium border border-outline-variant/60">
            <div className="space-y-0.5">
              <span className="text-on-surface-variant text-[10px] uppercase">Student Name:</span>
              <p className="font-bold text-sm text-on-background">{activeStudent.name}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-on-surface-variant text-[10px] uppercase">Student ID:</span>
              <p className="font-bold text-sm text-[#2563eb]">{activeStudent.id}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-on-surface-variant text-[10px] uppercase">Enrolled Class:</span>
              <p className="font-bold text-sm text-on-background">{activeStudent.classId}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-on-surface-variant text-[10px] uppercase">Evaluation Period:</span>
              <p className="font-bold text-sm text-on-background">{currentTerm} ({academicYear})</p>
            </div>
          </div>

          {/* Academic Report Card Table Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-outline-variant text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant font-bold text-on-surface-variant uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 border-r border-outline-variant bg-surface-container-low text-on-background">Subject</th>
                  {assessmentColumns.map(col => (
                    <th key={col.id} className="px-3 py-3 text-center border-r border-outline-variant font-bold">{col.name}</th>
                  ))}
                  <th className="px-3 py-3 text-center border-r border-outline-variant bg-surface-container text-on-background">Total (100%)</th>
                  <th className="px-3 py-3 text-center border-r border-outline-variant bg-primary-container/10 text-primary">Grade</th>
                  <th className="px-4 py-3">Teacher's Observations &amp; Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/70 text-on-surface bg-white">
                {reportRows.map(row => (
                  <tr key={row.subject} className="hover:bg-linear-to-r hover:from-slate-50 hover:to-white transition-colors">
                    <td className="px-4 py-3 font-bold text-on-background border-r border-outline-variant">{row.subject}</td>
                    {assessmentColumns.map(col => (
                      <td key={col.id} className="px-3 py-3 text-center border-r border-outline-variant font-medium text-secondary">
                        {row.scoresMap[col.id] !== undefined && row.scoresMap[col.id] !== null ? row.scoresMap[col.id] : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center border-r border-outline-variant font-extrabold text-on-background bg-slate-50/70">{row.hasValue ? `${row.total}%` : '-'}</td>
                    <td className="px-3 py-3 text-center border-r border-outline-variant bg-primary-container/[0.02] font-black text-primary">{row.hasValue ? row.grade : '-'}</td>
                    <td className="px-4 py-3 text-on-surface-variant italic leading-normal text-[11px] font-medium max-w-[280px]">
                      {row.hasValue ? row.remark : <span className="text-amber-600 font-bold bg-amber-50 px-1 rounded">No evaluation metrics recorded yet.</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Academic averages KPIs footer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-outline-variant">
            <div className="p-3 bg-slate-50 border border-outline-variant/60 rounded-xl space-y-1 text-center">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Completed Courses</span>
              <p className="text-xl font-black text-on-background">{subjectsCount} Subjects</p>
            </div>
            <div className="p-3 bg-primary-container/5 border border-primary/10 rounded-xl space-y-1 text-center">
              <span className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wider block">Weighted Average</span>
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-2xl font-black text-[#2563eb] leading-none">{termAverage}%</p>
                <span className="text-xs font-bold text-green-700 bg-green-100 rounded-sm px-1.5 py-0.2">Grade {overallGrade}</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-outline-variant/60 rounded-xl space-y-1 text-center font-semibold">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Attendance Record</span>
              <p className="text-lg font-black text-slate-800 font-mono mt-0.5">
                {displayPresent}/{displayTotal} <span className="text-xs text-slate-500 font-normal">Days</span>
              </p>
              <div className="text-[10px] text-[#2563eb] bg-blue-50 border border-blue-100 py-0.5 px-1.5 rounded inline-block font-black mt-1">
                {displayPercent}% Presence {isFallbackAttendance && '(Fallback)'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-outline-variant/60 rounded-xl space-y-1 text-center font-semibold">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Promotional Standing</span>
              <p className="text-sm font-bold text-green-700 flex items-center justify-center gap-1 mt-1 bg-green-50 border border-green-100 py-1.5 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Good Standing</span>
              </p>
            </div>
          </div>

          {/* Class Teacher's Remarks & Conduct Evaluation */}
          <div className="p-4 bg-slate-50 border border-outline-variant rounded-xl space-y-1.5 text-xs text-on-surface-variant text-left">
            <h4 className="font-extrabold text-[#2563eb] text-[10px] uppercase tracking-wider border-b border-outline-variant/60 pb-1.5 flex justify-between items-center">
              <span>Section: Class Teacher's Remarks</span>
              <span className="font-mono text-[11px] text-slate-700 bg-slate-200/50 px-2.5 py-0.5 rounded-sm normal-case font-bold">
                Assigned Instructor: {classTeacherName}
              </span>
            </h4>
            <div className="space-y-1">
              <span className="text-[9px] uppercase text-slate-500 font-extrabold">General Conduct &amp; Progress Opinion:</span>
              <p className="font-semibold text-slate-800 italic">
                Demonstrates polite behaviour, keen administrative cooperation, and respectable academic attention. Keeps a commendable standing throughout the {currentTerm} period.
              </p>
            </div>
          </div>

          {/* Teacher Signature Lines footer */}
          <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs text-on-surface-variant font-medium">
            <div className="space-y-1">
              <div className="border-b border-outline-variant pb-2 font-mono h-6 text-[#2563eb] flex justify-center items-end text-[11.5px] select-none font-bold">
                {classTeacherName}
              </div>
              <p className="font-bold text-[10px] uppercase">Class Instructor Lead Remarks Stamp</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-outline-variant pb-2 font-mono h-6 text-[#2563eb] flex justify-center items-end text-[11px] select-none font-bold lowercase">{registrarKey} / {registrarName}</div>
              <p className="font-bold text-[10px] uppercase">District Registrar Auths Seal</p>
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-20 text-on-surface-variant text-sm">
          No registered cohort students retrieved for progress summaries.
        </div>
      )}
      </div>

      {/* ── Bulk Print Section — hidden on screen, rendered for print ─────────── */}
      {printingClass && (() => {
        const classStudents = enrolledStudents.filter(s => s.classId === printingClass);
        return (
          <div className="hidden print:block">
            {classStudents.map((student, idx) => {
              const studentTermScoresBulk = scores.filter(
                s => s.studentId === student.id && s.termId === currentTerm
              );
              let totalBulk = 0;
              let countBulk = 0;
              let passBulk = 0;
              const rowsBulk = subjects.map(subj => {
                const sc = studentTermScoresBulk.find(s => s.subjectId === subj) || {
                  studentId: student.id, subjectId: subj, termId: currentTerm
                };
                const hasVal = assessmentColumns.some(col => sc[col.id] !== undefined && sc[col.id] !== null);
                const tot = calculateStudentTotal(sc, assessmentColumns);
                const gr = calculateGrade(tot);
                if (hasVal) { totalBulk += tot; countBulk++; if (tot >= 45) passBulk++; }
                return { subj, sc, tot, gr, remark: generateRemarks(gr), hasVal };
              });
              const termAvgBulk = countBulk > 0 ? Math.round(totalBulk / countBulk) : 0;
              const overallGradeBulk = calculateGrade(termAvgBulk);
              const teacher = staffRecords.find(s => s.staffCategory === 'Teaching' && s.assignedClass === student.classId);
              const teacherName = teacher ? teacher.fullName : 'Class Instructor';

              return (
                <div
                  key={student.id}
                  className={`bg-white p-8 font-sans text-on-surface ${idx < classStudents.length - 1 ? 'break-after-page' : ''}`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start pb-6 border-b-2 border-[#2563eb]/30">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-extrabold text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded">EduAdmin Official Report</span>
                      <h1 className="text-2xl font-black tracking-tight">{schoolName}</h1>
                      <p className="text-xs text-slate-500 font-medium">{regionalDivision}</p>
                    </div>
                    <div className="w-14 h-14 bg-[#2563eb] rounded-full text-white flex flex-col items-center justify-center border-4 border-blue-200 shrink-0">
                      <Stamp className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Student meta */}
                  <div className="grid grid-cols-4 gap-4 my-4 bg-slate-50 p-4 rounded-xl text-xs font-medium border border-slate-200">
                    <div><span className="text-slate-400 text-[10px] uppercase">Student Name:</span><p className="font-bold text-sm">{student.name}</p></div>
                    <div><span className="text-slate-400 text-[10px] uppercase">Student ID:</span><p className="font-bold text-sm text-[#2563eb]">{student.id}</p></div>
                    <div><span className="text-slate-400 text-[10px] uppercase">Enrolled Class:</span><p className="font-bold text-sm">{student.classId}</p></div>
                    <div><span className="text-slate-400 text-[10px] uppercase">Evaluation Period:</span><p className="font-bold text-sm">{currentTerm} ({academicYear})</p></div>
                  </div>

                  {/* Scores table */}
                  <table className="w-full text-left border-collapse border border-slate-200 text-xs mb-4">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3 border-r border-slate-200">Subject</th>
                        {assessmentColumns.map(col => (
                          <th key={col.id} className="px-3 py-3 text-center border-r border-slate-200">{col.name}</th>
                        ))}
                        <th className="px-3 py-3 text-center border-r border-slate-200">Total</th>
                        <th className="px-3 py-3 text-center border-r border-slate-200">Grade</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsBulk.map(({ subj, sc, tot, gr, remark, hasVal }) => (
                        <tr key={subj} className="border-b border-slate-100">
                          <td className="px-4 py-2.5 border-r border-slate-100 font-semibold">{subj}</td>
                          {assessmentColumns.map(col => (
                            <td key={col.id} className="px-3 py-2.5 text-center border-r border-slate-100">
                              {hasVal && sc[col.id] !== undefined ? sc[col.id] : '—'}
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 font-bold">{hasVal ? tot : '—'}</td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-100 font-bold text-[#2563eb]">{hasVal ? gr : '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500 italic text-[11px]">{hasVal ? remark : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 text-xs mb-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">Term Average</p>
                      <p className="text-2xl font-black text-[#2563eb]">{termAvgBulk}%</p>
                      <p className="font-bold text-slate-700">{overallGradeBulk}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">Subjects Passed</p>
                      <p className="text-2xl font-black text-green-600">{passBulk}/{subjects.length}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">Academic Year</p>
                      <p className="text-sm font-black text-slate-700">{academicYear}</p>
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="pt-6 grid grid-cols-2 gap-12 text-center text-xs text-slate-500 font-medium">
                    <div><div className="border-b border-slate-200 pb-2 font-mono h-6 text-[#2563eb] flex justify-center items-end text-[11.5px] font-bold">{teacherName}</div>
                      <p className="font-bold text-[10px] uppercase mt-1">Class Instructor Lead Remarks Stamp</p></div>
                    <div><div className="border-b border-slate-200 pb-2 font-mono h-6 text-[#2563eb] flex justify-center items-end text-[11px] font-bold lowercase">{registrarKey} / {registrarName}</div>
                      <p className="font-bold text-[10px] uppercase mt-1">District Registrar Auths Seal</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
