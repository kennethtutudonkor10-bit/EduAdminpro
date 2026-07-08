import { useState, useEffect } from 'react';
import { 
  Bot, 
  Cpu, 
  Play, 
  Check, 
  X, 
  ShieldAlert, 
  Clock, 
  HelpCircle, 
  Info, 
  RefreshCw, 
  Settings, 
  Activity, 
  Users, 
  Database, 
  ArrowRight, 
  Sparkles,
  Award,
  DollarSign,
  Mail,
  Copy,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Student, Score, FinancialRecord } from '../types';
import { apiFetch } from '../lib/api';

interface AIAgentConsoleViewProps {
  students: Student[];
  scores: Score[];
  financialLedger: FinancialRecord[];
  onTriggerToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  onUpdateScores: (updatedScores: Score[]) => void;
  onUpdateFinancialLedger: (updatedLedger: FinancialRecord[]) => void;
  activeClass: string;
  activeSubject: string;
  activeTerm: string;
  selectedAcademicYear: string;
  classTier: string;
  geminiApiKey?: string;
  onNavigateToSettings?: () => void;
}

interface ProposedChange {
  id: string;
  type: 'update_remark' | 'update_grade';
  targetId: string;
  targetName: string;
  subjectId: string;
  termId: string;
  fieldName: string;
  oldValue: string | number;
  newValue: string | number;
  description: string;
}

interface DiagnosticInfo {
  academicClass: string;
  activeSubject: string;
  schoolTier: string;
  sessionContext: string;
  timestamp: string;
}

export default function AIAgentConsoleView({
  students,
  scores,
  financialLedger,
  onTriggerToast,
  onUpdateScores,
  onUpdateFinancialLedger,
  activeClass,
  activeSubject,
  activeTerm,
  selectedAcademicYear,
  classTier,
  geminiApiKey = '',
  onNavigateToSettings,
}: AIAgentConsoleViewProps) {
  const [userInput, setUserInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([]);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [agentResponseText, setAgentResponseText] = useState<string | null>(null);

  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [supportLogActive, setSupportLogActive] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticInfo | null>(null);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ themeName: string }>;
      const themeLabel = customEvent.detail?.themeName || 'Default (Premium Slate)';
      setExecutionLogs(prev => [
        ...prev,
        `System Theme: Swapped workspace skin to ${themeLabel}`
      ]);
    };
    window.addEventListener('edu_admin_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('edu_admin_theme_changed', handleThemeChange);
    };
  }, []);

  const gatherDiagnostics = (): DiagnosticInfo => {
    return {
      academicClass: activeClass,
      activeSubject: activeSubject,
      schoolTier: classTier,
      sessionContext: `Active: ${selectedAcademicYear} ${activeTerm}`,
      timestamp: new Date().toISOString()
    };
  };

  const handleTriggerSupportAgent = () => {
    const diag = gatherDiagnostics();
    setDiagnosticsData(diag);
    setSupportLogActive(true);
    setExecutionLogs([
      "INITIALIZING SYSTEM DIAGNOSTIC COMPILER...",
      `TIMESTAMP: ${diag.timestamp}`,
      "GATHERING ACTIVE COHORT CONTEXT MATRIX...",
      `- ACADEMIC CLASS: ${diag.academicClass}`,
      `- ACTIVE SUBJECT: ${diag.activeSubject}`,
      `- ACADEMIC TIER: ${diag.schoolTier}`,
      `- SESSION CONTEXT: ${diag.sessionContext}`,
      "DIAGNOSTIC SNAPSHOT SUCCESSFULLY RETRIEVED.",
      "CONNECTING TO SECURE SUPPORT PORTAL...",
      "DEVELOPER SUPPORT LINK READY BELOW."
    ]);
    onTriggerToast("System diagnostics compiled successfully.", "success");
  };

  const handleCopyEmailAddress = () => {
    navigator.clipboard.writeText("kennethdonkortutu@gmail.com");
    onTriggerToast("Support email address copied to clipboard!", "success");
    setExecutionLogs(prev => [
      ...prev,
      `[SYSTEMINFO] Contact email 'kennethdonkortutu@gmail.com' copied successfully.`
    ]);
  };

  const getMailToLink = () => {
    if (!diagnosticsData) return "#";
    const subject = `EduAdmin Pro Support - Diagnostic Log - ${diagnosticsData.academicClass}`;
    const body = `EduAdmin Pro - System Diagnostic Report
======================================
Timestamp: ${diagnosticsData.timestamp}
Academic Class: ${diagnosticsData.academicClass}
Active Subject: ${diagnosticsData.activeSubject}
School Tier: ${diagnosticsData.schoolTier}
Session Context: ${diagnosticsData.sessionContext}

Issue Status: Online Connection Active

--------------------------------------------------
Please describe your problem or bug below:



--------------------------------------------------
Report compiled on behalf of: kennethtutudonkor10@gmail.com`;
    return `mailto:kennethdonkortutu@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const presetInstructions = [
    {
      title: "Identify Outstanding Debts & Encourage Success",
      prompt: "Find students who owe tuition fees but have positive exam performance, and write an encouraging reminder to settle balances on their report card remark.",
      icon: Award
    },
    {
      title: "Encourage Struggling Cohorts",
      prompt: "Identify students with course marks below 40 in Mathematics and write constructive remediation advice in their terminal record remarks.",
      icon: Users
    },
    {
      title: "Apply Assessment Calibration Curve",
      prompt: "Apply a 5% grading curve to all student exam scores for the Senior High 1A Mathematics cohort.",
      icon: Cpu
    }
  ];

  const handleSelectPreset = (prompt: string) => {
    setUserInput(prompt);
  };

  const handleExecutePrompt = async () => {
    if (!userInput.trim()) {
      onTriggerToast("Please enter or select an instructor prompt first.", "error");
      return;
    }

    const inputLower = userInput.toLowerCase();
    const supportKeywords = ["help", "developer", "bug", "support", "kenneth"];
    const deservesSupport = supportKeywords.some(keyword => inputLower.includes(keyword));

    if (deservesSupport) {
      handleTriggerSupportAgent();
      return;
    }

    setIsExecuting(true);
    setExecutionLogs(["Connecting to backend AI compiler...", "Resolving student database schema context..."]);
    setProposedChanges([]);
    setAgentResponseText(null);

    try {
      const response = await apiFetch("/api/ai-execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: userInput,
        })
      });

      if (!response.ok) {
        throw new Error(`Execution error: Fail code ${response.status}`);
      }

      const data = await response.json();
      
      setExecutionLogs(data.logs || ["Analysis finished."]);
      setProposedChanges(data.proposedChanges || []);
      setAgentResponseText(data.message || "Task parsed successfully.");

      if (data.proposedChanges && data.proposedChanges.length > 0) {
        setIsApprovalModalOpen(true);
        onTriggerToast(`Generated ${data.proposedChanges.length} proposed database update requests! Review required.`, "info");
      } else {
        onTriggerToast("AI agent completed analysis. No write recommendations generated.", "info");
      }
    } catch (error: any) {
      console.error(error);
      setExecutionLogs(prev => [...prev, `Runtime failure: ${error.message}`]);
      onTriggerToast("Could not contact the active AI Agentic compiler.", "error");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApproveChanges = () => {
    if (proposedChanges.length === 0) return;

    let localScores = [...scores];
    let localLedger = [...financialLedger];
    let scoresUpdated = false;
    let ledgerUpdated = false;

    proposedChanges.forEach(change => {
      if (change.type === 'update_remark') {
        const scoreIndex = localScores.findIndex(
          s => s.studentId === change.targetId && 
               s.subjectId === change.subjectId && 
               s.termId === change.termId
        );

        if (scoreIndex !== -1) {
          localScores[scoreIndex] = {
            ...localScores[scoreIndex],
            remark: String(change.newValue)
          };
          scoresUpdated = true;
        } else {
          // If no score record exists, instantiate a fallback score row
          localScores.push({
            studentId: change.targetId,
            subjectId: change.subjectId,
            termId: change.termId,
            remark: String(change.newValue)
          });
          scoresUpdated = true;
        }
      } else if (change.type === 'update_grade') {
        const scoreIndex = localScores.findIndex(
          s => s.studentId === change.targetId && 
               s.subjectId === change.subjectId && 
               s.termId === change.termId
        );

        if (scoreIndex !== -1) {
          localScores[scoreIndex] = {
            ...localScores[scoreIndex],
            [change.fieldName]: Number(change.newValue)
          };
          scoresUpdated = true;
        }
      }
    });

    if (scoresUpdated) {
      onUpdateScores(localScores);
    }
    if (ledgerUpdated) {
      onUpdateFinancialLedger(localLedger);
    }

    onTriggerToast(`Successfully executed ${proposedChanges.length} database updates!`, "success");
    setIsApprovalModalOpen(false);
    setProposedChanges([]);
  };

  return (
    <div className="space-y-6">

      {/* API key warning */}
      {!geminiApiKey && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-semibold text-amber-800">
          <span>No Gemini API key configured. The AI agent will run in offline simulation mode until you add one.</span>
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="whitespace-nowrap px-3 py-1.5 bg-amber-200 hover:bg-amber-300 rounded-lg font-bold transition-colors cursor-pointer"
            >
              Add Key
            </button>
          )}
        </div>
      )}

      {/* Title & Explanatory Lead */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#c3c6d7]/30 pb-4">
        <div>
          <h2 className="text-xl font-black text-[#0b1c30] flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#2563eb]" /> Agentic AI Integration Console
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Deploy function-calling models to autonomous analyze class scores, perform localized curve math, or generate report card commentary.
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 text-[9px] bg-[#dcfce7] text-[#15803d] px-2.5 py-1 rounded-full font-bold border border-[#bbf7d0]">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
          <span>Function Calling Sandbox Active</span>
        </div>
      </div>

      {/* 4-Step Cycle Interactive Visualizer */}
      <div className="bg-white p-5 rounded-xl border border-[#c3c6d7]/35 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#2563eb]" />
          <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
            How It Works: The 4-Step Cycle
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          {/* Step 1 */}
          <div className="bg-[#f8f9ff] p-4 rounded-lg border border-slate-100 flex flex-col justify-between space-y-2">
            <div>
              <div className="w-7 h-7 rounded-md bg-[#2563eb]/10 text-[#2563eb] font-mono text-xs font-black flex items-center justify-center mb-2">
                1
              </div>
              <h4 className="text-xs font-black text-[#0b1c30]">Administrator Prompt</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                You enter natural language commands instructing updates or analytics.
              </p>
            </div>
            <div className="hidden md:flex justify-end pt-1">
              <ArrowRight className="w-4 h-4 text-slate-350" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#f8f9ff] p-4 rounded-lg border border-slate-100 flex flex-col justify-between space-y-2">
            <div>
              <div className="w-7 h-7 rounded-md bg-[#2563eb]/10 text-[#2563eb] font-mono text-xs font-black flex items-center justify-center mb-2">
                2
              </div>
              <h4 className="text-xs font-black text-[#0b1c30]">AI Brain &amp; Strategy</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                Gemini decides which database endpoints (tools) are required to fulfill needs.
              </p>
            </div>
            <div className="hidden md:flex justify-end pt-1">
              <ArrowRight className="w-4 h-4 text-slate-350" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#f8f9ff] p-4 rounded-lg border border-slate-100 flex flex-col justify-between space-y-2">
            <div>
              <div className="w-7 h-7 rounded-md bg-[#2563eb]/10 text-[#2563eb] font-mono text-xs font-black flex items-center justify-center mb-2">
                3
              </div>
              <h4 className="text-xs font-black text-[#0b1c30]">Function Tool Calls</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                SDK signals back requested tool call configurations and arguments context.
              </p>
            </div>
            <div className="hidden md:flex justify-end pt-1">
              <ArrowRight className="w-4 h-4 text-slate-350" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-[#f8f9ff] p-4 rounded-lg border border-slate-100 space-y-2">
            <div className="w-7 h-7 rounded-md bg-[#2563eb]/10 text-[#2563eb] font-mono text-xs font-black flex items-center justify-center mb-2">
              4
            </div>
            <h4 className="text-xs font-black text-[#0b1c30]">Local Execution</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
              Local system executes parameters, generates updates, and updates the view on safety check.
            </p>
          </div>
        </div>
      </div>

      {/* Main Sandbox Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Playbook / Actions Panel Column */}
        <div className={`${isTerminalCollapsed ? "lg:col-span-12" : "lg:col-span-12 xl:col-span-7"} space-y-4`}>
          <div className="bg-white p-5 rounded-xl border border-[#c3c6d7]/35 shadow-sm space-y-5">
            <div>
              <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-[#2563eb]" /> Deploy Agent Prompt
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Select a preset database query playbook or draft a custom structured instruction below to let the AI agent execute.
              </p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {presetInstructions.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p.prompt)}
                    className="p-3 text-left bg-slate-50 hover:bg-[#2563eb]/5 border border-slate-150 hover:border-[#2563eb]/30 rounded-lg transition-all space-y-2 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-white border border-slate-200 text-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white transition-all">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{p.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-3 leading-relaxed">
                      "{p.prompt}"
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Prompt Form Input */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Instruction Input Panel
              </label>
              <div className="relative">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Draft system instruction detail (e.g. Find students with exam score above 60 and write comments...)"
                  rows={3}
                  className="w-full text-xs font-semibold p-4 bg-[#f8f9ff] border border-[#c3c6d7]/45 rounded-lg pr-12 focus:ring-1 focus:ring-[#2563eb] focus:outline-hidden text-[#0b1c30] placeholder-slate-400"
                ></textarea>
                
                <button
                  onClick={handleExecutePrompt}
                  disabled={isExecuting || !userInput.trim()}
                  className="absolute right-3 bottom-4 text-white bg-[#2563eb] hover:bg-blue-650 disabled:opacity-40 p-2 rounded-lg transition-all cursor-pointer inline-flex items-center"
                >
                  {isExecuting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Safety Safeguards & Isolation Rules Info */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-150 space-y-4">
            <div className="flex items-center gap-2 text-rose-850">
              <ShieldAlert className="w-4 h-4 text-rose-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-800">
                Active System Safety &amp; Isolation Guardrails
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 text-slate-700">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight block">
                  A. Human-in-the-Loop
                </span>
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                  Write commands never execute raw changes, instead displaying a detailed verification dialog listing proposed differences.
                </p>
              </div>

              <div className="space-y-1 text-slate-700">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight block">
                  B. Scope Restrictions
                </span>
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                  The API possesses strictly read-write limits. Destruction endpoints like drops or deletes are blocked from the tool registry.
                </p>
              </div>

              <div className="space-y-1 text-slate-700">
                <span className="text-[10px] font-black text-[#0b1c30] uppercase tracking-tight block">
                  C. Mathematical Isolation
                </span>
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                  AI decides target scopes, returning clean adjustment factors (e.g. +5 marks) while letting vetted local system functions handle calculation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Agent Execution Logs Column */}
        {!isTerminalCollapsed ? (
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col min-h-[340px]">
            <div className="bg-slate-900 text-slate-200 p-5 rounded-xl border border-slate-800 flex-1 flex flex-col overflow-hidden shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2563eb]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#2563eb]">
                    AI Administrative Copilot
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-950 p-1 rounded">
                    Live Status
                  </span>
                  <button
                    onClick={() => {
                      setIsTerminalCollapsed(true);
                      onTriggerToast("Terminal collapsed. Use the floating action button to restore.", "info");
                    }}
                    className="p-1 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                    title="Collapse Copilot Terminal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action chip banner inside the terminal */}
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 animate-pulse">
                  <span className="text-[10.5px] font-bold text-slate-300 block">SYSTEM DIAGNOSTIC FLOW</span>
                  <p className="text-[9.5px] text-emerald-400 font-mono leading-tight">Secure developer channel initialized</p>
                </div>
                <button
                  onClick={handleTriggerSupportAgent}
                  className="px-3 py-1.5 bg-violet-750 hover:bg-violet-700 active:bg-violet-800 border border-violet-500/20 text-white rounded text-[10.5px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-violet-700 hover:bg-violet-600"
                >
                  <Users className="w-3.5 h-3.5 text-violet-300" />
                  <span>Contact Developer Support Agent</span>
                </button>
              </div>

              {/* Trace log print entries */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10.5px] max-h-[170px] min-h-[120px] bg-slate-950 p-3 rounded-lg text-emerald-400">
                {executionLogs.length === 0 ? (
                  <div className="text-slate-500 italic flex items-center justify-center h-full text-center">
                    Waiting to receive execution request or developer support trigger...
                  </div>
                ) : (
                  executionLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-[#2563eb] font-bold select-none">&gt;</span>
                      <span className="leading-relaxed whitespace-pre-wrap">{log}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Beautiful, rounded developer support visual card */}
              {supportLogActive && diagnosticsData && (
                <div className="bg-slate-950 border border-violet-500/30 rounded-xl p-4 space-y-3.5 animate-fade-in text-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-violet-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">
                        DEVELOPER SUPPORT CARD
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded">
                      CHANNEL ACTIVE
                    </span>
                  </div>

                  {/* Diagnostics state indicators */}
                  <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 block">CLASS</span>
                      <span className="text-slate-300 font-bold">{diagnosticsData.academicClass}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-500 block">SUBJECT</span>
                      <span className="text-slate-300 font-bold">{diagnosticsData.activeSubject}</span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      <span className="text-slate-500 block">TIER</span>
                      <span className="text-slate-300 font-bold">{diagnosticsData.schoolTier}</span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      <span className="text-slate-500 block">SESSION</span>
                      <span className="text-slate-300 font-bold">{diagnosticsData.sessionContext}</span>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-400 font-medium">
                    The diagnostics log is securely packaged. Select your visual log transmission method:
                  </p>

                  <div className="flex gap-2.5">
                    <a
                      href={getMailToLink()}
                      className="flex-1 py-2 px-3 text-xs font-bold text-center bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all flex items-center justify-center gap-2 border border-violet-500/25 cursor-pointer shadow-sm select-none"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Email Logs</span>
                    </a>
                    <button
                      onClick={handleCopyEmailAddress}
                      className="flex-1 py-1.5 px-3 text-xs font-bold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm select-none"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Email Address</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AI Agent Commentary response summary */}
              {agentResponseText && !supportLogActive && (
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg space-y-1.5 animate-fade-in">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block">
                    AI Commentary Output
                  </span>
                  <p className="text-[11px] font-semibold text-slate-300 leading-normal font-sans">
                    {agentResponseText}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Floating expand state trigger handle if collapsed */}
        {isTerminalCollapsed && (
          <button
            onClick={() => {
              setIsTerminalCollapsed(false);
              onTriggerToast("Terminal interface expanded.", "success");
            }}
            className="fixed bottom-6 right-6 z-45 px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500 text-white font-black text-xs rounded-full shadow-2xl flex items-center gap-2.5 transition-all cursor-pointer animate-pulse shrink-0"
          >
            <Bot className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span>Show Copilot Terminal</span>
          </button>
        )}
      </div>

      {/* Human-in-the-Loop Approval Confirmation Modal */}
      {isApprovalModalOpen && proposedChanges.length > 0 && (
        <div className="fixed inset-0 z-50 bg-[#0b1c30]/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Human-In-The-Loop Security Check
                  </h3>
                  <span className="text-[9.5px] uppercase font-bold text-amber-300/80 font-sans block mt-0.5">
                    Authorized Administrator Review Required
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-amber-50 rounded-lg p-3.5 border border-amber-200 text-[11px] text-amber-800 font-medium leading-relaxed flex gap-2.5">
                <Info className="w-4.5 h-4.5 shrink-0 text-amber-600" />
                <div>
                  <strong>Attention Registrar:</strong> Before the AI system can write proposed updates back to persistent local storage tables, you must review and grant explicit approval. Rejecting will purge the recommended snapshot.
                </div>
              </div>

              {/* Proposed Differences List */}
              <div className="border border-slate-150 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-4 py-2 text-[10px] font-black uppercase text-slate-500 border-b border-slate-150 tracking-wide">
                  Proposed Database Record Transactions ({proposedChanges.length})
                </div>
                <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                  {proposedChanges.map((change) => (
                    <div key={change.id} className="p-3 bg-white hover:bg-slate-50 transition-all text-xs font-semibold">
                      <div className="flex justify-between items-start gap-3 mb-1">
                        <div>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded mr-2 font-mono">
                            {change.type === 'update_remark' ? 'remark_write' : 'score_curve'}
                          </span>
                          <strong className="text-slate-800">{change.targetName}</strong> <span className="text-slate-400">({change.targetId})</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {change.subjectId} &bull; {change.termId}
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                        {change.description}
                      </p>
                      
                      {/* Before / After Difference Bubble */}
                      <div className="mt-2 grid grid-cols-2 gap-3 p-2 bg-slate-50/70 border border-slate-150/50 rounded-lg font-mono text-[10px]">
                        <div>
                          <span className="text-slate-400 block uppercase tracking-wide text-[8.5px] font-sans">Previous Value</span>
                          <span className="text-rose-700 font-bold line-through truncate block">
                            {change.oldValue === '' ? '[Blank]' : String(change.oldValue)}
                          </span>
                        </div>
                        <div className="border-l border-slate-200 pl-3">
                          <span className="text-slate-450 block uppercase tracking-wide text-[8.5px] font-sans">Proposed Value</span>
                          <span className="text-emerald-700 font-bold truncate block">
                            {String(change.newValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-150 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition-all cursor-pointer"
              >
                Reject &amp; Purge Recommendations
              </button>
              <button
                type="button"
                onClick={handleApproveChanges}
                className="bg-[#2563eb] hover:bg-blue-650 text-white font-extrabold text-xs py-2 px-5 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Approve &amp; Commit Transactions</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
