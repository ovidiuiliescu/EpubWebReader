const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'dist');
const targetDir = path.join(__dirname, '..', 'standalone-compiled');
const readmeSource = path.join(__dirname, '..', 'standalone', 'README.md');
const readmeTarget = path.join(targetDir, 'README.md');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Creating standalone package...');

ensureDir(targetDir);

if (fs.existsSync(sourceDir)) {
  fs.readdirSync(sourceDir).forEach(file => {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(targetDir, file);
    copyRecursive(srcPath, destPath);
  });
  console.log('✓ Copied build files to standalone-compiled/');
} else {
  console.error('✗ dist/ directory not found. Run "npm run build" first.');
  process.exit(1);
}

if (fs.existsSync(readmeSource)) {
  fs.copyFileSync(readmeSource, readmeTarget);
  console.log('✓ Copied README.md');
} else {
  console.log('! standalone/README.md not found, skipping');
}

console.log('✓ Standalone package created successfully!');
console.log('  Location: standalone-compiled/');
console.log('  To use: Open standalone-compiled/index.html in your browser');
