import type { XtreamLiveStream } from "@/lib/xtream";

export interface M3uBuildOptions {
  streams: XtreamLiveStream[];
  host: string;
  username: string;
  password: string;
  /** Map of category_id → human name, used for group-title tags */
  categoryNames?: Record<string, string>;
}

function escapeExtInfAttr(value: string): string {
  return value.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}

/**
 * Build an M3U playlist string for the given list of Xtream streams.
 * Stream URLs point directly at MyBunny so video traffic bypasses ComfyTV.
 */
export function buildM3u(opts: M3uBuildOptions): string {
  const host = opts.host.replace(/\/$/, "");
  const u = encodeURIComponent(opts.username);
  const p = encodeURIComponent(opts.password);

  const lines: string[] = ["#EXTM3U"];
  for (const s of opts.streams) {
    const name = s.name || `Channel ${s.stream_id}`;
    const logo = s.stream_icon || "";
    const epg = s.epg_channel_id || "";
    const group =
      (opts.categoryNames && opts.categoryNames[s.category_id]) ||
      s.category_id;

    const attrs: string[] = [];
    if (epg) attrs.push(`tvg-id="${escapeExtInfAttr(epg)}"`);
    attrs.push(`tvg-name="${escapeExtInfAttr(name)}"`);
    if (logo) attrs.push(`tvg-logo="${escapeExtInfAttr(logo)}"`);
    attrs.push(`group-title="${escapeExtInfAttr(group)}"`);

    lines.push(`#EXTINF:-1 ${attrs.join(" ")},${name}`);
    lines.push(`${host}/live/${u}/${p}/${s.stream_id}.m3u8`);
  }
  return lines.join("\n") + "\n";
}
