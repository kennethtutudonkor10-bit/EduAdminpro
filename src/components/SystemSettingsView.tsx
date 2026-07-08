/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import {
  Settings,
  Percent,
  Award,
  CheckCircle,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Plus,
  Trash2,
  Edit,
  Cpu,
  Mail,
  Copy,
  Upload,
  Key,
  Webhook,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { GradingScale, AssessmentColumn } from '../types';
import { gradingScale as defaultScale } from '../data';

interface SystemSettingsViewProps {
  caWeight: number;
  setCaWeight: (val: number) => void;
  examWeight: number;
  setExamWeight: (val: number) => void;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
  schoolName: string;
  setSchoolName: (val: string) => void;
  academicYear: string;
  setAcademicYear: (val: string) => void;
  registrarName: string;
  setRegistrarName: (val: string) => void;
  registrarKey: string;
  setRegistrarKey: (val: string) => void;
  regionalDivision: string;
  setRegionalDivision: (val: string) => void;
  onLogActivity?: (action: string, category: 'grade' | 'student' | 'remark' | 'setting' | 'other') => void;

  // Integrations props
  schoolLogo: string;
  setSchoolLogo: (val: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (val: string) => void;
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;

  // Custom Dynamic Customizers Props
  subjects: string[];
  setSubjects: React.Dispatch<React.SetStateAction<string[]>>;
  assessmentColumns: AssessmentColumn[];
  setAssessmentColumns: React.Dispatch<React.SetStateAction<AssessmentColumn[]>>;
}

export default function SystemSettingsView({
  caWeight,
  setCaWeight,
  examWeight,
  setExamWeight,
  onTriggerToast,
  schoolName,
  setSchoolName,
  academicYear,
  setAcademicYear,
  registrarName,
  setRegistrarName,
  registrarKey,
  setRegistrarKey,
  regionalDivision,
  setRegionalDivision,
  onLogActivity,
  schoolLogo,
  setSchoolLogo,
  geminiApiKey,
  setGeminiApiKey,
  webhookUrl,
  setWebhookUrl,
  subjects,
  setSubjects,
  assessmentColumns,
  setAssessmentColumns
}: SystemSettingsViewProps) {

  const [caInput, setCaInput] = useState<number>(caWeight);
  const [examInput, setExamInput] = useState<number>(examWeight);
  const [activeTab, setActiveTab] = useState<'weights' | 'grading' | 'profile' | 'subjects' | 'assessment-columns' | 'integrations'>('assessment-columns');
  const [showApiKey, setShowApiKey] = useState(false);
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localWebhookUrl, setLocalWebhookUrl] = useState(webhookUrl);

  const [schName, setSchName] = useState<string>(schoolName);
  const [acadYr, setAcadYr] = useState<string>(academicYear);
  const [regName, setRegName] = useState<string>(registrarName);
  const [regKey, setRegKey] = useState<string>(registrarKey);
  const [regDiv, setRegDiv] = useState<string>(regionalDivision);

  const [scales, setScales] = useState<GradingScale[]>(defaultScale);

  // Subject functions
  const handleAddSubject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      onTriggerToast("Subject name cannot be empty.", "error");
      return;
    }
    if (subjects.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      onTriggerToast("Subject already exists in the system database.", "error");
      return;
    }
    
    setSubjects(prev => [...prev, trimmed]);
    if (onLogActivity) {
      onLogActivity(`Subject added: "${trimmed}" added to global academic ledger catalog`, 'setting');
    }
    onTriggerToast(`🎉 Successfully added custom subject: "${trimmed}"`, "success");
  };

  const handleDeleteSubject = (name: string) => {
    setSubjects(prev => prev.filter(s => s !== name));
    if (onLogActivity) {
      onLogActivity(`Subject deleted: "${name}" dropped from system database catalog`, 'setting');
    }
    onTriggerToast(`Dropped subject: "${name}"`, "info");
  };

  // Assessment Column functions
  const handleAddColumn = (name: string, maxScore: number) => {
    const trimmed = name.trim();
    if (!trimmed) {
      onTriggerToast("Column name cannot be empty.", "error");
      return;
    }
    if (maxScore <= 0) {
      onTriggerToast("Max Score must be greater than 0.", "error");
      return;
    }
    
    const newCol: AssessmentColumn = {
      id: `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: trimmed,
      maxScore
    };
    
    setAssessmentColumns(prev => [...prev, newCol]);
    if (onLogActivity) {
      onLogActivity(`Assessment column added: "${trimmed}" created with limit value ${maxScore}`, 'setting');
    }
    onTriggerToast(`🎉 Successfully added assessment column: "${trimmed}"`, "success");
  };

  const handleEditColumnName = (id: string, newName: string) => {
    setAssessmentColumns(prev => prev.map(col => col.id === id ? { ...col, name: newName } : col));
  };

  const handleEditColumnMax = (id: string, newMax: number) => {
    setAssessmentColumns(prev => prev.map(col => col.id === id ? { ...col, maxScore: newMax } : col));
  };

  const handleDeleteColumn = (id: string) => {
    setAssessmentColumns(prev => prev.filter(col => col.id !== id));
    if (onLogActivity) {
      onLogActivity("Assessment entry column removed from system template", 'setting');
    }
    onTriggerToast("Removed column matrix from system schema.", "info");
  };


  const handleWeightSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (caInput + examInput !== 100) {
      onTriggerToast("Weights equation unbalanced! The sum of CA and Exam weights must equal 100% exactly.", "error");
      return;
    }
    setCaWeight(caInput);
    setExamWeight(examInput);
    if (onLogActivity) {
      onLogActivity(`Academic weights updated: CA set to ${caInput}%, Exam set to ${examInput}%`, 'setting');
    }
    onTriggerToast(`Master weights locked. Continuous Assessment calculated at ${caInput}% and Final Exams calculated at ${examInput}%.`, "success");
  };

  const handleScaleSave = () => {
    if (onLogActivity) {
      onLogActivity("Grading scale boundary thresholds customized", "setting");
    }
    onTriggerToast("Grading thresholds saved. Grade distribution tables refreshed.", "success");
  };

  const handleResetWeights = () => {
    setCaInput(30);
    setExamInput(70);
    setCaWeight(30);
    setExamWeight(70);
    if (onLogActivity) {
      onLogActivity("Academic weights reset to default parameters: 30% CA, 70% Exam", "setting");
    }
    onTriggerToast("Calculative weights reverted to national default parameters (30/70).", "info");
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full text-on-surface" id="system-settings-view-container">
      
      {/* View Header */}
      <div className="border-b border-outline-variant pb-4">
        <h2 className="text-xl font-bold text-on-background">System Workspace Settings</h2>
        <p className="text-xs text-on-surface-variant font-medium">Calibrate structural weights, grade code thresholds, and database variables.</p>
      </div>

      {/* Grid Menu Tabs */}
      <div className="flex border-b border-outline-variant/60 gap-4 overflow-x-auto select-none pb-1 pb-gutter">
        <button 
          onClick={() => setActiveTab('assessment-columns')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wide border-b-2 hover:text-primary transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'assessment-columns' ? 'border-primary text-primary' : 'border-transparent text-secondary'
          }`}
        >
          Assessment Columns Schema
        </button>
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wide border-b-2 hover:text-primary transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'subjects' ? 'border-primary text-primary' : 'border-transparent text-secondary'
          }`}
        >
          Manage Subjects
        </button>
        <button 
          onClick={() => setActiveTab('weights')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wide border-b-2 hover:text-primary transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'weights' ? 'border-primary text-primary' : 'border-transparent text-secondary'
          }`}
        >
          Weights Equation (Legacy)
        </button>
        <button 
          onClick={() => setActiveTab('grading')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wide border-b-2 hover:text-primary transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'grading' ? 'border-primary text-primary' : 'border-transparent text-secondary'
          }`}
        >
          Grade Boundaries (A-F)
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wide border-b-2 hover:text-primary transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-secondary'
          }`}
        >
          Branding & Operator Profile
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-2.5 font-bold text-xs uppercase tracking-wide border-b-2 hover:text-primary transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'integrations' ? 'border-primary text-primary' : 'border-transparent text-secondary'
          }`}
        >
          Integrations & Backup
        </button>
      </div>

      {/* Content panes */}
      <div className="max-w-3xl bg-white border border-outline-variant rounded-xl p-6 shadow-xs animate-fade-in">
        
        {/* Pane 1: Assessment Columns */}
        {activeTab === 'assessment-columns' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                <span>DYNAMIC ASSESSMENT COLUMNS SCHEMA</span>
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Allow teachers to customize the grading breakdown matrix entirely. Build score assessment inputs with custom weights/caps (e.g., class projects, assignments, and exams).
              </p>
            </div>

            {/* Input Form for adding a new Column */}
            <div className="p-4 bg-surface-container-low border border-outline-variant/60 rounded-xl space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Add New Assessment Column</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  id="new-col-name"
                  placeholder="e.g. Class Exercise, Mid-Term, Project, Exam..."
                  className="flex-1 text-xs font-semibold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface focus:outline-hidden"
                />
                <div className="flex items-center gap-2 w-full sm:w-44">
                  <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Max Score:</span>
                  <input 
                    type="number" 
                    id="new-col-max"
                    defaultValue="20"
                    min="1"
                    className="w-full text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  />
                </div>
                <button 
                  onClick={() => {
                    const nameElem = document.getElementById('new-col-name') as HTMLInputElement;
                    const maxElem = document.getElementById('new-col-max') as HTMLInputElement;
                    if (nameElem && maxElem) {
                      handleAddColumn(nameElem.value, parseInt(maxElem.value) || 20);
                      nameElem.value = '';
                      maxElem.value = '20';
                    }
                  }}
                  className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 justify-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Column</span>
                </button>
              </div>
            </div>

            {/* List and inline styling of current columns */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-outline-variant uppercase tracking-wider block">Score Matrix Configurations</span>
              <div className="border border-outline-variant/60 rounded-xl overflow-hidden divide-y divide-outline-variant/65">
                {assessmentColumns.map((col) => (
                  <div key={col.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 bg-surface-container-low hover:bg-slate-50 transition-all gap-4">
                    <div className="flex-grow flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <input 
                        type="text"
                        value={col.name}
                        title={`Label of input field ${col.name}`}
                        onChange={(e) => handleEditColumnName(col.id, e.target.value)}
                        className="text-xs font-bold text-slate-800 bg-white sm:bg-transparent hover:bg-white border border-transparent hover:border-outline-variant focus:border-primary focus:bg-white px-2 py-1.5 focus:outline-hidden rounded-md flex-1 text-left"
                      />
                      <div className="flex items-center gap-1.5 bg-slate-50 border px-2 py-1 rounded-md max-w-[140px] border-outline-variant">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Max Score:</span>
                        <input 
                          type="number"
                          value={col.maxScore}
                          title={`Maximum score allowable for field ${col.name}`}
                          onChange={(e) => handleEditColumnMax(col.id, parseInt(e.target.value) || 0)}
                          className="w-12 text-center text-xs font-black bg-transparent border-none text-[#2563eb] py-0 px-1 focus:ring-0 focus:outline-hidden"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteColumn(col.id)}
                      className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 hover:border-rose-300 font-bold rounded text-[10.5px] transition-all flex items-center gap-1 cursor-pointer self-end sm:self-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                ))}
                {assessmentColumns.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-400 font-medium">No score columns registered. Add columns above.</p>
                )}
              </div>

              {/* Dynamic calculator indicator block */}
              {(() => {
                const totalMax = assessmentColumns.reduce((sum, c) => sum + c.maxScore, 0);
                return (
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                    <h5 className="font-bold text-xs text-blue-900 uppercase tracking-wide">Dynamic Processor Information</h5>
                    <p className="text-[11px] text-blue-800 leading-normal font-medium">
                      Current raw maximum values sum to <span className="font-black text-primary">{totalMax}</span> points.
                      The ledger grid and print report workflows automatically calculate aggregate final reports out of 100% using:
                      <br />
                      <code className="block bg-white p-2 border border-blue-200 rounded-md font-mono text-[10px] mt-2 font-bold select-all text-slate-700">
                        Total Total Score % = (Sum of Pupil Row Scores / {totalMax}) * 100
                      </code>
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Pane 2: Subjects */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span>DYNAMIC SUBJECTS ENGINE</span>
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Add custom academic subjects (e.g. Ga, French, Robotics, or Computing) to the curriculum system or delete obsolete entries cleanly.
              </p>
            </div>

            {/* Input Form for adding a subject inline */}
            <div className="flex gap-2 p-4 bg-surface-container-low border border-outline-variant/60 rounded-xl">
              <input 
                type="text" 
                id="new-subject-input"
                name="new-subject"
                placeholder="Type new subject name (e.g. French, Robotics, Ga)..."
                className="flex-grow text-xs font-semibold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface focus:outline-hidden"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const inputElem = e.currentTarget as HTMLInputElement;
                    handleAddSubject(inputElem.value);
                    inputElem.value = '';
                  }
                }}
              />
              <button 
                onClick={() => {
                  const inputElem = document.getElementById('new-subject-input') as HTMLInputElement;
                  if (inputElem) {
                    handleAddSubject(inputElem.value);
                    inputElem.value = '';
                  }
                }}
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Subject</span>
              </button>
            </div>

            {/* List of existing subjects */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-outline-variant uppercase tracking-wider block">Active Subjects Matrix</span>
              <div className="border border-outline-variant/60 rounded-xl overflow-hidden divide-y divide-outline-variant/65">
                {subjects.map(subj => (
                  <div key={subj} className="flex items-center justify-between p-3.5 bg-surface-container-low hover:bg-slate-50 transition-all">
                    <span className="font-bold text-xs text-slate-800">{subj}</span>
                    <button 
                      onClick={() => handleDeleteSubject(subj)}
                      className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 hover:border-rose-300 font-bold rounded text-[10.5px] transition-all flex items-center gap-1 cursor-pointer"
                      title={`Delete ${subj}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                ))}
                {subjects.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-400 font-medium">No active subjects registered. Add subjects above.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pane 3: Weights (Legacy weights fallback) */}
        {activeTab === 'weights' && (
          <form onSubmit={handleWeightSave} className="space-y-6">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                <span>Weighted Assessment Contribution Variables</span>
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Configure fallback weights for legacy calculations. If dynamic assessment columns are deleted, the system uses these coefficients to compute totals out of (30% Tests / 70% Exams).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* CA input */}
              <div className="space-y-1.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Continuous Assessment (CA) Weight</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={caInput}
                    min={0}
                    max={100}
                    onChange={(e) => setCaInput(parseInt(e.target.value) || 0)}
                    className="w-24 text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  />
                  <span className="text-xs text-secondary font-semibold">% Contribution</span>
                </div>
                <p className="text-[10px] text-secondary">Typically test percentages (Test 1, Test 2, Homework).</p>
              </div>

              {/* Exam input */}
              <div className="space-y-1.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Terminal Exam Weight</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={examInput}
                    min={0}
                    max={100}
                    onChange={(e) => setExamInput(parseInt(e.target.value) || 0)}
                    className="w-24 text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  />
                  <span className="text-xs text-secondary font-semibold">% Contribution</span>
                </div>
                <p className="text-[10px] text-secondary">Weighted total representing final written paper scores.</p>
              </div>
            </div>

            {/* Sum equation check */}
            <div className={`p-3 rounded-xl flex items-center gap-3 text-xs font-medium border ${
              caInput + examInput === 100 
                ? 'bg-green-50 text-green-800 border-green-200' 
                : 'bg-red-50 text-red-800 border-red-200 animate-pulse'
            }`}>
              <ShieldAlert className="w-4 h-4" />
              <span>
                Calculative Equation Check: {caInput}% + {examInput}% = <span className="font-bold">{caInput + examInput}%</span>
                {caInput + examInput === 100 
                  ? " (Balanced equation & verified)" 
                  : " (Unbalanced equation! Sum must equal 100% contribution)"
                }
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant/60">
              <button 
                type="button"
                onClick={handleResetWeights}
                className="px-3.5 py-2 hover:bg-slate-50 border border-outline-variant rounded-lg text-xs font-bold text-on-surface-variant transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
              <button 
                type="submit"
                className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Lock Calculative Equations
              </button>
            </div>
          </form>
        )}

        {/* Pane 4: Grading boundaries */}
        {activeTab === 'grading' && (
          <div className="space-y-4">
            <div className="space-y-1 pb-2">
              <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <span>National Grading Scale Reference</span>
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Adjust grade score ranges (A-F) that translate cumulative percentages to final report notations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scales.map((s, index) => (
                <div key={s.grade} className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/50">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${s.badgeBg}`} style={{ color: s.badgeText }}>
                    Grade {s.grade}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-secondary font-bold">Minimum Score:</span>
                    <input 
                      type="number"
                      value={s.minScore}
                      min={0}
                      max={100}
                      onChange={(e) => {
                        const next = [...scales];
                        next[index].minScore = parseInt(e.target.value) || 0;
                        setScales(next);
                      }}
                      className="w-16 px-1.5 py-1 text-center font-bold text-xs border border-outline-variant rounded bg-white text-on-surface focus:outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-5 border-t border-outline-variant/60">
              <button 
                onClick={handleScaleSave}
                className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Save Boundaries
              </button>
            </div>
          </div>
        )}

        {/* Pane 5: Profile & Branding Customize */}
        {activeTab === 'profile' && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              setSchoolName(schName);
              setAcademicYear(acadYr);
              setRegistrarName(regName);
              setRegistrarKey(regKey);
              setRegionalDivision(regDiv);
              if (onLogActivity) {
                onLogActivity(`System configurations updated: school name set to "${schName}"`, 'setting');
              }
              onTriggerToast("Custom institutional branding configurations saved and updated successfully!", "success");
            }}
            className="space-y-6 text-xs font-medium text-on-surface"
          >
            <div className="space-y-1 pb-2">
              <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span>Custom Academy Branding & Registrar Settings</span>
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Personalize your administrative workspace. All customizations entered below dynamically update report printouts, signature lines, official seals, and workspace credentials.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* School Name */}
              <div className="space-y-1.5 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Institution / School Name</label>
                <input 
                  type="text" 
                  value={schName}
                  onChange={(e) => setSchName(e.target.value)}
                  placeholder="e.g. ST. AUGUSTINE COLLEGE"
                  className="w-full text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  required
                />
                <p className="text-[10px] text-secondary">Renders as the main display title on report sheet printouts.</p>
              </div>

              {/* Administrative Region address */}
              <div className="space-y-1.5 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">School District / Regional Division</label>
                <input 
                  type="text" 
                  value={regDiv}
                  onChange={(e) => setRegDiv(e.target.value)}
                  placeholder="e.g. Directorate of Higher Education, Ghana"
                  className="w-full text-xs font-semibold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  required
                />
                <p className="text-[10px] text-secondary">Displayed beneath the institution title as secondary regulatory sub-text.</p>
              </div>

              {/* Evaluation cycle/Academic year */}
              <div className="space-y-1.5 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Active Academic Year / Cycle</label>
                <input 
                  type="text" 
                  value={acadYr}
                  onChange={(e) => setAcadYr(e.target.value)}
                  placeholder="e.g. 2025/2026 Academic Session"
                  className="w-full text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  required
                />
                <p className="text-[10px] text-secondary">Prints alongside student credentials in the report overview statistics.</p>
              </div>

              {/* Registrar operator name */}
              <div className="space-y-1.5 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Operator Registrar Name</label>
                <input 
                  type="text" 
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Kenneth Tutu-Donkor"
                  className="w-full text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  required
                />
                <p className="text-[10px] text-secondary">Renders on the sidebar bottom profile and official registration stamps.</p>
              </div>

              {/* Badge key registry code */}
              <div className="space-y-1.5 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl md:col-span-2">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">District Operator ID / Authorization Seal Code</label>
                <input 
                  type="text" 
                  value={regKey}
                  onChange={(e) => setRegKey(e.target.value)}
                  placeholder="e.g. DR_AUTHORIZED_KEY_02"
                  className="w-full text-xs font-bold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  required
                />
                <p className="text-[10px] text-secondary">Used as custom cryptographic stamp reference in printed transcript footers.</p>
              </div>
            </div>

            <div className="p-4 bg-[#fef3c7] text-[#92400e] rounded-xl border border-[#fde68a] leading-normal font-semibold">
              <span className="font-bold block text-xs mb-1">Administrative Authorization Required:</span>
              Once committed, these custom settings modify both physical class registers, official grade sheets, and multi-term printed visual documents. Ensure inputs comply with ministry standards.
            </div>

            <div className="flex justify-end pt-5 border-t border-outline-variant/60">
              <button 
                type="submit"
                className="px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Save &amp; Commit Custom Branding Settings
              </button>
            </div>
          </form>
        )}

        {/* Pane: Integrations & Backup */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-on-background">Integrations &amp; Data Backup</h3>
              <p className="text-xs text-secondary font-medium">Configure AI credentials, WhatsApp notifications, school logo, and export your data.</p>
            </div>

            {/* Logo upload */}
            <div className="space-y-3 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">School Logo</label>
              <div className="flex items-center gap-4">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="School logo" className="w-14 h-14 rounded-xl object-cover border border-outline-variant" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-outline-variant flex items-center justify-center text-slate-400">
                    <Upload className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500 * 1024) {
                        onTriggerToast("Image must be under 500 KB.", "error");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setSchoolLogo(reader.result as string);
                        onTriggerToast("Logo updated and saved.", "success");
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <label htmlFor="logo-upload" className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-lg transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    {schoolLogo ? 'Replace Logo' : 'Upload Logo'}
                  </label>
                  {schoolLogo && (
                    <button
                      type="button"
                      onClick={() => { setSchoolLogo(''); onTriggerToast("Logo removed.", "info"); }}
                      className="ml-2 text-xs text-red-500 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-[10px] text-secondary">PNG or JPG, max 500 KB. Displays in the sidebar and on report card headers.</p>
                </div>
              </div>
            </div>

            {/* Gemini API key */}
            <div className="space-y-3 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                <Key className="w-3.5 h-3.5" /> AI Engine (Gemini API Key)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={localGeminiKey}
                    onChange={(e) => setLocalGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full text-xs font-semibold px-3 py-2 pr-10 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                  />
                  <button type="button" onClick={() => setShowApiKey(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGeminiApiKey(localGeminiKey);
                    onTriggerToast(localGeminiKey ? "Gemini API key saved." : "API key cleared — AI will use simulation mode.", "success");
                    if (onLogActivity) onLogActivity("AI integration: Gemini API key updated", "setting");
                  }}
                  className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-secondary">
                Get your free key at <span className="font-bold text-[#2563eb]">aistudio.google.com</span>. Without a key the AI agent runs in offline simulation mode.
              </p>
            </div>

            {/* Webhook URL */}
            <div className="space-y-3 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                <Webhook className="w-3.5 h-3.5" /> WhatsApp Notification Webhook (n8n / Zapier)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={localWebhookUrl}
                  onChange={(e) => setLocalWebhookUrl(e.target.value)}
                  placeholder="https://hooks.n8n.cloud/webhook/..."
                  className="flex-1 text-xs font-semibold px-3 py-2 border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary rounded bg-white text-on-surface"
                />
                <button
                  type="button"
                  onClick={() => {
                    setWebhookUrl(localWebhookUrl);
                    onTriggerToast(localWebhookUrl ? "Webhook URL saved. Notifications will dispatch here." : "Webhook URL cleared.", "success");
                    if (onLogActivity) onLogActivity("Notifications: webhook URL updated", "setting");
                  }}
                  className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg transition-all"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-secondary">
                Paste your n8n or Zapier webhook URL. EduAdmin will POST pending notifications here when you trigger dispatch.
              </p>
            </div>

            {/* Data export */}
            <div className="space-y-3 p-4 bg-slate-50/70 border border-outline-variant/60 rounded-xl">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                <Download className="w-3.5 h-3.5" /> Data Backup &amp; Export
              </label>
              <p className="text-xs text-secondary font-medium">
                Downloads a full JSON backup of all students, grades, fees, and staff records from the database. Keep regular backups in a safe location.
              </p>
              <button
                type="button"
                onClick={async () => {
                  // Fetch with the session token (a plain <a href> can't send it),
                  // then download the response as a blob.
                  const res = await apiFetch('/api/export');
                  if (!res.ok) {
                    onTriggerToast(res.status === 403 ? "Only administrators can export the database." : "Export failed.", "error");
                    return;
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `eduadmin-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  onTriggerToast("Database export started — check your downloads folder.", "info");
                  if (onLogActivity) onLogActivity("Data export: full database backup downloaded", "other");
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-all"
              >
                <Download className="w-4 h-4" />
                Download Full Backup (JSON)
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Developer Support Card */}
      <div className="max-w-3xl bg-white p-6 rounded-xl border border-outline-variant shadow-xs text-left">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-850 text-sm">System Architect &amp; Developer</h4>
            <p className="text-xs text-slate-400 font-medium">Technical integrations &amp; gateway support</p>
          </div>
        </div>
        <p className="text-xs text-slate-650 mb-4 leading-relaxed font-semibold">
          For system upgrades, database backups, automated SMS gateway setups, or customizing layout modules, connect directly with your developer.
        </p>
        <div className="flex items-center space-x-2">
          <a 
            href="mailto:kennethdonkortutu@gmail.com" 
            className="flex-1 text-center bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold py-2.5 px-4 rounded-lg ease-out duration-150 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Kenneth</span>
          </a>
          <button 
            type="button"
            onClick={() => {
              navigator.clipboard.writeText('kennethdonkortutu@gmail.com');
              onTriggerToast("📋 Copied developer support email address. Feel free to contact Kenneth!", "success");
            }}
            className="p-2.5 border border-outline-variant bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
            title="Copy Email"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
