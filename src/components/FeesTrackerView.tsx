/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  X, 
  Smartphone, 
  HelpCircle, 
  User, 
  Calendar, 
  Lock 
} from 'lucide-react';
import { Student, FinancialRecord, PaymentMethod } from '../types';
import { classes } from '../data';

interface FeesTrackerViewProps {
  students: Student[];
  financialLedger: FinancialRecord[];
  onRecordPayment: (studentId: string, amount: number, method: PaymentMethod, momoPhone?: string, momoProvider?: string) => void;
  onUpdateBulkInvoice: (classId: string, amount: number) => void;
  selectedAcademicYear: string;
  activeTerm: string;
  onTriggerToast: (message: string, type: 'success' | 'info' | 'error') => void;
  momoPhoneNumber: string;
  momoProvider: string;
}

export default function FeesTrackerView({
  students,
  financialLedger,
  onRecordPayment,
  onUpdateBulkInvoice,
  selectedAcademicYear,
  activeTerm,
  onTriggerToast,
  momoPhoneNumber,
  momoProvider,
}: FeesTrackerViewProps) {
  // Navigation & Search Filters
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Active Transaction Data
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeLedgerItem, setActiveLedgerItem] = useState<FinancialRecord | null>(null);

  // Form states for Recording Payment
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [formMomoPhone, setFormMomoPhone] = useState(momoPhoneNumber);
  const [formMomoProvider, setFormMomoProvider] = useState(momoProvider);
  const [simulateMomoPin, setSimulateMomoPin] = useState(true);
  const [isProcessingMomo, setIsProcessingMomo] = useState(false);
  const [momoStep, setMomoStep] = useState<null | 'authorizing' | 'approved'>(null);

  // Form states for Bulk Invoicing
  const [bulkClass, setBulkClass] = useState('Senior High 1A');
  const [bulkAmount, setBulkAmount] = useState('1800');

  // Filter out withdrawn students
  const activeStudentsList = students.filter(s => s.status !== 'Withdrawn');

  // Sync Ledger items for current Term & Academic Year
  const currentTermLedger = activeStudentsList.map(student => {
    // Look up exist ledger record
    let record = financialLedger.find(
      f => f.studentId === student.id && 
           f.termId === activeTerm && 
           f.academicYear === selectedAcademicYear
    );

    if (!record) {
      // Return a dynamically initialized default record to keep calculation integrity
      record = {
        id: `TX-TEMP-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        classId: student.classId,
        academicYear: selectedAcademicYear,
        termId: activeTerm,
        billAmount: student.classId.includes('Junior') ? 1200 : 1800, // Standard template defaults
        paidAmount: 0,
        paymentMethod: 'Cash',
        balance: student.classId.includes('Junior') ? 1200 : 1800,
        lastUpdated: new Date().toISOString()
      };
    }
    return record;
  });

  // Filter according to Class or Search query
  const filteredLedger = currentTermLedger.filter(record => {
    // 1. Class filter
    if (selectedClass !== 'All Classes' && record.classId !== selectedClass) {
      return false;
    }
    // 2. Search query (name, studentId, class)
    const q = searchQuery.toLowerCase();
    const student = activeStudentsList.find(s => s.id === record.studentId);
    if (!student) return false;

    const matchesName = student.name.toLowerCase().includes(q);
    const matchesId = student.id.toLowerCase().includes(q);
    const matchesClass = student.classId.toLowerCase().includes(q);

    return matchesName || matchesId || matchesClass;
  });

  // KPI summaries calculations
  const totalBilled = filteredLedger.reduce((sum, r) => sum + r.billAmount, 0);
  const totalCollected = filteredLedger.reduce((sum, r) => sum + r.paidAmount, 0);
  const totalOutstanding = filteredLedger.reduce((sum, r) => sum + r.balance, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Trigger recording payment modal
  const handleOpenPayModal = (record: FinancialRecord) => {
    const studentObj = activeStudentsList.find(s => s.id === record.studentId);
    if (!studentObj) return;

    setActiveStudent(studentObj);
    setActiveLedgerItem(record);
    setPaymentAmount(Math.min(300, record.balance).toString()); // suggest some installment default
    setPaymentMethod('MoMo');
    setFormMomoPhone(momoPhoneNumber);
    setFormMomoProvider(momoProvider);
    setMomoStep(null);
    setIsProcessingMomo(false);
    setIsPayModalOpen(true);
  };

  // Payment execution
  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || !activeLedgerItem) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      onTriggerToast("Please specify a valid payment amount greater than 0.", "error");
      return;
    }

    if (amt > activeLedgerItem.balance) {
      onTriggerToast(`Specified amount surpasses outstanding balance of GH₵ ${activeLedgerItem.balance}.`, "error");
      return;
    }

    if (paymentMethod === 'MoMo' && simulateMomoPin) {
      // Simulate MoMo pin loop
      setIsProcessingMomo(true);
      setMomoStep('authorizing');
      
      await new Promise(resolve => setTimeout(resolve, 1800)); // Simulate carrier processing delay
      
      setMomoStep('approved');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setIsProcessingMomo(false);
      setMomoStep(null);
    }

    onRecordPayment(activeStudent.id, amt, paymentMethod, formMomoPhone, formMomoProvider);
    onTriggerToast(`Succeeded! GH₵ ${amt} applied to student ${activeStudent.name}.`, "success");
    setIsPayModalOpen(false);
  };

  // Bulk Invoicing execution
  const handleExecuteBulkInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(bulkAmount);
    if (isNaN(amt) || amt <= 0) {
      onTriggerToast("Please specify a valid billing amount.", "error");
      return;
    }

    onUpdateBulkInvoice(bulkClass, amt);
    onTriggerToast(`Bulk invoice applied successfully! All active enrolled students in ${bulkClass} billed GH₵ ${amt}.`, "success");
    setIsInvoiceModalOpen(false);
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full" id="fees-ledger-container">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-black text-on-background flex items-center gap-2">
            <span>💳</span> Smart Fees Tracker Ledger
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Record term invoices, schedule student installments, and coordinate real-time Mobile Money (MoMo) payments.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsInvoiceModalOpen(true)}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <span>📊</span> Standard Bulk Bill Class
          </button>
        </div>
      </div>

      {/* Global Academic context header details */}
      <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
            Academic Year: <strong className="text-slate-800 font-bold">{selectedAcademicYear}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
            Global Active Semester: <strong className="text-slate-800 font-bold">{activeTerm}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
            Integration channel: <strong className="text-green-700 font-bold">Paystack MoMo Auto-Record Active</strong>
          </span>
        </div>
        <div className="bg-blue-50 text-blue-700 font-extrabold text-[10px] px-2.5 py-1 rounded-sm uppercase tracking-wider select-none border border-blue-100">
          Financial Management Active
        </div>
      </div>

      {/* Financial Summary statistics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Total Bills Invoiced</span>
            <div className="text-xl font-bold font-mono text-slate-800">
              GH₵ {totalBilled.toLocaleString()}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Billed for {filteredLedger.length} active students.</p>
          <div className="absolute top-3 right-3 text-2xl text-slate-100 font-black">💵</div>
        </div>

        <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Total Fees Collected</span>
            <div className="text-xl font-bold font-mono text-emerald-700">
              GH₵ {totalCollected.toLocaleString()}
            </div>
          </div>
          <p className="text-[10px] text-emerald-650 mt-2 font-semibold">Funds received in institutional accounts.</p>
          <div className="absolute top-3 right-3 text-2xl text-slate-100 font-black">💰</div>
        </div>

        <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Balance Outstanding</span>
            <div className="text-xl font-bold font-mono text-amber-700">
              GH₵ {totalOutstanding.toLocaleString()}
            </div>
          </div>
          <p className="text-[10px] text-amber-600 mt-2 font-semibold">Pending physical or electronic collections</p>
          <div className="absolute top-3 right-3 text-2xl text-slate-200 font-black">⚠️</div>
        </div>

        <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Collection Rate</span>
            <div className="text-2xl font-black text-indigo-700 font-mono">
              {collectionRate}%
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div 
              style={{ width: `${collectionRate}%` }} 
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
            />
          </div>
          <div className="absolute top-3 right-3 text-2xl text-slate-100 font-black">📈</div>
        </div>

      </div>

      {/* Sorting, Classes and Search toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-outline-variant/65">
        
        {/* Classes Selector */}
        <div className="flex flex-wrap gap-1 bg-slate-200/60 p-1 rounded-lg border border-slate-300/35">
          <button
            onClick={() => setSelectedClass('All Classes')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              selectedClass === 'All Classes'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/30'
            }`}
          >
            All Classes ({activeStudentsList.length})
          </button>
          {classes.map(cl => (
            <button
              key={cl}
              onClick={() => setSelectedClass(cl)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                selectedClass === cl
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/30'
              }`}
            >
              {cl} ({activeStudentsList.filter(s => s.classId === cl).length})
            </button>
          ))}
        </div>

        {/* Query bar */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or record ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-outline-variant focus:outline-hidden focus:ring-1 focus:ring-[#2563eb] rounded-lg bg-white"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Fees ledger table */}
      <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-xs">
        {filteredLedger.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2 select-none">
            <span className="text-3xl">🗂️</span>
            <p className="text-sm font-bold text-slate-700">No matching student bill found</p>
            <p className="text-xs text-slate-500 max-w-xs">
              No bills match your current active query filters: "{selectedClass}" class and query "{searchQuery}".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase border-b border-outline-variant select-none">
                  <th className="px-5 py-3">Student ID</th>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Class cohort</th>
                  <th className="px-5 py-3">Terms Bill</th>
                  <th className="px-5 py-3">Amount Paid</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Outstanding balance</th>
                  <th className="px-5 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredLedger.map((record) => {
                  const percentPaid = record.billAmount > 0 
                    ? Math.round((record.paidAmount / record.billAmount) * 100) 
                    : 0;
                  
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/45 transition-all">
                      <td className="px-5 py-4 font-mono font-bold text-slate-800">{record.studentId}</td>
                      <td className="px-5 py-4 text-slate-950 font-bold text-sm">
                        {record.studentName}
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-[11.5px]">{record.classId}</td>
                      <td className="px-5 py-4 font-mono text-slate-800">GH₵ {record.billAmount}</td>
                      <td className="px-5 py-4 space-y-1">
                        <div className="font-mono text-emerald-700 font-bold">GH₵ {record.paidAmount}</div>
                        <div className="w-24 bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${percentPaid}%` }} 
                            className={`h-full rounded-full ${percentPaid >= 100 ? 'bg-green-500' : percentPaid > 0 ? 'bg-amber-500' : 'bg-red-400'}`}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {record.balance === 0 ? (
                          <span className="bg-green-50 text-green-700 border border-green-200/60 text-[10px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap">
                            Perfect balance
                          </span>
                        ) : record.paidAmount > 0 ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap">
                            Partial payment
                          </span>
                        ) : (
                          <span className="bg-red-50 text-red-700 border border-red-200/60 text-[10px] font-black uppercase px-2.5 py-1 rounded-full whitespace-nowrap">
                            Completely unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-sm">
                        <span className={`font-bold ${record.balance > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                          GH₵ {record.balance}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {record.balance > 0 ? (
                          <button
                            onClick={() => handleOpenPayModal(record)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer mx-auto shadow-xs transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Record Payment</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-bold italic text-[11px] flex items-center justify-center gap-1 select-none">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: RECORD STUDENT PAYMENT */}
      {isPayModalOpen && activeStudent && activeLedgerItem && (
        <div className="fixed inset-0 z-50 bg-[#070e17]/80 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant max-w-md w-full overflow-hidden animate-fade-in text-left">
            
            {/* Header */}
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm flex items-center gap-1.5">
                  <span>Record installment entry</span>
                </h3>
                <p className="text-[10px] text-emerald-100 font-medium mt-0.5">
                  Balance reduction log for {activeStudent.name}.
                </p>
              </div>
              <button 
                onClick={() => setIsPayModalOpen(false)}
                disabled={isProcessingMomo}
                className="text-white/85 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleExecutePayment} className="p-6 space-y-4">
              
              {/* Student Metadata Card */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-slate-450" />
                  <span>Verified Debtor Info</span>
                </div>
                <div className="font-extrabold text-slate-900 text-sm mt-1">{activeStudent.name}</div>
                <div className="flex justify-between items-center text-xs text-slate-600 font-semibold mt-0.5 font-mono">
                  <span>ID: {activeStudent.id}</span>
                  <span>Cohort: {activeStudent.classId}</span>
                </div>
              </div>

              {/* Balance & Invoicing status */}
              <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg text-xs">
                <div>
                  <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-500">Term Standard Bill</span>
                  <div className="font-mono font-extrabold text-slate-800 text-[12.5px] mt-0.5">
                    GH₵ {activeLedgerItem.billAmount}
                  </div>
                </div>
                <div>
                  <span className="text-[9.5px] uppercase font-black tracking-wider text-amber-700">Outstanding Balance</span>
                  <div className="font-mono font-black text-amber-800 text-[12.5px] mt-0.5">
                    GH₵ {activeLedgerItem.balance}
                  </div>
                </div>
              </div>

              {/* Installment payment amount */}
              <div className="space-y-1">
                <label className="text-[10.5px] uppercase font-extrabold tracking-wide text-slate-500">Installment payment (GH₵)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold select-none text-xs">GH₵</span>
                  <input
                    type="number"
                    required
                    disabled={isProcessingMomo}
                    min="1"
                    max={activeLedgerItem.balance}
                    step="0.01"
                    placeholder="e.g. 500"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Payment Method toggle */}
              <div className="space-y-1">
                <label className="text-[10.5px] uppercase font-extrabold tracking-wide text-slate-500 block">Payment gateway Method</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    disabled={isProcessingMomo}
                    onClick={() => setPaymentMethod('Cash')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>💵</span> Cash Handover
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingMomo}
                    onClick={() => setPaymentMethod('MoMo')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'MoMo'
                        ? 'bg-blue-50 border-blue-300 text-blue-850'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>📱</span> Mobile Money
                  </button>
                </div>
              </div>

              {/* MoMo dynamic options */}
              {paymentMethod === 'MoMo' && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 animate-fade-in text-[11px]">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400">Carrier Provider</span>
                      <select
                        disabled={isProcessingMomo}
                        value={formMomoProvider}
                        onChange={(e) => setFormMomoProvider(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-300 bg-white rounded px-2 py-1"
                      >
                        <option value="MTN MoMo">MTN MoMo</option>
                        <option value="Telecel Cash">Telecel Cash</option>
                        <option value="AT Money">AT Money</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400">Phone Number</span>
                      <input
                        type="tel"
                        disabled={isProcessingMomo}
                        placeholder="e.g. 0244123456"
                        value={formMomoPhone}
                        onChange={(e) => setFormMomoPhone(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-300 bg-white rounded px-2 py-1 font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                    <input
                      type="checkbox"
                      disabled={isProcessingMomo}
                      checked={simulateMomoPin}
                      onChange={(e) => setSimulateMomoPin(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-bold">Simulate Carrier PIN authorization handshake</span>
                  </label>

                  {isProcessingMomo && (
                    <div className="bg-white border border-slate-250 p-3 rounded-lg text-center font-bold text-slate-800 space-y-2">
                      {momoStep === 'authorizing' && (
                        <div className="space-y-2 animate-pulse">
                          <div className="mx-auto w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin" />
                          <p className="text-slate-600 text-xs">Prompting PIN request on {formMomoPhone}...</p>
                        </div>
                      )}
                      
                      {momoStep === 'approved' && (
                        <div className="space-y-1 text-emerald-700 animate-bounce">
                          <div>✅</div>
                          <p className="text-xs font-black">Authorized securely by network!</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessingMomo}
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingMomo}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve transaction entry</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK INVOICING METHOD */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#070e17]/80 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant max-w-md w-full overflow-hidden animate-fade-in text-left">
            
            {/* Header */}
            <div className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm flex items-center gap-1.5">
                  <span>Standard bulk billing configurations</span>
                </h3>
                <p className="text-[10px] text-indigo-100 font-medium mt-0.5">
                  Overwrites invoice expectations for all students inside a chosen class cohort.
                </p>
              </div>
              <button 
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-white/85 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleExecuteBulkInvoice} className="p-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10.5px] uppercase font-extrabold tracking-wide text-slate-500">Pick Target Class</label>
                <select
                  value={bulkClass}
                  onChange={(e) => setBulkClass(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white font-semibold text-slate-700 font-sans"
                >
                  {classes.map(cl => (
                    <option key={cl} value={cl}>{cl}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] uppercase font-extrabold tracking-wide text-slate-500">Termly Bill Amount (GH₵)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold select-none text-xs">GH₵</span>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 1800"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  This bulk billing action sets standard invoiced fees. Each active student's balance is instantly adjusted corresponding to their paid ledger logs.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4 cursor-pointer" />
                  <span>Update bulk accounts</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
