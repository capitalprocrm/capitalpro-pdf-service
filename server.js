import express from "express";
import bodyParser from "body-parser";
import { chromium } from "playwright";

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

const PDF_API_KEY = process.env.PDF_API_KEY;

function requireApiKey(req, res) {
  const key = req.headers["x-api-key"];
  if (PDF_API_KEY && key !== PDF_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function generatePdfHandler(req, res) {
  try {
    if (!requireApiKey(req, res)) return;

    const { html, filename } = req.body || {};
    if (!html) return res.status(400).json({ error: "Missing html" });

    const browser = await chromium.launch({
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
    });

    await browser.close();

    return res.status(200).json({
      ok: true,
      filename: filename || "document.pdf",
      pdf_data: pdfBuffer.toString("base64"),
    });
  } catch (err) {
    return res.status(500).json({
      error: "PDF generation failed",
      details: String(err?.message || err),
    });
  }
}

// ✅ HEALTH CHECK
app.get("/", (req, res) => res.status(200).send("ok"));

// ✅ SUPPORT BOTH ROUTES (THIS IS THE FIX)
app.post("/generate-pdf", generatePdfHandler);
app.post("/api/generate-pdf", generatePdfHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`PDF service running on port ${port}`));

