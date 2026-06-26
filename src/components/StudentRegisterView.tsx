/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  AlertCircle, 
  UserSquare2,
  Phone,
  Camera,
  User
} from 'lucide-react';
import { Student } from '../types';
import { classes } from '../data';

interface StudentRegisterViewProps {
  students: Student[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
  isReadOnly?: boolean;
}

export default function StudentRegisterView({
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onTriggerToast,
  isReadOnly = false
}: StudentRegisterViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Form states in admissions intake modal
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('Senior High 1A');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newStatus, setNewStatus] = useState<'Enrolled' | 'Suspended' | 'Withdrawn' | 'Active' | 'Graduated' | 'On Leave'>('Enrolled');
  const [newPhone, setNewPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Inline Edit states
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editStatus, setEditStatus] = useState<'Enrolled' | 'Suspended' | 'Withdrawn' | 'Active' | 'Graduated' | 'On Leave'>('Enrolled');
  const [editPhone, setEditPhone] = useState('');

  // Filter students based on search query
  const filteredStudents = students.filter(s => {
    const term = searchQuery.toLowerCase();
    const matchesName = s.name.toLowerCase().includes(term);
    const matchesId = s.id.toLowerCase().includes(term);
    const matchesClass = s.classId.toLowerCase().includes(term);
    return matchesName || matchesId || matchesClass;
  });

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onTriggerToast("Write-Protection Active. Cannot register new students in historical sessions.", "error");
      return;
    }
    if (!newId || !newName) {
      onTriggerToast("Missing values. Please fill in both ID and student name.", "error");
      return;
    }

    if (students.some(s => s.id.trim().toLowerCase() === newId.trim().toLowerCase())) {
      onTriggerToast(`Student ID "${newId}" is already registered.`, "error");
      return;
    }

    const created: Student = {
      id: newId.trim().toUpperCase(),
      name: newName.trim(),
      classId: newClass,
      gender: newGender,
      status: newStatus,
      photo: avatarPreview || undefined,
      phoneNumber: newPhone.trim() || undefined
    };

    onAddStudent(created);
    onTriggerToast(`Successfully added student ${created.name} (${created.id}) to registers.`, "success");
    
    // Reset form
    setNewId('');
    setNewName('');
    setNewClass('Senior High 1A');
    setNewGender('Male');
    setNewStatus('Enrolled');
    setNewPhone('');
    setAvatarPreview(null);
    setShowAddForm(false);
  };

  const startEditing = (student: Student) => {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setEditClass(student.classId);
    setEditStatus(student.status);
    setEditPhone(student.phoneNumber || '');
  };

  const saveEdit = (student: Student) => {
    if (!editName.trim()) {
      onTriggerToast("Student name cannot be empty.", "error");
      return;
    }
    const updated: Student = {
      ...student,
      name: editName.trim(),
      classId: editClass,
      status: editStatus,
      phoneNumber: editPhone.trim() || undefined
    };
    onUpdateStudent(updated);
    setEditingStudentId(null);
    onTriggerToast(`Updated record for student ${updated.name}.`, "success");
  };

  const handleDelete = (id: string, name: string) => {
    if (isReadOnly) {
      onTriggerToast("Write-Protection Active. Cannot delete students in historical sessions.", "error");
      return;
    }
    if (confirm(`Are you absolutely sure you want to delete ${name} (${id})? All continuous assessment and exam grades will be erased.`)) {
      onDeleteStudent(id);
      onTriggerToast(`Deleted student ${name} from registers.`, "success");
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full text-slate-800" id="student-register-view-container">
      
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-650" />
          <span>
            <strong>Historical Session Mode:</strong> Register records are protected under write-protection and locked from additions or deletions.
          </span>
        </div>
      )}

      {/* View Header with adding triggers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-bold text-on-background">District Enrollment Registers</h2>
          <p className="text-xs text-on-surface-variant">Update active school boundaries and registrar student matrices.</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-primary hover:bg-[#1d4ed8] text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm cursor-pointer transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Student</span>
          </button>
        )}
      </div>

      {/* Adding Student Floating Modal Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-[#0c1827]/70 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="absolute inset-0" onClick={() => setShowAddForm(false)} />
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant max-w-lg w-full overflow-hidden animate-fade-in text-left relative z-10">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                  <UserSquare2 className="w-5 h-5 text-white/90" />
                  <span>Register Student Profile</span>
                </h3>
                <p className="text-[10px] text-blue-100 font-medium mt-0.5">
                  Add secure biographical matrix entries to active rosters.
                </p>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateStudent} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Profile Image Uploader */}
              <div className="flex flex-col items-center justify-center pb-2">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Student Photo</label>
                <div 
                  onClick={() => {
                    const el = document.getElementById('student-avatar-input-modal');
                    if (el) el.click();
                  }}
                  className="w-20 h-20 rounded-full bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-primary group/u cursor-pointer overflow-hidden flex items-center justify-center relative shadow-xs transition-all"
                  title="Click to upload student photo"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} className="w-full h-full object-cover" alt="Student preview" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-2">
                      <Camera className="w-5 h-5 text-slate-400 group-hover/u:text-primary transition-colors" />
                      <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-1 text-slate-405">Upload</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/u:opacity-100 transition-opacity">
                    <span className="text-[9px] font-bold text-white uppercase select-none">Change</span>
                  </div>
                </div>
                <input 
                  type="file" 
                  id="student-avatar-input-modal" 
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

              {/* Bio Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student ID Code */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Student ID *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. SH-013"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Student Full Name */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Full Name *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Mensah, Emmanuel"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Academic Class */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Class Assignment</label>
                  <select 
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden text-slate-800 pr-8"
                  >
                    {classes.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                {/* Phone contact Number */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Contact Phone</label>
                  <input 
                    type="tel"
                    placeholder="e.g. +233 24 123 4567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Biological Gender</label>
                  <div className="flex gap-4 pt-2">
                    <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="gender" 
                        checked={newGender === 'Male'} 
                        onChange={() => setNewGender('Male')}
                        className="text-primary focus:ring-primary focus:ring-1 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Male</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="radio" 
                        name="gender" 
                        checked={newGender === 'Female'} 
                        onChange={() => setNewGender('Female')}
                        className="text-primary focus:ring-primary focus:ring-1 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Female</span>
                    </label>
                  </div>
                </div>

                {/* Enrollment Status */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Enrollment Status</label>
                  <select 
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden text-slate-800 pr-8"
                  >
                    <option value="Enrolled">Enrolled</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Withdrawn">Withdrawn</option>
                    <option value="Graduated">Graduated</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-bold border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-primary hover:bg-[#1d4ed8] text-white rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  Admit Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Searching Utilities header */}
      <div className="flex flex-col sm:flex-row shadow-xs bg-white border border-outline-variant rounded-xl p-4 gap-4 items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cohort registers (by name, ID, class)..."
            className="pl-9 pr-4 py-1.5 w-full bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary transition-all rounded-lg text-xs font-semibold text-on-surface placeholder:text-outline outline-hidden"
            type="text"
          />
        </div>
        <p className="text-xs text-on-surface-variant font-medium sm:ml-auto">
          Active roster matching query: <span className="font-extrabold text-on-background">{filteredStudents.length}</span> students
        </p>
      </div>

      {/* Roster Spreadsheet Display Grid */}
      <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[750px]">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-5 py-3.5 w-24">ID</th>
                <th className="px-5 py-3.5 w-72">Student Name</th>
                <th className="px-5 py-3.5 w-48">Class Context</th>
                <th className="px-5 py-3.5 w-24">Gender</th>
                <th className="px-5 py-3.5 w-32 text-center">Roster Status</th>
                <th className="px-5 py-3.5 w-36 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-on-surface">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-slate-400 font-medium">
                    <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <span>No students match the current register query.</span>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isEditing = editingStudentId === student.id;
                  
                  return (
                    <tr key={student.id} className="zebra-row hover:bg-[#f8f9ff]/50 transition-colors">
                      {/* Student Identifier */}
                      <td className="px-5 py-3 font-mono font-bold text-primary">
                        {student.id}
                      </td>

                      {/* Student Name + Dynamic Thumbnail Picture */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                            {student.photo ? (
                              <img src={student.photo} className="w-full h-full object-cover" alt={student.name} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[11px] font-black text-slate-500 bg-slate-200">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input 
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full font-semibold border border-slate-300 focus:ring-1 focus:ring-primary focus:border-primary rounded px-2 py-1 text-xs bg-white"
                                />
                                <input 
                                  type="tel"
                                  value={editPhone}
                                  placeholder="Contact Number..."
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  className="w-full border border-slate-300 focus:ring-1 focus:ring-primary focus:border-primary rounded px-2 py-1 text-[10px] font-mono bg-white"
                                />
                              </div>
                            ) : (
                              <>
                                <span className="font-extrabold text-slate-900 text-sm truncate">{student.name}</span>
                                {student.phoneNumber ? (
                                  <span className="text-[10px] text-slate-450 font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Phone className="w-2.5 h-2.5 text-slate-400" /> {student.phoneNumber}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono italic mt-0.5">No contact registered</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Class context */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <select 
                            value={editClass}
                            onChange={(e) => setEditClass(e.target.value)}
                            className="w-full border border-slate-300 focus:ring-1 focus:ring-primary focus:border-primary rounded px-2 py-1 text-xs bg-white text-slate-800"
                          >
                            {classes.map(cls => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-[11px]">{student.classId}</span>
                        )}
                      </td>

                      {/* Gender */}
                      <td className="px-5 py-3 text-slate-600 font-bold">
                        {student.gender}
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3 text-center">
                        {isEditing ? (
                          <select 
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                            className="border border-slate-300 focus:ring-1 focus:ring-primary focus:border-primary rounded px-1.5 py-1 text-xs bg-white text-slate-800"
                          >
                            <option value="Enrolled">Enrolled</option>
                            <option value="Active">Active</option>
                            <option value="Suspended">Suspended</option>
                            <option value="Withdrawn">Withdrawn</option>
                            <option value="Graduated">Graduated</option>
                            <option value="On Leave">On Leave</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-full ${
                            student.status === 'Enrolled' || student.status === 'Active' ? 'bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]' :
                            student.status === 'Suspended' || student.status === 'On Leave' ? 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]' :
                            student.status === 'Graduated' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
                          }`}>
                            {student.status}
                          </span>
                        )}
                      </td>

                      {/* Roster Actions editing */}
                      <td className="px-5 py-3 text-center">
                        {isReadOnly ? (
                          <span className="text-amber-700 font-extrabold text-[10px] uppercase flex items-center justify-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md select-none">
                            PROTECTED
                          </span>
                        ) : isEditing ? (
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => saveEdit(student)}
                              className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-lg transition-colors cursor-pointer"
                              title="Save changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setEditingStudentId(null)}
                              className="border border-slate-300 p-1 rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600"
                              title="Cancel editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-center items-center">
                            <button 
                              onClick={() => startEditing(student)}
                              className="text-slate-500 hover:text-primary p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit student"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(student.id, student.name)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
