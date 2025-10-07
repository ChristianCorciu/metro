"use strict";
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;
const TZ = "Europe/Paris";

// Pool PostgreSQL (DATABASE_URL recommandé)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_URI,
});

// Logger minimal
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    const dt = Date.now() - t0;
    console.log(`${req.method} ${req.path} -> ${res.statusCode} ${dt}ms`);
  });
  next();
});

// JSON uniquement
app.use(express.json());
function toHM(date) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

function nowInTZ() {
  return new Date();
}

async function getStation(stationName) {
  const q = `
    SELECT station, line, headway_min, service_start, service_end, last_window_start
    FROM stations
    WHERE station = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [stationName]);
  return rows[0];
}

function computeNext(nowDate, headwayMin) {
  const next = new Date(nowDate.getTime() + headwayMin * 60 * 1000);
  return toHM(next);
}

function inServiceWindow(nowDate, serviceStartHHMM, serviceEndHHMM) {
  const [sH, sM] = serviceStartHHMM.split(":").map(Number);
  const [eH, eM] = serviceEndHHMM.split(":").map(Number);

  const nowStr = nowDate.toLocaleString("sv-SE", { timeZone: TZ }); // yyyy-mm-dd HH:MM:SS
  const [datePart] = nowStr.split(" ");

  const start = new Date(`${datePart}T${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}:00`);
  const end = new Date(`${datePart}T${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}:00`);
  if (end <= start) {
    end.setDate(end.getDate() + 1); // fin = lendemain
  }

  const nowWall = new Date(nowStr.replace(" ", "T"));
  return { inWindow: nowWall >= start && nowWall <= end, start, nowWall };
}


// Santé
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// Prochain métro
app.get("/next-metro", async (req, res) => {
  try {
    const station = (req.query.station || "").toString().trim();
    if (!station) return res.status(400).json({ error: "missing station" });

    const meta = await getStation(station);
    if (!meta) return res.status(404).json({ error: "station not found" });

    const headwayMin = Number(meta.headway_min) || 3;
    const serviceStart = meta.service_start || "05:30";
    const serviceEnd = meta.service_end || "01:15";
    const lastWindowStart = meta.last_window_start || "00:45";

    const now = nowInTZ();
    const { inWindow, start, nowWall } = inServiceWindow(now, serviceStart, serviceEnd);

    if (!inWindow) {
      return res.status(200).json({ service: "closed", tz: TZ });
    }

    const nextArrival = computeNext(now, headwayMin);

    const [lwH, lwM] = lastWindowStart.split(":").map(Number);
    const lastWindow = new Date(start);
    lastWindow.setHours(lwH, lwM, 0, 0);
    if (lastWindow < start) lastWindow.setDate(lastWindow.getDate() + 1);

    const isLast = nowWall >= lastWindow;

    return res.status(200).json({
      station: meta.station,
      line: meta.line,
      headwayMin,
      nextArrival,
      isLast,
      tz: TZ,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

// Dernier métro
app.get("/last-metro", async (req, res) => {
  try {
    const station = (req.query.station || "").toString().trim();
    if (!station) return res.status(400).json({ error: "missing station" });

    const meta = await getStation(station);
    if (!meta) return res.status(404).json({ error: "station not found" });

    return res.status(200).json({
      station: meta.station,
      line: meta.line,
      lastDeparture: meta.service_end || "01:15",
      tz: TZ,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

// 404 JSON
app.use((_req, res) => res.status(404).json({ error: "not found" }));

// Démarrage
app.listen(5000, '0.0.0.0', () => console.log('API ready on http://localhost:5000'));

module.exports = app;
