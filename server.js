import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Basic routes for Railway + quick testing
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

// Optional API key protection (enabled only if PDF_API_KEY exists in Railway Variables)
function requireApiKey(req, res, next) {
  const required = process.env.PDF_API_KEY;
  if (!required) return next(); // not enabled
  const provided = req.header("x-api-key");
  if (provided !== required) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/**
 * POST /generate-pdf
 * Body: { html: "<full html>", filename?: "Estimate.pdf" }
 * Headers (optional if enabled): x-api-key: <PDF_API_KEY>
 */
app.post("/generate-pdf", requireApiKey, async (req, res) => {
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

    // Use screen CSS by default (usually matches your Base44 preview best)
    await page.emulateMedia({ media: "screen" });

    // Load HTML and wait for network idle (images/fonts/etc.)
    await page.setContent(html, { waitUntil: "networkidle" });

    // Footer with page numbers (safe string concatenation)
    const headerTemplate = "<div></div>";
    const footerTemplate =
      '<div style="width:100%; font-size:10px; padding:0 0.5in; color:#666;">' +
      '<div style="text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' +
      "</div>";

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,

      // Give extra space for footer so it doesn't overlap content
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.85in",
        left: "0.5in"
      },

      // Turn on header/footer rendering for page numbers
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate
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

// IMPORTANT: Railway provides PORT; fallback to 8080 for safety
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});

