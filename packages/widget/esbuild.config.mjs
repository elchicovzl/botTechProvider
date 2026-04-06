import { build, context } from 'esbuild';
import { mkdirSync, copyFileSync } from 'fs';

const isWatch = process.argv.includes('--watch');

function copyOutput() {
  try {
    mkdirSync('../../apps/api/widget-dist/widget/v1', { recursive: true });
    copyFileSync('dist/widget.min.js', '../../apps/api/widget-dist/widget/v1/widget.min.js');
  } catch {}
}

if (isWatch) {
  const ctx = await context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: false,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/widget.min.js',
    globalName: 'ArcWebChat',
    plugins: [
      {
        name: 'copy-on-build',
        setup(build) {
          build.onEnd(() => copyOutput());
        },
      },
    ],
  });
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/widget.min.js',
    globalName: 'ArcWebChat',
  });

  copyOutput();
  console.log('Widget built successfully');
}
