export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export type SubtitleFormat = 'srt' | 'vtt' | 'sbv';

export function parseSubtitle(text: string, format: SubtitleFormat): SubtitleCue[] {
  if (format === 'sbv') return parseSbv(text);
  const stripped = format === 'vtt' ? text.replace(/^WEBVTT.*\n/, '') : text;
  return parseSrt(stripped);
}

function parseSrt(text: string): SubtitleCue[] {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const timeLineIdx = /-->/.test(lines[0] ?? '') ? 0 : 1;
    const timeLine = lines[timeLineIdx] ?? '';
    const m = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!m) continue;
    cues.push({
      index: cues.length,
      startMs: toMs(+m[1]!, +m[2]!, +m[3]!, +m[4]!),
      endMs: toMs(+m[5]!, +m[6]!, +m[7]!, +m[8]!),
      text: lines.slice(timeLineIdx + 1).join('\n').replace(/<[^>]+>/g, '')
    });
  }
  return cues;
}

function parseSbv(text: string): SubtitleCue[] {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const m = (lines[0] ?? '').match(/(\d+):(\d{2}):(\d{2})\.(\d{3}),(\d+):(\d{2}):(\d{2})\.(\d{3})/);
    if (!m) continue;
    cues.push({
      index: cues.length,
      startMs: toMs(+m[1]!, +m[2]!, +m[3]!, +m[4]!),
      endMs: toMs(+m[5]!, +m[6]!, +m[7]!, +m[8]!),
      text: lines.slice(1).join('\n')
    });
  }
  return cues;
}

function toMs(h: number, m: number, s: number, ms: number) {
  return ((h * 60 + m) * 60 + s) * 1000 + ms;
}

export function formatSubtitleTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatSubtitleDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
