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

// ✅ CORS — allows frontend + local dev
const allowedOrigins = [
  "http://localhost:5173",
  "https://blueprint-agent-frontend.onrender.com",
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
  })
);
app.use(express.json());

// ✅ Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// In-memory sessions
const sessions = {};

// 🧹 Clean AI text
function cleanText(raw) {
  const decoded = he.decode(raw || "");
  return decoded.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[•–—]/g, "-").trim();
}

// 🧠 Groq API helper
async function callGroqAI(messages, model = "llama-3.3-70b-versatile") {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.7 }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content
      ? cleanText(data.choices[0].message.content)
      : null;
  } catch (err) {
    console.error("❌ Error calling Groq:", err);
    return null;
  }
}

// 🧾 PDF generator
function createPDF(text) {
  const discount = process.env.DISCOUNT_PERCENT || 25;
  const projectsDir = path.join(process.cwd(), "projects");
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

  const filePath = path.join(projectsDir, `blueprint-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).fillColor("#333").text("Website Blueprint", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Discount: ${discount}% off your next project`);
  doc.moveDown();
  doc.fontSize(11).fillColor("#333").text(text, { lineGap: 4 });
  doc.moveDown();
  doc.text("Call to Action: Contact me to get started!", { align: "center" });
  doc.end();

  return filePath;
}

// 📧 Send email
async function sendEmail(to, pdfPath) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your Website Blueprint",
    text: "Attached is your generated website blueprint.",
    attachments: [{ path: pdfPath }],
  });
}

// 🟢 Start session
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

// 🟡 Improve blueprint
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

// 🧩 Finalize & email (with full logging)
app.post("/agent/finalize", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({ error: "Invalid session" });
    }

    const session = sessions[sessionId];
    if (!session.blueprint) {
      return res.status(400).json({ error: "No blueprint found in session." });
    }

    console.log("📦 Finalizing session:", sessionId, "for", session.email);
    const pdfPath = createPDF(session.blueprint);
    console.log("✅ PDF created:", pdfPath);

    await sendEmail(session.email, pdfPath);
    console.log("📨 Email sent to:", session.email);

    res.json({ message: "Blueprint finalized and emailed!" });
  } catch (err) {
    console.error("❌ Error in /agent/finalize:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.listen(process.env.PORT || 5000, () =>
  console.log(`✅ Backend running on http://localhost:${process.env.PORT || 5000}`)
);
