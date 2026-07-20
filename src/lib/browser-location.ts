export interface BrowserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Heurística de dispositivo móvil (teléfono/tablet).
 * En escritorio el GPS del navegador suele ser poco fiable o inexistente.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const mobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  // iPadOS 13+ se reporta como Macintosh con touch
  const iPadOsDesktopUa =
    navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;

  return mobileUa || iPadOsDesktopUa;
}

export type ClientDeviceClass = "mobile" | "desktop";

export function getClientDeviceClass(): ClientDeviceClass {
  return isMobileDevice() ? "mobile" : "desktop";
}

export async function getBrowserLocation(): Promise<BrowserLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 }
    );
  });
}

/** Solo pide GPS en móvil; en desktop retorna null sin intentar geolocalización. */
export async function getBrowserLocationIfMobile(): Promise<BrowserLocation | null> {
  if (!isMobileDevice()) return null;
  return getBrowserLocation();
}
