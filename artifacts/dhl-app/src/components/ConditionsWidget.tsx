import { useGetConditions } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLake } from "@/lib/lake-context";
import { Wind, Droplets, Waves, Gauge, Sunrise, Sunset, Fish, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const advisoryStyles: Record<string, { wrap: string; icon: typeof Info }> = {
  warning: { wrap: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300", icon: AlertTriangle },
  caution: { wrap: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300", icon: Info },
  good: { wrap: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
};

const pressureStyles: Record<string, { wrap: string; label: string }> = {
  high: { wrap: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300", label: "High" },
  moderate: { wrap: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300", label: "Moderate" },
  low: { wrap: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300", label: "Low" },
};

function formatClockTime(iso?: string | null): string {
  if (!iso) return "—";
  const timePart = iso.includes("T") ? iso.split("T")[1] : iso;
  const [hStr, m] = timePart.split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return "—";
  const ampm = h >= 12 ? "p" : "a";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}${ampm}`;
}

function weatherEmoji(code: number, isDay?: boolean): string {
  if (code === 0) return isDay === false ? "🌙" : "☀️";
  if (code <= 2) return isDay === false ? "🌤️" : "🌤️";
  if (code === 3) return "☁️";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

function windDir(deg?: number | null): string {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export function ConditionsWidget() {
  const { lakeId } = useLake();
  const { data, isLoading, isError } = useGetConditions({ lakeId }, {
    query: { refetchInterval: 1000 * 60 * 10 },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/20 p-4 mb-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="flex gap-4">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-12 w-20" />
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  return (
    <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/20 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{weatherEmoji(data.weatherCode, data.isDay)}</span>
          <div>
            <div className="font-semibold text-sm">Dale Hollow Lake</div>
            <div className="text-xs text-muted-foreground">{data.weatherLabel}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none">{Math.round(data.temperature)}°</div>
          {data.apparentTemperature != null && (
            <div className="text-[10px] text-muted-foreground">feels {Math.round(data.apparentTemperature)}°</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-y-2 gap-x-2 text-xs">
        {data.waterTemperature != null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Waves className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span><span className="font-semibold text-foreground">{Math.round(data.waterTemperature)}°</span> water</span>
          </div>
        )}
        {data.waterLevel != null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span><span className="font-semibold text-foreground">{data.waterLevel.toFixed(1)}</span> ft level</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Wind className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <span><span className="font-semibold text-foreground">{Math.round(data.windSpeed)}</span> mph {windDir(data.windDirection)}</span>
        </div>
        {data.humidity != null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span><span className="font-semibold text-foreground">{Math.round(data.humidity)}%</span> humidity</span>
          </div>
        )}
        {data.sunrise && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Sunrise className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-foreground">{formatClockTime(data.sunrise)}</span>
          </div>
        )}
        {data.sunset && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Sunset className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="font-semibold text-foreground">{formatClockTime(data.sunset)}</span>
          </div>
        )}
        {data.moonPhase && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-sm leading-none shrink-0">{data.moonPhase.emoji}</span>
            <span><span className="font-semibold text-foreground">{data.moonPhase.illumination}%</span> moon</span>
          </div>
        )}
      </div>
      {data.fishingPressure && (() => {
        const style = pressureStyles[data.fishingPressure.level] ?? pressureStyles.moderate;
        return (
          <div className={`mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${style.wrap}`}>
            <Fish className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><span className="font-semibold">Fishing pressure: {style.label}.</span> {data.fishingPressure.detail}</span>
          </div>
        );
      })()}
      {data.advisories && data.advisories.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {data.advisories.map((a, i) => {
            const style = advisoryStyles[a.level] ?? advisoryStyles.good;
            const Icon = style.icon;
            return (
              <div key={i} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${style.wrap}`}>
                <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><span className="font-semibold">{a.title}.</span> {a.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
