/*
 * Guardianes de Usme · Prototipo 1 · Recorrido 3D en tercera persona
 *
 * Este archivo solo dibuja el parque y mueve al avatar. Todo lo demás
 * (inicio, conversaciones, preguntas, puntaje, accesibilidad) lo hace la capa
 * común (comun/juego.js) a través de window.GU.
 *
 * El mundo, de abajo hacia arriba:
 *   valle con la casa campesina → río Tunjuelo y humedal → lugar de los ancestros
 *   → bosque altoandino con la quebrada → huerta → páramo de Sumapaz.
 * Un camino de tierra serpentea y une las seis estaciones en orden.
 *
 * Rendimiento: sin texturas (salvo unos letreritos dibujados con DynamicTexture),
 * colores en los vértices, árboles y matas con «thin instances», matrices
 * congeladas en todo lo quieto y una sombra redonda falsa bajo cada figura.
 */
(function () {
  const B = BABYLON, MB = B.MeshBuilder, F = window.GU3D_FIGURAS;
  const E = GU.estaciones;

  /* ---------- lienzo, motor y escena ---------- */

  const lienzo = document.createElement('canvas');
  lienzo.setAttribute('aria-hidden', 'true');
  lienzo.tabIndex = -1;
  document.getElementById('mundo').appendChild(lienzo);

  const motor = new B.Engine(lienzo, true, { stencil: false, preserveDrawingBuffer: false, powerPreference: 'default' }, false);
  // en pantallas de alta densidad no se dibuja a más de 1,5 píxeles por punto
  motor.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  const escena = new B.Scene(motor);
  escena.skipPointerMovePicking = true;
  escena.constantlyUpdateMeshUnderPointer = false;
  escena.autoClearDepthAndStencil = true;

  const hex = c => B.Color3.FromHexString(c);
  const HORIZONTE = '#f6e7c8', CENIT = '#6fb7e6';
  escena.clearColor = B.Color4.FromColor3(hex(HORIZONTE), 1);
  escena.ambientColor = new B.Color3(0.25, 0.25, 0.25);
  escena.fogMode = B.Scene.FOGMODE_LINEAR;
  escena.fogColor = hex('#eee9d6');
  escena.fogStart = 60; escena.fogEnd = 240;

  const camara = new B.FreeCamera('camara', new B.Vector3(0, 20, -60), escena);
  camara.inputs.clear();
  camara.minZ = 0.2; camara.maxZ = 1400; camara.fov = 0.9;

  const sol = new B.HemisphericLight('cielo', new B.Vector3(0.2, 1, -0.3), escena);
  sol.diffuse = hex('#fff6e6'); sol.groundColor = hex('#7b8a5a'); sol.specular = B.Color3.Black(); sol.intensity = 0.78;
  const luz = new B.DirectionalLight('sol', new B.Vector3(0.35, -1, 0.55), escena);
  luz.diffuse = hex('#ffe4bc'); luz.specular = hex('#3a3a3a'); luz.intensity = 0.72;

  // material común con colores en los vértices (casi todo el mundo lo usa)
  const matVC = new B.StandardMaterial('vc', escena);
  matVC.diffuseColor = B.Color3.White();
  matVC.specularColor = B.Color3.Black();
  F.iniciar(escena, matVC);
  const { pieza, unir, mezclar } = F;

  /* ---------- utilidades ---------- */

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  function suave(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function angLerp(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
  function azar(semilla) { // generador repetible: el parque se ve igual cada vez
    let s = semilla >>> 0;
    return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const rnd = azar(20261006);
  const entre = (a, b) => a + (b - a) * rnd();
  function distSegmento(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    const t = l2 ? clamp(((px - ax) * vx + (pz - az) * vz) / l2, 0, 1) : 0;
    return Math.hypot(px - ax - vx * t, pz - az - vz * t);
  }
  function distPolilinea(pts, x, z) {
    let d = 1e9;
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSegmento(x, z, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z));
    return d;
  }

  /* ---------- el camino ---------- */

  // Puntos de control del camino (x, z). El z crece valle arriba hacia el páramo.
  const CONTROL = [[0, -32], [1, -18], [6, -4], [3, 9], [-7, 19], [-12, 29], [-14, 40], [-8, 53], [6, 63], [14, 77],
    [10, 91], [-4, 101], [-14, 115], [-10, 129], [4, 139], [14, 155], [10, 169], [-2, 181], [-8, 197], [-4, 211], [2, 226]];
  const IDX_ESTACION = [2, 6, 9, 12, 15, 18];
  // a qué lado del camino se para cada personaje (+1 derecha, −1 izquierda), siempre por fuera de la curva
  const LADO = [1, -1, 1, -1, 1, -1];

  const spline = B.Curve3.CreateCatmullRomSpline(CONTROL.map(c => new B.Vector3(c[0], 0, c[1])), 24, false).getPoints();
  // se vuelve a muestrear cada medio metro para caminar parejo
  const P = [];
  {
    const PASO = 0.5;
    P.push({ x: spline[0].x, z: spline[0].z });
    let resto = 0;
    for (let i = 1; i < spline.length; i++) {
      const a = spline[i - 1], b = spline[i];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      let d = PASO - resto;
      while (d <= l) { const t = d / l; P.push({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) }); d += PASO; }
      resto = l - (d - PASO);
    }
  }
  const NP = P.length;
  P.forEach((p, k) => {
    const a = P[Math.max(0, k - 2)], b = P[Math.min(NP - 1, k + 2)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    p.tx = (b.x - a.x) / l; p.tz = (b.z - a.z) / l;
    p.nx = p.tz; p.nz = -p.tx;           // normal hacia la derecha del caminante
  });

  // índice espacial para medir rápido la distancia al camino
  const CELDA = 8, cubeta = new Map();
  P.forEach((p, k) => { const key = Math.floor(p.x / CELDA) + ',' + Math.floor(p.z / CELDA); (cubeta.get(key) || cubeta.set(key, []).get(key)).push(k); });
  function masCercano(x, z, radio = 3) {
    const cx = Math.floor(x / CELDA), cz = Math.floor(z / CELDA);
    let mejor = -1, md = 1e9;
    for (let i = -radio; i <= radio; i++) for (let j = -radio; j <= radio; j++) {
      const l = cubeta.get((cx + i) + ',' + (cz + j));
      if (l) for (const k of l) { const d = (P[k].x - x) ** 2 + (P[k].z - z) ** 2; if (d < md) { md = d; mejor = k; } }
    }
    return { k: mejor, d: mejor < 0 ? 99 : Math.sqrt(md) };
  }
  const dCamino = (x, z) => masCercano(x, z).d;
  function masCercanoTotal(x, z) { // sin límite de radio (para cuando el avatar está lejos)
    const r = masCercano(x, z);
    if (r.k >= 0) return r;
    let mejor = 0, md = 1e9;
    P.forEach((p, k) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < md) { md = d; mejor = k; } });
    return { k: mejor, d: Math.sqrt(md) };
  }

  // estaciones: índice de la muestra del camino más cercana a su punto de control
  const EST = IDX_ESTACION.map((ic, i) => {
    let k = 0, md = 1e9;
    P.forEach((p, n) => { const d = (p.x - CONTROL[ic][0]) ** 2 + (p.z - CONTROL[ic][1]) ** 2; if (d < md) { md = d; k = n; } });
    return { i, k, lado: LADO[i] };
  });
  // posición en el marco de una estación: a = hacia la derecha del camino, b = camino adelante
  function lugar(i, a, b) {
    const p = P[EST[i].k];
    return { x: p.x + p.nx * a + p.tx * b, z: p.z + p.nz * a + p.tz * b };
  }
  const yawDe = (dx, dz) => Math.atan2(dx, dz);

  /* ---------- agua: río Tunjuelo, charcos y quebrada ---------- */

  const zRio = x => 32 + 4.5 * Math.sin(x * 0.045 + 0.6);
  const CHARCOS = [
    { ...lugar(1, -8.5, 1), r: 3.2, prof: 1.3 },     // humedal de Tita
    { ...lugar(5, 11, 6), r: 4.6, prof: 1.3 },       // laguna del páramo
  ];
  const QUEBRADA = [];
  for (let b = 16; b >= -16; b -= 2) QUEBRADA.push(lugar(3, -5.6 + Math.sin(b * 0.35) * 0.9, b));
  CHARCOS.push({ ...QUEBRADA[QUEBRADA.length - 1], r: 1.8, prof: 0.9 }); // pozo al pie de la quebrada

  /* ---------- relieve ---------- */

  function base(z) { const t = clamp((z - 12) / 215, 0, 1); return 20 * (0.45 * t + 0.55 * t * t * (3 - 2 * t)); }
  function relieve(x, z) {
    const lat = 16 * suave(30, 95, Math.abs(x));
    const ruido = 1.8 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.7) + 1.0 * Math.sin(x * 0.23 + z * 0.17) + 0.5 * Math.sin(x * 0.5 - z * 0.37);
    const fondo = 14 * suave(-40, -68, z) + 20 * suave(238, 285, z);
    return lat + ruido + fondo;
  }
  // altura sin cauces (el agua se pone a partir de esta)
  function alturaBase(x, z) { return base(z) + relieve(x, z) * suave(3.5, 16, dCamino(x, z)); }
  function cauce(x, z) {
    let c = 1.7 * (1 - suave(0.5, 4.8, Math.abs(z - zRio(x))));
    for (const q of CHARCOS) c = Math.max(c, q.prof * (1 - suave(q.r * 0.5, q.r + 1.3, Math.hypot(x - q.x, z - q.z))));
    if (Math.abs(z - QUEBRADA[8].z) < 30) c = Math.max(c, 0.7 * (1 - suave(0.3, 2.0, distPolilinea(QUEBRADA, x, z))));
    return c;
  }
  const alturaFn = (x, z) => alturaBase(x, z) - cauce(x, z);

  // la malla del terreno: rejilla de triángulos con sombreado plano
  const X0 = -105, X1 = 105, Z0 = -75, Z1 = 295, NX = 66, NZ = 116;
  const DX = (X1 - X0) / NX, DZ = (Z1 - Z0) / NZ;
  const ALT = new Float32Array((NX + 1) * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) ALT[j * (NX + 1) + i] = alturaFn(X0 + i * DX, Z0 + j * DZ);

  // altura exacta de la malla en (x, z): la misma interpolación de los triángulos
  function alturaSuelo(x, z) {
    const fx = clamp((x - X0) / DX, 0, NX - 0.001), fz = clamp((z - Z0) / DZ, 0, NZ - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const W = NX + 1;
    const ha = ALT[j * W + i], hb = ALT[j * W + i + 1], hc = ALT[(j + 1) * W + i], hd = ALT[(j + 1) * W + i + 1];
    return u + v <= 1 ? ha + (hb - ha) * u + (hc - ha) * v : hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
  }

  // colores del suelo por zona (de abajo hacia arriba)
  const ZONAS = [[-80, '#7cb35a'], [12, '#8fc463'], [28, '#74b85a'], [55, '#86bd5c'], [68, '#a8c66c'], [94, '#a0c268'],
    [104, '#5b9a4a'], [134, '#5f9c4a'], [146, '#98bd5f'], [172, '#a6bf63'], [186, '#b8b46c'], [300, '#aea86a']].map(z => [z[0], hex(z[1])]);
  function colorZona(z) {
    for (let n = 1; n < ZONAS.length; n++) if (z <= ZONAS[n][0]) {
      const t = suave(ZONAS[n - 1][0], ZONAS[n][0], z);
      return B.Color3.Lerp(ZONAS[n - 1][1], ZONAS[n][1], t);
    }
    return ZONAS[ZONAS.length - 1][1].clone();
  }
  const PARCHES = [];   // manchas de color (tierra de la huerta, explanada…): se pintan al final

  const suelo = (function () {
    const pos = [], col = [], ind = [];
    const W = NX + 1;
    const cBarro = hex('#8d8a55'), cLecho = hex('#6f7b4a'), cRoca = hex('#9a9a7c'), cMonte = hex('#5f8a4f'), cLejos = hex('#7d9a88');
    const cOcre = hex('#c2ab6a'), cOliva = hex('#8f9a58');
    const tri = (a, b, c) => {
      const n = pos.length / 3;
      [a, b, c].forEach(p => pos.push(p[0], p[1], p[2]));
      ind.push(n, n + 1, n + 2);
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      let k = colorZona(cz);
      const cv = cauce(cx, cz);
      const alto = cy - base(cz);
      if (cz > 182 && alto < 4) k = B.Color3.Lerp(k, rnd() < 0.5 ? cOcre : cOliva, 0.35);
      if (alto > 3) k = B.Color3.Lerp(k, cMonte, suave(3, 9, alto));
      if (alto > 10) k = B.Color3.Lerp(k, cLejos, suave(10, 18, alto) * 0.7);
      if (cv > 0.15) k = B.Color3.Lerp(k, cBarro, suave(0.15, 0.6, cv));
      if (cv > 0.8) k = B.Color3.Lerp(k, cLecho, 0.6);
      // inclinación: las laderas se ven más rocosas
      const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
      const nxx = e1y * e2z - e1z * e2y, nyy = e1z * e2x - e1x * e2z, nzz = e1x * e2y - e1y * e2x;
      const ny = Math.abs(nyy) / Math.hypot(nxx, nyy, nzz);
      if (ny < 0.85) k = B.Color3.Lerp(k, cRoca, suave(0.85, 0.6, ny) * 0.7);
      const j2 = 0.94 + rnd() * 0.12;
      for (let q = 0; q < 3; q++) col.push(k.r * j2, k.g * j2, k.b * j2, 1);
    };
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const v = (ii, jj) => [X0 + ii * DX, ALT[jj * W + ii], Z0 + jj * DZ];
      const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
      tri(a, c, b); tri(b, c, d);
    }
    const m = new B.Mesh('suelo', escena);
    const vd = new B.VertexData();
    const nor = [];
    B.VertexData.ComputeNormals(pos, ind, nor);
    if (nor[1] < 0) { // si los triángulos quedaron al revés, se voltean
      for (let n = 0; n < ind.length; n += 3) { const t = ind[n + 1]; ind[n + 1] = ind[n + 2]; ind[n + 2] = t; }
      nor.length = 0; B.VertexData.ComputeNormals(pos, ind, nor);
    }
    vd.positions = pos; vd.indices = ind; vd.normals = nor; vd.colors = col;
    vd.applyToMesh(m);
    m.material = matVC; m.isPickable = false;
    return m;
  })();

  /* ---------- el puente sobre el Tunjuelo ---------- */

  const PUENTE = (function () {
    let k1 = -1, k2 = -1;
    P.forEach((p, k) => { if (Math.abs(p.z - zRio(p.x)) < 5.4) { if (k1 < 0) k1 = k; k2 = k; } });
    k1 = Math.max(0, k1 - 1); k2 = Math.min(NP - 1, k2 + 1);
    const a = P[k1], b = P[k2];
    const ha = alturaSuelo(a.x, a.z) + 0.14, hb = alturaSuelo(b.x, b.z) + 0.14;
    const largo = Math.hypot(b.x - a.x, b.z - a.z);
    return { k1, k2, a, b, ha, hb, largo, dx: (b.x - a.x) / largo, dz: (b.z - a.z) / largo };
  })();
  const alturaPuente = u => lerp(PUENTE.ha, PUENTE.hb, u) + 0.55 * Math.sin(Math.PI * clamp(u, 0, 1));
  // altura por donde camina el avatar (el suelo o el puente)
  function alturaCaminar(x, z) {
    const h = alturaSuelo(x, z);
    const rx = x - PUENTE.a.x, rz = z - PUENTE.a.z;
    const u = (rx * PUENTE.dx + rz * PUENTE.dz) / PUENTE.largo;
    const v = Math.abs(rx * PUENTE.dz - rz * PUENTE.dx);
    if (u > -0.03 && u < 1.03 && v < 1.6) return Math.max(h, alturaPuente(u) + 0.08);
    return h;
  }

  /* ---------- herramientas para sembrar muchas cosas iguales ---------- */

  const _m = new B.Matrix(), _q = new B.Quaternion(), _s = new B.Vector3(), _t = new B.Vector3();
  function sembrar(proto, items) {
    if (!items.length) { proto.setEnabled(false); return proto; }
    const buf = new Float32Array(items.length * 16);
    items.forEach((it, n) => {
      B.Quaternion.RotationYawPitchRollToRef(it.ry || 0, it.rx || 0, it.rz || 0, _q);
      const s = it.s || 1;
      _s.set(s * (it.sx || 1), s * (it.sy || 1), s * (it.sz || 1));
      _t.set(it.x, it.y, it.z);
      B.Matrix.ComposeToRef(_s, _q, _t, _m);
      _m.copyToArray(buf, n * 16);
    });
    proto.thinInstanceSetBuffer('matrix', buf, 16, true);
    proto.thinInstanceRefreshBoundingInfo(false);
    proto.isPickable = false;
    proto.freezeWorldMatrix();
    return proto;
  }

  const VACAS = [];               // vacas del potrero (se crean en la entrada)
  const COLISIONES = [];          // círculos que el avatar no atraviesa
  const RESERVAS = [];            // zonas donde no se siembra al azar
  const reservar = (x, z, r) => RESERVAS.push({ x, z, r });
  function libre(x, z, margen = 4) {
    if (x < X0 + 4 || x > X1 - 4 || z < Z0 + 4 || z > Z1 - 4) return false;
    if (dCamino(x, z) < margen) return false;
    if (cauce(x, z) > 0.15) return false;
    for (const r of RESERVAS) if ((x - r.x) ** 2 + (z - r.z) ** 2 < r.r * r.r) return false;
    return true;
  }
  const enSuelo = (x, z, extra = 0) => ({ x, z, y: alturaSuelo(x, z) + extra });

  /* ---------- prototipos de vegetación y piedras ---------- */

  const PROTO = {
    arbol: unir('arbol', [
      pieza('cil', { h: 2.2, dt: 0.28, db: 0.42, t: 6 }, '#7a5636', [0, 1.1, 0]),
      pieza('ico', { r: 1.5, sub: 1 }, '#5aa043', [0, 3.2, 0], null, [1, 0.85, 1]),
      pieza('ico', { r: 1.0, sub: 1 }, '#6fb650', [0.7, 3.9, 0.3], null, [1, 0.85, 1]),
      pieza('ico', { r: 0.9, sub: 1 }, '#4f9440', [-0.8, 3.5, -0.4], null, [1, 0.85, 1]),
    ]),
    arbolGrande: unir('arbol-grande', [
      pieza('cil', { h: 3.2, dt: 0.5, db: 0.8, t: 7 }, '#6e4c30', [0, 1.6, 0]),
      pieza('cil', { h: 1.6, dt: 0.2, db: 0.34, t: 5 }, '#6e4c30', [0.6, 3.4, 0], [0, 0, -0.6]),
      pieza('ico', { r: 2.6, sub: 1 }, '#4e9a42', [0, 5.0, 0], null, [1.1, 0.8, 1.1]),
      pieza('ico', { r: 1.8, sub: 1 }, '#62b04e', [1.6, 5.4, 0.6], null, [1, 0.8, 1]),
      pieza('ico', { r: 1.7, sub: 1 }, '#438a3a', [-1.5, 4.8, -0.8], null, [1, 0.8, 1]),
      pieza('ico', { r: 1.4, sub: 1 }, '#5aa648', [0.2, 6.3, -0.4], null, [1, 0.8, 1]),
    ]),
    arbolAlto: unir('arbol-alto', [
      pieza('cil', { h: 2.6, dt: 0.22, db: 0.36, t: 6 }, '#6a4a2e', [0, 1.3, 0]),
      pieza('cil', { h: 2.2, dt: 0.6, db: 2.4, t: 7 }, '#3f8a4a', [0, 2.6, 0]),
      pieza('cil', { h: 1.9, dt: 0.3, db: 1.9, t: 7 }, '#4a9a52', [0, 3.8, 0]),
      pieza('cil', { h: 1.4, dt: 0.0, db: 1.2, t: 7 }, '#55a85a', [0, 4.9, 0]),
    ]),
    encenillo: unir('encenillo', [
      pieza('cil', { h: 1.4, dt: 0.18, db: 0.3, t: 5 }, '#5c4a32', [0, 0.7, 0]),
      pieza('cil', { h: 1.0, dt: 0.1, db: 0.16, t: 5 }, '#5c4a32', [0.3, 1.4, 0], [0, 0, -0.5]),
      pieza('ico', { r: 1.0, sub: 1 }, '#3b7a37', [0, 2.0, 0], null, [1.2, 0.7, 1.2]),
      pieza('ico', { r: 0.8, sub: 1 }, '#46883d', [0.8, 2.1, 0.3], null, [1.1, 0.7, 1.1]),
      pieza('ico', { r: 0.7, sub: 1 }, '#2f6b31', [-0.6, 1.8, -0.5], null, [1.1, 0.7, 1.1]),
      pieza('ico', { r: 0.5, sub: 0 }, '#6f9e3d', [0.1, 0.22, 0.3], null, [1.2, 0.6, 1.2]),
      pieza('esfera', { d: 0.16, seg: 3 }, '#d94f4f', [0.6, 2.4, 0.7]),
      pieza('esfera', { d: 0.14, seg: 3 }, '#d94f4f', [-0.5, 2.2, 0.6]),
    ]),
    arbusto: unir('arbusto', [
      pieza('ico', { r: 0.7, sub: 1 }, '#4f9a40', [0, 0.45, 0], null, [1.2, 0.8, 1.1]),
      pieza('ico', { r: 0.5, sub: 1 }, '#5eae4c', [0.5, 0.55, 0.2], null, [1.1, 0.8, 1]),
      pieza('esfera', { d: 0.14, seg: 3 }, '#f2f0e6', [0.3, 0.95, 0.4]),
      pieza('esfera', { d: 0.14, seg: 3 }, '#f2f0e6', [-0.4, 0.8, 0.3]),
    ]),
    musgo: unir('musgo', [
      pieza('ico', { r: 0.6, sub: 0 }, '#6f9e3d', [0, 0.12, 0], null, [1.3, 0.6, 1.1]),
      pieza('ico', { r: 0.35, sub: 0 }, '#86b447', [0.5, 0.14, 0.2], null, [1.1, 0.7, 1]),
    ]),
    pasto: unir('pasto', [
      pieza('cil', { h: 0.6, dt: 0, db: 0.12, t: 3 }, '#6fae4b', [0, 0.3, 0], [0.2, 0, 0.1]),
      pieza('cil', { h: 0.5, dt: 0, db: 0.1, t: 3 }, '#7dbd52', [0.12, 0.25, 0.05], [0, 0, -0.35]),
      pieza('cil', { h: 0.45, dt: 0, db: 0.1, t: 3 }, '#5f9e42', [-0.1, 0.22, -0.04], [-0.2, 0, 0.35]),
    ]),
    pajonal: unir('pajonal', [
      pieza('cil', { h: 0.9, dt: 0, db: 0.14, t: 3 }, '#cdb86a', [0, 0.45, 0], [0.15, 0, 0.12]),
      pieza('cil', { h: 0.8, dt: 0, db: 0.12, t: 3 }, '#bda85c', [0.15, 0.38, 0.05], [0, 0, -0.4]),
      pieza('cil', { h: 0.75, dt: 0, db: 0.12, t: 3 }, '#d8c47a', [-0.14, 0.36, -0.06], [-0.25, 0, 0.4]),
      pieza('cil', { h: 0.7, dt: 0, db: 0.12, t: 3 }, '#a89a55', [0.02, 0.33, 0.16], [0.45, 0, 0]),
      pieza('cil', { h: 0.7, dt: 0, db: 0.12, t: 3 }, '#c4b066', [0.02, 0.33, -0.16], [-0.45, 0, 0]),
    ]),
    junco: unir('junco', [
      pieza('cil', { h: 1.8, dt: 0.02, db: 0.07, t: 4 }, '#4d7a3a', [0, 0.9, 0], [0.05, 0, 0.06]),
      pieza('cil', { h: 1.5, dt: 0.02, db: 0.06, t: 4 }, '#5d8c44', [0.14, 0.75, 0.06], [0, 0, -0.15]),
      pieza('cil', { h: 1.6, dt: 0.02, db: 0.06, t: 4 }, '#44703a', [-0.12, 0.8, -0.05], [-0.1, 0, 0.14]),
      pieza('cil', { h: 1.3, dt: 0.02, db: 0.06, t: 4 }, '#5d8c44', [0.03, 0.65, 0.14], [0.18, 0, 0]),
      pieza('cil', { h: 0.32, d: 0.09, t: 5 }, '#7a5233', [0.2, 1.55, 0.08], [0, 0, -0.15]),
    ]),
    frailejon: unir('frailejon', [
      pieza('cil', { h: 1.3, dt: 0.34, db: 0.42, t: 7 }, '#8a7655', [0, 0.65, 0]),
      pieza('cil', { h: 0.3, dt: 0.44, db: 0.36, t: 7 }, '#a08a63', [0, 1.3, 0]),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map(n => pieza('cil', { h: 0.75, dt: 0.02, db: 0.18, t: 4 }, n % 2 ? '#b9c79d' : '#a7b88c',
        [Math.sin(n * Math.PI / 4) * 0.22, 1.62, Math.cos(n * Math.PI / 4) * 0.22], [Math.cos(n * Math.PI / 4) * 0.75, 0, -Math.sin(n * Math.PI / 4) * 0.75])),
      pieza('cil', { h: 0.6, dt: 0.02, db: 0.16, t: 4 }, '#c5d2aa', [0, 1.75, 0]),
    ]),
    frailejonFlor: unir('frailejon-flor', [
      pieza('cil', { h: 1.9, dt: 0.36, db: 0.46, t: 7 }, '#86704f', [0, 0.95, 0]),
      pieza('cil', { h: 0.3, dt: 0.46, db: 0.38, t: 7 }, '#a08a63', [0, 1.9, 0]),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map(n => pieza('cil', { h: 0.8, dt: 0.02, db: 0.18, t: 4 }, n % 2 ? '#b9c79d' : '#a7b88c',
        [Math.sin(n * Math.PI / 4) * 0.24, 2.22, Math.cos(n * Math.PI / 4) * 0.24], [Math.cos(n * Math.PI / 4) * 0.8, 0, -Math.sin(n * Math.PI / 4) * 0.8])),
      pieza('cil', { h: 0.9, d: 0.03, t: 4 }, '#8c9a6a', [0.1, 2.6, 0], [0, 0, -0.2]),
      pieza('cil', { h: 0.8, d: 0.03, t: 4 }, '#8c9a6a', [-0.1, 2.55, 0.05], [0.1, 0, 0.25]),
      pieza('esfera', { d: 0.2, seg: 4 }, '#f2c94c', [0.19, 3.0, 0]),
      pieza('esfera', { d: 0.2, seg: 4 }, '#f2c94c', [-0.2, 2.92, 0.06]),
      pieza('esfera', { d: 0.16, seg: 4 }, '#f5d76e', [0.0, 3.05, -0.12]),
    ]),
    piedra: unir('piedra', [pieza('ico', { r: 0.5, sub: 0 }, '#a19d92', [0, 0.18, 0], null, [1.2, 0.7, 1])]),
    piedraOscura: unir('piedra-oscura', [pieza('ico', { r: 0.5, sub: 0 }, '#7f7c74', [0, 0.18, 0], null, [1.1, 0.75, 1.2])]),
    flor: ['#f2c94c', '#e86a92', '#ffffff', '#9b7be0', '#f08a3c'].map((c, n) => unir('flor' + n, [
      pieza('cil', { h: 0.3, d: 0.03, t: 3 }, '#5f9e42', [0, 0.15, 0]),
      pieza('esfera', { d: [0.18, 0.08, 0.18], seg: 4 }, c, [0, 0.32, 0]),
      pieza('esfera', { d: 0.07, seg: 3 }, '#f7e08a', [0, 0.36, 0]),
    ])),
  };

  /* ---------- cielo, nubes y montañas lejanas ---------- */

  (function cielo() {
    const s = MB.CreateSphere('cielo', { diameter: 1600, segments: 16, sideOrientation: B.Mesh.BACKSIDE }, escena);
    const pos = s.getVerticesData(B.VertexBuffer.PositionKind), col = [];
    const h = hex(HORIZONTE), c = hex(CENIT);
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1] / 800;
      const k = B.Color3.Lerp(h, c, Math.pow(clamp(y, 0, 1), 0.55));
      col.push(k.r, k.g, k.b, 1);
    }
    s.setVerticesData(B.VertexBuffer.ColorKind, col);
    const m = new B.StandardMaterial('cielo', escena);
    m.disableLighting = true; m.emissiveColor = B.Color3.White(); m.fogEnabled = false; m.backFaceCulling = false;
    s.material = m; s.infiniteDistance = true; s.isPickable = false;
  })();

  const matNube = new B.StandardMaterial('nube', escena);
  matNube.diffuseColor = B.Color3.White(); matNube.emissiveColor = hex('#d9dde3'); matNube.specularColor = B.Color3.Black();
  matNube.fogEnabled = false; matNube.alpha = 0.95;
  const nubes = [];
  for (let n = 0; n < 12; n++) {
    const partes = [];
    const k = 3 + Math.floor(rnd() * 3);
    for (let q = 0; q < k; q++) partes.push(pieza('ico', { r: entre(4, 8), sub: 1 }, '#ffffff', [q * 6 - k * 3 + entre(-1, 1), entre(-1, 2), entre(-2, 2)], null, [1, 0.6, 0.8]));
    const m = unir('nube', partes);
    m.material = matNube;
    m.position.set(entre(-250, 250), entre(70, 110), entre(-100, 420));
    nubes.push({ m, v: entre(0.6, 1.4) });
  }

  (function montanas() {
    const lista = [];
    const colores = ['#8fae98', '#97b2ad', '#9db3c2', '#a9bccb', '#8ea7b4'];
    const matMonte = matVC.clone('montes'); matMonte.fogEnabled = false;
    for (let n = 0; n < 70; n++) {
      const ang = n / 70 * Math.PI * 2 + entre(-0.03, 0.03);
      const rx = entre(200, 280), rz = entre(260, 330);
      const x = Math.sin(ang) * rx, z = 110 + Math.cos(ang) * rz;
      const h = entre(40, 95) * (z > 250 ? 1.4 : 1);
      lista.push({ x, z, h, w: entre(90, 150) });
    }
    // una malla por tono, sembrada con todas las montañas de ese color
    colores.forEach((c, ci) => {
      const m = unir('montanas-' + ci, [
        pieza('cil', { h: 1, dt: 0.0, db: 1, t: 7 }, c, [0, 0.5, 0]),
        pieza('cil', { h: 0.6, dt: 0.0, db: 0.6, t: 6 }, mezclar(c, '#ffffff', 0.1), [0.3, 0.3, 0.12]),
      ]);
      m.material = matMonte;
      sembrar(m, lista.filter((_, n) => n % colores.length === ci).map(l => ({ x: l.x, y: -6, z: l.z, sx: l.w, sy: l.h, sz: l.w * 0.8, ry: l.x })));
    });
  })();

  /* ---------- agua ---------- */

  const matAgua = new B.StandardMaterial('agua', escena);
  // poco difuso y bastante emisivo: el agua se ve del mismo azul desde cualquier lado
  matAgua.diffuseColor = hex('#163c56'); matAgua.specularColor = hex('#cfefff'); matAgua.specularPower = 80;
  matAgua.emissiveColor = hex('#2a74a8'); matAgua.alpha = 0.88; matAgua.backFaceCulling = false;
  const aguas = [];
  (function rio() {
    const lineas = [-3.4, 0, 3.4].map(o => {
      const l = [];
      for (let x = X0 + 2; x <= X1 - 2; x += 2) {
        const z = zRio(x);
        l.push(new B.Vector3(x, alturaBase(x, z) - 0.85, z + o));
      }
      return l;
    });
    const m = MB.CreateRibbon('rio', { pathArray: lineas }, escena);
    m.material = matAgua; m.isPickable = false; m.freezeWorldMatrix();
    aguas.push(m);
  })();
  CHARCOS.forEach((c, n) => {
    const m = MB.CreateDisc('charco' + n, { radius: c.r + 0.9, tessellation: 22 }, escena);
    m.rotation.x = Math.PI / 2;
    m.position.set(c.x, alturaBase(c.x, c.z) - c.prof * 0.45, c.z);
    m.material = matAgua; m.isPickable = false; m.freezeWorldMatrix();
    aguas.push(m);
    COLISIONES.push({ x: c.x, z: c.z, r: c.r * 0.75 });
  });
  (function quebrada() {
    const lineas = [-0.95, 0.95].map(o => QUEBRADA.map((p, n) => {
      const a = QUEBRADA[Math.max(0, n - 1)], b = QUEBRADA[Math.min(QUEBRADA.length - 1, n + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = (b.z - a.z) / l, nz = -(b.x - a.x) / l;
      return new B.Vector3(p.x + nx * o, alturaBase(p.x, p.z) - 0.32, p.z + nz * o);
    }));
    const m = MB.CreateRibbon('quebrada', { pathArray: lineas }, escena);
    m.material = matAgua; m.isPickable = false; m.freezeWorldMatrix();
  })();

  /* ---------- el camino de tierra ---------- */

  const matCamino = new B.StandardMaterial('camino', escena);
  matCamino.diffuseColor = hex('#a8916c'); matCamino.specularColor = B.Color3.Black(); matCamino.emissiveColor = hex('#140e08');
  matCamino.zOffset = -2; matCamino.backFaceCulling = false;
  const matBorde = new B.StandardMaterial('borde', escena);
  matBorde.diffuseColor = hex('#9a7247'); matBorde.specularColor = B.Color3.Black(); matBorde.zOffset = -1; matBorde.backFaceCulling = false;
  (function camino() {
    // se corta donde está el puente; cada tramo es una cinta que sigue el suelo
    const tramos = [[0, PUENTE.k1], [PUENTE.k2, NP - 1]];
    const cinta = (nombre, ancho, alto, mat) => tramos.forEach(([a, b], n) => {
      const ofs = [-1, -0.5, 0, 0.5, 1].map(f => f * ancho / 2);
      const lineas = ofs.map(o => {
        const l = [];
        for (let k = a; k <= b; k++) {
          const p = P[k], x = p.x + p.nx * o, z = p.z + p.nz * o;
          l.push(new B.Vector3(x, alturaSuelo(x, z) + alto, z));
        }
        return l;
      });
      const m = MB.CreateRibbon(nombre + n, { pathArray: lineas }, escena);
      m.material = mat; m.isPickable = false; m.freezeWorldMatrix();
    });
    cinta('borde', 3.7, 0.1, matBorde);
    cinta('camino', 2.8, 0.14, matCamino);
    // piedritas a la orilla del camino
    const pied = [];
    for (let k = 0; k < NP; k += 3) {
      if (k > PUENTE.k1 - 2 && k < PUENTE.k2 + 2) continue;
      const p = P[k], s = rnd() < 0.5 ? -1 : 1, o = s * entre(1.8, 2.2);
      const x = p.x + p.nx * o, z = p.z + p.nz * o;
      if (rnd() < 0.55) pied.push({ ...enSuelo(x, z, 0.02), s: entre(0.25, 0.5), ry: rnd() * 6 });
    }
    sembrar(unir('piedritas', [pieza('ico', { r: 0.5, sub: 0 }, '#c9c1ad', [0, 0.1, 0], null, [1.2, 0.5, 1])]), pied);
  })();

  // puente de madera arqueado
  (function puente() {
    const yaw = yawDe(PUENTE.dx, PUENTE.dz);
    const tablas = [], postes = [], barandas = [];
    const n = Math.ceil(PUENTE.largo / 0.42);
    for (let q = 0; q <= n; q++) {
      const u = q / n, x = lerp(PUENTE.a.x, PUENTE.b.x, u), z = lerp(PUENTE.a.z, PUENTE.b.z, u);
      const du = 0.01, inc = Math.atan2(alturaPuente(u + du) - alturaPuente(u - du), 2 * du * PUENTE.largo);
      tablas.push({ x, y: alturaPuente(u), z, ry: yaw, rx: -inc, sx: 1 + (q % 2) * 0.06 });
      if (q % 3 === 0) [-1, 1].forEach(s => postes.push({ x: x + PUENTE.dz * s * 1.45, y: alturaPuente(u), z: z - PUENTE.dx * s * 1.45, ry: yaw }));
      if (q < n && q % 3 === 0) {
        const u2 = Math.min(1, (q + 3) / n), x2 = lerp(PUENTE.a.x, PUENTE.b.x, u2), z2 = lerp(PUENTE.a.z, PUENTE.b.z, u2);
        const y1 = alturaPuente(u) + 0.85, y2 = alturaPuente(u2) + 0.85;
        const l = Math.hypot(x2 - x, z2 - z);
        [-1, 1].forEach(s => barandas.push({ x: (x + x2) / 2 + PUENTE.dz * s * 1.45, y: (y1 + y2) / 2, z: (z + z2) / 2 - PUENTE.dx * s * 1.45, ry: yaw, rx: -Math.atan2(y2 - y1, l), sz: l }));
      }
    }
    sembrar(unir('tabla', [pieza('caja', { w: 3.0, h: 0.14, d: 0.38 }, '#9a6a3c', [0, 0, 0])]), tablas);
    sembrar(unir('poste-puente', [pieza('caja', { w: 0.14, h: 1.0, d: 0.14 }, '#7a5230', [0, 0.45, 0])]), postes);
    sembrar(unir('baranda', [pieza('caja', { w: 0.1, h: 0.1, d: 1 }, '#8a5f38', [0, 0, 0])]), barandas);
    [PUENTE.a, PUENTE.b].forEach(p => reservar(p.x, p.z, 3));
  })();

  /* ---------- decorado de cada estación ---------- */

  const EXTRA = { arbol: [], arbolGrande: [], arbolAlto: [], encenillo: [], arbusto: [], musgo: [], pasto: [], pajonal: [], junco: [], frailejon: [], frailejonFlor: [], piedra: [], piedraOscura: [], flor: [[], [], [], [], []] };
  const conColision = (lista, it, r) => { lista.push(it); COLISIONES.push({ x: it.x, z: it.z, r }); };

  // giro para que algo en el marco de la estación mire hacia el camino (−a)
  function yawHaciaCamino(i, a) { const p = P[EST[i].k]; const s = a > 0 ? -1 : 1; return yawDe(p.nx * s, p.nz * s); }
  const yawCamino = i => { const p = P[EST[i].k]; return yawDe(p.tx, p.tz); };

  // 1 · La entrada: casa campesina, cerca de madera, árbol grande, vacas en el potrero
  (function entrada() {
    const i = 0;
    const c = lugar(i, -11, 2), y = alturaSuelo(c.x, c.z);
    const casa = unir('casa', [
      pieza('caja', { w: 7, h: 0.7, d: 4.6 }, '#b5523b', [0, 0.35, 0]),
      pieza('caja', { w: 6.9, h: 2.4, d: 4.5 }, '#f6f2e9', [0, 1.9, 0]),
      pieza('cil', { h: 8.2, d: 4.2, t: 3 }, '#b8553a', [0, 3.85, 0], [0, 0, Math.PI / 2], [1, 1, 1.45]),
      pieza('caja', { w: 8.3, h: 0.18, d: 0.3 }, '#8e3f2a', [0, 4.9, 0]),
      pieza('caja', { w: 1.1, h: 1.9, d: 0.1 }, '#6b4226', [0, 1.25, 2.27]),
      pieza('caja', { w: 1.35, h: 2.1, d: 0.06 }, '#3b6ea8', [0, 1.3, 2.25]),
      pieza('caja', { w: 1.0, h: 0.9, d: 0.08 }, '#9fd0e8', [-2.2, 1.9, 2.27]),
      pieza('caja', { w: 1.25, h: 1.1, d: 0.05 }, '#3b6ea8', [-2.2, 1.9, 2.25]),
      pieza('caja', { w: 1.0, h: 0.9, d: 0.08 }, '#9fd0e8', [2.2, 1.9, 2.27]),
      pieza('caja', { w: 1.25, h: 1.1, d: 0.05 }, '#3b6ea8', [2.2, 1.9, 2.25]),
      pieza('caja', { w: 0.6, h: 1.3, d: 0.6 }, '#e9e1d2', [2.2, 5.0, -0.6]),
      // corredor con pilares de madera
      pieza('caja', { w: 7.6, h: 0.1, d: 1.6 }, '#a7623f', [0, 2.95, 3.0], [0.22, 0, 0]),
      pieza('cil', { h: 2.8, d: 0.16, t: 6 }, '#7a5230', [-3.4, 1.4, 3.6]),
      pieza('cil', { h: 2.8, d: 0.16, t: 6 }, '#7a5230', [0, 1.4, 3.6]),
      pieza('cil', { h: 2.8, d: 0.16, t: 6 }, '#7a5230', [3.4, 1.4, 3.6]),
      // materas con geranios
      pieza('cil', { h: 0.4, dt: 0.4, db: 0.3, t: 7 }, '#b5623a', [-1.2, 0.9, 2.7]),
      pieza('ico', { r: 0.28, sub: 1 }, '#e0414f', [-1.2, 1.25, 2.7]),
      pieza('cil', { h: 0.4, dt: 0.4, db: 0.3, t: 7 }, '#b5623a', [1.2, 0.9, 2.7]),
      pieza('ico', { r: 0.28, sub: 1 }, '#ef6a9a', [1.2, 1.25, 2.7]),
    ]);
    casa.position.set(c.x, y - 0.25, c.z);
    casa.rotation.y = yawHaciaCamino(i, -11);
    casa.freezeWorldMatrix();
    COLISIONES.push({ x: c.x, z: c.z, r: 3.9 });
    reservar(c.x, c.z, 7);
    // árbol grande junto a Doña Rosa
    const ar = lugar(i, 5.5, -1.5);
    conColision(EXTRA.arbolGrande, { ...enSuelo(ar.x, ar.z), s: 1.1, ry: 1 }, 0.9);
    reservar(ar.x, ar.z, 4);
    // cerca de madera a ambos lados (con portón frente a la casa)
    const postes = [], varas = [];
    const cerca = (a, b0, b1) => {
      for (let b = b0; b <= b1; b += 2.2) {
        const p = lugar(i, a, b), q = lugar(i, a, b + 2.2);
        const y1 = alturaSuelo(p.x, p.z), y2 = alturaSuelo(q.x, q.z);
        postes.push({ x: p.x, y: y1, z: p.z, ry: rnd() });
        if (b + 2.2 <= b1 + 0.01) {
          const l = Math.hypot(q.x - p.x, q.z - p.z), ry = yawDe(q.x - p.x, q.z - p.z), rx = -Math.atan2(y2 - y1, l);
          [0.55, 0.95].forEach(h => varas.push({ x: (p.x + q.x) / 2, y: (y1 + y2) / 2 + h, z: (p.z + q.z) / 2, ry, rx, sz: l }));
        }
      }
    };
    cerca(-2.7, -16, -2.2); cerca(-2.7, 4.4, 15);
    cerca(2.7, 3, 18);
    sembrar(unir('poste', [pieza('cil', { h: 1.25, d: 0.16, t: 5 }, '#7a5636', [0, 0.6, 0])]), postes);
    sembrar(unir('vara', [pieza('caja', { w: 0.08, h: 0.08, d: 1 }, '#93683f', [0, 0, 0])]), varas);
    // letrero de bienvenida al comienzo del camino
    const lt = { x: P[10].x + P[10].nx * 3.9, z: P[10].z + P[10].nz * 3.9 };
    const tex = new B.DynamicTexture('letrero', { width: 512, height: 256 }, escena, true);
    const g = tex.getContext();
    g.fillStyle = '#8a5a33'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#a7703f'; for (let n = 0; n < 6; n++) g.fillRect(0, n * 44 + 10, 512, 4);
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 242);
    g.fillStyle = '#fff6df'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 54px "Baloo 2", "Segoe UI", sans-serif'; g.fillText('Parque Arqueológico', 256, 92);
    g.font = 'bold 38px "Baloo 2", "Segoe UI", sans-serif'; g.fillText('de Usme · Hacienda El Carmen', 256, 166);
    tex.update();
    const mt = new B.StandardMaterial('letrero', escena);
    mt.diffuseTexture = tex; mt.emissiveColor = hex('#4a4a4a'); mt.specularColor = B.Color3.Black(); mt.backFaceCulling = false;
    const tabla = MB.CreatePlane('tabla', { width: 2.6, height: 1.3, sideOrientation: B.Mesh.DOUBLESIDE }, escena);
    tabla.material = mt;
    const yl = alturaSuelo(lt.x, lt.z);
    tabla.position.set(lt.x, yl + 1.65, lt.z);
    tabla.rotation.y = yawDe(P[10].tx, P[10].tz) - 0.45;
    tabla.isPickable = false; tabla.freezeWorldMatrix();
    const pal = unir('letrero-palos', [
      pieza('cil', { h: 2.3, d: 0.14, t: 5 }, '#6b4a2b', [-1.15, 1.15, 0.02]),
      pieza('cil', { h: 2.3, d: 0.14, t: 5 }, '#6b4a2b', [1.15, 1.15, 0.02]),
    ]);
    pal.position.set(lt.x, yl, lt.z); pal.rotation.y = tabla.rotation.y; pal.freezeWorldMatrix();
    reservar(lt.x, lt.z, 2);
    // vacas pastando
    VACAS.push(crearVaca(lugar(i, 13, -7), 0.6), crearVaca(lugar(i, 17, 5), 2.4));
  })();

  // 2 · El humedal: charco con juncos y flores de agua (Tita)
  (function humedal() {
    const i = 1, c = CHARCOS[0];
    for (let n = 0; n < 34; n++) {
      const ang = rnd() * Math.PI * 2, r = c.r + entre(0.2, 2.6);
      const x = c.x + Math.cos(ang) * r, z = c.z + Math.sin(ang) * r;
      if (dCamino(x, z) < 2.2) continue;
      EXTRA.junco.push({ ...enSuelo(x, z, -0.1), s: entre(0.8, 1.3), ry: rnd() * 6 });
    }
    // juncos a la orilla del río, cerca del puente
    for (let n = 0; n < 90; n++) {
      const x = entre(-60, 50), z = zRio(x) + (rnd() < 0.5 ? -1 : 1) * entre(2.8, 5);
      if (dCamino(x, z) < 3) continue;
      EXTRA.junco.push({ ...enSuelo(x, z, -0.1), s: entre(0.7, 1.2), ry: rnd() * 6 });
    }
    // hojas flotantes en el charco
    const hojas = [];
    for (let n = 0; n < 7; n++) { const ang = rnd() * 6.28, r = rnd() * c.r * 0.8; hojas.push({ x: c.x + Math.cos(ang) * r, y: alturaBase(c.x, c.z) - c.prof * 0.45 + 0.03, z: c.z + Math.sin(ang) * r, ry: rnd() * 6, s: entre(0.6, 1) }); }
    sembrar(unir('hoja-agua', [
      pieza('cil', { h: 0.03, d: 0.8, t: 9 }, '#5c9e46', [0, 0, 0]),
      pieza('esfera', { d: [0.2, 0.1, 0.2], seg: 4 }, '#f4b8cf', [0.15, 0.06, 0.1]),
    ]), hojas);
    reservar(c.x, c.z, c.r + 1);
  })();

  // 3 · El lugar de los ancestros: explanada, círculo de piedras, excavación y vasijas (Julián)
  (function ancestros() {
    const i = 2;
    const cc = lugar(i, 9.5, 2);
    PARCHES.push({ ...lugar(i, 6, 0), r: 13, c: hex('#c2c27a'), f: 0.55 });
    const piedras = [];
    for (let n = 0; n < 11; n++) {
      const ang = n / 11 * Math.PI * 2, x = cc.x + Math.cos(ang) * 3.8, z = cc.z + Math.sin(ang) * 3.8;
      piedras.push({ ...enSuelo(x, z, -0.1), ry: ang, sy: entre(0.85, 1.25), s: 1 });
      COLISIONES.push({ x, z, r: 0.45 });
    }
    sembrar(unir('menhir', [pieza('ico', { r: 0.5, sub: 0 }, '#a99f8a', [0, 0.6, 0], null, [0.8, 1.6, 0.55])]), piedras);
    const centro = unir('piedra-centro', [pieza('cil', { h: 0.35, dt: 1.5, db: 1.7, t: 8 }, '#b5ab95', [0, 0.1, 0])]);
    centro.position.set(cc.x, alturaSuelo(cc.x, cc.z), cc.z); centro.freezeWorldMatrix();
    reservar(cc.x, cc.z, 6);
    // excavación con cuadrícula de cuerdas y estacas
    const ex = lugar(i, 6.2, -5), ye = alturaSuelo(ex.x, ex.z), yawE = yawCamino(i);
    const exc = unir('excavacion', [
      pieza('caja', { w: 3.2, h: 0.12, d: 2.4 }, '#6e4f33', [0, 0.02, 0]),
      ...[-1.6, 1.6].flatMap(xx => [-1.2, 1.2].map(zz => pieza('cil', { h: 0.5, d: 0.06, t: 4 }, '#d8c49a', [xx, 0.2, zz]))),
      pieza('caja', { w: 3.2, h: 0.02, d: 0.02 }, '#f4efe2', [0, 0.38, -1.2]),
      pieza('caja', { w: 3.2, h: 0.02, d: 0.02 }, '#f4efe2', [0, 0.38, 1.2]),
      pieza('caja', { w: 3.2, h: 0.02, d: 0.02 }, '#f4efe2', [0, 0.38, 0]),
      pieza('caja', { w: 0.02, h: 0.02, d: 2.4 }, '#f4efe2', [-1.6, 0.38, 0]),
      pieza('caja', { w: 0.02, h: 0.02, d: 2.4 }, '#f4efe2', [1.6, 0.38, 0]),
      pieza('caja', { w: 0.02, h: 0.02, d: 2.4 }, '#f4efe2', [0, 0.38, 0]),
      pieza('esfera', { d: [0.5, 0.18, 0.3], seg: 4 }, '#b5623a', [0.7, 0.1, 0.5]),
      pieza('caja', { w: 0.6, h: 0.08, d: 0.25 }, '#7d7d7d', [-1.0, 0.1, -0.6], [0, 0.5, 0]),
    ]);
    exc.position.set(ex.x, ye, ex.z); exc.rotation.y = yawE; exc.freezeWorldMatrix();
    reservar(ex.x, ex.z, 3);
    // vasijas de barro con franjas
    const vasija = (sitio, esc, giro) => {
      const m = unir('vasija', [
        pieza('torno', { forma: [[0, 0], [0.22, 0.02], [0.36, 0.25], [0.34, 0.5], [0.2, 0.68], [0.16, 0.78], [0.22, 0.86], [0, 0.86]], t: 10 }, '#b86a3e', [0, 0, 0]),
        pieza('cil', { h: 0.07, dt: 0.66, db: 0.71, t: 10 }, '#6a3a22', [0, 0.36, 0]),
        pieza('cil', { h: 0.05, dt: 0.42, db: 0.5, t: 10 }, '#efd9b0', [0, 0.6, 0]),
      ]);
      m.position.set(sitio.x, alturaSuelo(sitio.x, sitio.z), sitio.z); m.scaling.setAll(esc); m.rotation.y = giro; m.freezeWorldMatrix();
      COLISIONES.push({ x: sitio.x, z: sitio.z, r: 0.35 * esc });
    };
    vasija(lugar(i, 4.2, -2.6), 1.1, 0); vasija(lugar(i, 8.7, -3.4), 0.9, 1); vasija(lugar(i, 4.6, -7.4), 1.2, 2); vasija(lugar(i, 5.4, -1.6), 0.7, 3);
  })();

  // 4 · La quebrada: bosque altoandino de árboles bajos, musgo y piedras en el agua (Rita)
  (function quebradaBosque() {
    const i = 3;
    QUEBRADA.forEach((p, n) => {
      if (n % 2 === 0) EXTRA.piedraOscura.push({ ...enSuelo(p.x + entre(-1, 1), p.z + entre(-1, 1), -0.15), s: entre(0.6, 1.1), ry: rnd() * 6 });
      EXTRA.musgo.push({ ...enSuelo(p.x + entre(1.4, 2.4) * (rnd() < 0.5 ? -1 : 1), p.z, -0.05), s: entre(0.7, 1.2), ry: rnd() * 6 });
    });
    const tr = lugar(i, -7.3, 2.6);
    conColision(EXTRA.encenillo, { ...enSuelo(tr.x, tr.z), s: 1.25, ry: 2 }, 0.4);
    reservar(lugar(i, -2.4, 0).x, lugar(i, -2.4, 0).z, 3);
    // bosque tupido alrededor
    for (let n = 0; n < 260; n++) {
      const x = entre(-48, 40), z = entre(98, 140);
      if (!libre(x, z, 4.2) || distPolilinea(QUEBRADA, x, z) < 1.8) continue;
      const r = rnd();
      if (r < 0.7) conColision(EXTRA.encenillo, { ...enSuelo(x, z, -0.1), s: entre(0.85, 1.4), ry: rnd() * 6 }, 0.35);
      else if (r < 0.85) EXTRA.musgo.push({ ...enSuelo(x, z, -0.05), s: entre(0.8, 1.4), ry: rnd() * 6 });
      else EXTRA.arbusto.push({ ...enSuelo(x, z, -0.05), s: entre(0.7, 1.1), ry: rnd() * 6 });
    }
  })();

  // 5 · La huerta: surcos de papa y maíz, espantapájaros y círculo de piedras para mirar el sol (Cuqui)
  (function huerta() {
    const i = 4;
    PARCHES.push({ ...lugar(i, 9.5, 0), r: 11, c: hex('#8d6a44'), f: 0.85 });
    const montones = [], papas = [], maices = [];
    const yaw = yawCamino(i);
    for (let fila = 0; fila < 7; fila++) {
      const a = 5.2 + fila * 1.45;
      for (let b = -8; b <= 8; b += 1.1) {
        const p = lugar(i, a, b);
        montones.push({ ...enSuelo(p.x, p.z, -0.05), ry: yaw, s: 1 });
        if (fila < 3) papas.push({ ...enSuelo(p.x, p.z, 0.08), ry: rnd() * 6, s: entre(0.8, 1.1) });
        else maices.push({ ...enSuelo(p.x, p.z, 0.05), ry: rnd() * 6, s: entre(0.85, 1.15) });
      }
    }
    sembrar(unir('monton', [pieza('esfera', { d: [0.8, 0.35, 1.3], seg: 5 }, '#6b4a2e', [0, 0.05, 0])]), montones);
    sembrar(unir('papa', [
      pieza('ico', { r: 0.32, sub: 1 }, '#3f8a3a', [0, 0.22, 0], null, [1.2, 0.8, 1.2]),
      pieza('ico', { r: 0.22, sub: 0 }, '#4f9c44', [0.2, 0.3, 0.1]),
      pieza('esfera', { d: 0.09, seg: 3 }, '#ffffff', [0.1, 0.48, 0.1]),
      pieza('esfera', { d: 0.09, seg: 3 }, '#b591e0', [-0.15, 0.43, -0.05]),
    ]), papas);
    sembrar(unir('maiz', [
      pieza('cil', { h: 1.9, dt: 0.04, db: 0.08, t: 5 }, '#86ad4c', [0, 0.95, 0]),
      pieza('caja', { w: 0.08, h: 0.02, d: 0.7 }, '#76a444', [0, 0.8, 0.3], [-0.5, 0, 0]),
      pieza('caja', { w: 0.08, h: 0.02, d: 0.7 }, '#6c9a3e', [0, 1.1, -0.3], [0.5, 0, 0]),
      pieza('caja', { w: 0.7, h: 0.02, d: 0.08 }, '#76a444', [0.3, 1.35, 0], [0, 0, 0.5]),
      pieza('caja', { w: 0.7, h: 0.02, d: 0.08 }, '#86b04e', [-0.3, 0.6, 0], [0, 0, -0.5]),
      pieza('esfera', { d: [0.13, 0.32, 0.13], seg: 4 }, '#f2c94c', [0.09, 1.05, 0.05], [0, 0, -0.3]),
      pieza('esfera', { d: [0.12, 0.2, 0.12], seg: 3 }, '#9cbf5a', [0.1, 0.95, 0.05], [0, 0, -0.3]),
      pieza('cil', { h: 0.35, dt: 0, db: 0.08, t: 4 }, '#d9c27a', [0, 2.05, 0]),
    ]), maices);
    reservar(lugar(i, 9.5, 0).x, lugar(i, 9.5, 0).z, 11);
    // espantapájaros con ruana
    const es = lugar(i, 9.6, 10.5);
    const esp = unir('espantapajaros', [
      pieza('cil', { h: 2.2, d: 0.1, t: 5 }, '#7a5636', [0, 1.1, 0]),
      pieza('cil', { h: 1.8, d: 0.08, t: 5 }, '#7a5636', [0, 1.6, 0], [0, 0, Math.PI / 2]),
      pieza('cil', { h: 0.6, dt: 0.3, db: 1.0, t: 4 }, '#2e6da4', [0, 1.45, 0], [0, Math.PI / 4, 0], [1, 1, 0.7]),
      pieza('esfera', { d: 0.4, seg: 5 }, '#e3c98d', [0, 2.0, 0]),
      pieza('cil', { h: 0.03, d: 0.75, t: 10 }, '#d9c27a', [0, 2.18, 0]),
      pieza('cil', { h: 0.2, dt: 0.3, db: 0.36, t: 10 }, '#d9c27a', [0, 2.28, 0]),
      pieza('esfera', { d: 0.06, seg: 3 }, '#2a2a2a', [-0.08, 2.04, 0.18]),
      pieza('esfera', { d: 0.06, seg: 3 }, '#2a2a2a', [0.08, 2.04, 0.18]),
    ]);
    esp.position.set(es.x, alturaSuelo(es.x, es.z), es.z); esp.rotation.y = yawHaciaCamino(i, 9.6); esp.freezeWorldMatrix();
    COLISIONES.push({ x: es.x, z: es.z, r: 0.3 });
    // círculo de piedras para mirar el sol, con una piedra alta en el centro
    const cs = lugar(i, -8, 2), piedras = [];
    for (let n = 0; n < 10; n++) {
      const ang = n / 10 * Math.PI * 2, x = cs.x + Math.cos(ang) * 2.6, z = cs.z + Math.sin(ang) * 2.6;
      piedras.push({ ...enSuelo(x, z, -0.05), ry: ang, s: entre(0.75, 1) });
    }
    sembrar(unir('piedra-sol', [pieza('ico', { r: 0.4, sub: 0 }, '#b9b09a', [0, 0.25, 0], null, [1, 0.9, 0.8])]), piedras);
    const gn = unir('gnomon', [
      pieza('cil', { h: 1.9, dt: 0.18, db: 0.4, t: 5 }, '#a59c86', [0, 0.95, 0]),
      pieza('cil', { h: 0.12, d: 1.2, t: 10 }, '#c9bea3', [0, 0.04, 0]),
    ]);
    gn.position.set(cs.x, alturaSuelo(cs.x, cs.z), cs.z); gn.freezeWorldMatrix();
    COLISIONES.push({ x: cs.x, z: cs.z, r: 0.5 });
    reservar(cs.x, cs.z, 4.5);
  })();

  // 6 · El páramo: frailejones, pajonal, laguna y niebla (Tomás)
  (function paramo() {
    const i = 5;
    reservar(CHARCOS[1].x, CHARCOS[1].z, CHARCOS[1].r + 1.5);
    for (let n = 0; n < 420; n++) {
      const x = entre(-70, 60), z = entre(178, 250);
      if (!libre(x, z, 3)) continue;
      const r = rnd();
      if (r < 0.32) conColision(rnd() < 0.25 ? EXTRA.frailejonFlor : EXTRA.frailejon, { ...enSuelo(x, z, -0.05), s: entre(0.8, 1.35), ry: rnd() * 6 }, 0.35);
      else if (r < 0.9) EXTRA.pajonal.push({ ...enSuelo(x, z, -0.05), s: entre(0.8, 1.5), ry: rnd() * 6 });
      else EXTRA.piedra.push({ ...enSuelo(x, z, -0.1), s: entre(0.6, 1.6), ry: rnd() * 6 });
    }
    // frailejones a la orilla del camino, para que se vean de cerca
    for (let k = EST[5].k - 70; k < Math.min(NP, EST[5].k + 60); k += 7) {
      const p = P[k], s = rnd() < 0.5 ? -1 : 1, o = s * entre(3.4, 5);
      const x = p.x + p.nx * o, z = p.z + p.nz * o;
      if (libre(x, z, 3.2)) conColision(rnd() < 0.3 ? EXTRA.frailejonFlor : EXTRA.frailejon, { ...enSuelo(x, z, -0.05), s: entre(0.9, 1.3), ry: rnd() * 6 }, 0.35);
    }
  })();

  /* ---------- vegetación repartida por todo el valle ---------- */

  (function repartir() {
    for (let n = 0; n < 900; n++) {
      const x = entre(-95, 95), z = entre(-65, 180);
      if (z > 97 && z < 142) continue;              // allí ya está el bosque
      if (!libre(x, z, Math.abs(x) > 40 ? 3 : 5)) continue;
      const r = rnd(), lejos = Math.abs(x) > 28;
      if (r < (lejos ? 0.5 : 0.12)) conColision(rnd() < 0.3 ? EXTRA.arbolAlto : EXTRA.arbol, { ...enSuelo(x, z, -0.1), s: entre(0.8, 1.3), ry: rnd() * 6 }, 0.4);
      else if (r < 0.22) EXTRA.arbusto.push({ ...enSuelo(x, z, -0.05), s: entre(0.7, 1.2), ry: rnd() * 6 });
      else if (r < 0.3) EXTRA.piedra.push({ ...enSuelo(x, z, -0.1), s: entre(0.5, 1.3), ry: rnd() * 6 });
    }
    // pasto y flores (más cerca del camino para que se vea vivo)
    for (let n = 0; n < 1400; n++) {
      const k = Math.floor(rnd() * NP), p = P[k];
      const o = (rnd() < 0.5 ? -1 : 1) * entre(2.3, 14);
      const x = p.x + p.nx * o + entre(-2, 2), z = p.z + p.nz * o + entre(-2, 2);
      if (!libre(x, z, 2.2)) continue;
      if (z > 182) { if (rnd() < 0.5) EXTRA.pajonal.push({ ...enSuelo(x, z, -0.05), s: entre(0.6, 1.1), ry: rnd() * 6 }); continue; }
      if (rnd() < 0.62) EXTRA.pasto.push({ ...enSuelo(x, z, -0.03), s: entre(0.8, 1.5), ry: rnd() * 6 });
      else EXTRA.flor[Math.floor(rnd() * 5)].push({ ...enSuelo(x, z, -0.02), s: entre(0.8, 1.3), ry: rnd() * 6 });
    }
  })();

  Object.keys(EXTRA).forEach(k => {
    if (k === 'flor') EXTRA.flor.forEach((l, n) => sembrar(PROTO.flor[n], l));
    else sembrar(PROTO[k], EXTRA[k]);
  });

  // el suelo se pinta de nuevo para incluir los parches de la huerta y la explanada
  (function repintarParches() {
    const col = suelo.getVerticesData(B.VertexBuffer.ColorKind), pos = suelo.getVerticesData(B.VertexBuffer.PositionKind);
    for (let n = 0; n < pos.length / 9; n++) {
      const cx = (pos[n * 9] + pos[n * 9 + 3] + pos[n * 9 + 6]) / 3, cz = (pos[n * 9 + 2] + pos[n * 9 + 5] + pos[n * 9 + 8]) / 3;
      for (const p of PARCHES) {
        const d = Math.hypot(cx - p.x, cz - p.z);
        if (d >= p.r) continue;
        const t = suave(p.r, p.r * 0.55, d) * p.f;
        for (let q = 0; q < 3; q++) {
          const o = (n * 3 + q) * 4;
          col[o] = lerp(col[o], p.c.r, t); col[o + 1] = lerp(col[o + 1], p.c.g, t); col[o + 2] = lerp(col[o + 2], p.c.b, t);
        }
      }
    }
    suelo.setVerticesData(B.VertexBuffer.ColorKind, col);
    suelo.freezeWorldMatrix();
  })();

  /* ---------- animales de ambiente: vacas, mariposas, pájaros y niebla ---------- */

  function crearVaca(sitio, giro) {
    const raiz = new B.TransformNode('vaca', escena);
    unir('vaca-cuerpo', [
      pieza('caja', { w: 0.9, h: 0.8, d: 1.7 }, '#f4f1ea', [0, 1.0, 0]),
      pieza('caja', { w: 0.92, h: 0.5, d: 0.6 }, '#3a2e28', [0, 1.15, 0.2]),
      pieza('caja', { w: 0.6, h: 0.4, d: 0.5 }, '#3a2e28', [0.16, 0.95, -0.55]),
      ...[[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]].map(([x, z]) => pieza('cil', { h: 0.65, d: 0.16, t: 5 }, '#e9e3d6', [x, 0.32, z])),
      pieza('esfera', { d: [0.3, 0.2, 0.3], seg: 4 }, '#f2a7b5', [0, 0.58, -0.3]),
      pieza('cil', { h: 0.6, d: 0.05, t: 4 }, '#3a2e28', [0, 1.1, -0.95], [0.6, 0, 0]),
    ], raiz);
    const cabeza = new B.TransformNode('vaca-cabeza', escena); cabeza.parent = raiz; cabeza.position.set(0, 1.15, 0.85);
    unir('vaca-cara', [
      pieza('caja', { w: 0.5, h: 0.45, d: 0.6 }, '#f4f1ea', [0, 0, 0.25]),
      pieza('caja', { w: 0.52, h: 0.25, d: 0.25 }, '#f0b9a8', [0, -0.12, 0.55]),
      pieza('caja', { w: 0.3, h: 0.1, d: 0.1 }, '#e9e3d6', [-0.3, 0.2, 0.1]),
      pieza('caja', { w: 0.3, h: 0.1, d: 0.1 }, '#e9e3d6', [0.3, 0.2, 0.1]),
      pieza('esfera', { d: 0.07, seg: 3 }, '#1a1a1a', [-0.18, 0.08, 0.5]),
      pieza('esfera', { d: 0.07, seg: 3 }, '#1a1a1a', [0.18, 0.08, 0.5]),
    ], cabeza);
    raiz.position.set(sitio.x, alturaSuelo(sitio.x, sitio.z), sitio.z);
    raiz.rotation.y = giro;
    COLISIONES.push({ x: sitio.x, z: sitio.z, r: 1.0 });
    return { raiz, cabeza, fase: rnd() * 10 };
  }

  const mariposas = [];
  (function () {
    const colores = ['#f2c94c', '#ffffff', '#f08a3c', '#9b7be0', '#e86a92'];
    const sitios = [lugar(0, 4, 4), lugar(0, -5, -8), lugar(1, -5, 4), lugar(4, 6, 2), lugar(4, -4, -6), lugar(2, 3, 6), lugar(4, 8, 8), lugar(0, 8, 10)];
    sitios.forEach((s, n) => {
      const raiz = new B.TransformNode('mariposa', escena);
      const alas = [-1, 1].map(lado => {
        const a = unir('ala', [pieza('esfera', { d: [0.32, 0.02, 0.26], seg: 4 }, colores[n % colores.length], [lado * 0.16, 0, 0])], raiz);
        return a;
      });
      mariposas.push({ raiz, alas, c: s, y: alturaSuelo(s.x, s.z) + 1.2, f: rnd() * 10, r: entre(1.5, 3) });
    });
  })();

  const pajaros = [];
  for (let n = 0; n < 6; n++) {
    const raiz = new B.TransformNode('pajaro', escena);
    const alas = [-1, 1].map(s => unir('ala-p', [pieza('caja', { w: 0.9, h: 0.05, d: 0.3 }, '#3a3a44', [s * 0.45, 0, 0])], raiz));
    pajaros.push({ raiz, alas, c: { x: entre(-40, 40), z: entre(0, 220) }, y: entre(30, 45), r: entre(12, 30), f: rnd() * 10, v: entre(0.15, 0.3) });
  }

  const matNiebla = new B.StandardMaterial('niebla', escena);
  matNiebla.diffuseColor = B.Color3.White(); matNiebla.emissiveColor = hex('#e8ecee'); matNiebla.alpha = 0.24;
  matNiebla.specularColor = B.Color3.Black(); matNiebla.disableLighting = true; matNiebla.backFaceCulling = true;
  const nieblas = [];
  {
    const proto = MB.CreateSphere('niebla', { segments: 6, diameter: 1 }, escena);
    proto.material = matNiebla; proto.isPickable = false; proto.setEnabled(false);
    for (let n = 0; n < 16; n++) {
      const m = proto.createInstance('nb' + n);
      m.setEnabled(true);
      let x = entre(-45, 35), z = entre(188, 250);
      // lejos del camino, para que no le tape la vista al avatar
      for (let t = 0; t < 20 && dCamino(x, z) < 12; t++) { x = entre(-50, 40); z = entre(188, 250); }
      m.scaling.set(entre(10, 18), entre(1.6, 3), entre(6, 10));
      m.position.set(x, alturaSuelo(x, z) + entre(1.5, 4), z);
      nieblas.push({ m, x0: x, v: entre(0.3, 0.8), f: rnd() * 10 });
    }
  }

  /* ---------- sombras redondas falsas ---------- */

  const texSombra = new B.DynamicTexture('sombra', { width: 64, height: 64 }, escena, false);
  {
    const g = texSombra.getContext(), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); texSombra.update(); texSombra.hasAlpha = true;
  }
  const matSombra = new B.StandardMaterial('sombra', escena);
  matSombra.diffuseTexture = texSombra; matSombra.useAlphaFromDiffuseTexture = true; matSombra.disableLighting = true;
  matSombra.emissiveColor = B.Color3.Black(); matSombra.specularColor = B.Color3.Black(); matSombra.zOffset = -4;
  function sombra(r) {
    const d = MB.CreateGround('sombra', { width: r * 2, height: r * 2 }, escena);
    d.material = matSombra; d.isPickable = false;
    return d;
  }

  /* ---------- personajes y marcadores de las estaciones ---------- */

  const ALTO_PJ = { rosa: 1.95, tita: 1.25, julian: 2.0, rita: 1.05, cuqui: 1.05, tomas: 1.7 };
  const texBrillo = new B.DynamicTexture('brillo', { width: 128, height: 128 }, escena, false);
  {
    const g = texBrillo.getContext(), gr = g.createRadialGradient(64, 64, 4, 64, 64, 63);
    gr.addColorStop(0, 'rgba(255,248,210,1)'); gr.addColorStop(0.35, 'rgba(255,214,90,0.55)'); gr.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); texBrillo.update(); texBrillo.hasAlpha = true;
  }

  function dibujarInsignia(tex, color, numero, hecha, siguiente) {
    const g = tex.getContext();
    g.clearRect(0, 0, 128, 128);
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fillStyle = hecha ? '#2f9a46' : color; g.fill();
    g.lineWidth = 9; g.strokeStyle = siguiente ? '#ffe36e' : '#ffffff'; g.stroke();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff';
    if (hecha) {
      g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(36, 66); g.lineTo(56, 86); g.lineTo(92, 44); g.stroke();
    } else {
      g.font = 'bold 74px "Baloo 2", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeText(String(numero), 64, 70);
      g.fillText(String(numero), 64, 70);
    }
    tex.update();
  }

  const PJ = EST.map((st, i) => {
    const e = E[i], id = e.personaje;
    const sitio = lugar(i, st.lado * 2.3, 0);
    const y = alturaSuelo(sitio.x, sitio.z);
    const fig = F.crearPersonaje(id);
    fig.raiz.position.set(sitio.x, y, sitio.z);
    const yaw0 = yawHaciaCamino(i, st.lado);
    fig.raiz.rotation.y = yaw0;
    const somb = sombra(id === 'tomas' ? 0.9 : 0.6);
    somb.position.set(sitio.x, y + 0.05, sitio.z); somb.freezeWorldMatrix();
    COLISIONES.push({ x: sitio.x, z: sitio.z, r: id === 'tomas' ? 0.7 : 0.5 });
    reservar(sitio.x, sitio.z, 3);

    // marcador: aro en el suelo, columna de luz suave, insignia con el número y flecha
    const col = hex(e.color);
    const matAro = new B.StandardMaterial('aro' + i, escena);
    matAro.diffuseColor = col; matAro.emissiveColor = col.scale(0.6); matAro.specularColor = B.Color3.Black();
    const aro = MB.CreateTorus('aro' + i, { diameter: 3.0, thickness: 0.16, tessellation: 28 }, escena);
    aro.material = matAro; aro.position.set(sitio.x, y + 0.14, sitio.z); aro.isPickable = false;
    // se inclina como el suelo para que no quede medio enterrado
    aro.rotation.x = Math.atan2(alturaSuelo(sitio.x, sitio.z + 1.5) - alturaSuelo(sitio.x, sitio.z - 1.5), 3);
    aro.rotation.z = -Math.atan2(alturaSuelo(sitio.x + 1.5, sitio.z) - alturaSuelo(sitio.x - 1.5, sitio.z), 3);

    const matCol = new B.StandardMaterial('columna' + i, escena);
    matCol.emissiveColor = col; matCol.diffuseColor = B.Color3.Black(); matCol.specularColor = B.Color3.Black();
    matCol.disableLighting = true; matCol.alpha = 0.18; matCol.fogEnabled = false;
    // la columna arranca encima de la insignia: se ve de lejos sin taparle la cara al personaje
    const altoIns = y + ALTO_PJ[id] + 0.75;
    const columna = MB.CreateCylinder('columna' + i, { height: 20, diameterTop: 0.6, diameterBottom: 1.2, tessellation: 14, cap: B.Mesh.NO_CAP }, escena);
    columna.material = matCol; columna.position.set(sitio.x, altoIns + 0.7 + 10, sitio.z); columna.isPickable = false;

    const tex = new B.DynamicTexture('insignia' + i, { width: 128, height: 128 }, escena, true);
    tex.hasAlpha = true;
    const matIns = new B.StandardMaterial('insignia' + i, escena);
    matIns.diffuseTexture = tex; matIns.useAlphaFromDiffuseTexture = true; matIns.emissiveColor = B.Color3.White();
    matIns.disableLighting = true; matIns.fogEnabled = false; matIns.backFaceCulling = false;
    const insignia = MB.CreatePlane('insignia' + i, { size: 1.0 }, escena);
    insignia.material = matIns; insignia.billboardMode = B.Mesh.BILLBOARDMODE_ALL; insignia.isPickable = false;
    insignia.position.set(sitio.x, altoIns, sitio.z);

    const matFlecha = new B.StandardMaterial('flecha' + i, escena);
    matFlecha.diffuseColor = hex('#ffd23f'); matFlecha.emissiveColor = hex('#c98a10'); matFlecha.specularColor = hex('#ffffff'); matFlecha.fogEnabled = false;
    const flecha = unir('flecha' + i, [
      pieza('cil', { h: 0.7, dt: 0.95, db: 0, t: 4 }, '#ffffff', [0, 0, 0]),
      pieza('cil', { h: 0.6, d: 0.38, t: 4 }, '#ffffff', [0, 0.62, 0]),
    ]);
    flecha.material = matFlecha;
    flecha.position.set(sitio.x, altoIns + 1.2, sitio.z);

    return { i, id, fig, sitio, y, yaw0, yaw: yaw0, aro, matAro, columna, matCol, tex, insignia, flecha, altoIns, col, estado: '' };
  });

  /* ---------- semillas escondidas ---------- */

  const SITIO_SEMILLA = [lugar(0, -15.6, 2.2), lugar(1, -9.4, 5.6), lugar(2, 8.6, -7.6), lugar(3, -9.2, 3.2), lugar(4, 11.0, -3.4), lugar(5, -8, 6)];
  const matSemilla = new B.StandardMaterial('semilla', escena);
  matSemilla.diffuseColor = hex('#ffd34d'); matSemilla.emissiveColor = hex('#b9790c'); matSemilla.specularColor = hex('#fff3c4'); matSemilla.specularPower = 24;
  const matHalo = new B.StandardMaterial('halo', escena);
  matHalo.diffuseTexture = texBrillo; matHalo.useAlphaFromDiffuseTexture = true; matHalo.emissiveColor = B.Color3.White();
  matHalo.disableLighting = true; matHalo.alphaMode = B.Engine.ALPHA_ADD; matHalo.backFaceCulling = false;
  const SEMILLAS = SITIO_SEMILLA.map((s, i) => {
    const y = alturaSuelo(s.x, s.z);
    const raiz = new B.TransformNode('semilla' + i, escena);
    raiz.position.set(s.x, y + 0.85, s.z);
    const m = MB.CreateSphere('semilla' + i, { diameterX: 0.34, diameterY: 0.5, diameterZ: 0.34, segments: 5 }, escena);
    m.convertToFlatShadedMesh();
    m.material = matSemilla; m.parent = raiz; m.isPickable = false;
    const hoja = MB.CreateSphere('hojita', { diameterX: 0.22, diameterY: 0.04, diameterZ: 0.12, segments: 3 }, escena);
    const matHoja = matVC;
    F.pintar(hoja, '#6fbf4a'); hoja.material = matHoja; hoja.parent = m; hoja.position.set(0.1, 0.26, 0); hoja.rotation.z = -0.5;
    const halo = MB.CreatePlane('halo' + i, { size: 1.5 }, escena);
    halo.material = matHalo; halo.billboardMode = B.Mesh.BILLBOARDMODE_ALL; halo.parent = raiz; halo.isPickable = false;
    reservar(s.x, s.z, 1.5);
    return { i, raiz, m, halo, x: s.x, z: s.z, y, recogida: false, t0: 0 };
  });

  /* ---------- migas de luz: muestran el camino hacia la próxima estación ---------- */

  const matMiga = new B.StandardMaterial('miga', escena);
  matMiga.emissiveColor = hex('#fff1a8'); matMiga.diffuseColor = B.Color3.Black(); matMiga.disableLighting = true; matMiga.alpha = 0.85;
  const protoMiga = MB.CreateSphere('miga', { diameter: 0.22, segments: 4 }, escena);
  protoMiga.material = matMiga; protoMiga.isPickable = false; protoMiga.setEnabled(false);
  const MIGAS = [];
  for (let n = 0; n < 14; n++) { const m = protoMiga.createInstance('miga' + n); m.setEnabled(false); MIGAS.push(m); }

  /* ---------- avatar ---------- */

  let AV = null, avatarClave = '';
  const sombraAv = sombra(0.55);
  const jugador = { x: P[4].x, z: P[4].z, yaw: yawDe(P[4].tx, P[4].tz), vel: 0 };

  function construirAvatar(cfg) {
    const tipo = (cfg && cfg.avatar) || GU.avatar().id;
    const ruana = GU.colorRuana();
    const clave = tipo + ruana;
    if (clave === avatarClave) return;
    avatarClave = clave;
    if (AV) AV.raiz.dispose(false, false);
    AV = F.crearAvatar(tipo, ruana);
    aplicarContorno();
  }

  /* ---------- configuración: contraste y menos movimiento ---------- */

  let reducir = false, contraste = false;
  function aplicarContorno() {
    const lista = [...PJ.flatMap(p => p.fig.mallas), ...(AV ? AV.mallas : [])];
    lista.forEach(m => { if (m.casco) m.casco.setEnabled(contraste); });
  }
  function aplicarConfig(cfg) {
    reducir = !!cfg.reducirMovimiento;
    const c = !!cfg.contraste;
    if (c !== contraste) {
      contraste = c;
      matCamino.diffuseColor = hex(c ? '#ead7a8' : '#a8916c');
      matCamino.emissiveColor = hex(c ? '#6a5a3a' : '#140e08');
      matBorde.diffuseColor = hex(c ? '#2a1c10' : '#9a7247');
      PJ.forEach(p => { p.matCol.alpha = c ? 0.3 : 0.18; });
    }
    aplicarContorno();
    construirAvatar(cfg);
  }
  GU.on('config', aplicarConfig);

  /* ---------- estados del juego ---------- */

  let empezado = false;
  let auto = null;           // caminata automática { pts, idx, destino }
  let charla = null;         // conversación abierta { i }
  let girarA = null;         // yaw al que vuelve la cámara después de una conversación
  let camYaw = jugador.yaw, tiempo = 0, tiempoInicio = 0, acumPaso = 0, orbita = 0;
  const camPos = new B.Vector3(0, 20, -60), camMira = new B.Vector3(0, 0, 0);

  GU.on('empezar', cfg => {
    construirAvatar(cfg);
    empezado = true;
    tiempoInicio = tiempo;
    jugador.x = P[4].x; jugador.z = P[4].z; jugador.yaw = yawDe(P[4].tx, P[4].tz);
    camYaw = jugador.yaw;
    colocarCamaraSeguir(1, 0.016);
  });

  GU.on('avanzar', i => {
    if (auto || charla || i < 0 || i >= EST.length) return;
    const destino = EST[i].k;
    const yo = masCercanoTotal(jugador.x, jugador.z);
    const pts = [];
    const paso = destino >= yo.k ? 2 : -2;
    for (let k = yo.k; paso > 0 ? k < destino : k > destino; k += paso) pts.push(P[k]);
    pts.push(P[destino]);
    auto = { pts, idx: 0, destino: i };
    girarA = null;
  });

  GU.on('conversacion', ({ indice, abierta }) => {
    if (abierta) {
      charla = { i: indice };
      auto = null;
    } else {
      charla = null;
      // la cámara vuelve detrás del avatar mirando camino arriba, hacia lo que sigue
      const k = EST[indice].k, p = P[Math.min(NP - 1, k + 8)], q = P[k];
      girarA = yawDe(p.x - q.x, p.z - q.z);
    }
  });

  GU.on('recogida', i => {
    const s = SEMILLAS[i];
    if (s && !s.recogida) { s.recogida = true; s.t0 = tiempo; }
  });

  /* ---------- cámara ---------- */

  const retrato = () => motor.getRenderHeight() > motor.getRenderWidth();
  function colocarCamaraSeguir(k, dt) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const dist = retrato() ? 7.8 : 7.2, alto = retrato() ? 4.1 : 3.5;
    const yA = alturaCaminar(jugador.x, jugador.z);
    let cx = jugador.x - fx * dist, cz = jugador.z - fz * dist;
    let cy = yA + alto;
    cy = Math.max(cy, alturaSuelo(cx, cz) + 1.2);
    camPos.x = lerp(camPos.x, cx, k); camPos.y = lerp(camPos.y, cy, k); camPos.z = lerp(camPos.z, cz, k);
    const mx = jugador.x + fx * 2.2, mz = jugador.z + fz * 2.2, my = yA + 1.2;
    camMira.x = lerp(camMira.x, mx, k); camMira.y = lerp(camMira.y, my, k); camMira.z = lerp(camMira.z, mz, k);
  }
  function colocarCamaraCharla(k) {
    const pj = PJ[charla.i];
    const ax = jugador.x, az = jugador.z, bx = pj.sitio.x, bz = pj.sitio.z;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let dx = bx - ax, dz = bz - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let px = dz, pz = -dx;                      // perpendicular a la línea avatar–personaje
    if ((camPos.x - mx) * px + (camPos.z - mz) * pz < 0) { px = -px; pz = -pz; }
    const yb = Math.max(alturaCaminar(ax, az), pj.y);
    const dist = retrato() ? 8.4 : 6.6;
    // un poco corrida hacia atrás del avatar y alta, para que el diálogo de abajo no los tape
    const cx = mx + px * dist - dx * 1.4, cz = mz + pz * dist - dz * 1.4;
    const cy = Math.max(yb + (retrato() ? 3.8 : 2.7), alturaSuelo(cx, cz) + 1.2);
    camPos.x = lerp(camPos.x, cx, k); camPos.y = lerp(camPos.y, cy, k); camPos.z = lerp(camPos.z, cz, k);
    const ty = yb + (retrato() ? -0.6 : 0.1);
    camMira.x = lerp(camMira.x, mx, k); camMira.y = lerp(camMira.y, ty, k); camMira.z = lerp(camMira.z, mz, k);
  }

  /* ---------- movimiento ---------- */

  const VEL = 4.4, VEL_AUTO = 6.5, RADIO_AV = 0.35;
  function resolverChoques() {
    for (const c of COLISIONES) {
      const dx = jugador.x - c.x, dz = jugador.z - c.z, r = c.r + RADIO_AV;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); jugador.x = c.x + dx / d * r; jugador.z = c.z + dz / d * r; }
    }
    // bordes invisibles del mundo
    jugador.x = clamp(jugador.x, -55, 55);
    jugador.z = clamp(jugador.z, -40, 238);
  }

  function moverLibre(dt) {
    const e = GU.entrada();
    if (!e.x && !e.y) return 0;
    girarA = null;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let dx = fx * (-e.y) + rx * e.x, dz = fz * (-e.y) + rz * e.x;
    const m = Math.hypot(dx, dz); if (m < 0.01) return 0;
    dx /= m; dz /= m;
    const v = VEL * Math.min(1, m);
    const x0 = jugador.x, z0 = jugador.z;
    jugador.x += dx * v * dt; jugador.z += dz * v * dt;
    resolverChoques();
    const rumbo = yawDe(dx, dz);
    jugador.yaw = angLerp(jugador.yaw, rumbo, 1 - Math.exp(-dt * 12));
    // la cámara se acomoda detrás de la dirección en que camina (nunca al ir hacia atrás)
    const adelante = Math.max(0, -e.y), lado = Math.abs(e.x);
    if (e.y < 0.25) camYaw = angLerp(camYaw, rumbo, 1 - Math.exp(-dt * (adelante * 0.9 + lado * 1.3)));
    // ayuda para los más pequeños: si camina adelante cerca del camino, la cámara sigue la curva
    const cerca = masCercano(jugador.x, jugador.z, 1);
    if (adelante > 0.3 && lado < 0.35 && cerca.k >= 0 && cerca.d < 5.5) {
      const p = P[cerca.k], sentido = (p.tx * dx + p.tz * dz) >= 0 ? 1 : -1;
      const q = P[clamp(cerca.k + sentido * 12, 0, NP - 1)];
      if (Math.hypot(q.x - jugador.x, q.z - jugador.z) > 1.5) camYaw = angLerp(camYaw, yawDe(q.x - jugador.x, q.z - jugador.z), 1 - Math.exp(-dt * 2.2));
    }
    return Math.hypot(jugador.x - x0, jugador.z - z0);
  }

  function moverAuto(dt) {
    let resto = VEL_AUTO * dt, recorrido = 0;
    let dirx = 0, dirz = 0;
    while (resto > 0 && auto.idx < auto.pts.length) {
      const t = auto.pts[auto.idx];
      const dx = t.x - jugador.x, dz = t.z - jugador.z, d = Math.hypot(dx, dz);
      if (d <= resto) { jugador.x = t.x; jugador.z = t.z; resto -= d; recorrido += d; auto.idx++; if (d > 0.001) { dirx = dx / d; dirz = dz / d; } }
      else { jugador.x += dx / d * resto; jugador.z += dz / d * resto; recorrido += resto; dirx = dx / d; dirz = dz / d; resto = 0; }
    }
    if (dirx || dirz) {
      jugador.yaw = angLerp(jugador.yaw, yawDe(dirx, dirz), 1 - Math.exp(-dt * 10));
      // la cámara mira hacia un punto un poco más adelante para girar suave en las curvas
      const q = auto.pts[Math.min(auto.pts.length - 1, auto.idx + 5)];
      const dq = Math.hypot(q.x - jugador.x, q.z - jugador.z);
      if (dq > 1) camYaw = angLerp(camYaw, yawDe(q.x - jugador.x, q.z - jugador.z), 1 - Math.exp(-dt * (reducir ? 6 : 2.5)));
    }
    if (auto.idx >= auto.pts.length) {
      const i = auto.destino;
      auto = null;
      const pj = PJ[i];
      jugador.yaw = yawDe(pj.sitio.x - jugador.x, pj.sitio.z - jugador.z);
      if (GU.config.control !== 'libre') GU.recoger(i);
      GU.llegar(i);
    }
    return recorrido;
  }

  /* ---------- cada cuadro ---------- */

  function actualizar(dt) {
    tiempo += dt;
    const sig = GU.siguiente();

    // personajes: animación tranquila y mirar al jugador cuando está cerca
    PJ.forEach(p => {
      p.fig.animar(tiempo);
      const dx = jugador.x - p.sitio.x, dz = jugador.z - p.sitio.z, d = Math.hypot(dx, dz);
      const objetivo = (empezado && d < 9) || (charla && charla.i === p.i) ? yawDe(dx, dz) : p.yaw0;
      p.yaw = angLerp(p.yaw, objetivo, 1 - Math.exp(-dt * 4));
      p.fig.raiz.rotation.y = p.yaw;
      // marcador según el estado: pendiente, siguiente o completada
      const hecha = GU.completada(p.i), esSig = p.i === sig;
      const clave = (hecha ? 'h' : '') + (esSig ? 's' : '');
      if (clave !== p.estado || !p.dibujada) {
        p.estado = clave; p.dibujada = true;
        dibujarInsignia(p.tex, E[p.i].color, p.i + 1, hecha, esSig);
        p.matAro.diffuseColor = hecha ? hex('#2f9a46') : p.col;
        p.matAro.emissiveColor = (hecha ? hex('#2f9a46') : p.col).scale(0.6);
        p.columna.setEnabled(!hecha);
      }
      const pulso = reducir ? 0.5 : 0.5 + 0.5 * Math.sin(tiempo * 3);
      if (esSig) {
        p.matCol.alpha = (contraste ? 0.3 : 0.2) + pulso * 0.18;
        p.flecha.position.y = p.altoIns + 1.15 + (reducir ? 0 : Math.sin(tiempo * 3.2) * 0.25);
        p.flecha.rotation.y = reducir ? 0 : tiempo * 1.5;
        const e = 1 + pulso * 0.12; p.aro.scaling.set(e, 1, e);
      } else {
        p.matCol.alpha = contraste ? 0.24 : 0.12;
        p.aro.scaling.set(1, 1, 1);
      }
      const deCerca = empezado && (d < 5 || (charla && charla.i === p.i));
      p.insignia.setEnabled(!deCerca);
      p.insignia.scaling.setAll(hecha ? 0.75 : 1);
      p.flecha.setEnabled(esSig && empezado && !deCerca);
    });

    // semillas: flotan y brillan; al recogerlas suben y desaparecen
    SEMILLAS.forEach(s => {
      if (!s.raiz.isEnabled()) return;
      if (s.recogida) {
        const t = (tiempo - s.t0) / 0.9;
        if (t >= 1) { s.raiz.setEnabled(false); return; }
        s.raiz.position.y = s.y + 0.85 + t * 2.2;
        s.raiz.scaling.setAll(1 + t * 0.6 - t * t * 1.4);
        s.m.rotation.y += dt * 12;
        return;
      }
      s.raiz.position.y = s.y + 0.85 + (reducir ? 0 : Math.sin(tiempo * 2 + s.i) * 0.12);
      s.m.rotation.y += dt * (reducir ? 0.6 : 1.8);
      s.halo.scaling.setAll(reducir ? 1 : 0.9 + Math.sin(tiempo * 3 + s.i) * 0.15);
    });

    // ambiente
    nubes.forEach(n => { n.m.position.x += n.v * dt; if (n.m.position.x > 280) n.m.position.x = -280; });
    nieblas.forEach(n => { n.m.position.x = n.x0 + Math.sin(tiempo * 0.05 * n.v + n.f) * 8; });
    mariposas.forEach(b => {
      const f = tiempo * 0.6 + b.f;
      b.raiz.position.set(b.c.x + Math.sin(f) * b.r, b.y + Math.sin(f * 2.3) * 0.4, b.c.z + Math.sin(f * 1.6) * b.r);
      b.raiz.rotation.y = f;
      const a = Math.sin(tiempo * 14 + b.f) * 0.9;
      b.alas[0].rotation.z = a; b.alas[1].rotation.z = -a;
    });
    pajaros.forEach(b => {
      const f = tiempo * b.v + b.f;
      b.raiz.position.set(b.c.x + Math.cos(f) * b.r, b.y, b.c.z + Math.sin(f) * b.r);
      b.raiz.rotation.y = -f;
      const a = Math.sin(tiempo * 5 + b.f) * 0.4;
      b.alas[0].rotation.z = a; b.alas[1].rotation.z = -a;
    });
    VACAS.forEach(v => { v.cabeza.rotation.x = 0.5 + Math.sin(tiempo * 0.7 + v.fase) * 0.35; });

    // antes de empezar: la cámara da vueltas lentas sobre la entrada (fondo del inicio)
    if (!empezado) {
      if (AV) { AV.raiz.position.set(jugador.x, alturaCaminar(jugador.x, jugador.z), jugador.z); AV.raiz.rotation.y = jugador.yaw; AV.animar(tiempo, dt, 0, 0); }
      sombraAv.position.set(jugador.x, alturaCaminar(jugador.x, jugador.z) + 0.05, jugador.z);
      if (!reducir) orbita += dt * 0.05;
      const c = lugar(0, -2, 6), yc = alturaSuelo(c.x, c.z);
      camPos.set(c.x + Math.sin(orbita + 2.6) * 30, yc + 13, c.z + Math.cos(orbita + 2.6) * 30);
      camMira.set(c.x, yc + 1.5, c.z);
      camara.position.copyFrom(camPos); camara.setTarget(camMira);
      actualizarNiebla();
      return;
    }

    // movimiento del avatar
    let recorrido = 0;
    if (!GU.pausado()) recorrido = auto ? moverAuto(dt) : moverLibre(dt);
    jugador.vel = dt > 0 ? recorrido / dt : 0;
    if (!auto && girarA !== null && !charla) {
      camYaw = angLerp(camYaw, girarA, reducir ? 1 : 1 - Math.exp(-dt * 2));
      if (Math.abs(angLerp(0, girarA - camYaw, 1)) < 0.01) girarA = null;
    }
    if (charla) { // el avatar se voltea hacia el personaje
      const pj = PJ[charla.i];
      jugador.yaw = angLerp(jugador.yaw, yawDe(pj.sitio.x - jugador.x, pj.sitio.z - jugador.z), 1 - Math.exp(-dt * 6));
    }
    const yA = alturaCaminar(jugador.x, jugador.z);
    AV.raiz.position.set(jugador.x, yA, jugador.z);
    AV.raiz.rotation.y = jugador.yaw;
    AV.animar(tiempo, dt, jugador.vel, recorrido);
    sombraAv.position.set(jugador.x, yA + 0.05, jugador.z);

    // pasos
    if (jugador.vel > 0.5) { acumPaso += dt; if (acumPaso >= 0.35) { acumPaso = 0; GU.paso(); } }
    else acumPaso = 0.3;

    // estación más cercana y si hay un personaje a distancia de conversación
    let zona = 0, dz = 1e9, cerca = -1, dc = 1e9;
    PJ.forEach(p => {
      const d = Math.hypot(jugador.x - p.sitio.x, jugador.z - p.sitio.z);
      if (d < dz) { dz = d; zona = p.i; }
      if (d < 3.4 && d < dc) { dc = d; cerca = p.i; }
    });
    GU.zona(zona);
    GU.cerca(auto ? -1 : cerca);

    // en modo libre las semillas se recogen al tocarlas
    if (GU.config.control === 'libre' && !GU.pausado()) SEMILLAS.forEach(s => {
      if (!s.recogida && Math.hypot(jugador.x - s.x, jugador.z - s.z) < 1.4) GU.recoger(s.i);
    });

    // migas de luz hacia la próxima estación
    const verMigas = sig >= 0 && !charla && GU.config.control === 'libre';
    if (verMigas) {
      const yo = masCercanoTotal(jugador.x, jugador.z).k, meta = EST[sig].k;
      const sentido = meta >= yo ? 1 : -1;
      MIGAS.forEach((m, n) => {
        const k = yo + sentido * (6 + n * 6);
        const ok = sentido > 0 ? k < meta - 4 : k > meta + 4;
        m.setEnabled(ok);
        if (ok) {
          const p = P[k];
          m.position.set(p.x, alturaCaminar(p.x, p.z) + 0.35 + (reducir ? 0 : Math.abs(Math.sin(tiempo * 3 - n * 0.6)) * 0.25), p.z);
        }
      });
    } else MIGAS.forEach(m => m.setEnabled(false));

    // cámara
    const k = reducir ? 1 : 1 - Math.exp(-dt * (charla ? 3 : 5));
    if (charla) colocarCamaraCharla(k); else colocarCamaraSeguir(k, dt);
    camara.position.copyFrom(camPos);
    camara.setTarget(camMira);
    actualizarNiebla();
  }

  // la niebla se espesa al subir al páramo (menos con alto contraste)
  function actualizarNiebla() {
    const t = suave(165, 200, empezado ? jugador.z : -20);
    if (contraste) { escena.fogStart = 160; escena.fogEnd = 520; }
    else { escena.fogStart = lerp(60, 26, t); escena.fogEnd = lerp(240, 150, t); }
    escena.fogColor.copyFrom(B.Color3.Lerp(hex('#eee9d6'), hex('#e3e8e6'), t));
  }

  /* ---------- tamaño de pantalla y arranque ---------- */

  function ajustarCamara() {
    const ancho = motor.getRenderWidth(), alto = motor.getRenderHeight();
    camara.fov = alto > ancho ? 1.0 : 0.9;
  }
  window.addEventListener('resize', () => { motor.resize(); ajustarCamara(); });

  // calidad adaptativa: si el equipo no da abasto, se dibuja con menos píxeles (nunca menos de 0,75)
  let densidad = Math.min(window.devicePixelRatio || 1, 1.5), lentos = 0;
  setInterval(() => {
    if (document.hidden || !empezado || tiempo - tiempoInicio < 5) return;
    const fps = motor.getFps();
    lentos = fps < 26 ? lentos + 1 : 0;
    if (lentos >= 3 && densidad > 0.75) {
      densidad = Math.max(0.75, densidad - 0.25);
      motor.setHardwareScalingLevel(1 / densidad);
      lentos = 0;
    }
  }, 2000);
  ajustarCamara();

  aplicarConfig(GU.config);
  construirAvatar(GU.config);
  escena.onBeforeRenderObservable.add(() => actualizar(Math.min(0.1, motor.getDeltaTime() / 1000)));
  motor.runRenderLoop(() => escena.render());

  GU.montar({ nombre: 'Recorrido 3D' });

  // ganchos para las pruebas automáticas (no los usa el juego)
  window.GU3D = {
    get jugador() { return { ...jugador }; },
    get auto() { return !!auto; },
    estacion: i => ({ ...PJ[i].sitio }),
    semilla: i => ({ x: SEMILLAS[i].x, z: SEMILLAS[i].z }),
    camino: P,
    estaciones: EST.map(e => e.k),
    llevar(x, z, yaw) { jugador.x = x; jugador.z = z; if (yaw != null) { jugador.yaw = yaw; camYaw = yaw; } },
    escena,
  };
})();
