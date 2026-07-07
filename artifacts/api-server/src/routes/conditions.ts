import { Router } from "express";
import { lakeById, DEFAULT_LAKE_ID } from "@workspace/lake-config";

const router = Router();

// USACE CWMS pool-elevation timeseries, per lake. Only Dale Hollow is wired up
// today; other lakes simply report no water level rather than a wrong one.
const WATER_LEVEL_TSIDS: Record<number, string> = {
  1: "DLHT1-DALE_HOLLOW.Elev-Pool.Inst.1Hour.0.dcp-rev",
};

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ hail",
};

interface AdvisoryInput {
  airTemp: number;
  waterTemperature: number;
  windSpeed: number;
  windGust: number | null;
  precipitation: number | null;
  weatherCode: number;
  isDay: boolean;
}

interface Advisory {
  level: "good" | "caution" | "warning";
  title: string;
  detail: string;
}

function buildAdvisories(i: AdvisoryInput): Advisory[] {
  const out: Advisory[] = [];
  const gust = i.windGust ?? i.windSpeed;

  if (gust >= 25 || i.windSpeed >= 20) {
    out.push({
      level: "warning",
      title: "Small craft advisory",
      detail: "High winds and chop — small boats and kayaks should stay off open water.",
    });
  } else if (i.windSpeed >= 12) {
    out.push({
      level: "caution",
      title: "Breezy on the water",
      detail: "Expect some chop in open areas. Find sheltered coves if conditions worsen.",
    });
  } else {
    out.push({
      level: "good",
      title: "Calm water",
      detail: "Light winds make for smooth cruising and easy casting.",
    });
  }

  if ([95, 96, 99].includes(i.weatherCode)) {
    out.push({
      level: "warning",
      title: "Thunderstorms in the area",
      detail: "Lightning risk — get off the water and seek shelter.",
    });
  } else if ([61, 63, 65, 80, 81, 82].includes(i.weatherCode) || (i.precipitation ?? 0) > 0.05) {
    out.push({
      level: "caution",
      title: "Wet conditions",
      detail: "Rain expected — pack rain gear and watch for slick docks.",
    });
  }

  // Fishing guidance based on time of day and water temp
  if (i.isDay && i.airTemp >= 50 && i.airTemp <= 85 && i.windSpeed < 15) {
    out.push({
      level: "good",
      title: "Good fishing window",
      detail: "Mild temps and steady water — bass should be active near structure.",
    });
  }

  if (i.waterTemperature < 55) {
    out.push({
      level: "caution",
      title: "Cold water",
      detail: `Water near ${Math.round(i.waterTemperature)}°F — wear a life jacket; cold shock is a real risk.`,
    });
  }

  return out;
}

// Compute the moon phase for a given date from the mean synodic month.
function computeMoonPhase(date: Date): { name: string; emoji: string; illumination: number } {
  const synodic = 29.530588853;
  // Reference new moon: 2000-01-06 18:14 UTC
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
  let age = ((date.getTime() - ref) / 86400000) % synodic;
  if (age < 0) age += synodic;
  const frac = age / synodic;
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * frac)) / 2) * 100);
  const phases = [
    { name: "New Moon", emoji: "🌑" },
    { name: "Waxing Crescent", emoji: "🌒" },
    { name: "First Quarter", emoji: "🌓" },
    { name: "Waxing Gibbous", emoji: "🌔" },
    { name: "Full Moon", emoji: "🌕" },
    { name: "Waning Gibbous", emoji: "🌖" },
    { name: "Last Quarter", emoji: "🌗" },
    { name: "Waning Crescent", emoji: "🌘" },
  ];
  const idx = Math.round(frac * 8) % 8;
  return { ...phases[idx], illumination };
}

interface PressureInput {
  airTemp: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  localNow: Date; // constructed with the lake's UTC offset; read via getUTC* accessors
}

// Estimate angler/boat pressure on the lake from day-of-week, season, and weather.
function estimateFishingPressure(i: PressureInput): { level: "low" | "moderate" | "high"; detail: string } {
  let score = 0;
  const dow = i.localNow.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  if (dow === 0 || dow === 6) score += 2;
  else if (dow === 5) score += 1;

  if (i.isDay) score += 1;
  if ([0, 1, 2].includes(i.weatherCode)) score += 1;
  if (i.airTemp >= 55 && i.airTemp <= 88) score += 1;
  if (i.windSpeed >= 18) score -= 1;
  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(i.weatherCode)) score -= 2;

  const month = i.localNow.getUTCMonth(); // 0 = Jan
  if (month >= 3 && month <= 8) score += 1; // April–September peak season

  if (score >= 4) {
    return {
      level: "high",
      detail: "Prime conditions — expect plenty of boats and anglers working the water.",
    };
  }
  if (score >= 2) {
    return {
      level: "moderate",
      detail: "A fair number of anglers likely out — popular spots may be busy.",
    };
  }
  return {
    level: "low",
    detail: "Light traffic expected — you'll likely have the coves to yourself.",
  };
}

// Fetch the latest pool elevation (feet) from the USACE CWMS Data API for
// lakes that have a known timeseries id.
async function fetchWaterLevel(lakeId: number): Promise<number | null> {
  const tsid = WATER_LEVEL_TSIDS[lakeId];
  if (!tsid) return null;
  try {
    const end = new Date();
    const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const url =
      `https://cwms-data.usace.army.mil/cwms-data/timeseries?office=LRN` +
      `&name=${encodeURIComponent(tsid)}` +
      `&begin=${begin.toISOString()}&end=${end.toISOString()}&unit=ft`;
    const response = await fetch(url, { headers: { Accept: "application/json;version=2" } });
    if (!response.ok) return null;
    const json = (await response.json()) as { values?: Array<[number, number | null, number]> };
    const values = json.values ?? [];
    for (let idx = values.length - 1; idx >= 0; idx--) {
      const v = values[idx]?.[1];
      if (v != null) return Math.round(v * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

const cacheByLake = new Map<number, { data: unknown; expires: number }>();

router.get("/", async (req, res) => {
  try {
    const rawLakeId = Number(req.query.lakeId);
    const lake = lakeById(Number.isInteger(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID);

    const cached = cacheByLake.get(lake.id);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    const params = new URLSearchParams({
      latitude: String(lake.lat),
      longitude: String(lake.lng),
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day",
      daily: "sunrise,sunset",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: "auto",
      forecast_days: "1",
    });

    const [weatherResponse, waterLevel] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`),
      fetchWaterLevel(lake.id),
    ]);

    if (!weatherResponse.ok) {
      return res.status(502).json({ error: "Weather service unavailable" });
    }
    const json = (await weatherResponse.json()) as {
      current?: Record<string, number>;
      daily?: { sunrise?: string[]; sunset?: string[] };
      utc_offset_seconds?: number;
    };
    const c = json.current ?? {};
    const weatherCode = Math.round(c.weather_code ?? 0);
    const airTemp = c.temperature_2m ?? 0;

    // Estimate surface water temperature: lakes lag air temp and stay cooler in
    // summer / warmer in winter. A simple smoothing toward ~68F gives a believable
    // value without a dedicated water-temp data source.
    const waterTemperature = Math.round((airTemp * 0.6 + 68 * 0.4) * 10) / 10;

    const windSpeed = Math.round((c.wind_speed_10m ?? 0) * 10) / 10;
    const windGust = c.wind_gusts_10m != null ? Math.round(c.wind_gusts_10m * 10) / 10 : null;
    const precipitation = c.precipitation ?? null;
    const isDay = (c.is_day ?? 1) === 1;

    const sunrise = json.daily?.sunrise?.[0] ?? null;
    const sunset = json.daily?.sunset?.[0] ?? null;

    // Local time at the lake (read with getUTC* accessors after shifting by offset).
    const offsetSeconds = json.utc_offset_seconds ?? -5 * 3600;
    const localNow = new Date(Date.now() + offsetSeconds * 1000);

    const moonPhase = computeMoonPhase(new Date());
    const fishingPressure = estimateFishingPressure({
      airTemp,
      windSpeed,
      weatherCode,
      isDay,
      localNow,
    });

    const advisories = buildAdvisories({
      airTemp,
      waterTemperature,
      windSpeed,
      windGust,
      precipitation,
      weatherCode,
      isDay,
    });

    const data = {
      temperature: Math.round(airTemp * 10) / 10,
      apparentTemperature:
        c.apparent_temperature != null
          ? Math.round(c.apparent_temperature * 10) / 10
          : null,
      waterTemperature,
      waterLevel,
      windSpeed,
      windGust,
      windDirection: c.wind_direction_10m ?? null,
      humidity: c.relative_humidity_2m ?? null,
      precipitation,
      weatherCode,
      weatherLabel: WEATHER_LABELS[weatherCode] ?? "Unknown",
      isDay,
      sunrise,
      sunset,
      moonPhase,
      fishingPressure,
      advisories,
      updatedAt: new Date().toISOString(),
    };

    cacheByLake.set(lake.id, { data, expires: Date.now() + 10 * 60 * 1000 });
    res.json(data);
  } catch {
    res.status(502).json({ error: "Weather service unavailable" });
  }
});

export default router;
