// Generuje ikony Androida (wszystkie gęstości) z build/icon-256.png
const sharp = require("sharp");
const path = require("path");
const SRC = path.join(__dirname, "..", "build", "icon-256.png");
const RES = path.join(__dirname, "android", "app", "src", "main", "res");

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

(async () => {
  for (const [dpi, size] of Object.entries(legacy)) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    await sharp(SRC).resize(size, size).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(SRC).resize(size, size).png().toFile(path.join(dir, "ic_launcher_round.png"));
  }
  for (const [dpi, size] of Object.entries(adaptive)) {
    // logo na 62% płótna (strefa bezpieczna ikon adaptacyjnych), reszta przezroczysta
    const inner = Math.round(size * 0.62);
    const logo = await sharp(SRC).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toFile(path.join(RES, `mipmap-${dpi}`, "ic_launcher_foreground.png"));
  }
  console.log("Ikony wygenerowane");
})().catch(e => { console.error(e); process.exit(1); });
