/**
 * Build the boss image URL that works with Vite's base path (Electron compatible).
 */
export function getBossImageSrc(imageFileName: string): string {
  return `${import.meta.env.BASE_URL}assets/bosses/${imageFileName}`;
}
