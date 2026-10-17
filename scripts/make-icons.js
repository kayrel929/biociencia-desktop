// Convierte build/icon.svg en build/icon.png (1024x1024).
// electron-builder genera a partir de ese PNG los iconos .ico (Windows) e .icns (macOS).
// Uso:  npm run icons
const path = require("path");
const sharp = require("sharp");

const svg = path.join(__dirname, "..", "build", "icon.svg");
const out = path.join(__dirname, "..", "build", "icon.png");

sharp(svg)
  .resize(1024, 1024)
  .png()
  .toFile(out)
  .then(() => console.log("Icono creado:", out))
  .catch((e) => { console.error("Error creando el icono:", e.message); process.exit(1); });
