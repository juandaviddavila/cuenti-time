"use client";

import {
  detectFacePresence,
  type FacePresence,
} from "@/lib/ai/face-api-service";

/** Frames con cara antes de pedir identidad / capturar. */
export const FACE_STABLE_HITS = 2;
/** Mínimo entre ticks de presencia (MediaPipe es barato; no hace falta 1 s). */
export const FACE_PRESENCE_MIN_INTERVAL_MS = 200;
export const FACE_SOFT_RETRY_COOLDOWN_MS = 900;

export function startFacePresenceLoop(options: {
  getVideo: () => HTMLVideoElement | null;
  shouldRun: () => boolean;
  onTick: (presence: FacePresence) => void | Promise<void>;
}): () => void {
  let cancelled = false;
  let busy = false;
  let raf = 0;
  let lastTick = 0;

  const frame = (now: number) => {
    if (cancelled) return;
    raf = requestAnimationFrame(frame);
    if (busy || !options.shouldRun()) return;
    if (now - lastTick < FACE_PRESENCE_MIN_INTERVAL_MS) return;

    const video = options.getVideo();
    if (!video || video.readyState < 2) return;

    lastTick = now;
    busy = true;
    void detectFacePresence(video)
      .then((presence) => options.onTick(presence))
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  };

  raf = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
