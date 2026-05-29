import React from "react";
import { useGetPins } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const PIN_TYPES = [
  { value: 'all', label: 'All', emoji: '📍' },
  { value: 'fishing_spot', label: 'Fishing', emoji: '🎣' },
  { value: 'campsite', label: 'Camping', emoji: '🏕️' },
  { value: 'marina', label: 'Marinas', emoji: '⛵' },
  { value: 'cliff', label: 'Cliffs', emoji: '🏔️' },
  { value: 'waterfall', label: 'Falls', emoji: '💧' },
  { value: 'hazard', label: 'Hazards', emoji: '⚠️' }
];

export function PinsPage() {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState("");
  
  const { data: pins, isLoading } = useGetPins(filter !== 'all' ? { type: filter as any } : {});

  const filteredPins = React.useMemo(() => {
    if (!pins) return [];
    if (!search) return pins;
    const lowerSearch = search.toLowerCase();
    return pins.filter(p => 
      p.title.toLowerCase().includes(lowerSearch) || 
      p.description?.toLowerCase().includes(lowerSearch)
    );
  }, [pins, search]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 space-y-4">
        <h1 className="text-2xl font-bold text-primary">Lake Pins</h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search spots..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PIN_TYPES.map(type => (
            <Badge 
              key={type.value}
              variant={filter === type.value ? "default" : "secondary"}
              className="cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm"
              onClick={() => setFilter(type.value)}
            >
              <span className="mr-1.5">{type.emoji}</span> {type.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : filteredPins.length ? (
          filteredPins.map(pin => (
            <Card key={pin.id} className="hover-elevate overflow-hidden border-border/50">
              <CardContent className="p-4 flex gap-4 items-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-3xl shrink-0 shadow-inner">
                  {PIN_TYPES.find(t => t.value === pin.type)?.emoji || '📍'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base truncate">{pin.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{pin.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                    Added by {pin.user?.displayName || 'Unknown'}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="shrink-0 text-primary hover:bg-primary/10" asChild>
                  <Link href={`/map?lat=${pin.lat}&lng=${pin.lng}`}>
                    <Navigation className="w-5 h-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No pins found</h3>
            <p className="text-muted-foreground text-sm">Be the first to drop a pin here!</p>
          </div>
        )}
      </div>
    </div>
  );
}
