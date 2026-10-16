/*
 * Guardianes de Usme · página principal de la plataforma
 *
 * Vistas (se cambian con la dirección: index.html#vista):
 *   #inicio  → catálogo de juegos y entradas «Soy jugador» / «Soy profe o tallerista»
 *   #jugador → entrar con nickname (y código de grupo, si el profe lo dio)
 *   #avatar  → editor de avatar: género, movilidad, piel, cabello, ruana, pantalón y zapatos
 *   #perfil  → puntos, diplomas y profe a cargo del jugador
 *   #profe   → crear cuenta o ingresar con nickname y contraseña
 *   #panel   → panel del profe: jugadores, recursos y evidencias de clase
 *
 * Los datos los maneja plataforma/datos.js; los dibujos salen de 3-mapa-desde-arriba/dibujos.js.
 * Todo el texto va en español de Colombia, tuteando.
 */
(function () {
  const G = window.GU_DATOS;
  const D = window.GU_DIBUJOS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const contenido = $('#contenido');
  // las fechas sin hora (AAAA-MM-DD) se leen como fecha local, no como medianoche UTC
  const fecha = iso => iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00' : iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const hoyLocal = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  const OPCIONES = {
    genero: [['nina', 'Niña', '👧🏽'], ['nino', 'Niño', '👦🏽']],
    silla: [[false, 'Camino', '🚶🏽'], [true, 'Uso silla de ruedas', '🧑🏽‍🦽']],
    piel: [['#f1c9a5', 'Clara'], ['#d9a27a', 'Trigueña clara'], ['#b27a52', 'Trigueña'], ['#8a5536', 'Morena'], ['#5e3a24', 'Oscura']],
    peinado: [['trenzas', 'Trenzas'], ['corto', 'Corto'], ['medio', 'Melena con balaca'], ['largo', 'Largo suelto'], ['crespo', 'Crespo'], ['mono', 'Moño']],
    pelo: [['#2a1c15', 'Negro'], ['#4a2e1f', 'Castaño oscuro'], ['#7a4a2a', 'Castaño claro'], ['#a8542a', 'Rojizo'], ['#d9b25a', 'Rubio'], ['#9a9690', 'Gris']],
    ruana: [['#c0392b', 'Roja'], ['#2e6da4', 'Azul'], ['#3c8d4f', 'Verde'], ['#e0a526', 'Amarilla'], ['#7b3f8f', 'Morada'], ['#d9772b', 'Naranja'], ['#6b4a32', 'Café'], ['#efe3c6', 'Crema']],
    pantalon: [['#3e3a63', 'Azul oscuro'], ['#2b2b2b', 'Negro'], ['#6b4a32', 'Café'], ['#5b6b3a', 'Verde oliva'], ['#7a7f88', 'Gris'], ['#8a3a5a', 'Vinotinto']],
    zapatos: [['#4a2e1f', 'Café'], ['#1f1f1f', 'Negros'], ['#f2efe6', 'Blancos'], ['#c0392b', 'Rojos'], ['#2e6da4', 'Azules']],
  };

  /* ---------- dibujos ---------- */

  // Dibuja el avatar en un <canvas> (vista de frente, de espaldas o de lado).
  function pintarAvatar(canvas, ap, dir = 'd', recorte) {
    const R = 3;
    const { c, ctx } = D.lienzo(72, 92, R);
    D.avatar(ctx, ap.silla ? 'silla' : ap.genero, dir, 0, ap.ruana, ap);
    const fig = D.contorno(c, 1.3 * R, 'rgba(58,38,22,.8)');
    const w = canvas.clientWidth || 72, h = canvas.clientHeight || 92;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const x = canvas.getContext('2d');
    x.clearRect(0, 0, canvas.width, canvas.height);
    if (recorte) x.drawImage(fig, recorte[0] * R, recorte[1] * R, recorte[2] * R, recorte[3] * R, 0, 0, canvas.width, canvas.height);
    else x.drawImage(fig, 0, 0, canvas.width, canvas.height);
  }

  // Escena de la portada / de la tarjeta del juego: camino, río y los guardianes.
  function pintarEscena(canvas, ap, compacta) {
    const W = compacta ? 480 : 520, H = compacta ? 210 : 300, R = 2;
    canvas.width = W * R; canvas.height = H * R;
    const ctx = canvas.getContext('2d');
    ctx.scale(R, R);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#d4c98e'); g.addColorStop(0.35, '#a9c56c'); g.addColorStop(1, '#8dbb5c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // montañas
    ctx.fillStyle = '#9fb3a6';
    ctx.beginPath(); ctx.moveTo(0, H * 0.22); [60, 130, 210, 290, 370, 450, W].forEach((x, i) => ctx.lineTo(x, H * (i % 2 ? 0.08 : 0.2))); ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.fill();
    // río
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-10, H * 0.62); ctx.bezierCurveTo(W * 0.3, H * 0.52, W * 0.6, H * 0.78, W + 10, H * 0.64);
    ctx.lineWidth = 34; ctx.strokeStyle = '#a3906a'; ctx.stroke(); ctx.lineWidth = 24; ctx.strokeStyle = '#3d84b4'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(190,225,245,.8)'; ctx.stroke();
    // camino
    ctx.beginPath(); ctx.moveTo(W * 0.5, H + 10); ctx.bezierCurveTo(W * 0.2, H * 0.75, W * 0.85, H * 0.45, W * 0.45, H * 0.18);
    ctx.lineWidth = 30; ctx.strokeStyle = '#b8925c'; ctx.stroke(); ctx.lineWidth = 22; ctx.strokeStyle = '#e6cf9c'; ctx.stroke();
    // guardianes
    const pjs = [['tita', 92, 84, 77], ['rita', 68, 58, 50], ['julian', 84, 100, 95], ['rosa', 80, 100, 96], ['cuqui', 68, 54, 49], ['tomas', 96, 100, 94]];
    const escala = compacta ? 0.62 : 0.85;
    const base = compacta ? H - 14 : H - 20;
    const paso = W / (pjs.length + 1.4);
    pjs.forEach(([id, w, h, oy], i) => {
      const { c, ctx: cx } = D.lienzo(w, h, 2);
      D[id](cx, 0);
      const fig = D.contorno(c, 2.5, 'rgba(58,38,22,.8)');
      const x = paso * (i + 1) + (i >= 3 ? paso * 0.4 : 0);
      const y = base - (i % 2 ? 6 : 0);
      ctx.fillStyle = 'rgba(30,20,10,.18)'; ctx.beginPath(); ctx.ellipse(x, y, w * escala * 0.35, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(fig, x - (w / 2) * escala, y - oy * escala, w * escala, h * escala);
    });
    if (ap) {
      const { c, ctx: cx } = D.lienzo(72, 92, 2);
      D.avatar(cx, ap.silla ? 'silla' : ap.genero, 'd', 0, ap.ruana, ap);
      const fig = D.contorno(c, 2.5, 'rgba(58,38,22,.8)');
      const e = compacta ? 0.75 : 1;
      const x = paso * 3.7, y = base - 2;
      ctx.drawImage(fig, x - 36 * e, y - 88 * e, 72 * e, 92 * e);
    }
  }

  /* ---------- utilidades de vista ---------- */

  function anunciar(t) { const v = $('#vivo'); v.textContent = ''; setTimeout(() => { v.textContent = t; }, 50); }
  function mostrar(html, titulo) {
    contenido.innerHTML = `<div class="vista">${html}</div>`;
    document.title = titulo ? `${titulo} · Guardianes de Usme` : 'Guardianes de Usme';
    const h = $('h1', contenido);
    if (h) { h.setAttribute('tabindex', '-1'); setTimeout(() => h.focus({ preventScroll: true }), 30); }
    window.scrollTo(0, 0);
    pintarSesion();
  }
  const ir = vista => { location.hash = vista; };

  function pintarSesion() {
    const j = G.jugadorActual(), p = G.profeActual();
    const s = $('#sesion');
    let html = '';
    if (j) html += `<a class="btn btn-chico" href="#perfil"><canvas data-av aria-hidden="true"></canvas> ${esc(j.nick)}</a>`;
    if (p) html += `<a class="btn btn-chico" href="#panel"><span aria-hidden="true">🧑‍🏫</span> Panel de ${esc(p.nombre)}</a>`;
    s.innerHTML = html;
    const cv = $('canvas[data-av]', s);
    if (cv && j) pintarAvatar(cv, j.apariencia, 'd');
  }

  function rutaJuego(juego) { return juego.ruta; }

  /* ---------- #inicio ---------- */

  function vistaInicio() {
    const j = G.jugadorActual();
    mostrar(`
      <section class="portada" aria-labelledby="t-inicio">
        <div>
          <p class="sobre">Parque Arqueológico de Usme · Bogotá</p>
          <h1 id="t-inicio">Guardianes de Usme</h1>
          <p class="intro">Juegos para recorrer el territorio, conocer a sus guardianes y cuidar la memoria de los ancestros, el agua, el bosque, la huerta y el páramo.</p>
          <div class="entradas">
            <a class="btn btn-principal entrada" href="#jugador">
              <span class="ico" aria-hidden="true">🧒🏽</span> Soy jugador
              <small>${j ? `Sigue como ${esc(j.nick)}` : 'Solo necesitas tu nickname'}</small>
            </a>
            <a class="btn entrada" href="#profe">
              <span class="ico" aria-hidden="true">🧑🏽‍🏫</span> Soy profe o tallerista
              <small>Recursos, jugadores a tu cargo y evidencias</small>
            </a>
          </div>
        </div>
        <canvas id="escena-portada" role="img" aria-label="Los guardianes del parque: Tita la tingua, Rita la rana, Julián el arqueólogo, Doña Rosa, Cuqui el curí y Tomás el oso de anteojos, junto al río y el camino."></canvas>
      </section>
      <h2 class="seccion">Juegos</h2>
      <div class="juegos">
        ${G.JUEGOS.map(juego => `
          <article class="juego">
            <canvas data-escena aria-hidden="true"></canvas>
            <div class="cuerpo">
              <div><span class="etiq">6 a 12 años</span><span class="etiq" style="--c:var(--agua)">Voz y accesible</span></div>
              <h3>${esc(juego.nombre)}</h3>
              <p>${esc(juego.descripcion)}</p>
              <div class="acciones" style="margin-top:auto">
                <a class="btn btn-principal" href="${j ? esc(rutaJuego(juego)) : '#jugador'}"><span aria-hidden="true">▶</span> Jugar</a>
              </div>
            </div>
          </article>`).join('')}
        <div class="juego pronto"><span class="ico" aria-hidden="true">🌱</span><p><b>Muy pronto, más juegos</b><br>Cada juego nuevo aparecerá aquí, con sus recursos para clase.</p></div>
      </div>
      <p class="pie">Prototipo · Los textos están por validar con sabedores, la comunidad y el equipo del parque. <a href="plan.html">Plan del proyecto y tecnologías</a>.</p>`);
    pintarEscena($('#escena-portada'), j ? j.apariencia : null, false);
    $$('canvas[data-escena]').forEach(c => pintarEscena(c, null, true));
  }

  /* ---------- #jugador ---------- */

  function vistaJugador() {
    const j = G.jugadorActual();
    mostrar(`
      <div class="tarjeta">
        <h1 id="t-jugador">¡Hola, guardián o guardiana!</h1>
        ${j ? `<p class="aviso">Ya entraste como <b>${esc(j.nick)}</b>.</p>
          <div class="acciones" style="margin:0 0 18px"><a class="btn btn-principal" href="#perfil">Seguir como ${esc(j.nick)}</a></div>
          <h2 style="font-size:1.2rem">O entra con otro nickname</h2>` : '<p>Escribe tu nickname para guardar tus estrellas, tus diplomas y tu avatar.</p>'}
        <form id="f-jugador" novalidate>
          <div class="campo">
            <label for="nick">Tu nickname</label>
            <input id="nick" name="nick" type="text" maxlength="20" autocomplete="nickname" required aria-describedby="nick-ayuda">
            <small id="nick-ayuda">No uses tu nombre completo. Por ejemplo: «Colibrí 7» o «Sara M».</small>
          </div>
          <div class="campo">
            <label for="codigo">Código de grupo <small>(si tu profe te dio uno)</small></label>
            <input id="codigo" name="codigo" type="text" maxlength="12" autocomplete="off" placeholder="USME-ABCD" style="text-transform:uppercase" aria-describedby="codigo-ayuda">
            <small id="codigo-ayuda">Así tu profe o tallerista ve tus estrellas. También lo puedes poner después.</small>
          </div>
          <p class="error" id="e-jugador" role="alert"></p>
          <div class="acciones"><button class="btn btn-principal btn-grande" type="submit">Entrar <span aria-hidden="true">▶</span></button></div>
        </form>
      </div>`, 'Entrar como jugador');
    $('#f-jugador').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const { nuevo } = await G.entrarJugador(f.get('nick'), f.get('codigo'));
        anunciar(nuevo ? 'Bienvenida o bienvenido. Ahora crea tu avatar.' : 'Qué bueno verte otra vez.');
        ir(nuevo ? 'avatar' : 'perfil');
      } catch (err) { $('#e-jugador').textContent = err.message; }
    });
  }

  /* ---------- #avatar ---------- */

  function grupo(nombre, titulo, lista, actual, tipo) {
    return `<fieldset><legend>${titulo}</legend><div class="fila">${lista.map(([v, t, emoji]) => {
      const id = `op-${nombre}-${String(v).replace('#', '')}`;
      const marcado = String(v) === String(actual) ? 'checked' : '';
      if (tipo === 'color') return `<label class="opcion" title="${esc(t)}"><input type="radio" name="${nombre}" value="${v}" id="${id}" ${marcado}><span class="cara muestra"><i style="--c:${v}"></i><span class="oculto">${esc(t)}</span></span></label>`;
      if (tipo === 'peinado') return `<label class="opcion"><input type="radio" name="${nombre}" value="${v}" ${marcado}><span class="cara"><canvas data-peinado="${v}" aria-hidden="true"></canvas>${esc(t)}</span></label>`;
      return `<label class="opcion"><input type="radio" name="${nombre}" value="${v}" ${marcado}><span class="cara">${emoji ? `<span aria-hidden="true" style="font-size:1.6em">${emoji}</span>` : ''}${esc(t)}</span></label>`;
    }).join('')}</div></fieldset>`;
  }

  function vistaAvatar() {
    const j = G.jugadorActual();
    if (!j) return ir('jugador');
    let ap = { ...G.APARIENCIA, ...j.apariencia };
    let dir = 'd';
    mostrar(`
      <h1 id="t-avatar">Crea tu avatar</h1>
      <p>Así te verás en todos los juegos. Lo puedes cambiar cuando quieras.</p>
      <div class="editor">
        <div class="vista-previa">
          <canvas id="previa" role="img" aria-label="Tu avatar"></canvas>
          <p class="nombre">${esc(j.nick)}</p>
          <div class="acciones" style="justify-content:center"><button class="btn btn-chico" type="button" id="girar"><span aria-hidden="true">🔄</span> Girar</button></div>
        </div>
        <form id="f-avatar" class="opciones-avatar">
          ${grupo('genero', 'Género', OPCIONES.genero, ap.genero)}
          ${grupo('silla', '¿Cómo te mueves?', OPCIONES.silla, ap.silla)}
          ${grupo('piel', 'Tono de piel', OPCIONES.piel, ap.piel, 'color')}
          ${grupo('peinado', 'Tipo de cabello', OPCIONES.peinado, ap.peinado, 'peinado')}
          ${grupo('pelo', 'Color del cabello', OPCIONES.pelo, ap.pelo, 'color')}
          ${grupo('ruana', 'Color de la ruana', OPCIONES.ruana, ap.ruana, 'color')}
          ${grupo('pantalon', 'Color del pantalón', OPCIONES.pantalon, ap.pantalon, 'color')}
          ${grupo('zapatos', 'Color de los zapatos', OPCIONES.zapatos, ap.zapatos, 'color')}
          <p class="ok" id="ok-avatar" role="status"></p>
          <div class="acciones">
            <button class="btn btn-principal btn-grande" type="submit" data-jugar><span aria-hidden="true">▶</span> Guardar y jugar</button>
            <button class="btn" type="button" id="solo-guardar">Guardar</button>
          </div>
        </form>
      </div>`, 'Tu avatar');
    const describir = () => {
      const nom = (lista, v) => (lista.find(x => String(x[0]) === String(v)) || [, ''])[1].toLowerCase();
      return `${ap.genero === 'nina' ? 'Niña' : 'Niño'}${ap.silla ? ' en silla de ruedas' : ''}, piel ${nom(OPCIONES.piel, ap.piel)}, cabello ${nom(OPCIONES.peinado, ap.peinado)} ${nom(OPCIONES.pelo, ap.pelo)}, ruana ${nom(OPCIONES.ruana, ap.ruana)}, pantalón ${nom(OPCIONES.pantalon, ap.pantalon)} y zapatos ${nom(OPCIONES.zapatos, ap.zapatos)}.`;
    };
    const repintar = () => {
      pintarAvatar($('#previa'), ap, dir);
      $('#previa').setAttribute('aria-label', 'Tu avatar: ' + describir());
      $$('canvas[data-peinado]').forEach(c => pintarAvatar(c, { ...ap, silla: false, peinado: c.dataset.peinado }, 'd', [12, 0, 48, 48]));
    };
    repintar();
    $('#f-avatar').addEventListener('change', e => {
      const n = e.target.name;
      if (!n) return;
      ap[n] = n === 'silla' ? e.target.value === 'true' : e.target.value;
      $('#ok-avatar').textContent = '';
      repintar();
    });
    $('#girar').addEventListener('click', () => { dir = dir === 'd' ? 's' : dir === 's' ? 'u' : 'd'; repintar(); });
    const guardar = async jugar => {
      await G.guardarApariencia(ap);
      if (jugar) location.href = G.JUEGOS[0].ruta;
      else { $('#ok-avatar').textContent = '¡Listo! Tu avatar quedó guardado.'; pintarSesion(); }
    };
    $('#f-avatar').addEventListener('submit', e => { e.preventDefault(); guardar(true); });
    $('#solo-guardar').addEventListener('click', () => guardar(false));
  }

  /* ---------- #perfil ---------- */

  function vistaPerfil() {
    const j = G.jugadorActual();
    if (!j) return ir('jugador');
    const profe = j.codigo ? G.profePorCodigo(j.codigo) : null;
    mostrar(`
      <div class="perfil">
        <div class="retrato"><canvas id="retrato" role="img" aria-label="Tu avatar"></canvas>
          <div class="acciones" style="justify-content:center"><a class="btn btn-chico" href="#avatar"><span aria-hidden="true">🎨</span> Cambiar avatar</a></div></div>
        <div>
          <h1 id="t-perfil">${esc(j.nick)}</h1>
          <p>${profe ? `A cargo de <b>${esc(profe.nombre)}</b>${profe.institucion ? ` · ${esc(profe.institucion)}` : ''} <span class="etiq">${esc(j.codigo)}</span>` : 'Todavía no tienes profe o tallerista a cargo.'}</p>
          ${profe ? '' : `
            <form id="f-vincular" class="acciones" novalidate style="align-items:flex-end">
              <div class="campo" style="margin:0;flex:1;min-width:200px"><label for="codigo2">Código de grupo de tu profe</label>
                <input id="codigo2" name="codigo" type="text" maxlength="12" placeholder="USME-ABCD" style="text-transform:uppercase"></div>
              <button class="btn" type="submit">Agregar</button>
            </form><p class="error" id="e-vincular" role="alert"></p>`}
          <h2 style="margin-top:18px">Mis juegos</h2>
          <div class="logros">
            ${G.JUEGOS.map(juego => {
              const r = G.resumen(j, juego.id);
              return `<div class="logro">
                <h3>${esc(juego.nombre)}</h3>
                ${r.veces ? `<p><b class="grande">${r.mejor}</b> de ${juego.maximo} estrellas (tu mejor partida)</p>
                  <p>${r.diploma ? '<span aria-hidden="true">🏅</span> Diploma de guardián del territorio' : 'Aún sin diploma'} · Jugaste ${r.veces} ${r.veces === 1 ? 'vez' : 'veces'}</p>
                  <p><small>Última vez: ${fecha(r.ultima)}</small></p>` : '<p>Todavía no lo has jugado.</p>'}
                <div class="acciones"><a class="btn btn-principal" href="${esc(juego.ruta)}"><span aria-hidden="true">▶</span> ${r.veces ? 'Jugar otra vez' : 'Jugar'}</a></div>
              </div>`;
            }).join('')}
          </div>
          <div class="acciones"><button class="btn btn-chico" type="button" id="salir-j">Salir (cambiar de jugador)</button></div>
        </div>
      </div>`, j.nick);
    pintarAvatar($('#retrato'), j.apariencia, 'd');
    $('#salir-j').addEventListener('click', () => { G.salirJugador(); ir('inicio'); });
    const fv = $('#f-vincular');
    if (fv) fv.addEventListener('submit', async e => {
      e.preventDefault();
      try { await G.vincularJugador(new FormData(fv).get('codigo')); anunciar('Listo, tu profe ya puede ver tus estrellas.'); vistaPerfil(); }
      catch (err) { $('#e-vincular').textContent = err.message; }
    });
  }

  /* ---------- #profe ---------- */

  function vistaProfe(modo = 'ingresar') {
    if (G.profeActual()) return ir('panel');
    mostrar(`
      <div class="tarjeta">
        <h1 id="t-profe">Profes y talleristas</h1>
        <p>Descarga los recursos de cada juego, mira los avances de tus jugadores y guarda las evidencias de clase.</p>
        <div class="pestanas" role="tablist" aria-label="Ingresar o crear cuenta">
          <button class="btn btn-chico" role="tab" id="tab-ing" aria-selected="${modo === 'ingresar'}" aria-controls="f-profe">Ingresar</button>
          <button class="btn btn-chico" role="tab" id="tab-crear" aria-selected="${modo === 'crear'}" aria-controls="f-profe">Crear cuenta</button>
        </div>
        <form id="f-profe" role="tabpanel" novalidate>
          <div class="campo"><label for="p-nick">Nickname</label><input id="p-nick" name="nick" type="text" maxlength="20" autocomplete="username" required></div>
          ${modo === 'crear' ? `
            <div class="campo"><label for="p-nombre">¿Cómo te llaman los niños? <small>(opcional)</small></label><input id="p-nombre" name="nombre" type="text" maxlength="40" placeholder="Profe Camila"></div>
            <div class="campo"><label for="p-inst">Colegio, fundación o colectivo <small>(opcional)</small></label><input id="p-inst" name="institucion" type="text" maxlength="60"></div>` : ''}
          <div class="campo"><label for="p-clave">Contraseña</label><input id="p-clave" name="clave" type="password" autocomplete="${modo === 'crear' ? 'new-password' : 'current-password'}" required ${modo === 'crear' ? 'aria-describedby="p-clave-ayuda"' : ''}>
            ${modo === 'crear' ? '<small id="p-clave-ayuda">Mínimo 6 caracteres.</small>' : ''}</div>
          ${modo === 'crear' ? '<div class="campo"><label for="p-clave2">Repite la contraseña</label><input id="p-clave2" name="clave2" type="password" autocomplete="new-password" required></div>' : ''}
          <p class="error" id="e-profe" role="alert"></p>
          <div class="acciones"><button class="btn btn-principal btn-grande" type="submit">${modo === 'crear' ? 'Crear mi cuenta' : 'Ingresar'}</button></div>
        </form>
      </div>`, 'Profes y talleristas');
    $('#tab-ing').addEventListener('click', () => vistaProfe('ingresar'));
    $('#tab-crear').addEventListener('click', () => vistaProfe('crear'));
    $('#f-profe').addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        if (modo === 'crear') {
          if (f.clave !== f.clave2) throw new Error('Las dos contraseñas no son iguales.');
          await G.crearProfe(f);
          anunciar('Tu cuenta quedó creada.');
        } else await G.ingresarProfe(f.nick, f.clave);
        ir('panel');
      } catch (err) { $('#e-profe').textContent = err.message; }
    });
  }

  /* ---------- #panel ---------- */

  async function vistaPanel(pestana = 'jugadores') {
    const p = G.profeActual();
    if (!p) return ir('profe');
    const jugadores = await G.jugadoresDelProfe();
    const evidencias = await G.evidenciasDelProfe();
    mostrar(`
      <div class="cabecera-panel">
        <div>
          <h1 id="t-panel">Hola, ${esc(p.nombre)}</h1>
          <p style="margin:0">Código de tu grupo: <span class="codigo">${esc(p.codigo)}</span>
            <button class="btn btn-chico" type="button" id="copiar">Copiar</button></p>
          <p style="margin:6px 0 0"><small>Los niños lo escriben al entrar con su nickname, o después desde su perfil.</small></p>
        </div>
        <button class="btn btn-chico" type="button" id="salir-p">Cerrar sesión</button>
      </div>
      <p class="aviso"><b>Prototipo:</b> por ahora los datos se guardan en este equipo, así que aquí solo ves a quienes jugaron en él. En la versión publicada se verán desde cualquier equipo.</p>
      <div class="pestanas" role="tablist" aria-label="Secciones del panel">
        <button class="btn btn-chico" role="tab" data-p="jugadores" aria-selected="${pestana === 'jugadores'}">Mis jugadores (${jugadores.length})</button>
        <button class="btn btn-chico" role="tab" data-p="recursos" aria-selected="${pestana === 'recursos'}">Recursos para descargar</button>
        <button class="btn btn-chico" role="tab" data-p="evidencias" aria-selected="${pestana === 'evidencias'}">Evidencias de clase (${evidencias.length})</button>
      </div>
      <section id="panel-cuerpo" role="tabpanel"></section>
      <dialog id="detalle" aria-labelledby="detalle-t"></dialog>`, 'Panel del profe');
    $('#salir-p').addEventListener('click', () => { G.salirProfe(); ir('inicio'); });
    $('#copiar').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(p.codigo); anunciar('Código copiado.'); $('#copiar').textContent = '¡Copiado!'; }
      catch (e) { anunciar('Tu código es ' + p.codigo); }
    });
    $$('[data-p]').forEach(b => b.addEventListener('click', () => vistaPanel(b.dataset.p)));
    const cuerpo = $('#panel-cuerpo');
    if (pestana === 'jugadores') panelJugadores(cuerpo, jugadores, evidencias, p);
    else if (pestana === 'recursos') panelRecursos(cuerpo);
    else panelEvidencias(cuerpo, jugadores, evidencias);
  }

  function panelJugadores(cuerpo, jugadores, evidencias, p) {
    if (!jugadores.length) {
      cuerpo.innerHTML = `<div class="vacio"><p style="font-size:2rem;margin:0" aria-hidden="true">🧒🏽👧🏾🧑🏽‍🦽</p>
        <p><b>Todavía no hay jugadores en tu grupo.</b></p>
        <p>Comparte tu código <span class="codigo">${esc(p.codigo)}</span>: cada niño entra con su nickname y escribe el código.</p></div>`;
      return;
    }
    const juego = G.JUEGOS[0];
    cuerpo.innerHTML = `<div class="jugadores">${jugadores.map(j => {
      const r = G.resumen(j, juego.id);
      const ev = evidencias.filter(e => e.jugadores.includes(j.id)).length;
      return `<button class="jugador" type="button" data-j="${esc(j.id)}">
        <canvas data-av="${esc(j.id)}" aria-hidden="true"></canvas>
        <span><b>${esc(j.nick)}</b><br>
        <span class="datos">${r.veces ? `<span aria-hidden="true">⭐</span> ${r.mejor} de ${juego.maximo}${r.diploma ? ' · <span aria-hidden="true">🏅</span> diploma' : ''}` : 'Aún no ha jugado'}<br>
        ${ev ? `${ev} evidencia${ev === 1 ? '' : 's'}` : ''}</span></span>
      </button>`;
    }).join('')}</div>`;
    $$('canvas[data-av]', cuerpo).forEach(c => pintarAvatar(c, jugadores.find(j => j.id === c.dataset.av).apariencia, 'd'));
    $$('[data-j]', cuerpo).forEach(b => b.addEventListener('click', () => abrirDetalle(jugadores.find(j => j.id === b.dataset.j), evidencias)));
  }

  function abrirDetalle(j, evidencias) {
    const dlg = $('#detalle');
    const filas = G.JUEGOS.flatMap(juego => ((j.partidas || {})[juego.id] || []).map(pa => ({ juego, pa }))).reverse();
    const ev = evidencias.filter(e => e.jugadores.includes(j.id));
    dlg.innerHTML = `
      <div style="display:flex;gap:16px;align-items:center">
        <canvas id="det-av" style="width:72px;height:92px" aria-hidden="true"></canvas>
        <div><h2 id="detalle-t" style="margin:0">${esc(j.nick)}</h2><p style="margin:0;color:var(--suave)">Jugador desde ${fecha(j.creado)}</p></div>
      </div>
      <h3 style="margin-top:16px">Partidas y diplomas</h3>
      ${filas.length ? `<div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Juego</th><th>Estrellas</th><th>Semillas</th><th>Diploma</th></tr></thead><tbody>
        ${filas.map(({ juego, pa }) => `<tr><td>${fecha(pa.fecha)}</td><td>${esc(juego.nombre)}</td><td>${pa.puntos ?? 0} de ${pa.maximo ?? juego.maximo}</td><td>${pa.semillas ?? '—'}</td><td>${pa.diploma ? '<span aria-hidden="true">🏅</span> Sí' : 'No'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p>Aún no ha terminado ningún juego.</p>'}
      <h3 style="margin-top:16px">Evidencias de clase</h3>
      ${ev.length ? `<ul>${ev.map(e => `<li><b>${esc(e.titulo)}</b> · ${fecha(e.fecha)}${e.archivo ? ` · ${esc(e.archivo.nombre)}` : ''}</li>`).join('')}</ul>` : '<p>No hay evidencias relacionadas.</p>'}
      <div class="acciones"><button class="btn btn-principal" type="button" id="cerrar-det">Cerrar</button></div>`;
    dlg.showModal();
    pintarAvatar($('#det-av'), j.apariencia, 'd');
    $('#cerrar-det').addEventListener('click', () => dlg.close());
  }

  function panelRecursos(cuerpo) {
    cuerpo.innerHTML = G.JUEGOS.map(juego => `
      <h2 style="font-size:1.4rem">${esc(juego.nombre)}</h2>
      <div class="recursos">${juego.recursos.map(r => `
        <div class="recurso"><span class="ico" aria-hidden="true">${r.icono}</span><h3>${esc(r.titulo)}</h3><p>${esc(r.detalle)}</p>
          <div class="acciones" style="margin-top:auto"><a class="btn btn-principal btn-chico" href="${esc(r.ruta)}" target="_blank" rel="noopener">Abrir y descargar en PDF</a></div></div>`).join('')}
      </div>`).join('') + '<p style="margin-top:14px"><small>Cada recurso abre una página lista para imprimir: en la ventana de impresión elige «Guardar como PDF».</small></p>';
  }

  function panelEvidencias(cuerpo, jugadores, evidencias) {
    const hoy = hoyLocal();
    cuerpo.innerHTML = `
      <form id="f-ev" class="tarjeta ancha" novalidate>
        <h2 style="font-size:1.4rem">Subir una evidencia</h2>
        <div class="campo"><label for="ev-t">Actividad</label><input id="ev-t" name="titulo" type="text" maxlength="80" placeholder="Dibujo de la tingua bogotana" required></div>
        <div class="campo"><label for="ev-f">Fecha</label><input id="ev-f" name="fecha" type="date" value="${hoy}"></div>
        <div class="campo"><label for="ev-d">Descripción <small>(opcional)</small></label><textarea id="ev-d" name="descripcion" maxlength="500"></textarea></div>
        <div class="campo"><label for="ev-a">Archivo: foto o documento <small>(opcional, máximo 8 MB)</small></label><input id="ev-a" name="archivo" type="file" accept="image/*,application/pdf,.doc,.docx"></div>
        <fieldset class="campo"><legend>¿A quiénes se relaciona?</legend>
          ${jugadores.length ? `<div class="acciones" style="margin:0 0 6px"><button class="btn btn-chico" type="button" id="todos">Seleccionar a todos</button></div>
          <div class="lista-check">${jugadores.map(j => `<label><input type="checkbox" name="jugadores" value="${esc(j.id)}"> ${esc(j.nick)}</label>`).join('')}</div>`
            : '<p><small>Cuando tengas jugadores en tu grupo, podrás relacionarlos aquí.</small></p>'}
        </fieldset>
        <p class="aviso" style="margin-top:8px">Si la foto muestra la cara de un niño o una niña, necesitas la autorización de su acudiente. Mejor fotografía los trabajos.</p>
        <p class="error" id="e-ev" role="alert"></p>
        <div class="acciones"><button class="btn btn-principal" type="submit">Guardar evidencia</button></div>
      </form>
      <h2 style="font-size:1.4rem;margin-top:24px">Evidencias guardadas</h2>
      <div class="evidencias" id="lista-ev">${evidencias.length ? '' : '<div class="vacio">Todavía no has subido evidencias.</div>'}</div>`;
    const todos = $('#todos');
    if (todos) todos.addEventListener('click', () => $$('input[name=jugadores]', cuerpo).forEach(c => { c.checked = true; }));
    $('#f-ev').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const archivo = f.get('archivo');
      try {
        await G.crearEvidencia({ titulo: f.get('titulo'), descripcion: f.get('descripcion'), fecha: f.get('fecha'), jugadores: f.getAll('jugadores'), archivo: archivo && archivo.size ? archivo : null });
        anunciar('Evidencia guardada.');
        vistaPanel('evidencias');
      } catch (err) { $('#e-ev').textContent = err.message; }
    });
    const lista = $('#lista-ev');
    evidencias.forEach(async ev => {
      const nombres = ev.jugadores.map(id => (jugadores.find(j => j.id === id) || {}).nick).filter(Boolean);
      const art = document.createElement('article');
      art.className = 'evidencia';
      art.innerHTML = `<div class="mini" aria-hidden="true">${ev.archivo ? (ev.archivo.tipo.startsWith('image/') ? '' : '📄') : '📝'}</div>
        <div><h3 style="margin:0">${esc(ev.titulo)}</h3><p style="margin:2px 0;color:var(--suave)">${fecha(ev.fecha)}</p>
        ${ev.descripcion ? `<p style="margin:4px 0">${esc(ev.descripcion)}</p>` : ''}
        <div class="chips">${nombres.map(n => `<span class="chip">${esc(n)}</span>`).join('') || '<span class="chip">Todo el grupo o sin relacionar</span>'}</div>
        <div class="acciones" style="margin-top:6px">${ev.archivo ? `<button class="btn btn-chico" type="button" data-ver>Abrir ${esc(ev.archivo.nombre)}</button>` : ''}
        <button class="btn btn-chico btn-peligro" type="button" data-borrar>Borrar</button></div></div>`;
      lista.appendChild(art);
      if (ev.archivo) {
        const blob = await G.leerArchivo(ev.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          if (ev.archivo.tipo.startsWith('image/')) $('.mini', art).innerHTML = `<img src="${url}" alt="">`;
          $('[data-ver]', art).addEventListener('click', () => window.open(url, '_blank'));
        }
      }
      $('[data-borrar]', art).addEventListener('click', async () => {
        if (!confirm(`¿Borrar la evidencia «${ev.titulo}»?`)) return;
        await G.borrarEvidencia(ev.id);
        vistaPanel('evidencias');
      });
    });
  }

  /* ---------- rutas ---------- */

  const VISTAS = { inicio: vistaInicio, jugador: vistaJugador, avatar: vistaAvatar, perfil: vistaPerfil, profe: () => vistaProfe(), panel: () => vistaPanel() };
  function enrutar() {
    const v = (location.hash || '#inicio').slice(1);
    (VISTAS[v] || vistaInicio)();
  }
  window.addEventListener('hashchange', enrutar);
  enrutar();
})();
