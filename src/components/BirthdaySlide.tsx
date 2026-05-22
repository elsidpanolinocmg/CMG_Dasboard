"use client";

export interface BirthdaySlideEntry {
  id: string;
  displayName: string;
  mediaKind: "image" | "video";
  mediaPath: string;
  hideGreeting?: boolean;
  finishVideo?: boolean;
}

interface Props {
  entry: BirthdaySlideEntry;
  className?: string;
  // Fired when a "finish video" clip plays through (or errors). The parent uses
  // this to advance the slideshow exactly when the video ends. Only called for
  // video entries with finishVideo set, since looping videos never "end".
  onVideoEnded?: () => void;
}

export default function BirthdaySlide({ entry, className, onVideoEnded }: Props) {
  const playOnce = entry.mediaKind === "video" && !!entry.finishVideo;
  return (
    <div
      className={`relative w-full h-full min-h-screen flex items-center justify-center bg-black overflow-hidden ${className ?? ""}`}
    >
      {entry.mediaKind === "image" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.mediaPath}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.mediaPath}
            alt={entry.displayName}
            className="relative w-full h-full object-contain"
          />
        </>
      ) : (
        <>
          <video
            src={entry.mediaPath}
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
            autoPlay
            muted
            loop
            playsInline
          />
          <video
            src={entry.mediaPath}
            className="relative w-full h-full object-contain"
            autoPlay
            muted
            loop={!playOnce}
            playsInline
            onEnded={playOnce ? onVideoEnded : undefined}
            onError={playOnce ? onVideoEnded : undefined}
          />
        </>
      )}
      {!entry.hideGreeting && (
        <div className="absolute inset-x-0 bottom-0 p-8 md:p-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-center">
          <div className="text-2xl md:text-4xl font-semibold tracking-wide drop-shadow">
            🎉 Happy Birthday, {entry.displayName}! 🎂
          </div>
        </div>
      )}
    </div>
  );
}
