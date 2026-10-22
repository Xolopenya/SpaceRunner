export function verificationReport(config, result, counts, head, generatedAt, exclusions) {
  const files = result.productionBuild.files.map(file => `| ${file.path} | ${file.bytes} | ${file.gzipBytes ?? '—'} |`).join('\n');
  return [
    `# Actual verification — ${config.taskId}`, '', `HEAD: ${head}`, `Generated: ${generatedAt}`, '',
    ...result.checks.map(check => `- \`${check.command}\`: exit ${check.exitCode}; raw output: \`logs/${check.log}\`.`), '',
    `${counts.unit} unit tests and ${counts.browser} browser tests passed. Exact names/results are in manifest.json and browser-results.json.`, '',
    '## Production measurements', '', `Total uncompressed: **${result.productionBuild.totalBytes} bytes**.`, '',
    '| File | Bytes | Node gzip bytes |', '| --- | ---: | ---: |', files, '',
    `Compression method: ${result.productionBuild.gzipMethod}. Vite's original advisory and rounded estimates are retained in build.log; no warning threshold was changed.`, '',
    '## Evidence boundaries', '', ...(config.evidenceNotes ?? []).map(note => `- ${note}`), '',
    '## Known limitations', '', ...(config.limitations ?? []).map(note => `- ${note}`), '',
    '## Snapshot safety', '',
    'Regular tracked HEAD blobs only. No .git database, dependencies, caches, source ZIP, production bundle, environment files or browser profiles. Known-credential checks are not an exhaustive secret audit.',
    `Exclusions: ${JSON.stringify(exclusions)}.`, '',
  ].join('\n');
}
