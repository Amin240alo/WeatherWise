/**
 * WeatherWise - Hauptsteuerung (App Controller)
 *
 * Diese Datei verbindet:
 * - UI (DOM-Elemente)
 * - API (über Backend-Proxy)
 * - Logik (logic.js)
 *
 * Funktionsfluss:
 * 1. Nutzer wählt Standort (Geolocation ODER Stadt)
 * 2. App ruft Wetterdaten ab
 * 3. logic.js analysiert Daten → Empfehlung
 * 4. UI wird aktualisiert
 */

/* ============================================================================
KONFIGURATION
============================================================================ */


const BASE_WEATHER_URL = "https://weatherwise-yxnb.onrender.com/api/weather";
const BASE_GEO_URL = "https://weatherwise-yxnb.onrender.com/api/geocode";


const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

/* ============================================================================
DOM-ELEMENTE
============================================================================ */

const els = {
  // Hintergrund
  bgGradient: document.getElementById("bgGradient"),

  // Header
  metaLine: document.getElementById("metaLine"),
  btnRefresh: document.getElementById("btnRefresh"),

  // Wetterkarte
  weatherCard: document.getElementById("weatherCard"),
  summaryLine: document.getElementById("summaryLine"),
  weatherIcon: document.getElementById("weatherIcon"),
  recommendationLine: document.getElementById("recommendationLine"),
  insightLine: document.getElementById("insightLine"),

  // Wetterdetails
  detailsBox: document.getElementById("detailsBox"),
  tempValue: document.getElementById("tempValue"),
  feelsLikeValue: document.getElementById("feelsLikeValue"),
  windValue: document.getElementById("windValue"),
  condValue: document.getElementById("condValue"),

  // Standort-Steuerung
  statusLine: document.getElementById("statusLine"),
  btnGeo: document.getElementById("btnGeo"),
  cityForm: document.getElementById("cityForm"),
  cityInput: document.getElementById("cityInput"),

  // Impact/Badges
  impactBox: document.getElementById("impactBox"),
  impactValue: document.getElementById("impactValue"),
  impactFill: document.getElementById("impactFill"),
  badgesBox: document.getElementById("badgesBox"),

  // Forecast UI
  btnToggleHourly: document.getElementById("btnToggleHourly"),
  btnToggleDaily: document.getElementById("btnToggleDaily"),
  hourlyBox: document.getElementById("hourlyBox"),
  dailyBox: document.getElementById("dailyBox"),
  hourlyGrid: document.getElementById("hourlyGrid"),
  dailyGrid: document.getElementById("dailyGrid"),
  forecastStatus: document.getElementById("forecastStatus"),
};

/* ============================================================================
APP-STATE
============================================================================ */

let lastLocation = null; // { lat, lon, label }
let lastForecast = null; // cached Forecast response
let forecastLoadedFor = null; // "lat,lon" string

/* ============================================================================
UI-HELPER
============================================================================ */

function formatDateDE(d = new Date()) {
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function setStatus(msg, type = "info") {
  els.statusLine.textContent = msg;
  els.statusLine.className = "status-line";
  if (type === "error") els.statusLine.classList.add("error");
  if (type === "success") els.statusLine.classList.add("success");
}

function updateBackground(condition) {
  els.bgGradient.className = "bg-gradient";
  setTimeout(() => {
    els.bgGradient.classList.add(condition, "active");
  }, 50);
}

function renderLoading(label = "Wetter wird geladen…") {
  els.summaryLine.textContent = label;
  els.summaryLine.classList.add("loading-pulse");
  els.weatherIcon.textContent = "🔄";
  els.recommendationLine.textContent = "Einen Moment bitte…";
  els.insightLine.textContent = "";
  els.detailsBox.hidden = true;
  els.weatherCard.classList.remove("loaded");
  els.impactBox.hidden = true;
}

function renderWeather(api, label) {
  const ctx = buildWeatherContext(api);
  const rec = getRecommendation(ctx);
  const insight = pickDailyInsight(rec.insightPool);

  els.summaryLine.classList.remove("loading-pulse");
  els.weatherCard.classList.add("loaded", "fade-in");

  els.metaLine.textContent = `${label} • ${formatDateDE(new Date())}`;
  els.summaryLine.textContent = rec.summary;
  els.weatherIcon.textContent = getWeatherIcon(ctx.condition);
  els.recommendationLine.textContent = rec.recommendation;
  els.insightLine.textContent = insight;

  els.tempValue.textContent = `${Math.round(ctx.temp)}°C`;
  els.feelsLikeValue.textContent = `${Math.round(ctx.feelsLike)}°C`;
  els.windValue.textContent = `${ctx.windSpeed?.toFixed?.(1) ?? ctx.windSpeed} m/s`;
  els.condValue.textContent = ctx.rawConditionMain;

  els.detailsBox.hidden = false;
  updateBackground(ctx.condition);

  const impact = getImpactScore(ctx);
  els.impactValue.textContent = `${impact}/100`;
  els.impactFill.style.width = `${impact}%`;

  const badges = getBadges(ctx);
  els.badgesBox.innerHTML = badges
    .map((b) => {
      const cls =
        b.tone === "danger"
          ? "badge badge--danger"
          : b.tone === "warn"
            ? "badge badge--warn"
            : "badge";
      return `<span class="${cls}">${b.text}</span>`;
    })
    .join("");

  els.impactBox.hidden = false;
}

/* ============================================================================
API-KOMMUNIKATION
============================================================================ */

async function fetchJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    // versuche Fehlerdetails zu lesen (JSON oder Text)
    let details = "";
    try {
      const ct = res.headers.get("content-type") || "";
      details = ct.includes("application/json")
        ? JSON.stringify(await res.json())
        : await res.text();
    } catch {
      details = "";
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}${details ? ` – ${details}` : ""}`);
  }

  return res.json();
}

// Forecast helpers
function formatTimeDE(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatWeekdayDE(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function meteoCodeToTag(code) {
  if (code === 0) return "Klar";
  if ([1, 2, 3].includes(code)) return "Wolkig";
  if ([45, 48].includes(code)) return "Nebel";
  if ([51, 53, 55, 56, 57].includes(code)) return "Niesel";
  if ([61, 63, 65, 66, 67].includes(code)) return "Regen";
  if ([71, 73, 75, 77].includes(code)) return "Schnee";
  if ([80, 81, 82].includes(code)) return "Schauer";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wechselhaft";
}

async function getForecastOpenMeteo(lat, lon) {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  url.searchParams.set(
    "hourly",
    ["temperature_2m", "precipitation_probability", "precipitation", "wind_speed_10m", "weather_code"].join(",")
  );

  url.searchParams.set(
    "daily",
    [
      "temperature_2m_min",
      "temperature_2m_max",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
      "weather_code",
    ].join(",")
  );

  return fetchJson(url.toString());
}

function renderHourlyUntilEndOfDay(fx) {
  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const times = fx?.hourly?.time || [];
  const temp = fx?.hourly?.temperature_2m || [];
  const pop = fx?.hourly?.precipitation_probability || [];
  const wind = fx?.hourly?.wind_speed_10m || [];
  const code = fx?.hourly?.weather_code || [];

  const items = [];

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t < now) continue;
    if (t > end) break;

    items.push({
      time: times[i],
      temp: temp[i],
      pop: pop[i],
      wind: wind[i],
      tag: meteoCodeToTag(code[i]),
    });
  }

  els.hourlyGrid.innerHTML = items
    .map(
      (it) => `
      <div class="forecast-card">
        <div class="forecast-title">${formatTimeDE(it.time)} • ${it.tag}</div>
        <div class="forecast-temp">${Math.round(it.temp)}°C</div>
        <div class="forecast-meta">Regen: ${it.pop ?? 0}% • Wind: ${Math.round(it.wind ?? 0)} km/h</div>
      </div>
    `
    )
    .join("");
}

function renderDaily7(fx) {
  const time = fx?.daily?.time || [];
  const tmin = fx?.daily?.temperature_2m_min || [];
  const tmax = fx?.daily?.temperature_2m_max || [];
  const pop = fx?.daily?.precipitation_probability_max || [];
  const sum = fx?.daily?.precipitation_sum || [];
  const wind = fx?.daily?.wind_speed_10m_max || [];
  const code = fx?.daily?.weather_code || [];

  els.dailyGrid.innerHTML = time
    .slice(0, 7)
    .map(
      (d, i) => `
      <div class="forecast-card">
        <div class="forecast-title">${formatWeekdayDE(d)}</div>
        <div class="forecast-temp">${Math.round(tmin[i])}° / ${Math.round(tmax[i])}°</div>
        <div class="forecast-meta">
          ${meteoCodeToTag(code[i])} • Regen: ${pop[i] ?? 0}% • ${sum[i] ?? 0}mm • Wind: ${Math.round(wind[i] ?? 0)} km/h
        </div>
      </div>
    `
    )
    .join("");
}

async function ensureForecastLoaded() {
  if (!lastLocation) return;

  const key = `${lastLocation.lat.toFixed(4)},${lastLocation.lon.toFixed(4)}`;
  if (lastForecast && forecastLoadedFor === key) return;

  els.forecastStatus.textContent = "Forecast wird geladen …";
  const fx = await getForecastOpenMeteo(lastLocation.lat, lastLocation.lon);

  lastForecast = fx;
  forecastLoadedFor = key;
  els.forecastStatus.textContent = "Forecast bereit.";
}

async function getWeatherByCoords(lat, lon) {
  const url = new URL(BASE_WEATHER_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "de");
  return fetchJson(url.toString());
}

async function geocodeCity(city) {
  const url = new URL(BASE_GEO_URL);
  url.searchParams.set("q", city);
  url.searchParams.set("limit", "1");
  return fetchJson(url.toString());
}

function getGeoPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation ist in diesem Browser nicht verfügbar"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

/* ============================================================================
HAUPT-AKTIONEN
============================================================================ */

async function loadByGeolocation() {
  try {
    renderLoading("Standort wird ermittelt…");
    setStatus("Standortabfrage läuft…", "info");

    const pos = await getGeoPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    setStatus("Wetterdaten werden geladen…", "info");
    const api = await getWeatherByCoords(lat, lon);

    lastLocation = { lat, lon, label: api?.name ?? "Aktueller Standort" };

    renderWeather(api, lastLocation.label);
    setStatus("✓ Erfolgreich aktualisiert", "success");
  } catch (err) {
    console.error("Geolocation error:", err);
    setStatus(`Fehler: ${err.message}`, "error");
    els.summaryLine.textContent = "Standort nicht verfügbar";
    els.recommendationLine.textContent = "Bitte erlaube den Standortzugriff oder suche eine Stadt.";
    els.summaryLine.classList.remove("loading-pulse");
  }
}

async function loadByCity(city) {
  try {
    renderLoading("Stadt wird gesucht…");
    setStatus("Geocoding läuft…", "info");

    const results = await geocodeCity(city);
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error("Stadt nicht gefunden. Bitte Schreibweise prüfen.");
    }

    const place = results[0];
    const label = [place.name, place.country].filter(Boolean).join(", ");

    setStatus("Wetterdaten werden geladen…", "info");
    const api = await getWeatherByCoords(place.lat, place.lon);

    lastLocation = { lat: place.lat, lon: place.lon, label };

    renderWeather(api, label);
    setStatus("✓ Erfolgreich aktualisiert", "success");

    els.cityInput.value = "";
  } catch (err) {
    console.error("City search error:", err);
    setStatus(`Fehler: ${err.message}`, "error");
    els.summaryLine.textContent = "Stadt nicht gefunden";
    els.recommendationLine.textContent = "Bitte überprüfe die Schreibweise oder versuche eine andere Stadt.";
    els.summaryLine.classList.remove("loading-pulse");
  }
}

async function refresh() {
  try {
    els.btnRefresh.classList.add("loading");

    if (lastLocation) {
      renderLoading("Aktualisiere…");
      const api = await getWeatherByCoords(lastLocation.lat, lastLocation.lon);
      renderWeather(api, lastLocation.label);
      setStatus("✓ Aktualisiert", "success");
    } else {
      await loadByGeolocation();
    }
  } catch (err) {
    console.error("Refresh error:", err);
    setStatus(`Fehler: ${err.message}`, "error");
    els.summaryLine.textContent = "Aktualisierung fehlgeschlagen";
    els.recommendationLine.textContent = "Prüfe deine Internetverbindung.";
    els.summaryLine.classList.remove("loading-pulse");
  } finally {
    els.btnRefresh.classList.remove("loading");
  }
}

/* ============================================================================
EVENT LISTENERS
============================================================================ */

els.btnGeo.addEventListener("click", () => {
  loadByGeolocation();
});

els.btnRefresh.addEventListener("click", () => {
  refresh();
});

els.cityForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = els.cityInput.value.trim();
  if (!city) {
    setStatus("Bitte gib eine Stadt ein.", "error");
    return;
  }
  loadByCity(city);
});

els.btnToggleHourly.addEventListener("click", async () => {
  const open = els.hourlyBox.hidden;
  els.btnToggleHourly.setAttribute("aria-expanded", String(open));
  els.hourlyBox.hidden = !open;

  if (open) {
    await ensureForecastLoaded();
    renderHourlyUntilEndOfDay(lastForecast);
  }
});

els.btnToggleDaily.addEventListener("click", async () => {
  const open = els.dailyBox.hidden;
  els.btnToggleDaily.setAttribute("aria-expanded", String(open));
  els.dailyBox.hidden = !open;

  if (open) {
    await ensureForecastLoaded();
    renderDaily7(lastForecast);
  }
});

/* ============================================================================
INITIALISIERUNG
============================================================================ */

renderLoading();
els.metaLine.textContent = `— • ${formatDateDE(new Date())}`;
setStatus("Bereit. Standort erlauben oder Stadt eingeben.", "info");

