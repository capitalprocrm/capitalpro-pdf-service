import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();

// Allow requests from your app (Base44 / Capital Pro CRM)
app.use(cors());

// Increase limit because estimate HTML can be large
app.use(express.json({ limit: "25mb" }));

/**
 * Health check
 * Visit: https://YOUR-RAILWAY-URL/health
 */
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

/**
 * Generate PDF
 * POST https://YOUR-RAILWAY-URL/generate-pdf
 * Body: { html: "<full html>", filename?: "Estimate.pdf" }
 */
app.post("/generate-pdf", async (req, res) => {
  const { html, filename } = req.body || {};

  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Missing 'html' string in request body." });
  }

  let browser;
  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Use screen styles (Tailwind / your normal layout)
    await page.emulateMedia({ media: "screen" });

    // Load HTML
    await page.setContent(html, { waitUntil: "networkidle" });

    // Generate print-quality PDF
    const pdfBuffer = await page.pdf({
      format: "Letter",              // US Letter
      printBackground: true,         // keep colors/backgrounds
      preferCSSPageSize: true,       // respects @page size if you use it
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in"
      }
      // NOTE: No scale here. Leaving scale unset prevents shrink-to-fit issues.
    });

    const safeName = (filename || "Estimate.pdf").replaceAll('"', "");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("PDF render failed:", err);
    return res.status(500).json({
      error: "PDF render failed",
      detail: String(err?.message || err)
    });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});
