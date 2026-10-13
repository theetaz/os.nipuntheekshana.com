import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const origin = new URL(process.env.BASE_URL ?? 'http://localhost:4424');
if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || !['4413', '4424'].includes(origin.port)) {
  throw new Error('Serve the local build on port 4413 or 4424 before generating the OG image.');
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1,
    colorScheme: 'light', reducedMotion: 'reduce' });
  const response = await page.goto(new URL('/og', origin).href);
  if (!response?.ok()) throw new Error(`OG page returned ${response?.status() ?? 'no response'}.`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
  const image = await sharp(screenshot).png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 }).toBuffer();
  const metadata = await sharp(image).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630 || image.byteLength > 300_000) {
    throw new Error(`OG image must be 1200 × 630 and at most 300,000 B; got ${metadata.width} × ${metadata.height}, ${image.byteLength} B.`);
  }
  await writeFile(new URL('../public/og.png', import.meta.url), image);
  console.log(`public/og.png: 1200 × 630, ${image.byteLength} B`);
} finally {
  await browser.close();
}
