/*
 * Guardianes de Usme · Cuento de lado · dibujos
 *
 * Todo el mundo se dibuja aquí con Canvas 2D (sin imágenes externas) y se
 * convierte en texturas de Phaser. El estilo es de papel recortado: formas
 * planas con bordes suaves y una sombrita debajo de cada figura.
 *
 * Cada figura se dibuja en «unidades del mundo» con el origen en los pies
 * (0, 0) y la y hacia arriba en negativo. La textura se genera a S píxeles
 * por unidad para que se vea nítida cuando la cámara se acerca.
 *
 * Con alto contraste las figuras se vuelven a dibujar con un contorno oscuro
 * grueso alrededor de toda la silueta.
 */
(function () {
  const TINTA = '#1d140d';
  const D = { S: 2, contraste: false };
  const registro = new Map();   // clave → función para redibujar (alto contraste)

  /* ---------- color ---------- */

  function rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const hex = ([r, g, b]) => '#' + hex2(r) + hex2(g) + hex2(b);
  function mezclar(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }
  // k > 0 aclara hacia blanco, k < 0 oscurece hacia negro
  const tono = (c, k) => k >= 0 ? mezclar(c, '#ffffff', k) : mezclar(c, '#000000', -k);
  const aNum = c => parseInt(c.replace('#', ''), 16);
  D.color = { rgb, hex, mezclar, tono, aNum };

  // números pseudoaleatorios repetibles: el mundo sale igual cada vez
  D.azar = function (semilla) {
    let a = semilla >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  /* ---------- primitivas ---------- */

  function lienzo(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function rellenar(o, color, trazo) {
    o.beginPath(); trazo(o); o.fillStyle = color; o.fill();
  }
  function circ(o, x, y, r, color) { rellenar(o, color, c => c.arc(x, y, r, 0, Math.PI * 2)); }
  function elip(o, x, y, rx, ry, color, rot = 0) { rellenar(o, color, c => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)); }
  function linea(o, pts, color, ancho, tapa = 'round') {
    o.beginPath(); o.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) o.lineTo(pts[i], pts[i + 1]);
    o.strokeStyle = color; o.lineWidth = ancho; o.lineCap = tapa; o.lineJoin = 'round'; o.stroke();
  }
  function curva(o, x0, y0, cx, cy, x1, y1, color, ancho) {
    o.beginPath(); o.moveTo(x0, y0); o.quadraticCurveTo(cx, cy, x1, y1);
    o.strokeStyle = color; o.lineWidth = ancho; o.lineCap = 'round'; o.stroke();
  }
  function poli(o, pts, color) {
    rellenar(o, color, c => { c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); });
  }
  function rrect(o, x, y, w, h, r, color) {
    rellenar(o, color, c => {
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    });
  }
  // sombra suave en el piso
  function sombraPiso(o, rx, ry = rx * 0.18) {
    o.save(); o.globalAlpha = 0.18; elip(o, 0, 0, rx, ry, '#2b1d10'); o.restore();
  }
  D.prim = { circ, elip, linea, curva, poli, rrect, rellenar, lienzo };

  /* ---------- hojas de cuadros (texturas) ---------- */

  // Junta el cuadro dibujado en «off» sobre la textura: con sombra de papel
  // recortado o, en alto contraste, con contorno oscuro alrededor.
  // (La sombra se hace con una copia oscura desplazada, sin desenfoque: así es
  // muy rápido de generar incluso en computadores viejos, y parece papel recortado.)
  let silueta = null;
  function siluetaDe(off, color) {
    if (!silueta || silueta.width !== off.width || silueta.height !== off.height) silueta = lienzo(off.width, off.height);
    const tc = silueta.getContext('2d');
    tc.globalCompositeOperation = 'copy';
    tc.drawImage(off, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = color; tc.fillRect(0, 0, silueta.width, silueta.height);
    tc.globalCompositeOperation = 'source-over';
    return silueta;
  }
  function componer(ctx, off, dx, opc, S) {
    const borde = D.contraste && opc.borde !== false;
    if (borde) {
      const r = (opc.grosor || 2.4) * S;
      const s = siluetaDe(off, TINTA);
      ctx.save();
      ctx.beginPath(); ctx.rect(dx, 0, off.width, off.height); ctx.clip();
      for (let a = 0; a < 12; a++) ctx.drawImage(s, dx + Math.cos(a * Math.PI / 6) * r, Math.sin(a * Math.PI / 6) * r);
      ctx.restore();
      ctx.drawImage(off, dx, 0);
    } else if (opc.sombra === false) {
      ctx.drawImage(off, dx, 0);
    } else {
      const s = siluetaDe(off, '#3c230f');
      ctx.save();
      ctx.globalAlpha = 0.13; ctx.drawImage(s, dx + 0.6 * S, 3.2 * S);
      ctx.globalAlpha = 0.16; ctx.drawImage(s, dx + 0.4 * S, 1.8 * S);
      ctx.restore();
      ctx.drawImage(off, dx, 0);
    }
  }

  /*
   * Crea (o redibuja) una textura con n cuadros de fw × fh unidades.
   * dibujar(o, i) pinta el cuadro i con el origen en (fw/2, fh - pie).
   * Devuelve { clave, oy } con oy = origen vertical para setOrigin(0.5, oy).
   */
  D.hoja = function (escena, clave, fw, fh, n, dibujar, opc = {}) {
    const S = opc.S || D.S, pie = opc.pie ?? 6;
    const pw = Math.ceil(fw * S), ph = Math.ceil(fh * S);
    let tex = escena.textures.exists(clave) ? escena.textures.get(clave) : null;
    if (!tex) {
      tex = escena.textures.createCanvas(clave, pw * n, ph);
      for (let i = 0; i < n; i++) tex.add(String(i), 0, i * pw, 0, pw, ph);
    }
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, pw * n, ph);
    const off = lienzo(pw, ph), o = off.getContext('2d');
    for (let i = 0; i < n; i++) {
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, pw, ph);
      o.setTransform(S, 0, 0, S, (fw / 2) * S, (fh - pie) * S);
      dibujar(o, i);
      componer(ctx, off, i * pw, opc, S);
    }
    tex.refresh();
    registro.set(clave, () => D.hoja(escena, clave, fw, fh, n, dibujar, opc));
    return { clave, oy: (fh - pie) / fh, S, fw, fh };
  };

  // Vuelve a dibujar todo lo que tiene contorno (al cambiar el alto contraste)
  D.redibujar = function (contraste) {
    D.contraste = contraste;
    registro.forEach(f => f());
  };

  /* ---------- personajes ---------- */

  const PIEL = { rosa: '#a8704a', julian: '#8d5a3b', nina: '#b97c55', nino: '#8f5b3c', silla: '#c08a62' };

  function ojos(o, x, y, sep, parpadeo, color = '#2a1a10', r = 2.3) {
    if (parpadeo) {
      linea(o, [x - 2.5, y, x + 2.5, y], color, 1.6);
      linea(o, [x - sep - 2.2, y, x - sep + 2.2, y], color, 1.6);
    } else {
      circ(o, x, y, r, color); circ(o, x - sep, y, r * 0.92, color);
      circ(o, x + 0.8, y - 0.9, r * 0.38, '#fff'); circ(o, x - sep + 0.8, y - 0.9, r * 0.34, '#fff');
    }
  }
  function mejillas(o, x, y, sep, r = 3.2) {
    o.save(); o.globalAlpha = 0.35; circ(o, x, y, r, '#e8735c'); circ(o, x - sep, y, r * 0.9, '#e8735c'); o.restore();
  }

  // Ruana: el poncho campesino de lana, con franjas y flecos
  function ruana(o, cx, top, anchoArriba, anchoAbajo, alto, color, franja) {
    const fr = franja || tono(color, 0.35);
    const izq = cx - anchoAbajo, der = cx + anchoAbajo;
    rellenar(o, color, c => {
      c.moveTo(cx - anchoArriba, top + 4);
      c.quadraticCurveTo(cx, top - 3, cx + anchoArriba, top + 4);
      c.lineTo(der, top + alto - 3);
      c.quadraticCurveTo(cx, top + alto + 4, izq, top + alto - 3);
      c.closePath();
    });
    o.save();
    o.beginPath();
    o.moveTo(cx - anchoArriba, top + 4); o.quadraticCurveTo(cx, top - 3, cx + anchoArriba, top + 4);
    o.lineTo(der, top + alto - 3); o.quadraticCurveTo(cx, top + alto + 4, izq, top + alto - 3); o.closePath();
    o.clip();
    o.fillStyle = fr;
    o.fillRect(cx - 60, top + alto * 0.62, 120, alto * 0.08);
    o.fillRect(cx - 60, top + alto * 0.76, 120, alto * 0.05);
    o.fillStyle = tono(color, -0.18);
    o.fillRect(cx - 60, top + alto * 0.70, 120, alto * 0.04);
    o.globalAlpha = 0.18; o.fillStyle = '#000';
    o.fillRect(cx + anchoArriba * 0.15, top, 60, alto + 6);
    o.restore();
    // flecos
    o.strokeStyle = tono(color, -0.1); o.lineWidth = 1.2;
    for (let x = izq + 3; x < der - 2; x += 3.2) {
      const t = (x - cx) / anchoAbajo, yb = top + alto - 3 + (1 - t * t) * 3.5;
      o.beginPath(); o.moveTo(x, yb - 1); o.lineTo(x, yb + 3.5); o.stroke();
    }
  }

  // Niña o niño caminando. cuadro 0 quieto, 1 parpadeo, 2-5 pasos
  function nino(o, i, tipo, colorRuana) {
    const piel = PIEL[tipo];
    const camina = i >= 2, fase = camina ? (i - 2) / 4 * Math.PI * 2 : 0;
    const salto = camina ? -Math.abs(Math.sin(fase)) * 2.5 : 0;
    const pierna = camina ? Math.sin(fase) * 0.5 : 0;
    sombraPiso(o, 22);
    o.save(); o.translate(0, salto);
    const cadera = -46;
    const pantalon = tipo === 'nina' ? '#4b3f73' : '#34507a';
    const zapato = tipo === 'nina' ? '#d9534f' : '#e8b33c';
    const pie = (ang, oscuro) => {
      const x1 = Math.sin(ang) * 40, y1 = cadera + Math.cos(ang) * 40;
      const col = oscuro ? tono(pantalon, -0.25) : pantalon;
      linea(o, [0, cadera, x1, y1], col, 10);
      rrect(o, x1 - 5, y1 - 4, 14, 7, 3.5, oscuro ? tono(zapato, -0.25) : zapato);
      rrect(o, x1 - 5, y1 + 1, 14, 2.5, 1.2, '#f4ede0');
    };
    pie(-pierna, true);
    pie(pierna, false);
    // manos que se balancean bajo la ruana
    const brazo = camina ? Math.sin(fase) * 5 : 0;
    circ(o, -22 - brazo * 0.6, -55, 4.5, tono(piel, -0.15));
    // cuerpo con ruana
    ruana(o, 0, -88, 14, 27, 44, colorRuana);
    circ(o, 22 + brazo * 0.6, -55, 4.8, piel);
    // cuello
    rrect(o, -5, -92, 10, 8, 3, tono(piel, -0.1));
    // cabeza
    const hx = 2, hy = -106;
    if (tipo === 'nina') {
      // trenzas detrás
      linea(o, [hx - 12, hy + 2, hx - 16, hy + 26], '#2e1d14', 6.5);
      circ(o, hx - 16, hy + 28, 3.5, '#c0392b');
    }
    circ(o, hx, hy, 17, piel);
    // oreja
    circ(o, hx - 6, hy + 2, 3.6, tono(piel, -0.12));
    // pelo
    if (tipo === 'nina') {
      rellenar(o, '#2e1d14', c => {
        c.moveTo(hx - 17, hy + 4); c.quadraticCurveTo(hx - 19, hy - 20, hx + 2, hy - 19);
        c.quadraticCurveTo(hx + 18, hy - 17, hx + 17, hy - 4);
        c.quadraticCurveTo(hx + 8, hy - 12, hx - 2, hy - 9);
        c.quadraticCurveTo(hx - 8, hy - 4, hx - 9, hy + 6); c.closePath();
      });
      circ(o, hx - 4, hy - 18, 4, '#f2c14e'); // hebilla
    } else {
      rellenar(o, '#24160e', c => {
        c.moveTo(hx - 17, hy + 2); c.quadraticCurveTo(hx - 18, hy - 19, hx + 1, hy - 19);
        c.quadraticCurveTo(hx + 17, hy - 18, hx + 17, hy - 6);
        c.lineTo(hx + 11, hy - 9); c.lineTo(hx + 6, hy - 6); c.lineTo(hx + 1, hy - 10);
        c.quadraticCurveTo(hx - 7, hy - 4, hx - 9, hy + 4); c.closePath();
      });
      linea(o, [hx + 2, hy - 18, hx + 5, hy - 23], '#24160e', 3);
    }
    ojos(o, hx + 10, hy - 1, 7.5, i === 1);
    mejillas(o, hx + 12, hy + 5, 9);
    curva(o, hx + 6, hy + 8, hx + 10, hy + 11, hx + 13, hy + 7, '#6b2e1f', 1.6);
    o.restore();
  }

  // Persona en silla de ruedas: cuerpo y silla (sin la rueda grande ni el brazo cercano)
  function sillaCuerpo(o, i, colorRuana) {
    const piel = PIEL.silla;
    sombraPiso(o, 34);
    const metal = '#55606e', asiento = '#2f3640';
    // respaldo y manubrio
    linea(o, [-24, -34, -27, -86, -36, -88], metal, 4);
    rrect(o, -29, -82, 8, 40, 3, asiento);
    // asiento y estructura
    linea(o, [-26, -40, 16, -40], metal, 4);
    rrect(o, -24, -46, 38, 7, 3, asiento);
    linea(o, [14, -40, 22, -10, 32, -10], metal, 3.5);
    linea(o, [-6, -40, 20, -12], metal, 2.5);
    // piernas: muslo horizontal y canilla hacia abajo
    linea(o, [-12, -48, 16, -48], '#3e4a74', 11);
    linea(o, [16, -48, 24, -16], '#3e4a74', 10);
    rrect(o, 19, -17, 16, 7, 3.5, '#2a9d8f');
    rrect(o, 19, -12, 16, 2.5, 1.2, '#f4ede0');
    // cuerpo con ruana
    ruana(o, -8, -84, 13, 24, 42, colorRuana);
    rrect(o, -13, -88, 10, 8, 3, tono(piel, -0.1));
    const hx = -6, hy = -102;
    circ(o, hx, hy, 16.5, piel);
    circ(o, hx - 6, hy + 2, 3.5, tono(piel, -0.12));
    // pelo crespo
    o.fillStyle = '#3a2416';
    [[-14, -6], [-10, -14], [-2, -17], [6, -15], [12, -10], [-16, 2]].forEach(([dx, dy]) => {
      o.beginPath(); o.arc(hx + dx, hy + dy, 7, 0, Math.PI * 2); o.fill();
    });
    ojos(o, hx + 10, hy - 1, 7.5, i === 1);
    mejillas(o, hx + 11, hy + 5, 9);
    curva(o, hx + 6, hy + 8, hx + 10, hy + 11, hx + 13, hy + 7, '#6b2e1f', 1.6);
  }
  // Rueda grande con rayos (gira al avanzar)
  function ruedaGrande(o) {
    const R = 30;
    circ(o, 0, 0, R, '#2b2f36');
    circ(o, 0, 0, R - 5, '#e9eef2');
    o.save(); o.globalAlpha = 0.25; circ(o, 0, 0, R - 5, '#9fb3c8'); o.restore();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      linea(o, [0, 0, Math.cos(a) * (R - 5), Math.sin(a) * (R - 5)], '#7d8794', 1.6);
    }
    o.beginPath(); o.arc(0, 0, R - 9, 0, Math.PI * 2); o.strokeStyle = '#a7b0ba'; o.lineWidth = 2.4; o.stroke();
    circ(o, 0, 0, 5, '#55606e'); circ(o, 0, 0, 2, '#d0d6dc');
    // marca de color para que se note el giro
    circ(o, Math.cos(-0.6) * (R - 2.5), Math.sin(-0.6) * (R - 2.5), 2.2, '#f2c14e');
  }
  function ruedita(o) {
    circ(o, 0, 0, 8, '#2b2f36'); circ(o, 0, 0, 4, '#a7b0ba');
    linea(o, [-4, 0, 4, 0], '#55606e', 1.5);
  }
  // Brazo que empuja la rueda: cuadro 0 quieto, 1 adelante, 2 atrás
  function sillaBrazo(o, i, colorRuana) {
    const piel = PIEL.silla;
    const ax = -10, ay = -30, R = 25;
    const ang = [-1.75, -1.15, -2.3][i];
    const mx = ax + Math.cos(ang) * R, my = ay + Math.sin(ang) * R;
    const hx = -4, hy = -76;
    const cx = (hx + mx) / 2 + 6, cy = (hy + my) / 2;
    o.beginPath(); o.moveTo(hx, hy); o.quadraticCurveTo(cx, cy, mx, my);
    o.strokeStyle = tono(colorRuana, -0.08); o.lineWidth = 8; o.lineCap = 'round'; o.stroke();
    circ(o, mx, my, 4.8, piel);
  }

  // Doña Rosa: sabedora campesina con sombrero y ruana
  function rosa(o, i) {
    const piel = PIEL.rosa;
    sombraPiso(o, 30);
    // falda larga
    rellenar(o, '#2f3b5c', c => { c.moveTo(-16, -62); c.lineTo(16, -62); c.lineTo(22, -6); c.quadraticCurveTo(0, -1, -22, -6); c.closePath(); });
    o.save(); o.globalAlpha = 0.35; linea(o, [-20, -16, 20, -16], '#c9a227', 2.5); o.restore();
    // alpargatas
    rrect(o, -14, -7, 13, 6, 3, '#e9dcc0'); rrect(o, 3, -7, 14, 6, 3, '#e9dcc0');
    // ruana
    ruana(o, 0, -104, 16, 31, 52, '#8c3b2a', '#e6c89a');
    // blusa en el cuello
    rellenar(o, '#f6f0e4', c => { c.moveTo(-9, -104); c.lineTo(9, -104); c.lineTo(0, -95); c.closePath(); });
    // manos juntas adelante
    circ(o, 24, -66, 5, piel);
    rrect(o, -5, -110, 10, 8, 3, tono(piel, -0.1));
    const hx = 1, hy = -124;
    // trenzas canosas
    linea(o, [hx - 12, hy + 4, hx - 14, hy + 30], '#c9c3b8', 6);
    circ(o, hx - 14, hy + 31, 3, '#c0562f');
    circ(o, hx, hy, 16.5, piel);
    circ(o, hx - 6, hy + 2, 3.5, tono(piel, -0.12));
    rellenar(o, '#d8d2c6', c => { c.moveTo(hx - 16, hy + 2); c.quadraticCurveTo(hx - 15, hy - 14, hx + 6, hy - 13); c.quadraticCurveTo(hx + 15, hy - 11, hx + 16, hy - 4); c.quadraticCurveTo(hx + 3, hy - 9, hx - 8, hy + 6); c.closePath(); });
    // sombrero
    elip(o, hx, hy - 13, 27, 5.5, '#2b2420');
    rellenar(o, '#3a312b', c => { c.moveTo(hx - 13, hy - 14); c.quadraticCurveTo(hx - 13, hy - 31, hx, hy - 31); c.quadraticCurveTo(hx + 13, hy - 31, hx + 13, hy - 14); c.closePath(); });
    rrect(o, hx - 13, hy - 19, 26, 4, 1.5, '#c0562f');
    ojos(o, hx + 9, hy - 1, 7, i === 1);
    // arruguitas y sonrisa
    linea(o, [hx + 13, hy - 4, hx + 15, hy - 5], '#7a4a30', 1);
    mejillas(o, hx + 11, hy + 5, 9);
    curva(o, hx + 5, hy + 8, hx + 9, hy + 12, hx + 13, hy + 7, '#6b2e1f', 1.7);
  }

  // Julián, el arqueólogo: sombrero, chaleco y brocha
  function julian(o, i) {
    const piel = PIEL.julian;
    sombraPiso(o, 28);
    // botas y pantalón
    rrect(o, -14, -9, 14, 9, 3, '#4a3424'); rrect(o, 2, -9, 15, 9, 3, '#4a3424');
    rrect(o, -12, -58, 11, 52, 4, '#8a6a46'); rrect(o, 1, -58, 11, 52, 4, '#7d5f3f');
    // brazo de atrás
    linea(o, [-12, -98, -18, -66], '#3f6f9e', 9);
    circ(o, -18, -63, 4.5, tono(piel, -0.15));
    // camisa y chaleco
    rrect(o, -15, -104, 30, 50, 8, '#4f86b8');
    rellenar(o, '#6b7a3c', c => { c.moveTo(-15, -100); c.lineTo(-3, -100); c.lineTo(-2, -56); c.lineTo(-15, -56); c.closePath(); });
    rellenar(o, '#6b7a3c', c => { c.moveTo(3, -100); c.lineTo(15, -100); c.lineTo(15, -56); c.lineTo(2, -56); c.closePath(); });
    rrect(o, -13, -80, 9, 8, 2, '#5a6832'); rrect(o, 5, -80, 9, 8, 2, '#5a6832');
    rrect(o, 6, -96, 7, 6, 2, '#5a6832');
    // brazo de adelante con brocha
    const br = i === 2 ? 0.35 : 0;
    const mx = 26 + Math.sin(br) * 6, my = -72 - Math.cos(br) * 6;
    linea(o, [11, -98, 20, -80, mx, my], '#4f86b8', 9);
    circ(o, mx, my, 4.8, piel);
    o.save(); o.translate(mx, my); o.rotate(-0.5 + br);
    rrect(o, -1.5, -20, 3.5, 18, 1.5, '#9a6b3c');
    rrect(o, -4, -30, 8, 11, 2, '#e8d7a8');
    o.restore();
    rrect(o, -5, -110, 10, 8, 3, tono(piel, -0.1));
    const hx = 2, hy = -124;
    circ(o, hx, hy, 16.5, piel);
    circ(o, hx - 6, hy + 2, 3.5, tono(piel, -0.12));
    // barba corta
    rellenar(o, '#2b1b12', c => { c.moveTo(hx - 8, hy + 6); c.quadraticCurveTo(hx + 4, hy + 20, hx + 16, hy + 5); c.quadraticCurveTo(hx + 8, hy + 13, hx - 2, hy + 8); c.closePath(); });
    // sombrero de ala
    elip(o, hx, hy - 12, 26, 5, '#b89a62');
    rellenar(o, '#cdb07a', c => { c.moveTo(hx - 14, hy - 13); c.quadraticCurveTo(hx - 12, hy - 29, hx, hy - 29); c.quadraticCurveTo(hx + 12, hy - 29, hx + 14, hy - 13); c.closePath(); });
    rrect(o, hx - 14, hy - 18, 28, 4, 1.5, '#6d4f2c');
    ojos(o, hx + 9, hy - 2, 7, i === 1);
    curva(o, hx + 6, hy + 6, hx + 10, hy + 9, hx + 13, hy + 5, '#f4e1d0', 1.6);
  }

  // Tita, la tingua bogotana: gris azulada y café, pico largo rojizo, patas largas
  function tita(o, i) {
    sombraPiso(o, 22);
    const pica = i === 2;
    // patas largas
    linea(o, [-4, -38, -8, -1], '#c8573f', 2.6);
    linea(o, [4, -38, 7, -1], '#d0603f', 2.6);
    linea(o, [-15, 0, 0, 0], '#c8573f', 2); linea(o, [-1, 0, 16, 0], '#d0603f', 2);
    // cuerpo
    o.save(); o.translate(0, -50); o.rotate(pica ? 0.35 : -0.08);
    elip(o, -4, 0, 25, 15, '#6d5a43');
    // rayas del lomo
    o.strokeStyle = '#3f3226'; o.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) { o.beginPath(); o.moveTo(-22 + k * 6, -6); o.lineTo(-17 + k * 6, -11); o.stroke(); }
    elip(o, 6, 4, 18, 11, '#6f8aa3');
    // cola corta levantada
    poli(o, [-26, -4, -38, -12, -34, 2], '#5b4a37');
    // ala con franjas
    o.save(); o.globalAlpha = 0.9;
    rellenar(o, '#56483a', c => c.ellipse(-8, -1, 15, 8, -0.1, 0, Math.PI * 2));
    o.strokeStyle = '#f0e6d2'; o.lineWidth = 1.1;
    for (let k = 0; k < 3; k++) { o.beginPath(); o.moveTo(-18 + k * 6, 4); o.lineTo(-13 + k * 6, -2); o.stroke(); }
    o.restore();
    // cuello y cabeza
    const cx = pica ? 22 : 18, cy = pica ? 6 : -14;
    linea(o, [12, -2, cx, cy], '#6f8aa3', 10);
    circ(o, cx + 2, cy - 3, 8, '#7590a8');
    rellenar(o, '#5d4a38', c => c.arc(cx + 2, cy - 5, 8, Math.PI, Math.PI * 2));
    // pico largo y rojizo
    rellenar(o, '#d04a32', c => { c.moveTo(cx + 8, cy - 5); c.quadraticCurveTo(cx + 22, cy - 2, cx + 29, cy + 4); c.quadraticCurveTo(cx + 20, cy + 1, cx + 8, cy); c.closePath(); });
    if (i === 1) linea(o, [cx + 2, cy - 4, cx + 6, cy - 4], '#2a1a10', 1.4);
    else { circ(o, cx + 4, cy - 4, 2.4, '#b53a2a'); circ(o, cx + 4.3, cy - 4.3, 1.1, '#1a0f0a'); }
    o.restore();
  }

  // Rita, la rana sabanera (verde, con línea clara en el labio). 0 sentada, 1 parpadeo, 2 salto
  function rita(o, i) {
    const verde = '#4fa83c', oscuro = '#3a7f2d', claro = '#cfe9a6';
    if (i === 2) {
      // estirada en el aire
      linea(o, [-10, -14, -26, -2, -34, 4], oscuro, 6);
      linea(o, [-6, -12, -18, 4, -24, 10], oscuro, 6);
      elip(o, 0, -22, 20, 12, verde, -0.25);
      elip(o, 4, -18, 12, 6, claro, -0.25);
      linea(o, [14, -16, 22, -4], verde, 4.5);
      circ(o, 12, -34, 7, verde); circ(o, 12, -34, 4.5, '#f2d14e'); circ(o, 13, -34, 2.2, '#1a0f0a');
      linea(o, [8, -24, 22, -22], '#f6f2d8', 2);
      return;
    }
    // patas traseras dobladas
    elip(o, -14, -8, 13, 8, oscuro);
    elip(o, -6, -2, 12, 3.5, oscuro);
    // cuerpo
    rellenar(o, verde, c => { c.moveTo(-22, -6); c.quadraticCurveTo(-20, -34, 4, -34); c.quadraticCurveTo(24, -32, 24, -14); c.quadraticCurveTo(22, -2, 6, -2); c.lineTo(-14, -2); c.closePath(); });
    elip(o, 8, -9, 13, 6.5, claro);
    // manchitas
    circ(o, -8, -24, 2.4, oscuro); circ(o, -14, -16, 1.8, oscuro); circ(o, -2, -28, 1.6, oscuro);
    // pata delantera
    linea(o, [12, -14, 16, -1], verde, 5);
    elip(o, 18, -1, 5, 2.2, oscuro);
    // ojos grandes dorados
    circ(o, 10, -34, 8, verde);
    circ(o, 10, -35, 5.5, '#f2d14e');
    if (i === 1) linea(o, [5, -35, 15, -35], '#1a0f0a', 2);
    else { elip(o, 10.5, -35, 3.2, 2.2, '#1a0f0a'); circ(o, 11.5, -36, 1, '#fff'); }
    // línea del labio y sonrisa
    curva(o, 2, -22, 13, -18, 23, -20, '#f6f2d8', 2.2);
  }
  function rocaMusgo(o) {
    rellenar(o, '#8a8f88', c => { c.moveTo(-46, 0); c.quadraticCurveTo(-44, -30, -12, -36); c.quadraticCurveTo(26, -40, 44, -18); c.quadraticCurveTo(50, -4, 44, 0); c.closePath(); });
    rellenar(o, '#6f746e', c => { c.moveTo(10, -36); c.quadraticCurveTo(40, -34, 44, -10); c.lineTo(44, 0); c.lineTo(18, 0); c.closePath(); });
    rellenar(o, '#6aa84f', c => { c.moveTo(-40, -18); c.quadraticCurveTo(-30, -38, 0, -38); c.quadraticCurveTo(30, -38, 40, -22); c.quadraticCurveTo(20, -28, 4, -26); c.quadraticCurveTo(-20, -24, -40, -18); });
    o.fillStyle = '#86c06a';
    for (let k = 0; k < 8; k++) { o.beginPath(); o.arc(-30 + k * 9, -32 + Math.sin(k) * 3, 4, 0, Math.PI * 2); o.fill(); }
  }

  // Cuqui, el curí: café, redondito. 0, 1 parpadeo, 2 mordisquea
  function cuqui(o, i) {
    sombraPiso(o, 28);
    const cafe = '#a5703a', crema = '#f1dcb4';
    rellenar(o, cafe, c => { c.moveTo(-30, -4); c.quadraticCurveTo(-34, -38, -2, -40); c.quadraticCurveTo(28, -40, 32, -16); c.quadraticCurveTo(34, -2, 20, -2); c.lineTo(-24, -2); c.closePath(); });
    // manchas
    elip(o, -14, -26, 10, 8, crema, -0.3);
    elip(o, 10, -10, 13, 7, crema);
    elip(o, -6, -34, 7, 4, '#6b4320');
    // patitas
    elip(o, -18, -2, 6, 3, '#d99c8a'); elip(o, 16, -2, 6, 3, '#d99c8a');
    // orejitas
    elip(o, 12, -38, 6, 4.5, '#d08a6a', -0.4);
    elip(o, 12, -38, 3.6, 2.6, '#f0b9a0', -0.4);
    // cara
    const n = i === 2 ? 1.5 : 0;
    if (i === 1) linea(o, [18, -26, 23, -26], '#1a0f0a', 1.8);
    else { circ(o, 21, -26, 3.2, '#1a0f0a'); circ(o, 22, -27, 1.1, '#fff'); }
    circ(o, 31 + n, -17, 3, '#e98a8a');
    o.strokeStyle = '#5a3a20'; o.lineWidth = 0.9;
    [[-4], [0], [4]].forEach(([d]) => { o.beginPath(); o.moveTo(30, -15 + d * 0.3); o.lineTo(42 + n, -18 + d); o.stroke(); });
    if (i === 2) { elip(o, 34, -10, 6, 3, '#6fae4f', 0.4); }
    mejillas(o, 24, -18, 0, 3);
  }
  function monticulo(o) {
    rellenar(o, '#c9a85a', c => { c.moveTo(-44, 0); c.quadraticCurveTo(0, -16, 44, 0); c.closePath(); });
    o.strokeStyle = '#e0c47a'; o.lineWidth = 1.4;
    for (let k = 0; k < 14; k++) { const x = -38 + k * 5.8; o.beginPath(); o.moveTo(x, -2); o.lineTo(x + 3, -9 - (k % 3) * 2); o.stroke(); }
  }

  // Tomás, el oso de anteojos: negro con manchas crema alrededor de los ojos. 2 saluda
  function tomas(o, i) {
    sombraPiso(o, 32);
    const negro = '#2a2420', crema = '#ead9b0';
    // patas
    rrect(o, -20, -30, 16, 30, 7, negro); rrect(o, 4, -30, 16, 30, 7, negro);
    // cuerpo
    elip(o, 0, -58, 30, 36, negro);
    // pecho crema
    rellenar(o, crema, c => { c.moveTo(-10, -82); c.quadraticCurveTo(0, -70, 12, -82); c.quadraticCurveTo(8, -66, 0, -60); c.quadraticCurveTo(-8, -66, -10, -82); });
    // brazos
    linea(o, [-22, -74, -28, -48], negro, 13);
    if (i === 2) { linea(o, [20, -78, 34, -100], negro, 13); elip(o, 36, -104, 7, 6, '#3a322c'); }
    else linea(o, [22, -74, 28, -48], negro, 13);
    // cabeza
    const hx = 3, hy = -100;
    circ(o, hx - 14, hy - 14, 7, negro); circ(o, hx + 14, hy - 14, 7, negro);
    circ(o, hx - 14, hy - 14, 3.5, '#4a3f37'); circ(o, hx + 14, hy - 14, 3.5, '#4a3f37');
    circ(o, hx, hy, 20, negro);
    // anteojos: manchas crema alrededor de los ojos
    rellenar(o, crema, c => { c.ellipse(hx - 7, hy - 3, 6.5, 7.5, -0.4, 0, Math.PI * 2); });
    rellenar(o, crema, c => { c.ellipse(hx + 9, hy - 3, 6.5, 7.5, 0.4, 0, Math.PI * 2); });
    rellenar(o, crema, c => { c.moveTo(hx - 4, hy + 4); c.quadraticCurveTo(hx + 2, hy - 2, hx + 7, hy + 4); c.lineTo(hx + 5, hy + 14); c.lineTo(hx - 2, hy + 14); c.closePath(); });
    // hocico
    elip(o, hx + 2, hy + 10, 9, 7, '#8a6a4a');
    elip(o, hx + 3, hy + 6, 4, 2.8, '#1a120e');
    curva(o, hx - 1, hy + 13, hx + 2, hy + 15, hx + 6, hy + 13, '#1a120e', 1.4);
    if (i === 1) { linea(o, [hx - 9, hy - 3, hx - 5, hy - 3], '#1a120e', 1.6); linea(o, [hx + 7, hy - 3, hx + 11, hy - 3], '#1a120e', 1.6); }
    else { circ(o, hx - 7, hy - 3, 2.6, '#1a120e'); circ(o, hx + 9, hy - 3, 2.6, '#1a120e'); circ(o, hx - 6.2, hy - 3.8, 0.9, '#fff'); circ(o, hx + 9.8, hy - 3.8, 0.9, '#fff'); }
  }

  /* ---------- casa, cerca, árboles y plantas ---------- */

  function casa(o) {
    sombraPiso(o, 150, 12);
    const muro = '#f6f1e6';
    // muro con zócalo
    rrect(o, -120, -120, 240, 120, 3, muro);
    rrect(o, -120, -26, 240, 26, 2, '#c98f5a');
    o.save(); o.globalAlpha = 0.08; rrect(o, 20, -120, 100, 120, 2, '#7a5a3a'); o.restore();
    // corredor con postes de madera
    [-104, -36, 36, 104].forEach(x => rrect(o, x - 4, -116, 8, 116, 2, '#7a5236'));
    // puerta y ventanas
    rrect(o, -18, -88, 36, 88, 4, '#3d7a7a');
    linea(o, [0, -86, 0, -2], '#2f6262', 1.6);
    circ(o, 12, -44, 2.2, '#e0c060');
    [-78, 70].forEach(x => {
      rrect(o, x - 16, -90, 34, 36, 3, '#3d6fa0');
      rrect(o, x - 12, -86, 26, 28, 2, '#c7e3f2');
      linea(o, [x + 1, -86, x + 1, -58], '#3d6fa0', 2.4);
      rrect(o, x - 20, -54, 42, 9, 3, '#8a5a3a');
      // geranios
      [[-14, -58], [-6, -61], [2, -58], [10, -61], [16, -58]].forEach(([dx, dy], k) => circ(o, x + dx, dy, 4, k % 2 ? '#e8463c' : '#f07070'));
      [[-10, -55], [6, -55]].forEach(([dx, dy]) => circ(o, x + dx, dy, 3, '#4f8a3c'));
    });
    // techo de teja
    rellenar(o, '#a9472b', c => { c.moveTo(-142, -112); c.lineTo(-96, -176); c.lineTo(96, -176); c.lineTo(142, -112); c.closePath(); });
    o.save();
    o.beginPath(); o.moveTo(-142, -112); o.lineTo(-96, -176); o.lineTo(96, -176); o.lineTo(142, -112); o.closePath(); o.clip();
    for (let f = 0; f < 6; f++) {
      const y = -170 + f * 11.5;
      o.fillStyle = f % 2 ? '#bd5a35' : '#c4643c';
      for (let x = -150 + (f % 2) * 7; x < 150; x += 14) { o.beginPath(); o.arc(x, y, 7, 0, Math.PI); o.fill(); }
    }
    o.restore();
    rrect(o, -146, -116, 292, 8, 4, '#8f3a22');
    rrect(o, -98, -180, 196, 7, 3, '#8f3a22');
    // chimenea
    rrect(o, 58, -200, 18, 28, 2, '#e9e0cf');
    rrect(o, 55, -204, 24, 6, 2, '#a9472b');
  }

  function cerca(o) {
    const m = '#8a6240', m2 = '#a07650';
    rrect(o, -64, -44, 128, 7, 3, m2);
    rrect(o, -64, -24, 128, 7, 3, m2);
    [-56, 0, 56].forEach(x => { rrect(o, x - 4.5, -54, 9, 54, 3, m); poli(o, [x - 4.5, -54, x, -60, x + 4.5, -54], m); });
  }

  function copa(o, x, y, r, base, rnd, n = 9) {
    const c1 = tono(base, -0.18), c2 = base, c3 = tono(base, 0.18);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, d = rnd() * r * 0.55;
      circ(o, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 + r * 0.12, r * (0.42 + rnd() * 0.2), c1);
    }
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, d = rnd() * r * 0.45;
      circ(o, x + Math.cos(a) * d - r * 0.05, y + Math.sin(a) * d * 0.6 - r * 0.06, r * (0.36 + rnd() * 0.18), c2);
    }
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 - 0.9 + rnd() * 1.4, d = r * (0.25 + rnd() * 0.3);
      circ(o, x + Math.cos(a) * d - r * 0.12, y + Math.sin(a) * d, r * (0.2 + rnd() * 0.1), c3);
    }
  }

  function arbolGrande(o) {
    const rnd = D.azar(7);
    sombraPiso(o, 90, 10);
    rellenar(o, '#6b4a30', c => { c.moveTo(-16, 0); c.quadraticCurveTo(-10, -60, -14, -120); c.lineTo(12, -120); c.quadraticCurveTo(8, -60, 18, 0); c.closePath(); });
    linea(o, [-6, -110, -60, -168], '#6b4a30', 11);
    linea(o, [6, -116, 54, -176], '#6b4a30', 10);
    linea(o, [-30, -140, -64, -150], '#6b4a30', 6);
    copa(o, -62, -186, 60, '#4f8f3a', rnd);
    copa(o, 56, -196, 62, '#4a8a36', rnd);
    copa(o, 0, -236, 70, '#559640', rnd);
  }
  function arbolRedondo(o, base) {
    const rnd = D.azar(base.length * 13);
    sombraPiso(o, 40, 6);
    rellenar(o, '#6e4e34', c => { c.moveTo(-7, 0); c.lineTo(-4, -70); c.lineTo(5, -70); c.lineTo(8, 0); c.closePath(); });
    copa(o, 0, -110, 52, base, rnd, 8);
  }
  function eucalipto(o) {
    const rnd = D.azar(31);
    sombraPiso(o, 26, 4);
    rellenar(o, '#cfc2a6', c => { c.moveTo(-7, 0); c.quadraticCurveTo(-4, -110, -2, -200); c.lineTo(3, -200); c.quadraticCurveTo(5, -110, 9, 0); c.closePath(); });
    linea(o, [4, -40, 6, -80], '#b3a284', 2);
    linea(o, [0, -120, -26, -160], '#b8a888', 4); linea(o, [1, -105, 26, -148], '#b8a888', 4);
    linea(o, [0, -170, -16, -196], '#b8a888', 3);
    // follaje en racimos sueltos, verde azulado
    [[-28, -162, 24], [28, -150, 22], [-4, -196, 26], [10, -128, 18], [-18, -124, 16], [14, -180, 20]].forEach(([x, y, r]) => copa(o, x, y, r, '#6f9c86', rnd, 5));
  }
  function arbusto(o, base) {
    const rnd = D.azar(base.length * 7 + 3);
    sombraPiso(o, 48, 6);
    copa(o, 0, -30, 42, base, rnd, 7);
  }
  // Árbol del bosque altoandino con musgo colgando (encenillo, gaque)
  function encenillo(o, v) {
    const rnd = D.azar(50 + v * 9);
    sombraPiso(o, 50, 7);
    const tr = '#5a4632';
    rellenar(o, tr, c => { c.moveTo(-10, 0); c.quadraticCurveTo(-16, -50, -4, -90); c.quadraticCurveTo(6, -120, 0, -140); c.lineTo(10, -140); c.quadraticCurveTo(16, -110, 8, -80); c.quadraticCurveTo(2, -40, 12, 0); c.closePath(); });
    linea(o, [-2, -96, -44, -128, -60, -126], tr, 7);
    linea(o, [6, -110, 46, -140, 64, -138], tr, 6);
    // musgo en el tronco
    o.fillStyle = '#8fbf5a';
    for (let k = 0; k < 7; k++) { o.beginPath(); o.arc(-6 + rnd() * 14, -10 - k * 16, 4 + rnd() * 3, 0, Math.PI * 2); o.fill(); }
    const verdes = ['#2f6b3a', '#3b7a40', '#46874a'];
    [[-52, -150, 34], [50, -160, 36], [0, -172, 42], [-20, -140, 26], [26, -146, 28]].forEach(([x, y, r], k) => copa(o, x, y, r, verdes[k % 3], rnd, 6));
    // musgo que cuelga
    o.strokeStyle = '#a8cf6a'; o.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const x = -60 + rnd() * 120, y = -130 + rnd() * 20, l = 14 + rnd() * 22;
      o.lineWidth = 2 + rnd() * 2; o.beginPath(); o.moveTo(x, y); o.quadraticCurveTo(x + 3, y + l / 2, x - 1, y + l); o.stroke();
    }
  }
  function juncos(o, v) {
    const rnd = D.azar(70 + v);
    for (let k = 0; k < 16; k++) {
      const x = -34 + rnd() * 68, h = 60 + rnd() * 50, inc = (rnd() - 0.5) * 14;
      const col = k % 3 === 0 ? '#5d8f3e' : k % 3 === 1 ? '#6fa04a' : '#4f7f36';
      curva(o, x, 0, x + inc * 0.3, -h / 2, x + inc, -h, col, 3);
      if (k % 3 === 0) { o.save(); o.translate(x + inc, -h); o.rotate(inc * 0.02); rrect(o, -3, -2, 6, 18, 3, '#7a4f2c'); o.restore(); }
    }
  }
  function piedra(o, v) {
    const rnd = D.azar(90 + v);
    const w = 26 + rnd() * 18, h = 16 + rnd() * 16, base = ['#9a9488', '#8d877c', '#a8a194'][v % 3];
    rellenar(o, base, c => { c.moveTo(-w, 0); c.quadraticCurveTo(-w, -h, -w * 0.2, -h * 1.1); c.quadraticCurveTo(w * 0.9, -h, w, 0); c.closePath(); });
    rellenar(o, tono(base, -0.15), c => { c.moveTo(w * 0.1, -h * 1.05); c.quadraticCurveTo(w * 0.9, -h, w, 0); c.lineTo(w * 0.2, 0); c.closePath(); });
    o.save(); o.globalAlpha = 0.5; elip(o, -w * 0.45, -h * 0.65, w * 0.25, h * 0.16, tono(base, 0.3)); o.restore();
  }
  // Círculo de piedras visto de lado (en perspectiva)
  function circuloPiedras(o, conSol) {
    sombraPiso(o, 170, 14);
    elip(o, 0, -22, 160, 24, conSol ? '#b9a26a' : '#b8a978');
    elip(o, 0, -22, 140, 17, conSol ? '#c7b27a' : '#c6b98b');
    const n = 12;
    const piedras = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      piedras.push({ x: Math.cos(a) * 150, y: -22 + Math.sin(a) * 22, s: 0.75 + (Math.sin(a) + 1) * 0.18, k });
    }
    piedras.sort((p, q) => p.y - q.y);
    if (conSol) {
      // piedra central con el sol tallado
      rellenar(o, '#8f897d', c => { c.moveTo(-26, -18); c.quadraticCurveTo(-28, -92, 0, -96); c.quadraticCurveTo(28, -92, 26, -18); c.closePath(); });
      circ(o, 0, -62, 13, '#e3b23c');
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; linea(o, [Math.cos(a) * 16, -62 + Math.sin(a) * 16, Math.cos(a) * 22, -62 + Math.sin(a) * 22], '#e3b23c', 3); }
      o.beginPath(); o.arc(0, -62, 7, 0, Math.PI * 1.6); o.strokeStyle = '#b5851f'; o.lineWidth = 2; o.stroke();
    }
    piedras.forEach(p => {
      o.save(); o.translate(p.x, p.y + 4); o.scale(p.s, p.s);
      const h = 34 + (p.k % 3) * 9, w = 13 + (p.k % 2) * 3, col = p.y > -22 ? '#8d877c' : '#a39d90';
      rellenar(o, col, c => { c.moveTo(-w, 0); c.quadraticCurveTo(-w - 2, -h, 0, -h - 4); c.quadraticCurveTo(w + 2, -h, w, 0); c.closePath(); });
      rellenar(o, tono(col, -0.15), c => { c.moveTo(1, -h - 3); c.quadraticCurveTo(w + 2, -h, w, 0); c.lineTo(2, 0); c.closePath(); });
      o.restore();
    });
  }
  // Vasija muisca con dibujos geométricos. semi: semienterrada
  function vasija(o, semi) {
    const barro = '#c0743f', oscuro = '#7a3b1f';
    o.save();
    if (semi) { o.beginPath(); o.rect(-60, -80, 120, 64); o.clip(); o.translate(0, 8); }
    rellenar(o, barro, c => { c.moveTo(-10, -56); c.quadraticCurveTo(-30, -48, -30, -26); c.quadraticCurveTo(-28, -2, 0, -1); c.quadraticCurveTo(28, -2, 30, -26); c.quadraticCurveTo(30, -48, 10, -56); c.closePath(); });
    rrect(o, -12, -62, 24, 8, 3, tono(barro, 0.1));
    // asas
    o.beginPath(); o.arc(-28, -36, 5, Math.PI * 0.5, Math.PI * 1.5); o.strokeStyle = barro; o.lineWidth = 3; o.stroke();
    o.beginPath(); o.arc(28, -36, 5, -Math.PI * 0.5, Math.PI * 0.5); o.stroke();
    // franjas y triángulos
    linea(o, [-27, -40, 27, -40], oscuro, 2);
    linea(o, [-29, -30, 29, -30], oscuro, 2);
    o.fillStyle = oscuro;
    for (let x = -24; x < 24; x += 8) { o.beginPath(); o.moveTo(x, -31); o.lineTo(x + 4, -39); o.lineTo(x + 8, -31); o.fill(); }
    o.save(); o.globalAlpha = 0.25; elip(o, -12, -36, 6, 14, '#fff3d8'); o.restore();
    o.restore();
    if (semi) rellenar(o, '#8a6a42', c => { c.moveTo(-42, 0); c.quadraticCurveTo(-30, -14, 0, -12); c.quadraticCurveTo(30, -14, 42, 0); c.closePath(); });
  }
  // Corte del suelo: capas de tierra y una vasija abajo (didáctico)
  function corte(o) {
    const W = 260, capas = [['#4a3423', 22], ['#6e4b2e', 34], ['#9a6a3a', 36], ['#b98a4e', 34], ['#8d7a64', 30]];
    let y = 0;
    o.save();
    rrect(o, -W / 2 - 6, -4, W + 12, 166, 6, '#3a2a1c');
    capas.forEach(([col, h], k) => {
      rellenar(o, col, c => {
        c.moveTo(-W / 2, y);
        for (let x = -W / 2; x <= W / 2; x += 20) c.lineTo(x, y + Math.sin(x * 0.05 + k) * 2.5);
        c.lineTo(W / 2, y + h + 3); c.lineTo(-W / 2, y + h + 3); c.closePath();
      });
      y += h;
    });
    // piedritas y raíces
    const rnd = D.azar(5);
    for (let k = 0; k < 26; k++) elip(o, -W / 2 + 8 + rnd() * (W - 16), 8 + rnd() * 140, 2 + rnd() * 3, 1.5 + rnd() * 2, k % 2 ? '#c9b89a' : '#5a4632');
    linea(o, [-80, 2, -76, 18, -84, 34], '#c7a77a', 1.5);
    linea(o, [40, 2, 44, 16, 38, 26], '#c7a77a', 1.5);
    // vasija y fragmentos en la capa de abajo
    o.save(); o.translate(30, 152); o.scale(0.9, 0.9); vasija(o, false); o.restore();
    o.save(); o.translate(-70, 140); o.rotate(0.4); rrect(o, -8, -4, 16, 7, 2, '#b8693a'); o.restore();
    o.save(); o.translate(-46, 120); o.rotate(-0.3); rrect(o, -6, -3, 12, 6, 2, '#c0743f'); o.restore();
    // cuerdas y estacas de la excavación
    linea(o, [-W / 2 - 4, -16, W / 2 + 4, -16], '#e8dcc0', 1.4);
    [-W / 2 - 4, 0, W / 2 + 4].forEach(x => rrect(o, x - 2.5, -26, 5, 28, 1.5, '#d8b46a'));
    o.restore();
  }
  function puente(o) {
    const m = '#8a6240', m2 = '#a77b52';
    // tablas
    rrect(o, -150, -8, 300, 12, 3, m);
    for (let x = -146; x < 146; x += 14) rrect(o, x, -10, 12, 6, 1.5, m2);
    // barandas
    [-140, -70, 0, 70, 140].forEach(x => rrect(o, x - 3.5, -48, 7, 44, 2, m));
    curva(o, -140, -44, -70, -36, 0, -44, m2, 4);
    curva(o, 0, -44, 70, -36, 140, -44, m2, 4);
    // apoyos
    rrect(o, -150, -4, 10, 46, 2, '#6b4a30'); rrect(o, 140, -4, 10, 46, 2, '#6b4a30');
  }
  function piedraPaso(o, v) {
    const base = v ? '#8a8f88' : '#9a9a8c';
    rellenar(o, base, c => { c.moveTo(-26, 6); c.quadraticCurveTo(-26, -10, 0, -12); c.quadraticCurveTo(26, -10, 26, 6); c.closePath(); });
    o.save(); o.globalAlpha = 0.5; elip(o, -8, -7, 10, 3, '#c9cbc2'); o.restore();
    elip(o, 14, -8, 6, 3, '#6aa84f');
  }
  function maiz(o, v) {
    const rnd = D.azar(100 + v);
    const h = 140 + rnd() * 30;
    linea(o, [0, 0, 2, -h], '#7a9a3a', 5);
    for (let k = 0; k < 6; k++) {
      const y = -24 - k * (h / 7), lado = k % 2 ? 1 : -1;
      o.beginPath(); o.moveTo(1, y);
      o.quadraticCurveTo(lado * 30, y - 22, lado * 46, y + 4);
      o.quadraticCurveTo(lado * 26, y - 12, 1, y + 6);
      o.fillStyle = k % 2 ? '#7fa645' : '#6f9a3a'; o.fill();
    }
    // espiga
    for (let k = 0; k < 5; k++) linea(o, [2, -h, -10 + k * 5, -h - 12 - (k % 2) * 6], '#d8b45a', 1.8);
    // mazorca
    o.save(); o.translate(4, -h * 0.5); o.rotate(0.35);
    elip(o, 0, 0, 6, 15, '#f0c64a');
    o.fillStyle = '#d9a52a';
    for (let k = -2; k <= 2; k++) for (let j = -1; j <= 1; j++) { o.beginPath(); o.arc(j * 3, k * 5, 1, 0, Math.PI * 2); o.fill(); }
    rellenar(o, '#9cbf5a', c => { c.moveTo(-6, 10); c.quadraticCurveTo(-9, -6, -1, -16); c.quadraticCurveTo(-2, 0, 0, 14); c.closePath(); });
    linea(o, [0, -15, 3, -24], '#b5683a', 1.5);
    o.restore();
  }
  function papa(o, v) {
    const rnd = D.azar(120 + v);
    rellenar(o, '#5c3d24', c => { c.moveTo(-40, 2); c.quadraticCurveTo(0, -12, 40, 2); c.closePath(); });
    for (let k = 0; k < 12; k++) circ(o, -24 + rnd() * 48, -12 - rnd() * 20, 7 + rnd() * 4, k % 2 ? '#3f7f3a' : '#4f8f42');
    for (let k = 0; k < 5; k++) {
      const x = -18 + rnd() * 36, y = -24 - rnd() * 12, c = rnd() > 0.5 ? '#b58ad6' : '#f4f0f8';
      for (let p = 0; p < 5; p++) circ(o, x + Math.cos(p * 1.26) * 2.6, y + Math.sin(p * 1.26) * 2.6, 2, c);
      circ(o, x, y, 1.4, '#f2c14e');
    }
  }
  function espantapajaros(o) {
    linea(o, [0, 0, 0, -130], '#7a5236', 5);
    linea(o, [-40, -96, 40, -96], '#7a5236', 5);
    ruana(o, 0, -104, 16, 34, 50, '#3c8d4f');
    circ(o, 0, -116, 13, '#e3c18a');
    elip(o, 0, -126, 26, 5, '#c9a24a');
    rellenar(o, '#d9b45a', c => { c.moveTo(-12, -127); c.quadraticCurveTo(0, -150, 12, -127); c.closePath(); });
    circ(o, 4, -116, 1.8, '#3a2416'); circ(o, -4, -116, 1.8, '#3a2416');
    curva(o, -4, -110, 0, -107, 5, -110, '#7a3b1f', 1.4);
    linea(o, [-40, -96, -46, -86], '#e0c47a', 2); linea(o, [40, -96, 46, -86], '#e0c47a', 2);
  }
  // Frailejón: tronco con hojas secas y roseta plateada en la punta
  function frailejon(o, v) {
    const rnd = D.azar(140 + v);
    const h = [110, 80, 140, 60][v % 4];
    sombraPiso(o, 22, 4);
    // tronco cubierto de hojas secas que cuelgan (como una falda)
    rellenar(o, '#6f604c', c => { c.moveTo(-9, 0); c.lineTo(-11, -h + 4); c.lineTo(11, -h + 4); c.lineTo(10, 0); c.closePath(); });
    for (let y = -h + 6; y < -2; y += 6) {
      const ancho = 11 + (1 - (y + h) / h) * 4;
      for (let x = -ancho; x <= ancho; x += 4.5) {
        const c = ((x + y) | 0) % 3 === 0 ? '#a8977a' : ((x * 3 + y) | 0) % 2 ? '#8d7c62' : '#9a8a6e';
        elip(o, x, y + 4, 2.2, 5.5, c, x * 0.03);
      }
    }
    // flores amarillas sobre tallitos
    for (let k = 0; k < 3; k++) {
      const a = -0.9 + k * 0.9;
      const x1 = Math.sin(a) * 22, y1 = -h - 34 - rnd() * 10;
      curva(o, 0, -h - 8, x1 * 0.5, y1 + 12, x1, y1, '#8f9a6a', 2.4);
      for (let p = 0; p < 8; p++) elip(o, x1 + Math.cos(p * 0.785) * 4.2, y1 + Math.sin(p * 0.785) * 4.2, 2.6, 1.5, '#f2c43a', p * 0.785);
      circ(o, x1, y1, 2.4, '#c98a1a');
    }
    // roseta lanuda y plateada: un pompón de hojas gruesas en todas direcciones
    const hojaR = (a, l, col) => { o.save(); o.translate(0, -h); o.rotate(a); elip(o, l * 0.55, 0, l * 0.55, 4.6, col); o.restore(); };
    for (let k = 0; k < 16; k++) hojaR(-Math.PI - 0.35 + (k / 15) * (Math.PI + 0.7), 22, k % 2 ? '#a4b48e' : '#95a780');
    for (let k = 0; k < 13; k++) hojaR(-Math.PI - 0.1 + (k / 12) * (Math.PI + 0.2), 17, k % 2 ? '#c3cdab' : '#b4c19c');
    for (let k = 0; k < 9; k++) hojaR(-Math.PI + 0.25 + (k / 8) * (Math.PI - 0.5), 11, '#d6dcc6');
    elip(o, 0, -h - 1, 8, 5, '#e2e6d6');
  }
  function pajonal(o, v) {
    const rnd = D.azar(160 + v);
    for (let k = 0; k < 22; k++) {
      const x = -30 + rnd() * 60, h = 26 + rnd() * 26, inc = (rnd() - 0.5) * 40;
      curva(o, x, 0, x + inc * 0.3, -h * 0.6, x + inc, -h, k % 2 ? '#c9b062' : '#b39a4e', 2);
    }
  }
  function helecho(o, v) {
    const rnd = D.azar(180 + v);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.36, l = 50 + rnd() * 26;
      const x1 = Math.cos(a) * l, y1 = Math.sin(a) * l;
      curva(o, 0, 0, x1 * 0.4, y1 * 0.8, x1, y1, '#3f7f3a', 2.5);
      for (let t = 0.2; t < 1; t += 0.1) {
        const px = x1 * t * (0.4 + t * 0.6) / (0.4 + 0.6), py = y1 * t;
        const s = (1 - t) * 11 + 3;
        elip(o, px - s * 0.6, py, s * 0.7, 2.6, '#4f9a44', 0.5);
        elip(o, px + s * 0.6, py, s * 0.7, 2.6, '#5aa64c', -0.5);
      }
    }
  }
  function flores(o, v) {
    const rnd = D.azar(200 + v);
    const colores = [['#f2c14e', '#e8463c', '#ffffff'], ['#b58ad6', '#f4f0f8', '#f2c14e'], ['#e8735c', '#f2c14e', '#ffffff']][v % 3];
    for (let k = 0; k < 9; k++) {
      const x = -26 + rnd() * 52, h = 18 + rnd() * 26;
      curva(o, x, 0, x + 2, -h / 2, x + (rnd() - 0.5) * 8, -h, '#4f8a3c', 1.6);
      elip(o, x + 4, -h * 0.4, 5, 2, '#5a9a44', -0.5);
      const c = colores[k % 3];
      for (let p = 0; p < 5; p++) circ(o, x + Math.cos(p * 1.26) * 3, -h + Math.sin(p * 1.26) * 3, 2.6, c);
      circ(o, x, -h, 1.8, '#c98a1a');
    }
  }
  function hierba(o, v, base = '#5f9a44') {
    const rnd = D.azar(220 + v);
    for (let k = 0; k < 18; k++) {
      const x = -34 + rnd() * 68, h = 20 + rnd() * 34, inc = (rnd() - 0.5) * 26;
      curva(o, x, 0, x + inc * 0.2, -h * 0.6, x + inc, -h, k % 2 ? base : tono(base, -0.15), 3);
    }
  }

  /* ---------- letreros, señales y semillas ---------- */

  function letrero(o, color) {
    const m = '#8a6240', m2 = '#a77b52';
    // poste alto con banderín del color de la estación
    rrect(o, -5, -168, 10, 168, 3, m);
    rellenar(o, color, c => { c.moveTo(5, -166); c.quadraticCurveTo(40, -162, 62, -150); c.quadraticCurveTo(40, -140, 5, -134); c.closePath(); });
    o.save(); o.globalAlpha = 0.25; linea(o, [8, -150, 56, -150], '#fff', 3); o.restore();
    circ(o, 0, -170, 6, '#e0c060');
    // tablero
    rrect(o, -104, -116, 208, 66, 10, '#6e4a2c');
    rrect(o, -100, -112, 200, 58, 8, m2);
    o.save(); o.globalAlpha = 0.18;
    for (let y = -104; y < -58; y += 9) curva(o, -96, y, 0, y + 3, 96, y - 1, '#5a3a20', 1.2);
    o.restore();
    circ(o, -92, -104, 2.4, '#5a3a20'); circ(o, 92, -104, 2.4, '#5a3a20'); circ(o, -92, -62, 2.4, '#5a3a20'); circ(o, 92, -62, 2.4, '#5a3a20');
    // marca del color de la estación
    rrect(o, -100, -60, 200, 7, 3, color);
  }
  function chulo(o) {
    circ(o, 0, -18, 16, '#2f7d3a');
    circ(o, 0, -18, 13, '#3b9a48');
    linea(o, [-7, -18, -2, -12, 8, -25], '#ffffff', 4.5);
  }
  function flecha(o, color) {
    rellenar(o, '#ffffff', c => { c.moveTo(-16, -66); c.lineTo(16, -66); c.lineTo(16, -34); c.lineTo(30, -34); c.lineTo(0, -2); c.lineTo(-30, -34); c.lineTo(-16, -34); c.closePath(); });
    rellenar(o, color, c => { c.moveTo(-10, -60); c.lineTo(10, -60); c.lineTo(10, -28); c.lineTo(19, -28); c.lineTo(0, -9); c.lineTo(-19, -28); c.lineTo(-10, -28); c.closePath(); });
  }
  // Semillas: 0 memoria (bellota), 1 junco, 2 respeto (pluma), 3 encenillo (hoja), 4 maíz, 5 frailejón (flor)
  function semilla(o, i) {
    o.translate(0, -16);
    circ(o, 0, 0, 15, 'rgba(255,248,214,.95)');
    o.beginPath(); o.arc(0, 0, 15, 0, Math.PI * 2); o.strokeStyle = '#e0a526'; o.lineWidth = 2.5; o.stroke();
    if (i === 0) {
      elip(o, 0, 3, 6.5, 8, '#a8642e');
      rellenar(o, '#6b4320', c => c.ellipse(0, -4, 8, 4.5, 0, Math.PI, Math.PI * 2.0001));
      rrect(o, -8, -5, 16, 3.5, 1.5, '#6b4320');
      linea(o, [0, -8, 1, -11], '#6b4320', 1.6);
    } else if (i === 1) {
      for (let k = -2; k <= 2; k++) curva(o, k * 2, 10, k * 2, 0, k * 4, -10, '#6fa04a', 1.8);
      rrect(o, -2, -12, 4.5, 10, 2, '#7a4f2c');
    } else if (i === 2) {
      o.save(); o.rotate(0.5);
      elip(o, 0, 0, 4.5, 11, '#f4efe2');
      elip(o, 0, -4, 3, 6, '#3d6f8f');
      linea(o, [0, 11, 0, -10], '#7a5c3e', 1.2);
      o.restore();
    } else if (i === 3) {
      o.save(); o.rotate(-0.5);
      elip(o, 0, 0, 5.5, 10, '#4f8a3c');
      linea(o, [0, 10, 0, -9], '#2f6b2a', 1.2);
      o.restore();
    } else if (i === 4) {
      elip(o, 0, 0, 5, 10, '#f0c64a');
      o.fillStyle = '#d9a52a';
      for (let k = -2; k <= 2; k++) { o.beginPath(); o.arc(0, k * 3.6, 1.1, 0, Math.PI * 2); o.fill(); }
      rellenar(o, '#7fa645', c => { c.moveTo(-5, 9); c.quadraticCurveTo(-9, -2, -2, -9); c.quadraticCurveTo(-3, 2, 0, 10); c.closePath(); });
    } else {
      for (let p = 0; p < 8; p++) elip(o, Math.cos(p * 0.785) * 6, Math.sin(p * 0.785) * 6, 3.5, 2, '#f2c43a', p * 0.785);
      circ(o, 0, 0, 3.6, '#c98a1a');
    }
  }
  function halo(o) {
    const g = o.createRadialGradient(0, -40, 2, 0, -40, 40);
    g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(0.45, 'rgba(255,225,120,.45)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    o.fillStyle = g; o.beginPath(); o.arc(0, -40, 40, 0, Math.PI * 2); o.fill();
  }
  // Burbuja que indica «oprime ↑ o toca»
  function burbuja(o) {
    rellenar(o, '#ffffff', c => { c.arc(0, -26, 20, 0, Math.PI * 2); });
    poli(o, [-6, -8, 6, -8, 0, 0], '#ffffff');
    poli(o, [0, -40, 11, -27, 4, -27, 4, -14, -4, -14, -4, -27, -11, -27], '#c0562f');
  }

  /* ---------- cielo y detalles vivos ---------- */

  function nube(o, v) {
    const rnd = D.azar(240 + v);
    o.fillStyle = 'rgba(255,255,255,.92)';
    const n = 6 + v;
    for (let k = 0; k < n; k++) {
      const x = -80 + k * (160 / n) + rnd() * 10, r = 22 + rnd() * 20 - Math.abs(k - n / 2) * 3;
      o.beginPath(); o.arc(x, -26 - rnd() * 14, r, 0, Math.PI * 2); o.fill();
    }
    o.beginPath(); o.ellipse(0, -18, 96, 16, 0, 0, Math.PI * 2); o.fill();
    o.fillStyle = 'rgba(200,215,230,.35)';
    o.beginPath(); o.ellipse(0, -10, 90, 9, 0, 0, Math.PI * 2); o.fill();
  }
  function niebla(o) {
    const g = o.createRadialGradient(0, -60, 10, 0, -60, 200);
    g.addColorStop(0, 'rgba(250,250,248,.75)'); g.addColorStop(0.5, 'rgba(245,246,244,.4)'); g.addColorStop(1, 'rgba(245,246,244,0)');
    o.save(); o.scale(1, 0.3); o.fillStyle = g; o.beginPath(); o.arc(0, -200, 200, 0, Math.PI * 2); o.fill(); o.restore();
  }
  function pajaro(o, i) {
    o.strokeStyle = '#3a3a48'; o.lineWidth = 2.4; o.lineCap = 'round';
    o.beginPath();
    if (i === 0) { o.moveTo(-14, -14); o.quadraticCurveTo(-6, -20, 0, -10); o.quadraticCurveTo(6, -20, 14, -14); }
    else { o.moveTo(-14, -4); o.quadraticCurveTo(-6, -6, 0, -10); o.quadraticCurveTo(6, -6, 14, -4); }
    o.stroke();
  }
  function mariposa(o, i, color) {
    const s = i === 0 ? 1 : 0.35;
    o.save(); o.translate(0, -12);
    o.save(); o.scale(s, 1);
    elip(o, -6, -3, 6, 5, color, -0.3); elip(o, 6, -3, 6, 5, color, 0.3);
    elip(o, -5, 4, 4, 3.5, tono(color, -0.15), 0.3); elip(o, 5, 4, 4, 3.5, tono(color, -0.15), -0.3);
    circ(o, -6, -3, 1.6, '#fff'); circ(o, 6, -3, 1.6, '#fff');
    o.restore();
    rrect(o, -1, -7, 2, 14, 1, '#2b2118');
    o.restore();
  }
  function hoja(o, i) {
    elip(o, 0, -6, 6, 3.2, ['#c98a2a', '#8fae3a', '#d06a2a'][i % 3], 0.4);
    linea(o, [-5, -4, 5, -8], 'rgba(0,0,0,.25)', 0.8);
  }

  /* ---------- registro de todas las texturas ---------- */

  D.crearTexturas = function (escena, estaciones, personajes) {
    const H = (clave, fw, fh, n, f, opc) => D.hoja(escena, clave, fw, fh, n, f, opc);
    const sinBorde = { borde: false };
    const t = {};
    t.rosa = H('pj-rosa', 80, 160, 2, rosa, { grosor: 2.6 });
    t.julian = H('pj-julian', 80, 172, 3, julian, { grosor: 2.6 });
    t.tita = H('pj-tita', 110, 100, 3, tita, { grosor: 2.4 });
    t.rita = H('pj-rita', 80, 56, 3, rita, { grosor: 2.2, pie: 8 });
    t.roca = H('roca-musgo', 104, 50, 1, rocaMusgo, sinBorde);
    t.cuqui = H('pj-cuqui', 96, 54, 3, cuqui, { grosor: 2.2 });
    t.monticulo = H('monticulo', 100, 26, 1, monticulo, sinBorde);
    t.tomas = H('pj-tomas', 96, 136, 3, tomas, { grosor: 2.6 });

    t.casa = H('casa', 310, 214, 1, casa, sinBorde);
    t.cerca = H('cerca', 136, 68, 1, cerca, sinBorde);
    t.arbolGrande = H('arbol-grande', 280, 316, 1, arbolGrande, { borde: false, S: 1.5 });
    t.redondo = ['#5a9640', '#4f8a3c', '#6aa04a'].map((c, k) => H('arbol-redondo-' + k, 130, 176, 1, o => arbolRedondo(o, c), sinBorde));
    t.eucalipto = H('eucalipto', 80, 236, 1, eucalipto, sinBorde);
    t.arbusto = ['#4f8a3c', '#5f9a44', '#3f7a36', '#8a9a4a'].map((c, k) => H('arbusto-' + k, 104, 80, 1, o => arbusto(o, c), sinBorde));
    t.encenillo = [0, 1].map(v => H('encenillo-' + v, 150, 220, 1, o => encenillo(o, v), sinBorde));
    t.juncos = [0, 1, 2].map(v => H('juncos-' + v, 90, 120, 1, o => juncos(o, v), sinBorde));
    t.piedra = [0, 1, 2].map(v => H('piedra-' + v, 100, 50, 1, o => piedra(o, v), sinBorde));
    t.circulo = H('circulo-piedras', 360, 110, 1, o => circuloPiedras(o, false), sinBorde);
    t.calendario = H('calendario', 360, 120, 1, o => circuloPiedras(o, true), sinBorde);
    t.vasija = H('vasija', 70, 72, 1, o => vasija(o, false), sinBorde);
    t.vasijaSemi = H('vasija-semi', 90, 60, 1, o => vasija(o, true), sinBorde);
    t.corte = H('corte', 290, 200, 1, corte, { sombra: false, borde: false, pie: 170 });
    t.puente = H('puente', 320, 110, 1, puente, { borde: false, pie: 50 });
    t.piedraPaso = [0, 1].map(v => H('piedra-paso-' + v, 60, 30, 1, o => piedraPaso(o, v), { borde: false, pie: 10 }));
    t.maiz = [0, 1, 2].map(v => H('maiz-' + v, 100, 190, 1, o => maiz(o, v), sinBorde));
    t.papa = [0, 1].map(v => H('papa-' + v, 90, 50, 1, o => papa(o, v), sinBorde));
    t.espantapajaros = H('espantapajaros', 100, 160, 1, espantapajaros, sinBorde);
    t.frailejon = [0, 1, 2, 3].map(v => H('frailejon-' + v, 84, 200, 1, o => frailejon(o, v), sinBorde));
    t.pajonal = [0, 1].map(v => H('pajonal-' + v, 90, 60, 1, o => pajonal(o, v), { sombra: false, borde: false }));
    t.helecho = [0, 1].map(v => H('helecho-' + v, 130, 90, 1, o => helecho(o, v), sinBorde));
    t.flores = [0, 1, 2].map(v => H('flores-' + v, 70, 56, 1, o => flores(o, v), sinBorde));
    t.hierba = [0, 1].map(v => H('hierba-' + v, 90, 62, 1, o => hierba(o, v), { sombra: false, borde: false }));
    t.hierbaSeca = [0, 1].map(v => H('hierba-seca-' + v, 90, 62, 1, o => hierba(o, v + 4, '#b8a458'), { sombra: false, borde: false }));

    t.letrero = estaciones.map((e, k) => H('letrero-' + k, 230, 186, 1, o => letrero(o, e.color), { grosor: 2.6 }));
    t.chulo = H('chulo', 40, 42, 1, chulo, { grosor: 2.2 });
    t.flecha = estaciones.map((e, k) => H('flecha-' + k, 70, 76, 1, o => flecha(o, e.color), { grosor: 2 }));
    t.semilla = H('semillas', 40, 44, 6, semilla, { grosor: 2 });
    t.halo = H('halo', 84, 88, 1, halo, { sombra: false, borde: false });
    t.burbuja = H('burbuja', 48, 54, 1, burbuja, { grosor: 2 });

    t.nube = [0, 1, 2].map(v => H('nube-' + v, 220, 80, 1, o => nube(o, v), { sombra: false, borde: false, S: 1 }));
    t.niebla = H('niebla', 420, 140, 1, niebla, { sombra: false, borde: false, S: 0.6, pie: 10 });
    t.pajaro = H('pajaro', 34, 26, 2, pajaro, { sombra: false, borde: false });
    t.mariposa = ['#f29a2e', '#f2d23a', '#5fa3c9'].map((c, k) => H('mariposa-' + k, 30, 30, 2, (o, i) => mariposa(o, i, c), { sombra: false, borde: false }));
    t.hoja = H('hoja', 18, 16, 3, hoja, { sombra: false, borde: false, pie: 2 });
    return t;
  };

  // El avatar se dibuja aparte porque depende de lo que eligió el niño
  D.crearAvatar = function (escena, id, colorRuana) {
    const t = {};
    if (id === 'silla') {
      t.cuerpo = D.hoja(escena, 'av-silla', 110, 140, 2, (o, i) => sillaCuerpo(o, i, colorRuana), { grosor: 2.6 });
      t.brazo = D.hoja(escena, 'av-brazo', 110, 140, 3, (o, i) => sillaBrazo(o, i, colorRuana), { borde: false, sombra: false });
      t.rueda = D.hoja(escena, 'av-rueda', 72, 72, 1, ruedaGrande, { grosor: 2.2, pie: 36 });
      t.ruedita = D.hoja(escena, 'av-ruedita', 22, 22, 1, ruedita, { grosor: 1.6, pie: 11 });
    } else {
      t.cuerpo = D.hoja(escena, 'av-' + id, 70, 134, 6, (o, i) => nino(o, i, id, colorRuana), { grosor: 2.6 });
    }
    return t;
  };

  window.GU_DIBUJOS = D;
})();
