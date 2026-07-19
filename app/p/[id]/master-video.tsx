"use client";

import { useRef, useState } from "react";

/**
 * Videopozdrav majstra ako kruh navrchu — tvár človeka je silnejší prvý dojem
 * než render. Ťuknutím sa prehrá so zvukom; kým beží, kruh sa jemne zväčší na
 * plnú šírku a zapnú sa natívne ovládania (poistka, keby auto-play zlyhal).
 *
 * `src` je PRIAMY (podpísaný) odkaz na video, nie /api/video/[id] — Safari na
 * iPhone má s 302 presmerovaním pri <video> problém, priamy odkaz je spoľahlivý.
 */
export default function MasterVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  async function start() {
    const v = ref.current;
    if (!v) return;
    setPlaying(true);
    v.muted = false;
    try {
      await v.play();
    } catch {
      // Auto-play neprešiel (napr. iOS) — natívne ovládania sú už zapnuté,
      // zákazník ťukne na play sám.
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center" style={{ animation: "fadeInUp 0.5s ease both" }}>
      <div
        className={`relative overflow-hidden border-4 border-white bg-black shadow-lift transition-all duration-500 ${
          playing ? "w-full max-w-sm rounded-3xl" : "h-36 w-36 rounded-full"
        }`}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={ref}
          src={src}
          playsInline
          preload="metadata"
          controls={playing}
          onEnded={() => setPlaying(false)}
          className={`w-full ${playing ? "h-auto" : "h-36 object-cover"}`}
        />
        {!playing && (
          <button
            onClick={start}
            aria-label="Prehrať odkaz od majstra"
            className="absolute inset-0 flex items-center justify-center bg-black/25"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-xl text-neutral-800 shadow-lift">
              ▶
            </span>
          </button>
        )}
      </div>
      {!playing && <p className="mt-2 text-sm font-medium text-neutral-500">Odkaz od majstra — ťuknite</p>}
    </div>
  );
}
