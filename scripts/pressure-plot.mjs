import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Projection of actual recorded geometry; deliberately labeled as a plot. */
export async function pressurePlot(browser, output) {
  const runs = await Promise.all(['baseline', 'pressure'].map(p => readFile(join(output, `pressure-early-42-neutral-${p}.json`), 'utf8').then(JSON.parse)));
  const width = 1400, height = 800, left = 75, plotWidth = 1240;
  const end = runs[0].terminal.distance, x = q => left + q / end * plotWidth;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b2c"/><g font-family="Arial,sans-serif" fill="#e6f3ff"><text x="40" y="35" font-size="24">Actual committed geometry — seed42 / neutral / identical60s input</text><text x="40" y="62" font-size="15">Data projection, not a game screenshot or collision proof. Dotted line: actual ship; shading: omitted source spans.</text>`;
  const evidence = [];
  for (const [i, r] of runs.entries()) {
    const top = 115 + i * 310;
    const hazards = r.geometry.filter(h => h.passDistance < end), omitted = r.decisions.filter(d => d.status !== 'committed');
    svg += `<text x="40" y="${top - 20}" font-size="20">${i ? 'B / pressure-v1' : 'A / director-v1'}: ${hazards.length} accepted centers in matched window</text>`;
    for (const [j, axis] of ['x', 'y'].entries()) {
      const y0 = top + j * 130, half = axis === 'x' ? 6 : 3.6, y = v => y0 + 55 - v / half * 50;
      svg += `<rect x="${left}" y="${y0}" width="${plotWidth}" height="110" fill="#17263b" stroke="#42526a"/>`;
      for (const d of omitted) svg += `<rect x="${x(Math.min(end, d.section.startDistance))}" y="${y0}" width="${Math.max(0, x(Math.min(end, d.section.endDistance)) - x(Math.min(end, d.section.startDistance)))}" height="110" fill="#bc5e5e" opacity=".22"/>`;
      svg += `<line x1="${left}" x2="${left + plotWidth}" y1="${y(0)}" y2="${y(0)}" stroke="#8bf2ff" stroke-dasharray="5 5"/><text x="18" y="${y0 + 55}" font-size="16">${axis.toUpperCase()}</text>`;
      for (const h of hazards) svg += `<ellipse cx="${x(h.passDistance)}" cy="${y(h[axis])}" rx="${h.radius / end * plotWidth}" ry="${h.radius / half * 50}" fill="${i ? '#ffc27b' : '#95baff'}" opacity=".8"/>`;
      if (j === 1) for (let q = 0; q <= end; q += 200) svg += `<text x="${x(q)}" y="${y0 + 128}" font-size="12">${q}</text>`;
    }
    evidence.push({ policy: r.policy, end, hazards, omitted: omitted.map(d => ({ section: d.section, reason: d.reason })), firstContact: r.firstContact });
  }
  svg += `<text x="40" y="744" font-size="15">Ellipses project unchanged enclosing sphere radii; thin/debris calibrated proxies are smaller. Depth axis: world units.</text><text x="40" y="771" font-size="15">Research continues after three-hit death; this projection does not claim survival or a required human maneuver.</text></g></svg>`;
  const page = await browser.newPage({ viewport: { width, height } });
  try { await page.setContent(`<style>body{margin:0}</style>${svg}`); await page.screenshot({ path: 'test-results/pressure-geometry-comparison.png' }); }
  finally { await page.close(); }
  await writeFile(join(output, 'pressure-geometry-comparison.json'), JSON.stringify(evidence) + '\n');
}
