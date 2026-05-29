import { useGetConditions } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Wind, Droplets, Thermometer, Waves } from "lucide-react";

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
  const { data, isLoading, isError } = useGetConditions({
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
      <div className="grid grid-cols-3 gap-2 text-xs">
        {data.waterTemperature != null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Waves className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span><span className="font-semibold text-foreground">{Math.round(data.waterTemperature)}°</span> water</span>
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
      </div>
    </div>
  );
}
