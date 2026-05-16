import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases, categories, dashboard, users } from "./data.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = frontendUrl
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
  })
);
app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(uploadsDir));

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.get("/", (_req, res) => {
  res.redirect(frontendUrl.split(",")[0]);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "fiscaliza-api" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const user = users.find(
    (item) => item.username === username && item.password === password
  );

  if (!user) {
    res.status(401).json({ message: "Credenciales invalidas" });
    return;
  }

  res.json({
    token: `mock-token-${user.role}`,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      username: user.username,
    },
  });
});

app.get("/api/dashboard", (_req, res) => {
  res.json(dashboard);
});

app.get("/api/categories", (_req, res) => {
  res.json(categories);
});

app.get("/api/cases", (_req, res) => {
  res.json(cases);
});

app.get("/api/cases/:id", (req, res) => {
  const record = cases.find((item) => item.id === req.params.id);

  if (!record) {
    res.status(404).json({ message: "Caso no encontrado" });
    return;
  }

  res.json(record);
});

app.post("/api/cases", (req, res) => {
  const {
    category,
    priority,
    zone,
    address,
    summary,
    mode,
    channel,
    source,
    location,
    inspector,
    attachment,
  } = req.body ?? {};

  if (!category || !priority || !zone || !address || !summary || !inspector) {
    res.status(400).json({ message: "Faltan campos obligatorios del caso" });
    return;
  }

  const categoryRef = categories.find((item) => item.slug === category);

  if (!categoryRef) {
    res.status(400).json({ message: "Categoria invalida" });
    return;
  }

  const nextNumber = 185 + cases.length;
  const savedAttachment = attachment ? saveAttachment(attachment) : null;
  const newCase = {
    id: `FM-2026-${String(nextNumber).padStart(5, "0")}`,
    type: categoryRef.name,
    category,
    priority,
    status: "Ingresado",
    zone,
    address,
    inspector,
    channel: channel || "foto",
    mode: mode || "online",
    source: source || "gallery",
    summary,
    location: normalizeLocation(location),
    evidence: savedAttachment
      ? `${savedAttachment.kind === "image" ? "Imagen" : "Video"} adjunto: ${savedAttachment.name}`
      : "Pendiente de carga de evidencia",
    acta: "Acta preliminar creada",
    attachment: savedAttachment,
  };

  cases.unshift(newCase);
  dashboard.metrics.activeCases += 1;
  dashboard.metrics.activeCasesNote = "+1 nuevo ingreso";

  if (newCase.mode === "offline") {
    dashboard.metrics.pendingOffline += 1;
    dashboard.sync.offlineQueue += 1;
  }

  res.status(201).json(newCase);
});

app.listen(port, () => {
  console.log(`Fiscaliza API escuchando en http://localhost:${port}`);
});

function saveAttachment(attachment) {
  if (!attachment?.dataUrl || !attachment?.name || !attachment?.mimeType) {
    return null;
  }

  const matches = attachment.dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!matches) {
    return null;
  }

  const [, mimeType, base64] = matches;
  const buffer = Buffer.from(base64, "base64");
  const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, buffer);

  return {
    name: attachment.name,
    mimeType,
    size: attachment.size,
    kind: attachment.kind,
    url: `${appBaseUrl}/uploads/${filename}`,
  };
}

function normalizeLocation(location) {
  if (!location) {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number(location.accuracy) || null,
    capturedAt: location.capturedAt || new Date().toISOString(),
  };
}
