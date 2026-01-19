import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const KEY = process.env.OPENWEATHER_API_KEY;
const PORT = process.env.PORT || 3001;

if (!KEY) {
  console.error("Missing OPENWEATHER_API_KEY in .env");
  process.exit(1);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, port: String(PORT) });
});

// city -> lat/lon
app.get("/api/geocode", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit || 5), 5);

    if (!q) return res.status(400).json({ error: "Missing q" });

    const url =
      `http://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(q)}` +
      `&limit=${limit}` +
      `&appid=${KEY}`;

    const r = await fetch(url);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(500).json({ error: "Geocode failed" });
  }
});

// lat/lon -> current weather
app.get("/api/weather", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const units = String(req.query.units || "metric");
    const lang = String(req.query.lang || "de");

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "Missing/invalid lat or lon" });
    }

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}` +
      `&lon=${lon}` +
      `&appid=${KEY}` +
      `&units=${encodeURIComponent(units)}` +
      `&lang=${encodeURIComponent(lang)}`;

    const r = await fetch(url);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(500).json({ error: "Weather failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`);
});
