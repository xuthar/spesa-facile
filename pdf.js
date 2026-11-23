import { groupByDepartment, listTotals, money } from './core.js';

// Standard PDF fonts use WinAnsi. Encode text explicitly so offsets refer to bytes.
function pdfText(value) {
  const symbols = { '€': 128, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151, '…': 133, '™': 153, '•': 149, '\u00a0': 32 };
  let result = '';
  for (const character of String(value).normalize('NFC')) {
    const point = symbols[character] ?? character.charCodeAt(0);
    const code = point >= 32 && point <= 255 ? point : 63;
    result += '\\' + code.toString(8).padStart(3, '0');
  }
  return '(' + result + ')';
}

function wrap(value, limit) {
  const lines = [];
  let line = '';
  for (const word of String(value).split(/\s+/)) {
    const parts = word.match(new RegExp('.{1,' + limit + '}', 'g')) || [''];
    for (const part of parts) {
      if (line.length + part.length + 1 > limit) {
        lines.push(line);
        line = '';
      }
      line += (line ? ' ' : '') + part;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function createShoppingPdf({ title, lines, catalogDate, context, createdAt = new Date() }) {
  if (!lines.length) throw new Error('Scegli almeno un prodotto per creare il PDF.');
  const totals = listTotals(lines);
  const pages = [];
  let commands = [];
  let y = 0;
  const date = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const text = (value, x, top, size = 10, bold = false, color = '0.13 0.25 0.19') => {
    commands.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + color + ' rg 1 0 0 1 ' + x + ' ' + (842 - top) + ' Tm ' + pdfText(value) + ' Tj ET');
  };
  const rule = top => commands.push('0.84 0.89 0.85 RG 0.5 w 40 ' + (842 - top) + ' m 555 ' + (842 - top) + ' l S');
  const columns = () => {
    text('PRODOTTO / FORMATO', 45, y, 8, true);
    text('Q.TÀ', 335, y, 8, true);
    text('UNITARIO', 388, y, 8, true);
    text('IMPORTO', 483, y, 8, true);
    y += 9;
    rule(y);
    y += 20;
  };
  const newPage = () => {
    if (commands.length) pages.push(commands);
    commands = [];
    text('spesa facile', 40, 41, 12, true);
    const titleLines = wrap(title || 'La mia spesa', 58);
    let titleY = 72;
    for (const line of titleLines) {
      text(line, 40, titleY, 18, true);
      titleY += 22;
    }
    text('Lista del ' + date.format(createdAt) + ' · ' + totals.count + ' prodotti · ' + totals.quantity + ' confezioni', 40, titleY, 9);
    text(context + ' · Prezzi rilevati il ' + date.format(new Date(catalogDate)), 40, titleY + 16, 8, false, '0.36 0.43 0.38');
    y = titleY + 39;
  };
  const departmentHeading = name => {
    text(name, 40, y, 12, true);
    y += 23;
    columns();
  };
  newPage();
  for (const group of groupByDepartment(lines)) {
    if (y > 675) newPage();
    departmentHeading(group.name);
    for (const product of group.items) {
      const nameLines = wrap(product.name, 47);
      const detailLines = wrap([product.format, product.customPrice ? 'Prezzo modificato' : '', product.offer ? 'Promo quantità da verificare su Conad' : '', product.estimated ? 'Peso variabile · costo stimato' : ''].filter(Boolean).join(' · '), 57);
      const height = nameLines.length * 13 + detailLines.length * 11 + 16;
      if (y + height > 735) {
        newPage();
        departmentHeading(group.name + ' (continua)');
      }
      commands.push('0.62 0.72 0.65 RG 0.6 w 42 ' + (842 - y - 1) + ' 7 7 re S');
      nameLines.forEach((line, index) => text(line, 57, y + index * 13, 10));
      detailLines.forEach((line, index) => text(line, 57, y + nameLines.length * 13 + index * 11, 8, false, '0.40 0.46 0.42'));
      text(String(product.quantity), 340, y, 10);
      text(money(product.priceCents), 388, y, 10);
      text(product.totalCents == null ? 'Da indicare' : money(product.totalCents), 483, y, 10, true);
      y += height;
      rule(y - 8);
    }
    if (y + 26 > 749) newPage();
    text('Subtotale ' + group.name, 57, y + 3, 9, true);
    text(money(group.totalCents), 483, y + 3, 10, true);
    y += 34;
  }
  if (y + 105 > 758) newPage();
  rule(y);
  y += 27;
  text(totals.missing ? 'TOTALE PARZIALE' : 'TOTALE DELLA SPESA', 40, y, 12, true);
  text(money(totals.totalCents), 465, y, 18, true);
  y += 24;
  if (totals.missing) {
    text(totals.missing + ' prodotti con prezzo da indicare, esclusi dal totale.', 40, y, 9);
    y += 17;
  }
  for (const line of wrap('Prezzi riferiti alle confezioni indicate. Promozioni a soglia, carte e buoni da verificare. I costi dei prodotti a peso variabile sono stimati. Eventuali consegne e costi di servizio sono esclusi.', 113)) {
    text(line, 40, y, 8, false, '0.40 0.46 0.42');
    y += 12;
  }
  pages.push(commands);
  pages.forEach((page, index) => {
    const footer = 'Spesa Facile · ' + (index + 1) + ' / ' + pages.length;
    page.push('BT /F1 8 Tf 0.4 0.46 0.42 rg 1 0 0 1 40 28 Tm ' + pdfText(footer) + ' Tj ET');
  });
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, index) => (5 + index * 2) + ' 0 R').join(' ') + '] >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const streamId = pageId + 1;
    const stream = page.join('\n') + '\n';
    objects[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + streamId + ' 0 R >>';
    objects[streamId] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream';
  });
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index++) {
    offsets[index] = document.length;
    document += index + ' 0 obj\n' + objects[index] + '\nendobj\n';
  }
  const start = document.length;
  document += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) document += String(offset).padStart(10, '0') + ' 00000 n \n';
  document += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF\n';
  return new Blob([document], { type: 'application/pdf' });
}
