import { COLS, GROUPS, fmt, reportTitle, setLabel, type Report } from './report';

/** A4 na šířku v bodech PDF. */
const PAGE = { w: 842, h: 595 };
/** Kreslicí plocha ve stejném poměru stran; SCALE určuje ostrost (≈ 240 DPI). */
const W = 1123;
const H = 794;
const SCALE = 2.5;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const C = {
  text: '#0f172a',
  muted: '#475569',
  line: '#cbd5e1',
  head: '#1d4ed8',
  headText: '#ffffff',
  sub: '#dbeafe',
  zebra: '#f1f5f9',
  total: '#e2e8f0',
  good: '#15803d',
  bad: '#b91c1c',
};

/**
 * Vykreslí statistiku do obrázku. Kreslí se přes canvas, takže diakritika funguje
 * se systémovým písmem a PDF nepotřebuje vložené fonty ani knihovnu.
 */
function drawReport(r: Report): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas není dostupný');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';

  const font = (size: number, weight = 400) => (ctx.font = `${weight} ${size}px ${FONT}`);
  const text = (s: string, x: number, y: number, align: CanvasTextAlign = 'left', color = C.text) => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const fit = (s: string, max: number) => {
    if (ctx.measureText(s).width <= max) return s;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
    return `${s}…`;
  };

  const M = 40;
  const x0 = M;
  const x1 = W - M;
  const numW = 40;
  const nameW = 230;
  const colW = (x1 - x0 - numW - nameW) / COLS.length;
  const colX = (i: number) => x0 + numW + nameW + i * colW;

  // Hlavička
  font(26, 700);
  text(fit(reportTitle(r), x1 - x0), x0, M + 12);
  const sets = r.scores.map((s) => `${s.us}:${s.them}`).join(', ');
  font(15);
  text(
    `${new Date(r.match.date).toLocaleDateString('cs-CZ')} · sety ${r.won.us}:${r.won.them} (${sets}) · ${setLabel(r.set)}`,
    x0,
    M + 42,
    'left',
    C.muted,
  );

  // Hlavička tabulky: skupiny a popisky sloupců
  const top = M + 70;
  let y = top;
  ctx.fillStyle = C.head;
  ctx.fillRect(x0, y, x1 - x0, 26);
  font(12, 700);
  let gi = 0;
  for (const g of GROUPS) {
    text(g.name.toUpperCase(), colX(gi) + (g.span * colW) / 2, y + 13, 'center', C.headText);
    gi += g.span;
  }
  y += 26;
  ctx.fillStyle = C.sub;
  ctx.fillRect(x0, y, x1 - x0, 22);
  text('#', x0 + numW / 2, y + 11, 'center');
  text('Hráč', x0 + numW + 8, y + 11);
  COLS.forEach((c, i) => text(c.label, colX(i) + colW / 2, y + 11, 'center'));
  y += 22;

  // Řádky hráčů + součet; výška řádku se přizpůsobí počtu hráčů, aby se vše vešlo na stranu
  const footerY = H - M;
  const rowH = Math.min(26, (footerY - 28 - y) / (r.rows.length + 1));
  const size = Math.max(8, Math.min(14, rowH * 0.56));
  const drawRow = (num: string, name: string, stats: Report['total'], bg: string | null, weight: number) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(x0, y, x1 - x0, rowH);
    }
    const cy = y + rowH / 2;
    font(size, 700);
    text(num, x0 + numW / 2, cy, 'center');
    font(size, weight);
    text(fit(name, nameW - 12), x0 + numW + 8, cy);
    COLS.forEach((c, i) => {
      const v = c.get(stats);
      const color = c.label === '+/−' && v ? (v > 0 ? C.good : C.bad) : C.text;
      text(fmt(v, c), colX(i) + colW / 2, cy, 'center', color);
    });
    y += rowH;
  };
  r.rows.forEach(({ player, stats }, i) =>
    drawRow(player.number, player.libero ? `${player.name} (L)` : player.name, stats, i % 2 ? C.zebra : null, 500),
  );
  ctx.fillStyle = C.line;
  ctx.fillRect(x0, y, x1 - x0, 1.5);
  drawRow('', 'CELKEM', r.total, C.total, 800);

  // Svislé čáry mezi skupinami sloupců
  ctx.fillStyle = C.line;
  gi = 0;
  for (const g of GROUPS) {
    ctx.fillRect(colX(gi) - 0.5, top + 26, 1, y - top - 26);
    gi += g.span;
  }

  // Patička
  font(12);
  text(`Body z chyb soupeře: ${r.oppErr} · Body soupeře bez naší chyby: ${r.oppPoint}`, x0, footerY - 6, 'left', C.muted);
  text(`Volejbal Statistika · ${new Date().toLocaleDateString('cs-CZ')}`, x1, footerY - 6, 'right', C.muted);
  return canvas;
}

export async function reportToPdf(r: Report): Promise<Blob> {
  const canvas = drawReport(r);
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Obrázek se nepodařilo vytvořit'))), 'image/jpeg', 0.92),
  );
  return imagePdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height, `Statistika ${reportTitle(r)}`);
}

/** Text pro PDF v UTF-16BE, aby fungovala diakritika (např. v názvu dokumentu). */
const pdfString = (s: string) =>
  `<FEFF${Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).padStart(4, '0')).join('')}>`;

/** Jednostránkové PDF (A4 na šířku) s jedním JPEG obrázkem přes celou stránku. */
export function imagePdf(jpeg: Uint8Array<ArrayBuffer>, width: number, height: number, title: string): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (d: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof d === 'string' ? enc.encode(d) : d;
    chunks.push(bytes);
    size += bytes.length;
  };
  const obj = (id: number, ...body: (string | Uint8Array<ArrayBuffer>)[]) => {
    offsets[id] = size;
    push(`${id} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };

  const content = `q ${PAGE.w} 0 0 ${PAGE.h} 0 0 cm /Im0 Do Q`;
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  );
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title ${pdfString(title)} /Producer (Volejbal Statistika) >>`);

  const xref = size;
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
