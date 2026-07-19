"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Jemný nájazd pri scrollovaní — obsah sa objaví, keď sa naň zákazník dostane.
 * Dáva nabídke „prémiový" pocit bez ťažkých knižníc: IntersectionObserver +
 * jednoduchá CSS animácia (fadeInUp z globals.css).
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? undefined : 0,
        animation: shown ? `fadeInUp 0.5s ease both ${delay}ms` : undefined,
      }}
    >
      {children}
    </div>
  );
}
