/*
 * Guardianes de Usme · capa común del juego
 *
 * Los tres prototipos (3D, cuento de lado y mapa) solo dibujan el mundo y mueven
 * al personaje. Todo lo demás vive aquí, en HTML normal encima del dibujo, para
 * que funcione con lector de pantalla, teclado, pantalla táctil y pulsador:
 *   - pantalla de inicio (nombre, edad, personaje, forma de jugar)
 *   - opciones de accesibilidad
 *   - conversaciones narradas, preguntas y puntaje
 *   - controles en pantalla y teclado
 *   - pantalla final
 *
 * Cómo lo usa un mundo (ver docs/contrato-mundos.md):
 *   GU.montar({ nombre: 'Recorrido 3D' });
 *   GU.on('empezar', cfg => ...);        // arranca el mundo con la configuración
 *   cada cuadro: if (!GU.pausado()) { const v = GU.entrada(); ... }
 *   GU.zona(i); GU.cerca(i | -1); GU.paso(); GU.recoger(i);
 *   GU.on('avanzar', i => caminar hasta la estación i y luego GU.llegar(i));
 */
(function () {
  const C = window.GU_CONTENIDO;
  const A = window.GU_AUDIO;
  const V = window.GU_VOZ;

  const CLAVE = 'gu-config-v1';
  const PREDETERMINADA = {
    nombre: '',
    nivel: 'peques',          // peques (6–8) | grandes (9–12)
    avatar: 'nina',
    ruana: 'roja',
    control: 'libre',         // libre | guiado | barrido
    voz: true,
    velocidadVoz: 1,
    audiodescripcion: false,
    tamano: 1,                // 1 | 1.25 | 1.5
    contraste: false,
    letraFacil: false,
    reducirMovimiento: false,
    volAmbiente: 0.6,
    volEfectos: 0.8,
    velocidadBarrido: 2000,
    senas: false,
  };

  let cfg = cargar();
  const oyentes = {};
  const estado = {
    empezado: false,
    ocupado: false,           // conversación o panel abierto
    completadas: new Map(),   // índice → puntos de la pregunta
    semillas: new Set(),
    zona: -1,
    cerca: -1,
    yaAbierta: -1,            // para no reabrir la misma conversación sin alejarse
    teclas: new Set(),
    joystick: { x: 0, y: 0 },
  };
  let mundo = { nombre: '' };

  /* ---------- utilidades ---------- */

  function cargar() {
    try { return { ...PREDETERMINADA, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; }
    catch (e) { return { ...PREDETERMINADA }; }
  }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(cfg)); } catch (e) {} }
  function emitir(ev, dato) { (oyentes[ev] || []).forEach(f => { try { f(dato); } catch (e) { console.error(e); } }); }
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const personajeDe = i => C.PERSONAJES[C.ESTACIONES[i].personaje];
  const textoDe = i => C.ESTACIONES[i][cfg.nivel];
  const puntosMax = () => C.ESTACIONES.length * (C.PUNTOS.primerIntento + C.PUNTOS.semilla);
  function puntos() {
    let p = 0;
    estado.completadas.forEach(v => p += v);
    return p + estado.semillas.size * C.PUNTOS.semilla;
  }

  function anunciar(texto) {
    const r = $('#gu-vivo');
    if (!r) return;
    r.textContent = '';
    setTimeout(() => { r.textContent = texto; }, 60);
  }

  /* ---------- estructura ---------- */

  function construir() {
    const capa = el(`
      <div id="gu" class="gu">
        <div id="gu-vivo" class="gu-oculto" aria-live="polite" aria-atomic="true"></div>

        <header id="gu-hud" class="gu-hud" hidden>
          <div class="gu-hud-izq">
            <span class="gu-titulo-mini">Guardianes de Usme</span>
            <ol class="gu-progreso" aria-label="Puntos del recorrido"></ol>
          </div>
          <div class="gu-hud-der">
            <span class="gu-puntos" aria-live="off"><span aria-hidden="true">⭐</span> <b>0</b><span class="gu-oculto"> puntos</span></span>
            <button type="button" class="gu-btn gu-btn-icono" data-accion="sonido" aria-pressed="true" title="Sonido"><span aria-hidden="true">🔊</span><span class="gu-oculto">Sonido</span></button>
            <button type="button" class="gu-btn gu-btn-icono" data-accion="ayuda" title="Ayuda"><span aria-hidden="true">❓</span><span class="gu-oculto">Ayuda</span></button>
            <button type="button" class="gu-btn gu-btn-icono" data-accion="opciones" title="Opciones"><span aria-hidden="true">⚙️</span><span class="gu-oculto">Opciones</span></button>
          </div>
        </header>

        <div id="gu-acciones" class="gu-acciones" hidden>
          <div class="gu-joystick" aria-hidden="true"><div class="gu-joystick-bola"></div></div>
          <button type="button" class="gu-btn gu-btn-grande gu-btn-avanzar" data-accion="avanzar">
            <span aria-hidden="true">▶</span> <span class="gu-avanzar-texto">Caminar al siguiente punto</span>
          </button>
          <button type="button" class="gu-btn gu-btn-grande gu-btn-hablar" data-accion="hablar" hidden></button>
          <button type="button" class="gu-btn gu-btn-llevame" data-accion="avanzar" title="Llévame al siguiente punto">
            <span aria-hidden="true">🧭</span> <span>Llévame</span>
          </button>
        </div>

        <section id="gu-dialogo" class="gu-panel gu-dialogo" role="dialog" aria-modal="false" aria-labelledby="gu-dialogo-nombre" hidden></section>
        <section id="gu-inicio" class="gu-pantalla" aria-labelledby="gu-inicio-titulo" hidden></section>
        <section id="gu-opciones" class="gu-pantalla gu-pantalla-panel" role="dialog" aria-modal="true" aria-labelledby="gu-opciones-titulo" hidden></section>
        <section id="gu-ayuda" class="gu-pantalla gu-pantalla-panel" role="dialog" aria-modal="true" aria-labelledby="gu-ayuda-titulo" hidden></section>
        <section id="gu-final" class="gu-pantalla" aria-labelledby="gu-final-titulo" hidden></section>
      </div>`);
    document.body.appendChild(capa);

    const prog = $('.gu-progreso', capa);
    C.ESTACIONES.forEach((e, i) => {
      prog.appendChild(el(`<li style="--c:${e.color}" data-i="${i}"><span aria-hidden="true">${personajeDeEst(e).emoji}</span><span class="gu-oculto">${esc(e.nombre)}: pendiente</span></li>`));
    });

    capa.addEventListener('click', e => {
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      A.efecto('clic');
      const acc = b.dataset.accion;
      if (acc === 'opciones') abrirOpciones();
      else if (acc === 'ayuda') abrirAyuda();
      else if (acc === 'sonido') { cfg.volAmbiente = cfg.volAmbiente > 0 ? 0 : 0.6; aplicarConfig(); guardar(); }
      else if (acc === 'avanzar') pedirAvance();
      else if (acc === 'hablar') { if (estado.cerca >= 0) llegar(estado.cerca); }
    });

    instalarTeclado();
    instalarJoystick();
    instalarBarrido();
  }
  const personajeDeEst = e => C.PERSONAJES[e.personaje];

  /* ---------- configuración ---------- */

  function aplicarConfig() {
    const r = document.documentElement;
    r.style.setProperty('--gu-escala', cfg.tamano);
    r.classList.toggle('gu-contraste', cfg.contraste);
    r.classList.toggle('gu-letra-facil', cfg.letraFacil);
    r.classList.toggle('gu-sin-movimiento', cfg.reducirMovimiento);
    r.dataset.guControl = cfg.control;
    A.volumen(cfg.volAmbiente, cfg.volEfectos);
    V.configurar({ activa: cfg.voz, velocidad: cfg.velocidadVoz });
    const bs = $('[data-accion="sonido"]');
    if (bs) {
      bs.setAttribute('aria-pressed', String(cfg.volAmbiente > 0));
      bs.firstElementChild.textContent = cfg.volAmbiente > 0 ? '🔊' : '🔈';
    }
    emitir('config', cfg);
  }

  /* ---------- pantalla de inicio ---------- */

  function opcionesRadio(nombre, lista, actual) {
    return lista.map(o => `
      <label class="gu-tarjeta-opcion">
        <input type="radio" name="${nombre}" value="${o.id}" ${o.id === actual ? 'checked' : ''}>
        <span class="gu-tarjeta-cuerpo" ${o.color ? `style="--c:${o.color}"` : ''}>
          ${o.emoji ? `<span class="gu-tarjeta-emoji" aria-hidden="true">${o.emoji}</span>` : ''}
          ${o.color ? `<span class="gu-muestra" aria-hidden="true"></span>` : ''}
          <span class="gu-tarjeta-texto">${esc(o.nombre)}</span>
          ${o.detalle ? `<small>${esc(o.detalle)}</small>` : ''}
        </span>
      </label>`).join('');
  }

  // Si el mundo trae al jugador de la plataforma (nombre y avatar ya hechos en «Crea tu avatar»),
  // solo se saluda: el toque en «¡Empezar!» hace falta para que el navegador deje sonar la voz.
  function mostrarSaludo() {
    const p = $('#gu-inicio');
    p.innerHTML = `
      <div class="gu-inicio-caja">
        <p class="gu-sobretitulo">${esc(mundo.nombre)}</p>
        <h1 id="gu-inicio-titulo">¡Hola, ${esc(cfg.nombre)}!</h1>
        <p class="gu-intro">Camina por el Parque Arqueológico, conoce a sus guardianes y descubre la memoria del territorio.</p>
        <div class="gu-botones-inicio">
          <div style="display:flex; flex-wrap:wrap; gap:10px">
            ${mundo.editarAvatar ? `<a class="gu-btn gu-btn-secundario" style="text-decoration:none" href="${esc(mundo.editarAvatar)}"><span aria-hidden="true">🎨</span> Cambiar mi avatar</a>` : ''}
            <button type="button" class="gu-btn gu-btn-secundario" data-local="opciones"><span aria-hidden="true">⚙️</span> Opciones: edad, voz, controles…</button>
          </div>
          <button type="button" class="gu-btn gu-btn-grande gu-btn-principal" data-local="empezar"><span aria-hidden="true">🌄</span> ¡Empezar!</button>
        </div>
        <p class="gu-nota-validar">Prototipo. Los textos están por validar con sabedores, la comunidad y el equipo del parque.</p>
      </div>`;
    p.hidden = false;
    $('[data-local="opciones"]', p).addEventListener('click', abrirOpciones);
    $('[data-local="empezar"]', p).addEventListener('click', () => { guardar(); empezar(); });
    setTimeout(() => $('[data-local="empezar"]', p)?.focus({ preventScroll: true }), 50);
  }

  function mostrarInicio() {
    if (mundo.jugador) { mostrarSaludo(); return; }
    const p = $('#gu-inicio');
    p.innerHTML = `
      <div class="gu-inicio-caja">
        <p class="gu-sobretitulo">${esc(mundo.nombre)}</p>
        <h1 id="gu-inicio-titulo">Guardianes de Usme</h1>
        <p class="gu-intro">Camina por el Parque Arqueológico, conoce a sus guardianes y descubre la memoria del territorio.</p>
        <form class="gu-form" novalidate>
          <div class="gu-campo">
            <label for="gu-nombre">¿Cómo te llamas? <small>(si quieres)</small></label>
            <input id="gu-nombre" name="nombre" type="text" maxlength="24" autocomplete="off" value="${esc(cfg.nombre)}">
          </div>
          <fieldset class="gu-campo"><legend>¿Cuántos años tienes?</legend>
            <div class="gu-fila-opciones">${opcionesRadio('nivel', [
              { id: 'peques', nombre: '6 a 8 años', emoji: '🌱', detalle: 'Todo con voz y dibujos' },
              { id: 'grandes', nombre: '9 a 12 años', emoji: '🌳', detalle: 'Más historias y retos' },
            ], cfg.nivel)}</div>
          </fieldset>
          <fieldset class="gu-campo"><legend>Elige tu personaje</legend>
            <div class="gu-fila-opciones">${opcionesRadio('avatar', C.AVATARES, cfg.avatar)}</div>
          </fieldset>
          <fieldset class="gu-campo"><legend>Color de tu ruana</legend>
            <div class="gu-fila-opciones gu-fila-colores">${opcionesRadio('ruana', C.RUANAS, cfg.ruana)}</div>
          </fieldset>
          <fieldset class="gu-campo"><legend>¿Cómo quieres moverte?</legend>
            <div class="gu-fila-opciones">${opcionesRadio('control', [
              { id: 'libre', nombre: 'Yo camino', emoji: '🕹️', detalle: 'Flechas, teclas o el control en pantalla' },
              { id: 'guiado', nombre: 'Con un botón', emoji: '👆', detalle: 'Un toque y caminas solo al siguiente punto' },
              { id: 'barrido', nombre: 'Con pulsador', emoji: '🔘', detalle: 'Los botones se iluminan solos; cualquier tecla o toque elige' },
            ], cfg.control)}</div>
          </fieldset>
          <div class="gu-botones-inicio">
            <button type="button" class="gu-btn gu-btn-secundario" data-local="opciones"><span aria-hidden="true">⚙️</span> Más opciones: voz, letra, colores…</button>
            <button type="submit" class="gu-btn gu-btn-grande gu-btn-principal"><span aria-hidden="true">🌄</span> ¡Empezar!</button>
          </div>
        </form>
        <p class="gu-nota-validar">Prototipo. Los textos están por validar con sabedores, la comunidad y el equipo del parque.</p>
      </div>`;
    p.hidden = false;
    const form = $('form', p);
    form.addEventListener('change', () => {
      leerFormulario(form);
      aplicarConfig();
    });
    $('[data-local="opciones"]', p).addEventListener('click', () => { leerFormulario(form); abrirOpciones(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      leerFormulario(form);
      guardar();
      empezar();
    });
    setTimeout(() => $('#gu-nombre')?.focus({ preventScroll: true }), 50);
  }

  function leerFormulario(form) {
    const d = new FormData(form);
    cfg.nombre = (d.get('nombre') || '').toString().trim();
    ['nivel', 'avatar', 'ruana', 'control'].forEach(k => { if (d.get(k)) cfg[k] = d.get(k); });
  }

  function empezar() {
    A.desbloquear();
    aplicarConfig();
    $('#gu-inicio').hidden = true;
    $('#gu-hud').hidden = false;
    $('#gu-acciones').hidden = false;
    estado.empezado = true;
    actualizarHud();
    emitir('empezar', cfg);
    const saludo = cfg.nombre ? `¡Hola, ${cfg.nombre}!` : '¡Hola!';
    const como = cfg.control === 'libre'
      ? 'Camina con las flechas o con el control de la pantalla. Cuando llegues a un personaje, te va a hablar.'
      : 'Toca el botón grande para caminar al siguiente punto.';
    anunciar(`${saludo} Empieza el recorrido. ${como}`);
    V.decir(`${saludo} Vamos a recorrer el parque. ${como}`);
  }

  /* ---------- opciones ---------- */

  function interruptor(id, texto, valor, detalle = '') {
    return `<label class="gu-interruptor"><input type="checkbox" data-op="${id}" ${valor ? 'checked' : ''}>
      <span class="gu-int-pista" aria-hidden="true"></span><span><b>${texto}</b>${detalle ? `<small>${detalle}</small>` : ''}</span></label>`;
  }
  function selector(id, texto, valor, lista) {
    return `<div class="gu-campo"><label for="gu-op-${id}">${texto}</label>
      <select id="gu-op-${id}" data-op="${id}">${lista.map(([v, t]) => `<option value="${v}" ${String(v) === String(valor) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  }

  function abrirOpciones() {
    const p = $('#gu-opciones');
    p.innerHTML = `
      <div class="gu-panel-caja">
        <h2 id="gu-opciones-titulo"><span aria-hidden="true">⚙️</span> Opciones</h2>
        <div class="gu-op-grupos">
          <div class="gu-op-grupo"><h3>Escuchar</h3>
            ${interruptor('voz', 'Narración en voz', cfg.voz, V.disponible ? 'Los personajes leen en voz alta lo que dicen.' : 'Este navegador no tiene voz.')}
            ${selector('velocidadVoz', 'Velocidad de la voz', cfg.velocidadVoz, [[0.75, 'Despacio'], [1, 'Normal'], [1.25, 'Rápido']])}
            ${interruptor('audiodescripcion', 'Describir lo que veo', cfg.audiodescripcion, 'Al llegar a cada punto, una voz cuenta cómo es el lugar.')}
            ${selector('volAmbiente', 'Sonidos de la naturaleza', cfg.volAmbiente, [[0, 'Apagados'], [0.3, 'Bajitos'], [0.6, 'Normales'], [1, 'Fuertes']])}
            ${selector('volEfectos', 'Efectos (aciertos, pasos)', cfg.volEfectos, [[0, 'Apagados'], [0.4, 'Bajitos'], [0.8, 'Normales']])}
          </div>
          <div class="gu-op-grupo"><h3>Ver y leer</h3>
            ${selector('tamano', 'Tamaño de la letra', cfg.tamano, [[1, 'Normal'], [1.25, 'Grande'], [1.5, 'Muy grande']])}
            ${interruptor('contraste', 'Alto contraste', cfg.contraste, 'Colores fuertes y bordes gruesos.')}
            ${interruptor('letraFacil', 'Letra fácil de leer', cfg.letraFacil, 'Más espacio entre letras y líneas.')}
            ${interruptor('reducirMovimiento', 'Menos movimiento', cfg.reducirMovimiento, 'Sin animaciones ni cámara que se mueve.')}
            ${interruptor('senas', 'Lengua de Señas Colombiana', cfg.senas, 'Muestra el espacio para el video con intérprete.')}
          </div>
          <div class="gu-op-grupo"><h3>Jugar</h3>
            ${selector('nivel', 'Edad', cfg.nivel, [['peques', '6 a 8 años'], ['grandes', '9 a 12 años']])}
            ${selector('control', 'Cómo moverte', cfg.control, [['libre', 'Yo camino'], ['guiado', 'Con un botón'], ['barrido', 'Con pulsador']])}
            ${selector('velocidadBarrido', 'Velocidad del pulsador', cfg.velocidadBarrido, [[3000, 'Lenta'], [2000, 'Normal'], [1200, 'Rápida']])}
          </div>
        </div>
        <div class="gu-panel-pie"><button type="button" class="gu-btn gu-btn-grande gu-btn-principal" data-local="cerrar">Listo</button></div>
      </div>`;
    abrirPanel(p);
    p.addEventListener('change', e => {
      const k = e.target.dataset.op;
      if (!k) return;
      const v = e.target.type === 'checkbox' ? e.target.checked
        : (typeof PREDETERMINADA[k] === 'number' ? Number(e.target.value) : e.target.value);
      cfg[k] = v;
      guardar();
      aplicarConfig();
      if (k === 'control') actualizarAcciones();
      if (k === 'voz' && v) V.decir('Narración encendida.');
    });
    $('[data-local="cerrar"]', p).addEventListener('click', () => cerrarPanel(p));
  }

  function abrirAyuda() {
    const p = $('#gu-ayuda');
    const libre = cfg.control === 'libre';
    p.innerHTML = `
      <div class="gu-panel-caja">
        <h2 id="gu-ayuda-titulo"><span aria-hidden="true">❓</span> ¿Cómo se juega?</h2>
        <ul class="gu-ayuda-lista">
          ${libre ? `
            <li><span aria-hidden="true">⬆️⬇️⬅️➡️</span> Camina con las flechas, con W A S D o con el control redondo de la pantalla.</li>
            <li><span aria-hidden="true">🗣️</span> Cuando llegues a un personaje te va a hablar. Para volver a escucharlo, oprime Enter.</li>
            <li><span aria-hidden="true">🧭</span> Si te pierdes, toca «Llévame» y caminas solo al siguiente punto.</li>` : `
            <li><span aria-hidden="true">👆</span> Toca el botón grande «Caminar al siguiente punto», o oprime la barra espaciadora.</li>`}
          ${cfg.control === 'barrido' ? `<li><span aria-hidden="true">🔘</span> Los botones se iluminan uno por uno. Cuando se ilumine el que quieres, oprime cualquier tecla o toca la pantalla.</li>` : ''}
          <li><span aria-hidden="true">🔊</span> En cada conversación puedes tocar «Repetir» para escuchar otra vez.</li>
          <li><span aria-hidden="true">⭐</span> Ganas 3 estrellas si aciertas a la primera, 2 a la segunda y 1 después. ¡Nunca pierdes!</li>
          <li><span aria-hidden="true">🌰</span> Busca las semillas escondidas en el camino: cada una vale 1 estrella.</li>
        </ul>
        <div class="gu-panel-pie"><button type="button" class="gu-btn gu-btn-grande gu-btn-principal" data-local="cerrar">Entendido</button></div>
      </div>`;
    abrirPanel(p);
    $('[data-local="cerrar"]', p).addEventListener('click', () => cerrarPanel(p));
    V.decir($('.gu-ayuda-lista', p).innerText);
  }

  let focoAntes = null;
  function abrirPanel(p) {
    focoAntes = document.activeElement;
    p.hidden = false;
    estado.panel = p;
    setTimeout(() => (p.querySelector('h2') || p).focus?.(), 30);
    p.querySelector('h2')?.setAttribute('tabindex', '-1');
  }
  function cerrarPanel(p) {
    p.hidden = true;
    estado.panel = null;
    V.callar();
    focoAntes?.focus?.();
  }

  /* ---------- acciones en pantalla ---------- */

  function actualizarAcciones() {
    const libre = cfg.control === 'libre';
    const acc = $('#gu-acciones');
    $('.gu-joystick', acc).hidden = !libre;
    $('.gu-btn-avanzar', acc).hidden = libre;
    $('.gu-btn-llevame', acc).hidden = !libre;
    const sig = siguiente();
    $('.gu-avanzar-texto', acc).textContent = sig >= 0
      ? `Caminar hacia ${personajeDe(sig).nombre}` : 'Ver mi puntaje';
    const hablar = $('.gu-btn-hablar', acc);
    hablar.hidden = !(libre && estado.cerca >= 0 && !estado.ocupado);
    if (estado.cerca >= 0) {
      const pj = personajeDe(estado.cerca);
      hablar.innerHTML = `<span aria-hidden="true">${pj.emoji}</span> ${estado.completadas.has(estado.cerca) ? 'Escuchar otra vez a' : 'Hablar con'} ${esc(pj.nombre)}`;
    }
  }

  function pedirAvance() {
    if (estado.ocupado || estado.panel) return;
    const sig = siguiente();
    if (sig < 0) { mostrarFinal(); return; }
    estado.caminandoSolo = true;   // hasta que el mundo llame GU.llegar
    emitir('avanzar', sig);
  }

  function siguiente() {
    for (let i = 0; i < C.ESTACIONES.length; i++) if (!estado.completadas.has(i)) return i;
    return -1;
  }

  /* ---------- teclado y joystick ---------- */

  const TECLAS = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  };

  function instalarTeclado() {
    window.addEventListener('keydown', e => {
      if (!estado.empezado) return;
      const enCampo = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');
      if (TECLAS[e.code] && !estado.ocupado && !estado.panel && !enCampo && cfg.control === 'libre') {
        estado.teclas.add(e.code); e.preventDefault(); return;
      }
      if (e.key === 'Escape' && estado.panel) { cerrarPanel(estado.panel); return; }
      if (estado.ocupado || estado.panel || enCampo) return;
      const enBoton = document.activeElement?.tagName === 'BUTTON';
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !enBoton) {
        e.preventDefault();
        if (cfg.control === 'libre' && estado.cerca >= 0) llegar(estado.cerca);
        else if (cfg.control !== 'libre') pedirAvance();
      }
    });
    window.addEventListener('keyup', e => estado.teclas.delete(e.code));
    window.addEventListener('blur', () => estado.teclas.clear());
  }

  function instalarJoystick() {
    const base = $('.gu-joystick'), bola = $('.gu-joystick-bola');
    let id = null;
    const mover = e => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
      let dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      estado.joystick = { x: dx, y: dy };
      bola.style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
    };
    base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(id); mover(e); });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) mover(e); });
    const soltar = e => { if (e.pointerId !== id) return; id = null; estado.joystick = { x: 0, y: 0 }; bola.style.transform = ''; };
    base.addEventListener('pointerup', soltar);
    base.addEventListener('pointercancel', soltar);
  }

  function entrada() {
    let x = estado.joystick.x, y = estado.joystick.y;
    estado.teclas.forEach(k => { x += TECLAS[k][0]; y += TECLAS[k][1]; });
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    if (m < 0.15) return { x: 0, y: 0 };
    return { x, y };
  }

  /* ---------- barrido para pulsador ---------- */

  // En la pantalla de inicio el barrido solo corre si ya quedó guardado de una
  // partida anterior (un docente lo deja configurado); si no, el mouse elegiría mal.
  const barridoDesdeInicio = cfg.control === 'barrido';
  const barridoActivo = () => cfg.control === 'barrido' && (estado.empezado || barridoDesdeInicio);
  let barrido = { t: null, i: -1 };
  function capaActiva() {
    for (const id of ['#gu-final', '#gu-opciones', '#gu-ayuda', '#gu-dialogo', '#gu-inicio']) {
      const p = $(id);
      if (p && !p.hidden) return p;
    }
    return document.getElementById('gu');
  }
  function botonesBarrido() {
    const capa = capaActiva();
    // botones propios de un mundo (fuera de #gu) entran si llevan la clase gu-extra
    const extra = capa.id === 'gu' ? [...document.querySelectorAll('button.gu-extra:not([disabled]), .gu-extra button:not([disabled])')] : [];
    return [...capa.querySelectorAll('button:not([disabled]), input[type=radio], input[type=checkbox], select'), ...extra]
      .filter(b => b.offsetParent !== null && !b.closest('[hidden]'));
  }
  function instalarBarrido() {
    const paso = () => {
      clearTimeout(barrido.t);
      document.querySelectorAll('.gu-barrido-foco').forEach(b => b.classList.remove('gu-barrido-foco'));
      if (!barridoActivo()) { barrido.t = setTimeout(paso, 500); return; }
      const lista = botonesBarrido();
      if (lista.length) {
        barrido.i = (barrido.i + 1) % lista.length;
        const b = lista[barrido.i];
        b.classList.add('gu-barrido-foco');
        b.focus({ preventScroll: true });
      }
      barrido.t = setTimeout(paso, cfg.velocidadBarrido);
    };
    paso();
    const elegir = e => {
      if (!barridoActivo()) return;
      const b = document.querySelector('.gu-barrido-foco');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.tagName === 'SELECT') { b.selectedIndex = (b.selectedIndex + 1) % b.options.length; b.dispatchEvent(new Event('change', { bubbles: true })); }
      else b.click();
      barrido.i = -1;
      clearTimeout(barrido.t);
      barrido.t = setTimeout(paso, 600);
    };
    window.addEventListener('keydown', e => { if (e.key !== 'Tab' && e.key !== 'Escape') elegir(e); }, true);
    window.addEventListener('pointerdown', elegir, true);
    // el toque ya eligió en pointerdown: se bloquea el clic real que viene después
    window.addEventListener('click', e => { if (barridoActivo() && e.isTrusted) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  /* ---------- conversación y pregunta ---------- */

  function llegar(i) {
    if (estado.ocupado || i < 0 || i >= C.ESTACIONES.length) return Promise.resolve();
    estado.caminandoSolo = false;
    estado.ocupado = true;
    estado.yaAbierta = i;
    estado.teclas.clear();
    estado.joystick = { x: 0, y: 0 };
    actualizarAcciones();
    emitir('conversacion', { indice: i, abierta: true });
    const est = C.ESTACIONES[i], pj = personajeDe(i), txt = textoDe(i);
    const repetida = estado.completadas.has(i);
    A.efecto('llegada');
    setTimeout(() => A.efecto(pj.sonido), 400);
    anunciar(`Llegaste a: ${est.nombre}. ${est.escena}`);

    return new Promise(resolver => {
      const d = $('#gu-dialogo');
      let linea = 0;
      const lineas = txt.historia;

      const cabecera = `
        <div class="gu-dialogo-cab">
          <div class="gu-retrato" style="--c:${pj.color}" aria-hidden="true">${pj.emoji}</div>
          <div><h2 id="gu-dialogo-nombre">${esc(pj.nombre)}</h2><p class="gu-quien">${esc(pj.quien)} · ${esc(est.nombre)}</p></div>
        </div>
        ${cfg.senas ? `<div class="gu-senas" role="img" aria-label="Espacio para video en Lengua de Señas Colombiana"><span aria-hidden="true">🤟</span><small>Video en Lengua de Señas Colombiana<br>(por grabar con intérprete)</small></div>` : ''}`;

      // Avance solo: cuando la voz termina una línea, se esperan 2 s y se pasa a la siguiente
      // (o a la pregunta). Un toque en el diálogo durante la espera la cancela. Sin voz no avanza
      // solo: quien lee a su ritmo decide cuándo seguir.
      const ESPERA_AVANCE = 2000;
      let avance = null;
      const cancelarAvance = () => { clearTimeout(avance); avance = null; };
      const narrar = texto => {
        cancelarAvance();
        const t0 = performance.now();
        V.decir(texto, () => {
          // si la voz «terminó» al instante, no sonó (sin voces, bloqueada): no avanza solo
          if (!cfg.voz || !V.disponible || performance.now() - t0 < 400) return;
          const intentar = () => {
            if (d.hidden || $('.gu-pregunta', d)) return;
            // con un panel abierto o el celular en vertical se espera
            if (estado.panel || document.documentElement.classList.contains('gu-girar')) { avance = setTimeout(intentar, 1000); return; }
            if (linea < lineas.length - 1) { linea++; verLinea(); }
            else if (!repetida) verPregunta();
          };
          avance = setTimeout(intentar, ESPERA_AVANCE);
        });
      };

      const verLinea = () => {
        d.innerHTML = `${cabecera}
          <p class="gu-texto" aria-live="polite">${esc(lineas[linea])}</p>
          <div class="gu-dialogo-pie">
            <span class="gu-cuenta" aria-hidden="true">${linea + 1} / ${lineas.length}</span>
            <button type="button" class="gu-btn" data-d="repetir"><span aria-hidden="true">🔊</span> Repetir</button>
            ${linea > 0 ? `<button type="button" class="gu-btn" data-d="atras"><span aria-hidden="true">◀</span> Atrás</button>` : ''}
            <button type="button" class="gu-btn gu-btn-principal" data-d="sig">${linea < lineas.length - 1 ? 'Siguiente' : (repetida ? 'Terminar' : '¡A la pregunta!')} <span aria-hidden="true">▶</span></button>
          </div>`;
        d.hidden = false;
        if (cfg.control !== 'barrido') $('[data-d="sig"]', d).focus({ preventScroll: true });
        const pre = linea === 0 && cfg.audiodescripcion ? est.escena + ' ' : '';
        narrar(pre + lineas[linea]);
      };

      const verPregunta = () => {
        cancelarAvance();
        const q = txt.pregunta;
        let intentos = 0;
        const orden = q.opciones.map((o, k) => ({ ...o, k })).sort(() => Math.random() - 0.5);
        d.innerHTML = `${cabecera}
          <p class="gu-texto gu-pregunta" id="gu-pregunta-texto">${esc(q.texto)}</p>
          <div class="gu-opciones-resp" role="group" aria-labelledby="gu-pregunta-texto">
            ${orden.map((o, n) => `
              <button type="button" class="gu-btn gu-resp" data-k="${o.k}">
                <span class="gu-resp-num" aria-hidden="true">${n + 1}</span>
                <span class="gu-resp-emoji" aria-hidden="true">${o.emoji}</span>
                <span class="gu-resp-texto">${esc(o.texto)}</span>
                <span class="gu-resp-marca" aria-hidden="true"></span>
              </button>`).join('')}
          </div>
          <p class="gu-retro" aria-live="assertive"></p>
          <div class="gu-dialogo-pie">
            <button type="button" class="gu-btn" data-d="repetir"><span aria-hidden="true">🔊</span> Repetir pregunta</button>
          </div>`;
        const leer = () => V.decir(`${q.texto} ${orden.map((o, n) => `Opción ${n + 1}: ${o.texto}.`).join(' ')}`);
        leer();
        $('[data-d="repetir"]', d).onclick = leer;
        if (cfg.control !== 'barrido') $('.gu-resp', d).focus({ preventScroll: true });
        const porNumero = e => {
          const n = parseInt(e.key, 10);
          if (n >= 1 && n <= orden.length && cfg.control !== 'barrido') { const b = d.querySelectorAll('.gu-resp')[n - 1]; if (!b.disabled) b.click(); }
        };
        window.addEventListener('keydown', porNumero);
        d.querySelectorAll('.gu-resp').forEach(b => b.addEventListener('click', () => {
          const op = q.opciones[+b.dataset.k];
          intentos++;
          if (op.correcta) {
            window.removeEventListener('keydown', porNumero);
            const gana = intentos === 1 ? C.PUNTOS.primerIntento : intentos === 2 ? C.PUNTOS.segundoIntento : C.PUNTOS.despues;
            estado.completadas.set(i, gana);
            b.classList.add('gu-resp-bien');
            $('.gu-resp-marca', b).textContent = '✔';
            d.querySelectorAll('.gu-resp').forEach(x => x.disabled = true);
            A.efecto('acierto');
            actualizarHud();
            const retro = $('.gu-retro', d);
            retro.innerHTML = `<span class="gu-ganaste">+${gana} <span aria-hidden="true">⭐</span><span class="gu-oculto"> estrellas</span></span> ${esc(q.acierto)}`;
            const pie = $('.gu-dialogo-pie', d);
            pie.innerHTML = `<button type="button" class="gu-btn gu-btn-grande gu-btn-principal" data-d="cerrar">Seguir el camino <span aria-hidden="true">▶</span></button>`;
            $('[data-d="cerrar"]', pie).onclick = cerrar;
            if (cfg.control !== 'barrido') $('[data-d="cerrar"]', pie).focus({ preventScroll: true });
            V.decir(`${q.acierto} Ganaste ${gana} estrellas.`);
          } else {
            b.disabled = true;
            b.classList.add('gu-resp-mal');
            $('.gu-resp-marca', b).textContent = '✗';
            A.efecto('intento');
            $('.gu-retro', d).textContent = `Casi. ${q.pista} ¡Intenta otra vez!`;
            V.decir(`Casi. ${q.pista} Intenta otra vez.`);
            const libre = d.querySelector('.gu-resp:not([disabled])');
            if (libre && cfg.control !== 'barrido') libre.focus({ preventScroll: true });
          }
        }));
      };

      const cerrar = () => {
        cancelarAvance();
        V.callar();
        d.hidden = true;
        d.innerHTML = '';
        estado.ocupado = false;
        actualizarAcciones();
        emitir('conversacion', { indice: i, abierta: false });
        resolver();
        if (siguiente() < 0 && !repetida) setTimeout(mostrarFinal, 700);
        else if (!repetida) {
          const sig = siguiente();
          anunciar(`Sigue el camino. Ahora busca a ${personajeDe(sig).nombre} en ${C.ESTACIONES[sig].nombre}.`);
        }
      };

      d.onclick = e => {
        cancelarAvance();
        const b = e.target.closest('[data-d]');
        if (!b) return;
        const a = b.dataset.d;
        if (a === 'repetir' && $('.gu-pregunta', d) == null) narrar(lineas[linea]);
        else if (a === 'atras') { linea--; verLinea(); }
        else if (a === 'sig') {
          if (linea < lineas.length - 1) { linea++; verLinea(); }
          else if (repetida) cerrar();
          else verPregunta();
        }
      };

      verLinea();
    });
  }

  function actualizarHud() {
    $('.gu-puntos b').textContent = puntos();
    document.querySelectorAll('.gu-progreso li').forEach(li => {
      const i = +li.dataset.i, hecho = estado.completadas.has(i);
      li.classList.toggle('gu-hecho', hecho);
      li.classList.toggle('gu-actual', i === siguiente());
      li.querySelector('.gu-oculto').textContent = `${C.ESTACIONES[i].nombre}: ${hecho ? 'completado' : 'pendiente'}`;
    });
    actualizarAcciones();
  }

  /* ---------- pantalla final ---------- */

  function mostrarFinal() {
    if (!$('#gu-final').hidden) return;
    estado.ocupado = true;
    A.efecto('final');
    emitir('final', { puntos: puntos(), maximo: puntosMax() });
    const p = $('#gu-final');
    const total = puntos(), max = puntosMax();
    const nombre = cfg.nombre ? `, ${esc(cfg.nombre)}` : '';
    const frase = total >= max * 0.85 ? '¡Eres un guardián, una guardiana del territorio!'
      : total >= max * 0.5 ? '¡Ya eres parte de los guardianes de Usme!'
      : '¡Diste tus primeros pasos como guardián del territorio!';
    p.innerHTML = `
      <div class="gu-inicio-caja gu-final-caja">
        <div class="gu-insignia" aria-hidden="true">🏅</div>
        <h1 id="gu-final-titulo" tabindex="-1">¡Lo lograste${nombre}!</h1>
        <p class="gu-intro">${frase}</p>
        <p class="gu-total"><b>${total}</b> de ${max} estrellas</p>
        <ul class="gu-resumen">
          ${C.ESTACIONES.map((e, i) => {
            const pts = estado.completadas.get(i) || 0;
            const sem = estado.semillas.has(i);
            return `<li>
              <span class="gu-resumen-pj" aria-hidden="true">${personajeDeEst(e).emoji}</span>
              <span class="gu-resumen-nombre">${esc(e.nombre)}</span>
              <span class="gu-estrellas" aria-label="${pts} de 3 estrellas">${'★'.repeat(pts)}<span class="gu-apagada">${'★'.repeat(3 - pts)}</span></span>
              <span class="gu-semilla ${sem ? '' : 'gu-apagada'}" aria-label="${sem ? 'Encontraste' : 'No encontraste'} la ${esc(e.semilla.nombre)}">${e.semilla.emoji}</span>
            </li>`;
          }).join('')}
        </ul>
        <h2>Lo que aprendiste</h2>
        <ul class="gu-aprendido">${C.ESTACIONES.map(e => `<li>${esc(e[cfg.nivel].pregunta.acierto.replace(/^¡[^!]*!\s*/, ''))}</li>`).join('')}</ul>
        ${window.GU_DIPLOMA ? `
        <h2>Tu diploma</h2>
        <img class="gu-diploma-previa" alt="Tu diploma de guardián del territorio, con tu nombre y tus estrellas">
        <div class="gu-botones-diploma">
          <button type="button" class="gu-btn gu-btn-secundario" data-local="imprimir"><span aria-hidden="true">🖨️</span> Imprimir</button>
          <button type="button" class="gu-btn gu-btn-secundario" data-local="pdf"><span aria-hidden="true">📄</span> ${GU_DIPLOMA.puedeCompartir ? 'Compartir en PDF' : 'Descargar en PDF'}</button>
          <button type="button" class="gu-btn gu-btn-secundario" data-local="imagen"><span aria-hidden="true">🖼️</span> ${GU_DIPLOMA.puedeCompartir ? 'Compartir como imagen' : 'Descargar imagen'}</button>
        </div>
        ${GU_DIPLOMA.puedeCompartir ? '<p class="gu-nota-validar">Al compartir puedes elegir WhatsApp, correo u otra aplicación.</p>' : ''}` : ''}
        <div class="gu-botones-inicio" style="justify-content:center">
          <button type="button" class="gu-btn gu-btn-grande gu-btn-principal" data-local="otra"><span aria-hidden="true">🔁</span> Jugar otra vez</button>
        </div>
      </div>`;
    p.hidden = false;
    $('#gu-hud').hidden = true;
    $('#gu-acciones').hidden = true;
    $('#gu-final-titulo').focus();
    $('[data-local="otra"]', p).onclick = () => location.reload();
    if (window.GU_DIPLOMA) {
      let lienzo = null;
      const diploma = () => lienzo || (lienzo = GU_DIPLOMA.dibujar(datosDiploma(total, max)));
      // se dibuja un instante después, para que la pantalla final aparezca sin esperar
      setTimeout(() => { $('.gu-diploma-previa', p).src = diploma().toDataURL('image/jpeg', 0.8); }, 120);
      $('[data-local="imprimir"]', p).onclick = () => GU_DIPLOMA.imprimir(diploma());
      ['pdf', 'imagen'].forEach(f => {
        $(`[data-local="${f}"]`, p).onclick = async () => {
          V.callar();
          const r = await GU_DIPLOMA.compartir(diploma(), f);
          if (r === 'descargado') anunciar(f === 'pdf' ? 'Tu diploma en PDF quedó en tus descargas.' : 'La imagen de tu diploma quedó en tus descargas.');
        };
      });
    }
    V.decir(`¡Lo lograste${cfg.nombre ? ', ' + cfg.nombre : ''}! ${frase} Ganaste ${total} de ${max} estrellas.`);
  }

  // Lo que lleva el diploma. El avatar sale del perfil de la plataforma (si el jugador entró por ahí)
  // o del personaje elegido en la pantalla de inicio.
  function datosDiploma(total, max) {
    const perfil = window.GU_DATOS && window.GU_DATOS.jugadorActual ? window.GU_DATOS.jugadorActual() : null;
    const ap = perfil && perfil.apariencia ? perfil.apariencia : null;
    const tipo = ap ? (ap.silla ? 'silla' : ap.genero || 'nina') : cfg.avatar;
    const color = ap && ap.ruana ? ap.ruana : (C.RUANAS.find(r => r.id === cfg.ruana) || C.RUANAS[0]).color;
    return {
      nombre: cfg.nombre,
      guardiana: ap ? ap.genero === 'nina' : cfg.avatar === 'nina',
      puntos: total, maximo: max,
      semillas: estado.semillas.size, totalSemillas: C.ESTACIONES.length,
      juego: 'Recorriendo los pasos de los ancestros',
      avatar: { tipo, color, ap },
    };
  }

  /* ---------- API para los mundos ---------- */

  window.GU = {
    contenido: C,
    estaciones: C.ESTACIONES,
    personajes: C.PERSONAJES,
    get config() { return cfg; },
    get estado() { return estado; },

    montar(opc) {
      mundo = { ...mundo, ...opc };
      construir();
      aplicarConfig();
      mostrarInicio();
    },
    on(ev, f) { (oyentes[ev] = oyentes[ev] || []).push(f); },

    // gu-girar: el celular está en vertical y comun/horizontal.js pide girarlo
    pausado: () => !estado.empezado || estado.ocupado || !!estado.panel || document.documentElement.classList.contains('gu-girar'),
    entrada,
    personaje: i => personajeDe(i),
    avatar: () => C.AVATARES.find(a => a.id === cfg.avatar) || C.AVATARES[0],
    colorRuana: () => (C.RUANAS.find(r => r.id === cfg.ruana) || C.RUANAS[0]).color,
    siguiente,
    completada: i => estado.completadas.has(i),

    zona(i) {
      if (i === estado.zona) return;
      estado.zona = i;
      if (i >= 0) A.ambiente(C.ESTACIONES[i].ambiente);
    },
    cerca(i) {
      if (i === estado.cerca) return;
      estado.cerca = i;
      if (i !== estado.yaAbierta) estado.yaAbierta = -1;
      if (i < 0) estado.yaAbierta = -1;
      actualizarAcciones();
      // en modo libre, la primera vez que llegas a un personaje te habla solo
      // (no mientras «Llévame» lo lleva a otra estación: pasar al lado no cuenta)
      if (i >= 0 && cfg.control === 'libre' && !estado.caminandoSolo && !estado.completadas.has(i) && estado.yaAbierta !== i) llegar(i);
    },
    llegar,
    paso() { A.efecto(cfg.avatar === 'silla' ? 'rueda' : 'paso'); },
    recoger(i) {
      if (estado.semillas.has(i)) return;
      estado.semillas.add(i);
      A.efecto('semilla');
      const s = C.ESTACIONES[i].semilla;
      anunciar(`¡Encontraste la ${s.nombre}! Una estrella más.`);
      mostrarBrindis(`${s.emoji} ¡Encontraste la ${s.nombre}! +1 ⭐`);
      actualizarHud();
      emitir('recogida', i);
    },
    anunciar,
    final: mostrarFinal,
  };

  function mostrarBrindis(texto) {
    const b = el(`<div class="gu-brindis" aria-hidden="true">${esc(texto)}</div>`);
    document.getElementById('gu').appendChild(b);
    setTimeout(() => b.remove(), 2600);
  }
})();
