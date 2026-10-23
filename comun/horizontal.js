/*
 * Guardianes de Usme · jugar con el celular acostado
 *
 * En pantallas táctiles en vertical tapa todo con un aviso «Gira tu celular» y
 * pausa el juego (GU.pausado() lo tiene en cuenta por la clase gu-girar).
 * Donde el navegador lo permite (Android), al primer toque pone pantalla completa
 * y fija la orientación horizontal. En iPhone no se puede fijar: solo se avisa.
 *
 * Se usa con: <script src="comun/horizontal.js"></script> (no necesita nada más).
 */
(function () {
  const vertical = matchMedia('(orientation: portrait) and (pointer: coarse)');
  const raiz = document.documentElement;
  const puedeFijar = !!(raiz.requestFullscreen && screen.orientation && screen.orientation.lock);

  const css = document.createElement('style');
  css.textContent = `
    .gu-girar-aviso { position: fixed; inset: 0; z-index: 2147483000; display: none; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; padding: 24px; text-align: center; background: #2b2118; color: #fbf6ea;
      font: 18px/1.45 'Atkinson Hyperlegible', system-ui, 'Segoe UI', Roboto, sans-serif; }
    html.gu-girar .gu-girar-aviso { display: flex; }
    html.gu-girar, html.gu-girar body { overflow: hidden; }
    .gu-girar-aviso h2 { margin: 0; font: 800 2em/1.05 'Baloo 2', 'Atkinson Hyperlegible', system-ui, sans-serif; }
    .gu-girar-aviso p { margin: 0; max-width: 22em; }
    .gu-girar-aviso small { color: #e3d6bd; font-size: .85em; }
    .gu-girar-cel { width: 74px; height: 120px; border: 6px solid #fbf6ea; border-radius: 16px; position: relative; animation: gu-girar-cel 2.4s ease-in-out infinite; }
    .gu-girar-cel::after { content: ''; position: absolute; left: 50%; bottom: 7px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #fbf6ea; }
    @keyframes gu-girar-cel { 0%, 20% { transform: rotate(0); } 55%, 80% { transform: rotate(-90deg); } 100% { transform: rotate(0); } }
    @media (prefers-reduced-motion: reduce) { .gu-girar-cel { animation: none; transform: rotate(-90deg); } }
    html.gu-sin-movimiento .gu-girar-cel { animation: none; transform: rotate(-90deg); }
    .gu-girar-aviso button { font: inherit; font-weight: 700; min-height: 56px; padding: .55em 1.4em; border-radius: 999px; border: 3px solid #fff;
      background: #c0562f; color: #fff; cursor: pointer; }
    .gu-girar-aviso button:focus-visible { outline: 5px solid #00e5ff; outline-offset: 4px; }
    .gu-girar-aviso [data-toque] { display: none; }
    html.gu-girar-toque .gu-girar-aviso [data-toque] { display: block; }
    html.gu-girar-toque .gu-girar-aviso [data-girar] { display: none; }
    /* al imprimir (el papel es vertical) el aviso no sale */
    @media print { .gu-girar-aviso { display: none !important; } html.gu-girar, html.gu-girar body { overflow: visible; } }
  `;
  document.head.appendChild(css);

  const aviso = document.createElement('div');
  aviso.className = 'gu-girar-aviso';
  aviso.setAttribute('role', 'alertdialog');
  aviso.setAttribute('aria-modal', 'true');
  aviso.setAttribute('aria-labelledby', 'gu-girar-titulo');
  aviso.setAttribute('aria-describedby', 'gu-girar-texto');
  aviso.tabIndex = -1;
  aviso.innerHTML = `
    <div class="gu-girar-cel" aria-hidden="true"></div>
    <h2 id="gu-girar-titulo"><span data-girar>Gira tu celular</span><span data-toque>Toca la pantalla</span></h2>
    <p id="gu-girar-texto"><span data-girar>Guardianes de Usme se juega con el celular acostado.</span><span data-toque>para seguir jugando con el celular acostado.</span></p>
    ${puedeFijar ? '<button type="button"><span aria-hidden="true">↻</span> Girar la pantalla</button>' : ''}
    <p data-girar><small>Si no gira, revisa que la rotación automática del celular esté encendida.</small></p>`;

  // Pantalla completa + horizontal fija. Solo funciona tras un toque; si falla, no pasa nada.
  async function fijarHorizontal() {
    if (!puedeFijar) return;
    try {
      if (!document.fullscreenElement) await raiz.requestFullscreen({ navigationUI: 'hide' });
      await screen.orientation.lock('landscape');
      recordar();
    } catch (e) { /* el navegador no lo permite: queda el aviso */ }
    esperandoToque = false;
    actualizar();
  }

  // Al cambiar de página (plataforma → mapa), al imprimir o al compartir, el navegador suelta la
  // pantalla completa y el bloqueo. Si ya se fijó una vez en esta pestaña, no se vuelve a pedir
  // girar: la pantalla queda tapada con «Toca la pantalla» y ese toque la fija otra vez.
  // Así nunca se ve nada en vertical. Si el intento falla, sale el aviso normal de girar.
  const RECUERDO = 'gu-horizontal-fijado';
  function recordar() { try { sessionStorage.setItem(RECUERDO, '1'); } catch (e) {} }
  function yaFijado() { try { return sessionStorage.getItem(RECUERDO) === '1'; } catch (e) { return false; } }
  let esperandoToque = false;
  function esperarToque() {
    if (!puedeFijar || !yaFijado() || esperandoToque) return;
    esperandoToque = true;
    window.addEventListener('pointerup', fijarHorizontal, { once: true, capture: true });
  }
  let imprimiendo = false;

  // Mientras el aviso está, el resto de la página no recibe foco ni lector de pantalla.
  let apagados = [];
  function actualizar() {
    raiz.classList.toggle('gu-girar-toque', esperandoToque);
    const girar = vertical.matches && !imprimiendo;
    if (girar === raiz.classList.contains('gu-girar')) return;
    raiz.classList.toggle('gu-girar', girar);
    if (girar) {
      apagados = [...document.body.children].filter(n => n !== aviso && !n.inert);
      apagados.forEach(n => { n.inert = true; });
      setTimeout(() => (aviso.querySelector('button') || aviso).focus?.({ preventScroll: true }), 50);
      window.GU_VOZ?.callar?.();
    } else {
      apagados.forEach(n => { n.inert = false; });
      apagados = [];
    }
  }

  function montar() {
    document.body.appendChild(aviso);
    aviso.querySelector('button')?.addEventListener('click', fijarHorizontal);
    vertical.addEventListener('change', actualizar);
    // el primer toque en la página ya pide pantalla completa y horizontal (en Android)
    if (puedeFijar && matchMedia('(pointer: coarse)').matches) {
      if (yaFijado()) esperarToque();
      else window.addEventListener('pointerup', fijarHorizontal, { once: true, capture: true });
    }
    actualizar();
    // si se sale de la pantalla completa (imprimir, compartir, botón atrás), el siguiente toque la recupera
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { esperarToque(); actualizar(); } });
    window.addEventListener('beforeprint', () => { imprimiendo = true; actualizar(); });
    window.addEventListener('afterprint', () => { imprimiendo = false; if (!document.fullscreenElement) esperarToque(); actualizar(); });
  }
  if (document.body) montar();
  else document.addEventListener('DOMContentLoaded', montar);
})();
