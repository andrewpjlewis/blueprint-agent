import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import fetch from "node-fetch";
import he from "he";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Automatically allow your deployed frontend origin
const allowedOrigins = [
  "http://localhost:5173", // local dev
  "https://blueprint-agent-frontend.onrender.com", // production frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ Blocked CORS request from:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);


// __dirname fix for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// In-memory sessions (replace with DB for scaling)
const sessions = {};

// Clean AI text
function cleanText(raw) {
  const decoded = he.decode(raw || "");
  return decoded.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[•–—]/g, "-").trim();
}

// Call Groq API
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
    if (!res.ok) {
      console.error("❌ Groq error:", data);
      return null;
    }
    return data?.choices?.[0]?.message?.content
      ? cleanText(data.choices[0].message.content)
      : null;
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return null;
  }
}

// Draw formatted text
function drawMarkdown(doc, markdown) {
  const paragraphs = markdown.split(/\n+/);
  for (const pRaw of paragraphs) {
    const p = pRaw.trim();
    if (!p) continue;
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
  }
}

// Create PDF
function createPDF(text) {
  const discount = process.env.DISCOUNT_PERCENT || 25;
  const projectsDir = path.join(__dirname, "projects");
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir);

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

// Send email
async function sendEmail(to, pdfPath) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your Website Blueprint",
    text: "Attached is your generated website blueprint.",
    attachments: [{ path: pdfPath }],
  });
}

// ---------- ROUTES ----------

// Start session
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

// Continue conversation
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

// Finalize
app.post("/agent/finalize", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: "Invalid session" });

  const session = sessions[sessionId];
  const pdfPath = createPDF(session.blueprint);
  await sendEmail(session.email, pdfPath);

  res.json({ message: "✅ Blueprint finalized and emailed successfully!" });
});

// ---------- DEPLOYMENT SUPPORT ----------

// Serve frontend build if running in production
const frontendPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get("*", (_, res) => res.sendFile(path.join(frontendPath, "index.html")));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
