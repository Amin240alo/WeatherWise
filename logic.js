/**
 * WeatherWise - Entscheidungslogik
 * 
 * Diese Datei enthält die regelbasierte Logik zur Wetteranalyse und Empfehlungen.
 * Keine KI, sondern deterministische if/else-Regeln für konsistente Ergebnisse.
 */

/* ============================================================================
   WETTER-NORMALISIERUNG
   ============================================================================ */

/**
 * Normalisiert OpenWeatherMap Wetterzustände zu einfachen Kategorien
 * 
 * OpenWeatherMap API liefert verschiedene "main" Werte wie:
 * - Clear, Clouds, Rain, Drizzle, Snow, Thunderstorm, Atmosphere (Nebel, etc.)
 * 
 * Wir vereinfachen diese zu 6 Kategorien für einfachere Logik:
 * - clear, clouds, rain, snow, thunderstorm, other
 * 
 * @param {string} weatherMain - Der "main" Wert aus weather[0].main der API
 * @returns {string} Normalisierte Kategorie
 */
function normalizeCondition(weatherMain) {
  const m = (weatherMain || "").toLowerCase();

  // Priorität: Gefährliche Bedingungen zuerst
  if (m.includes("thunder")) return "thunderstorm";
  if (m.includes("drizzle") || m.includes("rain")) return "rain";
  if (m.includes("snow")) return "snow";
  if (m.includes("cloud")) return "clouds";
  if (m.includes("clear")) return "clear";
  
  // Fallback für Nebel, Dunst, etc.
  return "other";
}

/* ============================================================================
   WETTER-ICONS
   ============================================================================ */

/**
 * Gibt das passende Emoji-Icon für eine Wetterkategorie zurück
 * 
 * @param {string} condition - Normalisierte Wetterkategorie
 * @returns {string} Emoji als String
 */
function getWeatherIcon(condition) {
  const icons = {
    clear: "☀️",
    clouds: "☁️",
    rain: "🌧️",
    snow: "❄️",
    thunderstorm: "⚡",
    other: "🌫️"
  };
  return icons[condition] || "🌤️";
}

/* ============================================================================
   WETTER-KONTEXT ERSTELLEN
   ============================================================================ */

/**
 * Extrahiert relevante Wetterdaten aus der OpenWeatherMap API-Antwort
 * und bereitet sie für die Empfehlungslogik auf
 * 
 * @param {Object} api - Die vollständige API-Antwort von OpenWeatherMap
 * @returns {Object} Vereinfachter Wetter-Kontext
 */
function buildWeatherContext(api) {
  const conditionMain = api?.weather?.[0]?.main;
  const description = api?.weather?.[0]?.description || "";
  const temp = api?.main?.temp;           // In Celsius (wenn units=metric)
  const feelsLike = api?.main?.feels_like;  // "Gefühlte" Temperatur
  const windSpeed = api?.wind?.speed;     // In m/s (bei metric)

 return {
  condition: normalizeCondition(conditionMain),
  rawConditionMain: conditionMain || "Unknown",
  description,
  temp,
  feelsLike,
  windSpeed,

  // OPTIONAL-Felder aus Current Weather API (nicht immer vorhanden) [web:1]
  cloudPct: api?.clouds?.all ?? null,         // 0..100
  visibilityM: api?.visibility ?? null,       // Meter
  rainMm1h: api?.rain?.["1h"] ?? null,        // mm in 1h
  snowMm1h: api?.snow?.["1h"] ?? null         // mm in 1h
};

}

/* ============================================================================
   EMPFEHLUNGS-LOGIK (Kernstück der App!)
   ============================================================================ */

/**
 * HAUPTFUNKTION: Analysiert Wetterdaten und gibt eine maßgeschneiderte Empfehlung
 * 
 * Die Logik ist hierarchisch aufgebaut:
 * 1. Sicherheit (Gewitter) - höchste Priorität
 * 2. Niederschlag (Schnee, Regen) - wichtig für Kleidung
 * 3. Wind - verstärkt Kälte oder Wärme
 * 4. Temperatur + Himmel (klar, bewölkt) - Basis-Bedingungen
 * 5. Fallback für ungewöhnliche Bedingungen
 * 
 * @param {Object} ctx - Wetter-Kontext von buildWeatherContext()
 * @returns {Object} Objekt mit summary, recommendation und insightPool
 */
function getRecommendation(ctx) {
  const t = Number(ctx.temp);
  const w = Number(ctx.windSpeed);

  /* -------------------------------------------------------------------------
     1) GEWITTER - Höchste Priorität (Sicherheit!)
     ------------------------------------------------------------------------- */
  if (ctx.condition === "thunderstorm") {
    return {
      summary: "⚡ Gewitter möglich",
      recommendation: "Drinnen bleiben und offene Flächen meiden. Sicherheit geht vor!",
      insightPool: [
        "Heute gewinnt definitiv der Plan B.",
        "Laptop statt Laufrunde – kein schlechter Deal.",
        "Bei Blitz und Donner lieber nicht experimentieren."
      ]
    };
  }

  /* -------------------------------------------------------------------------
     2) SCHNEE - Erfordert spezielle Kleidung und Vorsicht
     ------------------------------------------------------------------------- */
  if (ctx.condition === "snow") {
    // Sehr kalt + Schnee = Winterausrüstung notwendig
    if (t <= 0) {
      return {
        summary: "❄️ Kalt & verschneit",
        recommendation: "Warme Winterstiefel, Mütze und Schal sind Pflicht. Vorsicht bei Glätte!",
        insightPool: [
          "Heute ist definitiv Wintermodus angesagt.",
          "Rutschfest schlägt stylish – jeden Tag.",
          "Langsam gehen ist das neue schnell."
        ]
      };
    }
    // Wärmer + Schnee = Schneeregen möglich
    return {
      summary: "🌨️ Schnee / Schneeregen",
      recommendation: "Wasserfeste Jacke und mehrere warme Schichten einplanen.",
      insightPool: [
        "Schichten sind heute dein Superpower.",
        "Handschuhe zahlen sich immer aus.",
        "Draußen sieht's besser aus als es sich anfühlt."
      ]
    };
  }

  /* -------------------------------------------------------------------------
     3) REGEN - Temperaturabhängige Empfehlungen
     ------------------------------------------------------------------------- */
  if (ctx.condition === "rain") {
    // Kalt + Regen = Doppelt unangenehm
    if (t <= 6) {
      return {
        summary: "🌧️ Kühl & regnerisch",
        recommendation: "Regenjacke plus warme Schicht (Hoodie oder Pullover) empfohlen.",
        insightPool: [
          "Heute ist kein Hoodie-Tag. Heute ist Hoodie-PLUS-Regenjacke.",
          "Schirme sind nett – Jacken sind sicherer.",
          "Pfützen-Management: aktiviert."
        ]
      };
    }
    // Warm + Regen = Schwül, aber Schutz nötig
    if (t >= 22) {
      return {
        summary: "🌦️ Warm & regnerisch",
        recommendation: "Leichte Regenjacke reicht. Ein Wechselshirt kann aber helfen.",
        insightPool: [
          "Regen ist heute eher ein Stimmungstest.",
          "Kurz nass ist auch nass – leider.",
          "Ein trockener Rücken ist Gold wert."
        ]
      };
    }
    // Moderate Temperatur + Regen = Standard-Regenwetter
 return {
  summary: "🌧️ Regnerisch",
  recommendation: "Regenjacke oder Schirm nicht vergessen!",
  insightPool: [
    "Heute lieber wasserfest denken.",
    "Ein Schirm ist ein guter Sidekick.",
    "Draußen ist's ein bisschen „filmisch“."
  ]
};
  }


  

  /* -------------------------------------------------------------------------
     4) WIND - Verstärkt Temperaturempfindung (Wind-Chill)
     ------------------------------------------------------------------------- */
  // Starker Wind (>= 10 m/s = ca. 36 km/h)
  if (w >= 10) {
    // Kalt + Windig = Windchill-Effekt beachten
    if (t <= 10) {
      return {
        summary: "💨 Windig & kühl",
        recommendation: "Winddichte Jacke und warme Kleidung sind heute sinnvoll.",
        insightPool: [
          "Heute gewinnt die winddichte Schicht.",
          "Mütze: total underrated.",
          "Der Wind macht aus kühl ganz schnell kalt."
        ]
      };
    }
    // Warm + Windig = Wind ist störend, aber nicht gefährlich
    return {
      summary: "🌬️ Windig",
      recommendation: "Eine leichte, aber winddichte Schicht lohnt sich heute.",
      insightPool: [
        "Frisur heute: optional.",
        "Wind ist das neue Cardio.",
        "Kleine Extraschicht, großer Effekt."
      ]
    };
  }

  /* -------------------------------------------------------------------------
     5) KLAR / SONNIG - Temperaturabhängig
     ------------------------------------------------------------------------- */
  if (ctx.condition === "clear") {
    // Sehr heiß = Hitzeschutz wichtig
    if (t >= 28) {
      return {
        summary: "☀️ Heiß & sonnig",
        recommendation: "Viel trinken, Mittagssonne meiden, Sonnencreme verwenden!",
        insightPool: [
          "Heute ist Schatten pure Strategie.",
          "Wasser first – immer.",
          "Die Sonne ist heute definitiv der Chef."
        ]
      };
    }
    // Kalt + Sonnig = Sonne täuscht über Kälte hinweg
    if (t <= 5) {
      return {
        summary: "☀️ Klar, aber kalt",
        recommendation: "Warme Jacke einpacken. Die Sonne täuscht!",
        insightPool: [
          "Sonne bedeutet nicht automatisch warm.",
          "Klarer Himmel, klare Jackenwahl.",
          "Heute zählt die Basisschicht."
        ]
      };
    }
    // Angenehm + Sonnig = Perfektes Wetter
    return {
      summary: "🌤️ Freundlich & trocken",
      recommendation: "Perfekte Bedingungen! Leichte Jacke nach Gefühl.",
      insightPool: [
        "Perfektes Wetter für einen Spaziergang.",
        "Heute lohnt sich frische Luft besonders.",
        "Kurz raus – macht den Kopf frei."
      ]
    };
  }

  /* -------------------------------------------------------------------------
     6) BEWÖLKT - Relativ neutral
     ------------------------------------------------------------------------- */
  if (ctx.condition === "clouds") {
    // Kühl + Bewölkt = Wärmer anziehen
    if (t <= 8) {
      return {
        summary: "☁️ Kühl & bewölkt",
        recommendation: "Warme Schicht einplanen, besonders morgens und abends.",
        insightPool: [
          "Wolken können kalt aussehen – und kalt sein.",
          "Heute passt ein Hoodie ziemlich gut.",
          "Komfort schlägt Outfit-Drama."
        ]
      };
    }
    // Mild + Bewölkt = Easy going
    return {
      summary: "⛅ Bewölkt",
      recommendation: "Unkompliziert: normale Alltagskleidung, optional leichte Jacke.",
      insightPool: [
        "Heute ist ein solider Tag.",
        "Wetter: unaufgeregt. Du auch.",
        "Einfach machen."
      ]
    };
  }

  /* -------------------------------------------------------------------------
     7) FALLBACK - Für ungewöhnliche/gemischte Bedingungen
     ------------------------------------------------------------------------- */
  return {
    summary: "🌫️ Wechselhaft",
    recommendation: "Praktisch bleiben: Schichten tragen und flexibel planen.",
    insightPool: [
      "Heute ist Flexibilität eine echte Tugend.",
      "Plan mit Puffer ist ein guter Plan.",
      "Schichten sind dein bester Freund."
    ]
  };
}

/* ============================================================================
   ZUFÄLLIGER INSIGHT
   ============================================================================ */

/**
 * Wählt einen zufälligen Satz aus dem insightPool
 * 
 * Dadurch wirkt die App bei gleichem Wetter nicht monoton,
 * aber die Insights passen immer zum Wettertyp
 * 
 * @param {Array<string>} insightPool - Array mit passenden Insights
 * @returns {string} Ein zufällig gewählter Insight
 */
function pickDailyInsight(insightPool) {
  if (!Array.isArray(insightPool) || insightPool.length === 0) {
    return "";
  }
  const randomIndex = Math.floor(Math.random() * insightPool.length);
  return insightPool[randomIndex];
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Impact Score 0..100
 * Idee: je höher, desto "unangenehmer/risikoreicher" für Alltag.
 */
function getImpactScore(ctx) {
  let score = 0;

  const t = Number(ctx.temp);
  const w = Number(ctx.windSpeed);

  // Regen/Schnee (starker Einfluss)
  const rain = ctx.rainMm1h ?? 0;
  const snow = ctx.snowMm1h ?? 0;

  if (rain > 0) score += clamp(rain * 12, 10, 45);   // 0.5mm => ~10, 3mm => ~36
  if (snow > 0) score += clamp(snow * 10, 10, 40);

  // Wind
  if (!Number.isNaN(w) && w > 6) score += clamp((w - 6) * 4, 0, 25);

  // Hitze/Kälte
  if (!Number.isNaN(t) && t >= 28) score += clamp((t - 27) * 4, 4, 25);
  if (!Number.isNaN(t) && t <= 2) score += clamp((3 - t) * 5, 5, 30);

  // Sicht
  const vis = ctx.visibilityM;
  if (typeof vis === "number" && vis > 0 && vis < 2000) {
    score += clamp((2000 - vis) / 80, 5, 25);
  }

  return clamp(Math.round(score), 0, 100);
}

/**
 * Badges: kleine Hinweise, die den Alltag betreffen.
 */
function getBadges(ctx) {
  const badges = [];
  const t = Number(ctx.temp);
  const w = Number(ctx.windSpeed);
  const rain = ctx.rainMm1h ?? 0;
  const snow = ctx.snowMm1h ?? 0;
  const vis = ctx.visibilityM;

  if (rain >= 2) badges.push({ text: "Starker Regen", tone: "danger" });
  else if (rain > 0) badges.push({ text: "Nass", tone: "warn" });

  if (snow > 0 && t <= 1) badges.push({ text: "Glattegefahr", tone: "danger" });
  else if (snow > 0) badges.push({ text: "Schnee", tone: "warn" });

  if (typeof vis === "number" && vis < 1000) badges.push({ text: "Sicht schlecht", tone: "warn" });

  if (!Number.isNaN(w) && w >= 10) badges.push({ text: "Sehr windig", tone: "warn" });

  if (!Number.isNaN(t) && t >= 30) badges.push({ text: "Hitze", tone: "warn" });
  if (!Number.isNaN(t) && t <= 0) badges.push({ text: "Frost", tone: "warn" });

  // Wolken nur als "Stimmung", kein Risiko
  if (typeof ctx.cloudPct === "number" && ctx.cloudPct >= 85) {
    badges.push({ text: "Sehr bewölkt", tone: "neutral" });
  }

  return badges;
}
