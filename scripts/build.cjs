#!/usr/bin/env node

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '../client');
const distDir = path.join(clientDir, 'dist');

async function build() {
  console.log('Building client assets...\n');

  // Create dist directory
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Bundle JS from entry point (esbuild resolves all imports automatically)
  console.log('Bundling JavaScript...');
  const jsResult = await esbuild.build({
    entryPoints: [path.join(clientDir, 'js/main.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(distDir, 'bundle.min.js'),
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    metafile: true,
  });

  const bundleSize = fs.statSync(path.join(distDir, 'bundle.min.js')).size;
  console.log(`  JS bundle: client/dist/bundle.min.js (${(bundleSize / 1024).toFixed(1)} KB)`);

  // Calculate original size from metafile
  const inputs = jsResult.metafile.inputs;
  const originalSize = Object.values(inputs).reduce((sum, input) => sum + input.bytes, 0);
  const jsSavings = ((1 - bundleSize / originalSize) * 100).toFixed(1);
  console.log(`  Source: ${(originalSize / 1024).toFixed(1)} KB → ${(bundleSize / 1024).toFixed(1)} KB (${jsSavings}% smaller)`);

  // Minify CSS
  console.log('\nMinifying CSS...');
  const cssPath = path.join(clientDir, 'css/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const originalCssSize = cssContent.length;

  const cssResult = await esbuild.transform(cssContent, {
    loader: 'css',
    minify: true,
  });

  const cssBundlePath = path.join(distDir, 'styles.min.css');
  fs.writeFileSync(cssBundlePath, cssResult.code);
  const cssSavings = ((1 - cssResult.code.length / originalCssSize) * 100).toFixed(1);
  console.log(`  CSS bundle: client/dist/styles.min.css (${(cssResult.code.length / 1024).toFixed(1)} KB)`);
  console.log(`  Source: ${(originalCssSize / 1024).toFixed(1)} KB → ${(cssResult.code.length / 1024).toFixed(1)} KB (${cssSavings}% smaller)`);

  // Transform HTML (replace dev scripts with production bundle)
  console.log('\nTransforming HTML...');
  let html = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');

  // Replace scripts section with production bundle
  html = html.replace(
    /<!-- BUILD:SCRIPTS -->[\s\S]*?<!-- \/BUILD:SCRIPTS -->/,
    `<script src="https://cdnjs.cloudflare.com/ajax/libs/phaser/3.90.0/phaser.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"></script>
  <script src="/dist/bundle.min.js"></script>`
  );

  // Replace dev CSS with minified
  html = html.replace('/css/styles.css', '/dist/styles.min.css');

  const prodHtmlPath = path.join(distDir, 'index.html');
  fs.writeFileSync(prodHtmlPath, html);
  console.log(`  HTML: client/dist/index.html`);

  console.log('\nBuild complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
