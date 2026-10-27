import type { Frame, Project } from '../lib/types';
import { formatTime } from '../lib/frames';
import { isRtl, parseNotes, wrapText } from './text';

export type PdfMode = 'compact' | 'detailed' | 'imagesNotes' | 'imagesOnly' | 'textOnly';
export type Paper = 'a4' | 'letter';
export interface PdfOptions {
  mode: PdfMode;
  paper: Paper;
  /** UI language for static labels */
  lang: 'ar' | 'en';
  dateLabel: string;
}

const SIZE: Record<Paper, { w: number; h: number; mm: [number, number] }> = {
  a4: { w: 794, h: 1123, mm: [210, 297] },
  letter: { w: 816, h: 1056, mm: [215.9, 279.4] },
};
const C = { ink: '#1B1230', amber: '#FFB23E', violet: '#6D3FD0', teal: '#0F766E', soft: '#6b6480', warn: '#B45309' };
const FONT = 'system-ui, "Segoe UI", Tahoma, "Noto Naskh Arabic", "Noto Sans Arabic", Arial, sans-serif';
const SCALE = 2;
const M = 56;

const L = {
  ar: { toc: 'الفهرس', frame: 'لوحة', review: 'تحتاج مراجعة', page: 'صفحة', frames: 'لقطات', notes: 'الملاحظات' },
  en: { toc: 'Contents', frame: 'Board', review: 'Needs review', page: 'Page', frames: 'frames', notes: 'Notes' },
};

class Pager {
  pages: HTMLCanvasElement[] = [];
  ctx!: CanvasRenderingContext2D;
  y = M;
  constructor(public W: number, public H: number) {}
  newPage() {
    const c = document.createElement('canvas');
    c.width = this.W * SCALE;
    c.height = this.H * SCALE;
    this.ctx = c.getContext('2d')!;
    this.ctx.scale(SCALE, SCALE);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.pages.push(c);
    this.y = M;
  }
  ensure(h: number) {
    if (this.y + h > this.H - M - 12) this.newPage();
  }
  get cw() {
    return this.W - 2 * M;
  }
  font(size: number, weight = 400) {
    this.ctx.font = `${weight} ${size}px ${FONT}`;
  }
  /** Draw wrapped text honouring per-paragraph direction. Returns nothing; advances y. */
  para(text: string, size: number, color: string, opts: { weight?: number; indent?: number; lh?: number; align?: 'start' | 'center'; rtl?: boolean } = {}) {
    const { weight = 400, indent = 0, lh = 1.65, align = 'start' } = opts;
    const rtl = opts.rtl ?? isRtl(text);
    this.font(size, weight);
    const maxW = this.cw - indent;
    const lines = wrapText(text, maxW, (s) => this.ctx.measureText(s).width);
    const step = size * lh;
    for (const line of lines) {
      this.ensure(step);
      const ctx = this.ctx;
      this.font(size, weight);
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.direction = rtl ? 'rtl' : 'ltr';
      if (align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(line, this.W / 2, this.y);
      } else if (rtl) {
        ctx.textAlign = 'right';
        ctx.fillText(line, this.W - M - indent, this.y);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(line, M + indent, this.y);
      }
      this.y += step;
    }
  }
  rule(color: string, w = this.cw, thick = 3) {
    this.ensure(thick + 8);
    const rtl = this.ctx.direction === 'rtl';
    this.ctx.fillStyle = color;
    this.ctx.fillRect(rtl ? this.W - M - w : M, this.y, w, thick);
    this.y += thick + 8;
  }
}

async function loadBitmap(b: Blob): Promise<ImageBitmap> {
  return createImageBitmap(b);
}

function drawCover(p: Pager, project: Project, o: PdfOptions, count: number) {
  const ctx = p.ctx;
  const g = ctx.createLinearGradient(0, 0, p.W, p.H * 0.62);
  g.addColorStop(0, C.amber);
  g.addColorStop(0.55, '#B892FF');
  g.addColorStop(1, '#5EEAD4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.W, p.H * 0.62);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(p.W * 0.8, p.H * 0.18, 130, 0, Math.PI * 2);
  ctx.fill();
  p.y = p.H * 0.2;
  p.para('DarsAI', 22, C.ink, { weight: 800, align: 'center', rtl: false });
  p.y += 40;
  p.para(project.title, 40, C.ink, { weight: 800, align: 'center', lh: 1.35 });
  if (project.subject) {
    p.y += 10;
    p.para(project.subject, 22, C.ink, { align: 'center' });
  }
  p.y = p.H * 0.68;
  p.para(o.dateLabel, 16, C.soft, { align: 'center' });
  p.para(`${count} ${L[o.lang].frames}`, 16, C.soft, { align: 'center' });
}

interface Toc {
  title: string;
  page: number;
}

async function build(project: Project, frames: Frame[], o: PdfOptions, toc: Toc[] | null, collected: Toc[]): Promise<HTMLCanvasElement[]> {
  const sz = SIZE[o.paper];
  const p = new Pager(sz.w, sz.h);
  p.newPage();
  drawCover(p, project, o, frames.length);
  p.newPage();

  if (toc) {
    p.para(L[o.lang].toc, 28, C.violet, { weight: 800, rtl: o.lang === 'ar' });
    p.rule(C.amber);
    toc.slice(0, 32).forEach((t) => p.para(`${t.title} ........ ${t.page}`, 15, C.ink, { rtl: isRtl(t.title) }));
    p.newPage();
  }

  const compact = o.mode === 'compact';
  const base = compact ? 13 : 15;
  const heading = (text: string, level: 1 | 2) => {
    p.ensure(level === 1 ? 90 : 60);
    p.y += level === 1 ? 14 : 8;
    collected.push({ title: text, page: p.pages.length });
    p.para(text, level === 1 ? 26 : 19, level === 1 ? C.violet : C.ink, { weight: 800, lh: 1.35 });
    if (level === 1) p.rule(C.amber, 120);
  };

  const showNotes = o.mode !== 'imagesOnly';
  if (showNotes && project.notes.trim()) {
    for (const b of parseNotes(project.notes)) {
      switch (b.kind) {
        case 'gap': p.y += 6; break;
        case 'h1': heading(b.text, 1); break;
        case 'h2': heading(b.text, 2); break;
        case 'p': p.para(b.text, base, C.ink); break;
        case 'bullet': {
          const rtl = isRtl(b.text);
          p.ensure(base * 1.8);
          const bx = rtl ? p.W - M - 8 : M + 8;
          p.ctx.fillStyle = C.amber;
          p.ctx.beginPath();
          p.ctx.arc(bx, p.y + base * 0.8, 4, 0, Math.PI * 2);
          p.ctx.fill();
          p.para(b.text, base, C.ink, { indent: 22 });
          break;
        }
        case 'callout': {
          const rtl = isRtl(b.text);
          p.font(base);
          const n = wrapText(b.text, p.cw - 40, (s) => p.ctx.measureText(s).width).length;
          const h = n * base * 1.65 + 20;
          p.ensure(h);
          p.ctx.fillStyle = 'rgba(94,234,212,0.18)';
          p.ctx.fillRect(M, p.y, p.cw, h);
          p.ctx.fillStyle = C.teal;
          p.ctx.fillRect(rtl ? p.W - M - 5 : M, p.y, 5, h);
          p.y += 10;
          p.para(b.text, base, C.ink, { indent: 22, rtl });
          p.y += 10;
          break;
        }
        case 'equation': {
          p.ensure(60);
          p.ctx.fillStyle = 'rgba(184,146,255,0.14)';
          p.ctx.fillRect(M, p.y, p.cw, 48);
          p.ctx.font = `600 18px "Cambria Math", "STIX Two Math", "Times New Roman", serif`;
          p.ctx.fillStyle = C.ink;
          p.ctx.textAlign = 'center';
          p.ctx.textBaseline = 'middle';
          p.ctx.direction = 'ltr';
          p.ctx.fillText(b.text, p.W / 2, p.y + 24, p.cw - 20);
          p.ctx.textBaseline = 'top';
          p.y += 60;
          break;
        }
      }
    }
    p.y += 10;
  }

  const showImages = o.mode !== 'compact' && o.mode !== 'textOnly';
  const showText = o.mode !== 'imagesOnly';
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const hasText = showText && f.text.trim() !== '';
    if (!showImages && !hasText) continue;
    p.ensure(90);
    p.y += 10;
    const label = `${L[o.lang].frame} ${i + 1} · ${formatTime(f.time)}`;
    p.para(label, 13, C.violet, { weight: 700, rtl: o.lang === 'ar' });
    if (showImages) {
      const bmp = await loadBitmap(f.image);
      const frac = o.mode === 'detailed' ? 0.72 : 1;
      let w = Math.min(p.cw * frac, bmp.width);
      let h = (w * bmp.height) / bmp.width;
      const maxH = p.H - 2 * M - 40;
      if (h > maxH) {
        h = maxH;
        w = (h * bmp.width) / bmp.height;
      }
      p.ensure(h + 8);
      const x = (p.W - w) / 2;
      p.ctx.strokeStyle = '#e5def5';
      p.ctx.lineWidth = 1;
      p.ctx.drawImage(bmp, x, p.y, w, h);
      p.ctx.strokeRect(x, p.y, w, h);
      bmp.close();
      p.y += h + 10;
    }
    if (hasText) {
      if (f.uncertain) p.para(`⚠ ${L[o.lang].review}`, 12, C.warn, { weight: 700, rtl: o.lang === 'ar' });
      p.para(f.text, base, C.ink);
    }
    p.y += 6;
  }

  // page numbers (cover excluded)
  p.pages.forEach((c, i) => {
    if (i === 0) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = C.soft;
    ctx.font = `400 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.direction = 'ltr';
    ctx.fillText(`${i + 1}`, p.W / 2, p.H - 36);
    ctx.fillStyle = C.amber;
    ctx.fillRect(M, p.H - 44, p.cw, 1.5);
  });
  return p.pages;
}

export async function renderPages(project: Project, frames: Frame[], o: PdfOptions): Promise<HTMLCanvasElement[]> {
  const collected: Toc[] = [];
  const first = await build(project, frames, o, null, collected);
  if (collected.length < 4) return first;
  // Two-pass: the TOC page shifts every following page by one.
  const toc = collected.map((t) => ({ ...t, page: t.page + 1 }));
  return build(project, frames, o, toc, []);
}

export async function pagesToPdf(pages: HTMLCanvasElement[], paper: Paper): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const [w, h] = SIZE[paper].mm;
  const doc = new jsPDF({ unit: 'mm', format: [w, h], orientation: 'portrait', compress: true });
  pages.forEach((c, i) => {
    if (i > 0) doc.addPage([w, h], 'portrait');
    doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h, undefined, 'FAST');
  });
  return doc.output('blob');
}
