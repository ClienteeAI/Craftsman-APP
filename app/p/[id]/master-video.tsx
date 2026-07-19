"use client";

import { useRef, useState } from "react";

/**
 * Videopozdrav majstra ako kruh navrchu — tvár človeka je silnejší prvý dojem
 * než render. Ťuknutím sa prehrá so zvukom; kým beží, kruh sa jemne zväčší
 * na plnú šírku, aby to bolo vidno. Bez natívnych controls (v kruhu vyzerajú zle).
 */
export default function MasterVideo({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center" style={{ animation: "fadeInUp 0.5s ease both" }}>
      <button
        onClick={toggle}
        aria-label={playing ? "Pozastaviť" : "Prehrať odkaz od majstra"}
        className={`relative overflow-hidden rounded-full border-4 border-white bg-black shadow-lift transition-all duration-500 ${
          playing ? "h-64 w-full max-w-sm rounded-3xl sm:h-72" : "h-36 w-36"
        }`}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={ref}
          src={`/api/video/${videoId}`}
          playsInline
          preload="metadata"
          onEnded={() => setPlaying(false)}
          className="h-full w-full object-cover"
        />
        {!playing && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-xl text-neutral-800 shadow-lift">
              ▶
            </span>
          </span>
        )}
      </button>
      {!playing && <p className="mt-2 text-sm font-medium text-neutral-500">Odkaz od majstra — ťuknite</p>}
    </div>
  );
}
