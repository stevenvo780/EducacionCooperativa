import { describe, expect, it } from 'vitest';
import { formatSubtitleDuration, formatSubtitleTime, parseSubtitle } from '@/lib/parsers/subtitle';

describe('parseSubtitle SRT', () => {
  it('parsea bloques estándar', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,500
Hola mundo

2
00:00:04,000 --> 00:00:05,200
Línea dos`;
    const cues = parseSubtitle(srt, 'srt');
    expect(cues).toHaveLength(2);
    expect(cues[0]!.startMs).toBe(1000);
    expect(cues[0]!.endMs).toBe(3500);
    expect(cues[0]!.text).toBe('Hola mundo');
    expect(cues[1]!.startMs).toBe(4000);
  });

  it('strip de tags HTML inline', () => {
    const srt = `1\n00:00:01,000 --> 00:00:02,000\n<i>hola</i> <b>mundo</b>`;
    const cues = parseSubtitle(srt, 'srt');
    expect(cues[0]!.text).toBe('hola mundo');
  });

  it('soporta separador de tiempo con punto (variantes)', () => {
    const srt = `1\n00:00:01.000 --> 00:00:02.000\nhola`;
    expect(parseSubtitle(srt, 'srt')).toHaveLength(1);
  });

  it('soporta sin línea de índice numérico', () => {
    const srt = `00:00:01,000 --> 00:00:02,000\nhola`;
    expect(parseSubtitle(srt, 'srt')).toHaveLength(1);
  });

  it('descarta bloques inválidos', () => {
    const srt = `random garbage\n\n1\n00:00:01,000 --> 00:00:02,000\nok`;
    const cues = parseSubtitle(srt, 'srt');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.text).toBe('ok');
  });
});

describe('parseSubtitle VTT', () => {
  it('strip header WEBVTT', () => {
    const vtt = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nhola`;
    const cues = parseSubtitle(vtt, 'vtt');
    expect(cues).toHaveLength(1);
  });
});

describe('parseSubtitle SBV', () => {
  it('parsea formato youtube', () => {
    const sbv = `0:00:01.000,0:00:02.500\nhola mundo`;
    const cues = parseSubtitle(sbv, 'sbv');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.startMs).toBe(1000);
    expect(cues[0]!.endMs).toBe(2500);
    expect(cues[0]!.text).toBe('hola mundo');
  });
});

describe('formatSubtitleTime', () => {
  it('formato minuto:segundo (sin hora)', () => {
    expect(formatSubtitleTime(65500)).toBe('01:05');
  });
  it('formato con hora', () => {
    expect(formatSubtitleTime(3661000)).toBe('1:01:01');
  });
  it('formato con padding', () => {
    expect(formatSubtitleTime(7000)).toBe('00:07');
  });
});

describe('formatSubtitleDuration', () => {
  it('formato Xm Ys', () => {
    expect(formatSubtitleDuration(65500)).toBe('1m 5s');
    expect(formatSubtitleDuration(0)).toBe('0m 0s');
    expect(formatSubtitleDuration(3600000)).toBe('60m 0s');
  });
});
