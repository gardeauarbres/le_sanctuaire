const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const copyDirs = ["assets", "data"];
const copyFiles = [
  "index.html",
  "app.js",
  "config.js",
  "styles.css",
  "iso3d.js",
  "three3d.js",
  "print.html",
  "print.css",
  "print.js",
  "manifest.json",
  "sw.js",
  "README.md",
  "CHANGELOG.md",
  "OPTIMIZATIONS.md"
];

function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  console.log("🧹 Dossier dist/ nettoyé.");
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFile(srcPath, destPath);
    }
  });
}

function build() {
  cleanDist();

  copyFiles.forEach((file) => {
    const src = path.join(rootDir, file);
    if (fs.existsSync(src)) {
      const dest = path.join(distDir, file);
      copyFile(src, dest);
      console.log(`📄 Copié: ${file}`);
    }
  });

  copyDirs.forEach((dir) => {
    const src = path.join(rootDir, dir);
    if (fs.existsSync(src)) {
      const dest = path.join(distDir, dir);
      copyDir(src, dest);
      console.log(`📁 Copié: ${dir}/`);
    }
  });

  console.log("✅ Build statique prêt dans dist/");
}

build();

