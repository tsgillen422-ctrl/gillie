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

    const data = {
      temperature: Math.round(airTemp * 10) / 10,
      apparentTemperature:
        c.apparent_temperature != null
          ? Math.round(c.apparent_temperature * 10) / 10
          : null,
      waterTemperature,
      windSpeed: Math.round((c.wind_speed_10m ?? 0) * 10) / 10,
      windGust:
        c.wind_gusts_10m != null ? Math.round(c.wind_gusts_10m * 10) / 10 : null,
      windDirection: c.wind_direction_10m ?? null,
      humidity: c.relative_humidity_2m ?? null,
      precipitation: c.precipitation ?? null,
      weatherCode,
      weatherLabel: WEATHER_LABELS[weatherCode] ?? "Unknown",
      isDay: (c.is_day ?? 1) === 1,
      updatedAt: new Date().toISOString(),
    };

    cache = { data, expires: Date.now() + 10 * 60 * 1000 };
    res.json(data);
  } catch {
    res.status(502).json({ error: "Weather service unavailable" });
  }
});

export default router;
