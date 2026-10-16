/*
 * Guardianes de Usme · Prototipo 3 «Mapa desde arriba» · dibujos
 *
 * Todo lo que se ve se dibuja aquí con Canvas 2D (no hay imágenes):
 * personajes, avatar, árboles, casa, frailejones, semillas, letreros y el suelo
 * del mapa. Cada función recibe un contexto ya escalado y dibuja en «unidades
 * de mundo»; mundo.js convierte cada lienzo en textura de Phaser.
 *
 * Estilo: mapa ilustrado amable, vista desde arriba en tres cuartos
 * (se ve el techo y el frente de las cosas), colores andinos cálidos y
 * un contorno café suave alrededor de cada figura. En alto contraste el
 * contorno es negro y grueso.
 */
(function () {
  const TAU = Math.PI * 2;

  /* ---------- utilidades ---------- */

  function lienzo(w, h, R) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * R));
    c.height = Math.max(1, Math.ceil(h * R));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.scale(R, R);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return { c, ctx };
  }

  // Contorno alrededor de la silueta de un lienzo (grosor en píxeles reales).
  function contorno(src, grosor, color) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    const pasos = grosor > 4 ? 12 : 8;
    for (let i = 0; i < pasos; i++) {
      const a = (i / pasos) * TAU;
      x.drawImage(src, Math.cos(a) * grosor, Math.sin(a) * grosor);
    }
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over';
    x.drawImage(src, 0, 0);
    return c;
  }

  function hexARgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mezclar(a, b, t) {
    const A = hexARgb(a), B = hexARgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const oscuro = (c, t) => mezclar(c, '#1a120c', t);
  const claro = (c, t) => mezclar(c, '#ffffff', t);
  function rgba(hex, a) { const [r, g, b] = hexARgb(hex); return `rgba(${r},${g},${b},${a})`; }

  function elipse(ctx, x, y, rx, ry, color, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
  }
  const circulo = (ctx, x, y, r, color) => elipse(ctx, x, y, r, r, color);
  function rect(ctx, x, y, w, h, r, color) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
  }
  function linea(ctx, pts, ancho, color) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = ancho; ctx.strokeStyle = color; ctx.stroke();
  }
  function poligono(ctx, pts, color) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (color) { ctx.fillStyle = color; ctx.fill(); }
  }
  function radial(ctx, x, y, r, c1, c2, x2 = x, y2 = y) {
    const g = ctx.createRadialGradient(x2, y2, 0, x, y, r);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  }
  function sombraSuelo(ctx, x, y, rx, ry, a = 0.22) {
    ctx.save();
    ctx.fillStyle = radial(ctx, x, y, rx, `rgba(30,20,10,${a})`, 'rgba(30,20,10,0)');
    ctx.translate(x, y); ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Colores de piel y cabello: cambian mientras se dibuja el avatar con la apariencia elegida.
  const PIEL0 = '#b27a52', PIEL_OSC0 = '#94603c', PELO0 = '#2a1c15', OJO = '#2a1c15';
  let PIEL = PIEL0, PIEL_OSC = PIEL_OSC0, PELO = PELO0;

  /* ---------- cabezas y ruanas (avatar y personas) ---------- */

  function ojos(ctx, x1, x2, y, feliz) {
    if (feliz) {
      [x1, x2].forEach(x => { ctx.beginPath(); ctx.arc(x, y + 1, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 1.6; ctx.strokeStyle = OJO; ctx.stroke(); });
      return;
    }
    [x1, x2].forEach(x => { elipse(ctx, x, y, 2, 2.5, OJO); circulo(ctx, x + 0.7, y - 0.9, 0.8, '#fff'); });
  }
  function mejillas(ctx, x1, x2, y) {
    [x1, x2].forEach(x => circulo(ctx, x, y, 2.6, 'rgba(232,120,100,.45)'));
  }
  function sonrisa(ctx, x, y, r = 3) {
    ctx.beginPath(); ctx.arc(x, y, r, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#6a2c1c'; ctx.stroke();
  }

  // Ruana de frente o de espaldas: poncho con franjas y flecos.
  function ruana(ctx, cx, top, ancho, alto, color, espalda) {
    const bot = top + alto;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 8, top);
    ctx.quadraticCurveTo(cx - ancho * 0.9, top + 2, cx - ancho, top + alto * 0.42);
    ctx.lineTo(cx - ancho * 0.94, bot - 2);
    ctx.quadraticCurveTo(cx, bot + 5, cx + ancho * 0.94, bot - 2);
    ctx.lineTo(cx + ancho, top + alto * 0.42);
    ctx.quadraticCurveTo(cx + ancho * 0.9, top + 2, cx + 8, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, claro(color, 0.12)); g.addColorStop(1, oscuro(color, 0.18));
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    // franjas tejidas
    const f1 = bot - alto * 0.3;
    ctx.fillStyle = '#f3d98a'; ctx.fillRect(cx - ancho, f1, ancho * 2, alto * 0.08);
    ctx.fillStyle = oscuro(color, 0.45); ctx.fillRect(cx - ancho, f1 + alto * 0.12, ancho * 2, alto * 0.06);
    ctx.fillStyle = '#f3d98a';
    for (let x = cx - ancho; x < cx + ancho; x += 6) { ctx.beginPath(); ctx.moveTo(x, f1 + alto * 0.08); ctx.lineTo(x + 3, f1 + alto * 0.115); ctx.lineTo(x + 6, f1 + alto * 0.08); ctx.fill(); }
    // pliegues
    ctx.strokeStyle = rgba('#000000', 0.12); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - ancho * 0.45, top + 8); ctx.lineTo(cx - ancho * 0.5, bot); ctx.moveTo(cx + ancho * 0.45, top + 8); ctx.lineTo(cx + ancho * 0.5, bot); ctx.stroke();
    ctx.restore();
    // flecos
    ctx.strokeStyle = oscuro(color, 0.3); ctx.lineWidth = 1.2;
    for (let x = cx - ancho * 0.9; x <= cx + ancho * 0.9; x += 3) {
      const t = (x - cx) / ancho;
      const y = bot - 2 + 7 * (1 - t * t) * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 3.5); ctx.stroke();
    }
    if (!espalda) poligono(ctx, [[cx - 6, top], [cx + 6, top], [cx, top + 7]], oscuro(color, 0.4));
  }

  function ruanaLado(ctx, cx, top, alto, color) {
    const bot = top + alto;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 5, top);
    ctx.quadraticCurveTo(cx - 14, top + 3, cx - 15, top + alto * 0.45);
    ctx.lineTo(cx - 14, bot);
    ctx.quadraticCurveTo(cx + 1, bot + 4, cx + 16, bot - 1);
    ctx.lineTo(cx + 13, top + alto * 0.45);
    ctx.quadraticCurveTo(cx + 11, top + 3, cx + 5, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - 15, 0, cx + 15, 0);
    g.addColorStop(0, oscuro(color, 0.15)); g.addColorStop(1, claro(color, 0.1));
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    const f1 = bot - alto * 0.3;
    ctx.fillStyle = '#f3d98a'; ctx.fillRect(cx - 20, f1, 40, alto * 0.08);
    ctx.fillStyle = oscuro(color, 0.45); ctx.fillRect(cx - 20, f1 + alto * 0.12, 40, alto * 0.06);
    ctx.restore();
    ctx.strokeStyle = oscuro(color, 0.3); ctx.lineWidth = 1.2;
    for (let x = cx - 13; x <= cx + 15; x += 3) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, bot + 3.5); ctx.stroke(); }
  }

  // Cabeza de frente ('d'), de espaldas ('u') o de lado ('s').
  // peinado: 'trenzas' | 'corto' | 'medio' | 'largo' | 'crespo' | 'mono'
  function bucles(ctx, cx, cy, desde, hasta, n, r, d) {
    for (let k = 0; k <= n; k++) {
      const a = desde + (hasta - desde) * (k / n);
      circulo(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.95, r, k % 2 ? claro(PELO, 0.1) : PELO);
    }
  }
  function cabeza(ctx, cx, cy, dir, peinado, adorno) {
    if (dir === 'u') {
      if (peinado === 'crespo') bucles(ctx, cx, cy - 1, 0, TAU, 12, 7.5, 15);
      circulo(ctx, cx, cy, 14, PIEL);
      elipse(ctx, cx, cy - 1, 14.6, 14, PELO);
      if (peinado === 'medio') elipse(ctx, cx, cy + 6, 15, 9, PELO);
      if (peinado === 'largo') rect(ctx, cx - 15, cy, 30, 30, 10, PELO);
      if (peinado === 'trenzas') { trenza(ctx, cx - 6, cy + 9, cx - 8, cy + 30, adorno); trenza(ctx, cx + 6, cy + 9, cx + 8, cy + 30, adorno); }
      if (peinado === 'mono') { circulo(ctx, cx, cy - 13, 7, PELO); ctx.beginPath(); ctx.arc(cx, cy - 8, 4, Math.PI, TAU); ctx.lineWidth = 2.4; ctx.strokeStyle = adorno; ctx.stroke(); }
      if (peinado === 'medio') { ctx.beginPath(); ctx.arc(cx, cy - 1, 14.4, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 3; ctx.strokeStyle = adorno; ctx.stroke(); }
      elipse(ctx, cx - 4, cy - 7, 5, 3, 'rgba(255,255,255,.12)', -0.5);
      return;
    }
    if (dir === 's') {
      if (peinado === 'trenzas') trenza(ctx, cx - 9, cy + 6, cx - 12, cy + 26, adorno);
      if (peinado === 'medio') elipse(ctx, cx - 5, cy + 4, 11, 12, PELO);
      if (peinado === 'largo') { elipse(ctx, cx - 5, cy + 4, 12, 13, PELO); rect(ctx, cx - 16, cy + 2, 16, 26, 8, PELO); }
      if (peinado === 'crespo') bucles(ctx, cx - 2, cy - 1, Math.PI * 0.55, Math.PI * 1.75, 8, 7.5, 15);
      if (peinado === 'mono') circulo(ctx, cx - 10, cy - 10, 6.5, PELO);
      circulo(ctx, cx, cy, 14, PIEL);
      circulo(ctx, cx + 13.5, cy + 2, 2.6, PIEL); // nariz
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 14.6, 0, TAU); ctx.clip();
      ctx.beginPath(); ctx.moveTo(cx + 15, cy - 6); ctx.quadraticCurveTo(cx + 4, cy - 18, cx - 16, cy - 10); ctx.lineTo(cx - 16, cy + 16); ctx.lineTo(cx - 5, cy + 14);
      ctx.quadraticCurveTo(cx - 1, cy - 2, cx + 15, cy - 6); ctx.fillStyle = PELO; ctx.fill();
      ctx.restore();
      if (peinado === 'medio') { ctx.beginPath(); ctx.arc(cx, cy, 14.4, Math.PI * 1.2, Math.PI * 1.85); ctx.lineWidth = 3; ctx.strokeStyle = adorno; ctx.stroke(); }
      if (peinado === 'mono') circulo(ctx, cx - 8, cy - 9, 2.2, adorno);
      elipse(ctx, cx + 7, cy + 1, 1.9, 2.4, OJO); circulo(ctx, cx + 7.6, cy, 0.7, '#fff');
      circulo(ctx, cx + 5, cy + 6, 2.4, 'rgba(232,120,100,.45)');
      ctx.beginPath(); ctx.moveTo(cx + 8, cy + 8.5); ctx.quadraticCurveTo(cx + 10.5, cy + 9.5, cx + 12, cy + 8); ctx.lineWidth = 1.3; ctx.strokeStyle = '#6a2c1c'; ctx.stroke();
      circulo(ctx, cx - 3, cy + 2, 3, PIEL_OSC); // oreja
      return;
    }
    // de frente
    if (peinado === 'trenzas') { elipse(ctx, cx, cy + 1, 16, 15, PELO); trenza(ctx, cx - 13, cy + 6, cx - 16, cy + 27, adorno); trenza(ctx, cx + 13, cy + 6, cx + 16, cy + 27, adorno); }
    if (peinado === 'medio') elipse(ctx, cx, cy + 4, 16.5, 14, PELO);
    if (peinado === 'largo') { elipse(ctx, cx, cy + 3, 17, 15, PELO); rect(ctx, cx - 18, cy + 2, 36, 26, 10, PELO); }
    if (peinado === 'crespo') bucles(ctx, cx, cy - 1, Math.PI * 0.8, Math.PI * 2.2, 10, 7.5, 15.5);
    if (peinado === 'mono') circulo(ctx, cx, cy - 15, 7, PELO);
    circulo(ctx, cx - 14, cy + 2, 3, PIEL_OSC); circulo(ctx, cx + 14, cy + 2, 3, PIEL_OSC);
    circulo(ctx, cx, cy, 14, PIEL);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 14.6, 0, TAU); ctx.clip();
    ctx.beginPath();
    if (peinado === 'corto') { ctx.moveTo(cx - 16, cy + 1); ctx.quadraticCurveTo(cx - 14, cy - 18, cx, cy - 16); ctx.quadraticCurveTo(cx + 14, cy - 18, cx + 16, cy + 1); ctx.quadraticCurveTo(cx + 9, cy - 9, cx + 2, cy - 6); ctx.quadraticCurveTo(cx - 6, cy - 10, cx - 16, cy + 1); }
    else { ctx.moveTo(cx - 16, cy + 4); ctx.quadraticCurveTo(cx - 15, cy - 18, cx, cy - 16); ctx.quadraticCurveTo(cx + 15, cy - 18, cx + 16, cy + 4); ctx.quadraticCurveTo(cx + 10, cy - 7, cx, cy - 6); ctx.quadraticCurveTo(cx - 10, cy - 7, cx - 16, cy + 4); }
    ctx.fillStyle = PELO; ctx.fill();
    ctx.restore();
    if (peinado === 'medio') { ctx.beginPath(); ctx.arc(cx, cy, 14.6, Math.PI * 1.15, Math.PI * 1.85); ctx.lineWidth = 3; ctx.strokeStyle = adorno; ctx.stroke(); }
    if (peinado === 'trenzas') { circulo(ctx, cx - 11, cy - 9, 2.6, adorno); }
    if (peinado === 'mono') { ctx.beginPath(); ctx.arc(cx, cy - 10, 4.5, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 2.4; ctx.strokeStyle = adorno; ctx.stroke(); }
    ojos(ctx, cx - 5, cx + 5, cy + 1);
    mejillas(ctx, cx - 8.5, cx + 8.5, cy + 6);
    sonrisa(ctx, cx, cy + 5, 3);
  }
  function trenza(ctx, x1, y1, x2, y2, cinta) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      elipse(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 3.6 - t, 3.4, i % 2 ? claro(PELO, 0.12) : PELO);
    }
    elipse(ctx, x2, y2 + 3, 2.6, 2, cinta);
  }

  /* ---------- avatar ---------- */
  // Caja 72×92; los pies tocan y = 88. dir: 'd' (de frente), 'u' (de espaldas), 's' (de lado, mirando a la derecha).
  // f: 0 quieto, 1 y 2 pasos. La apariencia (piel, cabello, pantalón, zapatos…) llega en `ap`.

  const APARIENCIA_BASE = { genero: 'nina', silla: false, piel: '#b27a52', peinado: 'trenzas', pelo: '#2a1c15', ruana: '#c0392b', pantalon: '#3e3a63', zapatos: '#4a2e1f' };
  let AP = { ...APARIENCIA_BASE };

  function avatarPersona(ctx, genero, dir, f, color) {
    const cx = 36;
    const pantalon = AP.pantalon, zapato = AP.zapatos, peinado = AP.peinado;
    const cinta = '#e8577f';
    const falda = genero === 'nina' ? mezclar(color, '#7b3f8f', 0.65) : null;
    if (dir === 's') {
      const ang = f === 0 ? 0.08 : (f === 1 ? 0.42 : -0.42);
      [[-ang, oscuro(pantalon, 0.25)], [ang, pantalon]].forEach(([a, c]) => {
        ctx.save(); ctx.translate(cx, 62); ctx.rotate(-a);
        rect(ctx, -4, 0, 8, 21, 3, c);
        elipse(ctx, 2.5, 22, 6, 3.4, zapato);
        ctx.restore();
      });
      if (falda) elipse(ctx, cx, 64, 12, 5, falda);
      ruanaLado(ctx, cx, 34, 30, color);
      circulo(ctx, cx + 11, 62, 3.4, PIEL);
      cabeza(ctx, cx + 1, 21, 's', peinado, cinta);
      return;
    }
    const sube1 = f === 1 ? 3 : 0, sube2 = f === 2 ? 3 : 0;
    rect(ctx, cx - 10, 60 - sube1, 8, 21, 3, pantalon);
    rect(ctx, cx + 2, 60 - sube2, 8, 21, 3, pantalon);
    elipse(ctx, cx - 6, 81 - sube1, 5.5, 3.5, zapato);
    elipse(ctx, cx + 6, 81 - sube2, 5.5, 3.5, zapato);
    if (falda) { ctx.beginPath(); ctx.moveTo(cx - 14, 60); ctx.lineTo(cx - 16, 69); ctx.quadraticCurveTo(cx, 72, cx + 16, 69); ctx.lineTo(cx + 14, 60); ctx.closePath(); ctx.fillStyle = falda; ctx.fill(); }
    if (dir === 'u') {
      ruana(ctx, cx, 33, 24, 33, color, true);
      cabeza(ctx, cx, 21, 'u', peinado, cinta);
      circulo(ctx, cx - 22, 64, 3.4, PIEL); circulo(ctx, cx + 22, 64, 3.4, PIEL);
      return;
    }
    ruana(ctx, cx, 33, 24, 33, color, false);
    circulo(ctx, cx - 22, 64, 3.4, PIEL); circulo(ctx, cx + 22, 64, 3.4, PIEL);
    cabeza(ctx, cx, 21, 'd', peinado, cinta);
  }

  function rueda(ctx, x, y, w, h, f) {
    rect(ctx, x, y, w, h, w / 2, '#33363d');
    rect(ctx, x + 2.2, y + 3, w - 4.4, h - 6, (w - 4.4) / 2, '#8d949c');
    rect(ctx, x + 3.6, y + 5, w - 7.2, h - 10, (w - 7.2) / 2, '#4a4f57');
    ctx.strokeStyle = '#1d1f23'; ctx.lineWidth = 1.2;
    for (let yy = y + 3 + ((f * 3) % 6); yy < y + h - 2; yy += 6) { ctx.beginPath(); ctx.moveTo(x + 0.6, yy); ctx.lineTo(x + 2, yy); ctx.moveTo(x + w - 2, yy); ctx.lineTo(x + w - 0.6, yy); ctx.stroke(); }
  }

  function avatarSilla(ctx, dir, f, color) {
    const cx = 36;
    const tela = '#2a4c7a', metal = '#b3bac2', pantalon = AP.pantalon, zapato = AP.zapatos;
    const cinta = '#f2b134', peinado = AP.peinado;
    if (dir === 's') {
      // respaldo y manija
      rect(ctx, cx - 17, 36, 6, 30, 2, tela);
      linea(ctx, [[cx - 14, 38], [cx - 20, 33]], 3, metal);
      linea(ctx, [[cx - 20, 33], [cx - 25, 33]], 3.4, '#222');
      ruanaLado(ctx, cx - 1, 34, 27, color);
      // muslo, pierna y pie
      rect(ctx, cx - 2, 57, 22, 9, 4, pantalon);
      rect(ctx, cx + 13, 60, 8, 20, 3, pantalon);
      elipse(ctx, cx + 21, 81, 6, 3.4, zapato);
      linea(ctx, [[cx + 10, 84], [cx + 26, 84]], 3, '#555b63');
      linea(ctx, [[cx + 10, 68], [cx + 16, 84]], 2, metal);
      cabeza(ctx, cx, 23, 's', peinado, cinta);
      // rueda grande con rayos que giran
      const rx = cx - 3, ry = 68;
      circulo(ctx, rx, ry, 19.5, '#33363d');
      circulo(ctx, rx, ry, 15.5, '#5d636b');
      ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 1.3;
      for (let k = 0; k < 8; k++) {
        const a = k * TAU / 8 + f * 0.4;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(a) * 15, ry + Math.sin(a) * 15); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(rx, ry, 12, 0, TAU); ctx.lineWidth = 1.8; ctx.strokeStyle = '#d9dde2'; ctx.stroke();
      circulo(ctx, rx, ry, 3.2, '#d9dde2');
      circulo(ctx, rx + 9, ry - 9, 3.6, PIEL); // mano en el aro
      circulo(ctx, cx + 22, 86, 3.6, '#33363d'); circulo(ctx, cx + 22, 86, 1.4, '#999');
      return;
    }
    // ruedas grandes a los lados (se ven casi de canto desde arriba)
    rueda(ctx, 3, 46, 12, 40, f);
    rueda(ctx, 57, 46, 12, 40, f);
    if (dir === 'u') {
      ruana(ctx, cx, 35, 22, 28, color, true);
      rect(ctx, cx - 16, 40, 32, 28, 5, tela);
      ctx.strokeStyle = rgba('#ffffff', 0.15); ctx.lineWidth = 2;
      for (let y = 46; y < 66; y += 6) { ctx.beginPath(); ctx.moveTo(cx - 14, y); ctx.lineTo(cx + 14, y); ctx.stroke(); }
      linea(ctx, [[cx - 15, 42], [cx - 17, 33]], 3, metal); linea(ctx, [[cx + 15, 42], [cx + 17, 33]], 3, metal);
      elipse(ctx, cx - 17.5, 31, 2.6, 4, '#222'); elipse(ctx, cx + 17.5, 31, 2.6, 4, '#222');
      linea(ctx, [[15, 66], [cx - 16, 62]], 2.4, metal); linea(ctx, [[57, 66], [cx + 16, 62]], 2.4, metal);
      cabeza(ctx, cx, 24, 'u', peinado, cinta);
      return;
    }
    // de frente
    linea(ctx, [[15, 64], [cx - 16, 62]], 2.4, metal); linea(ctx, [[57, 64], [cx + 16, 62]], 2.4, metal);
    rect(ctx, cx - 17, 58, 34, 10, 3, tela);
    rect(ctx, cx - 12, 62, 10, 12, 3, oscuro(pantalon, 0.1));
    rect(ctx, cx + 2, 62, 10, 12, 3, oscuro(pantalon, 0.1));
    rect(ctx, cx - 12, 70, 10, 11, 3, pantalon);
    rect(ctx, cx + 2, 70, 10, 11, 3, pantalon);
    linea(ctx, [[cx - 15, 70], [cx - 13, 84]], 2, metal); linea(ctx, [[cx + 15, 70], [cx + 13, 84]], 2, metal);
    rect(ctx, cx - 16, 81, 32, 5, 2, '#555b63');
    elipse(ctx, cx - 7, 81, 5.5, 3.4, zapato); elipse(ctx, cx + 7, 81, 5.5, 3.4, zapato);
    elipse(ctx, cx - 14, 88, 3, 2.4, '#33363d'); elipse(ctx, cx + 14, 88, 3, 2.4, '#33363d');
    ruana(ctx, cx, 36, 22, 27, color, false);
    circulo(ctx, 13, 60, 3.6, PIEL); circulo(ctx, 59, 60, 3.6, PIEL);
    cabeza(ctx, cx, 24, 'd', peinado, cinta);
  }

  // tipo: 'nina' | 'nino' | 'silla'. ap (opcional): apariencia elegida en el editor de avatar.
  function avatar(ctx, tipo, dir, f, color, ap) {
    const base = tipo === 'silla' ? { ...APARIENCIA_BASE, genero: 'nino', peinado: 'medio', pantalon: '#4a4f7a' }
      : tipo === 'nino' ? { ...APARIENCIA_BASE, genero: 'nino', peinado: 'corto', pantalon: '#3f5878' } : APARIENCIA_BASE;
    AP = { ...base, ...(ap || {}) };
    PIEL = AP.piel; PIEL_OSC = oscuro(AP.piel, 0.18); PELO = AP.pelo;
    try {
      if (tipo === 'silla') avatarSilla(ctx, dir, f, color);
      else avatarPersona(ctx, AP.genero, dir, f, color);
    } finally {
      AP = { ...APARIENCIA_BASE }; PIEL = PIEL0; PIEL_OSC = PIEL_OSC0; PELO = PELO0;
    }
  }

  /* ---------- personajes de las estaciones ---------- */

  function rosa(ctx) {
    const cx = 40;
    // falda y alpargatas
    ctx.beginPath(); ctx.moveTo(cx - 16, 66); ctx.lineTo(cx - 20, 92); ctx.quadraticCurveTo(cx, 95, cx + 20, 92); ctx.lineTo(cx + 16, 66); ctx.closePath();
    ctx.fillStyle = '#3b3557'; ctx.fill();
    linea(ctx, [[cx - 19, 88], [cx + 19, 88]], 2.4, '#6a5f9a');
    elipse(ctx, cx - 8, 94, 6, 3.2, '#efe3c6'); elipse(ctx, cx + 8, 94, 6, 3.2, '#efe3c6');
    ruana(ctx, cx, 42, 29, 34, '#c0562f', false);
    circulo(ctx, cx - 26, 75, 4, PIEL); circulo(ctx, cx + 26, 75, 4, PIEL);
    // cabeza con trenzas canosas y sombrero
    const cy = 29;
    trenza(ctx, cx - 12, cy + 8, cx - 15, cy + 30, '#c0562f');
    trenza(ctx, cx + 12, cy + 8, cx + 15, cy + 30, '#c0562f');
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
    circulo(ctx, cx, cy, 15, '#a56d48');
    elipse(ctx, cx, cy - 6, 15, 8, '#cfc8bf');
    ojos(ctx, cx - 5.5, cx + 5.5, cy + 2, true);
    mejillas(ctx, cx - 9, cx + 9, cy + 7);
    sonrisa(ctx, cx, cy + 6, 3.4);
    ctx.strokeStyle = 'rgba(90,50,30,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx - 9, cy + 3, 3, 0.4, 1.4); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 9, cy + 3, 3, 1.7, 2.7); ctx.stroke();
    elipse(ctx, cx, cy - 10, 27, 7.5, '#2f2520');
    rect(ctx, cx - 12, cy - 25, 24, 16, 7, '#3a2e28');
    rect(ctx, cx - 12, cy - 14, 24, 4, 1, '#c0562f');
    elipse(ctx, cx - 6, cy - 21, 4, 2, 'rgba(255,255,255,.15)');
  }

  function julian(ctx) {
    const cx = 40;
    rect(ctx, cx - 11, 68, 9, 22, 3, '#857550'); rect(ctx, cx + 2, 68, 9, 22, 3, '#857550');
    elipse(ctx, cx - 7, 91, 6.5, 3.8, '#5a3a22'); elipse(ctx, cx + 7, 91, 6.5, 3.8, '#5a3a22');
    rect(ctx, cx - 16, 40, 32, 32, 9, '#4b78a8');
    // chaleco con bolsillos
    ctx.beginPath(); ctx.moveTo(cx - 16, 44); ctx.lineTo(cx - 4, 42); ctx.lineTo(cx - 3, 72); ctx.lineTo(cx - 16, 72); ctx.closePath(); ctx.fillStyle = '#c9a86a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 16, 44); ctx.lineTo(cx + 4, 42); ctx.lineTo(cx + 3, 72); ctx.lineTo(cx + 16, 72); ctx.closePath(); ctx.fill();
    rect(ctx, cx - 14, 56, 8, 7, 1.5, '#b08e52'); rect(ctx, cx + 6, 56, 8, 7, 1.5, '#b08e52');
    rect(ctx, cx - 14, 47, 7, 5, 1.5, '#b08e52');
    // brazos: uno con la brocha
    rect(ctx, cx - 22, 44, 8, 24, 4, '#4b78a8'); circulo(ctx, cx - 18, 70, 4, '#9c6a46');
    ctx.save(); ctx.translate(cx + 18, 46); ctx.rotate(-0.5); rect(ctx, -4, 0, 8, 22, 4, '#4b78a8'); ctx.restore();
    circulo(ctx, cx + 28, 64, 4, '#9c6a46');
    linea(ctx, [[cx + 28, 64], [cx + 36, 52]], 3, '#8a5a32');
    ctx.save(); ctx.translate(cx + 37, 50); ctx.rotate(-0.95); rect(ctx, -4, -5, 8, 8, 2, '#e9d6a0'); ctx.restore();
    // cabeza con sombrero de explorador
    const cy = 28;
    circulo(ctx, cx - 14, cy + 2, 3, '#86583a'); circulo(ctx, cx + 14, cy + 2, 3, '#86583a');
    circulo(ctx, cx, cy, 14, '#9c6a46');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 14.5, 0, TAU); ctx.clip();
    elipse(ctx, cx, cy + 12, 12, 7, 'rgba(40,25,18,.45)');
    ctx.restore();
    ojos(ctx, cx - 5, cx + 5, cy + 1);
    sonrisa(ctx, cx, cy + 5, 3);
    elipse(ctx, cx, cy - 9, 24, 6.5, '#7d5f3a');
    rect(ctx, cx - 12, cy - 23, 24, 15, 6, '#9c7a4c');
    rect(ctx, cx - 12, cy - 13, 24, 3.5, 1, '#5a3f22');
  }

  function tita(ctx, f) {
    const cx = 44;
    // patas largas
    ctx.strokeStyle = '#cf6a4c'; ctx.lineWidth = 2.2;
    [[cx - 4, 52, cx - 8, 76], [cx + 4, 52, cx + 7, 76]].forEach(([a, b, c, d]) => {
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo((a + c) / 2 + 1, (b + d) / 2); ctx.lineTo(c, d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c - 5, d); ctx.lineTo(c + 6, d); ctx.moveTo(c, d); ctx.lineTo(c + 3, d - 3); ctx.lineWidth = 1.6; ctx.stroke(); ctx.lineWidth = 2.2;
    });
    // cola
    poligono(ctx, [[cx - 20, 40], [cx - 32, 30], [cx - 28, 44]], '#5e4630');
    poligono(ctx, [[cx - 22, 44], [cx - 30, 42], [cx - 24, 49]], '#f2efe6');
    // cuerpo: lomo café rayado, pecho gris azulado
    ctx.save();
    elipse(ctx, cx - 2, 42, 22, 14, null, -0.12); ctx.clip();
    ctx.fillStyle = '#6d7f95'; ctx.fillRect(cx - 30, 20, 60, 40);
    elipse(ctx, cx - 6, 34, 24, 11, '#7a5a3a', -0.12);
    ctx.strokeStyle = '#3e2c1c'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - 20 + i * 6, 28 + (i % 2)); ctx.lineTo(cx - 16 + i * 6, 38); ctx.stroke(); }
    ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 18 + i * 5, 50); ctx.lineTo(cx - 14 + i * 5, 54); ctx.stroke(); }
    ctx.restore();
    // cuello y cabeza
    if (f === 1) {
      elipse(ctx, cx + 14, 44, 7, 9, '#6d7f95', 0.6);
      circulo(ctx, cx + 20, 50, 8, '#6d7f95');
      elipse(ctx, cx + 18, 45, 7, 4, '#6a4a2e', 0.4);
      circulo(ctx, cx + 23, 49, 2, '#b8322a'); circulo(ctx, cx + 23.4, 48.6, 0.7, '#fff');
      linea(ctx, [[cx + 25, 54], [cx + 31, 63], [cx + 33, 70]], 3, '#d0462e');
    } else {
      elipse(ctx, cx + 12, 33, 6, 10, '#6d7f95', 0.4);
      circulo(ctx, cx + 16, 25, 8.5, '#6d7f95');
      elipse(ctx, cx + 14, 20, 8, 4.5, '#6a4a2e', -0.2);
      circulo(ctx, cx + 19, 24, 2.1, '#b8322a'); circulo(ctx, cx + 19.6, 23.4, 0.7, '#fff');
      linea(ctx, [[cx + 23, 26], [cx + 34, 28], [cx + 43, 32]], 3, '#d0462e');
    }
  }

  function rita(ctx) {
    const cx = 34;
    // patas traseras dobladas
    [-1, 1].forEach(s => {
      elipse(ctx, cx + s * 17, 40, 10, 7.5, '#3f8a32', s * 0.3);
      elipse(ctx, cx + s * 22, 47, 7, 3, '#57a83f', s * 0.2);
      [0, 1, 2].forEach(k => circulo(ctx, cx + s * (16 + k * 5), 49 + k * 0.5, 1.8, '#8fd06a'));
    });
    // cuerpo
    elipse(ctx, cx, 32, 19, 16, null);
    ctx.fillStyle = radial(ctx, cx, 32, 22, '#86d462', '#3f8a32', cx - 6, 24); ctx.fill();
    elipse(ctx, cx, 41, 12, 6, '#dcea9e');
    // franja oscura en los costados
    ctx.strokeStyle = 'rgba(70,50,20,.5)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx - 18, 26); ctx.quadraticCurveTo(cx - 10, 30, cx - 15, 40); ctx.moveTo(cx + 18, 26); ctx.quadraticCurveTo(cx + 10, 30, cx + 15, 40); ctx.stroke();
    // labio blanco y boca
    ctx.beginPath(); ctx.moveTo(cx - 15, 29); ctx.quadraticCurveTo(cx, 36, cx + 15, 29); ctx.lineWidth = 2.2; ctx.strokeStyle = '#f4f2d6'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 9, 31.5); ctx.quadraticCurveTo(cx, 35.5, cx + 9, 31.5); ctx.lineWidth = 1.2; ctx.strokeStyle = '#2e5a22'; ctx.stroke();
    // patas delanteras
    elipse(ctx, cx - 9, 46, 3.4, 4, '#4f9a3a'); elipse(ctx, cx + 9, 46, 3.4, 4, '#4f9a3a');
    // ojos saltones
    [-1, 1].forEach(s => {
      circulo(ctx, cx + s * 9, 20, 6.5, '#5cae44');
      circulo(ctx, cx + s * 9, 19.5, 4.6, '#e8c33a');
      elipse(ctx, cx + s * 9, 19.5, 3.4, 1.6, '#1a1a1a');
      circulo(ctx, cx + s * 9 - 1.5, 18, 1, '#fff');
    });
    circulo(ctx, cx - 6, 30, 3, 'rgba(240,140,120,.35)'); circulo(ctx, cx + 6, 30, 3, 'rgba(240,140,120,.35)');
  }

  function cuqui(ctx) {
    const cx = 34;
    elipse(ctx, cx - 10, 47, 4, 2.6, '#e9a6a0'); elipse(ctx, cx + 10, 47, 4, 2.6, '#e9a6a0');
    elipse(ctx, cx, 31, 25, 17, null);
    ctx.fillStyle = radial(ctx, cx, 31, 27, '#c48d4a', '#8a5a26', cx - 8, 22); ctx.fill();
    elipse(ctx, cx - 12, 24, 10, 8, '#6e4a24', -0.3);
    elipse(ctx, cx, 36, 13, 10, '#f3e6cf');
    // orejas
    elipse(ctx, cx - 13, 16, 5, 4, '#7a4f28', -0.5); elipse(ctx, cx - 13, 16, 3, 2.4, '#e2a69a', -0.5);
    elipse(ctx, cx + 13, 16, 5, 4, '#7a4f28', 0.5); elipse(ctx, cx + 13, 16, 3, 2.4, '#e2a69a', 0.5);
    // cara
    circulo(ctx, cx - 7, 26, 3, '#1a120c'); circulo(ctx, cx + 7, 26, 3, '#1a120c');
    circulo(ctx, cx - 6, 25, 1, '#fff'); circulo(ctx, cx + 8, 25, 1, '#fff');
    poligono(ctx, [[cx - 2.4, 32], [cx + 2.4, 32], [cx, 34.5]], '#d9707a');
    ctx.strokeStyle = 'rgba(60,40,20,.55)'; ctx.lineWidth = 0.9;
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.moveTo(cx + sx * 4, 34); ctx.lineTo(cx + sx * 14, 33 + sy * 3); ctx.stroke(); });
    circulo(ctx, cx - 11, 32, 3, 'rgba(240,140,120,.35)'); circulo(ctx, cx + 11, 32, 3, 'rgba(240,140,120,.35)');
  }

  function tomas(ctx) {
    const cx = 48;
    elipse(ctx, cx - 18, 90, 11, 7, '#2a2522'); elipse(ctx, cx + 18, 90, 11, 7, '#2a2522');
    elipse(ctx, cx - 18, 91, 6, 3.6, '#6a5a4e'); elipse(ctx, cx + 18, 91, 6, 3.6, '#6a5a4e');
    elipse(ctx, cx, 62, 30, 28, null);
    ctx.fillStyle = radial(ctx, cx, 62, 32, '#4a403a', '#1f1b19', cx - 10, 50); ctx.fill();
    // marca crema en el pecho
    ctx.beginPath(); ctx.moveTo(cx - 14, 52); ctx.quadraticCurveTo(cx, 70, cx + 14, 52); ctx.quadraticCurveTo(cx, 62, cx - 14, 52); ctx.fillStyle = '#e9d9a8'; ctx.fill();
    elipse(ctx, cx - 21, 72, 8, 12, '#2a2522', 0.25); elipse(ctx, cx + 21, 72, 8, 12, '#2a2522', -0.25);
    // cabeza
    circulo(ctx, cx - 16, 15, 7.5, '#2a2522'); circulo(ctx, cx + 16, 15, 7.5, '#2a2522');
    circulo(ctx, cx - 16, 15, 3.6, '#5a4d44'); circulo(ctx, cx + 16, 15, 3.6, '#5a4d44');
    circulo(ctx, cx, 32, 21, null);
    ctx.fillStyle = radial(ctx, cx, 32, 22, '#4a403a', '#221d1b', cx - 7, 24); ctx.fill();
    // «anteojos» crema alrededor de los ojos y hocico
    ctx.lineWidth = 3.4; ctx.strokeStyle = '#eedfb0';
    ctx.beginPath(); ctx.ellipse(cx - 8, 29, 5.6, 6, -0.3, 0.3, TAU - 0.9); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 8, 29, 5.6, 6, 0.3, Math.PI + 0.9, Math.PI + TAU - 0.3 - 0.0001); ctx.stroke();
    elipse(ctx, cx, 40, 10, 8, '#eedfb0');
    circulo(ctx, cx - 8, 29, 2.3, '#0e0b0a'); circulo(ctx, cx + 8, 29, 2.3, '#0e0b0a');
    circulo(ctx, cx - 7.2, 28.2, 0.8, '#fff'); circulo(ctx, cx + 8.8, 28.2, 0.8, '#fff');
    elipse(ctx, cx, 37, 4.4, 3, '#1a1412');
    ctx.beginPath(); ctx.moveTo(cx, 40); ctx.lineTo(cx, 43); ctx.moveTo(cx - 4, 44); ctx.quadraticCurveTo(cx, 46.5, cx + 4, 44); ctx.lineWidth = 1.3; ctx.strokeStyle = '#3a2c24'; ctx.stroke();
  }

  /* ---------- vegetación ---------- */

  const ARBOLES = {
    aliso:     { hoja: '#6faa45', osc: '#447a2c', luz: '#a6d06a', tronco: '#7a5a3e' },
    bosque:    { hoja: '#3f7a3a', osc: '#264f26', luz: '#6ea457', tronco: '#5a4030' },
    encenillo: { hoja: '#4c8a3e', osc: '#2d5a2a', luz: '#7cb15a', tronco: '#6a4a34', puntos: '#c4513a' },
    gaque:     { hoja: '#2f6e4a', osc: '#1d4a32', luz: '#5a9a6e', tronco: '#5e4632', brillo: true },
    grande:    { hoja: '#5c9a3e', osc: '#36682a', luz: '#93c45e', tronco: '#6e4c34' },
  };

  // Caja 130×150 (grande: 230×240). El tronco nace en (w/2, h-8).
  function arbol(ctx, tipo, variante, w, h) {
    const P = ARBOLES[tipo];
    const r = window.GU_MAPA.aleatorio(variante * 97 + tipo.length * 13);
    const cx = w / 2, base = h - 8;
    const esc = w / 130;
    sombraSuelo(ctx, cx + 8 * esc, base, 46 * esc, 13 * esc, 0.28);
    // tronco
    ctx.beginPath(); ctx.moveTo(cx - 7 * esc, base); ctx.quadraticCurveTo(cx - 4 * esc, base - 30 * esc, cx - 5 * esc, base - 52 * esc);
    ctx.lineTo(cx + 5 * esc, base - 52 * esc); ctx.quadraticCurveTo(cx + 4 * esc, base - 30 * esc, cx + 7 * esc, base); ctx.closePath();
    ctx.fillStyle = P.tronco; ctx.fill();
    linea(ctx, [[cx + 3 * esc, base - 4 * esc], [cx + 2 * esc, base - 46 * esc]], 2.4 * esc, oscuro(P.tronco, 0.35));
    // copa: lóbulos
    const ccy = base - 78 * esc;
    const lob = [];
    const n = 6 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.5;
      const d = (20 + r() * 12) * esc;
      lob.push([cx + Math.cos(a) * d * 1.1, ccy + Math.sin(a) * d * 0.85, (24 + r() * 10) * esc]);
    }
    lob.push([cx, ccy, 32 * esc]);
    lob.forEach(([x, y, rr]) => circulo(ctx, x + 3 * esc, y + 6 * esc, rr, P.osc));
    lob.forEach(([x, y, rr]) => {
      circulo(ctx, x, y, rr, null);
      ctx.fillStyle = radial(ctx, x, y, rr, P.luz, P.hoja, x - rr * 0.45, y - rr * 0.5); ctx.fill();
    });
    // sombra interna abajo para volumen
    ctx.save();
    ctx.beginPath(); lob.forEach(([x, y, rr]) => { ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU); }); ctx.clip();
    const g = ctx.createLinearGradient(0, ccy - 40 * esc, 0, ccy + 50 * esc);
    g.addColorStop(0, 'rgba(255,255,230,.10)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,30,10,.32)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // hojitas
    for (let i = 0; i < 26; i++) {
      const x = cx + (r() - 0.5) * 80 * esc, y = ccy + (r() - 0.6) * 60 * esc;
      elipse(ctx, x, y, 3.2 * esc, 1.8 * esc, rgba(P.luz, 0.55), r() * 3);
    }
    if (P.puntos) for (let i = 0; i < 18; i++) circulo(ctx, cx + (r() - 0.5) * 80 * esc, ccy + (r() - 0.5) * 60 * esc, 1.8 * esc, P.puntos);
    if (P.brillo) for (let i = 0; i < 12; i++) elipse(ctx, cx + (r() - 0.5) * 70 * esc, ccy + (r() - 0.7) * 50 * esc, 4.5 * esc, 2.6 * esc, 'rgba(220,255,220,.35)', r() * 3);
    ctx.restore();
  }

  function arbusto(ctx, tono) {
    const P = tono > 0.5 ? ARBOLES.aliso : ARBOLES.encenillo;
    sombraSuelo(ctx, 32, 40, 26, 7, 0.25);
    [[20, 30, 13], [44, 30, 13], [32, 22, 15], [32, 32, 14]].forEach(([x, y, r]) => circulo(ctx, x + 2, y + 3, r, P.osc));
    [[20, 30, 13], [44, 30, 13], [32, 22, 15], [32, 32, 14]].forEach(([x, y, r]) => { circulo(ctx, x, y, r, null); ctx.fillStyle = radial(ctx, x, y, r, P.luz, P.hoja, x - 5, y - 6); ctx.fill(); });
    if (tono > 0.75) [[22, 24], [38, 20], [44, 30], [30, 33]].forEach(([x, y]) => circulo(ctx, x, y, 2.2, '#f2d34a'));
  }

  function frailejon(ctx, flor) {
    const cx = 32;
    sombraSuelo(ctx, cx + 4, 94, 18, 6, 0.28);
    // tronco cubierto de hojas secas
    ctx.beginPath(); ctx.moveTo(cx - 9, 95); ctx.lineTo(cx - 7, 44); ctx.lineTo(cx + 7, 44); ctx.lineTo(cx + 9, 95); ctx.closePath();
    ctx.fillStyle = '#8a7550'; ctx.fill();
    ctx.strokeStyle = '#6a5838'; ctx.lineWidth = 1.2;
    for (let y = 48; y < 94; y += 5) { ctx.beginPath(); ctx.moveTo(cx - 8, y); ctx.quadraticCurveTo(cx, y + 4, cx + 8, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,240,200,.25)';
    for (let y = 50; y < 94; y += 7) { ctx.beginPath(); ctx.moveTo(cx - 3, y); ctx.lineTo(cx - 2, y + 4); ctx.stroke(); }
    // flores en varas
    if (flor) {
      [[-12, 6], [10, 2], [0, -2]].forEach(([dx, top]) => {
        linea(ctx, [[cx, 38], [cx + dx, top + 10]], 1.6, '#8a9a5a');
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6; elipse(ctx, cx + dx + Math.cos(a) * 3.5, top + 10 + Math.sin(a) * 3.5, 2.6, 1.4, '#f2c230', a); }
        circulo(ctx, cx + dx, top + 10, 2, '#b8862a');
      });
    }
    // roseta de hojas plateadas (vista desde arriba en tres cuartos)
    const hojas = 18;
    for (let pasada = 0; pasada < 2; pasada++) {
      for (let i = 0; i < hojas; i++) {
        const a = (i / hojas) * TAU + pasada * 0.17;
        const largo = pasada ? 13 : 19;
        const x = cx + Math.cos(a) * largo * 0.6, y = 38 + Math.sin(a) * largo * 0.4;
        elipse(ctx, x, y, largo * 0.55, 3.4, pasada ? '#d3dcb5' : (Math.sin(a) > 0 ? '#aebd88' : '#9aab76'), a);
      }
    }
    circulo(ctx, cx, 38, 4, '#e6ecd0');
  }

  function matojo(ctx, w, h, colores, n, curva, grosor) {
    const cx = w / 2, base = h - 2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const alto = h * (0.6 + 0.4 * Math.cos(t * 2.2)) - 4;
      const dx = t * w * 0.95;
      ctx.beginPath(); ctx.moveTo(cx + t * 6, base);
      ctx.quadraticCurveTo(cx + dx * 0.3, base - alto * 0.6, cx + dx + curva * t, base - alto);
      ctx.lineWidth = grosor; ctx.strokeStyle = colores[i % colores.length]; ctx.stroke();
    }
  }
  const pajon = ctx => { sombraSuelo(ctx, 25, 37, 16, 4, 0.2); matojo(ctx, 48, 40, ['#d8b65a', '#c39a3e', '#ead083', '#b8893a'], 15, 12, 2); };
  const hierba = (ctx, tono) => matojo(ctx, 34, 26, tono ? ['#5e9c3e', '#7ab84f', '#4f8a35'] : ['#6aa845', '#8cc456', '#5a9a3a'], 9, 8, 2);
  function junco(ctx) {
    sombraSuelo(ctx, 18, 62, 12, 3.5, 0.2);
    const tallos = [[-8, 50, -5], [-3, 58, -2], [2, 54, 1], [7, 60, 4], [11, 46, 7], [-11, 42, -8]];
    tallos.forEach(([dx, alto, inc], i) => {
      linea(ctx, [[18 + dx * 0.3, 63], [18 + dx + inc, 63 - alto]], 2.2, i % 2 ? '#4f8a3c' : '#6aa84a');
      if (i % 2 === 0) elipse(ctx, 18 + dx + inc, 63 - alto + 5, 1.8, 4.5, '#8a6a3a');
    });
  }
  function helecho(ctx, f) {
    sombraSuelo(ctx, 26, 30, 20, 5, 0.2);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + 0.25 + (i / 5) * (Math.PI - 0.5);
      const x2 = 26 + Math.cos(a) * 24, y2 = 30 + Math.sin(a) * 22;
      ctx.beginPath(); ctx.moveTo(26, 30); ctx.quadraticCurveTo((26 + x2) / 2, (30 + y2) / 2 - 6, x2, y2);
      ctx.lineWidth = 1.4; ctx.strokeStyle = '#3f7a32'; ctx.stroke();
      for (let k = 1; k < 6; k++) {
        const t = k / 6, px = 26 + (x2 - 26) * t, py = 30 + (y2 - 30) * t - 6 * Math.sin(t * Math.PI);
        elipse(ctx, px, py, 3.2 * (1 - t * 0.6), 1.5, i % 2 ? '#5f9e45' : '#4c8a3a', a + 1.4);
      }
    }
  }
  const COLORES_FLOR = ['#f2c230', '#f7f4ea', '#9a6bc0', '#e0533f'];
  function flor(ctx, c) {
    linea(ctx, [[8, 16], [8, 9]], 1.3, '#4f8a35');
    for (let k = 0; k < 5; k++) { const a = k * TAU / 5; circulo(ctx, 8 + Math.cos(a) * 2.8, 7 + Math.sin(a) * 2.8, 2.3, COLORES_FLOR[c]); }
    circulo(ctx, 8, 7, 1.6, c === 0 ? '#b0702a' : '#f2c230');
  }

  /* ---------- piedras, vasijas, huerta ---------- */

  function roca(ctx, tipo) {
    sombraSuelo(ctx, 33, 36, 28, 7, 0.28);
    ctx.beginPath();
    if (tipo === 0) { ctx.moveTo(8, 34); ctx.quadraticCurveTo(6, 16, 24, 10); ctx.quadraticCurveTo(44, 4, 52, 20); ctx.quadraticCurveTo(58, 32, 50, 36); ctx.closePath(); }
    else { ctx.moveTo(12, 34); ctx.quadraticCurveTo(14, 18, 30, 16); ctx.quadraticCurveTo(48, 16, 50, 30); ctx.quadraticCurveTo(48, 37, 30, 37); ctx.closePath(); }
    ctx.fillStyle = radial(ctx, 30, 24, 30, '#b9bdb6', '#6f7672', 22, 14); ctx.fill();
    elipse(ctx, 24, 16, 7, 3, 'rgba(255,255,255,.3)', -0.3);
    circulo(ctx, 40, 22, 3, 'rgba(160,190,90,.6)'); circulo(ctx, 44, 25, 2, 'rgba(160,190,90,.6)');
  }

  function piedraParada(ctx) {
    sombraSuelo(ctx, 18, 46, 13, 4, 0.3);
    ctx.beginPath(); ctx.moveTo(6, 46); ctx.quadraticCurveTo(4, 14, 15, 6); ctx.quadraticCurveTo(26, 4, 26, 20); ctx.lineTo(26, 46); ctx.quadraticCurveTo(16, 50, 6, 46);
    ctx.fillStyle = radial(ctx, 16, 24, 26, '#b2aca0', '#7a746a', 10, 12); ctx.fill();
    linea(ctx, [[20, 12], [21, 44]], 2, 'rgba(0,0,0,.15)');
    circulo(ctx, 12, 30, 2.4, 'rgba(210,200,120,.55)'); circulo(ctx, 15, 20, 1.6, 'rgba(210,200,120,.55)');
  }

  function vasija(ctx, tipo) {
    const cx = 18;
    sombraSuelo(ctx, cx + 3, 35, 14, 4, 0.3);
    ctx.beginPath();
    if (tipo === 0) { ctx.moveTo(cx - 5, 6); ctx.lineTo(cx - 5, 10); ctx.quadraticCurveTo(cx - 17, 16, cx - 14, 28); ctx.quadraticCurveTo(cx, 40, cx + 14, 28); ctx.quadraticCurveTo(cx + 17, 16, cx + 5, 10); ctx.lineTo(cx + 5, 6); ctx.closePath(); }
    else if (tipo === 1) { ctx.moveTo(cx - 15, 12); ctx.quadraticCurveTo(cx - 14, 28, cx - 4, 30); ctx.lineTo(cx - 6, 35); ctx.lineTo(cx + 6, 35); ctx.lineTo(cx + 4, 30); ctx.quadraticCurveTo(cx + 14, 28, cx + 15, 12); ctx.closePath(); }
    else { ctx.moveTo(cx - 6, 4); ctx.quadraticCurveTo(cx - 16, 14, cx - 13, 26); ctx.quadraticCurveTo(cx, 38, cx + 13, 26); ctx.quadraticCurveTo(cx + 16, 14, cx + 6, 4); ctx.closePath(); }
    ctx.fillStyle = radial(ctx, cx, 20, 20, '#d98a55', '#9a4f2a', cx - 5, 14); ctx.fill();
    if (tipo === 2) { ctx.beginPath(); ctx.arc(cx - 14, 16, 4, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(cx + 14, 16, 4, Math.PI * 1.5, Math.PI * 0.5); ctx.lineWidth = 2.2; ctx.strokeStyle = '#8a4422'; ctx.stroke(); }
    // banda con zigzag muisca
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#6e3a20'; ctx.fillRect(0, 18, 40, 5);
    ctx.strokeStyle = '#f0d9a8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let x = 0; x < 40; x += 4) { ctx.lineTo(x, 19); ctx.lineTo(x + 2, 22); } ctx.stroke();
    ctx.restore();
    if (tipo !== 1) elipse(ctx, cx, tipo === 0 ? 6 : 4, tipo === 0 ? 5 : 6, 2, '#5a2e18');
    else elipse(ctx, cx, 12, 15, 3.5, '#5a2e18');
  }

  function piedraSol(ctx, hc) {
    sombraSuelo(ctx, 42, 42, 36, 9, 0.3);
    elipse(ctx, 40, 32, 35, 20, null);
    ctx.fillStyle = radial(ctx, 40, 32, 36, '#cbbd9e', '#8e8068', 30, 24); ctx.fill();
    elipse(ctx, 40, 30, 30, 15, 'rgba(255,255,255,.08)');
    ctx.save(); ctx.translate(40, 30); ctx.scale(1, 0.58);
    ctx.strokeStyle = hc ? '#000' : '#8a5a1a'; ctx.lineWidth = 2.6;
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.stroke(); }
    circulo(ctx, 0, 0, 10, '#e7b53c'); ctx.lineWidth = 2.4; ctx.stroke();
    circulo(ctx, -3.5, -2, 1.5, '#7a4a12'); circulo(ctx, 3.5, -2, 1.5, '#7a4a12');
    ctx.beginPath(); ctx.arc(0, 1, 4.5, 0.2, Math.PI - 0.2); ctx.lineWidth = 1.5; ctx.strokeStyle = '#7a4a12'; ctx.stroke();
    ctx.restore();
  }

  function maiz(ctx) {
    sombraSuelo(ctx, 22, 76, 12, 3.5, 0.22);
    linea(ctx, [[20, 77], [20, 10]], 3, '#7fae45');
    [[20, 62, -1], [20, 50, 1], [20, 38, -1], [20, 28, 1], [20, 20, -1]].forEach(([x, y, s], i) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 12, y - 10, x + s * 18, y + 2 - i);
      ctx.quadraticCurveTo(x + s * 10, y - 4, x, y + 3); ctx.closePath(); ctx.fillStyle = i % 2 ? '#8cc456' : '#6aa53c'; ctx.fill();
    });
    elipse(ctx, 25, 44, 4, 9, '#f0c53a', 0.2);
    ctx.beginPath(); ctx.moveTo(22, 54); ctx.quadraticCurveTo(30, 46, 27, 34); ctx.quadraticCurveTo(22, 44, 22, 54); ctx.fillStyle = '#7fae45'; ctx.fill();
    linea(ctx, [[20, 10], [15, 3]], 1.4, '#d8c070'); linea(ctx, [[20, 10], [20, 2]], 1.4, '#d8c070'); linea(ctx, [[20, 10], [25, 3]], 1.4, '#d8c070');
  }
  function papa(ctx) {
    sombraSuelo(ctx, 21, 28, 17, 4, 0.22);
    [[12, 20, 9], [28, 20, 9], [20, 13, 10], [20, 22, 9]].forEach(([x, y, r]) => circulo(ctx, x + 1, y + 2, r, '#2f5f28'));
    [[12, 20, 9], [28, 20, 9], [20, 13, 10], [20, 22, 9]].forEach(([x, y, r]) => { circulo(ctx, x, y, r, null); ctx.fillStyle = radial(ctx, x, y, r, '#7cb45a', '#4a8a3a', x - 3, y - 4); ctx.fill(); });
    [[14, 12], [26, 14], [20, 7]].forEach(([x, y]) => { for (let k = 0; k < 5; k++) { const a = k * TAU / 5; circulo(ctx, x + Math.cos(a) * 2, y + Math.sin(a) * 2, 1.6, '#d9c2ef'); } circulo(ctx, x, y, 1.2, '#f2c230'); });
  }

  /* ---------- casa campesina ---------- */

  function casa(ctx) {
    sombraSuelo(ctx, 160, 222, 150, 22, 0.3);
    // muro blanco con zócalo
    rect(ctx, 30, 140, 230, 82, 3, '#f4efe4');
    ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(30, 140, 18, 82);
    ctx.fillStyle = '#2f6d8e'; ctx.fillRect(30, 204, 230, 18);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(30, 140, 230, 10);
    // puerta
    rect(ctx, 128, 158, 34, 64, 2, '#2f6d8e');
    rect(ctx, 132, 162, 26, 60, 1, '#7a4a2a');
    ctx.strokeStyle = '#5e3820'; ctx.lineWidth = 1.2;
    [140, 149].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 163); ctx.lineTo(x, 221); ctx.stroke(); });
    circulo(ctx, 153, 192, 1.8, '#e2b23c');
    // ventanas con postigos
    [[58, 162], [196, 162]].forEach(([x, y]) => {
      rect(ctx, x - 9, y - 2, 9, 32, 1, '#2f6d8e'); rect(ctx, x + 36, y - 2, 9, 32, 1, '#2f6d8e');
      rect(ctx, x, y, 36, 28, 1, '#2f6d8e');
      rect(ctx, x + 3, y + 3, 30, 22, 1, '#2c3e50');
      ctx.fillStyle = 'rgba(160,210,240,.35)'; ctx.fillRect(x + 3, y + 3, 12, 10);
      linea(ctx, [[x + 18, y + 3], [x + 18, y + 25]], 2, '#2f6d8e'); linea(ctx, [[x + 3, y + 14], [x + 33, y + 14]], 2, '#2f6d8e');
      // matera con geranios
      rect(ctx, x + 2, y + 30, 32, 7, 2, '#b4532a');
      [6, 13, 20, 27].forEach((dx, i) => { circulo(ctx, x + 2 + dx, y + 29, 4, '#4f8a3c'); circulo(ctx, x + 2 + dx + 1, y + 27, 2.4, i % 2 ? '#e0533f' : '#f07aa0'); });
    });
    // techo de teja: faldón trasero y delantero
    poligono(ctx, [[48, 64], [242, 64], [228, 30], [62, 30]], '#8f3c24');
    ctx.beginPath(); ctx.moveTo(8, 150); ctx.lineTo(282, 150); ctx.lineTo(250, 62); ctx.lineTo(40, 62); ctx.closePath();
    const g = ctx.createLinearGradient(0, 62, 0, 150); g.addColorStop(0, '#d0653a'); g.addColorStop(1, '#a8472a');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    for (let fila = 0, y = 70; y < 152; y += 11, fila++) {
      const t = (y - 62) / 88;
      const x0 = 40 - 32 * t, x1 = 250 + 32 * t;
      ctx.strokeStyle = 'rgba(90,30,15,.45)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = x0 + (fila % 2) * 6; x < x1; x += 12) { ctx.moveTo(x, y); ctx.arc(x + 6, y, 6, Math.PI, 0, true); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,160,.18)'; ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.lineTo(x1, y - 4); ctx.stroke();
    }
    ctx.restore();
    linea(ctx, [[40, 63], [250, 63]], 6, '#7e3420');
    for (let x = 46; x < 250; x += 14) elipse(ctx, x, 63, 6, 3.4, '#9a4428');
    // chimenea
    rect(ctx, 200, 20, 22, 40, 2, '#ece4d4'); rect(ctx, 197, 16, 28, 7, 2, '#6a5a4a');
  }

  /* ---------- animales del potrero ---------- */

  function vaca(ctx) {
    sombraSuelo(ctx, 42, 54, 32, 7, 0.28);
    [[22, 40], [30, 42], [52, 42], [60, 40]].forEach(([x, y]) => { rect(ctx, x - 3, y, 6, 14, 2, '#e9e4da'); rect(ctx, x - 3, y + 11, 6, 3, 1, '#3a2c24'); });
    linea(ctx, [[14, 30], [8, 42]], 2, '#e9e4da'); circulo(ctx, 8, 43, 2.4, '#3a2c24');
    elipse(ctx, 40, 32, 28, 14, '#f5f1e8');
    ctx.save(); elipse(ctx, 40, 32, 28, 14, null); ctx.clip();
    elipse(ctx, 30, 26, 10, 7, '#2e2622', 0.4); elipse(ctx, 52, 36, 9, 6, '#2e2622', -0.3); elipse(ctx, 42, 22, 5, 4, '#2e2622');
    ctx.restore();
    elipse(ctx, 68, 26, 10, 9, '#f5f1e8');
    elipse(ctx, 66, 22, 5, 4, '#2e2622');
    elipse(ctx, 74, 30, 6, 5, '#e9a6a0');
    circulo(ctx, 72, 29, 1, '#6a3a30'); circulo(ctx, 76, 29, 1, '#6a3a30');
    circulo(ctx, 67, 24, 1.6, '#1a120c');
    elipse(ctx, 60, 18, 4.5, 2.4, '#e9e4da', -0.5); elipse(ctx, 74, 18, 4.5, 2.4, '#e9e4da', 0.5);
    linea(ctx, [[63, 17], [61, 13]], 2, '#d8c9a0'); linea(ctx, [[71, 17], [73, 13]], 2, '#d8c9a0');
  }
  function oveja(ctx) {
    sombraSuelo(ctx, 28, 38, 22, 5, 0.25);
    [[16, 30], [22, 31], [34, 31], [40, 30]].forEach(([x, y]) => rect(ctx, x - 2, y, 4, 8, 1.5, '#3a3330'));
    [[16, 22, 9], [26, 18, 10], [36, 22, 9], [24, 27, 9], [34, 27, 8], [14, 28, 7]].forEach(([x, y, r]) => circulo(ctx, x, y, r, '#e6dfcc'));
    [[16, 20, 8], [26, 16, 9], [36, 20, 8], [24, 25, 8], [34, 25, 7]].forEach(([x, y, r]) => circulo(ctx, x, y, r, '#f6f2e6'));
    elipse(ctx, 45, 22, 7, 6.5, '#3a3330');
    elipse(ctx, 40, 17, 4, 2, '#3a3330', -0.6); elipse(ctx, 50, 17, 4, 2, '#3a3330', 0.6);
    circulo(ctx, 47, 21, 1.2, '#fff');
  }

  /* ---------- efectos y marcadores ---------- */

  // Nube hecha de bolitas suaves (sin bordes duros); la sombra usa la misma forma.
  function nube(ctx, sombra) {
    const c = sombra ? '#1a2a1a' : '#ffffff';
    const bolitas = [[70, 92, 50], [120, 72, 60], [182, 80, 56], [232, 98, 44], [150, 106, 48], [100, 110, 42]];
    bolitas.forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, rgba(c, 0.95)); g.addColorStop(0.55, rgba(c, 0.7)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
  }
  function pajaro(ctx, f) {
    ctx.strokeStyle = '#3a2e2a'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (f === 0) { ctx.moveTo(2, 4); ctx.quadraticCurveTo(8, 2, 15, 10); ctx.quadraticCurveTo(22, 2, 28, 4); }
    else { ctx.moveTo(2, 13); ctx.quadraticCurveTo(8, 8, 15, 10); ctx.quadraticCurveTo(22, 8, 28, 13); }
    ctx.stroke();
    elipse(ctx, 15, 10, 2.6, 2, '#3a2e2a');
  }
  function onda(ctx) {
    ctx.beginPath(); ctx.moveTo(2, 6); ctx.quadraticCurveTo(13, 1, 24, 6);
    ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  }
  function destello(ctx) {
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.quadraticCurveTo(12.5, 9.5, 22, 11); ctx.quadraticCurveTo(12.5, 12.5, 11, 22); ctx.quadraticCurveTo(9.5, 12.5, 0, 11); ctx.quadraticCurveTo(9.5, 9.5, 11, 0); ctx.fill();
  }
  function bolaSuave(ctx, w, h, color, a) {
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1, h / w);
    ctx.fillStyle = radial(ctx, 0, 0, w / 2, rgba(color, a), rgba(color, 0)); ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function sombra(ctx) { bolaSuave(ctx, 64, 24, '#1e140a', 0.42); }

  function anillo(ctx, color, hc) {
    ctx.beginPath(); ctx.arc(125, 125, 112, 0, TAU);
    ctx.lineWidth = hc ? 14 : 10; ctx.strokeStyle = hc ? '#000' : '#ffffff'; ctx.stroke();
    ctx.lineWidth = hc ? 8 : 5; ctx.strokeStyle = hc ? '#ffe36e' : color; ctx.stroke();
  }
  function marcador(ctx, color, hc) {
    poligono(ctx, [[17, 40], [33, 40], [25, 56]], hc ? '#000' : '#fff');
    circulo(ctx, 25, 25, 21, hc ? '#000' : '#fff');
    circulo(ctx, 25, 25, 16, hc ? '#ffe36e' : color);
    poligono(ctx, [[17, 21], [33, 21], [25, 32]], hc ? '#000' : '#fff');
    rect(ctx, 22, 13, 6, 10, 2, hc ? '#000' : '#fff');
  }
  function chulo(ctx, hc) {
    circulo(ctx, 22, 22, 19, hc ? '#000' : '#ffffff');
    circulo(ctx, 22, 22, 15.5, hc ? '#6dff8a' : '#2f9a46');
    linea(ctx, [[14, 22.5], [20, 28.5], [30.5, 16]], 4.6, hc ? '#000' : '#ffffff');
  }
  function burbuja(ctx, color, hc) {
    circulo(ctx, 40, 40, 36, hc ? '#000' : '#ffffff');
    circulo(ctx, 40, 40, 31, hc ? '#ffe36e' : color);
    circulo(ctx, 40, 40, 31, null); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
  }
  function flecha(ctx, hc) {
    poligono(ctx, [[4, 6], [34, 20], [4, 34], [11, 20]], hc ? '#000' : '#ffffff');
    poligono(ctx, [[8.5, 11], [28, 20], [8.5, 29], [13.5, 20]], hc ? '#ffe36e' : '#c0562f');
  }

  // Letrero de madera con número y nombre de la estación. Devuelve {w,h} y dibuja.
  function medirLetrero(nombre, fuente) {
    const { ctx } = lienzo(4, 4, 1);
    ctx.font = `800 23px ${fuente}`;
    const palabras = nombre.split(' ');
    const lineas = [];
    let actual = '';
    palabras.forEach(p => {
      const prueba = actual ? actual + ' ' + p : p;
      if (ctx.measureText(prueba).width > 186 && actual) { lineas.push(actual); actual = p; } else actual = prueba;
    });
    if (actual) lineas.push(actual);
    const ancho = Math.max(...lineas.map(l => ctx.measureText(l).width));
    return { lineas, w: Math.ceil(ancho + 76), h: lineas.length * 26 + 22 };
  }
  function letrero(ctx, m, numero, color, hc, fuente) {
    const W = m.w + 8, H = m.h + 40;
    const bx = 4, by = 4;
    // postes
    rect(ctx, W / 2 - 34, by + m.h - 6, 9, 40, 2, hc ? '#000' : '#6b4a32');
    rect(ctx, W / 2 + 25, by + m.h - 6, 9, 40, 2, hc ? '#000' : '#6b4a32');
    sombraSuelo(ctx, W / 2, H - 3, 52, 5, 0.25);
    // tabla
    rect(ctx, bx, by + 3, m.w, m.h, 12, hc ? '#000' : '#5e3e26');
    rect(ctx, bx, by, m.w, m.h, 12, hc ? '#000' : '#7a5232');
    rect(ctx, bx + 4, by + 4, m.w - 8, m.h - 8, 9, hc ? '#ffffff' : '#f3e2b8');
    if (!hc) {
      ctx.strokeStyle = 'rgba(122,82,50,.18)'; ctx.lineWidth = 1.4;
      for (let y = by + 14; y < by + m.h - 6; y += 9) { ctx.beginPath(); ctx.moveTo(bx + 10, y); ctx.lineTo(bx + m.w - 10, y + 1); ctx.stroke(); }
    }
    // número en círculo del color de la estación
    circulo(ctx, bx + 28, by + m.h / 2, 18, hc ? '#000' : color);
    circulo(ctx, bx + 28, by + m.h / 2, 18, null); ctx.lineWidth = 3; ctx.strokeStyle = hc ? '#ffe36e' : '#fff'; ctx.stroke();
    ctx.fillStyle = hc ? '#ffe36e' : '#fff'; ctx.font = `800 22px ${fuente}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(numero), bx + 28, by + m.h / 2 + 1);
    ctx.fillStyle = hc ? '#000' : '#3a2614'; ctx.font = `800 23px ${fuente}`; ctx.textAlign = 'left';
    m.lineas.forEach((l, i) => ctx.fillText(l, bx + 54, by + 11 + 13 + i * 26));
  }

  // Semillas: brillo dorado y un dibujito distinto por estación.
  function semilla(ctx, i, hc) {
    const cx = 30, cy = 30;
    if (hc) { circulo(ctx, cx, cy, 24, '#ffffff'); ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.stroke(); }
    else { ctx.fillStyle = radial(ctx, cx, cy, 29, 'rgba(255,236,150,.95)', 'rgba(255,220,110,0)'); ctx.beginPath(); ctx.arc(cx, cy, 29, 0, TAU); ctx.fill(); circulo(ctx, cx, cy, 15, 'rgba(255,250,225,.9)'); }
    ctx.save(); ctx.translate(cx, cy);
    if (i === 0) { // semilla de la memoria: bellota
      elipse(ctx, 0, 3, 7.5, 9, '#9a5a2a'); elipse(ctx, -2, 1, 2.4, 4, 'rgba(255,255,255,.3)');
      elipse(ctx, 0, -5, 9, 5, '#6a4022'); linea(ctx, [[0, -10], [2, -14]], 2, '#6a4022');
    } else if (i === 1) { // junco
      linea(ctx, [[0, 13], [0, -12]], 2, '#6aa84a');
      for (let k = 0; k < 5; k++) { elipse(ctx, -3, -8 + k * 4, 3.4, 1.8, '#d8a640', -0.6); elipse(ctx, 3, -6 + k * 4, 3.4, 1.8, '#c8902e', 0.6); }
    } else if (i === 2) { // pluma
      ctx.rotate(0.5);
      elipse(ctx, 0, 0, 5.5, 13, '#f2efe6'); elipse(ctx, 0, -8, 4, 5, '#7a5a3a');
      linea(ctx, [[0, -13], [0, 15]], 1.4, '#8a7a6a');
    } else if (i === 3) { // hojas de encenillo
      elipse(ctx, -5, 0, 5, 10, '#4c8a3e', -0.5); elipse(ctx, 5, 0, 5, 10, '#6aa84a', 0.5);
      linea(ctx, [[0, 12], [0, 2]], 1.6, '#3f6a2a'); circulo(ctx, 0, -4, 2, '#c4513a');
    } else if (i === 4) { // mazorca
      elipse(ctx, 0, -2, 6, 11, '#f0c53a');
      ctx.fillStyle = '#d8a020'; for (let y = -10; y < 8; y += 4) for (let x = -3; x <= 3; x += 3) circulo(ctx, x, y, 1, '#c8901a');
      ctx.beginPath(); ctx.moveTo(-2, 12); ctx.quadraticCurveTo(-11, 4, -7, -8); ctx.quadraticCurveTo(-4, 4, 0, 12); ctx.fillStyle = '#6aa53c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, 12); ctx.quadraticCurveTo(11, 4, 7, -8); ctx.quadraticCurveTo(4, 4, 0, 12); ctx.fill();
    } else { // flor de frailejón
      for (let k = 0; k < 10; k++) { const a = k * TAU / 10; elipse(ctx, Math.cos(a) * 7, Math.sin(a) * 7, 5, 2.3, '#f2c230', a); }
      circulo(ctx, 0, 0, 4.5, '#b8862a');
    }
    ctx.restore();
  }

  /* ---------- suelo del mapa ---------- */

  function trazar(ctx, pts, ancho, color, salto = 1) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = salto; i < pts.length; i += salto) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.lineWidth = ancho; ctx.strokeStyle = color; ctx.stroke();
  }
  function mancha(ctx, x, y, r, color, a, sy = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
    ctx.fillStyle = radial(ctx, 0, 0, r, rgba(color, a), rgba(color, 0));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
  }

  // Dibuja el suelo completo (en coordenadas de mundo). `caja` = zona visible del trozo,
  // para no pintar detalles fuera de él.
  function suelo(ctx, M, colores, hc, caja, fuente) {
    const D = M.decorado;
    const dentro = (x, y, m = 20) => x > caja.x0 - m && x < caja.x1 + m && y > caja.y0 - m && y < caja.y1 + m;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // 1. base: del páramo ocre arriba al valle verde abajo
    const g = ctx.createLinearGradient(0, 0, 0, M.ALTO);
    const paradas = hc
      ? [[0, '#d6cfa6'], [0.25, '#c9cf9a'], [0.5, '#b3c99a'], [1, '#c2d6a4']]
      : [[0, '#c4b77d'], [0.16, '#b9b574'], [0.23, '#a3b966'], [0.34, '#8db55e'], [0.47, '#73a352'], [0.62, '#80b158'], [0.72, '#8fbd5e'], [1, '#a1c86a']];
    paradas.forEach(([t, c]) => g.addColorStop(t, c));
    ctx.fillStyle = g; ctx.fillRect(caja.x0 - 4, caja.y0 - 4, caja.x1 - caja.x0 + 8, caja.y1 - caja.y0 + 8);

    // 2. manchas de cada zona
    if (!hc) {
      mancha(ctx, 2350, 1400, 950, '#3d7034', 0.55, 0.75);
      mancha(ctx, 1900, 1650, 520, '#3d7034', 0.3);
      mancha(ctx, 760, 1720, 540, '#dccb93', 0.65, 0.8);
      mancha(ctx, 950, 900, 700, '#b4bd66', 0.35, 0.7);
      mancha(ctx, 2100, 2160, 460, '#5c9c85', 0.5, 0.6);
      mancha(ctx, 1600, 230, 1300, '#d1bb76', 0.5, 0.45);
      mancha(ctx, 1700, 2750, 1300, '#b0d672', 0.35, 0.4);
      mancha(ctx, 2300, 2720, 520, '#b8dc7c', 0.45, 0.45);
      mancha(ctx, 2900, 600, 500, '#a9b26a', 0.35);
    } else {
      mancha(ctx, 2350, 1400, 900, '#7fa872', 0.4, 0.75);
    }

    // 3. textura de pasto (trazos cortos)
    if (!hc) {
      const grupos = { verde: [], oscuro: [], claro: [], ocre: [], punto: [] };
      D.textura.forEach(t => {
        if (!dentro(t.x, t.y)) return;
        const z = D.zonas;
        let g2 = t.c < 0.5 ? 'verde' : (t.c < 0.8 ? 'claro' : 'oscuro');
        if (z.esParamo(t.x, t.y)) g2 = t.c < 0.6 ? 'ocre' : 'verde';
        else if (z.esBosque(t.x, t.y)) g2 = t.c < 0.7 ? 'oscuro' : 'verde';
        if (t.a < 0.12) grupos.punto.push(t); else grupos[g2].push(t);
      });
      const col = { verde: 'rgba(70,120,45,.35)', oscuro: 'rgba(30,70,30,.35)', claro: 'rgba(210,235,150,.35)', ocre: 'rgba(150,120,50,.38)' };
      ctx.lineWidth = 2;
      Object.keys(col).forEach(k => {
        ctx.beginPath();
        grupos[k].forEach(t => { ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + (t.a - 0.5) * 8, t.y - 5 - t.b * 6); ctx.moveTo(t.x + 3, t.y); ctx.lineTo(t.x + 3 + (t.b - 0.5) * 6, t.y - 4 - t.a * 4); });
        ctx.strokeStyle = col[k]; ctx.stroke();
      });
      ctx.fillStyle = 'rgba(255,255,230,.18)';
      grupos.punto.forEach(t => { ctx.beginPath(); ctx.arc(t.x, t.y, 2 + t.b * 3, 0, TAU); ctx.fill(); });
    }

    // 4. montañas del Sumapaz en el borde de arriba, con niebla
    if (caja.y0 < 320) {
      const r = M.aleatorio(77);
      [['#8a9fae', 175, 120, 0], ['#9fb3a6', 205, 90, 60]].forEach(([c, base, alto, desf]) => {
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-20, base);
        for (let x = -20 + desf; x <= M.ANCHO + 200; x += 160 + r() * 120) { ctx.lineTo(x, base - alto * (0.4 + r() * 0.6)); ctx.lineTo(x + 80 + r() * 40, base - r() * 20); }
        ctx.lineTo(M.ANCHO + 20, 0); ctx.closePath();
        ctx.fillStyle = hc ? '#9aa3a8' : c; ctx.fill();
      });
      const n = ctx.createLinearGradient(0, 0, 0, 320);
      n.addColorStop(0, 'rgba(240,244,246,.75)'); n.addColorStop(0.5, 'rgba(240,244,246,.35)'); n.addColorStop(1, 'rgba(240,244,246,0)');
      ctx.fillStyle = n; ctx.fillRect(0, 0, M.ANCHO, 320);
    }

    // 5. potreros y patio de la casa
    if (!hc) {
      ctx.fillStyle = 'rgba(190,225,120,.35)'; ctx.fillRect(1640, 2520, 1310, 400);
      ctx.fillStyle = 'rgba(190,225,120,.3)'; ctx.fillRect(120, 2700, 340, 260);
    }
    elipse(ctx, M.CASA.x, M.CASA.y + 34, 170, 46, hc ? '#e8dcb8' : '#d9c08c');

    // 6. río Tunjuelo
    trazar(ctx, M.rio, (M.ANCHO_RIO + 44) * 2, hc ? '#000000' : rgba('#4e8a4a', 0.55), 2);
    trazar(ctx, M.rio, (M.ANCHO_RIO + 16) * 2, hc ? '#000000' : '#a3906a', 2);
    trazar(ctx, M.rio, M.ANCHO_RIO * 2, hc ? '#1f6fd1' : '#3d84b4', 2);
    trazar(ctx, M.rio, M.ANCHO_RIO * 2 - 30, hc ? '#3b8be8' : '#57a0cd', 2);
    trazar(ctx, M.rio, 8, hc ? 'rgba(255,255,255,.6)' : 'rgba(170,215,240,.6)', 2);

    // 7. quebrada
    trazar(ctx, M.quebrada, 50, hc ? '#000000' : rgba('#3e6e38', 0.6), 2);
    trazar(ctx, M.quebrada, 30, hc ? '#1f6fd1' : '#4a9ac8', 2);
    trazar(ctx, M.quebrada, 8, hc ? 'rgba(255,255,255,.6)' : 'rgba(180,225,245,.7)', 2);

    // 8. laguna del páramo
    const L = M.LAGUNA;
    elipse(ctx, L.x, L.y, L.rx + 18, L.ry + 14, hc ? '#000' : '#a3906a');
    elipse(ctx, L.x, L.y, L.rx, L.ry, null);
    ctx.fillStyle = hc ? '#1f6fd1' : radial(ctx, L.x, L.y, L.rx, '#5ba7d4', '#2e74a6', L.x - 50, L.y - 30); ctx.fill();
    ctx.beginPath(); ctx.ellipse(L.x - 20, L.y - 20, L.rx * 0.6, L.ry * 0.4, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();

    // 9. huerta: tierra arada con surcos
    M.PARCELAS.forEach(p => {
      rect(ctx, p.x - 8, p.y - 8, p.w + 16, p.h + 16, 14, hc ? '#000' : '#7c9a45');
      rect(ctx, p.x, p.y, p.w, p.h, 10, hc ? '#c79a6a' : '#8b5b35');
      for (let y = p.y + 14; y < p.y + p.h - 4; y += 23) {
        rect(ctx, p.x + 6, y, p.w - 12, 10, 5, hc ? '#a87a4a' : '#a46c40');
        linea(ctx, [[p.x + 10, y + 2], [p.x + p.w - 10, y + 2]], 2, 'rgba(255,220,170,.25)');
      }
    });
    // explanada de los ancestros y círculo del sol
    const CP = M.CIRCULO_PIEDRAS, CS = M.CIRCULO_SOL;
    elipse(ctx, CP.x, CP.y + 6, CP.r + 80, (CP.r + 50) * 0.7, hc ? '#efe2bf' : '#dcc596');
    elipse(ctx, CP.x, CP.y + 6, CP.r + 80, (CP.r + 50) * 0.7, null); ctx.lineWidth = 3; ctx.strokeStyle = hc ? '#000' : 'rgba(140,110,60,.35)'; ctx.stroke();
    elipse(ctx, CP.x, CP.y, CP.r * 0.7, CP.r * 0.42, hc ? '#e2d3a8' : '#cfb27c');
    elipse(ctx, CS.x, CS.y + 8, CS.r + 50, (CS.r + 36) * 0.7, hc ? '#efe2bf' : '#d9c18e');

    // 10. camino de tierra
    const cam = M.camino;
    if (hc) {
      trazar(ctx, cam, 84, '#000000');
      trazar(ctx, cam, 62, '#fff176');
      ctx.setLineDash([18, 22]); trazar(ctx, cam, 5, '#000000'); ctx.setLineDash([]);
    } else {
      trazar(ctx, cam, 70, rgba('#6d5330', 0.28));
      trazar(ctx, cam, 62, '#b8925c');
      trazar(ctx, cam, 52, '#e6cf9c');
      trazar(ctx, cam, 30, rgba('#f3e2b8', 0.6));
      const r = M.aleatorio(5);
      for (let i = 0; i < cam.length; i += 2) {
        const p = cam[i];
        if (!dentro(p.x, p.y, 40)) { r(); r(); r(); continue; }
        const ox = (r() - 0.5) * 40, oy = (r() - 0.5) * 40;
        elipse(ctx, p.x + ox, p.y + oy, 2 + r() * 2.5, 1.6 + r(), r() < 0.5 ? '#c4a571' : '#f7ead0');
      }
    }

    // 11. puente sobre el río
    const P = M.PUENTE;
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.ang);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-92, -34, 190, 76);
    rect(ctx, -95, -38, 190, 76, 6, hc ? '#000' : '#6b4a32');
    for (let x = -88; x < 92; x += 14) rect(ctx, x, -32, 12, 64, 2, hc ? (x % 28 ? '#fff176' : '#ffe36e') : (x % 28 ? '#a77a4e' : '#b8895a'));
    rect(ctx, -98, -44, 196, 9, 4, hc ? '#000' : '#5a3a22');
    rect(ctx, -98, 35, 196, 9, 4, hc ? '#000' : '#5a3a22');
    [-90, -30, 30, 90].forEach(x => { circulo(ctx, x, -40, 6, hc ? '#000' : '#4a2e1a'); circulo(ctx, x, 40, 6, hc ? '#000' : '#4a2e1a'); });
    ctx.restore();

    // 12. cercas de madera
    M.CERCAS.forEach(tramo => {
      for (let k = 0; k < tramo.length - 1; k++) {
        const [x1, y1] = tramo[k], [x2, y2] = tramo[k + 1];
        const largo = Math.hypot(x2 - x1, y2 - y1);
        if (!dentro(Math.min(x1, x2), Math.min(y1, y2), largo + 40) ) continue;
        linea(ctx, [[x1 + 4, y1 + 4], [x2 + 4, y2 + 4]], 4, 'rgba(0,0,0,.14)');
        linea(ctx, [[x1, y1 - 14], [x2, y2 - 14]], 3, hc ? '#000' : '#9c6f45');
        linea(ctx, [[x1, y1 - 6], [x2, y2 - 6]], 3, hc ? '#000' : '#9c6f45');
        const n = Math.max(1, Math.round(largo / 46));
        for (let j = 0; j <= n; j++) {
          const x = x1 + (x2 - x1) * j / n, y = y1 + (y2 - y1) * j / n;
          rect(ctx, x - 3, y - 20, 6, 22, 2, hc ? '#000' : '#7a5232');
          elipse(ctx, x, y - 20, 3, 1.6, hc ? '#000' : '#b08458');
        }
      }
    });

    // 13. claros de las estaciones
    M.ESTACIONES.forEach((e, i) => {
      if (!dentro(e.x, e.y, 200)) return;
      const c = colores[i];
      const R0 = M.RADIO_CLARO;
      if (!hc) mancha(ctx, e.x, e.y, R0 + 70, c, 0.4);
      circulo(ctx, e.x, e.y, R0, null);
      ctx.fillStyle = hc ? mezclar(c, '#ffffff', 0.35) : rgba(mezclar(c, '#fff6df', 0.42), 0.9); ctx.fill();
      ctx.lineWidth = hc ? 12 : 8; ctx.strokeStyle = hc ? '#000' : c; ctx.stroke();
      ctx.beginPath(); ctx.arc(e.x, e.y, R0 - 14, 0, TAU);
      ctx.setLineDash([10, 12]); ctx.lineWidth = 3; ctx.strokeStyle = hc ? '#000' : 'rgba(255,255,255,.75)'; ctx.stroke(); ctx.setLineDash([]);
      if (!hc) for (let k = 0; k < 14; k++) { const a = k * TAU / 14 + i; elipse(ctx, e.x + Math.cos(a) * (R0 + 10), e.y + Math.sin(a) * (R0 + 10), 6, 4, k % 2 ? '#a9a395' : '#c4bfb2'); }
    });

    // 14. marco de mapa del tesoro y rosa de los vientos
    ctx.lineWidth = 10; ctx.strokeStyle = hc ? '#000' : 'rgba(92,60,30,.55)'; ctx.strokeRect(12, 12, M.ANCHO - 24, M.ALTO - 24);
    ctx.lineWidth = 3; ctx.strokeStyle = hc ? '#000' : 'rgba(92,60,30,.35)'; ctx.strokeRect(30, 30, M.ANCHO - 60, M.ALTO - 60);
    if (dentro(3030, 2830, 150)) {
      ctx.save(); ctx.translate(3040, 2840);
      circulo(ctx, 0, 0, 74, hc ? '#fff' : 'rgba(250,240,210,.75)'); ctx.lineWidth = 4; ctx.strokeStyle = hc ? '#000' : '#7a5232'; ctx.stroke();
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        poligono(ctx, [[0, -64], [12, 0], [0, 8], [-12, 0]], k === 3 ? (hc ? '#000' : '#c0562f') : (hc ? '#555' : '#7a5232'));
      }
      ctx.fillStyle = hc ? '#000' : '#5a3a22'; ctx.font = `800 30px ${fuente}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', 0, -92);
      ctx.restore();
    }
  }

  window.GU_DIBUJOS = {
    lienzo, contorno, mezclar, oscuro, claro, rgba,
    avatar, APARIENCIA_BASE, rosa, julian, tita, rita, cuqui, tomas,
    arbol, arbusto, frailejon, pajon, hierba, junco, helecho, flor, roca, piedraParada, vasija, piedraSol, maiz, papa,
    casa, vaca, oveja, nube, pajaro, onda, destello, bolaSuave, sombra,
    anillo, marcador, chulo, burbuja, flecha, medirLetrero, letrero, semilla, suelo,
  };
})();
