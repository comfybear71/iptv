/**
 * Parse a text M3U playlist into structured entries.
 *
 * Expected lines:
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="cnn.us" tvg-name="CNN HD" tvg-logo="https://..." group-title="US News",CNN HD
 *   https://server/live/user/pass/12345.ts
 *   ...
 */

export interface M3uEntry {
  name: string;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  group: string;
  url: string;
  /** Xtream stream ID, extracted from the URL path. null if we can't detect one. */
  streamId: number | null;
  /** Raw EXTINF line for cases where we want to re-emit without re-serialising. */
  rawExtInf: string;
}

const ATTR_RE = /([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g;

function extractAttr(line: string, name: string): string {
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(line)) !== null) {
    if (m[1] === name) return m[2];
  }
  return "";
}

function extractDisplayName(extInfLine: string): string {
  // The name is after the last comma on the EXTINF line
  const idx = extInfLine.lastIndexOf(",");
  if (idx === -1) return "";
  return extInfLine.slice(idx + 1).trim();
}

/**
 * Extract an Xtream stream ID from a playlist URL. Handles the common patterns:
 *   https://host/live/USER/PASS/STREAM_ID.ts
 *   https://host/live/USER/PASS/STREAM_ID.m3u8
 *   https://host/USER/PASS/STREAM_ID          (legacy)
 *   https://host/USER/PASS/STREAM_ID.ts       (legacy with ext)
 *   https://host/movie/USER/PASS/STREAM_ID.mp4
 *   https://host/series/USER/PASS/STREAM_ID.mp4
 */
export function extractStreamIdFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    // Last segment, stripped of any extension
    const last = segments[segments.length - 1] || "";
    const withoutExt = last.replace(/\.[a-zA-Z0-9]+$/, "");
    const n = Number(withoutExt);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function parseM3u(text: string): M3uEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: M3uEntry[] = [];
  let pendingExtInf: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF")) {
      pendingExtInf = line;
      continue;
    }
    if (line.startsWith("#")) continue; // other directives we ignore
    if (!pendingExtInf) continue; // orphan URL

    const url = line;
    const name = extractDisplayName(pendingExtInf);
    entries.push({
      name,
      tvgId: extractAttr(pendingExtInf, "tvg-id"),
      tvgName: extractAttr(pendingExtInf, "tvg-name"),
      tvgLogo: extractAttr(pendingExtInf, "tvg-logo"),
      group: extractAttr(pendingExtInf, "group-title"),
      url,
      streamId: extractStreamIdFromUrl(url),
      rawExtInf: pendingExtInf,
    });
    pendingExtInf = null;
  }

  return entries;
}

/**
 * Re-serialise a list of entries back into an M3U document. If `overrideGroup`
 * is set on an entry we emit that instead of the original group-title (used
 * to drop favourites into a ⭐ Favorites group).
 */
export function serializeM3u(
  entries: (M3uEntry & { overrideGroup?: string })[]
): string {
  const out: string[] = ["#EXTM3U"];
  for (const e of entries) {
    const group = e.overrideGroup ?? e.group;
    const attrs: string[] = [];
    if (e.tvgId) attrs.push(`tvg-id="${escapeAttr(e.tvgId)}"`);
    const name = e.tvgName || e.name;
    if (name) attrs.push(`tvg-name="${escapeAttr(name)}"`);
    if (e.tvgLogo) attrs.push(`tvg-logo="${escapeAttr(e.tvgLogo)}"`);
    if (group) attrs.push(`group-title="${escapeAttr(group)}"`);
    out.push(`#EXTINF:-1 ${attrs.join(" ")},${e.name}`);
    out.push(e.url);
  }
  return out.join("\n") + "\n";
}

function escapeAttr(v: string): string {
  return v.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}
