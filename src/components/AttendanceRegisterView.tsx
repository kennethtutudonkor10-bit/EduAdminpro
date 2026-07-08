/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Check, 
  X, 
  Search, 
  CheckCircle, 
  TrendingUp, 
  Award,
  AlertCircle,
  Wifi,
  Cpu,
  Smartphone,
  Fingerprint,
  Radio,
  Send,
  Database,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Student, AttendanceRecord } from '../types';
import { apiFetch } from '../lib/api';
import { classes } from '../data';

interface AttendanceRegisterViewProps {
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (date: string, classId: string, attendance: Record<string, 'Present' | 'Absent'>) => void;
  selectedAcademicYear: string;
  activeTerm: string;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function AttendanceRegisterView({
  students,
  attendanceRecords,
  onSaveAttendance,
  selectedAcademicYear,
  activeTerm,
  onTriggerToast
}: AttendanceRegisterViewProps) {
  // Calendar and class select states
  const [selectedClass, setSelectedClass] = useState<string>('Senior High 1A');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Local editing attendance grid (studentId -> 'Present' | 'Absent')
  const [localAttendance, setLocalAttendance] = useState<Record<string, 'Present' | 'Absent'>>({});
  const [currentCohortKey, setCurrentCohortKey] = useState('');

  // IoT Biometric Simulator States
  const [selectedIoTStudentId, setSelectedIoTStudentId] = useState<string>('');
  const [connectivityMode, setConnectivityMode] = useState<'wifi' | 'ble'>('wifi');
  const [iotStatus, setIotStatus] = useState<'connected' | 'syncing' | 'standalone'>('connected');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [enrollProgress, setEnrollProgress] = useState<number>(0);
  const [enrolledTemplates, setEnrolledTemplates] = useState<Record<string, boolean>>({});
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [smsLogs, setSmsLogs] = useState<Array<{
    id: string;
    timestamp: string;
    studentName: string;
    message: string;
    recipient: string;
    type: 'success' | 'alert' | 'info';
  }>>([
    {
      id: 'sms-init',
      timestamp: '08:00 AM',
      studentName: 'System Gate',
      message: 'IoT Biometric Device connected and fully integrated in real-time.',
      recipient: 'Master Admin Hub',
      type: 'info'
    }
  ]);

  // Filter students to the active selected class and enrolled status
  const classStudents = students.filter(s => s.classId === selectedClass && s.status === 'Enrolled');

  // Key tracking to realize when student selections or date change to sync backend
  const cohortKey = `${selectedClass}_${selectedDate}`;
  
  if (currentCohortKey !== cohortKey) {
    // Look up existing saved attendance in global records
    const savedRecord = attendanceRecords.find(
      r => r.date === selectedDate && r.classId === selectedClass && r.termId === activeTerm
    );

    const initialMap: Record<string, 'Present' | 'Absent'> = {};
    classStudents.forEach(st => {
      if (savedRecord?.attendance && st.id in savedRecord.attendance) {
        initialMap[st.id] = savedRecord.attendance[st.id];
      } else {
        initialMap[st.id] = 'Present'; // default to Present
      }
    });

    setLocalAttendance(initialMap);
    setCurrentCohortKey(cohortKey);
    
    // Set appropriate default student in IoT simulator when changing class
    if (classStudents.length > 0) {
      setSelectedIoTStudentId(classStudents[0].id);
    } else {
      setSelectedIoTStudentId('');
    }
  }

  // IoT handler: Enroll Biometric Template
  const handleEnrollBiometric = (studentId: string) => {
    if (!studentId) {
      onTriggerToast("Please select a student to enroll.", "error");
      return;
    }
    const student = classStudents.find(s => s.id === studentId);
    if (!student) return;

    setIsEnrolling(true);
    setEnrollProgress(10);
    
    let currentProgress = 10;
    const interval = setInterval(() => {
      currentProgress += 30;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setEnrollProgress(100);
        setTimeout(() => {
          setIsEnrolling(false);
          setEnrolledTemplates(prev => ({ ...prev, [studentId]: true }));
          onTriggerToast(`Biometric fingerprint template enrolled successfully for ${student.name}!`, "success");
        }, 300);
      } else {
        setEnrollProgress(currentProgress);
      }
    }, 200);
  };

  // IoT handler: Simulate Fingerprint Scan & Check-In
  const handleSimulateScan = (studentId: string) => {
    if (!studentId) {
      onTriggerToast("Please select a student to scan.", "error");
      return;
    }
    const student = classStudents.find(s => s.id === studentId);
    if (!student) return;

    // Reject scan if template is not enrolled yet
    if (!enrolledTemplates[studentId]) {
      setScanStatus('failed');
      onTriggerToast(`Access Denied: Biometric fingerprint template not found for ${student.name}. Please enroll them first.`, "error");
      setTimeout(() => setScanStatus('idle'), 3000);
      return;
    }

    setScanStatus('scanning');
    
    setTimeout(() => {
      setScanStatus('success');
      // Update attendance status to Present
      setLocalAttendance(prev => ({
        ...prev,
        [studentId]: 'Present'
      }));

      const scanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const parentLabel = student.name.split(' ')[0] + "'s Parent";
      const smsMessage = `EduAdmin Pro IoT: ${student.name} successfully verified arrival at ${scanTime} via Terminal Gate ${connectivityMode === 'wifi' ? 'Wi-Fi' : 'BLE'}.`;
      
      const newSms = {
        id: `sms-${Date.now()}`,
        timestamp: scanTime,
        studentName: student.name,
        message: smsMessage,
        recipient: `Phone of parent`,
        type: 'success' as const
      };

      setSmsLogs(prev => [newSms, ...prev]);

      // Persist to notification_queue so the SMS engine picks it up
      apiFetch('/api/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'attendance_checkin',
          recipientName: student.name,
          message: smsMessage,
        }),
      }).catch(() => {});

      onTriggerToast(`Check-in recorded for ${student.name}. Attendance updated and notification queued.`, "success");

      setTimeout(() => setScanStatus('idle'), 2500);
    }, 1000);
  };

  // IoT handler: Trigger Missed Deadline Absence Alert
  const handleSimulateDeadlineAlert = () => {
    const absentees = classStudents.filter(st => {
      const activeStatus = localAttendance[st.id] || 'Present';
      return activeStatus === 'Absent';
    });

    if (absentees.length === 0) {
      onTriggerToast("All students in the target cohort are marked present. No alerts dispatched.", "info");
      return;
    }

    const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLogs = absentees.map(student => ({
      id: `sms-abs-${student.id}-${Date.now()}`,
      timestamp: logTime,
      studentName: student.name,
      message: `ALERT: ${student.name} failed to register attendance by the daily check-in deadline ${logTime}. Please confirm client location.`,
      recipient: `Parent Hotline`,
      type: 'alert' as const
    }));

    setSmsLogs(prev => [...newLogs, ...prev]);

    // Persist each absence alert to the notification queue
    absentees.forEach(student => {
      apiFetch('/api/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'attendance_absence_alert',
          recipientName: student.name,
          message: `ALERT: ${student.name} failed to register attendance by the daily check-in deadline. Please confirm student location.`,
        }),
      }).catch(() => {});
    });

    onTriggerToast(`Daily deadline crossed. Dispatched ${absentees.length} parent alert notifications.`, "error");
  };

  // Handle binary state toggle
  const handleToggleStatus = (studentId: string, status: 'Present' | 'Absent') => {
    setLocalAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Mark all presence in class easily
  const handleMarkAll = (status: 'Present' | 'Absent') => {
    const freshMap: Record<string, 'Present' | 'Absent'> = {};
    classStudents.forEach(st => {
      freshMap[st.id] = status;
    });
    setLocalAttendance(freshMap);
    onTriggerToast(`All active roster students in ${selectedClass} marked ${status}.`, "info");
  };

  // Submit local state back up to App.tsx / persist in localStorage
  const handleSaveLogs = () => {
    if (classStudents.length === 0) {
      onTriggerToast("Cannot append log. No active student found in this class.", "error");
      return;
    }
    onSaveAttendance(selectedDate, selectedClass, localAttendance);
    onTriggerToast(`Attendance record successfully sealed for ${selectedClass} on ${selectedDate}!`, "success");
  };

  // Dynamic statistics calculations
  const presentCount = Object.values(localAttendance).filter(v => v === 'Present').length;
  const absentCount = Object.values(localAttendance).filter(v => v === 'Absent').length;
  const totalInCohort = classStudents.length;
  const dailyAttendancePercent = totalInCohort > 0 ? Math.round((presentCount / totalInCohort) * 105) : 0; // standard peak
  const scalePercent = Math.min(100, dailyAttendancePercent);

  // Search filter
  const filteredStudents = classStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full" id="attendance-register-container">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-black text-on-background flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-650 inline-block animate-pulse" /> Dynamic Class Attendance Register
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Maintain daily binary rolls, track semester presence rates, and export summaries directly into Term Report Cards.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleMarkAll('Present')}
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Mark All Present
          </button>
          <button
            onClick={() => handleMarkAll('Absent')}
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-755 bg-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Clear All Roster
          </button>
        </div>
      </div>

      {/* Global Academic terms and Calendar row */}
      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#2563eb] rounded-full inline-block"></span>
            <span>Active Semester: <strong className="text-slate-800 font-bold">{activeTerm}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#2563eb] rounded-full inline-block"></span>
            <span>Target Class: <strong className="text-indigo-700 font-bold">{selectedClass}</strong></span>
          </div>
        </div>

        {/* Calendar and Class selectors */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono font-bold font-sans text-slate-700 focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-750 focus:ring-1 focus:ring-[#2563eb] h-9.5"
          >
            {classes.map(cl => (
              <option key={cl} value={cl}>{cl}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistical overview card row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-green-50/50 border border-green-200 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Present Count</div>
            <div className="text-2xl font-black text-green-800 font-mono">{presentCount} <span className="text-xs text-green-600 font-bold">Students</span></div>
          </div>
          <span className="bg-green-100 p-2.5 rounded-full inline-flex items-center">
            <Check className="w-5 h-5 text-green-700 font-bold" />
          </span>
        </div>

        <div className="bg-red-50/50 border border-red-200 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-red-650 tracking-wider">Absent Count</div>
            <div className="text-2xl font-black text-red-700 font-mono">{absentCount} <span className="text-xs text-red-655 font-bold">Students</span></div>
          </div>
          <span className="bg-red-100 p-2.5 rounded-full inline-flex items-center">
            <X className="w-5 h-5 text-red-750 font-bold" />
          </span>
        </div>

        <div className="bg-indigo-50/55 border border-indigo-200 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">Daily Presence Ratio</div>
            <div className="text-2xl font-black text-indigo-800 font-mono">{scalePercent}%</div>
          </div>
          <span className="bg-indigo-100 p-2.5 rounded-full inline-flex items-center">
            <TrendingUp className="w-5 h-5 text-indigo-700" />
          </span>
        </div>

      </div>

      {/* Student presence list card wrapper */}
      <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-xs space-y-4 p-5">
        
        {/* Sub toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5 leading-none">
            <Users className="w-4 h-4 text-slate-400" />
            <span>Class Student Presence Roster ({totalInCohort})</span>
          </h3>
          
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-outline-variant bg-white rounded-md focus:outline-hidden"
            />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-10 border-2 border-dashed border-slate-100 text-center flex flex-col items-center justify-center space-y-1 text-xs">
            <Users className="w-8 h-8 text-slate-350 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No active students on this filtered class roll.</p>
            <p className="text-slate-400 max-w-xs">Verify if classes are assigned or if status criteria are properly mapped.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStudents.map((st, idx) => {
              const activeStatus = localAttendance[st.id] || 'Present';
              
              return (
                <div 
                  key={st.id} 
                  className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="font-mono text-[10.5px] font-bold text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 leading-tight">{st.name}</div>
                      <div className="text-[10px] text-slate-400 tracking-wide font-mono uppercase mt-0.5 mt-0.5 inline-block">
                        ID: {st.id} • Class: {st.classId}
                      </div>
                    </div>
                  </div>

                  {/* Segmented control for binary option */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(st.id, 'Present')}
                      className={`px-4 py-1.5 text-[11px] font-extrabold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        activeStatus === 'Present'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Present</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(st.id, 'Absent')}
                      className={`px-4 py-1.5 text-[11px] font-extrabold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        activeStatus === 'Absent'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Absent</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Master save block */}
        {classStudents.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Real-time persistence layer enabled</span>
            </p>
            <button
              onClick={handleSaveLogs}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Check className="w-3.5 h-3.5 text-white" /> Save &amp; Seal Daily Attendance Roster
            </button>
          </div>
        )}

      </div>

      {/* IoT Biometric Hardware & Attendance Integration Section */}
      <div className="bg-slate-900 text-slate-100 rounded-xl overflow-hidden shadow-md border border-slate-800 space-y-6 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-black uppercase text-blue-400 tracking-wider">
                IoT Biometric Hardware &amp; Attendance Integration
              </h3>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-black uppercase tracking-wide">
                Upcoming Roadmap Preview
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure multi-channel Wi-Fi/BLE readers, register local fingerprint templates, and simulate real-time parent SMS alerts on check-in.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Connectivity:</span>
            <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex">
              <button
                type="button"
                onClick={() => setConnectivityMode('wifi')}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  connectivityMode === 'wifi'
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wifi className="w-3 h-3" />
                <span>Wi-Fi (Cloud Sync)</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectivityMode('ble')}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  connectivityMode === 'ble'
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>BLE (Local Admin)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Hardware Config & Enrollment Column */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-4">
            {/* Connection and Enrollment States */}
            <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  Biometric Identity Verification Terminal
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block"></span>
                  Hardware: Ready
                </span>
              </div>

              {classStudents.length === 0 ? (
                <p className="text-xs text-slate-500">Please select a class with active students to try out hardware features.</p>
              ) : (
                <div className="space-y-4">
                  {/* Select Student */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Select Student for Biometric Sync
                      </label>
                      <select
                        value={selectedIoTStudentId}
                        onChange={(e) => setSelectedIoTStudentId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 focus:ring-1 focus:ring-blue-500"
                      >
                        {classStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEnrollBiometric(selectedIoTStudentId)}
                        disabled={isEnrolling || scanStatus === 'scanning'}
                        className="flex-1 bg-slate-850 hover:bg-slate-750 text-white border border-slate-750 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer font-sans shadow-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isEnrolling ? 'animate-spin' : ''}`} />
                        <span>Enroll Fingerprint</span>
                      </button>
                    </div>
                  </div>

                  {/* Enrollment Progress Indicator */}
                  {isEnrolling && (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 animate-pulse">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400 text-xs">Scanning raw fingerprint and generating master templates...</span>
                        <span className="text-blue-400 font-bold">{enrollProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full transition-all duration-200" 
                          style={{ width: `${enrollProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Simulated Scan Controls */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleSimulateScan(selectedIoTStudentId)}
                      disabled={isEnrolling || scanStatus === 'scanning'}
                      className={`flex-1 text-white font-extrabold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer font-sans ${
                        enrolledTemplates[selectedIoTStudentId]
                          ? 'bg-blue-600 hover:bg-blue-500 shadow-sm'
                          : 'bg-slate-800 text-slate-450 hover:bg-slate-750 border border-slate-700'
                      }`}
                    >
                      <Fingerprint className={`w-4 h-4 ${scanStatus === 'scanning' ? 'animate-pulse text-emerald-450 animate-bounce' : ''}`} />
                      <span>
                        {scanStatus === 'scanning'
                          ? 'Scanning fingerprint...'
                          : enrolledTemplates[selectedIoTStudentId]
                            ? 'Fingerprint Check-In'
                            : 'Enroll student fingerprint first'}
                      </span>
                    </button>

                    <button
                      onClick={handleSimulateDeadlineAlert}
                      className="bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-900/30 py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>Trigger Missed Deadline Alerts</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Explanatory Roadmap details (strictly adhering to user words) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-1 shadow-sm">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block font-sans">Multi-Channel Connectivity</span>
                <p className="text-[11.5px] text-slate-300 leading-relaxed font-semibold">
                  Architected to communicate with physical devices using <strong className="text-white">Wi-Fi (for direct, real-time cloud data polling)</strong> and <strong className="text-white">Bluetooth Low Energy (BLE) (for localized transfers to mobile applications run by administrators)</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-1 shadow-sm">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block font-sans">Biometric Identity Verification</span>
                <p className="text-[11.5px] text-slate-300 leading-relaxed font-semibold font-sans">
                  Integrates <strong className="text-white">fingerprint scanner hardware module APIs</strong> to securely enroll, store, and cross-reference unique student biometric templates.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-1 shadow-sm">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block font-sans">Real-Time Attendance Logging</span>
              <p className="text-[11.5px] text-slate-300 leading-relaxed font-semibold">
                Automatically registers precise arrival and departure timestamps. These records instantly update the cloud attendance register, triggering immediate automated parent notification systems (such as SMS alerts) if a student fails to check in by the school's daily deadline.
              </p>
            </div>
          </div>

          {/* SMS Notification Log Column */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col h-full min-h-[340px]">
            <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Send className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  SMS Gate Notifications Log
                </span>
                <span className="text-[10.5px] text-slate-500 font-mono">Real-Time Alerts</span>
              </div>

              {/* Scrollable logs */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] max-h-[280px]">
                {smsLogs.map(log => (
                  <div 
                    key={log.id} 
                    className={`p-2.5 rounded-lg border leading-tight ${
                      log.type === 'alert'
                        ? 'bg-red-950/30 text-red-300 border-red-900/40 animate-pulse'
                        : log.type === 'success'
                          ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900/40'
                          : 'bg-slate-900 text-slate-300 border-slate-800 text-opacity-90'
                    }`}
                  >
                    <div className="flex justify-between font-bold text-[9px] uppercase tracking-wider text-slate-500 mb-1 font-sans">
                      <span>To: {log.recipient}</span>
                      <span>{log.timestamp}</span>
                    </div>
                    <p>{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
