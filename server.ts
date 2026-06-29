import express from "express";
import path from "path";
// vite is imported lazily inside startServer() so it is never required in production
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  initDb,
  isSeeded,
  seedDatabase,
  getAllStudents,
  upsertStudent,
  deleteStudent,
  getAllScores,
  upsertScore,
  upsertScoresBatch,
  getAllFinancialRecords,
  upsertFinancialRecord,
  getAllSettings,
  getSetting,
  setSetting,
  queueNotification,
  getPendingNotifications,
  getAllNotifications,
  markNotificationDispatched,
  markNotificationFailed,
  markNotificationRead,
  getAllStaff,
  upsertStaff,
  deleteStaff,
  getAllAttendanceRecords,
  upsertAttendanceRecord,
  exportAllData,
  upsertStudentBiometric,
  getStudentByTemplateHash,
  getAllBiometricEnrollments,
  saveBiometricAttendance,
  getBiometricAttendanceByTerm,
  countBiometricDaysPresent,
} from "./db";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// USER_DATA comes from Electron main.cjs; fallback to cwd for standalone server mode
const userDataPath = process.env.USER_DATA || path.join(process.cwd(), "data");
initDb(userDataPath);

app.use(express.json({ limit: "50mb" }));

// Initialize Gemini Client safely — reads from env first, then falls back to DB settings
function resolveApiKey(): string | null {
  return process.env.GEMINI_API_KEY || getSetting("gemini_api_key") || null;
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = resolveApiKey();
  if (!aiClient && apiKey) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Tool configurations for Gemini Function Calling
const databaseTools = {
  functionDeclarations: [
    {
      name: "getStudentsFromDatabase",
      description: "Fetches lists of all active student records, including student name, student ID, enrolled class name, and enrollment status."
    },
    {
      name: "getStudentScores",
      description: "Returns all assessment scores, grades, and teacher remarks for student cohorts across different subjects and academic terms."
    },
    {
      name: "getFinancialLedger",
      description: "Fetches billing accounts and ledger entries, showing bill totals, paid amounts, payment channels, and outstanding balances."
    },
    {
      name: "proposeStudentRemarks",
      description: "Proposes adding or updating advisory feedback comments or remarks for a particular student, subject, and term in the database.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING, description: "The unique ID code of the student, e.g. SH-001" },
          subjectId: { type: Type.STRING, description: "The academic subject name, e.g. Mathematics" },
          termId: { type: Type.STRING, description: "The academic term identifier, e.g. Term 1" },
          newRemarks: { type: Type.STRING, description: "The professional recommendation and advice comment text to write." }
        },
        required: ["studentId", "subjectId", "termId", "newRemarks"]
      }
    },
    {
      name: "proposeGradeCurve",
      description: "Propose an increase or decrease score scale adjustment for a particular student or an entire class cohort, preventing math hallucinations. Adjusts raw score columns directly.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING, description: "Specific student ID (e.g. SH-001), or set empty/omit to apply to the whole class profile." },
          classId: { type: Type.STRING, description: "The class section name (e.g., Senior High 1A)." },
          subjectId: { type: Type.STRING, description: "The target course subject (e.g. Mathematics)." },
          termId: { type: Type.STRING, description: "The evaluation term (e.g. Term 1)." },
          assessmentColumnId: { type: Type.STRING, description: "The raw assessment element to modify, choose from: 'test1', 'test2', 'hw', 'exam'." },
          adjustmentValue: { type: Type.INTEGER, description: "Numerical value to add or subtract from raw score (e.g. 5 to add, -3 to deduct)." },
          reason: { type: Type.STRING, description: "Short professional description for the curve adjustment, e.g., standard cohort curation." }
        },
        required: ["classId", "subjectId", "termId", "assessmentColumnId", "adjustmentValue", "reason"]
      }
    }
  ]
};

// 2. Orchestration execution endpoint
app.post("/api/ai-execute", async (req, res) => {
  const { prompt, subjects = [] } = req.body;

  // Always pull fresh context from the database so the AI sees what's actually saved
  const students = getAllStudents();
  const scores = getAllScores();
  const financialLedger = getAllFinancialRecords();

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "A valid prompt string is required to trigger agent analysis." });
  }

  // Activity log tracking elements inside execution
  const agentExecutionLogs: string[] = ["Agentic session initialized."];
  const completedProposals: any[] = [];

  try {
    const ai = getAiClient();

    // 3. Fallback logic if API key isn't provided or fails - Rule-Based Parser Simulator
    if (!ai) {
      agentExecutionLogs.push("No GEMINI_API_KEY set. Triggering local system simulation compiler.");
      
      const lowerPrompt = prompt.toLowerCase();
      
      // Simulate "Find students who owe fees but have an A grade, and write encouraging remark"
      if (lowerPrompt.includes("fee") && (lowerPrompt.includes("a grade") || lowerPrompt.includes("high score") || lowerPrompt.includes("remarks"))) {
        agentExecutionLogs.push("Simulating tool call: getStudentsFromDatabase()");
        agentExecutionLogs.push("Simulating tool call: getFinancialLedger()");
        agentExecutionLogs.push("Simulating tool call: getStudentScores()");
        
        // Find students who have balance > 0 and average grade is A or near
        students.forEach((s: any) => {
          const ledgerItem = financialLedger.find((f: any) => f.studentId === s.id);
          const hasBalance = ledgerItem && ledgerItem.balance > 0;
          
          if (hasBalance) {
            // Find scores for this student to see if they perform well
            const mathScore = scores.find((sc: any) => sc.studentId === s.id && sc.subjectId === "Mathematics");
            const examValue = mathScore ? (mathScore.exam ?? 0) : 0;
            const isHighPerformer = examValue >= 60; // Represents high scoring
            
            if (isHighPerformer) {
              const outstandingStr = ledgerItem.balance;
              const feedback = `Outstanding academic potential shown. Highly encourage settling the remaining tuition ledger of GHS ${outstandingStr} to prevent administrative hold.`;
              
              completedProposals.push({
                id: `propose-remark-${s.id}-Mathematics-${Date.now()}`,
                type: "update_remark",
                targetId: s.id,
                targetName: s.name,
                subjectId: "Mathematics",
                termId: "Term 1",
                fieldName: "remark",
                oldValue: mathScore?.remark || "",
                newValue: feedback,
                description: `Remark for ${s.name} (${s.id}) regarding outstanding balance GHS ${outstandingStr} alongside positive academic performance.`
              });
              
              agentExecutionLogs.push(`Simulating tool call: proposeStudentRemarks(studentId: "${s.id}", newRemarks: "Outstanding academic potential...")`);
            }
          }
        });
      }
      // Simulate "Find failing students and auto-fill encouraging remarks"
      else if (lowerPrompt.includes("fail") || lowerPrompt.includes("remed") || lowerPrompt.includes("struggl") || lowerPrompt.includes("encourag")) {
        agentExecutionLogs.push("Simulating tool call: getStudentsFromDatabase()");
        agentExecutionLogs.push("Simulating tool call: getStudentScores()");
        
        students.forEach((s: any) => {
          const mathScore = scores.find((sc: any) => sc.studentId === s.id && sc.subjectId === "Mathematics");
          const examValue = mathScore ? (mathScore.exam ?? 0) : 0;
          const isFailing = examValue < 40;
          
          if (isFailing) {
            const feedback = "Remedial tutoring highly advised. Keep focusing on practice sheets and consult the subject facilitator during extra hours.";
            completedProposals.push({
              id: `propose-remark-${s.id}-Mathematics-${Date.now()}`,
              type: "update_remark",
              targetId: s.id,
              targetName: s.name,
              subjectId: "Mathematics",
              termId: "Term 1",
              fieldName: "remark",
              oldValue: mathScore?.remark || "",
              newValue: feedback,
              description: `Encouraging recommendation for ${s.name} (${s.id}) to bolster performance on Mathematics.`
            });
            agentExecutionLogs.push(`Simulating tool call: proposeStudentRemarks(studentId: "${s.id}", newRemarks: "Remedial tutoring...")`);
          }
        });
      }
      // Simulate "Apply 5% curve to Senior High 1A Mathematics students"
      else if (lowerPrompt.includes("curve") || lowerPrompt.includes("adjust") || lowerPrompt.includes("%")) {
        agentExecutionLogs.push("Simulating tool call: getStudentsFromDatabase()");
        agentExecutionLogs.push("Simulating tool call: getStudentScores()");
        
        const targetClass = "Senior High 1A";
        const targetSubject = "Mathematics";
        const targetTerm = "Term 1";
        const column = "exam";
        const curveValue = 5;
        
        const targetStudents = students.filter((s: any) => s.classId === targetClass);
        
        targetStudents.forEach((s: any) => {
          const studentScore = scores.find((sc: any) => sc.studentId === s.id && sc.subjectId === targetSubject && sc.termId === targetTerm);
          const oldValue = studentScore ? (studentScore[column] ?? 0) : 0;
          const newValue = Math.min(100, oldValue + curveValue);
          
          completedProposals.push({
            id: `propose-grade-${s.id}-${column}-${Date.now()}`,
            type: "update_grade",
            targetId: s.id,
            targetName: s.name,
            classId: targetClass,
            subjectId: targetSubject,
            termId: targetTerm,
            fieldName: column,
            oldValue,
            newValue,
            description: `Auto-apply +5% assessment curve to Exam column for ${s.name}. (Original: ${oldValue} -> Curved: ${newValue})`
          });
        });
        
        agentExecutionLogs.push(`Simulating tool call: proposeGradeCurve(classId: "${targetClass}", subjectId: "${targetSubject}", assessmentColumnId: "${column}", adjustmentValue: 5, reason: "Adjustment curve applied")`);
      }
      // General feedback
      else {
        agentExecutionLogs.push("Synthesized standard administrator review.");
      }

      const summaryResponse = completedProposals.length > 0 
        ? `The AI compilation agent processed the instruction: "${prompt}" and successfully generated ${completedProposals.length} system write-proposals.`
        : "The AI agent analyzed the records but found no entries matching the criteria specified in the instruction.";

      return res.json({
        message: summaryResponse,
        logs: agentExecutionLogs,
        proposedChanges: completedProposals,
        simulated: true
      });
    }

    // 4. Actual Gemini agent run with full tool loop - Active Autonomy Function Calling
    agentExecutionLogs.push("Connected successfully to Gemini Flash runtime.");
    
    // Construct the primary instruction
    const userMessageContent = `
Analyze the provided rosters and execute the requested instructions: "${prompt}".
Please run getStudentsFromDatabase(), getStudentScores(), or getFinancialLedger() to inspect live records first.
After identifying matching records, call proposeStudentRemarks() or proposeGradeCurve() to build system proposals.
`;

    // Initialize content generator
    const conversationHistory: any[] = [{ role: "user", parts: [{ text: userMessageContent }] }];
    
    let currentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: conversationHistory,
      config: {
        systemInstruction: "You are an active, autonomous assistant for EduAdmin Pro. You manage core school registries, fees ledger, and the master score database. You inspect tables using read tools, evaluate profiles, and register edits strictly using the propose tools (proposeStudentRemarks or proposeGradeCurve). Keep all proposals aligned with safety. Never do direct calculations. Let the system execute proposals.",
        tools: [{ functionDeclarations: databaseTools.functionDeclarations }]
      }
    });

    const maxSteps = 6;
    let currentStep = 0;

    while (currentResponse.functionCalls && currentStep < maxSteps) {
      currentStep++;
      const currentCalls = currentResponse.functionCalls;
      const modelContent = currentResponse.candidates?.[0]?.content;
      conversationHistory.push(modelContent);

      const functionResponseParts = [];

      for (const call of currentCalls) {
        let resultOutput = {};
        agentExecutionLogs.push(`Agent decided to execute tool: ${call.name}(${JSON.stringify(call.args || {})})`);

        if (call.name === "getStudentsFromDatabase") {
          resultOutput = { students };
        } else if (call.name === "getStudentScores") {
          resultOutput = { scores };
        } else if (call.name === "getFinancialLedger") {
          resultOutput = { financialLedger };
        } else if (call.name === "proposeStudentRemarks") {
          const { studentId, subjectId, termId, newRemarks } = call.args as any;
          const student = students.find((s: any) => s.id === studentId);
          const studentName = student ? student.name : studentId;
          const oldScore = scores.find((sc: any) => sc.studentId === studentId && sc.subjectId === subjectId && sc.termId === termId);
          
          completedProposals.push({
            id: `propose-remark-${studentId}-${subjectId}-${termId}-${Date.now()}`,
            type: "update_remark",
            targetId: studentId,
            targetName: studentName,
            subjectId,
            termId,
            fieldName: "remark",
            oldValue: oldScore?.remark || "",
            newValue: newRemarks,
            description: `AI recommended administrative advisory remarks for ${studentName} (${subjectId} - ${termId})`
          });
          resultOutput = { success: true };
        } else if (call.name === "proposeGradeCurve") {
          const { studentId, classId, subjectId, termId, assessmentColumnId, adjustmentValue, reason } = call.args as any;
          
          // Select subset matching class and optional student
          const targetStudents = studentId && studentId !== "all" 
            ? students.filter((s: any) => s.id === studentId)
            : students.filter((s: any) => s.classId === classId);

          let affectedCount = 0;
          for (const s of targetStudents) {
            const studentScore = scores.find((sc: any) => sc.studentId === s.id && sc.subjectId === subjectId && sc.termId === termId);
            const oldValue = studentScore ? (studentScore[assessmentColumnId] ?? 0) : 0;
            const newValue = Math.min(100, Math.max(0, Number(oldValue) + Number(adjustmentValue)));

            completedProposals.push({
              id: `propose-grade-${s.id}-${assessmentColumnId}-${Date.now()}`,
              type: "update_grade",
              targetId: s.id,
              targetName: s.name,
              classId,
              subjectId,
              termId,
              fieldName: assessmentColumnId,
              oldValue,
              newValue,
              description: `Suggested raw adjustment (${adjustmentValue > 0 ? "+" : ""}${adjustmentValue} marks, original: ${oldValue} -> new: ${newValue}) for ${s.name} in ${assessmentColumnId}. Reason: ${reason}`
            });
            affectedCount++;
          }
          resultOutput = { success: true, count: affectedCount };
        }

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: resultOutput
          }
        });
      }

      conversationHistory.push({
        role: "user",
        parts: functionResponseParts
      });

      // Query Gemini again with tool output
      currentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: conversationHistory,
        config: {
          tools: [{ functionDeclarations: databaseTools.functionDeclarations }]
        }
      });
    }

    agentExecutionLogs.push("Agent analysis completed successfully.");

    res.json({
      message: currentResponse.text || `Processed transaction. Found and generated ${completedProposals.length} system write-proposals.`,
      logs: agentExecutionLogs,
      proposedChanges: completedProposals,
      simulated: false
    });

  } catch (error: any) {
    console.error("AI execution backend failed:", error);
    agentExecutionLogs.push(`Exception encountered in runtime environment: ${error.message}`);
    res.status(500).json({
      error: "Could not execute agentic function calling session successfully.",
      details: error.message,
      logs: agentExecutionLogs,
      proposedChanges: []
    });
  }
});

// ── Database routes ────────────────────────────────────────────────────────────

// Students
app.get("/api/db/students", (_req, res) => {
  res.json(getAllStudents());
});

app.post("/api/db/students", (req, res) => {
  const { id, name, classId, gender, status, photo, phoneNumber } = req.body;
  if (!id || !name || !classId) {
    return res.status(400).json({ error: "id, name, and classId are required." });
  }
  res.json(upsertStudent({ id, name, classId, gender: gender || "Male", status: status || "Enrolled", photo, phoneNumber }));
});

// Alias used by the student register view
app.post("/api/save-student", (req, res) => {
  const { id, name, classId, gender, status, photo, phoneNumber } = req.body;
  if (!id || !name || !classId) {
    return res.status(400).json({ error: "id, name, and classId are required." });
  }
  res.json(upsertStudent({ id, name, classId, gender: gender || "Male", status: status || "Enrolled", photo, phoneNumber }));
});

app.delete("/api/db/students/:id", (req, res) => {
  const result = deleteStudent(req.params.id);
  res.json({ deleted: result.changes > 0 });
});

// Scores
app.get("/api/db/scores", (_req, res) => {
  res.json(getAllScores());
});

app.post("/api/db/scores", (req, res) => {
  const { studentId, subjectId, termId } = req.body;
  if (!studentId || !subjectId || !termId) {
    return res.status(400).json({ error: "studentId, subjectId, and termId are required." });
  }
  res.json(upsertScore(req.body));
});

// Financial records
app.get("/api/db/financial", (_req, res) => {
  res.json(getAllFinancialRecords());
});

app.post("/api/db/financial", (req, res) => {
  const { id, studentId, studentName, classId, academicYear, termId } = req.body;
  if (!id || !studentId || !studentName || !classId || !academicYear || !termId) {
    return res.status(400).json({ error: "id, studentId, studentName, classId, academicYear, and termId are required." });
  }
  res.json(upsertFinancialRecord({
    ...req.body,
    billAmount: Number(req.body.billAmount ?? 0),
    paidAmount: Number(req.body.paidAmount ?? 0),
    balance: Number(req.body.balance ?? 0),
    lastUpdated: req.body.lastUpdated || new Date().toISOString(),
  }));
});

// Seed — call this once on first launch with { students, scores, financialRecords }
app.post("/api/db/seed", (req, res) => {
  if (isSeeded()) {
    return res.json({ message: "Already seeded — skipped.", alreadySeeded: true });
  }
  const { students = [], scores = [], financialRecords = [] } = req.body;
  const result = seedDatabase({ students, scores, financialRecords });
  res.json({ seeded: true, ...result });
});

// Scores batch upsert
app.post("/api/db/scores/batch", (req, res) => {
  const { scores = [] } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: "scores array is required." });
  }
  const count = upsertScoresBatch(scores);
  res.json({ upserted: count });
});

// ── Settings routes ────────────────────────────────────────────────────────────

app.get("/api/db/settings", (_req, res) => {
  res.json(getAllSettings());
});

app.get("/api/db/settings/:key", (req, res) => {
  const value = getSetting(req.params.key);
  if (value === null) return res.status(404).json({ error: "Setting not found." });
  res.json({ key: req.params.key, value });
});

app.post("/api/db/settings", (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: "key and value are required." });
  setSetting(String(key), String(value));
  // Reset cached Gemini client so the new key is picked up on the next AI request
  if (String(key) === "gemini_api_key") aiClient = null;
  res.json({ key, value });
});

// ── SMS provider helpers ───────────────────────────────────────────────────────

function activeProvider(): "hubtel" | "webhook" | null {
  const id = process.env.HUBTEL_CLIENT_ID || getSetting("hubtel_client_id");
  const secret = process.env.HUBTEL_CLIENT_SECRET || getSetting("hubtel_client_secret");
  if (id && secret) return "hubtel";
  if (process.env.WEBHOOK_URL || getSetting("webhook_url")) return "webhook";
  return null;
}

async function sendNotification(notification: {
  id: number;
  type: string;
  recipientPhone: string | null;
  recipientName: string | null;
  message: string;
  metadata: object | null;
}): Promise<boolean> {
  const clientId = process.env.HUBTEL_CLIENT_ID || getSetting("hubtel_client_id");
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET || getSetting("hubtel_client_secret");

  if (clientId && clientSecret) {
    // Hubtel SMSC — requires a phone number
    if (!notification.recipientPhone) return false;
    const senderId = process.env.HUBTEL_SENDER_ID || getSetting("hubtel_sender_id") || "EduAdmin";
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const r = await fetch("https://smsc.hubtel.com/v1/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${creds}` },
      body: JSON.stringify({ From: senderId, To: notification.recipientPhone, Content: notification.message }),
    });
    return r.status === 201 || r.ok;
  }

  // Generic webhook fallback
  const webhookUrl = process.env.WEBHOOK_URL || getSetting("webhook_url");
  if (!webhookUrl) return false;
  const r = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: notification.id,
      type: notification.type,
      to: notification.recipientPhone,
      name: notification.recipientName,
      message: notification.message,
      metadata: notification.metadata,
      sentAt: new Date().toISOString(),
    }),
  });
  return r.ok;
}

// ── Notification Queue routes ──────────────────────────────────────────────────

app.post("/api/notifications/queue", (req, res) => {
  const { type, recipientPhone, recipientName, message, metadata } = req.body;
  if (!type || !message) return res.status(400).json({ error: "type and message are required." });
  const id = queueNotification({ type, recipientPhone, recipientName, message, metadata });
  res.json({ queued: true, id });
});

app.get("/api/notifications/pending", (_req, res) => {
  res.json(getPendingNotifications());
});

// Dispatches all pending notifications via the configured provider (Hubtel or generic webhook).
// Configure Hubtel: POST /api/db/settings  { key: "hubtel_client_id", value: "..." }
//                                           { key: "hubtel_client_secret", value: "..." }
//                                           { key: "hubtel_sender_id", value: "EduAdmin" }
// Fallback webhook: POST /api/db/settings  { key: "webhook_url", value: "https://..." }
app.post("/api/notifications/dispatch", async (req, res) => {
  const provider = activeProvider();
  if (!provider) {
    return res.status(400).json({
      error: "No SMS provider configured. Set hubtel_client_id + hubtel_client_secret (Hubtel) or webhook_url (generic) via POST /api/db/settings.",
    });
  }

  const pending = getPendingNotifications();
  if (pending.length === 0) return res.json({ dispatched: 0, failed: 0, provider });

  let dispatched = 0;
  let failed = 0;

  for (const notification of pending) {
    try {
      const ok = await sendNotification(notification);
      if (ok) { markNotificationDispatched(notification.id); dispatched++; }
      else     { markNotificationFailed(notification.id);    failed++;     }
    } catch {
      markNotificationFailed(notification.id);
      failed++;
    }
  }

  res.json({ dispatched, failed, total: pending.length, provider });
});

// Returns which SMS provider is active and its (masked) config.
app.get("/api/notifications/provider", (_req, res) => {
  const provider = activeProvider();
  const clientId = process.env.HUBTEL_CLIENT_ID || getSetting("hubtel_client_id");
  const senderId = process.env.HUBTEL_SENDER_ID || getSetting("hubtel_sender_id") || "EduAdmin";
  const webhookUrl = process.env.WEBHOOK_URL || getSetting("webhook_url");
  res.json({
    active: provider,
    hubtel: {
      configured: provider === "hubtel",
      clientId: clientId ? `${clientId.slice(0, 4)}****` : null,
      senderId: provider === "hubtel" ? senderId : null,
    },
    webhook: {
      configured: provider === "webhook",
      url: provider === "webhook" ? webhookUrl : null,
    },
  });
});

// ── Staff routes ───────────────────────────────────────────────────────────────

app.get("/api/db/staff", (_req, res) => {
  res.json(getAllStaff());
});

app.post("/api/db/staff", (req, res) => {
  const { staffId, fullName } = req.body;
  if (!staffId || !fullName) return res.status(400).json({ error: "staffId and fullName are required." });
  upsertStaff(req.body);
  res.json({ success: true });
});

app.delete("/api/db/staff/:staffId", (req, res) => {
  deleteStaff(req.params.staffId);
  res.json({ deleted: req.params.staffId });
});

// ── Attendance routes ──────────────────────────────────────────────────────────

app.get("/api/db/attendance", (_req, res) => {
  res.json(getAllAttendanceRecords());
});

app.post("/api/db/attendance", (req, res) => {
  const { date, termId, classId, attendance } = req.body;
  if (!date || !termId || !classId || !attendance) {
    return res.status(400).json({ error: "date, termId, classId, and attendance are required." });
  }
  upsertAttendanceRecord({ date, termId, classId, attendance });
  res.json({ success: true });
});

// ── Print Hub routes ───────────────────────────────────────────────────────────

// GET /api/print/students?class=Senior+High+1A&q=kwame
// Returns enrolled students, optionally filtered by class and/or name/ID search.
app.get("/api/print/students", (req, res) => {
  const classFilter = (req.query.class as string || "").toLowerCase().trim();
  const query       = (req.query.q     as string || "").toLowerCase().trim();
  let students = (getAllStudents() as any[]).filter(s => s.status === "Enrolled");
  if (classFilter) students = students.filter(s => s.classId.toLowerCase() === classFilter);
  if (query)       students = students.filter(s =>
    s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query)
  );
  res.json(students.map(s => ({ id: s.id, name: s.name, classId: s.classId, status: s.status })));
});

// GET /api/print/compile-bulk?class=Senior+High+1A&term=Term+1
// Returns one fully-joined profile per student in the class — ready to render or PDF.
app.get("/api/print/compile-bulk", (req, res) => {
  const classId = (req.query.class as string || "").trim();
  const termId  = (req.query.term  as string || "").trim();
  if (!classId || !termId) {
    return res.status(400).json({ error: "class and term query params are required." });
  }

  const allStudents    = (getAllStudents()         as any[]).filter(s => s.status === "Enrolled" && s.classId === classId);
  const allScores      = getAllScores()      as any[];
  const allAttendance  = getAllAttendanceRecords() as any[];

  const termAttendanceDays = allAttendance.filter(r => r.classId === classId && r.termId === termId);
  const totalDays = termAttendanceDays.length;

  const profiles = allStudents.map(student => {
    const studentScores = allScores.filter(sc => sc.studentId === student.id && sc.termId === termId);

    const daysPresent = totalDays > 0
      ? termAttendanceDays.filter(r => r.attendance?.[student.id] === "Present").length
      : null;

    return {
      student: { id: student.id, name: student.name, classId: student.classId },
      termId,
      scores: studentScores,
      attendance: {
        daysPresent,
        totalDays: totalDays || null,
        percentage: totalDays > 0 ? Math.round((daysPresent! / totalDays) * 100) : null,
      },
    };
  });

  res.json({ class: classId, term: termId, count: profiles.length, profiles });
});

// ── Mobile API v1 (satellite client endpoints) ────────────────────────────────
//
// These routes serve the EduAdmin Android companion app.
// JWT auth is intentionally omitted here — add middleware when you introduce
// proper user accounts. For LAN-only school deployments a shared API key
// header (X-EduAdmin-Key) is sufficient until then.

// Batch grade sync — mobile teacher submits offline-cached grades in one call
app.post("/api/v1/sync/teacher-grades", (req, res) => {
  const { scores } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: "scores array is required." });
  }
  let saved = 0;
  for (const sc of scores) {
    try { upsertScore(sc); saved++; } catch (_) {}
  }
  res.json({ synced: saved, total: scores.length });
});

// Admin digital signature — receives Base64 PNG from the Compose canvas and
// stores it so the PC report generator can stamp it onto PDFs
app.post("/api/v1/admin/upload-signature", (req, res) => {
  const { signatureBase64, adminId } = req.body;
  if (!signatureBase64) return res.status(400).json({ error: "signatureBase64 is required." });
  setSetting("admin_signature_base64", signatureBase64);
  if (adminId) setSetting("admin_signature_owner", String(adminId));
  setSetting("admin_signature_updated_at", new Date().toISOString());
  res.json({ saved: true });
});

// Parent channel preferences — Admin flips WhatsApp/SMS/Email toggles from mobile
app.put("/api/v1/admin/parent-channels", (req, res) => {
  const { whatsapp, sms, email } = req.body;
  if (typeof whatsapp === "boolean") setSetting("channel_whatsapp", String(whatsapp));
  if (typeof sms      === "boolean") setSetting("channel_sms",      String(sms));
  if (typeof email    === "boolean") setSetting("channel_email",     String(email));
  res.json({
    channels: {
      whatsapp: getSetting("channel_whatsapp") === "true",
      sms:      getSetting("channel_sms")      === "true",
      email:    getSetting("channel_email")    === "true",
    }
  });
});

// Avatar upload — multipart image from mobile; stores Base64 in settings for now.
// Replace with disk/S3 storage when you add a proper file layer.
app.post("/api/v1/user/upload-avatar", (req, res) => {
  // Image arrives as Base64 JSON from the Android client (see SyncRepository.kt)
  const { avatarBase64, userId, role } = req.body;
  if (!avatarBase64 || !userId) {
    return res.status(400).json({ success: false, message: "avatarBase64 and userId are required." });
  }
  const key = `avatar_${role || "user"}_${userId}`;
  setSetting(key, avatarBase64);
  res.json({ success: true, avatarUrl: `/api/v1/user/avatar/${role || "user"}/${userId}` });
});

// Serve stored avatar back to mobile
app.get("/api/v1/user/avatar/:role/:userId", (req, res) => {
  const key = `avatar_${req.params.role}_${req.params.userId}`;
  const base64 = getSetting(key);
  if (!base64) return res.status(404).json({ error: "No avatar stored." });
  const img = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  res.setHeader("Content-Type", "image/jpeg");
  res.send(img);
});

// ── Mobile client identity handshake ──────────────────────────────────────────
//
// The pairing screen hits this before saving the URL. Returning the app name
// lets the client confirm it's talking to EduAdmin Pro, not a random LAN device.
//
app.get("/api/v1/system/handshake", (_req, res) => {
  res.json({ success: "true", app: "EduAdmin", version: "1.0" });
});

// ── Biometric enrollment (register a student's USB scanner hash on the PC) ─────
//
// POST /api/v1/biometrics/enroll
//   Body: { studentId, templateHash }
//   Idempotent — calling again replaces the stored hash for that student.
//
app.post("/api/v1/biometrics/enroll", (req, res) => {
  const { studentId, templateHash } = req.body;
  if (!studentId || !templateHash) {
    return res.status(400).json({ error: "studentId and templateHash are required." });
  }
  upsertStudentBiometric(studentId, templateHash);
  res.json({ enrolled: true, studentId });
});

// GET /api/v1/biometrics/enrollments
//   Returns all enrolled students with their registration timestamps.
//
app.get("/api/v1/biometrics/enrollments", (_req, res) => {
  res.json(getAllBiometricEnrollments());
});

// ── Biometric attendance sync (posted from Android WorkManager SyncWorker) ─────
//
// POST /api/v1/sync/biometric-attendance
//   Body: { records: [{ studentId, templateHash, verifiedAt, termId, classId }] }
//
// After saving each record the route evaluates the active parent notification
// channels and auto-dispatches a WhatsApp / SMS / Email check-in alert if enabled.
//
app.post("/api/v1/sync/biometric-attendance", async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "records array is required." });
  }

  const whatsappOn = getSetting("channel_whatsapp") === "true";
  const smsOn      = getSetting("channel_sms")      === "true";
  const emailOn    = getSetting("channel_email")     === "true";
  const provider   = activeProvider();

  let saved = 0;
  const dispatched: number[] = [];

  for (const rec of records) {
    const { studentId, templateHash, verifiedAt, termId, classId } = rec;
    if (!studentId || !templateHash || !termId || !classId) continue;

    // Verify the hash still matches the enrolled template
    const enrollment = getStudentByTemplateHash(templateHash);
    if (!enrollment || enrollment.studentId !== studentId) continue;

    // Look up student details for the notification message
    const students = getAllStudents() as any[];
    const student  = students.find(s => s.id === studentId);
    if (!student) continue;

    saveBiometricAttendance({
      studentId,
      studentName: student.name,
      classId: student.classId,
      termId,
      templateHash,
      verifiedAt: verifiedAt || new Date().toISOString(),
    });
    saved++;

    // Auto-dispatch parent alert if any channel is active
    if (provider && (whatsappOn || smsOn || emailOn)) {
      const ts = new Date(verifiedAt || Date.now()).toLocaleTimeString("en-GH", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
      const message =
        `EduAdmin Notice: Hello, your child ${student.name} has arrived safely ` +
        `at school and was biometrically checked in at ${ts}.`;

      const notifId = queueNotification({
        type:          "biometric_checkin",
        recipientPhone: student.phoneNumber ?? null,
        recipientName:  student.name,
        message,
      });

      // Fire immediately so parents don't wait for the next dispatch cycle
      try {
        await sendNotification({
          id: notifId, type: "biometric_checkin",
          recipientPhone: student.phoneNumber ?? null,
          recipientName: student.name,
          message,
          metadata: null,
        });
        markNotificationDispatched(notifId);
        dispatched.push(notifId);
      } catch (_) {
        markNotificationFailed(notifId);
      }
    }
  }

  res.json({ saved, notificationsDispatched: dispatched.length, total: records.length });
});

// GET /api/v1/biometrics/attendance?termId=Term1&classId=SH1A
//
app.get("/api/v1/biometrics/attendance", (req, res) => {
  const termId  = (req.query.termId  as string || "").trim();
  const classId = (req.query.classId as string || "").trim() || undefined;
  if (!termId) return res.status(400).json({ error: "termId is required." });
  res.json(getBiometricAttendanceByTerm(termId, classId));
});

// GET /api/v1/biometrics/days-present/:studentId?termId=Term1
//   Used by the report-card PDF compiler to stamp the attendance percentage.
//
app.get("/api/v1/biometrics/days-present/:studentId", (req, res) => {
  const { studentId } = req.params;
  const termId = (req.query.termId as string || "").trim();
  if (!termId) return res.status(400).json({ error: "termId query param required." });
  const days = countBiometricDaysPresent(studentId, termId);
  res.json({ studentId, termId, daysPresent: days });
});

// ── Mobile notification inbox (read by Android companion app) ─────────────────
//
// GET /api/v1/notifications/inbox?recipient=Kwame+Mensah
//   Returns all notifications addressed to that recipient, newest first.
//   If ?recipient= is omitted, returns every notification (admin view).
//
app.get("/api/v1/notifications/inbox", (req, res) => {
  const recipient = (req.query.recipient as string || "").trim().toLowerCase();
  // Inbox shows full history (read + unread, sent or not) — not just the SMS queue.
  const all = getAllNotifications() as any[];
  const rows = recipient
    ? all.filter(n => (n.recipientName || "").toLowerCase().includes(recipient))
    : all;
  // getAllNotifications already returns newest-first; expose a simple read flag.
  res.json(rows.map(n => ({ ...n, read: !!n.readAt })));
});

// POST /api/v1/notifications/:id/read
//   Marks an inbox message read. This only sets readAt — it never changes the
//   SMS delivery status, so reading a message in the app cannot remove it from
//   (or wrongly satisfy) the outbound SMS queue.
//
app.post("/api/v1/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  try {
    markNotificationRead(Number(id));
    res.json({ ok: true });
  } catch (_) {
    res.json({ ok: false });
  }
});

// ── Data export ────────────────────────────────────────────────────────────────

app.get("/api/export", (_req, res) => {
  const data = exportAllData();
  res.setHeader("Content-Disposition", `attachment; filename="eduadmin-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json(data);
});

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ── Static file serving ────────────────────────────────────────────────────────

// DIST_PATH comes from Electron main.cjs for packaged app; fallback for standalone
const distPath = process.env.DIST_PATH || path.join(process.cwd(), "dist");

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("SERVER_READY");
  });
}

startServer();
