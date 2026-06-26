/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ShieldCheck, 
  Database, 
  Lock, 
  FileSpreadsheet, 
  UserCheck, 
  ServerCrash,
  EyeOff,
  FolderLock,
  Globe,
  FileText
} from 'lucide-react';

interface PrivacyPolicyViewProps {
  onBackToDashboard?: () => void;
}

export default function PrivacyPolicyView({ onBackToDashboard }: PrivacyPolicyViewProps) {
  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto h-full" id="privacy-policy-view-container">
      {/* View Header */}
      <div className="border-b border-outline-variant pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-background flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span>Student Data Privacy &amp; Security Protocol</span>
          </h2>
          <p className="text-xs text-on-surface-variant">Formal administrative disclosure on data handling, client-side persistence, and security controls.</p>
        </div>
        {onBackToDashboard && (
          <button 
            onClick={onBackToDashboard}
            className="text-xs font-bold text-primary hover:text-surface-tint border border-primary/20 hover:border-primary/50 bg-primary/5 px-3.5 py-2 rounded-lg transition-all cursor-pointer"
          >
            Return to Dashboard
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Core Storage Mandate */}
          <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4 shadow-xs">
            <h3 className="font-bold text-sm text-on-background flex items-center gap-2 border-b border-outline-variant pb-3">
              <Database className="w-5 h-5 text-primary" />
              <span>1. Sandboxed Browser Persistence (`localStorage`)</span>
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              EduAdmin Pro is designed with an <strong>offline-first, client-side architecture</strong>. All records—including student catalogs, gender details, marks configuration split, and feedback comments—are stored exclusively in your browser’s isolated storage vault (using standard client-side <code>localStorage</code> technology).
            </p>
            <div className="p-4 bg-slate-50 border border-outline-variant/60 rounded-xl space-y-2">
              <h4 className="font-bold text-xs text-on-background flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-secondary" />
                <span>Zero External Transmission Safeguard</span>
              </h4>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                No educational information, scores, or identifiers are transmitted to third-party trackers, external server databases, or unsecured remote infrastructure. Your roster data remains localized inside this device sandbox at all times.
              </p>
            </div>
          </div>

          {/* Card 2: Security Controls */}
          <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4 shadow-xs">
            <h3 className="font-bold text-sm text-on-background flex items-center gap-2 border-b border-outline-variant pb-3">
              <Lock className="w-5 h-5 text-primary" />
              <span>2. District-Level Integrity Locks</span>
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              To guarantee that continuous assessments are not corrupted or modified accidentally by alternative users, the application implements a strict <strong>Gradebook Seal Protocol</strong>.
            </p>
            <ul className="space-y-3 text-xs text-on-surface-variant">
              <li className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                <span><strong>Prevent Accidental Re-writeover:</strong> Once term scores are completed, activating the "Lock Term Grades" toggle freezes inputs completely, blocking any typing or value adjustments.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                <span><strong>Operator Validation Audit:</strong> Real-time alerts highlight if a cohort lacks scores or has incomplete weights, securing high-fidelity data integrity before records are certified.</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Download & Export Guidelines */}
          <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4 shadow-xs">
            <h3 className="font-bold text-sm text-on-background flex items-center gap-2 border-b border-outline-variant pb-3">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span>3. Exported Data Security &amp; Compliance</span>
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              When exporting registers to CSV, Excel (XLS), or printing high-resolution PDF terminal cards, the responsibility of handling physical and digital outputs transfers to the District Registrar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 border border-red-100 bg-red-50/40 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-red-900 uppercase">Physical Disposal</span>
                <p className="text-[11px] text-red-800 leading-normal">
                  Printed progress cards or marks sheets must be shredded immediately after institutional distribution to prevent unauthorized student identification.
                </p>
              </div>
              <div className="p-3.5 border border-primary/10 bg-primary/5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-primary uppercase">Digital Transfer</span>
                <p className="text-[11px] text-on-surface-variant leading-normal">
                  Always use secure, encrypted communication options (WPA2/WPA3 network protocols) when forwarding exported CSV datasets to regional hubs.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Widgets (Right 1 Column) */}
        <div className="space-y-6">
          
          {/* Compliance Card Badge */}
          <div className="bg-linear-to-b from-[#0b1d2d] to-[#081521] text-white border border-[#38485a]/30 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#2563eb]/20 rounded-lg text-[#2563eb] border border-[#2563eb]/30">
                <FolderLock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Regulatory Compliance</h4>
                <p className="text-[10px] text-slate-400 font-mono">WEST-AFRICA EDU PRIVACY</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-normal">
              EduAdmin Pro adheres natively to regulatory educational privacy guidelines. No telemetry, IP locations, student profiles, or assessment indicators are gathered by software makers.
            </p>

            <div className="pt-2 border-t border-[#38485a]/40 text-[11px] text-slate-400 space-y-1">
              <p className="flex justify-between">
                <span>Compliance Rating:</span>
                <span className="font-bold text-[#4ade80]">Class A (Excellent)</span>
              </p>
              <p className="flex justify-between">
                <span>Database Sync Type:</span>
                <span className="font-bold text-white font-mono">Local Isolation</span>
              </p>
            </div>
          </div>

          {/* Core Security Checklist */}
          <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4 shadow-xs">
            <h4 className="font-bold text-xs text-on-background uppercase tracking-wider pb-1 border-b border-outline-variant">
              Privacy Best Practices
            </h4>
            <div className="space-y-3">
              
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✓
                </div>
                <div>
                  <h5 className="font-bold text-xs text-on-background">Device Locking</h5>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                    Avoid leaving active browser screens open on shared computers in public staff rooms.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✓
                </div>
                <div>
                  <h5 className="font-bold text-xs text-on-background">Cache Cleaning</h5>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                    Clear local browser cache on session completion if executing assessments on temporary devices.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✓
                </div>
                <div>
                  <h5 className="font-bold text-xs text-on-background">Backup Security</h5>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                    Safeguard your manual files in password-secured USB vectors.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Transparency Disclosures */}
          <div className="bg-slate-50 border border-outline-variant/60 rounded-2xl p-6 space-y-3 text-xs leading-relaxed text-on-surface-variant">
            <h4 className="font-bold text-on-background text-xs">Security Disclosures</h4>
            <p className="text-[11px]">
              Stored data persists indefinitely on your device until local website data or browser storage is wiped. You have 100% control over resetting registration database counters or deleting specific student score models inside the <strong>Student Register</strong> console.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
