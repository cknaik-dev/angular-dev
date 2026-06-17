/* Generate public/course.pdf by printing the built app's /print page with
   headless Chromium (Playwright). Chromium's native PDF engine respects our
   @media print CSS and renders SVG diagrams + real fonts.

   Usage:  npm run build  &&  npm run pdf            */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', 'dist', 'angular-learning-playground', 'browser');
const outFile = path.join(__dirname, '..', 'public', 'course.pdf');
const PORT = 4321;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function serveStatic() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(root, urlPath);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, 'index.html'); // SPA fallback
    }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(file).pipe(res);
  });
}

(async () => {
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error('Build not found. Run "npm run build" first.');
    process.exit(1);
  }
  const chapterCount = JSON.parse(
    fs.readFileSync(path.join(root, 'chapters', 'index.json'), 'utf8')
  ).length;

  const server = serveStatic();
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/print`, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait until every chapter article has rendered.
    await page.waitForFunction(
      (n) => document.querySelectorAll('.print-chapter').length >= n,
      chapterCount,
      { timeout: 60000 }
    );

    // Force light theme and expand all collapsed sections for the PDF.
    await page.evaluate(() => {
      document.documentElement.dataset['theme'] = 'light';
      document.querySelectorAll('details').forEach((d) => (d.open = true));
      const toolbar = document.querySelector('.print-toolbar');
      if (toolbar) toolbar.style.display = 'none';
    });
    await page.waitForTimeout(1500); // let previews + fonts settle

    await page.pdf({
      path: outFile,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' }
    });
    console.log('Wrote', path.relative(process.cwd(), outFile));
  } finally {
    await browser.close();
    server.close();
  }
})();
