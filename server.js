"use strict";
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;
const TZ = "Europe/Paris";

// Database configuration and connection handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_URI,
});

if (typeof pool.on === 'function') {
  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(1);
  });
}

// Database functions
async function getStation(stationName) {
  try {
    if (!stationName) {
      throw new Error('Station name is required');
    }
    
    const query = `
      SELECT station, line, headway_min, service_start, service_end, last_window_start
      FROM stations
      WHERE station = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [stationName]);
    return rows[0];
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    const dt = Date.now() - t0;
    console.log(`${req.method} ${req.path} -> ${res.statusCode} ${dt}ms`);
  });
  next();
});

// Utility functions
function toHM(date) {
  try {
    if (!(date instanceof Date)) {
      throw new Error('Invalid date object');
    }
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TZ,
    });
  } catch (err) {
    console.error('Error in toHM:', err);
    throw err;
  }
}

function nowInTZ() {
  try {
    const now = new Date();
    // Use mocked date in test environment
    if (process.env.NODE_ENV === 'test') {
      return now;
    }
    const tzString = now.toLocaleString("sv-SE", { timeZone: TZ });
    return new Date(tzString.replace(" ", "T"));
  } catch (err) {
    console.error('Error in nowInTZ:', err);
    return new Date();
  }
}

function computeNext(nowDate, headwayMin) {
  if (!(nowDate instanceof Date) || typeof headwayMin !== 'number') {
    throw new Error('Invalid parameters for computeNext');
  }
  const next = new Date(nowDate.getTime() + headwayMin * 60 * 1000);
  return toHM(next);
}

function inServiceWindow(nowDate, serviceStartHHMM, serviceEndHHMM) {
  if (!(nowDate instanceof Date) || !serviceStartHHMM || !serviceEndHHMM) {
    throw new Error('Invalid parameters for service window calculation');
  }

  const [sH, sM] = serviceStartHHMM.split(":").map(Number);
  const [eH, eM] = serviceEndHHMM.split(":").map(Number);

  if ([sH, sM, eH, eM].some(isNaN)) {
    throw new Error('Invalid time format');
  }

  const start = new Date(nowDate);
  start.setHours(sH, sM, 0, 0);

  const end = new Date(nowDate);
  end.setHours(eH, eM, 0, 0);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return {
    inWindow: nowDate >= start && nowDate <= end,
    start,
    nowWall: nowDate
  };
}

// Route Handlers
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.get("/next-metro", async (req, res) => {
  try {
    const station = (req.query.station || "").toString().trim();
    if (!station) {
      return res.status(400).json({ error: "missing station" });
    }

    const meta = await getStation(station);
    if (!meta) {
      return res.status(404).json({ error: "station not found" });
    }

    const now = nowInTZ();
    const { inWindow, start } = inServiceWindow(
      now,
      meta.service_start || "05:30",
      meta.service_end || "01:15"
    );

    if (!inWindow) {
      return res.status(200).json({ service: "closed", tz: TZ });
    }

    const headwayMin = Number(meta.headway_min) || 3;
    const nextArrival = computeNext(now, headwayMin);

    const lastWindowStart = meta.last_window_start || "00:45";
    const [lwH, lwM] = lastWindowStart.split(":").map(Number);
    const lastWindow = new Date(start);
    lastWindow.setHours(lwH, lwM, 0, 0);
    
    if (lastWindow < start) {
      lastWindow.setDate(lastWindow.getDate() + 1);
    }

    return res.status(200).json({
      station: meta.station,
      line: meta.line,
      headwayMin,
      nextArrival,
      isLast: now >= lastWindow,
      tz: TZ,
    });
  } catch (err) {
    console.error('Error in /next-metro:', err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.get("/last-metro", async (req, res) => {
  try {
    const station = (req.query.station || "").toString().trim();
    if (!station) {
      return res.status(400).json({ error: "missing station" });
    }

    const meta = await getStation(station);
    if (!meta) {
      return res.status(404).json({ error: "station not found" });
    }

    return res.status(200).json({
      station: meta.station,
      line: meta.line,
      lastDeparture: meta.service_end || "01:15",
      tz: TZ,
    });
  } catch (err) {
    console.error('Error in /last-metro:', err);
    return res.status(500).json({ error: "internal error" });
  }
});

// 404 Handler
app.use((_req, res) => res.status(404).json({ error: "not found" }));

// Server startup (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API ready on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      pool.end(() => {
        console.log('Database connection pool closed');
        process.exit(0);
      });
    });
  });
}

module.exports = app;