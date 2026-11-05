export { cn } from "cn";

/**
 * Ensures an external link opens in a separate browser tab or window across all devices,
 * especially on mobile devices and standalone PWAs (installed web apps) where plain
 * target="_blank" links would otherwise navigate inside the current webview.
 */
export function openExternalUrl(url: string, e?: React.MouseEvent) {
  if (typeof window === "undefined" || !url) return;
  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win && e) {
      e.preventDefault();
    }
  } catch {
    // If window.open is blocked or throws, allow default link action
  }
}

