import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";

function timeLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function RecordingPlayer({ src }: { src: string }) {
  const recording = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = recording.current;
    return () => audio?.pause();
  }, []);

  function playbackFailed() {
    setIsPlaying(false);
    setIsBuffering(false);
    setFailed(true);
    toast.add({
      id: "recording-playback",
      type: "error",
      title: "Playback failed",
      description: "Try playing again or use Open recording.",
      timeout: 8_000,
    });
  }

  function togglePlayback() {
    const audio = recording.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    toast.close("recording-playback");
    setFailed(false);
    setIsBuffering(true);
    if (audio.error) audio.load();
    void audio.play().catch((error: DOMException) => {
      if (error.name !== "AbortError") playbackFailed();
    });
  }

  return (
    <div
      role="group"
      aria-label="Call recording player"
      className="flex h-9 min-w-48 flex-1 items-center gap-3 rounded-2xl border bg-background pl-1 pr-3 sm:max-w-xl"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={isPlaying ? "Pause recording" : "Play recording"}
        title={isPlaying ? "Pause recording" : "Play recording"}
        onClick={togglePlayback}
      >
        {isBuffering ? (
          <Spinner aria-hidden="true" />
        ) : (
          <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} aria-hidden="true" />
        )}
      </Button>
      <div className="min-w-0 flex-1">
        <Slider
          value={[Math.min(position, duration)]}
          max={duration || 1}
          step={0.1}
          disabled={!duration || failed}
          onValueChange={(value) => {
            const audio = recording.current;
            if (!audio || !duration) return;
            audio.currentTime = Math.min(
              duration,
              Math.max(0, typeof value === "number" ? value : value[0]),
            );
            setPosition(audio.currentTime);
          }}
          thumbProps={{
            "aria-label": "Recording position",
            "aria-valuetext": `${timeLabel(position)} of ${timeLabel(duration)}`,
          }}
        />
      </div>
      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {timeLabel(position)} / {timeLabel(duration)}
      </span>
      <span className="sr-only" role="status">
        {isBuffering ? "Loading recording…" : ""}
      </span>
      <audio
        ref={recording}
        src={src}
        preload="metadata"
        hidden
        onPlay={() => setIsPlaying(true)}
        onPlaying={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPause={() => {
          setIsPlaying(false);
          setIsBuffering(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setIsBuffering(false);
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) && value > 0 ? value : 0);
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onError={playbackFailed}
      />
    </div>
  );
}
