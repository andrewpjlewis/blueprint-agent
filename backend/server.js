import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import fetch from "node-fetch";
import he from "he";

dotenv.config();

const app = express();

// ✅ CORS: allow your frontend domain
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // e.g. "https://blueprint-agent-frontend.onrender.com"
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(express.json());

// ===== Nodemailer setup =====
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use App Password in Gmail
  },
});

// ===== In-memory sessions =====
const sessions = {};

// ===== Utility: clean AI text =====
function cleanText(raw) {
  const decoded = he.decode(raw || "");
  return decoded.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[•–—]/g, "-").trim();
}

// ===== Call Groq AI =====
async function callGroqAI(messages, model = "llama-3.3-70b-versatile") {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ? cleanText(data.choices[0].message.content) : null;
  } catch (err) {
    console.error("❌ Error calling AI:", err);
    return null;
  }
}

// ===== Draw Markdown-style PDF =====
function drawMarkdown(doc, markdown) {
  const paragraphs = markdown.split(/\n+/);
  paragraphs.forEach((p) => {
    p = p.trim();
    if (!p) return;
    if (p.startsWith("**") && p.endsWith("**")) {
      doc.font("Helvetica-Bold").fillColor("#333").text(p.replace(/\*\*/g, ""), { lineGap: 4 });
    } else if (p.startsWith("- ") || p.startsWith("* ")) {
      doc.font("Helvetica").fillColor("#333").text("• " + p.slice(2), { lineGap: 4 });
    } else if (/^#/.test(p)) {
      doc.font("Helvetica-Bold").fillColor("#333").text(p.replace(/^#+\s*/, ""), { lineGap: 4 });
    } else {
      doc.font("Helvetica").fillColor("#333").text(p, { lineGap: 4 });
    }
    doc.moveDown(0.2);
  });
}

// ===== Create PDF =====
function createPDF(text) {
  const discount = process.env.DISCOUNT_PERCENT || 25;
  const projectsDir = path.join("/tmp", "projects");
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

  const filePath = path.join(projectsDir, `blueprint-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).fillColor("#333").text("Website Blueprint", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Discount: ${discount}% off your next project`);
  doc.moveDown();

  drawMarkdown(doc, text);

  doc.moveDown();
  doc.fillColor("#333").text("Call to Action: Contact me to get started!", { align: "center" });

  doc.end();
  return filePath;
}

// ===== Send email =====
async function sendEmail(to, pdfPath) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your Website Blueprint",
    text: "Attached is your generated website blueprint.",
    attachments: [{ path: pdfPath }],
  });
}

// ===== Routes =====

// 1️⃣ Start session
app.post("/agent/start", async (req, res) => {
  const { idea, email } = req.body;
  if (!idea || !email) return res.status(400).json({ error: "Idea and email required" });

  const sessionId = Date.now().toString();
  const messages = [
    { role: "system", content: "You are a professional web design consultant generating detailed blueprints." },
    { role: "user", content: `Create a detailed website blueprint for this idea: "${idea}".` },
  ];

  const blueprint = await callGroqAI(messages);
  if (!blueprint) return res.status(500).json({ error: "AI generation failed" });

  sessions[sessionId] = { idea, email, blueprint, history: [...messages, { role: "assistant", content: blueprint }] };

  res.json({ sessionId, blueprint });
});

// 2️⃣ Continue conversation
app.post("/agent/message", async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: "Invalid session" });

  const session = sessions[sessionId];
  session.history.push({ role: "user", content: message });

  const reply = await callGroqAI(session.history);
  if (!reply) return res.status(500).json({ error: "AI generation failed" });

  session.history.push({ role: "assistant", content: reply });
  session.blueprint = reply;

  res.json({ reply, blueprint: reply });
});

// 3️⃣ Finalize PDF & email
app.post("/agent/finalize", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: "Invalid session" });

  const session = sessions[sessionId];

  try {
    const pdfPath = createPDF(session.blueprint);
    await sendEmail(session.email, pdfPath);

    res.json({ message: "Blueprint finalized and emailed!" });
  } catch (err) {
    console.error("❌ Server error during PDF/email creation:", err);
    res.status(500).json({ error: "Server failed to create PDF or send email." });
  }
});

// ===== Start server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
