import { writeFile, mkdir } from 'node:fs/promises';

export async function patternPlots(browser, examples) {
  await mkdir('test-results', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const files = [];
  try {
    for (const family of ['scattered', 'narrowing', 'alternating', 'vertical-weave']) {
      const example = examples[family];
      if (!example) throw new Error(`No actual accepted ${family} example for plot`);
      const tx = example.context.candidate, start = tx.startDistance, span = tx.endDistance - start;
      const left = 90, right = 1200, width = right - left;
      const x = q => left + (q - start + 64) / (span + 84) * width;
      const text = (px, py, label, size = 16) => `<text x="${px}" y="${py}" font-size="${size}">${label}</text>`;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900"><style>text{fill:#e4eef5;font-family:Arial,sans-serif}.axis{stroke:#465970;fill:none}</style><rect width="1280" height="900" fill="#0c1727"/>`;
      svg += text(40, 45, `${family} / actual generated data and independently replayed witness`, 25);
      svg += text(40, 76, `Seed ${example.seed}, intensity ${example.intensity}, variation ${example.variation}. Research projection; production gameplay unchanged.`);
      svg += text(40, 99, example.origin ?? 'Beam search witness, independently replayed');
      for (const [axis, middle, scale, bound] of [['x', 270, 22, 6], ['y', 640, 36, 3.6]]) {
        svg += text(40, middle - 140, `${axis.toUpperCase()} versus pass distance`, 20);
        svg += `<path class="axis" d="M${left} ${middle-135}V${middle+135}H${right}"/>`;
        for (let cell = 0; cell <= tx.cellCount; cell++) {
          const px = x(start + cell * 24);
          svg += `<path class="axis" opacity=".4" d="M${px} ${middle-135}V${middle+135}"/>` + text(px - 5, middle + 158, cell * 24);
        }
        for (const p of [-bound, 0, bound]) svg += text(35, middle - p * scale + 5, p);
        for (const h of [...example.context.committed, ...tx.hazards]) svg += `<ellipse cx="${x(h.passDistance)}" cy="${middle - h[axis] * scale}" rx="${h.radius * width / (span + 84)}" ry="${h.radius * scale}" fill="#ffbd86" opacity=".62"/>`;
        const path = example.trace.map((p, i) => `${i ? 'L' : 'M'}${x(p.distance)} ${middle - p[axis] * scale}`).join('');
        svg += `<path d="${path}" fill="none" stroke="#75e4dc" stroke-width="3"/>`;
      }
      svg += text(90, 845, 'Amber: logical outer-radius projections. Cyan: actual ship center. Cell lines are ownership, not movement lanes.');
      svg += text(90, 875, `Pass distance relative to transaction start. Calibrated 3D collision/replay is authoritative; projection overlap alone is not contact.`) + '</svg>';
      const name = `pattern-${family}.png`;
      await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
      await page.screenshot({ path: `test-results/${name}` });
      files.push(name);
      // SVG is raw numerical plot evidence, kept with ignored results only.
      await writeFile(`test-results/${name.replace('.png', '.svg')}`, svg);
    }
  } finally { await page.close(); }
  return files;
}
