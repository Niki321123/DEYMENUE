// Generuje wszystkie ikony aplikacji z logo Day Menu (kalendarz z listą i ptaszkiem).
// Uruchom: npx electron gen-icon.js
//
// Powstaje:
//   build/icon.ico        – ikona okna i instalatora (Windows, 7 rozmiarów w jednym pliku)
//   build/icon-256.png    – ikona okna Electrona
//   build/tray.png        – ikona w zasobniku systemowym
//   android-app/.../mipmap-*/ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
//
// Logo rysujemy kodem, a nie skalujemy z jednego pliku PNG, żeby każdy rozmiar był ostry —
// przy 16x16 (zasobnik, pasek zadań) przeskalowany bitmap rozmywa się nie do poznania.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

// Rysunek znaku w kwadracie SxS. `pad` = margines wokół znaku (0..1 szerokości),
// `tlo` = kolor tła albo null dla przezroczystego (tak potrzebuje ikona adaptacyjna Androida),
// `kolo` = przyciąć do koła (ic_launcher_round).
const DRAW = `(function(S,pad,tlo,kolo){
  const c=document.createElement("canvas");c.width=c.height=S;
  const x=c.getContext("2d");
  const GRANAT="#2b3950", BIALY="#ffffff";
  const PASKI=["#4a80d4","#4a9d52","#7069e6"];   // niebieski, zielony, fioletowy

  if(tlo){x.fillStyle=tlo;x.fillRect(0,0,S,S);}
  if(kolo){x.save();x.beginPath();x.arc(S/2,S/2,S/2,0,7);x.clip();}

  // znak w kwadracie o boku m, wyśrodkowany
  const m=S*(1-2*pad), ox=(S-m)/2, oy=(S-m)/2;
  const X=u=>ox+u*m, Y=v=>oy+v*m, R=u=>u*m;
  const rr=(x0,y0,w,h,rad)=>{
    const r=Math.min(rad,w/2,h/2);
    x.beginPath();x.moveTo(x0+r,y0);
    x.arcTo(x0+w,y0,x0+w,y0+h,r);x.arcTo(x0+w,y0+h,x0,y0+h,r);
    x.arcTo(x0,y0+h,x0,y0,r);x.arcTo(x0,y0,x0+w,y0,r);x.closePath();
  };
  const pasek=(u0,v0,u1,v1,kolor)=>{
    const w=R(u1-u0),h=R(v1-v0);
    rr(X(u0),Y(v0),w,h,Math.min(w,h)/2);x.fillStyle=kolor;x.fill();
  };

  // 1) korpus kalendarza (granatowa zaokrąglona ramka)
  rr(X(0),Y(0.117),R(1),R(0.883),R(0.135));x.fillStyle=GRANAT;x.fill();

  // 2) uchwyty u góry — najpierw biała otoczka (daje przerwę w ramce), potem granat
  const uchwyt=(uc,kolor,grubosc)=>pasek(uc-grubosc/2,0-(grubosc-0.098)/2,uc+grubosc/2,0.245+(grubosc-0.098)/2,kolor);
  uchwyt(0.266,BIALY,0.148);
  uchwyt(0.734,BIALY,0.148);
  uchwyt(0.266,GRANAT,0.098);
  uchwyt(0.734,GRANAT,0.098);

  // 3) biała karta w środku
  rr(X(0.115),Y(0.319),R(0.77),R(0.628),R(0.075));x.fillStyle=BIALY;x.fill();

  // 4) trzy kolorowe pozycje listy
  const vs=[0.479,0.638,0.787];
  vs.forEach((v,i)=>pasek(0.159,v-0.030,0.446,v+0.030,PASKI[i]));

  // 5) ptaszek
  x.strokeStyle=GRANAT;x.lineWidth=R(0.072);x.lineCap="round";x.lineJoin="round";
  x.beginPath();x.moveTo(X(0.511),Y(0.649));x.lineTo(X(0.641),Y(0.745));x.lineTo(X(0.826),Y(0.532));x.stroke();

  if(kolo)x.restore();
  return c.toDataURL("image/png");
})`;

// Logo ze znakiem i napisem — do paneli i sklepow (Stripe, Google Play, stopki stron).
// Znak rysujemy tym samym kodem co ikony, wiec nie trzymamy drugiej, rozjezdzajacej sie
// wersji logo. Wyjscie to czysty PNG kilkudziesieciu kB, a nie kilkusetkilobajtowy render.
const DRAW_LOGO = `(async function(S){
  const c=document.createElement("canvas");c.width=c.height=S;
  const x=c.getContext("2d");
  x.fillStyle="#ffffff";x.fillRect(0,0,S,S);

  const znak=Math.round(S*0.46);
  const img=new Image();
  await new Promise(gotowe=>{img.onload=gotowe;img.src=${DRAW}(znak,0,null,false)});
  x.drawImage(img,(S-znak)/2,S*0.20,znak,znak);

  // napis dwukolorowy jak w logo: "Day" granatowe, "Menu" jasniejsze
  x.font="600 "+Math.round(S*0.13)+"px system-ui,-apple-system,Segoe UI,Arial,sans-serif";
  x.textBaseline="middle";x.textAlign="left";
  const a="Day ",b="Menu";
  const wa=x.measureText(a).width,wb=x.measureText(b).width;
  const tx=(S-(wa+wb))/2;
  x.fillStyle="#2b3950";x.fillText(a,tx,S*0.82);
  x.fillStyle="#5b6b85";x.fillText(b,tx+wa,S*0.82);
  return c.toDataURL("image/png");
})`;

/* Obrazek podgladu linku (Open Graph), 1200x630 — to widac, gdy ktos wrzuci adres
   na Instagrama, Messengera czy Discorda. Bez niego platformy pokazuja goly link. */
const DRAW_OG = `(async function(W,H){
  const c=document.createElement("canvas");c.width=W;c.height=H;
  const x=c.getContext("2d");
  const GRANAT="#2b3950";
  x.fillStyle="#ffffff";x.fillRect(0,0,W,H);

  // delikatny pasek marki u gory, w kolorach listy z logo
  const paski=["#4a80d4","#4a9d52","#7069e6"];
  paski.forEach((k,i)=>{x.fillStyle=k;x.fillRect(i*(W/3),0,W/3,10)});

  const znak=Math.round(H*0.34);
  const img=new Image();
  await new Promise(g=>{img.onload=g;img.src=${DRAW}(znak,0,null,false)});
  x.drawImage(img,(W-znak)/2,H*0.16,znak,znak);

  x.textAlign="center";x.textBaseline="middle";
  x.font="700 "+Math.round(H*0.115)+"px system-ui,-apple-system,Segoe UI,Arial,sans-serif";
  x.fillStyle=GRANAT;x.fillText("Day Menu",W/2,H*0.68);

  x.font="400 "+Math.round(H*0.052)+"px system-ui,-apple-system,Segoe UI,Arial,sans-serif";
  x.fillStyle="#5b6472";x.fillText("Planowanie nauki do matury",W/2,H*0.80);

  x.font="400 "+Math.round(H*0.040)+"px system-ui,-apple-system,Segoe UI,Arial,sans-serif";
  x.fillStyle="#6b7280";x.fillText("harmonogram · pomodoro · statystyki · rywalizacja",W/2,H*0.885);
  return c.toDataURL("image/png");
})`;

const png = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL("data:text/html,<title>icon</title>");
  const rysuj = (S, pad, tlo, kolo) =>
    w.webContents.executeJavaScript(`${DRAW}(${S},${pad},${tlo ? `"${tlo}"` : "null"},${!!kolo})`).then(png);

  const root = __dirname;
  const zapisz = (p, buf) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };

  // ---- Windows: ico + okno + zasobnik ----
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = {};
  for (const s of sizes) pngs[s] = await rysuj(s, 0.06, "#ffffff", false);
  zapisz(path.join(root, "build", "icon-256.png"), pngs[256]);
  zapisz(path.join(root, "build", "tray.png"), pngs[32]);

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
  zapisz(path.join(root, "build", "icon.ico"), Buffer.concat([header, ...entries, ...datas]));

  // ---- Android ----
  // ic_launcher / ic_launcher_round: pełny kwadrat z białym tłem (starsze wersje systemu).
  // ic_launcher_foreground: przezroczyste, znak zmieszczony w strefie bezpiecznej ikony
  // adaptacyjnej (66 z 108 dp) — poza nią system przycina obraz przy animacjach.
  const res = path.join(root, "android-app", "android", "app", "src", "main", "res");
  const gestosci = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
  for (const [g, [ikona, przod]] of Object.entries(gestosci)) {
    zapisz(path.join(res, "mipmap-" + g, "ic_launcher.png"), await rysuj(ikona, 0.10, "#ffffff", false));
    zapisz(path.join(res, "mipmap-" + g, "ic_launcher_round.png"), await rysuj(ikona, 0.14, "#ffffff", true));
    zapisz(path.join(res, "mipmap-" + g, "ic_launcher_foreground.png"), await rysuj(przod, 0.26, null, false));
  }

  // ---- ikony aplikacji webowej (dodanie do ekranu glownego) ----
  // iOS akceptuje dla apple-touch-icon WYLACZNIE PNG — ikona w SVG konczy sie tym,
  // ze telefon pokazuje zrzut strony zamiast logo. Manifest Androida chce 192 i 512.
  // Wariant "maskable" ma wieksze marginesy, bo system przycina go do wlasnego ksztaltu.
  const pwa = [
    ["icon-180.png", 180, 0.06, "#ffffff"],   // apple-touch-icon
    ["icon-192.png", 192, 0.06, "#ffffff"],
    ["icon-512.png", 512, 0.06, "#ffffff"],
    ["icon-maskable-512.png", 512, 0.20, "#ffffff"],
  ];
  for (const [nazwa, rozmiar, pad, tlo] of pwa) {
    zapisz(path.join(root, "docs", nazwa), await rysuj(rozmiar, pad, tlo, false));
    console.log(`docs/${nazwa}`);
  }

  // ---- podglad linku w mediach spolecznosciowych ----
  const og = await w.webContents.executeJavaScript(`${DRAW_OG}(1200,630)`).then(png);
  zapisz(path.join(root, "docs", "podglad.png"), og);
  console.log(`docs/podglad.png — ${(og.length / 1024).toFixed(1)} kB`);

  // ---- logo z napisem (panele, sklepy) ----
  for (const S of [512, 1024]) {
    const buf = await w.webContents.executeJavaScript(`${DRAW_LOGO}(${S})`).then(png);
    zapisz(path.join(root, "build", `logo-${S}.png`), buf);
    console.log(`build/logo-${S}.png — ${(buf.length / 1024).toFixed(1)} kB`);
  }

  console.log("Ikony zapisane: build/ oraz android-app/.../mipmap-*");
  app.quit();
});
