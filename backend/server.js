import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import fetch from "node-fetch";
import he from "he";
import helmet from "helmet";

dotenv.config();

const app = express();
app.use(helmet());

// Restrict CORS to your frontend domain in production
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: FRONTEND_ORIGIN }));

app.use(express.json());

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, req.body);
  next();
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use App Password or OAuth
  },
});

// In-memory sessions (consider Redis/Mongo for production scale)
const sessions = {};

// Clean AI text
function cleanText(raw) {
  const decoded = he.decode(raw || "");
  return decoded.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[•–—]/g, "-").trim();
}

// Call Groq AI
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
    return data?.choices?.[0]?.message?.content
      ? cleanText(data.choices[0].message.content)
      : null;
  } catch (err) {
    console.error("❌ Error calling AI:", err);
    return null;
  }
}

// Draw formatted PDF from AI text
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

// Create PDF in memory
function createPDFBuffer(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).fillColor("#333").text("Website Blueprint", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Discount: ${process.env.DISCOUNT_PERCENT || 25}% off your next project`);
    doc.moveDown();

    drawMarkdown(doc, text);

    doc.moveDown();
    doc.fillColor("#333").text("Call to Action: Contact me to get started!", { align: "center" });

    doc.end();
  });
}

// Send email with PDF buffer
async function sendEmail(to, pdfBuffer) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your Website Blueprint",
    text: "Attached is your generated website blueprint.",
    attachments: [{ filename: "blueprint.pdf", content: pdfBuffer }],
  });
}

// 1️⃣ Start session
app.post("/agent/start", async (req, res) => {
  try {
    const { idea, email } = req.body;
    if (!idea || !email) return res.status(400).json({ error: "Idea and email required" });

    const sessionId = Date.now().toString();
    const messages = [
      { role: "system", content: "You are a professional web design consultant generating detailed blueprints." },
      { role: "user", content: `Create a detailed website blueprint for this idea: "${idea}".` },
    ];

    const blueprint = await callGroqAI(messages);
    if (!blueprint) return res.status(500).json({ error: "AI generation failed" });

    sessions[sessionId] = {
      idea,
      email,
      blueprint,
      history: [...messages, { role: "assistant", content: blueprint }],
    };

    res.json({ sessionId, blueprint });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2️⃣ Continue conversation
app.post("/agent/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: "Invalid session" });

    const session = sessions[sessionId];
    session.history.push({ role: "user", content: message });

    const reply = await callGroqAI(session.history);
    if (!reply) return res.status(500).json({ error: "AI generation failed" });

    session.history.push({ role: "assistant", content: reply });
    session.blueprint = reply;

    res.json({ reply, blueprint: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3️⃣ Finalize PDF & email
app.post("/agent/finalize", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: "Invalid session" });

    const session = sessions[sessionId];
    const pdfBuffer = await createPDFBuffer(session.blueprint);
    await sendEmail(session.email, pdfBuffer);

    res.json({ message: "Blueprint finalized and emailed!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, req.body);
  next();
});
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
