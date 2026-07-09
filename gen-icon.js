// Generuje build/icon.ico, build/icon-256.png i build/tray.png z logo Day Menu.
// Uruchom: npx electron gen-icon.js
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const DRAW = `(function(S){
  const c=document.createElement("canvas");c.width=c.height=S;
  const x=c.getContext("2d");
  const rr=(x0,y0,w,h,rad)=>{x.beginPath();x.moveTo(x0+rad,y0);x.arcTo(x0+w,y0,x0+w,y0+h,rad);x.arcTo(x0+w,y0+h,x0,y0+h,rad);x.arcTo(x0,y0+h,x0,y0,rad);x.arcTo(x0,y0,x0+w,y0,rad);x.closePath();};
  // teczowy gradient stozkowy jak w logo
  const g=x.createConicGradient(-Math.PI*0.75,S/2,S/2);
  g.addColorStop(0.00,"#22d3ee");g.addColorStop(0.14,"#4ade80");
  g.addColorStop(0.28,"#facc15");g.addColorStop(0.42,"#fb923c");
  g.addColorStop(0.56,"#f43f5e");g.addColorStop(0.72,"#d946ef");
  g.addColorStop(0.86,"#8b5cf6");g.addColorStop(1.00,"#22d3ee");
  rr(0,0,S,S,S*0.24);x.fillStyle=g;x.fill();
  // delikatne rozjasnienie srodka
  const rg=x.createRadialGradient(S/2,S*0.42,S*0.05,S/2,S*0.42,S*0.75);
  rg.addColorStop(0,"rgba(255,255,255,0.25)");rg.addColorStop(1,"rgba(255,255,255,0)");
  rr(0,0,S,S,S*0.24);x.fillStyle=rg;x.fill();
  // slonce wystajace zza kalendarza
  x.fillStyle="#fb923c";x.beginPath();x.arc(S/2,S*0.42,S*0.155,0,7);x.fill();
  // bialy kalendarz
  const cw=S*0.54,ch=S*0.40,cx0=(S-cw)/2,cy0=S*0.42;
  x.shadowColor="rgba(0,0,0,0.28)";x.shadowBlur=S*0.05;x.shadowOffsetY=S*0.015;
  rr(cx0,cy0,cw,ch,S*0.075);x.fillStyle="#ffffff";x.fill();
  x.shadowBlur=0;x.shadowOffsetY=0;
  // czerwone kropki (siatka dni)
  x.fillStyle="#ef4444";
  const cols=4,rows=2,dx=cw/(cols+1),dy=ch/(rows+1),dr=Math.max(1,S*0.032);
  for(let i=1;i<=cols;i++)for(let j=1;j<=rows;j++){x.beginPath();x.arc(cx0+dx*i,cy0+dy*j,dr,0,7);x.fill();}
  return c.toDataURL("image/png");
})`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL("data:text/html,<title>icon</title>");
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = {};
  for (const s of sizes) {
    const dataUrl = await w.webContents.executeJavaScript(`${DRAW}(${s})`);
    pngs[s] = Buffer.from(dataUrl.split(",")[1], "base64");
  }
  fs.mkdirSync(path.join(__dirname, "build"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "build", "icon-256.png"), pngs[256]);
  fs.writeFileSync(path.join(__dirname, "build", "tray.png"), pngs[32]);
  // ICO z wpisami PNG
  let offset = 6 + 16 * sizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  const entries = [], datas = [];
  for (const s of sizes) {
    const d = pngs[s], e = Buffer.alloc(16);
    e.writeUInt8(s === 256 ? 0 : s, 0);
    e.writeUInt8(s === 256 ? 0 : s, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(d.length, 8); e.writeUInt32LE(offset, 12);
    offset += d.length; entries.push(e); datas.push(d);
  }
  fs.writeFileSync(path.join(__dirname, "build", "icon.ico"), Buffer.concat([header, ...entries, ...datas]));
  console.log("Ikony zapisane w build/");
  app.quit();
});
