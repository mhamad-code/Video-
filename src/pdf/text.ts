export const containsArabic = (s: string): boolean => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);

/** Paragraph direction = direction of the first strong (letter) character. */
export function isRtl(s: string): boolean {
  const m = s.match(/[A-Za-z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/);
  return !!m && containsArabic(m[0]);
}

/** Greedy word wrap. `measure` is injected so it can be tested without a canvas. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && measure(next) > maxWidth) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    lines.push(cur);
  }
  return lines;
}

export type Block =
  | { kind: 'h1' | 'h2' | 'p' | 'bullet' | 'callout' | 'equation'; text: string }
  | { kind: 'gap'; text: '' };

/** Tiny markup: "# " h1, "## " h2, "- " bullet, "> " callout/definition, "$$ x $$" equation, blank = gap. */
export function parseNotes(src: string): Block[] {
  return src.split('\n').map((raw): Block => {
    const l = raw.trim();
    if (!l) return { kind: 'gap', text: '' };
    if (l.startsWith('## ')) return { kind: 'h2', text: l.slice(3) };
    if (l.startsWith('# ')) return { kind: 'h1', text: l.slice(2) };
    if (l.startsWith('- ') || l.startsWith('* ')) return { kind: 'bullet', text: l.slice(2) };
    if (l.startsWith('> ')) return { kind: 'callout', text: l.slice(2) };
    const eq = l.match(/^\$\$(.+)\$\$$/);
    if (eq) return { kind: 'equation', text: eq[1]!.trim() };
    return { kind: 'p', text: l };
  });
}
