/*
 * Guardianes de Usme · Recorrido 3D · figuras
 *
 * Aquí se arman, solo con formas básicas de Babylon (esferas, cilindros, cajas),
 * el avatar del niño o la niña y los seis personajes del recorrido.
 * No hay modelos ni texturas: cada pieza lleva su color en los vértices y se
 * funde con las demás para dibujarla de una sola vez (pocas llamadas de dibujo).
 *
 * Cada figura devuelve { raiz, mallas, animar(t, dt, ...) }:
 *   raiz    → nodo que se mueve y se gira (mira hacia +z)
 *   mallas  → cada una con su .casco (contorno negro del alto contraste)
 *   animar  → se llama cada cuadro
 */
(function () {
  const B = BABYLON, MB = B.MeshBuilder;
  let escena = null, matVC = null, matCasco = null;
  let conCasco = false;   // mientras se arma una figura, cada malla lleva su contorno

  /* ---------- utilidades de color y piezas ---------- */

  const hex = c => B.Color3.FromHexString(c);
  function mezclar(a, b, t) {
    const x = hex(a), y = hex(b);
    return B.Color3.Lerp(x, y, t).toHexString();
  }

  function pintar(m, color) {
    const c = hex(color), n = m.getTotalVertices(), arr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { arr[i * 4] = c.r; arr[i * 4 + 1] = c.g; arr[i * 4 + 2] = c.b; arr[i * 4 + 3] = 1; }
    m.setVerticesData(B.VertexBuffer.ColorKind, arr);
    return m;
  }

  // Una pieza suelta: tipo, medidas, color, posición, rotación y escala.
  function pieza(tipo, op, color, pos, rot, esc) {
    let m;
    switch (tipo) {
      case 'esfera': {
        const d = Array.isArray(op.d) ? op.d : [op.d, op.d, op.d];
        m = MB.CreateSphere('p', { diameterX: d[0], diameterY: d[1], diameterZ: d[2], segments: op.seg || 5 }, escena);
        break;
      }
      case 'ico': m = MB.CreateIcoSphere('p', { radius: op.r || 0.5, subdivisions: op.sub || 1 }, escena); break;
      case 'cil': m = MB.CreateCylinder('p', { height: op.h, diameterTop: op.dt ?? op.d, diameterBottom: op.db ?? op.d, tessellation: op.t || 8 }, escena); break;
      case 'caja': m = MB.CreateBox('p', { width: op.w, height: op.h, depth: op.d }, escena); break;
      case 'toro': m = MB.CreateTorus('p', { diameter: op.d, thickness: op.g, tessellation: op.t || 14 }, escena); break;
      case 'torno': m = MB.CreateLathe('p', { shape: op.forma.map(v => new B.Vector3(v[0], v[1], 0)), tessellation: op.t || 10, cap: B.Mesh.CAP_ALL }, escena); break;
      default: throw new Error('pieza desconocida ' + tipo);
    }
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (esc) m.scaling.set(esc[0], esc[1], esc[2]);
    pintar(m, color);
    return m;
  }

  // Contorno para el alto contraste: una copia negra un poco inflada y vuelta al revés
  // («casco invertido»). Se arma con las normales suaves, antes de aplanar el sombreado,
  // para que el borde quede continuo (el renderOutline de Babylon se corta con caras planas).
  function casco(m, ancho) {
    const pos = m.getVerticesData(B.VertexBuffer.PositionKind), nor = m.getVerticesData(B.VertexBuffer.NormalKind);
    const ind = Array.from(m.getIndices());
    const p2 = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) p2[i] = pos[i] + nor[i] * ancho;
    for (let i = 0; i < ind.length; i += 3) { const t = ind[i + 1]; ind[i + 1] = ind[i + 2]; ind[i + 2] = t; }
    const c = new B.Mesh(m.name + '-contorno', escena);
    const vd = new B.VertexData(); vd.positions = p2; vd.indices = ind; vd.applyToMesh(c);
    c.material = matCasco; c.parent = m; c.isPickable = false; c.setEnabled(false);
    return c;
  }

  // Funde varias piezas en una sola malla de sombreado plano (estilo low-poly).
  function unir(nombre, partes, padre, pos) {
    const m = B.Mesh.MergeMeshes(partes, true, true);
    m.name = nombre;
    if (conCasco) m.casco = casco(m, 0.022);
    m.convertToFlatShadedMesh();
    m.material = matVC;
    m.isPickable = false;
    if (padre) m.parent = padre;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  }

  function nodo(nombre, padre, pos) {
    const n = new B.TransformNode(nombre, escena);
    if (padre) n.parent = padre;
    if (pos) n.position.set(pos[0], pos[1], pos[2]);
    return n;
  }

  // Ojos: dos puntos negros con brillo, a una altura y separación dadas.
  function ojos(y, z, sep, d) {
    d = d || 0.06;
    return [
      pieza('esfera', { d, seg: 4 }, '#1d1612', [-sep, y, z]),
      pieza('esfera', { d, seg: 4 }, '#1d1612', [sep, y, z]),
      pieza('esfera', { d: d * 0.35, seg: 3 }, '#ffffff', [-sep + d * 0.15, y + d * 0.18, z + d * 0.4]),
      pieza('esfera', { d: d * 0.35, seg: 3 }, '#ffffff', [sep + d * 0.15, y + d * 0.18, z + d * 0.4]),
    ];
  }

  // Ruana: un poncho cuadrado visto como pirámide truncada, con una franja y flecos.
  function ruana(color, alto, arriba, abajo) {
    const clara = mezclar(color, '#ffffff', 0.45), oscura = mezclar(color, '#000000', 0.35);
    return [
      pieza('cil', { h: alto, dt: arriba, db: abajo, t: 4 }, color, [0, 0, 0], [0, Math.PI / 4, 0], [1, 1, 0.82]),
      pieza('cil', { h: alto * 0.12, dt: abajo * 0.86, db: abajo * 0.9, t: 4 }, clara, [0, -alto * 0.22, 0], [0, Math.PI / 4, 0], [1.02, 1, 0.84]),
      pieza('cil', { h: alto * 0.08, dt: abajo * 1.0, db: abajo * 1.04, t: 4 }, oscura, [0, -alto * 0.5, 0], [0, Math.PI / 4, 0], [1, 1, 0.82]),
    ];
  }

  /* ---------- avatar ---------- */

  const PIEL = '#b97a52', PELO = '#2a1a12';

  function cabezaAvatar(tipo, colorRuana) {
    const p = [
      pieza('esfera', { d: 0.44, seg: 6 }, PIEL, [0, 0.22, 0]),
      ...ojos(0.25, 0.195, 0.08, 0.065),
      pieza('esfera', { d: 0.06, seg: 3 }, mezclar(PIEL, '#000000', 0.15), [0, 0.2, 0.22]),
      pieza('esfera', { d: [0.08, 0.05, 0.03] }, '#e58a7a', [-0.13, 0.17, 0.17]),
      pieza('esfera', { d: [0.08, 0.05, 0.03] }, '#e58a7a', [0.13, 0.17, 0.17]),
      pieza('caja', { w: 0.09, h: 0.018, d: 0.02 }, '#7a2f22', [0, 0.12, 0.205]),
    ];
    if (tipo === 'nina') {
      // cabello largo con dos trenzas y moñitos del color de la ruana
      p.push(pieza('esfera', { d: [0.48, 0.46, 0.48], seg: 6 }, PELO, [0, 0.27, -0.045]));
      p.push(pieza('caja', { w: 0.42, h: 0.26, d: 0.12 }, PELO, [0, 0.14, -0.15]));
      [-1, 1].forEach(s => {
        for (let k = 0; k < 4; k++) p.push(pieza('esfera', { d: 0.11 - k * 0.012, seg: 4 }, PELO, [s * 0.17, 0.08 - k * 0.1, -0.1 + k * 0.01]));
        p.push(pieza('esfera', { d: 0.085, seg: 4 }, colorRuana, [s * 0.17, -0.3, -0.09]));
      });
    } else if (tipo === 'nino') {
      // pelo corto y gorro de lana campesino con pompón
      p.push(pieza('esfera', { d: [0.47, 0.4, 0.47], seg: 6 }, PELO, [0, 0.3, -0.035]));
      p.push(pieza('esfera', { d: [0.5, 0.36, 0.5], seg: 6 }, '#efe2c8', [0, 0.41, -0.02]));
      p.push(pieza('cil', { h: 0.07, d: 0.49, t: 10 }, colorRuana, [0, 0.33, -0.02]));
      p.push(pieza('esfera', { d: 0.13, seg: 4 }, colorRuana, [0, 0.6, -0.03]));
    } else {
      // silla: cabello a media melena
      p.push(pieza('esfera', { d: [0.49, 0.46, 0.49], seg: 6 }, '#3a2216', [0, 0.27, -0.045]));
      p.push(pieza('caja', { w: 0.46, h: 0.2, d: 0.2 }, '#3a2216', [0, 0.13, -0.11]));
      p.push(pieza('esfera', { d: 0.1, seg: 4 }, colorRuana, [0.2, 0.36, 0.0]));
    }
    return p;
  }

  function crearAvatar(tipo, colorRuana) {
    conCasco = true;
    try { return armarAvatar(tipo, colorRuana); } finally { conCasco = false; }
  }
  function armarAvatar(tipo, colorRuana) {
    const raiz = nodo('avatar');
    const cuerpo = nodo('av-cuerpo', raiz);
    const mallas = [];
    const guardar = m => { mallas.push(m); return m; };
    const pantalon = tipo === 'nina' ? '#3d5684' : '#5a4a3a';
    const fig = { raiz, mallas, tipo, piernas: [], brazos: [], ruedas: [], cuerpo, fase: 0 };

    if (tipo !== 'silla') {
      // piernas con pivote en la cadera
      [-1, 1].forEach(s => {
        const cad = nodo('cadera', cuerpo, [s * 0.1, 0.62, 0]);
        guardar(unir('pierna', [
          pieza('cil', { h: 0.56, d: 0.15, t: 6 }, pantalon, [0, -0.3, 0]),
          pieza('caja', { w: 0.15, h: 0.09, d: 0.24 }, '#3a2a20', [0, -0.58, 0.04]),
        ], cad));
        fig.piernas.push(cad);
      });
      guardar(unir('torso', [
        pieza('cil', { h: 0.42, dt: 0.3, db: 0.36, t: 8 }, '#f3ede2', [0, 0.84, 0]),
        ...ruana(colorRuana, 0.44, 0.3, 0.92).map(m => { m.position.y += 0.86; return m; }),
        pieza('cil', { h: 0.06, d: 0.18, t: 8 }, mezclar(colorRuana, '#ffffff', 0.45), [0, 1.08, 0]),
      ], cuerpo));
      [-1, 1].forEach(s => {
        const hom = nodo('hombro', cuerpo, [s * 0.3, 0.98, 0]);
        guardar(unir('brazo', [
          pieza('cil', { h: 0.36, d: 0.11, t: 6 }, colorRuana, [0, -0.2, 0]),
          pieza('esfera', { d: 0.11, seg: 4 }, PIEL, [0, -0.4, 0]),
        ], hom));
        hom.rotation.z = s * 0.18;
        fig.brazos.push(hom);
      });
      fig.cabeza = nodo('cuello', cuerpo, [0, 1.08, 0]);
      guardar(unir('cabeza', cabezaAvatar(tipo, colorRuana), fig.cabeza));
    } else {
      // silla de ruedas: marco, asiento, espaldar, reposapiés y ruedas pequeñas
      const metal = '#8f9aa6', lona = '#2f5d8a';
      guardar(unir('silla', [
        pieza('caja', { w: 0.52, h: 0.07, d: 0.46 }, lona, [0, 0.5, -0.02]),
        pieza('caja', { w: 0.52, h: 0.42, d: 0.05 }, lona, [0, 0.76, -0.25]),
        pieza('cil', { h: 0.95, d: 0.035, t: 5 }, metal, [-0.27, 0.62, -0.27]),
        pieza('cil', { h: 0.95, d: 0.035, t: 5 }, metal, [0.27, 0.62, -0.27]),
        pieza('cil', { h: 0.18, d: 0.05, t: 5 }, '#2a2a2a', [-0.27, 1.06, -0.36], [Math.PI / 2, 0, 0]),
        pieza('cil', { h: 0.18, d: 0.05, t: 5 }, '#2a2a2a', [0.27, 1.06, -0.36], [Math.PI / 2, 0, 0]),
        pieza('cil', { h: 0.56, d: 0.035, t: 5 }, metal, [-0.27, 0.47, 0.0], [Math.PI / 2, 0, 0]),
        pieza('cil', { h: 0.56, d: 0.035, t: 5 }, metal, [0.27, 0.47, 0.0], [Math.PI / 2, 0, 0]),
        pieza('cil', { h: 0.42, d: 0.035, t: 5 }, metal, [-0.2, 0.3, 0.27], [0.35, 0, 0]),
        pieza('cil', { h: 0.42, d: 0.035, t: 5 }, metal, [0.2, 0.3, 0.27], [0.35, 0, 0]),
        pieza('caja', { w: 0.42, h: 0.03, d: 0.14 }, '#3b3b3b', [0, 0.12, 0.36]),
        pieza('cil', { h: 0.04, d: 0.16, t: 8 }, '#333333', [-0.2, 0.08, 0.24], [0, 0, Math.PI / 2]),
        pieza('cil', { h: 0.04, d: 0.16, t: 8 }, '#333333', [0.2, 0.08, 0.24], [0, 0, Math.PI / 2]),
      ], cuerpo));
      // ruedas grandes: llanta, aro para empujar, radios y eje (giran al avanzar)
      [-1, 1].forEach(s => {
        const eje = nodo('eje', cuerpo, [s * 0.33, 0.33, -0.08]);
        guardar(unir('rueda', [
          pieza('toro', { d: 0.6, g: 0.07, t: 18 }, '#2b2b2b', [0, 0, 0], [0, 0, Math.PI / 2]),
          pieza('toro', { d: 0.5, g: 0.025, t: 14 }, '#c9d1d9', [s * 0.05, 0, 0], [0, 0, Math.PI / 2]),
          pieza('caja', { w: 0.02, h: 0.56, d: 0.03 }, '#d7dde3', [0, 0, 0]),
          pieza('caja', { w: 0.02, h: 0.56, d: 0.03 }, '#d7dde3', [0, 0, 0], [Math.PI / 3, 0, 0]),
          pieza('caja', { w: 0.02, h: 0.56, d: 0.03 }, '#d7dde3', [0, 0, 0], [-Math.PI / 3, 0, 0]),
          pieza('cil', { h: 0.08, d: 0.09, t: 8 }, colorRuana, [0, 0, 0], [0, 0, Math.PI / 2]),
        ], eje));
        fig.ruedas.push(eje);
      });
      // persona sentada
      guardar(unir('piernas', [
        pieza('cil', { h: 0.38, d: 0.15, t: 6 }, '#3d5684', [-0.1, 0.6, 0.12], [Math.PI / 2, 0, 0]),
        pieza('cil', { h: 0.38, d: 0.15, t: 6 }, '#3d5684', [0.1, 0.6, 0.12], [Math.PI / 2, 0, 0]),
        pieza('cil', { h: 0.42, d: 0.14, t: 6 }, '#3d5684', [-0.1, 0.38, 0.3]),
        pieza('cil', { h: 0.42, d: 0.14, t: 6 }, '#3d5684', [0.1, 0.38, 0.3]),
        pieza('caja', { w: 0.14, h: 0.08, d: 0.22 }, '#3a2a20', [-0.1, 0.18, 0.36]),
        pieza('caja', { w: 0.14, h: 0.08, d: 0.22 }, '#3a2a20', [0.1, 0.18, 0.36]),
      ], cuerpo));
      guardar(unir('torso', [
        pieza('cil', { h: 0.4, dt: 0.3, db: 0.36, t: 8 }, '#f3ede2', [0, 0.78, -0.08]),
        ...ruana(colorRuana, 0.42, 0.3, 0.88).map(m => { m.position.y += 0.8; m.position.z -= 0.08; return m; }),
        pieza('cil', { h: 0.06, d: 0.18, t: 8 }, mezclar(colorRuana, '#ffffff', 0.45), [0, 1.0, -0.08]),
      ], cuerpo));
      [-1, 1].forEach(s => {
        const hom = nodo('hombro', cuerpo, [s * 0.28, 0.93, -0.08]);
        guardar(unir('brazo', [
          pieza('cil', { h: 0.38, d: 0.11, t: 6 }, colorRuana, [0, -0.19, 0]),
          pieza('esfera', { d: 0.11, seg: 4 }, PIEL, [0, -0.4, 0]),
        ], hom));
        hom.rotation.z = s * 0.22;
        fig.brazos.push(hom);
      });
      fig.cabeza = nodo('cuello', cuerpo, [0, 1.0, -0.08]);
      guardar(unir('cabeza', cabezaAvatar('silla', colorRuana), fig.cabeza));
    }

    // animar: velocidad en unidades por segundo, distancia recorrida en este cuadro
    fig.animar = (t, dt, vel, dist) => {
      const anda = vel > 0.2;
      if (tipo === 'silla') {
        fig.ruedas.forEach(r => r.rotation.x += dist / 0.3);
        fig.fase += dist * 3.2;
        const emp = anda ? Math.sin(fig.fase) * 0.5 : 0;
        fig.brazos.forEach(b => { b.rotation.x = B.Scalar.Lerp(b.rotation.x, -0.25 + emp, Math.min(1, dt * 10)); });
        cuerpo.position.y = 0;
        fig.cabeza.rotation.x = anda ? 0 : Math.sin(t * 1.3) * 0.04;
      } else {
        fig.fase += dist * 4.2;
        const amp = anda ? 0.65 : 0;
        const s = Math.sin(fig.fase);
        fig.piernas[0].rotation.x = B.Scalar.Lerp(fig.piernas[0].rotation.x, s * amp, Math.min(1, dt * 12));
        fig.piernas[1].rotation.x = B.Scalar.Lerp(fig.piernas[1].rotation.x, -s * amp, Math.min(1, dt * 12));
        fig.brazos[0].rotation.x = B.Scalar.Lerp(fig.brazos[0].rotation.x, -s * amp * 0.8, Math.min(1, dt * 12));
        fig.brazos[1].rotation.x = B.Scalar.Lerp(fig.brazos[1].rotation.x, s * amp * 0.8, Math.min(1, dt * 12));
        cuerpo.position.y = anda ? Math.abs(Math.cos(fig.fase)) * 0.05 : 0;
        fig.cabeza.rotation.x = anda ? 0 : Math.sin(t * 1.3) * 0.04;
      }
      // respirar
      const r = 1 + Math.sin(t * 2.2) * 0.012;
      cuerpo.scaling.set(1, anda ? 1 : r, 1);
    };
    return fig;
  }

  /* ---------- personajes de las estaciones ---------- */

  function crearPersonaje(id) {
    conCasco = true;
    try { return armarPersonaje(id); } finally { conCasco = false; }
  }
  function armarPersonaje(id) {
    const raiz = nodo('pj-' + id);
    const mallas = [];
    const g = m => { mallas.push(m); return m; };
    const fig = { raiz, mallas, id };

    if (id === 'rosa') {
      // Doña Rosa: falda larga, ruana terracota, sombrero de paja y bastón
      const cuerpo = nodo('cuerpo', raiz);
      g(unir('rosa-cuerpo', [
        pieza('cil', { h: 0.78, dt: 0.44, db: 0.64, t: 9 }, '#3d3550', [0, 0.39, 0]),
        pieza('caja', { w: 0.17, h: 0.08, d: 0.24 }, '#2b201a', [-0.12, 0.04, 0.12]),
        pieza('caja', { w: 0.17, h: 0.08, d: 0.24 }, '#2b201a', [0.12, 0.04, 0.12]),
        pieza('cil', { h: 0.45, dt: 0.34, db: 0.42, t: 8 }, '#f1e6d2', [0, 0.98, 0]),
        ...ruana('#c0562f', 0.56, 0.36, 1.08).map(m => { m.position.y += 1.0; return m; }),
        pieza('esfera', { d: 0.12, seg: 4 }, '#b9825a', [0.4, 0.82, 0.12]),
        pieza('cil', { h: 1.25, d: 0.05, t: 5 }, '#6b4a2b', [0.45, 0.62, 0.16]),
        pieza('esfera', { d: 0.1, seg: 4 }, '#6b4a2b', [0.45, 1.26, 0.16]),
      ], cuerpo));
      fig.cabeza = nodo('cuello', cuerpo, [0, 1.26, 0]);
      g(unir('rosa-cabeza', [
        pieza('esfera', { d: 0.42, seg: 6 }, '#b9825a', [0, 0.2, 0]),
        ...ojos(0.23, 0.185, 0.075, 0.055),
        pieza('esfera', { d: 0.07, seg: 3 }, '#9e6a46', [0, 0.18, 0.21]),
        pieza('esfera', { d: [0.08, 0.05, 0.03] }, '#e0897a', [-0.12, 0.15, 0.165]),
        pieza('esfera', { d: [0.08, 0.05, 0.03] }, '#e0897a', [0.12, 0.15, 0.165]),
        pieza('caja', { w: 0.1, h: 0.018, d: 0.02 }, '#6a2c22', [0, 0.1, 0.195]),
        pieza('esfera', { d: [0.45, 0.42, 0.45], seg: 6 }, '#c9c3bb', [0, 0.25, -0.045]),
        pieza('esfera', { d: 0.17, seg: 5 }, '#c9c3bb', [0, 0.18, -0.24]),
        pieza('cil', { h: 0.035, d: 0.82, t: 14 }, '#e6d4a8', [0, 0.36, 0]),
        pieza('cil', { h: 0.2, dt: 0.32, db: 0.38, t: 12 }, '#e6d4a8', [0, 0.46, 0]),
        pieza('cil', { h: 0.05, d: 0.385, t: 12 }, '#4a2f1f', [0, 0.39, 0]),
      ], fig.cabeza));
      fig.cuerpo = cuerpo;
      fig.animar = t => {
        cuerpo.scaling.y = 1 + Math.sin(t * 1.8) * 0.015;
        fig.cabeza.rotation.x = Math.sin(t * 0.9) * 0.08;
        fig.cabeza.rotation.z = Math.sin(t * 0.6) * 0.05;
      };
    } else if (id === 'tita') {
      // Tita, la tingua bogotana: gris azulada, alas cafés, pico largo rojizo, patas largas
      const cuerpo = nodo('cuerpo', raiz, [0, 0.62, 0]);
      g(unir('tita-patas', [
        pieza('cil', { h: 0.62, d: 0.05, t: 5 }, '#c4523b', [-0.09, 0.31, 0]),
        pieza('cil', { h: 0.62, d: 0.05, t: 5 }, '#c4523b', [0.09, 0.31, 0]),
        pieza('caja', { w: 0.12, h: 0.02, d: 0.2 }, '#c4523b', [-0.09, 0.01, 0.05]),
        pieza('caja', { w: 0.12, h: 0.02, d: 0.2 }, '#c4523b', [0.09, 0.01, 0.05]),
      ], raiz));
      g(unir('tita-cuerpo', [
        pieza('esfera', { d: [0.5, 0.44, 0.72], seg: 6 }, '#5f7189', [0, 0.12, 0]),
        pieza('esfera', { d: [0.14, 0.36, 0.56], seg: 5 }, '#7a5a3c', [-0.23, 0.17, -0.04]),
        pieza('esfera', { d: [0.14, 0.36, 0.56], seg: 5 }, '#7a5a3c', [0.23, 0.17, -0.04]),
        pieza('cil', { h: 0.2, dt: 0.02, db: 0.22, t: 5 }, '#4a3a2a', [0, 0.26, -0.38], [-1.1, 0, 0]),
        pieza('esfera', { d: [0.2, 0.08, 0.2] }, '#e8ecef', [0, 0.02, -0.33]),
      ], cuerpo));
      fig.cabeza = nodo('cuello', cuerpo, [0, 0.28, 0.22]);
      g(unir('tita-cabeza', [
        pieza('cil', { h: 0.26, dt: 0.1, db: 0.16, t: 6 }, '#56677e', [0, 0.1, 0.02], [0.35, 0, 0]),
        pieza('esfera', { d: 0.22, seg: 6 }, '#4e5e74', [0, 0.25, 0.07]),
        pieza('cil', { h: 0.3, dt: 0.0, db: 0.07, t: 5 }, '#d24a2f', [0, 0.22, 0.3], [Math.PI / 2 + 0.25, 0, 0]),
        pieza('esfera', { d: 0.07, seg: 4 }, '#d24a2f', [0, 0.3, 0.16]),
        pieza('esfera', { d: 0.06, seg: 4 }, '#f2e3b3', [-0.09, 0.28, 0.12]),
        pieza('esfera', { d: 0.06, seg: 4 }, '#f2e3b3', [0.09, 0.28, 0.12]),
        pieza('esfera', { d: 0.035, seg: 3 }, '#111111', [-0.11, 0.285, 0.135]),
        pieza('esfera', { d: 0.035, seg: 3 }, '#111111', [0.11, 0.285, 0.135]),
      ], fig.cabeza));
      fig.cuerpo = cuerpo;
      fig.animar = t => {
        // picotea cada cierto tiempo y mueve la cola
        const ciclo = t % 3.2;
        const pico = ciclo < 0.6 ? Math.sin(ciclo / 0.6 * Math.PI) : 0;
        fig.cabeza.rotation.x = pico * 1.0;
        cuerpo.rotation.x = pico * 0.25;
        cuerpo.position.y = 0.62 + Math.sin(t * 2.4) * 0.01;
      };
    } else if (id === 'julian') {
      // Julián, arqueólogo: sombrero, chaleco de bolsillos y una brocha
      const cuerpo = nodo('cuerpo', raiz);
      g(unir('julian-cuerpo', [
        pieza('cil', { h: 0.72, d: 0.17, t: 6 }, '#6b5a3e', [-0.11, 0.38, 0]),
        pieza('cil', { h: 0.72, d: 0.17, t: 6 }, '#6b5a3e', [0.11, 0.38, 0]),
        pieza('caja', { w: 0.18, h: 0.12, d: 0.28 }, '#3b2b1e', [-0.11, 0.06, 0.04]),
        pieza('caja', { w: 0.18, h: 0.12, d: 0.28 }, '#3b2b1e', [0.11, 0.06, 0.04]),
        pieza('cil', { h: 0.58, dt: 0.4, db: 0.36, t: 8 }, '#e8e2d0', [0, 1.02, 0]),
        pieza('caja', { w: 0.46, h: 0.5, d: 0.34 }, '#a08655', [0, 1.0, 0]),
        pieza('caja', { w: 0.12, h: 0.1, d: 0.03 }, '#7f6840', [-0.12, 0.92, 0.175]),
        pieza('caja', { w: 0.12, h: 0.1, d: 0.03 }, '#7f6840', [0.12, 0.92, 0.175]),
        pieza('caja', { w: 0.1, h: 0.08, d: 0.03 }, '#7f6840', [-0.12, 1.12, 0.175]),
        pieza('cil', { h: 0.5, d: 0.12, t: 6 }, '#e8e2d0', [-0.3, 1.02, 0], [0, 0, 0.12]),
        pieza('esfera', { d: 0.12, seg: 4 }, '#a8734f', [-0.33, 0.75, 0]),
      ], cuerpo));
      fig.brazo = nodo('hombro', cuerpo, [0.28, 1.24, 0]);
      g(unir('julian-brazo', [
        pieza('cil', { h: 0.48, d: 0.12, t: 6 }, '#e8e2d0', [0, -0.24, 0]),
        pieza('esfera', { d: 0.12, seg: 4 }, '#a8734f', [0, -0.5, 0]),
        pieza('cil', { h: 0.3, d: 0.035, t: 5 }, '#8a5a33', [0, -0.55, 0.12], [Math.PI / 2, 0, 0]),
        pieza('caja', { w: 0.1, h: 0.05, d: 0.1 }, '#efe1b8', [0, -0.55, 0.3]),
      ], fig.brazo));
      fig.brazo.rotation.x = -0.9;
      fig.cabeza = nodo('cuello', cuerpo, [0, 1.32, 0]);
      g(unir('julian-cabeza', [
        pieza('esfera', { d: 0.42, seg: 6 }, '#a8734f', [0, 0.2, 0]),
        ...ojos(0.23, 0.185, 0.075, 0.055),
        pieza('esfera', { d: 0.07, seg: 3 }, '#8e5f40', [0, 0.18, 0.21]),
        pieza('esfera', { d: [0.36, 0.22, 0.3], seg: 5 }, '#2d1e14', [0, 0.06, 0.04]),
        pieza('esfera', { d: [0.44, 0.34, 0.44], seg: 6 }, '#2d1e14', [0, 0.26, -0.06]),
        pieza('caja', { w: 0.1, h: 0.02, d: 0.02 }, '#7a2f22', [0, 0.12, 0.2]),
        pieza('cil', { h: 0.035, d: 0.72, t: 14 }, '#c9b07a', [0, 0.36, 0]),
        pieza('cil', { h: 0.18, dt: 0.34, db: 0.4, t: 12 }, '#c9b07a', [0, 0.45, 0]),
        pieza('cil', { h: 0.05, d: 0.405, t: 12 }, '#5c4630', [0, 0.38, 0]),
      ], fig.cabeza));
      fig.cuerpo = cuerpo;
      fig.animar = t => {
        cuerpo.scaling.y = 1 + Math.sin(t * 2) * 0.012;
        fig.brazo.rotation.x = -0.9 + Math.sin(t * 2.6) * 0.18;
        fig.brazo.rotation.z = Math.sin(t * 1.3) * 0.12;
        fig.cabeza.rotation.z = Math.sin(t * 0.8) * 0.07;
      };
    } else if (id === 'rita') {
      // Rita, la rana sabanera: verde, ojos grandes, sobre una piedra
      g(unir('rita-piedra', [
        pieza('ico', { r: 0.5, sub: 0 }, '#9b968a', [0, 0.18, 0], [0.3, 0.5, 0], [1.3, 0.6, 1.1]),
      ], raiz));
      const cuerpo = nodo('cuerpo', raiz, [0, 0.42, 0]);
      g(unir('rita-cuerpo', [
        pieza('esfera', { d: [0.56, 0.38, 0.6], seg: 6 }, '#4f9a3c', [0, 0.16, 0]),
        pieza('esfera', { d: [0.44, 0.22, 0.4], seg: 5 }, '#c8e08a', [0, 0.08, 0.1]),
        pieza('esfera', { d: [0.18, 0.2, 0.42], seg: 5 }, '#3f7f30', [-0.27, 0.07, -0.08]),
        pieza('esfera', { d: [0.18, 0.2, 0.42], seg: 5 }, '#3f7f30', [0.27, 0.07, -0.08]),
        pieza('esfera', { d: [0.1, 0.16, 0.12], seg: 4 }, '#3f7f30', [-0.16, 0.0, 0.25]),
        pieza('esfera', { d: [0.1, 0.16, 0.12], seg: 4 }, '#3f7f30', [0.16, 0.0, 0.25]),
        pieza('esfera', { d: 0.17, seg: 5 }, '#4f9a3c', [-0.13, 0.34, 0.12]),
        pieza('esfera', { d: 0.17, seg: 5 }, '#4f9a3c', [0.13, 0.34, 0.12]),
        pieza('esfera', { d: 0.13, seg: 5 }, '#ffffff', [-0.13, 0.37, 0.17]),
        pieza('esfera', { d: 0.13, seg: 5 }, '#ffffff', [0.13, 0.37, 0.17]),
        pieza('esfera', { d: 0.07, seg: 4 }, '#141414', [-0.13, 0.38, 0.23]),
        pieza('esfera', { d: 0.07, seg: 4 }, '#141414', [0.13, 0.38, 0.23]),
        pieza('caja', { w: 0.22, h: 0.02, d: 0.02 }, '#2c5a22', [0, 0.17, 0.3]),
        pieza('esfera', { d: [0.06, 0.03, 0.03] }, '#e48a6f', [-0.17, 0.2, 0.26]),
        pieza('esfera', { d: [0.06, 0.03, 0.03] }, '#e48a6f', [0.17, 0.2, 0.26]),
      ], cuerpo));
      fig.cuerpo = cuerpo;
      fig.animar = t => {
        // salta un poquito cada tanto y se le infla la garganta
        const ciclo = t % 2.6;
        const salto = ciclo < 0.45 ? Math.sin(ciclo / 0.45 * Math.PI) : 0;
        cuerpo.position.y = 0.42 + salto * 0.28;
        const g2 = 1 + Math.max(0, Math.sin(t * 5)) * 0.05;
        cuerpo.scaling.set(1 + (1 - salto) * 0.02, 1 - salto * 0.08 + (g2 - 1) * 0.5, 1);
      };
    } else if (id === 'cuqui') {
      // Cuqui, el curí: café, redondito, con mancha blanca
      g(unir('cuqui-tronco', [
        pieza('cil', { h: 0.35, d: 0.85, t: 10 }, '#8a6440', [0, 0.17, 0]),
        pieza('cil', { h: 0.02, d: 0.8, t: 10 }, '#d8b98a', [0, 0.35, 0]),
      ], raiz));
      const cuerpo = nodo('cuerpo', raiz, [0, 0.36, 0]);
      g(unir('cuqui-cuerpo', [
        pieza('esfera', { d: [0.48, 0.38, 0.62], seg: 6 }, '#a8743a', [0, 0.19, 0]),
        pieza('esfera', { d: [0.3, 0.26, 0.3], seg: 5 }, '#f3eadb', [0.1, 0.24, -0.12]),
        pieza('esfera', { d: [0.2, 0.24, 0.24], seg: 5 }, '#c9925a', [-0.1, 0.27, -0.16]),
        pieza('esfera', { d: [0.34, 0.3, 0.3], seg: 6 }, '#a8743a', [0, 0.22, 0.24]),
        pieza('esfera', { d: [0.11, 0.06, 0.08], seg: 4 }, '#d58a7c', [-0.13, 0.38, 0.18]),
        pieza('esfera', { d: [0.11, 0.06, 0.08], seg: 4 }, '#d58a7c', [0.13, 0.38, 0.18]),
        pieza('esfera', { d: 0.06, seg: 4 }, '#141414', [-0.1, 0.28, 0.36]),
        pieza('esfera', { d: 0.06, seg: 4 }, '#141414', [0.1, 0.28, 0.36]),
        pieza('esfera', { d: 0.06, seg: 4 }, '#f08a8a', [0, 0.2, 0.4]),
        pieza('esfera', { d: [0.08, 0.06, 0.1], seg: 4 }, '#8a5a2a', [-0.14, 0.04, 0.18]),
        pieza('esfera', { d: [0.08, 0.06, 0.1], seg: 4 }, '#8a5a2a', [0.14, 0.04, 0.18]),
      ], cuerpo));
      cuerpo.scaling.set(1.25, 1.25, 1.25);
      fig.cuerpo = cuerpo;
      fig.animar = t => {
        const ciclo = t % 3.6;
        const brinco = ciclo < 0.3 ? Math.sin(ciclo / 0.3 * Math.PI) : 0;
        cuerpo.position.y = 0.36 + brinco * 0.12;
        const r = 1.25 * (1 + Math.sin(t * 6) * 0.025);
        cuerpo.scaling.set(r, 1.25 * (1 + Math.sin(t * 6 + 1) * 0.02), r);
        cuerpo.rotation.y = Math.sin(t * 0.9) * 0.2;
      };
    } else if (id === 'tomas') {
      // Tomás, el oso de anteojos: negro, con manchas crema en la cara y el pecho, sentado
      const cuerpo = nodo('cuerpo', raiz);
      g(unir('tomas-cuerpo', [
        pieza('esfera', { d: [0.95, 1.0, 0.85], seg: 7 }, '#2a2622', [0, 0.55, -0.05]),
        pieza('esfera', { d: [0.42, 0.34, 0.12], seg: 5 }, '#e3cf9e', [0, 0.72, 0.34]),
        pieza('esfera', { d: [0.32, 0.28, 0.5], seg: 5 }, '#2a2622', [-0.3, 0.15, 0.25]),
        pieza('esfera', { d: [0.32, 0.28, 0.5], seg: 5 }, '#2a2622', [0.3, 0.15, 0.25]),
        pieza('esfera', { d: [0.18, 0.2, 0.08], seg: 4 }, '#4a3e33', [-0.3, 0.15, 0.5]),
        pieza('esfera', { d: [0.18, 0.2, 0.08], seg: 4 }, '#4a3e33', [0.3, 0.15, 0.5]),
        pieza('esfera', { d: [0.22, 0.5, 0.24], seg: 5 }, '#2a2622', [-0.34, 0.5, 0.22], [0.3, 0, 0.2]),
        pieza('esfera', { d: [0.22, 0.5, 0.24], seg: 5 }, '#2a2622', [0.34, 0.5, 0.22], [0.3, 0, -0.2]),
      ], cuerpo));
      fig.cabeza = nodo('cuello', cuerpo, [0, 1.0, 0.05]);
      g(unir('tomas-cabeza', [
        pieza('esfera', { d: [0.6, 0.54, 0.54], seg: 7 }, '#2a2622', [0, 0.18, 0]),
        pieza('esfera', { d: 0.18, seg: 5 }, '#2a2622', [-0.22, 0.42, -0.02]),
        pieza('esfera', { d: 0.18, seg: 5 }, '#2a2622', [0.22, 0.42, -0.02]),
        pieza('esfera', { d: [0.28, 0.22, 0.24], seg: 5 }, '#e3cf9e', [0, 0.1, 0.25]),
        pieza('esfera', { d: [0.1, 0.07, 0.07], seg: 4 }, '#111111', [0, 0.16, 0.37]),
        pieza('esfera', { d: [0.2, 0.17, 0.08], seg: 5 }, '#e3cf9e', [-0.12, 0.26, 0.22]),
        pieza('esfera', { d: [0.2, 0.17, 0.08], seg: 5 }, '#e3cf9e', [0.12, 0.26, 0.22]),
        pieza('esfera', { d: 0.07, seg: 4 }, '#111111', [-0.12, 0.27, 0.26]),
        pieza('esfera', { d: 0.07, seg: 4 }, '#111111', [0.12, 0.27, 0.26]),
        pieza('esfera', { d: 0.025, seg: 3 }, '#ffffff', [-0.11, 0.29, 0.29]),
        pieza('esfera', { d: 0.025, seg: 3 }, '#ffffff', [0.13, 0.29, 0.29]),
        pieza('caja', { w: 0.08, h: 0.015, d: 0.02 }, '#5a3a2a', [0, 0.04, 0.36]),
      ], fig.cabeza));
      fig.cuerpo = cuerpo;
      fig.animar = t => {
        cuerpo.scaling.set(1 + Math.sin(t * 1.6) * 0.015, 1 + Math.sin(t * 1.6) * 0.02, 1);
        fig.cabeza.rotation.z = Math.sin(t * 0.7) * 0.12;
        fig.cabeza.rotation.x = Math.sin(t * 1.1) * 0.06;
      };
    }
    return fig;
  }

  window.GU3D_FIGURAS = {
    iniciar(sc, mat) {
      escena = sc; matVC = mat;
      matCasco = new B.StandardMaterial('contorno', sc);
      matCasco.disableLighting = true; matCasco.emissiveColor = B.Color3.Black(); matCasco.diffuseColor = B.Color3.Black();
      matCasco.specularColor = B.Color3.Black(); matCasco.fogEnabled = false;
    },
    pieza, unir, pintar, mezclar, nodo,
    crearAvatar, crearPersonaje,
  };
})();
