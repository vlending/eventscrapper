import { KPopEvent } from '../types';

const HEADERS = [
  'Artist',
  'Title',
  'Store',
  'EventType',
  'ApplicationPeriod',
  'EventDate',
  'Status',
  'Link',
  'LinkVerified',
  'ThumbnailUrl',
] as const;

const fieldOf = (e: KPopEvent): string[] => [
  e.artist,
  e.title,
  String(e.store),
  String(e.eventType),
  e.applicationPeriod,
  e.eventDate,
  e.status,
  e.link,
  e.linkVerified === false ? 'NO' : 'YES',
  e.thumbnailUrl || '',
];

const escapeCsv = (value: string): string => {
  const v = value ?? '';
  // RFC4180: wrap in quotes if contains comma, quote, or newline
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
};

export const buildCsv = (events: KPopEvent[]): string => {
  const lines = [HEADERS.join(',')];
  for (const e of events) {
    lines.push(fieldOf(e).map(escapeCsv).join(','));
  }
  return lines.join('\n');
};

export const buildTsv = (events: KPopEvent[]): string => {
  // For pasting into Google Sheets / Excel: tab-separated, strip tabs/newlines from cells
  const sanitize = (v: string) => (v ?? '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ');
  const lines = [HEADERS.join('\t')];
  for (const e of events) {
    lines.push(fieldOf(e).map(sanitize).join('\t'));
  }
  return lines.join('\n');
};

export const downloadCsv = (events: KPopEvent[], filename = 'kpop-events.csv') => {
  // Prepend BOM so Excel/Google Sheets detect UTF-8 (Korean chars render correctly)
  const csv = '﻿' + buildCsv(events);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const copyTsvToClipboard = async (events: KPopEvent[]): Promise<boolean> => {
  const tsv = buildTsv(events);
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    // Fallback: use execCommand on a hidden textarea
    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
};
