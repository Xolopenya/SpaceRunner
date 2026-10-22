import { build } from 'vite';

const modules = [];
await build({
  logLevel: 'silent',
  build: { write: false },
  plugins: [{ name: 'review-module-measurement', generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') continue;
      for (const [id, module] of Object.entries(output.modules)) {
        modules.push({ module: id.replaceAll('\\', '/').replace(process.cwd().replaceAll('\\', '/') + '/', ''), renderedBytesBeforeMinification: module.renderedLength });
      }
    }
  } }],
});
console.log(JSON.stringify({ note: 'Module attribution before final chunk minification; final file byte sizes are measured separately.', modules: modules.sort((a, b) => b.renderedBytesBeforeMinification - a.renderedBytesBeforeMinification) }, null, 2));
