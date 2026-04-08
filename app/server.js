import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import convertAll from "heic-convert";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    exposeHeaders: ["Content-Disposition"], // ← CORS Fix
  }),
);

// Bearer Auth Middleware
const bearerAuth = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Bearer Token fehlt" }, 401);
  }

  const token = authHeader.substring(7);
  const validTokens = process.env.VALID_TOKENS?.split(",") || [];

  if (!validTokens.includes(token)) {
    return c.json({ success: false, error: "Ungültiger Token" }, 403);
  }

  await next();
};

// Routes
app.get("/ping", (c) => c.text("pong"));

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "heic-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }),
);

const VALID_FORMATS = ["JPEG", "PNG"];
const CONTENT_TYPES = {
  JPEG: "image/jpeg",
  PNG: "image/png",
};

app.post("/convert", bearerAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!(file instanceof File)) {
      return c.json({ success: false, error: "Keine Datei hochgeladen" }, 400);
    }

    const format = String(body["format"] || "JPEG").toUpperCase();
    if (!VALID_FORMATS.includes(format)) {
      return c.json(
        { success: false, error: `Format: ${format} (JPEG/PNG)` },
        400,
      );
    }

    const quality = Math.max(
      0,
      Math.min(100, parseInt(String(body["quality"] || "80"), 10)),
    );

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    if (inputBuffer.length === 0) {
      return c.json({ success: false, error: "Datei leer" }, 400);
    }

    // heic-convert API Fix (quality 0-1, format UPPERCASE)
    const outputBuffer = await convertAll({
      buffer: inputBuffer,
      format: format, // JPEG/PNG (UPPERCASE!)
      quality: quality / 100, // 0.0-1.0
      width: 1920,
    });

    const originalName = (file.name || "image")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.-]/g, "_");
    const ext = format === "JPEG" ? "jpg" : "png";
    const outputFilename = `${originalName}.${ext}`;

    // Postman + Browser kompatibel
    const headers = {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${outputFilename}"`,
      "Content-Length": outputBuffer.length.toString(),
      "Cache-Control": "no-store",
    };

    return c.body(outputBuffer, 200, headers);
  } catch (error) {
    console.error("Conversion Error:", error);

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not supported") || msg.includes("HEIC")) {
      return c.json(
        { success: false, error: "Nur HEIC/HEIF unterstützt" },
        415,
      );
    }

    return c.json(
      { success: false, error: "Konvertierung fehlgeschlagen" },
      500,
    );
  }
});

// 404 & Error Handler
app.notFound((c) =>
  c.json({ success: false, error: "Endpoint nicht gefunden" }, 404),
);

app.onError((err, c) => {
  console.error("Unhandled Error:", err);
  return c.json({ success: false, error: "Interner Server-Fehler" }, 500);
});

export { app };

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("server.js");

if (isMainModule) {
  const port = parseInt(process.env.PORT || "3000");
  console.log(`HEIC Service startet auf Port ${port}`);
  serve({ fetch: app.fetch, port });
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
}
