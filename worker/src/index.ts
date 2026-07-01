export interface Env {
  GEMINI_API_KEY: string;
  // Optional shared key. When set (via `wrangler secret put WORKER_API_KEY`),
  // callers must send a matching X-EduAdmin-Key header. Leave unset to keep the
  // endpoint open. Prevents strangers from spending your Gemini budget.
  WORKER_API_KEY?: string;
}

interface RemarkRequest {
  studentName: string;
  classLevel: string;
  grades: Record<string, number>;
  attendance: number;
  behavior: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // Optional shared-key gate — only enforced when WORKER_API_KEY is configured.
    if (env.WORKER_API_KEY && request.headers.get("X-EduAdmin-Key") !== env.WORKER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: a valid X-EduAdmin-Key is required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: RemarkRequest;
    try {
      body = (await request.json()) as RemarkRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { studentName, classLevel, grades, attendance, behavior } = body;
    if (!studentName || !classLevel || !grades) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: studentName, classLevel, grades" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gradeText = Object.entries(grades)
      .map(([subject, score]) => `${subject}: ${score}%`)
      .join(", ");

    const prompt =
      `Write a 2–3 sentence professional school report card remark for ${studentName}, ` +
      `a student in ${classLevel}. Academic performance: ${gradeText}. ` +
      `Attendance rate: ${attendance}%. General behaviour: ${behavior}. ` +
      `The remark should be encouraging, specific, and suitable for a parent to read.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error", geminiRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Gemini API error", status: geminiRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await geminiRes.json()) as GeminiResponse;
    const remark = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!remark) {
      return new Response(
        JSON.stringify({ error: "Gemini returned an empty remark" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ remark }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  },
};
