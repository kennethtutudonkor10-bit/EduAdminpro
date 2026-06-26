/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Save, 
  Wand2,
  Lock, 
  Unlock,
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Download,
  Terminal,
  ChevronRight,
  CheckSquare,
  X,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sliders
} from 'lucide-react';
import { Student, Score, ValidationLog, AssessmentColumn } from '../types';
import { 
  calculateStudentTotal, 
  calculateGrade, 
  getGradeBadgeColors, 
  calculateRankPositions,
  terms,
  classes,
  generateRemarks
} from '../data';

interface GradebookViewProps {
  students: Student[];
  scores: Score[];
  onUpdateScore: (updatedScore: Score) => void;
  onBatchFillRemarks: (subject: string, term: string, classId: string) => void;
  caWeight: number;
  examWeight: number;
  isGradesLocked: boolean;
  onToggleGradesLock: () => void;
  activeSubject: string;
  setActiveSubject: (subject: string) => void;
  activeTerm: string;
  setActiveTerm: (term: string) => void;
  activeClass: string;
  setActiveClass: (classId: string) => void;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
  onNavigateToReportCard: (studentId: string, termId: string) => void;
  isPremiumUser?: boolean;
  onTriggerUpgradeModal?: () => void;
  
  // Custom Dynamic Customizers Props
  subjects: string[];
  assessmentColumns: AssessmentColumn[];

  isReadOnly?: boolean;
  onSaveSnapshot?: () => void;
  snapshots?: Record<string, any>;
  onRestoreSnapshot?: (sessionKey: string) => void;
  selectedAcademicYear?: string;
  onNavigateToReports?: () => void;
  onCustomizeSubjects?: () => void;
}

export default function GradebookView({
  students,
  scores,
  onUpdateScore,
  onBatchFillRemarks,
  caWeight,
  examWeight,
  isGradesLocked,
  onToggleGradesLock,
  activeSubject,
  setActiveSubject,
  activeTerm,
  setActiveTerm,
  activeClass,
  setActiveClass,
  onTriggerToast,
  onNavigateToReportCard,
  isPremiumUser = false,
  onTriggerUpgradeModal,
  subjects,
  assessmentColumns,
  isReadOnly = false,
  onSaveSnapshot,
  snapshots = {},
  onRestoreSnapshot,
  selectedAcademicYear = '2025-2026',
  onNavigateToReports,
  onCustomizeSubjects
}: GradebookViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showHotkeyHint, setShowHotkeyHint] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal confirmation states
  const [isConfirmCommitOpen, setIsConfirmCommitOpen] = useState(false);
  const [isConfirmBatchRemarksOpen, setIsConfirmBatchRemarksOpen] = useState(false);

  // Sorting states
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'grade' | null>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'name' | 'total' | 'grade') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Filter study cohorts
  const activeClassStudents = students.filter(
    s => s.classId === activeClass && (s.status === 'Enrolled' || s.status === 'Suspended')
  );

  const searchedStudents = activeClassStudents.filter(s => {
    const query = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
  });

  // Calculate ranks positions dynamically
  const activeStudentIds = activeClassStudents.map(s => s.id);
  const studentRanks = calculateRankPositions(
    activeStudentIds, 
    scores, 
    activeSubject, 
    activeTerm,
    assessmentColumns
  );

  // Apply sorting routine
  const sortedStudents = [...searchedStudents].sort((a, b) => {
    if (!sortBy) return 0;

    if (sortBy === 'name') {
      const valA = a.name.toLowerCase();
      const valB = b.name.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }

    if (sortBy === 'total') {
      const scoreA = scores.find(
        s => s.studentId === a.id && s.subjectId === activeSubject && s.termId === activeTerm
      ) || {
        studentId: a.id,
        subjectId: activeSubject,
        termId: activeTerm
      };
      const totalA = calculateStudentTotal(scoreA, assessmentColumns);

      const scoreB = scores.find(
        s => s.studentId === b.id && s.subjectId === activeSubject && s.termId === activeTerm
      ) || {
        studentId: b.id,
        subjectId: activeSubject,
        termId: activeTerm
      };
      const totalB = calculateStudentTotal(scoreB, assessmentColumns);

      return sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
    }

    if (sortBy === 'grade') {
      const scoreA = scores.find(
        s => s.studentId === a.id && s.subjectId === activeSubject && s.termId === activeTerm
      ) || {
        studentId: a.id,
        subjectId: activeSubject,
        termId: activeTerm
      };
      const totalA = calculateStudentTotal(scoreA, assessmentColumns);
      const gradeA = calculateGrade(totalA);

      const scoreB = scores.find(
        s => s.studentId === b.id && s.subjectId === activeSubject && s.termId === activeTerm
      ) || {
        studentId: b.id,
        subjectId: activeSubject,
        termId: activeTerm
      };
      const totalB = calculateStudentTotal(scoreB, assessmentColumns);
      const gradeB = calculateGrade(totalB);

      if (gradeA < gradeB) return sortOrder === 'asc' ? -1 : 1;
      if (gradeA > gradeB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }

    return 0;
  });

  // Auto-saving feedback loop updates
  const handleScoreChange = (
    studentId: string, 
    field: string, 
    rawVal: string,
    maxScore: number
  ) => {
    if (isReadOnly) {
      onTriggerToast("Historical records are Read-Only under write-protection.", "error");
      return;
    }
    if (isGradesLocked) {
      onTriggerToast("Academic records are currently locked by District Registry.", "error");
      return;
    }

    // Parse value (clamp between 0 and dynamic maxScore)
    let parsed: number | null = null;
    if (rawVal.trim() !== '') {
      const num = parseFloat(rawVal);
      if (isNaN(num)) return;
      parsed = Math.max(0, Math.min(maxScore, num));
    }

    // Find if score exists, otherwise create shell
    const existing = scores.find(
      s => s.studentId === studentId && s.subjectId === activeSubject && s.termId === activeTerm
    ) || {
      studentId,
      subjectId: activeSubject,
      termId: activeTerm
    };

    const updated: Score = {
      ...existing,
      [field]: parsed
    };

    onUpdateScore(updated);

    // Trigger visual auto-saving status simulation
    setIsAutoSaving(true);
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    savingTimeoutRef.current = setTimeout(() => {
      setIsAutoSaving(false);
    }, 1200);
  };

  // Keyboard navigation for spreadsheet matrix
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: string,
    colId: string
  ) => {
    const studentIdx = sortedStudents.findIndex(s => s.id === studentId);
    if (studentIdx === -1) return;

    const colIdx = assessmentColumns.findIndex(c => c.id === colId);
    if (colIdx === -1) return;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (studentIdx < sortedStudents.length - 1) {
        const nextStudent = sortedStudents[studentIdx + 1];
        const nextInput = document.getElementById(`score-input-${nextStudent.id}-${colId}`);
        if (nextInput) {
          nextInput.focus();
          if (nextInput instanceof HTMLInputElement) {
            nextInput.select();
          }
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (studentIdx > 0) {
        const prevStudent = sortedStudents[studentIdx - 1];
        const prevInput = document.getElementById(`score-input-${prevStudent.id}-${colId}`);
        if (prevInput) {
          prevInput.focus();
          if (prevInput instanceof HTMLInputElement) {
            prevInput.select();
          }
        }
      }
    } else if (e.key === 'ArrowRight') {
      const inputEl = e.currentTarget;
      if (inputEl.selectionEnd === inputEl.value.length) {
        if (colIdx < assessmentColumns.length - 1) {
          e.preventDefault();
          const nextCol = assessmentColumns[colIdx + 1];
          const nextInput = document.getElementById(`score-input-${studentId}-${nextCol.id}`);
          if (nextInput) {
            nextInput.focus();
            if (nextInput instanceof HTMLInputElement) {
              nextInput.select();
            }
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const inputEl = e.currentTarget;
      if (inputEl.selectionStart === 0) {
        if (colIdx > 0) {
          e.preventDefault();
          const prevCol = assessmentColumns[colIdx - 1];
          const prevInput = document.getElementById(`score-input-${studentId}-${prevCol.id}`);
          if (prevInput) {
            prevInput.focus();
            if (prevInput instanceof HTMLInputElement) {
              prevInput.select();
            }
          }
        }
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    };
  }, []);

  // Compute validation warnings in real-time
  const missingScoreWarnings: { studentId: string; missingFields: string[] }[] = [];
  activeClassStudents.forEach(student => {
    const studentScore = scores.find(
      s => s.studentId === student.id && s.subjectId === activeSubject && s.termId === activeTerm
    );
    const missing: string[] = [];
    if (!studentScore) {
      missing.push("All scores");
    } else {
      assessmentColumns.forEach(col => {
        if (studentScore[col.id] === undefined || studentScore[col.id] === null) {
          missing.push(col.name);
        }
      });
    }

    if (missing.length > 0) {
      missingScoreWarnings.push({ studentId: student.id, missingFields: missing });
    }
  });

  // Export functions simulation
  const handleExport = (type: string) => {
    onTriggerToast(`Structuring compiled report database sheet to download as ${type}...`, 'info');
    setTimeout(() => {
      onTriggerToast(`Export complete: ${activeClass}_${activeSubject}_${activeTerm}.${type.toLowerCase()} generated successfully.`, 'success');
    }, 1500);
  };

  const handleCommitChangesTrigger = () => {
    setIsConfirmCommitOpen(true);
  };

  const handleConfirmCommit = () => {
    setIsConfirmCommitOpen(false);
    onTriggerToast("Committing grades to master storage. Ranks, totals and records successfully synchronized & locked.", "success");
  };

  const handleBatchRemarksTrigger = () => {
    setIsConfirmBatchRemarksOpen(true);
  };

  const handleConfirmBatchRemarks = () => {
    setIsConfirmBatchRemarksOpen(false);
    onBatchFillRemarks(activeSubject, activeTerm, activeClass);
  };

  return (
    <div id="gradebook-layout-split" className="flex-1 flex flex-col md:flex-row min-w-0 h-full overflow-hidden text-on-surface">
      {/* Scrollable Gradebook Spreadsheet Section */}
      <section className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative border-r border-[#e2e8f0]">
        
        {/* Filter Controls & Action Bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-[#e2e8f0] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-4 min-w-0">
            <div className="flex flex-col">
              <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase text-[10px] tracking-wider font-extrabold text-slate-500">Subject</label>
              <div className="flex items-center gap-1.5">
                <select 
                  value={activeSubject}
                  onChange={(e) => setActiveSubject(e.target.value)}
                  className="text-body-sm font-bold border border-outline-variant rounded p-1.5 focus:ring-1 focus:ring-primary focus:border-primary transition-colors bg-white pr-8 text-on-surface focus:outline-hidden"
                >
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  {subjects.length === 0 && <option value="">No custom subjects</option>}
                </select>
                {onCustomizeSubjects && (
                  <button
                    onClick={onCustomizeSubjects}
                    className="p-1.5 border border-slate-200 hover:border-primary text-slate-500 hover:text-primary transition-all rounded-lg bg-slate-50 hover:bg-white cursor-pointer"
                    title="Customize subjects by academic tier"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase text-[10px] tracking-wider font-extrabold font-sans text-slate-500">Term</label>
              <select 
                value={activeTerm}
                onChange={(e) => setActiveTerm(e.target.value)}
                className="text-body-sm font-bold border border-outline-variant rounded p-1.5 focus:ring-1 focus:ring-primary focus:border-primary transition-colors bg-white pr-8 text-on-surface focus:outline-hidden"
              >
                {terms.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase text-[10px] tracking-wider font-extrabold text-slate-500">Class</label>
              <select 
                value={activeClass}
                onChange={(e) => setActiveClass(e.target.value)}
                className="text-body-sm font-bold border border-outline-variant rounded p-1.5 focus:ring-1 focus:ring-primary focus:border-primary transition-colors bg-white pr-8 text-on-surface focus:outline-hidden"
              >
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isReadOnly ? (
              <span className="text-xs bg-amber-50 text-amber-800 border-amber-250 border px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 leading-none select-none">
                <span>🔒 Historical Read-Only View</span>
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs text-on-surface-variant font-medium px-3 py-1.5 rounded-md border transition-all ${
                  isAutoSaving 
                    ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' 
                    : 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                }`}>
                  {isAutoSaving ? 'Auto-saving...' : 'Synced to Cloud'}
                </span>
                <button 
                  onClick={handleCommitChangesTrigger}
                  className="theme-bg-accent theme-text-accent-contrast theme-bg-accent-hover px-4 py-2 rounded-lg font-bold text-body-sm flex items-center gap-2 transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Commit Changes</span>
                </button>
                {onSaveSnapshot && (
                  <button 
                    onClick={onSaveSnapshot}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-body-sm flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                    title="Archive current customized subjects, marks matrices, and student datasets permanently to snapshot directories."
                  >
                    <span>💾 Save Term Record Snapshot</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isReadOnly && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-amber-900 animate-fade-in" id="gradebook-readonly-banner">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-sm">📜</span>
              <span>
                <strong>Historical Record Mode:</strong> This completed session ({selectedAcademicYear} {activeTerm}) is protected under write-protection.
              </span>
            </div>
            <button
              onClick={() => {
                if (onNavigateToReports) {
                  onNavigateToReports();
                }
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10.5px] uppercase transition-all shadow-xs flex items-center gap-1 shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export / Reprint Old Reports</span>
            </button>
          </div>
        )}

        {/* Searching Utility Bar inside Table view */}
        <div className="px-6 py-2.5 bg-surface-container-low/70 border-b border-outline-variant flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active cohort..."
              className="pl-9 pr-4 py-1.5 bg-white border border-outline-variant rounded-lg text-xs w-full focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-hidden text-on-surface placeholder:text-outline font-semibold"
              type="text"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-secondary font-semibold hidden md:block">
              Displaying <span className="text-on-surface font-extrabold">{searchedStudents.length}</span> of {activeClassStudents.length} cohort students
            </p>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 hover:border-primary shadow-xs cursor-pointer select-none"
              title={isSidebarCollapsed ? "Expand Bulk Actions sidebar" : "Hide Bulk Actions sidebar to expand spreadsheet"}
            >
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span>{isSidebarCollapsed ? "Show Actions" : "Full Screen Grid"}</span>
            </button>
          </div>
        </div>

        {/* Dense Spreadsheet Table */}
        <div className="overflow-x-auto overflow-y-auto max-w-full flex-1 bg-white relative min-h-0" id="grading-table-container">
          {searchedStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
              <Search className="w-12 h-12 text-outline mb-3 opacity-60" />
              <h3 className="text-lg font-bold text-on-background">No records match search parameters</h3>
              <p className="text-sm text-secondary mt-1">Refine your active filters or registration details.</p>
            </div>
          ) : (
            <table className="w-full border-collapse table-fixed min-w-[1000px] text-left">
              <thead className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] shadow-xs">
                <tr>
                  <th className="w-24 px-4 py-3 text-left font-table-header text-table-header border-r border-[#e2e8f0] bg-[#f8fafc] fixed-column-first text-on-background font-bold tracking-tight">ID</th>
                  <th 
                    onClick={() => toggleSort('name')}
                    className="w-60 px-4 py-3 text-left font-table-header text-table-header border-r border-[#e2e8f0] bg-[#f8fafc] text-on-background font-bold tracking-tight cursor-pointer hover:bg-slate-50 transition-colors select-none group/th"
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span>Student Name</span>
                      {sortBy === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#2563eb]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#2563eb]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-outline opacity-0 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  
                  {/* Dynamic Category header group span */}
                  <th className="px-3 py-3 text-center border-r border-[#e2e8f0] bg-[#e2e8f0] text-slate-800 font-extrabold text-[11px] uppercase tracking-wider" colSpan={assessmentColumns.length}>
                    Assessment Score Breakdowns
                  </th>
 
                  {/* Calculated metrics headers */}
                  <th 
                    onClick={() => toggleSort('total')}
                    className="w-24 px-3 py-3 text-center border-r border-[#e2e8f0] bg-[#f1f5f9] text-on-background font-bold tracking-tight cursor-pointer hover:bg-slate-200 transition-colors select-none group/th"
                  >
                    <div className="flex items-center gap-1 justify-center">
                      <span>Total (100%)</span>
                      {sortBy === 'total' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#2563eb]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#2563eb]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-outline opacity-0 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('grade')}
                    className="w-24 px-3 py-3 text-center border-r border-[#e2e8f0] bg-[#f1f5f9] text-on-background font-bold tracking-tight cursor-pointer hover:bg-slate-200 transition-colors select-none group/th"
                  >
                    <div className="flex items-center gap-1 justify-center">
                      <span>Grade</span>
                      {sortBy === 'grade' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#2563eb]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#2563eb]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-outline opacity-0 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="w-20 px-3 py-3 text-center border-r border-[#e2e8f0] bg-[#f1f5f9] text-on-background font-bold tracking-tight">Rank</th>
                  <th className="w-28 px-3 py-3 text-center bg-[#f1f5f9] text-on-background font-bold tracking-tight">Reports</th>
                </tr>
 
                {/* Sub row headers mapping custom assessmentColumns dynamically */}
                <tr className="bg-[#f1f5f9] text-[10px] uppercase font-bold text-slate-700 border-b border-[#e2e8f0]">
                  <th className="border-r border-[#e2e8f0] fixed-column-first bg-[#f1f5f9]"></th>
                  <th className="border-r border-[#e2e8f0] bg-[#f1f5f9]"></th>
                  
                  {/* Custom Assessment Columns subheaders */}
                  {assessmentColumns.map(col => (
                    <th key={col.id} className="w-24 border-r border-[#e2e8f0] px-1.5 py-2 bg-slate-50 text-slate-700">
                      <div className="flex flex-col items-center justify-center leading-3 font-sans">
                        <span className="truncate max-w-[85px] block font-black" title={col.name}>{col.name}</span>
                        <span className="text-[8px] text-zinc-500 font-normal mt-0.5 font-mono block">Max: {col.maxScore}</span>
                      </div>
                    </th>
                  ))}
                  
                  {/* Calculated summary outputs */}
                  <th 
                    onClick={() => toggleSort('total')}
                    className="border-r border-[#e2e8f0] text-center bg-[#f1f5f9] cursor-pointer hover:bg-slate-200 transition-colors select-none font-bold group/sub"
                  >
                    <div className="flex items-center gap-1 justify-center">
                      <span>Score</span>
                      {sortBy === 'total' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-[#2563eb]" /> : <ArrowDown className="w-2.5 h-2.5 text-[#2563eb]" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-outline opacity-0 group-hover/sub:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('grade')}
                    className="border-r border-[#e2e8f0] text-center bg-[#f1f5f9] cursor-pointer hover:bg-slate-200 transition-colors select-none font-bold group/sub"
                  >
                    <div className="flex items-center gap-1 justify-center">
                      <span>A-F</span>
                      {sortBy === 'grade' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-[#2563eb]" /> : <ArrowDown className="w-2.5 h-2.5 text-[#2563eb]" />
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-outline opacity-0 group-hover/sub:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="border-r border-[#e2e8f0] text-center bg-[#f1f5f9]">Pos</th>
                  <th className="text-center bg-[#f1f5f9]">PDF</th>
                </tr>
              </thead>
              
              <tbody className="bg-white font-table-data text-table-data relative divide-y divide-outline-variant/70">
                {sortedStudents.map(student => {
                  const score = scores.find(
                    s => s.studentId === student.id && s.subjectId === activeSubject && s.termId === activeTerm
                  ) || {
                    studentId: student.id,
                    subjectId: activeSubject,
                    termId: activeTerm
                  };

                  const total = calculateStudentTotal(score, assessmentColumns);
                  const grade = calculateGrade(total);
                  const badgeColors = getGradeBadgeColors(grade);
                  const rank = studentRanks[student.id] || "N/A";

                  return (
                    <tr 
                      key={student.id} 
                      className="zebra-row group hover:bg-surface-container-lowest/80 relative"
                    >
                      {/* ID sticky column */}
                      <td className="fixed-column-first px-4 py-2.5 border-r border-b border-outline-variant font-bold text-[#2563eb] group-hover:bg-linear-to-r group-hover:from-surface-container/20 group-hover:to-surface-container-low transition-colors select-none">
                        {student.id}
                      </td>

                      {/* Name column */}
                      <td className="px-4 py-2.5 border-r border-b border-outline-variant font-semibold text-on-background bg-white group-hover:bg-surface-container-low/20 transition-colors">
                        <div className="flex flex-col">
                          <span>{student.name}</span>
                          {student.status === 'Suspended' && (
                            <span className="text-[9px] text-red-600 font-bold bg-red-50 self-start px-1 rounded">Suspended</span>
                          )}
                        </div>
                      </td>

                      {/* Dynamic columns Inputs */}
                      {assessmentColumns.map(col => {
                        const scoreVal = score[col.id];
                        return (
                          <td key={col.id} className="border-r border-b border-outline-variant p-0 bg-white w-24">
                            {isPremiumUser ? (
                              <input
                                id={`score-input-${student.id}-${col.id}`}
                                title={`${col.name} score for ${student.name}`}
                                type="number"
                                value={scoreVal ?? ''}
                                disabled={isGradesLocked || isReadOnly}
                                onFocus={(e) => {
                                  setShowHotkeyHint(true);
                                  e.currentTarget.select();
                                }}
                                onBlur={() => setShowHotkeyHint(false)}
                                onKeyDown={(e) => handleKeyDown(e, student.id, col.id)}
                                onChange={(e) => handleScoreChange(student.id, col.id, e.target.value, col.maxScore)}
                                className="matrix-input w-full h-full border-0 focus:outline-0 focus:ring-0 px-2.5 py-2.5 text-center text-table-data text-on-surface bg-transparent focus:bg-primary-container/[0.04] transition-colors font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-hidden"
                                placeholder="-"
                                max={col.maxScore}
                                min={0}
                              />
                            ) : (
                              <div
                                onClick={onTriggerUpgradeModal}
                                className="w-full h-full min-h-[36px] bg-slate-50/70 hover:bg-slate-100/90 text-slate-400 font-bold transition-all flex items-center justify-center cursor-pointer select-none font-mono"
                                title="🔒 Unlock Premium Gradebook to edit score matrices"
                              >
                                <span className="text-[10px] flex items-center gap-0.5">🔒 {scoreVal ?? '-'}</span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Auto calculated total out of 105 or columns max aggregate */}
                      <td className="px-3 py-2.5 border-r border-b border-outline-variant text-center font-bold text-on-background bg-slate-50/50">
                        {total}%
                      </td>

                      {/* Calculated Grade Badge */}
                      <td className="px-3 py-2.5 border-r border-b border-outline-variant text-center bg-slate-50/50">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeColors.bg}`} style={{ color: badgeColors.text }}>
                          {grade}
                        </span>
                      </td>

                      {/* Weighted Rank Position */}
                      <td className="px-3 py-2.5 border-r border-b border-outline-variant text-center text-on-surface-variant italic font-semibold bg-slate-50/50">
                        {rank}
                      </td>

                      {/* Print Report Card Shortcut Button */}
                      <td className="px-3 py-2 border-b border-outline-variant text-center bg-slate-50/50">
                        <button
                          onClick={() => {
                            if (!isPremiumUser) {
                              if (onTriggerUpgradeModal) onTriggerUpgradeModal();
                            } else {
                              onNavigateToReportCard(student.id, activeTerm);
                            }
                          }}
                          className={`px-3 py-1 font-bold text-[10.5px] rounded border transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto ${
                            isPremiumUser
                              ? "bg-white hover:bg-primary/5 text-[#2563eb] border-primary/25 hover:border-primary/60 shadow-xs"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200"
                          }`}
                          title={isPremiumUser ? `Print Report Card for ${student.name}` : "🔒 Unlock Premium to Print Report"}
                        >
                          {isPremiumUser ? (
                            <Printer className="w-3 h-3 text-[#2563eb]" />
                          ) : (
                            <span className="text-[9px]">🔒</span>
                          )}
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Hotkey Visual Helper Overlay Overlay */}
        <div className={`fixed bottom-6 right-84 bg-on-background text-[11px] text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-3 transition-all duration-300 z-50 ${
          showHotkeyHint ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <span className="flex items-center gap-1">
            <kbd className="bg-white/25 px-1 rounded text-[10px] font-bold">Tab</kbd> Move Next Cell
          </span>
          <span className="w-1 h-1 rounded-full bg-white/35"></span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white/25 px-1 rounded text-[10px] font-bold">Shift+Tab</kbd> Previous Cell
          </span>
          <span className="w-1 h-1 rounded-full bg-white/35"></span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white/25 px-1 rounded text-[10px] font-bold">Enter</kbd> Focus Below Row
          </span>
        </div>
      </section>

      {/* Side Control Actions & Validation Logs Panel (Right Side, matching layout details carefully) */}
      {!isSidebarCollapsed && (
        <aside className="w-full md:w-80 bg-surface-container-lowest border-t md:border-t-0 border-l border-outline-variant flex flex-col shrink-0 text-on-surface animate-fade-in">
        
        {/* Section Header */}
        <div className="p-5 border-b border-outline-variant bg-surface-container-low">
          <h3 className="font-title-sm text-title-sm font-bold text-on-surface">Bulk Actions</h3>
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1 text-slate-500">Terminal Controls</p>
        </div>

        {/* Content Scrolling Pane */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          
          {/* Action Module 1: Batch Comment Filling */}
          <div className="space-y-2">
            <button 
              onClick={isReadOnly ? () => onTriggerToast("Remarks generation is disabled in Read-Only historical archives.", "error") : handleBatchRemarksTrigger}
              disabled={isReadOnly}
              className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg transition-colors group ${
                isReadOnly 
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200' 
                  : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wand2 className="w-4 h-4 text-[#2563eb]" />
                <span className="font-body-md font-medium text-on-surface text-sm">Batch Fill Remarks</span>
              </div>
              <ChevronRight className="w-4 h-4 text-outline group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="px-2 text-[11px] text-on-surface-variant leading-relaxed">
              Auto-generate teacher commentary reports based on grade boundaries and thresholds.
            </p>
          </div>

          {/* Action Module 2: Locking records */}
          <div className="space-y-2">
            <button 
              onClick={isReadOnly ? () => onTriggerToast("Registry sealing is disabled in Read-Only historical archives.", "error") : onToggleGradesLock}
              disabled={isReadOnly}
              className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg transition-all ${
                isReadOnly 
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' 
                  : isGradesLocked 
                    ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 font-bold shadow-xs cursor-pointer'
                    : 'bg-red-50/40 hover:bg-red-50/80 border-red-100/55 text-red-900 group cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                {isGradesLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-red-650 group-hover:scale-110 transition-transform" />}
                <span className="text-sm font-bold">{isGradesLocked ? "Unlock Gradebook" : "Lock Term Grades"}</span>
              </div>
              {isGradesLocked && <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider animate-pulse">Locked</span>}
            </button>
            <p className="px-2 text-[11px] text-on-surface-variant leading-relaxed">
              Seal assessments. Prevent further alterations and prepare datasets for reports cards generation.
            </p>
          </div>

          {/* Action Module 3: Live Verification Logs */}
          <div className="pt-6 border-t border-outline-variant space-y-3">
            <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-3 uppercase text-[10px] tracking-wider font-extrabold flex items-center gap-1.5 text-slate-500">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>Real-time Validation Audit</span>
            </h4>
            
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {missingScoreWarnings.map((log) => (
                <div 
                  key={log.studentId}
                  className="p-3 bg-red-50/[0.4] border border-red-100/60 rounded-lg flex items-start gap-2.5 text-[11px] text-red-950 font-medium"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-normal">
                    <span className="font-bold block text-red-900 bg-red-50 select-all px-1 self-start rounded w-fit text-[10px]">Student Registry ID: {log.studentId}</span>
                    <p>
                      Incomplete scorecard metrics detected. Missing columns: <span className="font-bold text-red-800">{log.missingFields.join(', ')}</span>.
                    </p>
                  </div>
                </div>
              ))}
              {missingScoreWarnings.length === 0 && (
                <div className="p-4 bg-green-50/55 border border-green-100 rounded-lg flex items-start gap-2.5 text-[11px] text-green-950 font-semibold text-center justify-center">
                  <CheckSquare className="w-4 h-4 text-green-700 shrink-0" />
                  <span>Cohort dataset verified error-free. Solid state.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Exporters, matching layout colors exactly */}
        <div className="p-5 bg-surface-container-low border-t border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <span className="text-body-sm font-medium text-xs text-on-surface-variant font-sans text-slate-500">Export Options</span>
            <Download className="w-4 h-4 text-outline" />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleExport('CSV')}
              className="flex-1 py-2 text-[10px] font-bold uppercase bg-surface-container-lowest hover:bg-white border border-outline-variant hover:border-primary transition-colors hover:text-primary rounded cursor-pointer select-none text-on-surface"
            >
              CSV
            </button>
            <button 
              onClick={() => handleExport('PDF')}
              className="flex-1 py-2 text-[10px] font-bold uppercase bg-surface-container-lowest hover:bg-white border border-outline-variant hover:border-primary transition-colors hover:text-primary rounded cursor-pointer select-none text-on-surface"
            >
              PDF
            </button>
            <button 
              onClick={() => handleExport('XLS')}
              className="flex-1 py-1.5 text-[10px] font-bold uppercase bg-surface-container-lowest hover:bg-white border border-outline-variant hover:border-primary transition-colors hover:text-primary rounded cursor-pointer select-none text-on-surface"
            >
              XLS
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* Custom Modal Confirmation: Commit Changes */}
      {isConfirmCommitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1d2d]/60 backdrop-blur-xs" id="commit-confirm-modal">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setIsConfirmCommitOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white border border-outline-variant max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 pb-4 flex items-start gap-4 border-b border-outline-variant/60">
              <div className="p-3 bg-[#2563eb]/10 rounded-xl text-[#2563eb] shrink-0">
                <Save className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-on-background">Commit Term Grades?</h3>
                <p className="text-xs text-on-surface-variant mt-1">Please confirm synchronization workflow for this cohort dataset.</p>
              </div>
              <button 
                onClick={() => setIsConfirmCommitOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="text-xs text-on-surface-variant leading-relaxed space-y-3">
                <p>
                  You are preparing to run a master record commit for the following academic catalog:
                </p>
                
                {/* Information Metadata Tag Table */}
                <div className="bg-slate-50 border border-outline-variant/60 rounded-xl p-3.5 space-y-2 font-semibold text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-outline">Active Subject:</span>
                    <span className="font-bold text-on-background">{activeSubject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Academic Term:</span>
                    <span className="font-bold text-on-background">{activeTerm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Student Class Cohort:</span>
                    <span className="font-bold text-on-background">{activeClass}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-outline font-sans">Custom Columns:</span>
                    <span className="text-[#2563eb] font-bold">{assessmentColumns.length} dynamic columns</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100/70 rounded-xl text-amber-900 flex gap-2.5 items-start">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium leading-relaxed">
                    Once committed, grades are locked and synced. This triggers live updates to terminal progress cards across all district access portals.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-outline-variant/60 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsConfirmCommitOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface border border-outline-variant hover:border-outline bg-white hover:bg-slate-100 transition-all cursor-pointer"
              >
                Discard &amp; Keep Editing
              </button>
              <button 
                onClick={handleConfirmCommit}
                className="px-4 py-2 rounded-lg text-xs font-bold theme-bg-accent theme-text-accent-contrast theme-bg-accent-hover transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Confirm Master Commit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal Confirmation: Batch Fill Remarks */}
      {isConfirmBatchRemarksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1d2d]/60 backdrop-blur-xs" id="batch-fill-confirm-modal">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setIsConfirmBatchRemarksOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white border border-outline-variant max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 pb-4 flex items-start gap-4 border-b border-outline-variant/60">
              <div className="p-3 bg-blue-50 rounded-xl text-[#2563eb] shrink-0">
                <Wand2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-on-background">Batch Generate Remarks?</h3>
                <p className="text-xs text-on-surface-variant mt-1">Automated commentary generation for academic reports.</p>
              </div>
              <button 
                onClick={() => setIsConfirmBatchRemarksOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="text-xs text-on-surface-variant leading-relaxed space-y-3">
                <p>
                  You are about to batch fill automated academic remarks for all active student profiles in this cohort:
                </p>
                
                {/* Specifics Info panel */}
                <div className="bg-slate-50 border border-outline-variant/60 rounded-xl p-3.5 space-y-2 font-semibold text-slate-700">
                  <div className="flex justify-between text-xs">
                    <span className="text-outline">Class Cohort:</span>
                    <span className="font-bold text-on-background">{activeClass}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-outline">Subject Unit:</span>
                    <span className="font-bold text-on-background">{activeSubject}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-outline">Term Index:</span>
                    <span className="font-bold text-on-background">{activeTerm}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-outline">Students Enrolled:</span>
                    <span className="font-bold text-on-background">{activeClassStudents.length} total affected</span>
                  </div>
                </div>

                <div className="p-3 bg-red-50 border border-red-100/75 rounded-xl text-red-900 flex gap-2.5 items-start">
                  <AlertTriangle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium leading-relaxed">
                    <strong>Critical Data-loss Warning:</strong> This operation completely overwrites any custom input or existing remarks that have been saved earlier for these student profiles in this term.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-outline-variant/60 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsConfirmBatchRemarksOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-outline hover:text-on-surface border border-outline-variant hover:border-outline bg-white hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmBatchRemarks}
                className="px-4 py-2 rounded-lg text-xs font-bold theme-bg-accent theme-text-accent-contrast theme-bg-accent-hover transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Batch Fill Remarks</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
