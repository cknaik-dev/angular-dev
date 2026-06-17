/* Build a single course PDF from the chapter JSON, saved to public/course.pdf.
   Run with:  npm run pdf
   It walks the same block model the app renders. */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const chaptersDir = path.join(__dirname, '..', 'public', 'chapters');
const outFile = path.join(__dirname, '..', 'public', 'course.pdf');

const COLOR = { text: '#16202e', muted: '#5c6b80', accent: '#2563eb', code: '#0f1722', codeBg: '#f0f3f8' };

function stripHtml(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;&amp;/g, '&&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const index = JSON.parse(fs.readFileSync(path.join(chaptersDir, 'index.json'), 'utf8'));

const doc = new PDFDocument({ size: 'A4', margin: 54, bufferPages: true });
const stream = fs.createWriteStream(outFile);
doc.pipe(stream);

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

function para(text, opts = {}) {
  doc.font(opts.font || 'Helvetica')
    .fontSize(opts.size || 10.5)
    .fillColor(opts.color || COLOR.text)
    .text(text, { paragraphGap: opts.gap ?? 6, lineGap: 1.5, align: opts.align || 'left' });
}

function codeBlock(label, code) {
  const padH = 8;
  const padV = 7;
  const fontSize = 8.5;
  const innerW = W - padH * 2;
  // Measure with the EXACT options used to render, so the box fits the text.
  const opts = { width: innerW, lineGap: 2, lineBreak: true };
  doc.font('Courier').fontSize(fontSize);
  const textH = doc.heightOfString(code, opts);
  const boxH = textH + padV * 2;

  doc.font('Helvetica-Bold').fontSize(8.5);
  const labelH = label ? doc.heightOfString(label, { width: W }) + 3 : 0;

  // Keep label + box together on one page.
  if (doc.y + labelH + boxH > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  if (label) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR.muted).text(label, { width: W });
    doc.y += 1;
  }

  const x = doc.page.margins.left;
  const y = doc.y;
  doc.save().rect(x, y, W, boxH).fill(COLOR.codeBg).restore();
  doc.font('Courier').fontSize(fontSize).fillColor(COLOR.code).text(code, x + padH, y + padV, opts);
  doc.y = y + boxH + 6;
}

function renderBlock(b) {
  switch (b.type) {
    case 'text':
      para(stripHtml(b.text));
      break;
    case 'note':
      para(stripHtml(b.text), { font: 'Helvetica-Oblique', color: COLOR.muted });
      break;
    case 'link':
      para(`→ ${b.label}: ${b.url}`, { size: 9.5, color: COLOR.accent });
      break;
    case 'list':
      b.items.forEach((it) => para('•  ' + stripHtml(it), { gap: 2 }));
      doc.moveDown(0.3);
      break;
    case 'code':
      codeBlock(b.label, b.code);
      break;
    case 'run':
      codeBlock('Example', b.code);
      break;
    case 'ng':
      codeBlock('component.ts', b.ts);
      codeBlock('component.html', b.html);
      break;
    case 'compare':
      b.cards.forEach((c) => codeBlock(c.title, c.code));
      break;
    case 'boxes':
      b.boxes.forEach((x) => para('•  ' + x.title + (x.detail ? ' — ' + x.detail : ''), { gap: 2 }));
      doc.moveDown(0.3);
      break;
    case 'stack':
      b.layers.forEach((x) => para('•  ' + x.title + (x.detail ? ' — ' + x.detail : ''), { gap: 2 }));
      doc.moveDown(0.3);
      break;
    case 'flow':
      para(b.steps.join('   →   '), { font: 'Helvetica-Bold', size: 9.5, color: COLOR.muted });
      break;
    case 'svg':
    case 'image':
      if (b.caption) para('[ ' + stripHtml(b.caption) + ' ]', { size: 9, color: COLOR.muted, align: 'center' });
      break;
    default:
      break;
  }
}

// Cover
doc.moveDown(6);
doc.font('Helvetica-Bold').fontSize(30).fillColor(COLOR.text).text('Angular Learning', { align: 'center' });
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(13).fillColor(COLOR.muted)
  .text('A beginner-friendly path from JavaScript to Angular', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).text(`${index.length} chapters`, { align: 'center' });

let currentGroup = '';
for (const summary of index) {
  const chapter = JSON.parse(fs.readFileSync(path.join(chaptersDir, summary.id + '.json'), 'utf8'));
  doc.addPage();

  if (chapter.group !== currentGroup) {
    currentGroup = chapter.group;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR.accent)
      .text(currentGroup.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.3);
  }

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.accent).text(chapter.kicker);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLOR.text).text(chapter.heading, { lineGap: 2 });
  doc.moveDown(0.2);
  para(chapter.summary, { color: COLOR.muted, gap: 10 });

  chapter.sections.forEach((section, i) => {
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.text)
      .text(`${i + 1}. ${section.title}`, { lineGap: 2 });
    doc.moveDown(0.2);
    section.blocks.forEach(renderBlock);
  });
}

// Page numbers
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  doc.font('Helvetica').fontSize(8).fillColor(COLOR.muted)
    .text(`${i + 1}`, doc.page.margins.left, doc.page.height - 36, { align: 'center', width: W });
}

doc.end();
stream.on('finish', () => console.log('Wrote', path.relative(process.cwd(), outFile)));
