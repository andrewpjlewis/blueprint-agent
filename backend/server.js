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
app.use(cors());
app.use(express.json());

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🧠 Function to clean AI text
function cleanText(raw) {
  const decoded = he.decode(raw || "");
  return decoded
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•–—]/g, "-")
    .replace(/\r?\n\s*/g, "\n") // normalize line breaks
    .trim();
}

// 🧠 Generate blueprint using Groq API
async function generateBlueprint(idea) {
  console.log("🧠 Sending prompt to Groq API with model: llama-3.3-70b-versatile...");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a professional web design consultant generating detailed blueprints.",
          },
          {
            role: "user",
            content: `Create a detailed website blueprint for this idea: "${idea}". Include headings, bullet points, and numbered sections for PDF formatting.`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    console.log("Groq API response:", data);

    if (data?.choices?.[0]?.message?.content) {
      return cleanText(data.choices[0].message.content);
    } else {
      console.warn("⚠️ No text from model:", data);
      return "No response from model.";
    }
  } catch (err) {
    console.error("❌ Error fetching from Groq:", err);
    return "Error generating blueprint.";
  }
}

// 🧾 Create nicely formatted PDF
function createPDF(blueprintText) {
  const discount = process.env.DISCOUNT_PERCENT || 25;
  const projectsDir = path.join(process.cwd(), "projects");
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir);

  const filePath = path.join(projectsDir, `blueprint-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(filePath));

  // Header
  doc.fontSize(20).fillColor("#333").text("Website Blueprint", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).fillColor("#555").text(`Discount: ${discount}% off your next project`);
  doc.moveDown();

  // Split text into lines
  const lines = blueprintText.split("\n");

  lines.forEach((line) => {
    line = line.trim();
    if (!line) {
      doc.moveDown();
      return;
    }

    // Headings
    if (/^(I+\.|II+\.|III+\.|IV+\.|V+\.|[A-Z][A-Za-z\s]+)$/.test(line)) {
      doc.moveDown();
      doc.fontSize(14).fillColor("#000").text(line, { underline: true });
      doc.moveDown(0.5);
    }
    // Numbered lists
    else if (/^\d+\./.test(line)) {
      doc.fontSize(11).fillColor("#000").text(line, { indent: 10 });
    }
    // Bulleted lists
    else if (/^-\s/.test(line) || /^\*/.test(line)) {
      doc.fontSize(11).fillColor("#000").text(line.replace(/^[-*]\s/, "• "), { indent: 20 });
    }
    // Normal paragraph
    else {
      doc.fontSize(11).fillColor("#000").text(line, { align: "left" });
    }
  });

  doc.moveDown();
  doc.fontSize(12).fillColor("#333").text("Call to Action: Contact me to get started!", { align: "center" });

  doc.end();
  return filePath;
}

// 📧 Send email with PDF
async function sendEmail(to, pdfPath) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your Website Blueprint",
    text: "Attached is your generated website blueprint.",
    attachments: [{ path: pdfPath }],
  });
}

// 🚀 API endpoint
app.post("/generate", async (req, res) => {
  try {
    const { idea, email } = req.body;
    if (!idea || !email) return res.status(400).json({ error: "Idea and email required" });

    const blueprintText = await generateBlueprint(idea);
    const pdfPath = createPDF(blueprintText);
    await sendEmail(email, pdfPath);

    res.json({ message: "Blueprint generated and emailed successfully!" });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`✅ Backend running on http://localhost:${process.env.PORT || 5000}`);
});
