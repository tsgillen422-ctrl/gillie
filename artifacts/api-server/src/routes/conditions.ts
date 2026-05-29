import { Router } from "express";

const router = Router();

// Dale Hollow Lake approximate center
const LAKE_LAT = 36.5384;
const LAKE_LNG = -85.3094;

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

let cache: { data: unknown; expires: number } | null = null;

router.get("/", async (_req, res) => {
  try {
    if (cache && cache.expires > Date.now()) {
      return res.json(cache.data);
    }

    const params = new URLSearchParams({
      latitude: String(LAKE_LAT),
      longitude: String(LAKE_LNG),
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: "auto",
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`
    );
    if (!response.ok) {
      return res.status(502).json({ error: "Weather service unavailable" });
    }
    const json = (await response.json()) as {
      current?: Record<string, number>;
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
      windSpeed,
      windGust,
      windDirection: c.wind_direction_10m ?? null,
      humidity: c.relative_humidity_2m ?? null,
      precipitation,
      weatherCode,
      weatherLabel: WEATHER_LABELS[weatherCode] ?? "Unknown",
      isDay,
      advisories,
      updatedAt: new Date().toISOString(),
    };

    cache = { data, expires: Date.now() + 10 * 60 * 1000 };
    res.json(data);
  } catch {
    res.status(502).json({ error: "Weather service unavailable" });
  }
});

export default router;
