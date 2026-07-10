import React, { useEffect, useRef, useState } from "react";
import { VolumeX, Volume2 } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  className?: string;
  /** Optional trim window (seconds). Playback loops within [trimStart, trimEnd]. */
  trimStart?: number;
  trimEnd?: number;
}

export function VideoPlayer({ src, className = "", trimStart, trimEnd }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const start = trimStart && trimStart > 0 ? trimStart : 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (start > 0 && video.currentTime < start) video.currentTime = start;
            video.play().catch(() => {});
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [start]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && start > 0) video.currentTime = start;
  };

  // Enforce the trim window: loop back to trimStart when reaching trimEnd.
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const end = trimEnd && trimEnd > start ? trimEnd : null;
    if (end != null && video.currentTime >= end - 0.05) {
      video.currentTime = start;
      if (!video.paused) video.play().catch(() => {});
    } else if (start > 0 && video.currentTime < start - 0.25) {
      video.currentTime = start;
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        playsInline
        muted={isMuted}
        loop
        onClick={handleToggleMute}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />
      <div className="absolute bottom-3 right-3 z-10">
        <button
          type="button"
          onClick={handleToggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-95"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
