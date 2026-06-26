/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserPlus, 
  Search, 
  Trash2, 
  X, 
  Mail, 
  Phone, 
  Calendar, 
  GraduationCap, 
  Briefcase, 
  CheckCircle, 
  AlertCircle,
  Camera,
  Layers,
  Award,
  Users
} from 'lucide-react';
import { StaffRecord, StaffCategory, StaffEmploymentStatus, NonTeachingRole } from '../types';
import { classes } from '../data';

interface StaffDirectoryViewProps {
  staffRecords: StaffRecord[];
  onAddStaff: (newStaff: StaffRecord) => void;
  onDeleteStaff: (staffId: string) => void;
  onUpdateStaffStatus: (staffId: string, status: StaffEmploymentStatus) => void;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
  subjects: string[];
}

export default function StaffDirectoryView({
  staffRecords,
  onAddStaff,
  onDeleteStaff,
  onUpdateStaffStatus,
  onTriggerToast,
  subjects
}: StaffDirectoryViewProps) {
  // Tabs and search states
  const [activeTab, setActiveTab] = useState<StaffCategory>('Teaching');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for registering new staff member
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dateJoined, setDateJoined] = useState(() => new Date().toISOString().split('T')[0]);
  const [employmentStatus, setEmploymentStatus] = useState<StaffEmploymentStatus>('Active');
  const [staffCategory, setStaffCategory] = useState<StaffCategory>('Teaching');
  
  // Custom Metadata and photo upload states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [department, setDepartment] = useState<'Science' | 'Mathematics' | 'Humanities' | 'Languages' | 'Admin'>('Science');
  const [isCoordinator, setIsCoordinator] = useState(false);

  // Category-specific sub-states
  const [assignedClass, setAssignedClass] = useState('Senior High 1A');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [specificRole, setSpecificRole] = useState<string>('Accountant/Bursar');

  // Input errors
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Filter logic
  const filteredStaff = staffRecords.filter(staff => {
    if (staff.staffCategory !== activeTab) return false;

    const q = searchQuery.toLowerCase();
    const matchesName = staff.fullName.toLowerCase().includes(q);
    const matchesPhone = staff.phoneNumber.toLowerCase().includes(q);
    const matchesEmail = staff.email.toLowerCase().includes(q);
    const matchesClass = staff.assignedClass ? staff.assignedClass.toLowerCase().includes(q) : false;
    const matchesRole = staff.specificRole ? staff.specificRole.toLowerCase().includes(q) : false;
    const matchesDept = staff.department ? staff.department.toLowerCase().includes(q) : false;

    return matchesName || matchesPhone || matchesEmail || matchesClass || matchesRole || matchesDept;
  });

  // Handle multi-select subjects
  const handleSubjectCheckboxToggle = (subjectId: string) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(s => s !== subjectId);
      } else {
        return [...prev, subjectId];
      }
    });
  };

  // Form submission & validation
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    // Validations
    if (!fullName.trim()) {
      errors.push("Staff full name is required.");
    }
    if (!phoneNumber.trim()) {
      errors.push("Phone number is required.");
    } else if (phoneNumber.trim().length < 8) {
      errors.push("Please provide a valid phone number.");
    }
    if (!email.trim()) {
      errors.push("Email address is required.");
    } else if (!email.includes('@') || !email.includes('.')) {
      errors.push("Please provide a valid email address.");
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      onTriggerToast("Validation failed. Please review input fields.", "error");
      return;
    }

    // Generate unique ID
    const prefix = staffCategory === 'Teaching' ? 'TCH' : 'STF';
    const generatedId = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;

    const newStaff: StaffRecord = {
      staffId: generatedId,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
      dateJoined,
      employmentStatus,
      staffCategory,
      photo: avatarPreview || undefined,
      department: staffCategory === 'Teaching' ? department : 'Admin',
      isCoordinator: staffCategory === 'Teaching' ? isCoordinator : false,
      ...(staffCategory === 'Teaching' 
        ? { assignedClass, subjectsTaught: selectedSubjects } 
        : { specificRole }
      )
    };

    onAddStaff(newStaff);
    onTriggerToast(`Successfully registered ${fullName} (${generatedId})!`, "success");
    
    // Clear & close
    resetForm();
    setIsModalOpen(false);
  };

  const resetForm = () => {
    setFullName('');
    setPhoneNumber('');
    setEmail('');
    setDateJoined(new Date().toISOString().split('T')[0]);
    setEmploymentStatus('Active');
    setStaffCategory('Teaching');
    setAssignedClass('Senior High 1A');
    setSelectedSubjects([]);
    setSpecificRole('Accountant/Bursar');
    setDepartment('Science');
    setIsCoordinator(false);
    setAvatarPreview(null);
    setFormErrors([]);
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove staff member: ${name} (${id})?`)) {
      onDeleteStaff(id);
      onTriggerToast(`Deleted staff member ${name} from databases.`, "info");
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full text-slate-800" id="staff-directory-container">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-black text-on-background flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Workforce Signatures &amp; Directory</span>
          </h2>
          <p className="text-xs text-slate-505 text-slate-500">
            Regulate human resources, academic assignments, departments, and report signatures.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-[#1d4ed8] text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm cursor-pointer transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Staff Member</span>
        </button>
      </div>

      {/* Roster visual tabs & filtering row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
        
        {/* Visual Category Tabs */}
        <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1 border border-slate-300/35">
          <button
            onClick={() => setActiveTab('Teaching')}
            className={`px-4 py-2 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'Teaching'
                ? 'bg-white text-slate-905 text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/30'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-primary" />
            <span>Teaching body ({staffRecords.filter(s => s.staffCategory === 'Teaching').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('Non-Teaching')}
            className={`px-4 py-2 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'Non-Teaching'
                ? 'bg-white text-slate-905 text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/30'
            }`}
          >
            <Briefcase className="w-4 h-4 text-violet-600" />
            <span>Support workforce ({staffRecords.filter(s => s.staffCategory === 'Non-Teaching').length})</span>
          </button>
        </div>

        {/* Dynamic Search block */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'Teaching' ? 'by name, class, department...' : 'by name, role...'}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary rounded-lg bg-white"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Staff lists tables */}
      <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-xs">
        {filteredStaff.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <Users className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-705">No records found matching description</p>
            <p className="text-xs text-slate-500 max-w-sm">
              We couldn't locate active workers matching "{searchQuery}" in the current segment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase border-b border-outline-variant select-none">
                  <th className="px-5 py-3 w-24">Staff ID</th>
                  <th className="px-5 py-3 w-64">Full Name</th>
                  <th className="px-5 py-3 w-52">Contact Details</th>
                  <th className="px-5 py-3 w-40">Date Joined</th>
                  {activeTab === 'Teaching' ? (
                    <>
                      <th className="px-5 py-3 w-36">Department</th>
                      <th className="px-5 py-3 w-36">Assigned Class</th>
                      <th className="px-5 py-3 w-36 text-center">Coordinator?</th>
                    </>
                  ) : (
                    <th className="px-5 py-3 w-44">Specific Role</th>
                  )}
                  <th className="px-5 py-3 w-28 text-center">Status</th>
                  <th className="px-5 py-3 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStaff.map((staff) => (
                  <tr key={staff.staffId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-800">{staff.staffId}</td>
                    
                    {/* Staff Name with Picture */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          {staff.photo ? (
                            <img src={staff.photo} className="w-full h-full object-cover" alt={staff.fullName} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-primary bg-indigo-50 text-xs">
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm">{staff.fullName}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{staff.staffCategory}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{staff.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-[10.5px]">{staff.email}</span>
                      </div>
                    </td>
                    
                    <td className="px-5 py-4 text-slate-600 font-mono">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{staff.dateJoined}</span>
                      </div>
                    </td>
                    
                    {/* Category specific dynamic renders */}
                    {activeTab === 'Teaching' ? (
                      <>
                        <td className="px-5 py-4 text-slate-650 font-bold">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm font-semibold border border-blue-100 text-[10.5px] uppercase flex items-center gap-1 w-max">
                            <Layers className="w-3 h-3 text-blue-500" />
                            {staff.department || 'General'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            staff.assignedClass === 'Unassigned' 
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100/70'
                          }`}>
                            {staff.assignedClass || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {staff.isCoordinator ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                              <Award className="w-3.5 h-3.5 text-amber-600" />
                              COORDINATOR
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold text-[11px]">No</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-700 px-2.5 py-1 bg-slate-100 rounded-md text-[11px]">
                          {staff.specificRole || 'Support Staff'}
                        </span>
                      </td>
                    )}
                    
                    <td className="px-5 py-4 text-center">
                      <select
                        value={staff.employmentStatus}
                        onChange={(e) => onUpdateStaffStatus(staff.staffId, e.target.value as StaffEmploymentStatus)}
                        className={`text-[11px] font-bold rounded-lg px-2 py-1 bg-white border outline-hidden ${
                          staff.employmentStatus === 'Active' 
                            ? 'border-green-300 text-green-700' 
                            : 'border-yellow-300 text-yellow-700'
                        }`}
                      >
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                      </select>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleDeleteClick(staff.staffId, staff.fullName)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer inline-block"
                        title="Delete staff record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roster Modal dialog for Registering New Staff */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0c1827]/70 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-lg w-full overflow-hidden animate-fade-in text-left relative z-10">
            
            {/* Modal Header */}
            <div className="bg-[#2563eb] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-white" />
                  <span>Register Workforce Member</span>
                </h3>
                <p className="text-[10px] text-blue-200 font-medium mt-0.5">
                  Add secure human matrices and coordinate active roles.
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-lg text-xs font-semibold space-y-1">
                  <div className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-extrabold text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-650" />
                    <span>Correct formatting errors:</span>
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 font-medium leading-relaxed">
                    {formErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Profile Image Uploader */}
              <div className="flex flex-col items-center justify-center pb-2">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Staff Photo</label>
                <div 
                  onClick={() => {
                    const el = document.getElementById('staff-avatar-input-modal');
                    if (el) el.click();
                  }}
                  className="w-20 h-20 rounded-full bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-primary group/u cursor-pointer overflow-hidden flex items-center justify-center relative shadow-xs transition-all"
                  title="Click to upload staff photo"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} className="w-full h-full object-cover" alt="Staff preview" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-2">
                      <Camera className="w-5 h-5 text-slate-400 group-hover/u:text-primary transition-colors" />
                      <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-1">Upload</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/u:opacity-100 transition-opacity">
                    <span className="text-[9px] font-bold text-white uppercase select-none">Change</span>
                  </div>
                </div>
                <input 
                  type="file" 
                  id="staff-avatar-input-modal" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = (ev) => {
                        setAvatarPreview(ev.target?.result as string);
                      };
                      r.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              {/* General Staff Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Staff Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Kwabena Mensah"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-hidden"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Staff Category</label>
                  <select
                    value={staffCategory}
                    onChange={(e) => {
                      setStaffCategory(e.target.value as StaffCategory);
                      setFormErrors([]);
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-800 focus:outline-hidden"
                  >
                    <option value="Teaching">Teaching Staff</option>
                    <option value="Non-Teaching">Non-Teaching/Support Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +233 24 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. kwabena.mensah@eduadmin.edu.gh"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Employment Status</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as StaffEmploymentStatus)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-800"
                  >
                    <option value="Active">Active Duty</option>
                    <option value="On Leave">On Scheduled Leave</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Employment Date Joined</label>
                  <input
                    type="date"
                    required
                    value={dateJoined}
                    onChange={(e) => setDateJoined(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Category-Specific dynamic fields options */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                {staffCategory === 'Teaching' ? (
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-[#2563eb] uppercase tracking-wider">
                      Teaching parameters &amp; assignment parameters
                    </h4>

                    {/* Department & Coordinator */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Department</label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value as any)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-800"
                        >
                          <option value="Science">Science &amp; Tech</option>
                          <option value="Mathematics">Mathematics</option>
                          <option value="Humanities">Humanities &amp; Social</option>
                          <option value="Languages">Languages</option>
                          <option value="Admin">Administration</option>
                        </select>
                      </div>

                      <div className="space-y-1 flex flex-col justify-end pb-1.5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={isCoordinator}
                            onChange={(e) => setIsCoordinator(e.target.checked)}
                            className="rounded border-slate-300 text-primary focus:ring-primary focus:ring-1 w-4 h-4 cursor-pointer"
                          />
                          <span>Academic Coordinator?</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Assigned Classroom</label>
                      <select
                        value={assignedClass}
                        onChange={(e) => setAssignedClass(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-800"
                      >
                        <option value="Unassigned">Unassigned / Substitute</option>
                        {classes.map(cl => (
                          <option key={cl} value={cl}>{cl}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-wide text-slate-500 block">Subjects Taught</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {subjects.map(sub => (
                          <label key={sub} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={selectedSubjects.includes(sub)}
                              onChange={() => handleSubjectCheckboxToggle(sub)}
                              className="rounded border-slate-300 text-primary focus:ring-primary focus:ring-1 cursor-pointer"
                            />
                            <span>{sub}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                      Support Workforce Parameters
                    </h4>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wide text-slate-500">Specific Role</label>
                      <select
                        value={specificRole}
                        onChange={(e) => setSpecificRole(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-800"
                      >
                        <option value="Accountant/Bursar">Accountant / Bursar</option>
                        <option value="Secretary">Secretary</option>
                        <option value="Driver">Driver</option>
                        <option value="Security">Security Guard</option>
                        <option value="Catering/Cook">Catering / Cook</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Save actions bar */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Submit Registration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
