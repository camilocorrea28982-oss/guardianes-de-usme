/*
 * Guardianes de Usme · Prototipo 3 · minijuegos de las estaciones
 *
 *   excavacion()  → en «El lugar de los ancestros», con Julián: limpiar la tierra con la brocha
 *                   y descubrir lo que guardaron los ancestros; termina con una reflexión.
 *   binoculares() → donde Rita, la rana: mirar el contraste campo–ciudad con unos binoculares
 *                   y encontrar lo que le hace daño a los ecosistemas.
 *
 * Cada uno abre una capa HTML encima del mapa (lector de pantalla, teclado, toque y pulsador)
 * y devuelve una promesa que se cumple al terminar. Se juegan ANTES de la conversación y la
 * pregunta de la estación. Los textos están POR VALIDAR con el equipo del parque, la Mesa y el
 * Semillero Usmeka (en especial cómo se muestra el lugar de descanso de los ancestros).
 */
(function () {
  const D = window.GU_DIBUJOS;
  const V = window.GU_VOZ || { decir() {}, callar() {} };
  const A = window.GU_AUDIO || { efecto() {} };
  const TAU = Math.PI * 2;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const quieto = () => !!(window.GU && GU.config.reducirMovimiento);

  /* ---------- estilos ---------- */

  const css = document.createElement('style');
  css.textContent = `
    .mj { position: fixed; inset: 0; z-index: 30; background: rgba(43,33,24,.6); display: flex; align-items: center; justify-content: center; padding: 10px;
      font-family: var(--gu-letra); font-size: calc(17px * var(--gu-escala, 1)); line-height: 1.45; color: var(--gu-tinta); }
    .mj-caja { background: var(--gu-panel); border: 3px solid var(--gu-borde); border-radius: 22px; box-shadow: var(--gu-sombra); width: min(1100px, 100%);
      max-height: 100%; overflow: auto; padding: 14px 18px 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .mj-contenido { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .mj-cab { display: flex; align-items: center; gap: 12px; }
    .mj-retrato { width: 60px; height: 60px; border-radius: 50%; background: var(--c); display: grid; place-items: center; font-size: 34px; border: 4px solid #fff; box-shadow: 0 0 0 3px var(--c); flex: none; }
    .mj h2 { margin: 0; font-family: var(--gu-letra-titulo); font-size: 1.45em; line-height: 1.05; outline: none; }
    .mj .mj-quien { margin: 0; color: var(--gu-tinta-suave); font-size: .9em; }
    .mj-texto { margin: 0; font-size: 1.12em; min-height: 2.4em; }
    .mj-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 14px; align-items: start; }
    .mj-area { min-width: 0; max-width: 100%; position: relative; border-radius: 16px; overflow: hidden; border: 3px solid var(--gu-borde); touch-action: none; background: #5a3a22; }
    .mj-area canvas { display: block; width: 100%; height: auto; }
    .mj-area canvas + canvas { position: absolute; inset: 0; height: 100%; }
    .mj-libreta { border: 2px dashed var(--gu-borde); border-radius: 16px; padding: 10px 12px; font-size: .92em; }
    .mj-libreta h3 { margin: 0 0 6px; font-size: 1.05em; }
    .mj-libreta ol { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; }
    .mj-libreta li b { display: block; }
    .mj-libreta .mj-falta { color: var(--gu-tinta-suave); font-style: italic; }
    .mj-controles { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }
    .mj-cuenta { margin-right: auto; font-weight: 800; }
    .mj-hallazgo { border: 3px solid var(--gu-bien); background: color-mix(in srgb, var(--gu-bien) 10%, var(--gu-panel)); border-radius: 16px; padding: 10px 14px; animation: mj-sube .35s ease-out; }
    .mj-hallazgo h3 { margin: 0 0 4px; font-family: var(--gu-letra-titulo); font-size: 1.2em; }
    .mj-hallazgo p { margin: 0 0 4px; }
    .mj-reflexion { display: grid; gap: 10px; }
    .mj-reflexion p { margin: 0; font-size: 1.1em; }
    .mj-opciones { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .mj-opciones .gu-btn { border-radius: 16px; flex-direction: column; min-height: 96px; white-space: normal; text-align: center; }
    .mj-opciones .gu-btn span[aria-hidden] { font-size: 2em; line-height: 1; }
    .mj-resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
    .mj-resumen div { border: 2px solid var(--gu-borde); border-radius: 14px; padding: 8px 10px; font-size: .92em; }
    .mj :focus-visible { outline: 5px solid var(--gu-foco) !important; outline-offset: 3px; }
    @keyframes mj-sube { from { transform: translateY(10px); opacity: 0; } }
    html.gu-sin-movimiento .mj * { animation: none !important; }
    @media (max-width: 760px) { .mj-cuerpo { grid-template-columns: minmax(0, 1fr); } .mj { padding: 0; } .mj-caja { border-radius: 0; min-height: 100%; } .mj-retrato { width: 46px; height: 46px; font-size: 26px; } }
    /* celular acostado: el dibujo se achica para caber de alto, con la libreta al lado */
    @media (orientation: landscape) and (max-height: 500px) {
      .mj { padding: 0; }
      .mj-caja { border-radius: 0; min-height: 100%; gap: 6px; padding: 8px max(14px, env(safe-area-inset-right)) 10px max(14px, env(safe-area-inset-left)); }
      .mj-contenido { gap: 6px; }
      .mj-cab { gap: 8px; }
      .mj-retrato { width: 34px; height: 34px; font-size: 19px; border-width: 2px; box-shadow: 0 0 0 2px var(--c); }
      .mj h2 { font-size: 1.15em; }
      .mj .mj-quien { display: none; }
      .mj-texto { font-size: .95em; line-height: 1.35; min-height: 0; }
      .mj-cuerpo { grid-template-columns: minmax(0, 1fr) 220px; gap: 10px; }
      /* alto disponible para el dibujo = pantalla − título, instrucción y botones (~180px) */
      .mj-cuerpo .mj-area { justify-self: center; width: min(100%, calc((100vh - 180px) * 800 / 480)); width: min(100%, calc((100dvh - 180px) * 800 / 480)); }
      .mj-contenido > .mj-area { justify-self: center; width: min(100%, calc((100vh - 180px) * 1600 / 600)); width: min(100%, calc((100dvh - 180px) * 1600 / 600)); }
      .mj-libreta { padding: 8px 10px; font-size: .85em; }
      .mj-opciones .gu-btn { min-height: 64px; }
      .mj-hallazgo { padding: 8px 12px; }
      .mj-controles .gu-btn { min-height: 48px; padding: .35em 1em; }
    }
    /* binoculares: el paisaje ocupa toda la pantalla; la explicación flota encima */
    .mj-lleno { padding: 0; }
    .mj-lleno .mj-caja { width: 100%; height: 100%; max-height: none; border-radius: 0; display: flex; flex-direction: column; overflow: hidden;
      padding: 8px max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); gap: 6px; }
    .mj-lleno .mj-cab { gap: 8px; }
    .mj-lleno .mj-retrato { width: 38px; height: 38px; font-size: 21px; border-width: 2px; box-shadow: 0 0 0 2px var(--c); }
    .mj-lleno h2 { font-size: 1.15em; }
    .mj-lleno .mj-quien { display: none; }
    .mj-lleno .mj-contenido { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
    .mj-lleno .mj-texto { font-size: .95em; line-height: 1.3; min-height: 0; }
    .mj-lleno .mj-area { flex: 1; min-height: 180px; width: 100% !important; }
    .mj-lleno .mj-area canvas { position: absolute; left: 0; top: 0; max-width: none; transform-origin: 0 0; }
    .mj-lleno .mj-controles .gu-btn { min-height: 48px; padding: .35em 1em; }
    .mj-flota { position: absolute; inset: 10px; z-index: 2; display: flex; justify-content: center; align-items: flex-end; pointer-events: none; }
    .mj-flota .mj-hallazgo { pointer-events: auto; width: min(640px, 100%); max-height: 100%; overflow: auto; background: var(--gu-panel); box-shadow: var(--gu-sombra); font-size: .92em; }
    .mj-flota .gu-btn { min-height: 44px; padding: .3em 1em; margin-top: 4px; }
    .mj [hidden] { display: none !important; }
    /* celular acostado: los botones van en una columna a la derecha y el paisaje usa todo el alto */
    @media (orientation: landscape) and (max-height: 560px) {
      .mj-lleno .mj-contenido { display: grid; grid-template-columns: minmax(0, 1fr) 190px; grid-template-rows: auto minmax(0, 1fr); }
      .mj-lleno .mj-texto { grid-column: 1 / -1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .mj-lleno .mj-area { grid-column: 1; grid-row: 2; min-height: 0; }
      .mj-lleno .mj-controles { grid-column: 2; grid-row: 2; flex-direction: column; flex-wrap: nowrap; align-items: stretch; justify-content: flex-start; gap: 8px; overflow: auto; }
      .mj-lleno .mj-cuenta { margin: 0; text-align: center; }
      .mj-lleno .mj-controles .gu-btn { font-size: .85em; white-space: normal; line-height: 1.15; padding: .35em .6em; }
    }
    .mj-sensor { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 2; background: rgba(251,246,234,.95); color: #2b2118;
      border-radius: 999px; padding: .3em 1em; font-weight: 800; pointer-events: none; }
  `;
  document.head.appendChild(css);

  /* ---------- capa común de los minijuegos ---------- */

  // Abre la capa; esconde la barra y los controles de la capa común mientras tanto,
  // así el teclado y el pulsador solo recorren los botones del minijuego.
  function abrirCapa({ titulo, quien, emoji, color }) {
    const ocultos = ['#gu-hud', '#gu-acciones', '.mapa-herramientas'].map(s => document.querySelector(s)).filter(n => n && !n.hidden);
    ocultos.forEach(n => { n.hidden = true; });
    const foco = document.activeElement;
    const capa = document.createElement('div');
    capa.className = 'mj gu-extra';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'mj-titulo');
    capa.innerHTML = `<div class="mj-caja">
      <div class="mj-cab"><div class="mj-retrato" style="--c:${color}" aria-hidden="true">${emoji}</div>
        <div><h2 id="mj-titulo" tabindex="-1">${esc(titulo)}</h2><p class="mj-quien">${esc(quien)}</p></div></div>
      <div class="mj-contenido"></div></div>`;
    document.body.appendChild(capa);
    setTimeout(() => capa.querySelector('h2').focus({ preventScroll: true }), 40);
    return {
      capa,
      contenido: capa.querySelector('.mj-contenido'),
      cerrar() {
        V.callar();
        capa.remove();
        ocultos.forEach(n => { n.hidden = false; });
        if (foco && foco.focus) foco.focus({ preventScroll: true });
      },
    };
  }

  // Dibuja una figura del juego (con su contorno) con los pies en (x, y).
  function figura(ctx, dibujar, w, h, x, y, escala, voltear) {
    const { c, ctx: g } = D.lienzo(w, h, 2);
    dibujar(g);
    const fig = D.contorno(c, 2.4, 'rgba(58,38,22,.8)');
    ctx.save();
    ctx.translate(x, y);
    if (voltear) ctx.scale(-1, 1);
    ctx.drawImage(fig, -w * escala / 2, -h * escala, w * escala, h * escala);
    ctx.restore();
  }
  function elipse(ctx, x, y, rx, ry, color, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  function rect(ctx, x, y, w, h, r, color) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
  function trazo(ctx, pts, ancho, color) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineWidth = ancho; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  function aleatorio(s) { let a = s; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }

  /* =====================================================================
   * 1. LA EXCAVACIÓN (con Julián)
   * ===================================================================== */

  const HALLAZGOS = [
    { id: 'mucura', celda: [1, 0], emoji: '🏺', nombre: 'Una múcura (vasija de barro)',
      texto: 'Los muiscas hacían vasijas de barro para guardar agua, chicha y alimentos. Las decoraban con líneas y figuras.' },
    { id: 'metate', celda: [3, 0], emoji: '🪨', nombre: 'Una piedra de moler',
      texto: 'Sobre esta piedra molían el maíz para hacer arepas y bollos. ¡Igual que en muchas casas campesinas de hoy!' },
    { id: 'volante', celda: [3, 1], emoji: '🧵', nombre: 'Un volante de huso',
      texto: 'Esta pieza redonda de barro servía para hilar algodón. Con ese hilo tejían mantas, que eran muy valiosas.' },
    { id: 'descanso', celda: [1, 1], emoji: '🕊️', nombre: 'El lugar de descanso de un abuelo muisca',
      texto: 'Aquí descansa una persona que vivió hace muchos siglos, rodeada de piedras y ofrendas. Los arqueólogos la cuidan con respeto: es un lugar sagrado.' },
    { id: 'cuentas', celda: [0, 2], emoji: '📿', nombre: 'Cuentas de un collar',
      texto: 'Pequeñas cuentas de piedra y concha que alguien usó como collar. Nos cuentan que los muiscas intercambiaban cosas con otros pueblos.' },
    { id: 'tiestos', celda: [2, 2], emoji: '🧩', nombre: 'Pedacitos de cerámica pintada',
      texto: 'Los arqueólogos llaman «tiestos» a estos pedacitos. Juntándolos, como un rompecabezas, descubren cómo eran las vasijas.' },
  ];
  const EX = { W: 800, H: 480, COLS: 4, FILAS: 3 };
  const celdaRect = ([c, f]) => ({ x: c * EX.W / EX.COLS, y: f * EX.H / EX.FILAS, w: EX.W / EX.COLS, h: EX.H / EX.FILAS });

  function pintarHallazgo(ctx, h, r) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.save();
    // la tierra húmeda alrededor del objeto
    elipse(ctx, cx, cy + 6, r.w * 0.38, r.h * 0.34, 'rgba(40,24,12,.35)');
    if (h.id === 'mucura') {
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - 44); ctx.lineTo(cx - 12, cy - 34); ctx.quadraticCurveTo(cx - 52, cy - 16, cx - 40, cy + 22); ctx.quadraticCurveTo(cx, cy + 52, cx + 40, cy + 22); ctx.quadraticCurveTo(cx + 52, cy - 16, cx + 12, cy - 34); ctx.lineTo(cx + 12, cy - 44); ctx.closePath();
      ctx.fillStyle = '#b8653a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5a2e18'; ctx.stroke();
      trazo(ctx, [[cx - 44, cy - 2], [cx + 44, cy - 2]], 6, '#6e3a20');
      ctx.strokeStyle = '#f0d9a8'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = cx - 40; x < cx + 40; x += 8) { ctx.lineTo(x, cy - 4); ctx.lineTo(x + 4, cy + 2); } ctx.stroke();
      elipse(ctx, cx - 14, cy - 14, 8, 14, 'rgba(255,255,255,.18)', 0.4);
    } else if (h.id === 'metate') {
      elipse(ctx, cx, cy + 10, 62, 30, '#8a8478'); elipse(ctx, cx, cy + 4, 54, 22, '#a39d90');
      elipse(ctx, cx, cy + 6, 40, 12, '#7d776b');
      ctx.save(); ctx.translate(cx + 10, cy - 8); ctx.rotate(-0.2); rect(ctx, -34, -9, 68, 18, 9, '#6f695e'); ctx.restore();
    } else if (h.id === 'volante') {
      elipse(ctx, cx, cy, 34, 30, '#a0582f'); elipse(ctx, cx, cy, 8, 7, '#3a2414');
      ctx.strokeStyle = '#f0d9a8'; ctx.lineWidth = 2.4;
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 12); ctx.lineTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 25); ctx.stroke(); }
      trazo(ctx, [[cx + 40, cy + 20], [cx + 70, cy + 40]], 3, '#e8dcc0');
    } else if (h.id === 'descanso') {
      // fosa ovalada con piedras alrededor, una manta doblada y ofrendas (sin mostrar restos)
      elipse(ctx, cx, cy + 4, 78, 52, '#3e2716');
      for (let k = 0; k < 14; k++) { const a = k * TAU / 14; elipse(ctx, cx + Math.cos(a) * 84, cy + 4 + Math.sin(a) * 58, 11, 8, k % 2 ? '#9a9488' : '#b5afa2'); }
      ctx.save(); ctx.translate(cx, cy + 4); ctx.rotate(-0.08);
      rect(ctx, -46, -22, 92, 44, 14, '#c9a46a');
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3;
      [-30, -10, 10, 30].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x, 20); ctx.stroke(); });
      ctx.restore();
      elipse(ctx, cx - 60, cy - 26, 11, 9, '#b8653a'); elipse(ctx, cx + 58, cy - 24, 9, 8, '#a0582f');
      [[cx + 48, cy + 34], [cx + 56, cy + 30], [cx + 62, cy + 36]].forEach(([x, y]) => elipse(ctx, x, y, 3.5, 3.5, '#e8dcc0'));
    } else if (h.id === 'cuentas') {
      ctx.beginPath(); ctx.ellipse(cx, cy, 44, 26, 0.1, 0.2, TAU - 0.4); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.stroke();
      for (let k = 0; k < 14; k++) { const a = 0.2 + k * (TAU - 0.6) / 13; elipse(ctx, cx + Math.cos(a) * 44, cy + Math.sin(a) * 26, 5.5, 5, ['#e8dcc0', '#5fa3c9', '#c4513a', '#e8dcc0'][k % 4]); }
    } else if (h.id === 'tiestos') {
      [[-36, -12, 0.3], [6, -22, -0.4], [34, 8, 0.8], [-10, 20, -0.1]].forEach(([dx, dy, a], i) => {
        ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(14, -14); ctx.lineTo(20, 8); ctx.lineTo(-6, 16); ctx.lineTo(-20, 6); ctx.closePath();
        ctx.fillStyle = i % 2 ? '#c46a3a' : '#a85a30'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#5a2e18'; ctx.stroke();
        trazo(ctx, [[-14, -2], [-4, 4], [6, -4], [14, 2]], 2.4, '#f0d9a8');
        ctx.restore();
      });
    }
    ctx.restore();
  }

  function pintarFondoExcavacion(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, EX.H);
    g.addColorStop(0, '#6e4a2c'); g.addColorStop(1, '#4e321c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, EX.W, EX.H);
    const r = aleatorio(7);
    for (let i = 0; i < 500; i++) elipse(ctx, r() * EX.W, r() * EX.H, 1 + r() * 3, 1 + r() * 2, r() < 0.5 ? 'rgba(30,18,8,.35)' : 'rgba(160,120,80,.25)');
    HALLAZGOS.forEach(h => pintarHallazgo(ctx, h, celdaRect(h.celda)));
  }
  function pintarTierra(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, EX.H);
    g.addColorStop(0, '#c9a46a'); g.addColorStop(1, '#a9824e');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g; ctx.fillRect(0, 0, EX.W, EX.H);
    const r = aleatorio(3);
    for (let i = 0; i < 900; i++) elipse(ctx, r() * EX.W, r() * EX.H, 1 + r() * 4, 1 + r() * 3, r() < 0.5 ? 'rgba(110,80,40,.35)' : 'rgba(240,220,170,.3)');
    for (let i = 0; i < 40; i++) elipse(ctx, r() * EX.W, r() * EX.H, 4 + r() * 7, 3 + r() * 5, r() < 0.5 ? '#9a9488' : '#b5afa2');
    for (let i = 0; i < 26; i++) { const x = r() * EX.W, y = r() * EX.H; trazo(ctx, [[x, y], [x + 8, y - 10]], 2.4, '#6aa845'); }
  }
  function pintarCuadricula(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,250,235,.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    for (let c = 1; c < EX.COLS; c++) { const x = c * EX.W / EX.COLS; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, EX.H); ctx.stroke(); }
    for (let f = 1; f < EX.FILAS; f++) { const y = f * EX.H / EX.FILAS; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(EX.W, y); ctx.stroke(); }
    ctx.fillStyle = '#e9e1cf';
    for (let c = 0; c <= EX.COLS; c++) for (let f = 0; f <= EX.FILAS; f++) { ctx.beginPath(); ctx.arc(c * EX.W / EX.COLS, f * EX.H / EX.FILAS, 5, 0, TAU); ctx.fill(); }
    ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,250,235,.9)';
    for (let c = 0; c < EX.COLS; c++) for (let f = 0; f < EX.FILAS; f++) ctx.fillText('ABCD'[c] + (f + 1), c * EX.W / EX.COLS + 8, f * EX.H / EX.FILAS + 20);
    ctx.restore();
  }

  function excavacion() {
    return new Promise(resolver => {
      const capa = abrirCapa({ titulo: 'La excavación', quien: 'Con Julián, el arqueólogo · El lugar de los ancestros', emoji: '🧑🏽‍🔬', color: '#7a5c3e' });
      const c = capa.contenido;
      c.innerHTML = `
        <p class="mj-texto" id="mj-instr" aria-live="polite"></p>
        <div class="mj-cuerpo">
          <div class="mj-area" id="mj-area"><canvas id="mj-fondo" width="${EX.W}" height="${EX.H}" aria-hidden="true"></canvas><canvas id="mj-tierra" width="${EX.W}" height="${EX.H}" role="img" aria-label="Cuadro de excavación dividido en cuadros, cubierto de tierra. Pasa la brocha para descubrir lo que hay debajo."></canvas></div>
          <div class="mj-libreta"><h3><span aria-hidden="true">📓</span> Libreta de campo</h3><ol id="mj-lista"></ol></div>
        </div>
        <div class="mj-controles">
          <span class="mj-cuenta" id="mj-cuenta"></span>
          <button type="button" class="gu-btn" id="mj-ayuda"><span aria-hidden="true">🖌️</span> Ayúdame a excavar</button>
        </div>
        <div id="mj-hallazgo" aria-live="polite"></div>`;
      const fondo = c.querySelector('#mj-fondo').getContext('2d');
      const lienzoTierra = c.querySelector('#mj-tierra');
      const tierra = lienzoTierra.getContext('2d', { willReadFrequently: true });
      pintarFondoExcavacion(fondo);
      pintarTierra(tierra);
      pintarCuadricula(tierra);
      const encontrados = new Set();
      const instr = c.querySelector('#mj-instr');
      const decir = t => { instr.textContent = t; V.decir(t); };
      decir('Los arqueólogos excavan despacio, capa por capa, con una brocha. Pasa el dedo o el mouse por la tierra para limpiarla y descubrir lo que guardaron los ancestros.');
      const lista = c.querySelector('#mj-lista');
      const actualizarLista = () => {
        lista.innerHTML = HALLAZGOS.map(h => encontrados.has(h.id)
          ? `<li><b><span aria-hidden="true">${h.emoji}</span> ${esc(h.nombre)}</b></li>`
          : '<li class="mj-falta">Sin descubrir</li>').join('');
        c.querySelector('#mj-cuenta').textContent = `Hallazgos: ${encontrados.size} de ${HALLAZGOS.length}`;
      };
      actualizarLista();

      // limpiar con la brocha: se borra la capa de tierra
      const brochazo = (x, y, r = 30) => {
        tierra.save();
        tierra.globalCompositeOperation = 'destination-out';
        const g = tierra.createRadialGradient(x, y, r * 0.3, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        tierra.fillStyle = g; tierra.beginPath(); tierra.arc(x, y, r, 0, TAU); tierra.fill();
        tierra.restore();
      };
      // ¿cuánto se ve de cada hallazgo?
      const revisar = () => {
        HALLAZGOS.forEach(h => {
          if (encontrados.has(h.id)) return;
          const r = celdaRect(h.celda);
          const m = 30;
          const datos = tierra.getImageData(r.x + m, r.y + m * 0.7, r.w - m * 2, r.h - m * 1.4).data;
          let vistos = 0, total = 0;
          for (let i = 3; i < datos.length; i += 16) { total++; if (datos[i] < 90) vistos++; }
          if (vistos / total > 0.5) descubrir(h);
        });
      };
      const descubrir = h => {
        encontrados.add(h.id);
        // se termina de limpiar ese cuadro
        const r = celdaRect(h.celda);
        tierra.save(); tierra.globalCompositeOperation = 'destination-out'; tierra.fillStyle = 'rgba(0,0,0,.85)'; tierra.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); tierra.restore();
        pintarCuadricula(tierra);
        fondo.save(); fondo.strokeStyle = '#f4c542'; fondo.lineWidth = 5; fondo.setLineDash([10, 8]); fondo.strokeRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12); fondo.restore();
        A.efecto(h.id === 'descanso' ? 'llegada' : 'semilla');
        actualizarLista();
        c.querySelector('#mj-hallazgo').innerHTML = `<div class="mj-hallazgo"><h3><span aria-hidden="true">${h.emoji}</span> ${esc(h.nombre)}</h3><p>${esc(h.texto)}</p></div>`;
        V.decir(`¡Encontraste ${h.nombre}! ${h.texto}`);
        if (encontrados.size === HALLAZGOS.length) setTimeout(reflexion, quieto() ? 300 : 1600);
      };

      // brocha con el dedo o el mouse
      let pintando = false, ultimo = null, cuenta = 0;
      const punto = e => { const b = lienzoTierra.getBoundingClientRect(); return { x: (e.clientX - b.left) * EX.W / b.width, y: (e.clientY - b.top) * EX.H / b.height }; };
      lienzoTierra.addEventListener('pointerdown', e => { pintando = true; lienzoTierra.setPointerCapture(e.pointerId); ultimo = punto(e); brochazo(ultimo.x, ultimo.y); });
      lienzoTierra.addEventListener('pointermove', e => {
        if (!pintando) return;
        const p = punto(e);
        const d = Math.hypot(p.x - ultimo.x, p.y - ultimo.y), pasos = Math.ceil(d / 10);
        for (let k = 1; k <= pasos; k++) brochazo(ultimo.x + (p.x - ultimo.x) * k / pasos, ultimo.y + (p.y - ultimo.y) * k / pasos);
        ultimo = p;
        if (++cuenta % 6 === 0) { revisar(); if (cuenta % 18 === 0) A.efecto('clic'); }
      });
      const soltar = () => { if (pintando) { pintando = false; revisar(); } };
      lienzoTierra.addEventListener('pointerup', soltar);
      lienzoTierra.addEventListener('pointercancel', soltar);

      // para teclado y pulsador: cada toque limpia la mitad del siguiente hallazgo
      let mitad = {};
      c.querySelector('#mj-ayuda').addEventListener('click', () => {
        const h = HALLAZGOS.find(x => !encontrados.has(x.id));
        if (!h) return;
        const r = celdaRect(h.celda);
        const paso = mitad[h.id] ? 2 : 1;
        for (let y = r.y + 20; y < r.y + r.h - 10; y += 22) for (let x = r.x + 20; x < r.x + r.w - 10; x += 22) {
          if (paso === 1 && x > r.x + r.w / 2) continue;
          brochazo(x, y, 26);
        }
        if (paso === 1) { mitad[h.id] = true; instr.textContent = `Limpias el cuadro ${'ABCD'[h.celda[0]]}${h.celda[1] + 1}… ¡algo empieza a asomar! Toca otra vez para terminar.`; V.decir(instr.textContent); A.efecto('clic'); }
        else descubrir(h);
      });

      function reflexion() {
        V.callar();
        c.innerHTML = `
          <div class="mj-reflexion">
            <p class="mj-texto" aria-live="polite">${esc('¡Descubriste los seis hallazgos! Ahora piensa con Julián.')}</p>
            <p>Lo que encontraste no es un tesoro para vender: es la memoria de los abuelos y las abuelas muiscas. Por eso, cuando los arqueólogos excavan, todo se registra y se deja cuidado, y el lugar de descanso de los ancestros se trata como un <b>lugar sagrado</b>.</p>
            <p>Los ancestros sembraron estas montañas, cuidaron el agua y miraron el sol y la luna. Su historia sigue viva en Usme, en sus familias campesinas y en este parque.</p>
            <p><b>¿Qué te comprometes a hacer como guardián o guardiana?</b></p>
            <div class="mj-opciones">
              <button type="button" class="gu-btn" data-c="Caminar con calma y respeto por los lugares sagrados."><span aria-hidden="true">🤫</span>Caminar con calma y respeto</button>
              <button type="button" class="gu-btn" data-c="Dejar todo donde está y avisar si encuentro algo antiguo."><span aria-hidden="true">📣</span>No llevarme nada y avisar si encuentro algo</button>
              <button type="button" class="gu-btn" data-c="Contarle a mi familia lo que aprendí de los ancestros."><span aria-hidden="true">🗣️</span>Contarle a mi familia lo que aprendí</button>
            </div>
            <div id="mj-gracias" aria-live="polite"></div>
          </div>`;
        V.decir('¡Descubriste los seis hallazgos! Lo que encontraste no es un tesoro para vender: es la memoria de los abuelos y las abuelas muiscas. ¿Qué te comprometes a hacer como guardián o guardiana?');
        setTimeout(() => c.querySelector('.mj-opciones .gu-btn').focus({ preventScroll: true }), 60);
        c.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
          A.efecto('acierto');
          c.querySelectorAll('[data-c]').forEach(x => { x.disabled = true; x.classList.toggle('gu-resp-bien', x === b); });
          c.querySelector('#mj-gracias').innerHTML = `<div class="mj-hallazgo"><h3>¡Gracias, guardián, guardiana!</h3><p>Tu compromiso: ${esc(b.dataset.c)}</p></div>
            <div class="mj-controles" style="margin-top:10px"><button type="button" class="gu-btn gu-btn-grande gu-btn-principal" id="mj-seguir">Hablar con Julián <span aria-hidden="true">▶</span></button></div>`;
          V.decir(`Gracias. Tu compromiso: ${b.dataset.c}`);
          const s = c.querySelector('#mj-seguir');
          s.focus({ preventScroll: true });
          s.addEventListener('click', () => { capa.cerrar(); resolver({ hallazgos: encontrados.size, compromiso: b.dataset.c }); });
        }));
      }
    });
  }

  /* =====================================================================
   * 2. LOS BINOCULARES (con Rita): campo y ciudad
   * ===================================================================== */

  const PB = { W: 1600, H: 600 };
  const PROBLEMAS = [
    { id: 'tala', x: 630, y: 425, nombre: 'Tala de árboles', emoji: '🪓',
      texto: 'Sin árboles, la tierra se derrumba, se pierde el agua y los animales se quedan sin casa.', hacer: 'Sembrar árboles nativos y no talar el bosque.' },
    { id: 'oso', x: 470, y: 330, nombre: 'Animales sin casa', emoji: '🐻',
      texto: 'El oso de anteojos se aleja porque la ciudad y las máquinas crecen sobre su bosque. Lo mismo les pasa a la tingua y a la rana.', hacer: 'Proteger los bosques y los páramos, y nunca comprar animales silvestres.' },
    { id: 'humedal', x: 820, y: 410, nombre: 'Construcciones sobre el humedal', emoji: '🏗️',
      texto: 'Cuando rellenan un humedal para construir, la tingua y la rana pierden su hogar y el agua de la lluvia ya no tiene a dónde ir.', hacer: 'Respetar los humedales y las zonas de protección.' },
    { id: 'relleno', x: 980, y: 300, nombre: 'Montaña de basura', emoji: '🗑️',
      texto: 'Toda la basura que botamos termina en un relleno. En Usme está el relleno Doña Juana: sus olores y líquidos afectan a los vecinos y al río.', hacer: 'Reducir, reutilizar, separar la basura y hacer compostaje con los restos de comida.' },
    { id: 'basura', x: 1085, y: 515, nombre: 'Basura en el río', emoji: '🥤',
      texto: 'Bolsas y botellas caen al río y viajan muy lejos. Los peces y las aves se las comen o se enredan en ellas.', hacer: 'Recoger tu basura, usar menos plástico y nunca botar nada al río.' },
    { id: 'carros', x: 1210, y: 420, nombre: 'Muchos carros, mucho humo', emoji: '🚗',
      texto: 'Los carros queman gasolina y llenan el aire de humo y de ruido. Ese aire lo respiramos todos.', hacer: 'Caminar, montar en bicicleta o usar el transporte público.' },
    { id: 'tubo', x: 1300, y: 500, nombre: 'Agua sucia que cae al río', emoji: '🚰',
      texto: 'Por este tubo llega agua con jabón y químicos. El río se pone café y huele mal: las ranas y los peces no pueden vivir ahí.', hacer: 'No echar aceite ni químicos al desagüe y cuidar las orillas del río.' },
    { id: 'fabrica', x: 1450, y: 175, nombre: 'Fábrica que contamina el aire', emoji: '🏭',
      texto: 'El humo negro de algunas fábricas ensucia el aire, enferma a las personas y calienta el planeta.', hacer: 'Pedir que las empresas usen filtros y cumplan las normas para cuidar el aire.' },
  ];

  function pintarPanorama(ctx) {
    const { W, H } = PB;
    const r = aleatorio(11);
    // cielo: limpio en el campo, gris en la ciudad
    let g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#bfe3f2'); g.addColorStop(0.5, '#cfe2e6'); g.addColorStop(0.75, '#c9c6bd'); g.addColorStop(1, '#b3aea4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // montañas del páramo
    ctx.fillStyle = '#93ab9c'; ctx.beginPath(); ctx.moveTo(0, 250); [[120, 150], [260, 230], [380, 140], [520, 220], [640, 170], [800, 250]].forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(800, 300); ctx.lineTo(0, 300); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; [[200, 175, 90, 20], [520, 200, 110, 22]].forEach(([x, y, w, h]) => elipse(ctx, x, y, w, h, 'rgba(255,255,255,.45)'));
    // ciudad al fondo
    for (let x = 1080; x < W; x += 46 + r() * 30) {
      const h = 120 + r() * 170, w = 44 + r() * 30;
      rect(ctx, x, 330 - h, w, h, 2, ['#8d8f94', '#a2a3a6', '#7b7f86', '#9a9184'][Math.floor(r() * 4)]);
      ctx.fillStyle = 'rgba(255,240,180,.55)';
      for (let yy = 330 - h + 10; yy < 320; yy += 16) for (let xx = x + 6; xx < x + w - 8; xx += 12) if (r() > 0.3) ctx.fillRect(xx, yy, 6, 8);
    }
    // suelo: verde en el campo, cemento en la ciudad
    g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#8fbd5c'); g.addColorStop(0.42, '#93b85a'); g.addColorStop(0.55, '#a9a77a'); g.addColorStop(0.66, '#a19f98'); g.addColorStop(1, '#94938e');
    ctx.fillStyle = g; ctx.fillRect(0, 300, W, H - 300);
    // relleno sanitario (montaña de basura con gallinazos)
    ctx.fillStyle = '#7e7366'; ctx.beginPath(); ctx.moveTo(880, 345); ctx.quadraticCurveTo(980, 230, 1090, 345); ctx.fill();
    for (let i = 0; i < 70; i++) { const x = 900 + r() * 170, y = 300 + r() * 45; if (y > 345 - (Math.sin((x - 880) / 210 * Math.PI) * 95)) rect(ctx, x, y, 6 + r() * 8, 4 + r() * 5, 1, ['#c0392b', '#2e6da4', '#e0a526', '#efe3c6', '#3c8d4f'][Math.floor(r() * 5)]); }
    ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 2.4;
    [[950, 240], [990, 225], [1030, 245]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 9, y - 3); ctx.quadraticCurveTo(x - 4, y - 7, x, y); ctx.quadraticCurveTo(x + 4, y - 7, x + 9, y - 3); ctx.stroke(); });
    // carretera con carros
    rect(ctx, 900, 395, 700, 46, 0, '#5f6064');
    ctx.strokeStyle = '#f2e6b0'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]); trazo(ctx, [[900, 418], [1600, 418]], 3, '#f2e6b0'); ctx.setLineDash([]);
    [[1000, 404, '#c0392b'], [1130, 424, '#2e6da4'], [1210, 404, '#e0a526'], [1300, 424, '#7a7f88'], [1420, 404, '#3c8d4f'], [1530, 424, '#7b3f8f']].forEach(([x, y, c]) => {
      rect(ctx, x - 30, y - 12, 60, 18, 6, c); rect(ctx, x - 18, y - 24, 34, 14, 5, c); rect(ctx, x - 14, y - 21, 12, 9, 2, '#cfe2ec'); rect(ctx, x + 1, y - 21, 12, 9, 2, '#cfe2ec');
      elipse(ctx, x - 18, y + 7, 7, 7, '#222'); elipse(ctx, x + 18, y + 7, 7, 7, '#222');
      [0, 1, 2].forEach(k => elipse(ctx, x - 38 - k * 12, y + 2 - k * 6, 7 + k * 3, 6 + k * 2, `rgba(70,70,70,${0.45 - k * 0.12})`));
    });
    // fábrica con chimeneas y humo negro
    rect(ctx, 1370, 250, 160, 140, 3, '#6e6a63'); rect(ctx, 1380, 270, 140, 20, 2, '#5a5650');
    [[1400, 160], [1460, 140]].forEach(([x, y]) => { rect(ctx, x, y, 24, 250 - y, 2, '#8a5a48'); rect(ctx, x - 3, y, 30, 10, 2, '#5a3a2e');
      [0, 1, 2, 3].forEach(k => elipse(ctx, x + 12 + k * 18, y - 18 - k * 22, 18 + k * 8, 14 + k * 6, `rgba(40,38,36,${0.8 - k * 0.15})`)); });
    // río: limpio a la izquierda, sucio después del tubo
    g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#3d84b4'); g.addColorStop(0.62, '#4a86a8'); g.addColorStop(0.8, '#7d7150'); g.addColorStop(1, '#6a5c3e');
    ctx.beginPath(); ctx.moveTo(0, 492); ctx.bezierCurveTo(400, 470, 800, 540, 1600, 488); ctx.lineTo(1600, 548); ctx.bezierCurveTo(800, 600, 400, 530, 0, 552); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,250,.7)'; ctx.lineWidth = 2;
    for (let x = 30; x < 900; x += 70) { ctx.beginPath(); ctx.moveTo(x, 515 + Math.sin(x) * 6); ctx.quadraticCurveTo(x + 14, 509, x + 28, 515 + Math.sin(x) * 6); ctx.stroke(); }
    // tubo que vierte agua sucia
    rect(ctx, 1290, 430, 26, 58, 4, '#6f7276'); rect(ctx, 1284, 484, 38, 12, 4, '#55585c');
    ctx.fillStyle = '#5a4a2a'; ctx.beginPath(); ctx.moveTo(1290, 496); ctx.quadraticCurveTo(1300, 520, 1280, 540); ctx.lineTo(1330, 540); ctx.quadraticCurveTo(1318, 520, 1318, 496); ctx.fill();
    elipse(ctx, 1305, 540, 60, 12, 'rgba(70,60,30,.7)');
    // basura flotando en el río
    [[1050, 512], [1070, 524], [1095, 508], [1112, 526], [1130, 514]].forEach(([x, y], i) => {
      if (i % 2) { ctx.save(); ctx.translate(x, y); ctx.rotate(0.6); rect(ctx, -10, -4, 20, 8, 3, '#bfe0f0'); rect(ctx, 9, -2, 5, 4, 1, '#2e6da4'); ctx.restore(); }
      else elipse(ctx, x, y, 11, 8, ['#efe3c6', '#c0392b', '#2b2b2b'][i % 3]);
    });
    // construcciones sobre el humedal: ladrillo, grúa y el humedal que se rellena
    elipse(ctx, 830, 455, 90, 24, '#5f9e86'); elipse(ctx, 860, 450, 50, 14, '#a3906a');
    for (let k = 0; k < 6; k++) { const x = 800 + (k % 3) * 12, y = 440 - Math.floor(k / 3) * 8; rect(ctx, x, y, 11, 7, 1, '#b4532a'); }
    rect(ctx, 760, 360, 70, 70, 2, '#c46a3a'); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 366; y < 430; y += 9) ctx.fillRect(760, y, 70, 1.5);
    rect(ctx, 772, 378, 16, 16, 1, '#3a3a3a'); rect(ctx, 802, 378, 16, 16, 1, '#3a3a3a');
    trazo(ctx, [[880, 440], [880, 300]], 6, '#e0a526'); trazo(ctx, [[860, 305], [960, 305]], 5, '#e0a526'); trazo(ctx, [[940, 305], [940, 350]], 1.5, '#333'); rect(ctx, 930, 350, 20, 12, 1, '#7a7f88');
    // tala: tocones, troncos y una motosierra
    [[590, 440], [640, 452], [690, 438], [615, 470]].forEach(([x, y]) => { rect(ctx, x - 12, y - 16, 24, 18, 4, '#7a5232'); elipse(ctx, x, y - 16, 12, 5, '#d9b98a'); ctx.beginPath(); ctx.arc(x, y - 16, 5, 0, TAU); ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 1.2; ctx.stroke(); });
    ctx.save(); ctx.translate(660, 405); ctx.rotate(-0.15); rect(ctx, -60, -9, 120, 18, 9, '#8a5a32'); elipse(ctx, 60, 0, 6, 9, '#d9b98a'); ctx.restore();
    rect(ctx, 700, 455, 26, 14, 3, '#e0662b'); rect(ctx, 724, 459, 30, 5, 2, '#9aa0a8');
    // el campo: frailejones, árboles, casa campesina, tingua y rana
    for (let i = 0; i < 9; i++) figura(ctx, gg => D.frailejon(gg, i % 3 === 0), 64, 100, 40 + i * 38 + r() * 14, 330 + r() * 40, 0.55 + r() * 0.2);
    [[90, 420], [200, 400], [330, 430], [520, 410]].forEach(([x, y], i) => figura(ctx, gg => D.arbol(gg, i % 2 ? 'encenillo' : 'aliso', i, 130, 150), 130, 150, x, y, 0.75));
    figura(ctx, D.casa, 290, 232, 290, 365, 0.32);
    figura(ctx, gg => D.vaca(gg), 82, 60, 410, 470, 0.7);
    figura(ctx, gg => D.tita(gg, 0), 92, 84, 240, 505, 0.55);
    figura(ctx, D.rita, 68, 58, 150, 480, 0.55);
    // el oso de anteojos se aleja de las máquinas
    figura(ctx, D.tomas, 96, 100, 470, 372, 0.62, true);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(500, 290, 16, 14, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2b2118'; ctx.font = '800 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', 500, 297);
  }

  function binoculares() {
    return new Promise(resolver => {
      const capa = abrirCapa({ titulo: 'Los binoculares de Rita', quien: 'Con Rita, la rana sabanera · La quebrada del bosque', emoji: '🐸', color: '#4f8a3c' });
      capa.capa.classList.add('mj-lleno');
      const c = capa.contenido;
      c.innerHTML = `
        <p class="mj-texto" id="mj-instr" aria-live="polite"></p>
        <div class="mj-area" id="mj-area" style="background:#1d1813"><canvas id="mj-vista" width="${PB.W}" height="${PB.H}" role="img" aria-label="Paisaje: a la izquierda el campo y el páramo; a la derecha la ciudad. Solo se ve lo que está dentro de los binoculares."></canvas>
          <div class="mj-sensor" id="mj-sensor" hidden><span aria-hidden="true">📱</span> Mueve el celular para mirar</div>
          <div class="mj-flota" id="mj-hallazgo" aria-live="polite"></div></div>
        <div class="mj-controles">
          <span class="mj-cuenta" id="mj-cuenta"></span>
          <button type="button" class="gu-btn" id="mj-celular" hidden aria-pressed="false"><span aria-hidden="true">📱</span> <span>Mover con el celular</span></button>
          <button type="button" class="gu-btn" id="mj-mover"><span aria-hidden="true">🔭</span> Mover los binoculares</button>
          <button type="button" class="gu-btn gu-btn-principal" id="mj-mirar"><span aria-hidden="true">🔍</span> ¿Qué ves aquí?</button>
        </div>`;
      const panorama = document.createElement('canvas');
      panorama.width = PB.W; panorama.height = PB.H;
      pintarPanorama(panorama.getContext('2d'));
      const lienzo = c.querySelector('#mj-vista');
      const ctx = lienzo.getContext('2d');
      const instr = c.querySelector('#mj-instr');
      const hallazgo = c.querySelector('#mj-hallazgo');
      const encontrados = new Set();
      const LENTE = 130, SEP = 105;
      const vista = { x: 260, y: 400 };
      let ancla = { ...vista }, quieta = 0, ultimoT = performance.now(), activo = true;
      const decir = t => { instr.textContent = t; V.decir(t); };
      const tactil = matchMedia('(pointer: coarse)').matches;
      decir(tactil
        ? 'Desde aquí se ve el campo y la ciudad. Mueve el celular o arrastra el dedo para mover los binoculares, y busca ocho cosas que le hacen daño a nuestros ecosistemas.'
        : 'Desde aquí se ve el campo y la ciudad. Mueve los binoculares con el mouse o las flechas, y busca ocho cosas que le hacen daño a nuestros ecosistemas.');

      const dentro = p => Math.hypot(p.x - vista.x, (p.y - vista.y) * 1.2) < LENTE + SEP * 0.6;
      function dibujar() {
        ctx.clearRect(0, 0, PB.W, PB.H);
        ctx.drawImage(panorama, 0, 0);
        // máscara oscura con el hueco de los binoculares
        ctx.save();
        ctx.fillStyle = 'rgba(12,14,18,.86)';
        ctx.beginPath(); ctx.rect(0, 0, PB.W, PB.H);
        ctx.moveTo(vista.x - SEP + LENTE, vista.y); ctx.arc(vista.x - SEP, vista.y, LENTE, 0, TAU, true);
        ctx.moveTo(vista.x + SEP + LENTE, vista.y); ctx.arc(vista.x + SEP, vista.y, LENTE, 0, TAU, true);
        ctx.fill('evenodd');
        ctx.lineWidth = 14; ctx.strokeStyle = '#1b1b1d';
        [-SEP, SEP].forEach(dx => { ctx.beginPath(); ctx.arc(vista.x + dx, vista.y, LENTE, 0, TAU); ctx.stroke(); });
        ctx.restore();
        // lo ya encontrado queda marcado aunque esté fuera de los binoculares
        PROBLEMAS.forEach(p => {
          if (!encontrados.has(p.id)) return;
          ctx.beginPath(); ctx.arc(p.x, p.y, 44, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = '#f4c542'; ctx.stroke();
          ctx.fillStyle = '#2f9a46'; ctx.beginPath(); ctx.arc(p.x + 34, p.y - 34, 15, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + 27, p.y - 34); ctx.lineTo(p.x + 32, p.y - 28); ctx.lineTo(p.x + 41, p.y - 40); ctx.stroke();
        });
        c.querySelector('#mj-cuenta').textContent = `Encontrados: ${encontrados.size} de ${PROBLEMAS.length}`;
      }
      dibujar();

      const identificar = p => {
        if (encontrados.has(p.id)) return;
        encontrados.add(p.id);
        A.efecto('semilla');
        dibujar();
        // la explicación flota sobre el paisaje y se cierra con «Seguir buscando»
        hallazgo.innerHTML = `<div class="mj-hallazgo"><h3><span aria-hidden="true">${p.emoji}</span> ${esc(p.nombre)}</h3><p>${esc(p.texto)}</p><p><b>Qué podemos hacer:</b> ${esc(p.hacer)}</p>
          <button type="button" class="gu-btn" data-cerrar>Seguir buscando <span aria-hidden="true">🔭</span></button></div>`;
        hallazgo.querySelector('[data-cerrar]').addEventListener('click', () => { hallazgo.innerHTML = ''; V.callar(); });
        V.decir(`¡Lo encontraste! ${p.nombre}. ${p.texto} Qué podemos hacer: ${p.hacer}`);
        if (encontrados.size === PROBLEMAS.length) setTimeout(final, quieto() ? 300 : 2200);
      };
      // lo que está en el centro de los binoculares (el más cercano)
      const enLaMira = () => PROBLEMAS.filter(p => !encontrados.has(p.id) && dentro(p)).sort((a, b) => Math.hypot(a.x - vista.x, a.y - vista.y) - Math.hypot(b.x - vista.x, b.y - vista.y))[0];

      // El paisaje llena todo el espacio y se ve de cerca (a lo sumo VISTA_ANCHO de ancho): así
      // todo se ve más grande. El dibujo se corre para que los binoculares queden en el centro.
      const VISTA_ANCHO = 1000;
      const area = c.querySelector('#mj-area');
      let escala = 1;
      function encuadrar() {
        const aw = area.clientWidth, ah = area.clientHeight;
        if (!aw || !ah) return;
        escala = Math.max(ah / PB.H, aw / VISTA_ANCHO);
        const w = PB.W * escala, h = PB.H * escala;
        lienzo.style.width = w + 'px'; lienzo.style.height = h + 'px';
        const tx = Math.max(0, Math.min(w - aw, vista.x * escala - aw / 2));
        const ty = Math.max(0, Math.min(h - ah, vista.y * escala - ah / 2));
        lienzo.style.transform = `translate(${-tx}px, ${-ty}px)`;
      }
      const mover = (x, y) => {
        vista.x = Math.max(SEP, Math.min(PB.W - SEP, x));
        vista.y = Math.max(LENTE * 0.6, Math.min(PB.H - LENTE * 0.4, y));
        // el temblor de la mano no cuenta como moverse: solo un cambio grande reinicia la espera
        if (Math.hypot(vista.x - ancla.x, vista.y - ancla.y) > 30) { quieta = 0; ancla = { ...vista }; }
        encuadrar();
        dibujar();
      };
      encuadrar();
      window.addEventListener('resize', encuadrar);
      const medir = window.ResizeObserver ? new ResizeObserver(encuadrar) : null;
      if (medir) medir.observe(area);
      const punto = e => { const b = lienzo.getBoundingClientRect(); return { x: (e.clientX - b.left) * PB.W / b.width, y: (e.clientY - b.top) * PB.H / b.height }; };

      // Mover el celular, como unos binoculares de verdad: girarlo a los lados mueve a los lados;
      // inclinarlo hacia arriba o abajo, arriba o abajo. Se calcula hacia dónde apunta la parte de
      // atrás del celular, así funciona igual con el celular acostado o parado.
      const sensor = { activo: false, base: null };
      const POR_GRADO_X = 22, POR_GRADO_Y = 16; // puntos del paisaje por cada grado que se mueve el celular
      const rad = Math.PI / 180;
      function apunta(e) {
        const a = e.alpha * rad, b = e.beta * rad, g = e.gamma * rad;
        const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
        // eje que sale por detrás del celular, en coordenadas de la Tierra (x este, y norte, z arriba)
        const vx = -(cA * sG + cG * sA * sB), vy = -(sA * sG - cA * cG * sB), vz = -(cB * cG);
        return { giro: Math.atan2(vx, vy) / rad, alto: Math.asin(Math.max(-1, Math.min(1, vz))) / rad };
      }

      let arrastre = false, previo = null;
      lienzo.addEventListener('pointerdown', e => {
        arrastre = true; lienzo.setPointerCapture(e.pointerId);
        previo = { x: e.clientX, y: e.clientY };
        const q = punto(e);
        // tocar algo que ya se ve dentro de los binoculares lo identifica
        const tocado = PROBLEMAS.find(p => !encontrados.has(p.id) && dentro(p) && Math.hypot(p.x - q.x, p.y - q.y) < 80);
        if (tocado) identificar(tocado); else if (e.pointerType === 'mouse') mover(q.x, q.y);
      });
      lienzo.addEventListener('pointermove', e => {
        if (e.pointerType === 'mouse') { const q = punto(e); mover(q.x, q.y); return; }
        // con el dedo, arrastrar mueve los binoculares en la dirección del dedo
        if (!arrastre) return;
        const dx = (e.clientX - previo.x) / escala, dy = (e.clientY - previo.y) / escala;
        previo = { x: e.clientX, y: e.clientY };
        mover(vista.x + dx, vista.y + dy);
        sensor.base = null; // el celular sigue desde donde lo dejó el dedo
      });
      lienzo.addEventListener('pointerup', () => { arrastre = false; });
      lienzo.addEventListener('pointercancel', () => { arrastre = false; });

      const botonCelular = c.querySelector('#mj-celular');
      const avisoSensor = c.querySelector('#mj-sensor');
      let escuchando = false;
      function alMoverCelular(e) {
        if (e.alpha == null || e.beta == null || e.gamma == null) return;
        if (!sensor.activo) activarSensor();
        if (arrastre) return;
        const o = apunta(e);
        const base = sensor.base;
        if (!base) { sensor.base = { ...o, x: vista.x, y: vista.y }; return; }
        let dg = o.giro - base.giro;
        if (dg > 180) dg -= 360;
        if (dg < -180) dg += 360;
        let tx = base.x + dg * POR_GRADO_X, ty = base.y - (o.alto - base.alto) * POR_GRADO_Y;
        // en el borde, el punto de partida se corre: al devolverse, responde enseguida
        const minX = SEP, maxX = PB.W - SEP, minY = LENTE * 0.6, maxY = PB.H - LENTE * 0.4;
        if (tx < minX || tx > maxX) { tx = Math.max(minX, Math.min(maxX, tx)); base.giro = o.giro; base.x = tx; }
        if (ty < minY || ty > maxY) { ty = Math.max(minY, Math.min(maxY, ty)); base.alto = o.alto; base.y = ty; }
        // suavizado para que no tiemble
        const k = quieto() ? 1 : 0.35;
        mover(vista.x + (tx - vista.x) * k, vista.y + (ty - vista.y) * k);
      }
      function escuchar(si) {
        if (si === escuchando) return;
        escuchando = si;
        if (si) window.addEventListener('deviceorientation', alMoverCelular);
        else {
          window.removeEventListener('deviceorientation', alMoverCelular);
          sensor.activo = false; sensor.base = null; avisoSensor.hidden = true;
          botonCelular.setAttribute('aria-pressed', 'false');
          botonCelular.lastElementChild.textContent = 'Mover con el celular';
        }
      }
      // el celular sí mandó datos de movimiento: se avisa y el botón sirve para apagarlo
      function activarSensor() {
        sensor.activo = true;
        botonCelular.hidden = false;
        botonCelular.setAttribute('aria-pressed', 'true');
        botonCelular.lastElementChild.textContent = 'Mover con el dedo';
        avisoSensor.hidden = false;
        setTimeout(() => { avisoSensor.hidden = true; }, 4000);
      }
      const pidePermiso = !!(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function');
      // En Android funciona solo. En iPhone no llega nada hasta pedir permiso con un toque:
      // si en un segundo no hay datos, aparece el botón «Mover con el celular».
      if (tactil && window.DeviceOrientationEvent) {
        escuchar(true);
        if (pidePermiso) setTimeout(() => { if (activo && !sensor.activo) botonCelular.hidden = false; }, 1000);
      }
      botonCelular.addEventListener('click', async () => {
        if (escuchando && sensor.activo) {
          escuchar(false);
          decir('Ahora mueves los binoculares con el dedo.');
          return;
        }
        if (pidePermiso) {
          let permiso = 'denied';
          try { permiso = await DeviceOrientationEvent.requestPermission(); } catch (e) { /* sin permiso */ }
          if (permiso !== 'granted') { decir('No se pudo usar el movimiento del celular. Mueve los binoculares con el dedo.'); botonCelular.hidden = true; return; }
        }
        escuchar(true);
        decir('Mueve el celular hacia los lados, arriba o abajo para mirar con los binoculares.');
      });

      // si los binoculares se quedan quietos sobre un problema, se identifica solo
      const vigilar = t => {
        if (!activo) return;
        const dt = t - ultimoT; ultimoT = t;
        const p = enLaMira();
        if (p && Math.hypot(p.x - vista.x, p.y - vista.y) < LENTE) { quieta += dt; if (quieta > 900) { quieta = 0; identificar(p); } } else quieta = 0;
        requestAnimationFrame(vigilar);
      };
      requestAnimationFrame(vigilar);
      const teclas = e => {
        const m = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -45], ArrowDown: [0, 45] }[e.key];
        if (m) { e.preventDefault(); e.stopPropagation(); mover(vista.x + m[0], vista.y + m[1]); const p = enLaMira(); if (p) instr.textContent = 'Algo se ve en los binoculares… ¿qué será? Toca «¿Qué ves aquí?».'; }
      };
      window.addEventListener('keydown', teclas, true);
      // pulsador y teclado: saltar al siguiente lugar con algo por descubrir
      let turno = 0;
      c.querySelector('#mj-mover').addEventListener('click', () => {
        const faltan = PROBLEMAS.filter(p => !encontrados.has(p.id));
        if (!faltan.length) return;
        const p = faltan[turno++ % faltan.length];
        mover(p.x + 40, p.y + 10);
        sensor.base = null;
        decir('Moviste los binoculares. Algo se ve por aquí… ¿qué será?');
      });
      c.querySelector('#mj-mirar').addEventListener('click', () => {
        const p = enLaMira();
        if (p) identificar(p);
        else { A.efecto('intento'); decir('Aquí todo se ve bien. ¡Mueve los binoculares a otro lugar!'); }
      });

      function final() {
        activo = false;
        escuchar(false);
        if (medir) medir.disconnect();
        window.removeEventListener('keydown', teclas, true);
        window.removeEventListener('resize', encuadrar);
        V.callar();
        capa.capa.classList.remove('mj-lleno');
        c.innerHTML = `
          <div class="mj-reflexion">
            <p class="mj-texto">¡Encontraste los ${PROBLEMAS.length} problemas!</p>
            <p>Mira la diferencia: en el campo el río corre limpio, hay frailejones, árboles, la tingua y la rana. Donde llega la ciudad sin cuidado, el agua se ensucia, el aire se llena de humo y los animales se van. <b>Todos hacemos parte del ecosistema</b>, y lo que hacemos en la ciudad llega al campo.</p>
            <div class="mj-resumen">${PROBLEMAS.map(p => `<div><b><span aria-hidden="true">${p.emoji}</span> ${esc(p.nombre)}</b><br>${esc(p.hacer)}</div>`).join('')}</div>
            <div class="mj-controles"><button type="button" class="gu-btn gu-btn-grande gu-btn-principal" id="mj-seguir">Hablar con Rita <span aria-hidden="true">▶</span></button></div>
          </div>`;
        V.decir(`¡Encontraste los ${PROBLEMAS.length} problemas! En el campo el río corre limpio. Donde llega la ciudad sin cuidado, el agua se ensucia y los animales se van. Todos hacemos parte del ecosistema.`);
        const s = c.querySelector('#mj-seguir');
        setTimeout(() => s.focus({ preventScroll: true }), 60);
        s.addEventListener('click', () => { capa.cerrar(); resolver({ encontrados: encontrados.size }); });
      }
    });
  }

  window.GU_MINIJUEGOS = { excavacion, binoculares, HALLAZGOS, PROBLEMAS };
})();
