const { build, context } = require('esbuild');
const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/widget.tsx'],
  bundle: true,
  outfile: 'dist/widget.js',
  target: 'es6',
  format: 'iife',
  jsxFactory: 'figma.widget.h',
  jsxFragment: 'figma.widget.Fragment',
  logLevel: 'info',
};

if (isWatch) {
  context(config).then((ctx) => ctx.watch()).catch(() => process.exit(1));
} else {
  build(config).catch(() => process.exit(1));
}
