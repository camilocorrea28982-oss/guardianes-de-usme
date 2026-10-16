/*
 * Guardianes de Usme · Prototipo 3 «Mapa desde arriba» · trazado del parque
 *
 * Aquí solo hay datos y geometría (nada de Phaser): por dónde va el camino,
 * el río Tunjuelo, la quebrada, la laguna, dónde está cada estación y dónde
 * va cada árbol, frailejón, junco o piedra. Lo usan el dibujo del suelo
 * (dibujos.js) y el mundo (mundo.js), así el camino que se ve es el mismo
 * por el que camina el personaje.
 *
 * Coordenadas en «píxeles de mundo»: (0,0) arriba a la izquierda.
 * Abajo está el valle y la entrada; arriba, el páramo de Sumapaz.
 */
(function () {
  const ANCHO = 3200, ALTO = 3000;

  /* ---------- utilidades de geometría ---------- */

  // Azar con semilla: el mapa sale igual cada vez que se abre.
  function aleatorio(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Curva suave que pasa por los puntos de control (Catmull-Rom),
  // remuestreada para que haya un punto cada `paso` píxeles.
  function curva(ctrl, paso) {
    const crudo = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const n = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        crudo.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    const fin = ctrl[ctrl.length - 1];
    crudo.push({ x: fin[0], y: fin[1] });
    const sal = [crudo[0]];
    let acum = 0;
    for (let i = 1; i < crudo.length; i++) {
      let a = crudo[i - 1];
      const b = crudo[i];
      let d = Math.hypot(b.x - a.x, b.y - a.y);
      while (acum + d >= paso && d > 0) {
        const t = (paso - acum) / d;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        sal.push(p);
        a = p; d = Math.hypot(b.x - a.x, b.y - a.y); acum = 0;
      }
      acum += d;
    }
    sal.push({ x: fin[0], y: fin[1] });
    return sal;
  }

  function distSegmento(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  // Distancia de un punto a una polilínea y el índice del tramo más cercano.
  function distPolilinea(pl, x, y, salto = 1) {
    let m = Infinity, idx = 0;
    for (let i = 0; i < pl.length - salto; i += salto) {
      const a = pl[i], b = pl[i + salto];
      const d = distSegmento(x, y, a.x, a.y, b.x, b.y);
      if (d < m) { m = d; idx = i; }
    }
    return { d: m, i: idx };
  }

  function indiceMasCercano(pl, x, y, filtro) {
    let m = Infinity, idx = 0;
    for (let i = 0; i < pl.length; i++) {
      if (filtro && !filtro(pl[i])) continue;
      const d = (pl[i].x - x) ** 2 + (pl[i].y - y) ** 2;
      if (d < m) { m = d; idx = i; }
    }
    return idx;
  }

  /* ---------- trazado ---------- */

  // Las 6 estaciones (centros de los claros), en el orden de GU.estaciones.
  // pj: dónde se para el personaje respecto al centro; letrero: dónde va el letrero;
  // semilla: dónde se esconde la semilla (fuera del camino).
  const ESTACIONES = [
    { x: 1250, y: 2650, pj: [98, 4],    letrero: [-190, -30], semilla: [585, 2470] },  // entrada: detrás de la casa
    { x: 2050, y: 2020, pj: [104, 34],  letrero: [-185, -70], semilla: [2230, 2150] }, // humedal: entre los juncos
    { x: 1000, y: 1700, pj: [-104, 12], letrero: [175, 40],   semilla: [395, 1800] },  // ancestros: junto a las vasijas
    { x: 2150, y: 1250, pj: [104, 20],  letrero: [-175, 80],  semilla: [1760, 1190] }, // quebrada: entre los árboles
    { x: 1050, y: 860,  pj: [-102, 22], letrero: [195, 50],   semilla: [560, 905] },   // huerta: entre los surcos
    { x: 1750, y: 360,  pj: [104, -8],  letrero: [-190, 60],  semilla: [2115, 345] },  // páramo: junto a la laguna
  ];
  const RADIO_CLARO = 104;

  const PUENTE = { x: 1900, y: 2235 };

  const CONTROL_CAMINO = [
    [1360, 3080], [1300, 2860], [ESTACIONES[0].x, ESTACIONES[0].y],
    [1450, 2490], [1790, 2400], [PUENTE.x, PUENTE.y], [1975, 2110], [ESTACIONES[1].x, ESTACIONES[1].y],
    [1860, 1880], [1450, 1830], [ESTACIONES[2].x, ESTACIONES[2].y],
    [990, 1520], [1400, 1410], [1800, 1340], [ESTACIONES[3].x, ESTACIONES[3].y],
    [2110, 1080], [1700, 1000], [ESTACIONES[4].x, ESTACIONES[4].y],
    [950, 680], [1250, 520], [ESTACIONES[5].x, ESTACIONES[5].y], [1960, 250],
  ];
  const camino = curva(CONTROL_CAMINO, 8);
  ESTACIONES.forEach(e => { e.idx = indiceMasCercano(camino, e.x, e.y); });
  const idxPuente = indiceMasCercano(camino, PUENTE.x, PUENTE.y);
  {
    const a = camino[idxPuente - 3], b = camino[idxPuente + 3];
    PUENTE.ang = Math.atan2(b.y - a.y, b.x - a.x);
  }
  // punto de partida del avatar: sobre el camino, abajo
  const INICIO = { ...camino[indiceMasCercano(camino, 1305, 2850)] };

  // Río Tunjuelo: cruza el mapa de izquierda a derecha.
  const rio = curva([[-80, 2110], [500, 2200], [1000, 2150], [1450, 2255], [1900, 2235], [2400, 2305], [2800, 2262], [3280, 2330]], 10);
  const ANCHO_RIO = 54; // medio ancho del agua

  // Quebrada: baja de la laguna del páramo, pasa por el bosque y cae al río.
  const LAGUNA = { x: 2360, y: 290, rx: 190, ry: 98 };
  const quebrada = curva([[2500, 360], [2610, 600], [2540, 850], [2420, 1060], [2440, 1290], [2600, 1550], [2760, 1800], [2810, 2050], [2850, 2290]], 10);

  // Casa campesina (base del frente) y árbol grande de la entrada.
  const CASA = { x: 800, y: 2560, ancho: 250 };
  const ARBOL_GRANDE = { x: 1585, y: 2835 };

  const CIRCULO_PIEDRAS = { x: 560, y: 1700, r: 118 };     // los ancestros
  const CIRCULO_SOL = { x: 600, y: 1250, r: 84 };           // la huerta

  // Parcelas de la huerta (rectángulos) y qué se siembra en cada franja.
  const PARCELAS = [
    { x: 300, y: 700, w: 270, h: 345, cultivo: 'maiz' },
    { x: 590, y: 700, w: 270, h: 345, cultivo: 'papa' },
    { x: 1260, y: 640, w: 190, h: 180, cultivo: 'papa' },
    { x: 1465, y: 640, w: 190, h: 180, cultivo: 'maiz' },
  ];

  // Cercas de madera (tramos) en los potreros del valle y alrededor de la casa.
  const CERCAS = [
    [[560, 2620], [560, 2380], [1040, 2380], [1040, 2520]],
    [[560, 2620], [1080, 2620]],
    [[1640, 2520], [2950, 2520], [2950, 2920], [1640, 2920], [1640, 2700]],
    [[120, 2700], [460, 2700], [460, 2950]],
  ];

  /* ---------- consultas de geometría ---------- */

  function yRio(x) {
    for (let i = 0; i < rio.length - 1; i++) {
      const a = rio[i], b = rio[i + 1];
      if (x >= a.x && x <= b.x) return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x || 1));
    }
    return x < rio[0].x ? rio[0].y : rio[rio.length - 1].y;
  }
  // -1 al norte del río (arriba), 1 al sur (abajo)
  const ladoRio = (x, y) => (y < yRio(x) ? -1 : 1);
  const enPuente = (x, y) => Math.hypot(x - PUENTE.x, y - PUENTE.y) < 120 && distPolilinea(camino, x, y, 2).d < 36;
  const enLaguna = (x, y, m = 0) => ((x - LAGUNA.x) / (LAGUNA.rx + m)) ** 2 + ((y - LAGUNA.y) / (LAGUNA.ry + m)) ** 2 < 1;
  const enCasa = (x, y, m = 0) => x > CASA.x - CASA.ancho / 2 - m && x < CASA.x + CASA.ancho / 2 + m && y > CASA.y - 120 - m && y < CASA.y + 8 + m;
  const enParcela = (x, y, m = 0) => PARCELAS.some(p => x > p.x - m && x < p.x + p.w + m && y > p.y - m && y < p.y + p.h + m);

  /* ---------- decorado ---------- */

  function generarDecorado() {
    const r = aleatorio(20260928);
    const d = {
      arboles: [], frailejones: [], pajonales: [], hierbas: [], juncos: [], flores: [], rocas: [],
      arbustos: [], helechos: [], piedrasParadas: [], vasijas: [], plantas: [], animales: [], textura: [],
    };
    const ocupados = []; // [x, y, radio] para no amontonar cosas grandes

    function libre(x, y, m, opc = {}) {
      if (x < 40 || y < 40 || x > ANCHO - 40 || y > ALTO - 40) return false;
      if (distPolilinea(camino, x, y, 3).d < 44 + m) return false;
      if (!opc.agua && Math.abs(y - yRio(x)) < ANCHO_RIO + 22 + m) return false;
      if (!opc.agua && distPolilinea(quebrada, x, y, 2).d < 24 + m) return false;
      if (enLaguna(x, y, opc.agua ? -10 : 24 + m)) return false;
      if (ESTACIONES.some(e => Math.hypot(x - e.x, y - e.y) < RADIO_CLARO + 40 + m)) return false;
      if (ESTACIONES.some(e => Math.hypot(x - e.semilla[0], y - e.semilla[1]) < 46 + m * 0.5)) return false;
      if (ESTACIONES.some(e => Math.hypot(x - e.x - e.pj[0], y - e.pj[1] - e.y) < 80 + Math.max(0, m))) return false;
      // que nada tape los letreros
      if (ESTACIONES.some(e => Math.abs(x - (e.x + e.letrero[0])) < 150 + m && y > e.y + e.letrero[1] - 120 && y < e.y + e.letrero[1] + 170)) return false;
      if (enCasa(x, y, 30 + m)) return false;
      if (!opc.parcela && enParcela(x, y, 14 + m)) return false;
      if (Math.hypot(x - CIRCULO_PIEDRAS.x, y - CIRCULO_PIEDRAS.y) < CIRCULO_PIEDRAS.r + 60 + m) return false;
      if (Math.hypot(x - CIRCULO_SOL.x, y - CIRCULO_SOL.y) < CIRCULO_SOL.r + 46 + m) return false;
      if (Math.hypot(x - ARBOL_GRANDE.x, y - ARBOL_GRANDE.y) < 90 + m) return false;
      if (opc.separacion && ocupados.some(o => Math.hypot(x - o[0], y - o[1]) < o[2] + opc.separacion)) return false;
      return true;
    }
    function sembrar(n, intentos, zona, m, crear, opc) {
      let k = 0;
      for (let t = 0; t < intentos && k < n; t++) {
        const x = r() * ANCHO, y = r() * ALTO;
        if (!zona(x, y) || !libre(x, y, m, opc)) continue;
        crear(x, y); k++;
      }
    }

    // zonas
    const esParamo = (x, y) => y < 600 + 60 * Math.sin(x / 300);
    const esBosque = (x, y) => y > 880 && y < 1980 && x > 1480 + 120 * Math.sin(y / 260) && !(y > 1880 && x < 2300);
    const esValle = (x, y) => y > yRio(x) + 80;
    const esHumedal = (x, y) => Math.abs(y - yRio(x)) < 230;
    const esExplanada = (x, y) => Math.hypot(x - 760, y - 1720) < 520;
    const esHuerta = (x, y) => x < 1750 && y > 600 && y < 1150;

    // árboles del bosque altoandino: densos, varios tonos
    sembrar(190, 9000, esBosque, 6, (x, y) => {
      const tipo = ['bosque', 'bosque', 'encenillo', 'gaque'][Math.floor(r() * 4)];
      const s = 0.85 + r() * 0.4;
      d.arboles.push({ x, y, tipo, s }); ocupados.push([x, y, 36 * s]);
    }, { separacion: 26 });
    // alisos y arbustos sueltos en el valle, en la orilla y alrededor de la explanada
    sembrar(30, 4000, (x, y) => esValle(x, y) && !(x > 1640 && x < 2950 && y > 2520 && y < 2920), 10, (x, y) => {
      const s = 0.8 + r() * 0.35; d.arboles.push({ x, y, tipo: 'aliso', s }); ocupados.push([x, y, 40 * s]);
    }, { separacion: 50 });
    sembrar(16, 3000, (x, y) => esHumedal(x, y) && !esValle(x, y) && x < 1600, 8, (x, y) => {
      const s = 0.8 + r() * 0.3; d.arboles.push({ x, y, tipo: 'aliso', s }); ocupados.push([x, y, 40 * s]);
    }, { separacion: 50 });
    sembrar(14, 3000, (x, y) => (esExplanada(x, y) && !esHumedal(x, y) && Math.hypot(x - 760, y - 1720) > 380) || (esHuerta(x, y) && (x < 260 || y < 660 || x > 1680)), 10, (x, y) => {
      const s = 0.8 + r() * 0.3; d.arboles.push({ x, y, tipo: r() < 0.5 ? 'aliso' : 'gaque', s }); ocupados.push([x, y, 40 * s]);
    }, { separacion: 60 });
    sembrar(46, 5000, (x, y) => (esBosque(x, y) || esValle(x, y) || esExplanada(x, y)) && !esParamo(x, y), 0, (x, y) => {
      d.arbustos.push({ x, y, s: 0.7 + r() * 0.5, tono: r() }); ocupados.push([x, y, 18]);
    }, { separacion: 14 });
    sembrar(60, 5000, esBosque, 0, (x, y) => d.helechos.push({ x, y, s: 0.8 + r() * 0.5, f: r() * 6 }), { separacion: 4 });

    // páramo: frailejones, pajonal y rocas
    sembrar(78, 8000, (x, y) => esParamo(x, y) && y > 140, 4, (x, y) => {
      const s = 0.65 + r() * 0.6; d.frailejones.push({ x, y, s, flor: r() < 0.35 }); ocupados.push([x, y, 16 * s]);
    }, { separacion: 14 });
    sembrar(110, 8000, (x, y) => esParamo(x, y) && y > 120, -14, (x, y) => d.pajonales.push({ x, y, s: 0.7 + r() * 0.6, f: r() * 6 }), { separacion: 0 });
    sembrar(26, 4000, (x, y) => esParamo(x, y) && y > 150, 4, (x, y) => {
      d.rocas.push({ x, y, s: 0.6 + r() * 0.7, tipo: r() < 0.5 ? 0 : 1 }); ocupados.push([x, y, 20]);
    }, { separacion: 10 });
    // rocas en la quebrada (encima del agua) y en la explanada
    for (let i = 4; i < quebrada.length - 2; i += 9) {
      const p = quebrada[i];
      const lado = (i / 9) % 2 ? 1 : -1;
      d.rocas.push({ x: p.x + lado * (16 + r() * 8), y: p.y + r() * 6, s: 0.35 + r() * 0.25, tipo: 1, enAgua: true });
    }
    sembrar(14, 3000, esExplanada, 4, (x, y) => d.rocas.push({ x, y, s: 0.5 + r() * 0.5, tipo: r() < 0.5 ? 0 : 1 }), { separacion: 20 });

    // juncos: orillas del río cerca del humedal y alrededor de la laguna
    for (let i = 0; i < rio.length; i += 2) {
      const p = rio[i];
      const cerca = Math.abs(p.x - 2150) < 520;
      if (!cerca && r() > 0.22) continue;
      const lado = r() < (cerca ? 0.75 : 0.5) ? -1 : 1;
      const x = p.x + (r() - 0.5) * 18, y = p.y + lado * (ANCHO_RIO + 6 + r() * (cerca ? 70 : 20));
      if (enPuente(x, y) || Math.hypot(x - PUENTE.x, y - PUENTE.y) < 110) continue;
      if (distPolilinea(camino, x, y, 3).d < 40) continue;
      if (Math.hypot(x - ESTACIONES[1].x, y - ESTACIONES[1].y) < RADIO_CLARO + 10) continue;
      if (Math.hypot(x - ESTACIONES[1].x - ESTACIONES[1].pj[0], y - ESTACIONES[1].y - ESTACIONES[1].pj[1]) < 70) continue;
      d.juncos.push({ x, y, s: 0.75 + r() * 0.5, f: r() * 6 });
    }
    for (let a = 0; a < Math.PI * 2; a += 0.17) {
      if (r() < 0.3) continue;
      const k = 1.02 + r() * 0.12;
      d.juncos.push({ x: LAGUNA.x + Math.cos(a) * LAGUNA.rx * k, y: LAGUNA.y + Math.sin(a) * LAGUNA.ry * k + 4, s: 0.7 + r() * 0.4, f: r() * 6 });
    }

    // hierba que se mece, en todo lo que no es páramo
    sembrar(260, 9000, (x, y) => !esParamo(x, y) && !esBosque(x, y), -16, (x, y) => d.hierbas.push({ x, y, s: 0.7 + r() * 0.6, f: r() * 6, tono: r() }));
    // flores
    sembrar(150, 6000, (x, y) => !esBosque(x, y), -18, (x, y) => d.flores.push({ x, y, c: Math.floor(r() * 4), paramo: esParamo(x, y), s: 0.8 + r() * 0.4 }));

    // los ancestros: piedras en círculo y vasijas
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 - Math.PI / 2;
      d.piedrasParadas.push({ x: CIRCULO_PIEDRAS.x + Math.cos(a) * CIRCULO_PIEDRAS.r, y: CIRCULO_PIEDRAS.y + Math.sin(a) * CIRCULO_PIEDRAS.r * 0.62, s: 0.85 + r() * 0.3 });
    }
    [[470, 1820, 0], [430, 1770, 1], [520, 1850, 2], [610, 1690, 1], [355, 1745, 0]].forEach(([x, y, t]) => d.vasijas.push({ x, y, tipo: t }));

    // la huerta: maíz y papa en surcos
    PARCELAS.forEach(p => {
      for (let y = p.y + 30; y < p.y + p.h - 8; y += 46) {
        for (let x = p.x + 22; x < p.x + p.w - 10; x += p.cultivo === 'maiz' ? 34 : 40) {
          const sx = x + (r() - 0.5) * 6;
          if (Math.hypot(sx - ESTACIONES[4].semilla[0], y - ESTACIONES[4].semilla[1]) < 30) continue;
          d.plantas.push({ x: sx, y, tipo: p.cultivo, s: 0.85 + r() * 0.3, f: r() * 6 });
        }
      }
    });

    // animales del potrero
    [[1900, 2700, 'vaca', 1], [2320, 2800, 'vaca', -1], [2650, 2640, 'vaca', 1], [260, 2820, 'oveja', 1], [350, 2880, 'oveja', -1], [220, 2900, 'oveja', 1], [2100, 2860, 'oveja', -1]]
      .forEach(([x, y, tipo, lado]) => d.animales.push({ x, y, tipo, lado }));

    // textura del suelo: trazos de pasto y puntitos (solo se pintan, no estorban)
    for (let i = 0; i < 9000; i++) {
      d.textura.push({ x: r() * ANCHO, y: r() * ALTO, a: r(), b: r(), c: r() });
    }

    // obstáculos para caminar: troncos de árboles
    d.obstaculos = d.arboles.map(a => ({ x: a.x, y: a.y - 4, r: 15 * a.s + 4 }));
    d.obstaculos.push({ x: ARBOL_GRANDE.x, y: ARBOL_GRANDE.y - 6, r: 28 });
    d.zonas = { esParamo, esBosque, esValle, esHumedal, esExplanada, esHuerta };
    return d;
  }

  window.GU_MAPA = {
    ANCHO, ALTO, ESTACIONES, RADIO_CLARO, PUENTE, INICIO, camino, rio, ANCHO_RIO, quebrada, LAGUNA,
    CASA, ARBOL_GRANDE, CIRCULO_PIEDRAS, CIRCULO_SOL, PARCELAS, CERCAS,
    aleatorio, curva, distPolilinea, indiceMasCercano, yRio, ladoRio, enPuente, enLaguna, enCasa, enParcela,
    decorado: generarDecorado(),
  };
})();
