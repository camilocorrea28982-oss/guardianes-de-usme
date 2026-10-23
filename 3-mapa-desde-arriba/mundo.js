/*
 * Guardianes de Usme · Prototipo 3 «Mapa desde arriba»
 *
 * Mapa ilustrado del parque visto desde arriba en tres cuartos, más grande que
 * la pantalla. La cámara sigue al personaje; con «Ver todo el mapa» se aleja
 * para mostrar el parque completo (ideal para proyectar en el salón).
 *
 * Este archivo solo dibuja y mueve: la capa común (comun/juego.js) se encarga
 * de conversaciones, preguntas, puntaje, accesibilidad y controles.
 *
 * Archivos de este prototipo:
 *   mapa.js     → trazado: camino, río, estaciones, posición del decorado
 *   dibujos.js  → todos los dibujos en Canvas 2D (no hay imágenes)
 *   mundo.js    → la escena de Phaser (este archivo)
 */
(function () {
  const M = window.GU_MAPA;
  const D = window.GU_DIBUJOS;
  const R = 2;                         // resolución de las texturas (2 = nítidas al acercar)
  const FUENTE = '"Baloo 2", "Atkinson Hyperlegible", system-ui, "Segoe UI", Roboto, sans-serif';
  const VELOCIDAD = 250;               // píxeles de mundo por segundo
  const DIST_CHARLA = 128;             // a esta distancia del centro del claro, el personaje te habla
  const DIST_SEMILLA = 50;
  const ESC_PJ = 0.95;                 // tamaño de personajes y avatar
  const CAPA = { suelo: -1e6, sombraNube: -9e5, agua: -8.5e5, anillo: -8e5, sombra: -7e5, cielo: 1e6 };

  // Dibujo de cada personaje: función, caja y origen (los pies).
  const PJ = {
    rosa:   { f: D.rosa,   w: 80, h: 100, oy: 96, cuadros: 1 },
    tita:   { f: D.tita,   w: 92, h: 84,  oy: 77, cuadros: 2 },
    julian: { f: D.julian, w: 84, h: 100, oy: 95, cuadros: 1 },
    rita:   { f: D.rita,   w: 68, h: 58,  oy: 50, cuadros: 1 },
    cuqui:  { f: D.cuqui,  w: 68, h: 54,  oy: 49, cuadros: 1 },
    tomas:  { f: D.tomas,  w: 96, h: 100, oy: 94, cuadros: 1 },
  };

  let cfg = { ...GU.config };
  let escena = null;
  let empezarPendiente = false;

  // Minijuegos que se juegan al llegar a una estación, antes de la conversación (ver minijuegos.js).
  const MINIJUEGOS = { 2: 'excavacion', 3: 'binoculares' };
  const resultadosMinijuegos = {};

  /* ---------- perfil del jugador (si entró por la plataforma) ---------- */
  // Trae el nickname y el avatar del editor; al terminar, guarda la partida y el diploma.
  const DATOS = window.GU_DATOS || null;
  const perfil = DATOS ? DATOS.jugadorActual() : null;
  // El nombre y el avatar se hacen solo en la plataforma («Crea tu avatar»): sin jugador, se va allá.
  if (DATOS && !perfil) { location.replace('../index.html#jugador'); return; }
  let preset = null;
  if (perfil) {
    const ap = perfil.apariencia || {};
    GU.config.nombre = perfil.nick;
    GU.config.avatar = ap.silla ? 'silla' : (ap.genero || 'nina');
    const r = GU.contenido.RUANAS.find(x => x.color.toLowerCase() === String(ap.ruana || '').toLowerCase());
    if (r) GU.config.ruana = r.id;
    preset = { avatar: GU.config.avatar, ruana: GU.config.ruana };
  }
  // Apariencia con la que se dibuja: la del perfil, ajustada si en la pantalla de inicio eligió otra cosa.
  function apariencia() {
    if (!perfil) return null;
    const ap = { ...perfil.apariencia };
    const id = GU.avatar().id;
    if (id !== preset.avatar) { if (id === 'silla') ap.silla = true; else { ap.silla = false; ap.genero = id; } }
    if (GU.config.ruana !== preset.ruana) ap.ruana = GU.colorRuana();
    return ap;
  }

  /* ---------- botón propio: «Ver todo el mapa» ---------- */

  const herramientas = document.createElement('div');
  herramientas.className = 'mapa-herramientas';
  herramientas.hidden = true;
  herramientas.innerHTML = `
    <button type="button" class="gu-btn gu-extra mapa-ver-todo" aria-pressed="false">
      <span class="mapa-ver-icono" aria-hidden="true">🗺️</span> <span class="mapa-ver-texto">Ver todo el mapa</span>
    </button>
    <button type="button" class="gu-btn gu-extra mapa-inicio" title="${perfil ? 'Mi perfil' : 'Página principal'}">
      <span aria-hidden="true">🏠</span> <span class="mapa-inicio-texto">${perfil ? 'Mi perfil' : 'Inicio'}</span>
    </button>`;
  document.body.appendChild(herramientas);
  const botonTodo = herramientas.querySelector('.mapa-ver-todo');
  herramientas.querySelector('.mapa-inicio').addEventListener('click', () => { location.href = '../index.html#' + (perfil ? 'perfil' : 'inicio'); });
  botonTodo.addEventListener('click', () => escena && escena.alternarTodo());

  function ubicarHerramientas() {
    let abajo = 10;
    document.querySelectorAll('.gu-hud-izq, .gu-hud-der').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.height && r.left < window.innerWidth * 0.5) abajo = Math.max(abajo, r.bottom);
    });
    herramientas.style.top = Math.round(abajo + 10) + 'px';
    return herramientas.getBoundingClientRect().bottom;
  }
  window.addEventListener('resize', ubicarHerramientas);

  /* ---------- escena ---------- */

  class EscenaMapa extends Phaser.Scene {
    constructor() { super('mapa'); }

    create() {
      escena = this;
      window.GU_MAPA_ESCENA = this; // solo para pruebas automáticas y depuración
      this.hc = !!cfg.contraste;
      this.quieto = !!cfg.reducirMovimiento;
      this.empezado = false;
      this.modoPreferido = 'seguir';   // 'seguir' | 'todo'
      this.enCharla = -1;
      this.enMinijuego = -1;           // estación cuyo minijuego está abierto
      this.auto = null;                // caminata automática por el camino
      this.objetivo = null;            // punto tocado en el mapa
      this.tPaso = 0; this.tAnim = 0;
      this.dir = 'd'; this.voltear = false;
      this.fMapa = 1;                  // los letreros y personajes crecen al ver todo el mapa
      this.mecen = [];                 // hierba, juncos… que se mecen
      this.decorExtra = [];            // se esconden en alto contraste
      this.colores = GU.estaciones.map(e => e.color);

      this.camUI = this.cameras.add(0, 0, this.scale.width, this.scale.height);
      this.cameras.main.setBackgroundColor('#e3d4ad');

      this.crearTexturas();
      if (this.hc) this.asegurarHc();
      this.crearSuelo();
      this.crearDecorado();
      this.crearAgua();
      this.crearEstaciones();
      this.crearSemillas();
      this.crearCielo();
      this.crearAvatar();
      this.crearFlecha();

      this.zoomBase = this.calcularZoomBase();
      const cam = this.cameras.main;
      cam.setBounds(0, -60, M.ANCHO, M.ALTO + 150);
      cam.setZoom(this.zoomBase * 0.8);
      cam.centerOn(M.ESTACIONES[0].x, M.ESTACIONES[0].y - 300);

      this.input.on('pointerdown', p => this.alTocar(p));
      // cuando el diálogo crece (llega la pregunta), la cámara se reacomoda para no tapar a nadie
      const dlg = document.getElementById('gu-dialogo');
      if (dlg && window.ResizeObserver) {
        let alto = 0;
        new ResizeObserver(() => {
          const h = dlg.offsetHeight;
          if (this.enCharla >= 0 && h && Math.abs(h - alto) > 30) this.aplicarCamara(true);
          alto = h;
        }).observe(dlg);
      }
      this.scale.on('resize', () => this.alCambiarTamano());
      this.game.canvas.setAttribute('aria-hidden', 'true');
      this.game.canvas.setAttribute('tabindex', '-1');

      if (empezarPendiente) this.empezar();
    }

    /* ----- utilidades de objetos ----- */

    mundo(o) { this.camUI.ignore(o); return o; }
    ui(o) { this.cameras.main.ignore(o); return o; }
    get suf() { return this.hc ? '-hc' : ''; }

    // Crea una textura a partir de un dibujo de Canvas 2D (con contorno suave o de alto contraste).
    tex(clave, w, h, dibujar, borde = 'normal') {
      const { c, ctx } = D.lienzo(w, h, R);
      dibujar(ctx);
      let lienzo = c;
      if (borde === 'normal') lienzo = D.contorno(c, 1.25 * R, 'rgba(58,38,22,.78)');
      else if (borde === 'hc') lienzo = D.contorno(c, 3 * R, '#000000');
      if (this.textures.exists(clave)) this.textures.remove(clave);
      this.textures.addCanvas(clave, lienzo);
    }
    // Versión normal y de alto contraste de la misma figura. La de alto contraste
    // se dibuja solo cuando hace falta (así el mapa abre más rápido).
    tex2(clave, w, h, dibujar) {
      this.tex(clave, w, h, ctx => dibujar(ctx, false), 'normal');
      const hc = () => this.tex(clave + '-hc', w, h, ctx => dibujar(ctx, true), 'hc');
      if (this.hcListo) hc(); else (this.pendientesHc = this.pendientesHc || []).push(hc);
    }
    asegurarHc() {
      this.hcListo = true;
      (this.pendientesHc || []).forEach(f => f());
      this.pendientesHc = [];
    }
    img(x, y, clave, ox = 0.5, oy = 1, esc = 1) {
      const o = this.add.image(x, y, clave).setOrigin(ox, oy).setScale(esc / R).setDepth(y);
      return this.mundo(o);
    }

    /* ----- texturas ----- */

    crearTexturas() {
      // personajes
      Object.entries(PJ).forEach(([id, p]) => {
        for (let f = 0; f < p.cuadros; f++) this.tex2(`pj-${id}-${f}`, p.w, p.h, ctx => p.f(ctx, f));
      });
      // vegetación y cosas
      ['aliso', 'bosque', 'encenillo', 'gaque'].forEach(t => { for (let v = 0; v < 3; v++) this.tex(`arbol-${t}-${v}`, 130, 150, ctx => D.arbol(ctx, t, v, 130, 150)); });
      this.tex('arbol-grande', 230, 250, ctx => D.arbol(ctx, 'grande', 1, 230, 250));
      this.tex('arbusto-0', 64, 46, ctx => D.arbusto(ctx, 0.3));
      this.tex('arbusto-1', 64, 46, ctx => D.arbusto(ctx, 0.9));
      this.tex('frailejon-0', 64, 100, ctx => D.frailejon(ctx, false));
      this.tex('frailejon-1', 64, 100, ctx => D.frailejon(ctx, true));
      this.tex('pajon', 48, 40, D.pajon, 'ninguno');
      this.tex('hierba-0', 34, 26, ctx => D.hierba(ctx, 0), 'ninguno');
      this.tex('hierba-1', 34, 26, ctx => D.hierba(ctx, 1), 'ninguno');
      this.tex('junco', 36, 66, D.junco, 'ninguno');
      this.tex('helecho', 52, 34, D.helecho, 'ninguno');
      for (let c = 0; c < 4; c++) this.tex(`flor-${c}`, 16, 18, ctx => D.flor(ctx, c), 'ninguno');
      this.tex('roca-0', 60, 42, ctx => D.roca(ctx, 0));
      this.tex('roca-1', 60, 42, ctx => D.roca(ctx, 1));
      this.tex('piedra', 32, 50, D.piedraParada);
      for (let t = 0; t < 3; t++) this.tex(`vasija-${t}`, 36, 40, ctx => D.vasija(ctx, t));
      this.tex2('piedrasol', 84, 52, (ctx, hc) => D.piedraSol(ctx, hc));
      this.tex('maiz', 40, 80, D.maiz, 'ninguno');
      this.tex('papa', 42, 32, D.papa);
      this.tex('casa', 290, 232, D.casa);
      this.tex('vaca', 82, 60, D.vaca);
      this.tex('oveja', 56, 42, D.oveja);
      // cielo y efectos
      this.tex('nube', 300, 160, ctx => D.nube(ctx, false), 'ninguno');
      this.tex('sombra-nube', 300, 160, ctx => D.nube(ctx, true), 'ninguno');
      this.tex('pajaro-0', 30, 18, ctx => D.pajaro(ctx, 0), 'ninguno');
      this.tex('pajaro-1', 30, 18, ctx => D.pajaro(ctx, 1), 'ninguno');
      this.tex('onda', 26, 10, D.onda, 'ninguno');
      this.tex('destello', 22, 22, D.destello, 'ninguno');
      this.tex('humo', 40, 40, ctx => D.bolaSuave(ctx, 40, 40, '#f4f4f0', 0.85), 'ninguno');
      this.tex('niebla', 420, 200, ctx => D.bolaSuave(ctx, 420, 200, '#f6f8f8', 0.7), 'ninguno');
      this.tex('sombra', 64, 24, D.sombra, 'ninguno');
      this.tex('toque', 60, 60, ctx => { ctx.beginPath(); ctx.arc(30, 30, 24, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.stroke(); }, 'ninguno');
      // marcadores por estación
      GU.estaciones.forEach((e, i) => {
        this.tex2(`anillo-${i}`, 250, 250, (ctx, hc) => D.anillo(ctx, e.color, hc));
        this.tex2(`marcador-${i}`, 50, 60, (ctx, hc) => D.marcador(ctx, e.color, hc));
        this.tex2(`burbuja-${i}`, 80, 80, (ctx, hc) => D.burbuja(ctx, e.color, hc));
        this.tex2(`semilla-${i}`, 60, 60, (ctx, hc) => D.semilla(ctx, i, hc));
        const m = D.medirLetrero(e.nombre, FUENTE);
        this.tex2(`letrero-${i}`, m.w + 8, m.h + 40, (ctx, hc) => D.letrero(ctx, m, i + 1, e.color, hc, FUENTE));
      });
      this.tex2('chulo', 44, 44, (ctx, hc) => D.chulo(ctx, hc));
      this.tex2('flecha', 38, 40, (ctx, hc) => D.flecha(ctx, hc));
    }

    // El avatar se dibuja con la ruana elegida; se vuelve a generar al empezar.
    texturasAvatar() {
      const ap = apariencia();
      const tipo = GU.avatar().id, color = ap ? ap.ruana : GU.colorRuana();
      const firma = tipo + color + JSON.stringify(ap);
      if (this.firmaAvatar === firma) return;
      this.firmaAvatar = firma;
      ['d', 'u', 's'].forEach(dir => {
        for (let f = 0; f < 3; f++) this.tex2(`av-${dir}-${f}`, 72, 92, ctx => D.avatar(ctx, tipo, dir, f, color, ap));
      });
    }

    /* ----- suelo en trozos (Canvas 2D a 0,7 de resolución) ----- */

    crearSuelo() {
      const S = 0.7, T = 1024, paso = T / S;
      this.trozos = [];
      for (let y0 = 0; y0 < M.ALTO; y0 += paso) {
        for (let x0 = 0; x0 < M.ANCHO; x0 += paso) {
          const w = Math.ceil(Math.min(paso, M.ANCHO - x0) * S), h = Math.ceil(Math.min(paso, M.ALTO - y0) * S);
          const clave = `suelo-${x0}-${y0}`;
          const t = this.textures.createCanvas(clave, w, h);
          const o = this.mundo(this.add.image(x0, y0, clave).setOrigin(0, 0).setDepth(CAPA.suelo).setDisplaySize(w / S + 2, h / S + 2)); // +2: sin costuras entre trozos
          this.trozos.push({ t, x0, y0, w, h, S, o });
        }
      }
      this.dibujarSuelo();
    }
    dibujarSuelo() {
      this.trozos.forEach(z => {
        const ctx = z.t.context;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, z.w, z.h);
        ctx.setTransform(z.S, 0, 0, z.S, -z.x0 * z.S, -z.y0 * z.S);
        D.suelo(ctx, M, this.colores, this.hc, { x0: z.x0, y0: z.y0, x1: z.x0 + z.w / z.S, y1: z.y0 + z.h / z.S }, FUENTE);
        z.t.refresh();
      });
    }

    /* ----- decorado ----- */

    crearDecorado() {
      const d = M.decorado;
      this.estaticos = [];
      // todo el decorado se registra para esconder lo que queda fuera de la cámara
      const img = this.img.bind(this);
      this.img = (...a) => { const o = img(...a); this.estaticos.push(o); return o; };
      const mece = (o, f, amp) => { this.mecen.push({ o, f, amp }); return o; };
      d.arboles.forEach((a, k) => this.img(a.x, a.y, `arbol-${a.tipo}-${k % 3}`, 0.5, 142 / 150, a.s));
      this.img(M.ARBOL_GRANDE.x, M.ARBOL_GRANDE.y, 'arbol-grande', 0.5, 242 / 250, 1);
      d.arbustos.forEach(a => this.img(a.x, a.y, `arbusto-${a.tono > 0.5 ? 1 : 0}`, 0.5, 0.9, a.s));
      d.frailejones.forEach(a => this.img(a.x, a.y, `frailejon-${a.flor ? 1 : 0}`, 0.5, 0.95, a.s));
      d.rocas.forEach(a => this.img(a.x, a.y, `roca-${a.tipo}`, 0.5, 0.85, a.s));
      d.piedrasParadas.forEach(a => this.img(a.x, a.y, 'piedra', 0.5, 0.92, a.s));
      d.vasijas.forEach(a => this.img(a.x, a.y, `vasija-${a.tipo}`, 0.5, 0.88, 1));
      d.animales.forEach(a => {
        const o = this.img(a.x, a.y, a.tipo, 0.5, 0.9, 1).setFlipX(a.lado < 0);
        this.mecen.push({ o, f: a.x, amp: 0, animal: true, y0: a.y });
      });
      // círculo de piedras con el sol (huerta)
      const CS = M.CIRCULO_SOL;
      for (let k = 0; k < 9; k++) {
        const ang = (k / 9) * Math.PI * 2;
        this.img(CS.x + Math.cos(ang) * CS.r, CS.y + Math.sin(ang) * CS.r * 0.6, 'piedra', 0.5, 0.92, 0.62);
      }
      this.piedraSol = this.img(CS.x, CS.y + 10, 'piedrasol', 0.5, 0.6, 1.1);
      // casa con humo en la chimenea
      this.img(M.CASA.x, M.CASA.y, 'casa', 0.5, 222 / 232, 1);
      this.humo = [0, 1, 2, 3].map(k => this.mundo(this.add.image(0, 0, 'humo').setScale(0.5 / R).setDepth(M.CASA.y + 1).setData('k', k)));
      // plantas de la huerta
      d.plantas.forEach(a => mece(this.img(a.x, a.y, a.tipo, 0.5, a.tipo === 'maiz' ? 0.96 : 0.9, a.s), a.f, a.tipo === 'maiz' ? 0.05 : 0.025));
      // lo pequeño que se mece (se esconde en alto contraste)
      d.hierbas.forEach(a => this.decorExtra.push(mece(this.img(a.x, a.y, `hierba-${a.tono > 0.5 ? 1 : 0}`, 0.5, 0.95, a.s), a.f, 0.12)));
      d.pajonales.forEach(a => { mece(this.img(a.x, a.y, 'pajon', 0.5, 0.95, a.s), a.f, 0.1).pequeno = true; });
      d.juncos.forEach(a => mece(this.img(a.x, a.y, 'junco', 0.5, 0.96, a.s), a.f, 0.07));
      d.helechos.forEach(a => this.decorExtra.push(mece(this.img(a.x, a.y, 'helecho', 0.5, 0.9, a.s), a.f, 0.05)));
      d.flores.forEach(a => this.decorExtra.push(this.img(a.x, a.y, `flor-${a.c}`, 0.5, 0.9, a.s)));
      this.decorExtra.forEach(o => { o.extra = true; });
      this.img = img;
    }

    // Esconde el decorado que está fuera de la cámara (rinde mucho más en equipos modestos).
    recortar() {
      const v = this.cameras.main.worldView, m = 240;
      const x0 = v.x - m, x1 = v.right + m, y0 = v.y - m, y1 = v.bottom + m + 160;
      const hc = this.hc, lejos = this.cameras.main.zoom < 0.5; // de lejos, lo pequeñito no se ve: no se dibuja
      for (let k = 0; k < this.estaticos.length; k++) {
        const o = this.estaticos[k];
        o.visible = o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1 && !(hc && o.extra) && !(lejos && (o.extra || o.pequeno));
      }
    }

    /* ----- agua que corre ----- */

    crearAgua() {
      this.ondas = [];
      const r = M.aleatorio(31);
      const nueva = (curso, ancho, vel) => {
        const o = this.mundo(this.add.image(0, 0, 'onda').setScale(0.9 / R).setDepth(CAPA.agua));
        this.ondas.push({ o, curso, s: r() * (curso.length - 2), lado: (r() - 0.5) * ancho, vel: vel * (0.7 + r() * 0.6), fase: r() });
      };
      for (let i = 0; i < 70; i++) nueva(M.rio, M.ANCHO_RIO * 1.4, 4.2);
      for (let i = 0; i < 26; i++) nueva(M.quebrada, 14, 5.5);
      this.brillos = [0, 1, 2, 3, 4].map(k => this.mundo(this.add.image(0, 0, 'destello').setDepth(CAPA.agua).setData('k', k)));
    }

    /* ----- estaciones ----- */

    crearEstaciones() {
      this.est = GU.estaciones.map((e, i) => {
        const m = M.ESTACIONES[i];
        const id = e.personaje, p = PJ[id];
        const px = m.x + m.pj[0], py = m.y + m.pj[1];
        const sombra = this.mundo(this.add.image(px, py, 'sombra').setScale((p.w / 64) * 0.9 / R * ESC_PJ).setDepth(CAPA.sombra).setAlpha(0.9));
        const pj = this.img(px, py, `pj-${id}-0${this.suf}`, 0.5, p.oy / p.h, ESC_PJ);
        const lx = m.x + m.letrero[0], ly = m.y + m.letrero[1];
        const letrero = this.img(lx, ly, `letrero-${i}${this.suf}`, 0.5, 1, 1);
        const anillo = this.mundo(this.add.image(m.x, m.y, `anillo-${i}${this.suf}`).setScale(1 / R).setDepth(CAPA.anillo));
        const marcador = this.mundo(this.add.image(px, py - p.h, `marcador-${i}${this.suf}`).setOrigin(0.5, 1).setScale(1 / R).setDepth(1e5));
        const chulo = this.mundo(this.add.image(px, py, `chulo${this.suf}`).setScale(1 / R).setDepth(1e5 + 1).setVisible(false));
        return { i, id, p, m, px, py, pj, sombra, letrero, anillo, marcador, chulo, cuadro: 0 };
      });
    }

    /* ----- semillas ----- */

    crearSemillas() {
      this.semillas = M.ESTACIONES.map((m, i) => {
        const [x, y] = m.semilla;
        const o = this.img(x, y, `semilla-${i}${this.suf}`, 0.5, 0.5, 0.85).setDepth(y + 20);
        const brillo = this.mundo(this.add.image(x + 14, y - 16, 'destello').setScale(0.7 / R).setDepth(y + 21));
        return { i, x, y, o, brillo, viva: true };
      });
    }

    /* ----- nubes, pájaros, niebla ----- */

    crearCielo() {
      const r = M.aleatorio(9);
      this.nubes = [0, 1, 2, 3, 4].map(k => {
        const x = r() * M.ANCHO, y = 200 + k * 560 + r() * 200, s = 1.2 + r() * 0.9;
        const sombra = this.mundo(this.add.image(x + 160, y + 300, 'sombra-nube').setScale(s / R).setAlpha(0.14).setDepth(CAPA.sombraNube));
        const nube = this.mundo(this.add.image(x, y, 'nube').setScale(s / R).setAlpha(0.55).setDepth(CAPA.cielo));
        return { x, y, s, sombra, nube, vel: 9 + r() * 8 };
      });
      this.pajaros = [0, 1, 2, 3].map(k => {
        const o = this.mundo(this.add.image(0, 0, 'pajaro-0').setScale(1.1 / R).setDepth(CAPA.cielo - 1));
        const sombra = this.mundo(this.add.image(0, 0, 'sombra').setScale(0.35 / R).setAlpha(0.5).setDepth(CAPA.sombraNube));
        return { o, sombra, base: 400 + k * 640, desf: r() * 3000, vel: 70 + r() * 40 };
      });
      this.nieblas = [0, 1, 2, 3, 4, 5, 6].map(k => {
        const x = r() * M.ANCHO, y = 180 + r() * 420;
        const o = this.mundo(this.add.image(x, y, 'niebla').setScale((1.4 + r()) / R).setAlpha(0.24).setDepth(CAPA.cielo - 2));
        return { o, x, y, desf: r() * 10 };
      });
    }

    /* ----- avatar ----- */

    crearAvatar() {
      this.texturasAvatar();
      this.ax = M.INICIO.x; this.ay = M.INICIO.y;
      this.avSombra = this.mundo(this.add.image(this.ax, this.ay, 'sombra').setScale(0.95 / R * ESC_PJ).setDepth(CAPA.sombra));
      this.avatar = this.img(this.ax, this.ay, `av-u-0${this.suf}`, 0.5, 88 / 92, ESC_PJ);
      this.toque = this.mundo(this.add.image(0, 0, 'toque').setScale(1 / R).setDepth(CAPA.anillo + 1).setVisible(false));
    }

    /* ----- flecha en el borde hacia la próxima estación ----- */

    crearFlecha() {
      this.flechaBurbuja = this.ui(this.add.image(0, 0, 'burbuja-0').setScale(0.8 / R).setDepth(10));
      this.flechaPj = this.ui(this.add.image(0, 0, 'pj-rosa-0').setDepth(11));
      this.flechaPunta = this.ui(this.add.image(0, 0, `flecha${this.suf}`).setScale(1 / R).setDepth(12));
      this.flechaVisible(false);
    }
    flechaVisible(v) { [this.flechaBurbuja, this.flechaPj, this.flechaPunta].forEach(o => o.setVisible(v)); }

    /* ----- configuración ----- */

    aplicarConfig() {
      const hc = !!cfg.contraste;
      this.quieto = !!cfg.reducirMovimiento;
      if (hc !== this.hc) {
        this.hc = hc;
        if (hc) this.asegurarHc();
        this.dibujarSuelo();
        const s = this.suf;
        this.est.forEach((st, i) => {
          st.letrero.setTexture(`letrero-${i}${s}`);
          st.anillo.setTexture(`anillo-${i}${s}`);
          st.marcador.setTexture(`marcador-${i}${s}`);
          st.chulo.setTexture(`chulo${s}`);
          st.cuadro = -1;
        });
        this.semillas.forEach(se => se.o.setTexture(`semilla-${se.i}${s}`));
        this.piedraSol.setTexture('piedrasol' + s);
        this.flechaPunta.setTexture('flecha' + s);
        this.sigFlecha = -2;
      }
      this.recortar();
      this.nubes.forEach(n => { n.nube.setVisible(!hc); n.sombra.setVisible(!hc); });
      this.nieblas.forEach(n => n.o.setVisible(!hc));
      this.pajaros.forEach(p => { p.o.setVisible(!hc); p.sombra.setVisible(!hc); });
      if (this.empezado) this.aplicarCamara(false);
    }

    /* ----- empezar ----- */

    empezar() {
      this.texturasAvatar();
      this.avatar.setTexture(`av-${this.dir}-0${this.suf}`);
      if (!this.empezado) {
        this.ax = M.INICIO.x; this.ay = M.INICIO.y;
        this.dir = 'u';
      }
      this.empezado = true;
      herramientas.hidden = false;
      ubicarHerramientas();
      setTimeout(ubicarHerramientas, 300);
      const cam = this.cameras.main;
      cam.setZoom(this.zoomBase);
      cam.centerOn(this.ax, this.ay);
      this.aplicarCamara(false);
    }

    /* ----- cámara ----- */

    calcularZoomBase() {
      const { width: w, height: h } = this.scale;
      return Phaser.Math.Clamp(Math.min(w, h) / 680, 0.5, 1.35);
    }
    // Zoom y centro para ver el parque completo, por debajo de la barra de arriba.
    vistaTodo() {
      const { width: w, height: h } = this.scale;
      let arriba = 0;
      document.querySelectorAll('.gu-hud-izq, .gu-hud-der').forEach(n => { arriba = Math.max(arriba, n.getBoundingClientRect().bottom); });
      arriba = Math.min(arriba + 6, h * 0.3);
      const z = Math.min(w / (M.ANCHO + 60), (h - arriba - 8) / (M.ALTO + 40));
      return { z, x: M.ANCHO / 2, y: M.ALTO / 2 - (arriba - 8) / 2 / z };
    }
    duracion(normal) { return this.quieto ? 120 : normal; }

    // Las transiciones de cámara se miden en tiempo real (no en cuadros), así terminan
    // a tiempo aunque el equipo sea lento.
    moverCamara(x, y, z, dur, alTerminar) {
      const cam = this.cameras.main;
      cam.stopFollow();
      const desde = { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2, z: cam.zoom };
      this.camAnim = { t0: performance.now(), dur: Math.max(1, dur), desde, x, y, z, alTerminar };
      if (dur <= 0) this.pasoCamara(true);
    }
    pasoCamara(terminar) {
      const a = this.camAnim;
      if (!a) return;
      const cam = this.cameras.main;
      const k = terminar ? 1 : Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = 0.5 - Math.cos(k * Math.PI) / 2;
      const hx = typeof a.x === 'function' ? a.x() : a.x, hy = typeof a.y === 'function' ? a.y() : a.y;
      cam.setZoom(a.desde.z + (a.z - a.desde.z) * e);
      cam.centerOn(a.desde.x + (hx - a.desde.x) * e, a.desde.y + (hy - a.desde.y) * e);
      if (k >= 1) { this.camAnim = null; if (a.alTerminar) a.alTerminar(); }
    }

    aplicarCamara(animar = true) {
      const cam = this.cameras.main;
      const lerp = this.quieto ? 1 : 0.09;
      if (this.enCharla >= 0) {
        const st = this.est[this.enCharla];
        const z = this.zoomBase * 1.3;
        cam.setBounds(0, -60, M.ANCHO, M.ALTO + 150);
        // el diálogo tapa la parte de abajo: el personaje queda en la parte libre de arriba
        const dlg = document.getElementById('gu-dialogo');
        const r = dlg && !dlg.hidden ? dlg.getBoundingClientRect() : null;
        const libre = r && r.top > 80 ? r.top : this.scale.height * 0.55;
        const objetivoY = Math.max(90, libre * 0.52);
        const off = (this.scale.height / 2 - objetivoY) / z;
        const mx = (this.ax + st.px) / 2, my = (this.ay + st.py) / 2 - 40;
        this.moverCamara(mx, my + off, z, animar ? this.duracion(700) : 0);
        return;
      }
      if (this.modoPreferido === 'todo') {
        cam.removeBounds();
        const v = this.vistaTodo();
        this.moverCamara(v.x, v.y, v.z, animar ? this.duracion(900) : 0);
        return;
      }
      cam.setBounds(0, -60, M.ANCHO, M.ALTO + 150);
      this.moverCamara(() => this.ax, () => this.ay, this.zoomBase, animar ? this.duracion(800) : 0,
        () => cam.startFollow(this.avatar, true, lerp, lerp));
    }

    alternarTodo() {
      if (!this.empezado) return;
      this.modoPreferido = this.modoPreferido === 'todo' ? 'seguir' : 'todo';
      const todo = this.modoPreferido === 'todo';
      botonTodo.setAttribute('aria-pressed', String(todo));
      botonTodo.querySelector('.mapa-ver-icono').textContent = todo ? '🔍' : '🗺️';
      botonTodo.querySelector('.mapa-ver-texto').textContent = todo ? 'Volver a mi personaje' : 'Ver todo el mapa';
      GU.anunciar(todo ? 'Ahora ves todo el parque, con las seis estaciones y el camino.' : 'La cámara vuelve a seguirte.');
      if (this.enCharla < 0) this.aplicarCamara(true);
    }

    alCambiarTamano() {
      const { width: w, height: h } = this.scale;
      this.camUI.setSize(w, h);
      this.zoomBase = this.calcularZoomBase();
      if (this.empezado) this.aplicarCamara(false);
      else this.cameras.main.setZoom(this.zoomBase * 0.8);
      ubicarHerramientas();
    }

    /* ----- conversación ----- */

    conversacion({ indice, abierta }) {
      if (abierta) {
        this.auto = null; this.objetivo = null; this.toque.setVisible(false);
        this.enCharla = indice;
        const st = this.est[indice];
        // mirar hacia el personaje
        this.dir = 's'; this.voltear = st.px < this.ax;
        this.aplicarCamara(true);
        // el diálogo aparece un instante después: reacomodar con su altura real
        setTimeout(() => { if (this.enCharla === indice) this.aplicarCamara(true); }, 80);
      } else {
        this.enCharla = -1;
        this.aplicarCamara(true);
      }
    }

    /* ----- caminar ----- */

    bloqueado(x, y) {
      if (x < 34 || y < 120 || x > M.ANCHO - 34 || y > M.ALTO - 30) return true;
      if (Math.abs(y - M.yRio(x)) < M.ANCHO_RIO + 6 && !M.enPuente(x, y)) return true;
      if (M.enLaguna(x, y, 6)) return true;
      if (M.enCasa(x, y, 4)) return true;
      const obs = M.decorado.obstaculos;
      for (let k = 0; k < obs.length; k++) {
        const o = obs[k];
        const dx = x - o.x, dy = (y - o.y) * 1.4;
        if (dx * dx + dy * dy < o.r * o.r) return true;
      }
      return false;
    }
    moverConColision(dx, dy) {
      const x = this.ax, y = this.ay;
      if (!this.bloqueado(x + dx, y + dy)) { this.ax += dx; this.ay += dy; return true; }
      if (dx && !this.bloqueado(x + dx, y)) { this.ax += dx; return true; }
      if (dy && !this.bloqueado(x, y + dy)) { this.ay += dy; return true; }
      // deslizar en diagonal alrededor del obstáculo
      const l = Math.hypot(dx, dy);
      for (const a of [0.7, -0.7, 1.3, -1.3]) {
        const c = Math.cos(a), s = Math.sin(a);
        const nx = (dx * c - dy * s), ny = (dx * s + dy * c);
        if (!this.bloqueado(x + nx * 0.8, y + ny * 0.8)) { this.ax += nx * 0.8; this.ay += ny * 0.8; return l > 0; }
      }
      return false;
    }

    // Puntos del camino desde donde estoy hasta el índice `destino` del camino.
    rutaPorCamino(destino) {
      const cam = M.camino;
      const x = this.ax, y = this.ay;
      const enPuente = M.enPuente(x, y);
      const lado = M.ladoRio(x, y);
      const a = M.indiceMasCercano(cam, x, y, p => enPuente || M.enPuente(p.x, p.y) || M.ladoRio(p.x, p.y) === lado);
      const pts = [];
      const paso = a <= destino ? 1 : -1;
      for (let i = a; i !== destino; i += paso) pts.push(cam[i]);
      pts.push(cam[destino]);
      return pts;
    }

    irAEstacion(i, opciones) {
      const st = this.est[i];
      this.objetivo = null;
      this.toque.setVisible(false);
      this.auto = { puntos: this.rutaPorCamino(st.m.idx), k: 0, estacion: i, ...opciones };
    }

    // ¿Falta jugar el minijuego de esta estación?
    minijuegoPendiente(i) {
      return !!(MINIJUEGOS[i] && window.GU_MINIJUEGOS && !resultadosMinijuegos[MINIJUEGOS[i]] && !GU.completada(i));
    }
    // Llega a la estación: primero el minijuego (si hay), luego la conversación y la pregunta.
    async llegarA(i) {
      if (this.enMinijuego >= 0) return;
      if (this.minijuegoPendiente(i)) {
        this.enMinijuego = i;
        this.auto = null; this.objetivo = null; this.toque.setVisible(false);
        GU.zona(i);
        try { resultadosMinijuegos[MINIJUEGOS[i]] = await window.GU_MINIJUEGOS[MINIJUEGOS[i]]() || {}; }
        catch (e) { console.error(e); resultadosMinijuegos[MINIJUEGOS[i]] = {}; }
        this.enMinijuego = -1;
      }
      GU.llegar(i);
    }

    avanzar(i) {
      if (!this.empezado || i < 0 || this.enMinijuego >= 0) return;
      this.irAEstacion(i, {
        ignorarEntrada: true,
        alLlegar: () => {
          if (cfg.control !== 'libre') GU.recoger(i);
          this.llegarA(i);
        },
      });
    }

    alTocar(p) {
      if (!this.empezado || GU.pausado() || this.enMinijuego >= 0) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      // ¿tocó una estación (claro, personaje o letrero)?
      let elegida = -1;
      this.est.forEach((st, i) => {
        if (elegida >= 0) return;
        if (Math.hypot(w.x - st.m.x, w.y - st.m.y) < M.RADIO_CLARO * Math.max(1, this.fMapa * 0.8)
          || st.letrero.getBounds().contains(w.x, w.y) || st.pj.getBounds().contains(w.x, w.y)) elegida = i;
      });
      if (cfg.control !== 'libre') {
        if (elegida >= 0 && elegida === GU.siguiente()) this.avanzar(elegida);
        return;
      }
      if (elegida >= 0) {
        this.irAEstacion(elegida, { ignorarEntrada: false, alLlegar: () => this.llegarA(elegida) });
        return;
      }
      const tx = Phaser.Math.Clamp(w.x, 40, M.ANCHO - 40), ty = Phaser.Math.Clamp(w.y, 130, M.ALTO - 40);
      this.toque.setPosition(tx, ty).setVisible(true).setAlpha(1);
      const mismoLado = M.enPuente(this.ax, this.ay) || M.ladoRio(this.ax, this.ay) === M.ladoRio(tx, ty);
      if (mismoLado) {
        this.auto = null;
        this.objetivo = { x: tx, y: ty, t: 0, ultimo: Infinity };
      } else {
        // al otro lado del río: por el camino, cruzando el puente
        const ladoDestino = M.ladoRio(tx, ty);
        const destino = M.indiceMasCercano(M.camino, tx, ty, q => M.ladoRio(q.x, q.y) === ladoDestino && !M.enPuente(q.x, q.y));
        const pts = this.rutaPorCamino(destino);
        pts.push({ x: tx, y: ty });
        this.objetivo = null;
        this.auto = { puntos: pts, k: 0, estacion: -1, ignorarEntrada: false, alLlegar: () => this.toque.setVisible(false) };
      }
    }

    // Avanza por la lista de puntos con un presupuesto de distancia.
    pasoAuto(dt) {
      const a = this.auto;
      let resta = VELOCIDAD * 1.1 * dt;
      const x0 = this.ax, y0 = this.ay;
      while (resta > 0 && a.k < a.puntos.length) {
        const p = a.puntos[a.k];
        const dx = p.x - this.ax, dy = p.y - this.ay;
        const d = Math.hypot(dx, dy);
        if (d <= resta) { this.ax = p.x; this.ay = p.y; resta -= d; a.k++; }
        else { this.ax += dx / d * resta; this.ay += dy / d * resta; resta = 0; }
      }
      const vx = this.ax - x0, vy = this.ay - y0;
      if (a.k >= a.puntos.length) {
        this.auto = null;
        if (a.alLlegar) a.alLlegar();
      }
      return { vx, vy };
    }

    /* ----- semillas ----- */

    semillaRecogida(i) {
      const se = this.semillas[i];
      if (!se || !se.viva) return;
      se.viva = false;
      se.brillo.setVisible(false);
      const o = se.o;
      if (this.quieto) { o.setVisible(false); return; }
      this.tweens.add({ targets: o, y: o.y - 70, scale: o.scale * 1.8, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => o.setVisible(false) });
      for (let k = 0; k < 8; k++) {
        const ch = this.mundo(this.add.image(se.x, se.y, 'destello').setScale(0.8 / R).setDepth(se.y + 30));
        const ang = (k / 8) * Math.PI * 2;
        this.tweens.add({ targets: ch, x: se.x + Math.cos(ang) * 60, y: se.y + Math.sin(ang) * 45 - 20, alpha: 0, angle: 180, duration: 700, ease: 'Quad.easeOut', onComplete: () => ch.destroy() });
      }
    }

    alFinal() { herramientas.hidden = true; this.flechaVisible(false); }

    /* ----- cada cuadro ----- */

    update(tiempo, dms) {
      const dt = Math.min(dms, 100) / 1000;
      const t = tiempo / 1000;
      this.animarMundo(t, dt);

      this.pasoCamara();
      const cam = this.cameras.main;
      if (!this.empezado) {
        // paneo lento detrás de la pantalla de inicio
        if (!this.quieto) cam.centerOn(M.ANCHO / 2 + Math.sin(t * 0.05) * M.ANCHO * 0.28, M.ALTO / 2 + Math.cos(t * 0.037) * M.ALTO * 0.3);
        else cam.centerOn(M.ESTACIONES[1].x - 300, M.ESTACIONES[1].y);
        this.dibujarEstaciones(t);
        return;
      }

      // movimiento
      let vx = 0, vy = 0, mov = false;
      if (!GU.pausado() && this.enMinijuego < 0) {
        const e = GU.entrada();
        const hayEntrada = e.x !== 0 || e.y !== 0;
        if (this.auto && hayEntrada && !this.auto.ignorarEntrada) { this.auto = null; this.toque.setVisible(false); }
        if (this.auto) {
          const v = this.pasoAuto(dt); vx = v.vx; vy = v.vy; mov = Math.hypot(vx, vy) > 0.01;
        } else if (hayEntrada) {
          this.objetivo = null; this.toque.setVisible(false);
          const x0 = this.ax, y0 = this.ay;
          this.moverConColision(e.x * VELOCIDAD * dt, e.y * VELOCIDAD * dt);
          vx = this.ax - x0; vy = this.ay - y0; mov = Math.hypot(vx, vy) > 0.01;
          if (!mov) { vx = e.x; vy = e.y; }
        } else if (this.objetivo) {
          const o = this.objetivo;
          const dx = o.x - this.ax, dy = o.y - this.ay, d = Math.hypot(dx, dy);
          if (d < 6) { this.objetivo = null; this.toque.setVisible(false); }
          else {
            const paso = Math.min(d, VELOCIDAD * dt);
            const x0 = this.ax, y0 = this.ay;
            this.moverConColision(dx / d * paso, dy / d * paso);
            vx = this.ax - x0; vy = this.ay - y0; mov = Math.hypot(vx, vy) > 0.01;
            // si se atasca (árbol, río), se rinde sin drama
            o.t += dt;
            if (o.t > 0.6) { if (o.ultimo - d < 20) { this.objetivo = null; this.toque.setVisible(false); } o.ultimo = d; o.t = 0; }
          }
        }
      }

      // orientación y animación del avatar
      if (Math.abs(vx) + Math.abs(vy) > 0.001) {
        if (Math.abs(vx) > Math.abs(vy) * 0.9) { this.dir = 's'; this.voltear = vx < 0; }
        else this.dir = vy < 0 ? 'u' : 'd';
      }
      const silla = GU.avatar().id === 'silla';
      let cuadro = 0, bote = 0;
      if (mov) {
        this.tAnim += dt;
        cuadro = silla ? Math.floor(this.tAnim * 10) % 3 : 1 + (Math.floor(this.tAnim * 7) % 2);
        if (!silla && !this.quieto) bote = Math.abs(Math.sin(this.tAnim * 14)) * 3;
        this.tPaso += dt;
        if (this.tPaso >= 0.35) { this.tPaso = 0; GU.paso(); }
      } else this.tPaso = 0.3;
      const clave = `av-${this.dir}-${cuadro}${this.suf}`;
      if (this.avatar.texture.key !== clave) this.avatar.setTexture(clave);
      this.avatar.setFlipX(this.dir === 's' && this.voltear);
      const fa = 1 + (this.fMapa - 1) * 0.8;
      this.avatar.setScale(ESC_PJ * fa / R);
      this.avatar.setPosition(this.ax, this.ay - bote).setDepth(this.ay);
      this.avSombra.setPosition(this.ax, this.ay).setScale(0.95 * ESC_PJ * fa / R);

      // estaciones cercanas
      let cerca = -1, zona = 0, dz = Infinity, dc = Infinity;
      M.ESTACIONES.forEach((m, i) => {
        const d = Math.hypot(this.ax - m.x, this.ay - m.y);
        if (d < dz) { dz = d; zona = i; }
        if (d < DIST_CHARLA && d < dc) { dc = d; cerca = i; }
      });
      GU.zona(zona);
      // semillas: en modo libre se recogen al pasar encima
      if (cfg.control === 'libre' && !GU.pausado()) {
        this.semillas.forEach(se => { if (se.viva && Math.hypot(this.ax - se.x, this.ay - se.y) < DIST_SEMILLA) GU.recoger(se.i); });
      }
      if (this.enMinijuego >= 0) GU.cerca(-1);
      else if (cerca >= 0 && cfg.control === 'libre' && this.minijuegoPendiente(cerca)) { GU.cerca(-1); this.llegarA(cerca); }
      else if (!this.auto || this.auto.estacion === cerca || !this.auto.ignorarEntrada) GU.cerca(cerca);
      else GU.cerca(-1);

      this.dibujarEstaciones(t);
      this.actualizarFlecha(t);
    }

    // Personajes, anillo de la próxima estación, chulos y escala para «ver todo».
    dibujarEstaciones(t) {
      const objetivoF = this.modoPreferido === 'todo' && this.enCharla < 0 && this.empezado
        ? Phaser.Math.Clamp(0.55 / this.cameras.main.zoom, 1, 2.8) : 1;
      this.fMapa += (objetivoF - this.fMapa) * (this.quieto || objetivoF < this.fMapa ? 1 : 0.15);
      const f = this.fMapa;
      const sig = GU.siguiente();
      const anim = !this.quieto;
      this.est.forEach((st, i) => {
        let sy = 1, dy = 0, cuadro = 0;
        if (anim) {
          sy = 1 + 0.035 * Math.sin(t * 2.4 + i * 1.7);
          if (st.id === 'rita') { const c = (t * 0.42 + 0.3) % 1; if (c < 0.16) { dy = -Math.sin((c / 0.16) * Math.PI) * 24; sy = 1.06; } }
          if (st.id === 'tita') { const c = (t * 0.45) % 1; cuadro = c > 0.5 && c < 0.72 ? 1 : 0; }
          if (st.id === 'tomas') sy = 1 + 0.025 * Math.sin(t * 1.6);
        }
        if (st.cuadro !== cuadro || st.pj.texture.key.endsWith('-hc') !== this.hc) { st.pj.setTexture(`pj-${st.id}-${cuadro}${this.suf}`); st.cuadro = cuadro; }
        const e = ESC_PJ * f / R;
        st.pj.setScale(e, e * sy).setPosition(st.px, st.py + dy);
        st.sombra.setScale((st.p.w / 64) * 0.9 * ESC_PJ * f / R * (dy ? 0.8 : 1));
        st.letrero.setScale(Math.min(f, 2.6) / R);
        // al ver todo el mapa, letreros y personajes quedan por encima de los árboles
        const encima = f > 1.05 ? 4e5 : 0;
        st.letrero.setDepth(st.letrero.y + encima); st.pj.setDepth(st.py + encima);
        const proxima = i === sig;
        st.anillo.setVisible(proxima);
        st.marcador.setVisible(proxima && this.enCharla !== i);
        if (proxima) {
          const pul = anim ? Math.sin(t * 4) : 0;
          st.anillo.setScale((1 + 0.07 * pul) / R).setAlpha(0.8 + 0.2 * pul);
          const alto = st.p.h * ESC_PJ * f;
          st.marcador.setPosition(st.px, st.py - alto - 6 - (anim ? Math.abs(Math.sin(t * 3)) * 12 : 0)).setScale(Math.min(f, 2) / R);
        }
        const hecho = GU.completada(i);
        st.chulo.setVisible(hecho);
        if (hecho) st.chulo.setPosition(st.px + st.p.w * 0.38 * f, st.py - st.p.h * ESC_PJ * f).setScale(Math.min(f, 2) / R);
      });
      this.semillas.forEach(se => {
        if (!se.viva) return;
        const b = anim ? Math.sin(t * 3 + se.i) * 4 : 0;
        se.o.setPosition(se.x, se.y + b).setScale(0.85 * Math.min(f, 2) / R);
        se.brillo.setAlpha(anim ? Math.max(0, Math.sin(t * 2.2 + se.i * 2)) : 0.8).setAngle(anim ? t * 60 : 0);
      });
    }

    actualizarFlecha(t) {
      const sig = GU.siguiente();
      if (sig < 0 || this.modoPreferido === 'todo' || this.enCharla >= 0 || !this.empezado) { this.flechaVisible(false); return; }
      const cam = this.cameras.main, wv = cam.worldView;
      const st = this.est[sig];
      const sx = (st.m.x - wv.x) * cam.zoom, sy = (st.m.y - 40 - wv.y) * cam.zoom;
      const { width: w, height: h } = this.scale;
      // márgenes: debajo de la barra de arriba y encima de los controles de abajo
      const arriba = 118, abajo = h - 150, izq = 56, der = w - 56;
      if (sx > 20 && sx < w - 20 && sy > 60 && sy < h - 60) { this.flechaVisible(false); return; }
      if (this.sigFlecha !== sig) {
        this.sigFlecha = sig;
        this.flechaBurbuja.setTexture(`burbuja-${sig}${this.suf}`);
        const p = PJ[st.id];
        this.flechaPj.setTexture(`pj-${st.id}-0${this.suf}`).setScale(Math.min(52 / p.w, 52 / p.h) * 1 / R * 1.05);
      }
      const borde = arr => {
        const cx = w / 2, cy = (arr + abajo) / 2;
        const dx = sx - cx, dy = sy - cy;
        let k = Infinity;
        if (dx > 0) k = Math.min(k, (der - cx) / dx);
        if (dx < 0) k = Math.min(k, (izq - cx) / dx);
        if (dy > 0) k = Math.min(k, (abajo - cy) / dy);
        if (dy < 0) k = Math.min(k, (arr - cy) / dy);
        return { px: cx + dx * k, py: cy + dy * k, dx, dy };
      };
      let q = borde(arriba);
      // arriba a la izquierda está el botón «Ver todo el mapa»: ahí la flecha baja un poco
      const bajoBoton = (this.bordeHerramientas || 120) + 46;
      if (q.px < 340 && q.py < bajoBoton) q = borde(bajoBoton);
      const { px, py, dx, dy } = q;
      const ang = Math.atan2(dy, dx);
      const pul = this.quieto ? 0 : Math.sin(t * 5) * 5;
      this.flechaVisible(true);
      this.flechaBurbuja.setPosition(px, py);
      this.flechaPj.setPosition(px, py + 2);
      this.flechaPunta.setPosition(px + Math.cos(ang) * (44 + pul), py + Math.sin(ang) * (44 + pul)).setRotation(ang);
    }

    // Lo decorativo que se mueve: hierba, agua, nubes, pájaros, humo, niebla.
    animarMundo(t, dt) {
      const anim = !this.quieto;
      if (!this._cuentaRecorte || t - this._cuentaRecorte > 0.15) { this._cuentaRecorte = t; this.recortar(); }
      if (!this._cuentaBorde || t - this._cuentaBorde > 1) { this._cuentaBorde = t; if (this.empezado) this.bordeHerramientas = ubicarHerramientas(); }
      if (anim) {
        this.mecen.forEach(m => {
          if (!m.o.visible) return;
          if (m.animal) { m.o.y = m.y0 + Math.sin(t * 1.3 + m.f) * 0.8; return; }
          const rafaga = 0.6 + 0.4 * Math.sin(t * 0.5 + m.o.x / 500);
          m.o.rotation = Math.sin(t * 1.8 + m.f + m.o.x / 180) * m.amp * rafaga;
        });
      }
      // agua: ondas que viajan con la corriente
      this.ondas.forEach(w => {
        if (anim) w.s += w.vel * dt;
        const n = w.curso.length - 2;
        if (w.s >= n) w.s -= n;
        const i = Math.floor(w.s), u = w.s - i;
        const a = w.curso[i], b = w.curso[i + 1];
        const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        w.o.setPosition(x - Math.sin(ang) * w.lado, y + Math.cos(ang) * w.lado).setRotation(ang);
        w.o.setAlpha(anim ? 0.25 + 0.6 * Math.abs(Math.sin(w.s * 0.35 + w.fase * 6)) : 0.5);
      });
      const L = M.LAGUNA;
      this.brillos.forEach(b => {
        const k = b.getData('k');
        const c = anim ? (t * 0.3 + k * 0.2) % 1 : 0.5;
        if (c < 0.02 || !b.getData('x')) { b.setData('x', L.x + (Math.random() - 0.5) * L.rx * 1.3); b.setData('y', L.y + (Math.random() - 0.5) * L.ry * 1.1); }
        b.setPosition(b.getData('x'), b.getData('y')).setAlpha(Math.sin(c * Math.PI) * 0.9).setScale((0.4 + Math.sin(c * Math.PI) * 0.5) / R);
      });
      if (this.hc) return;
      this.nubes.forEach(nb => {
        if (anim) nb.x += nb.vel * dt;
        if (nb.x > M.ANCHO + 400) nb.x = -400;
        nb.nube.setPosition(nb.x, nb.y);
        nb.sombra.setPosition(nb.x + 160, nb.y + 300);
      });
      this.pajaros.forEach(p => {
        const x = ((t * p.vel + p.desf) % (M.ANCHO + 600)) - 300;
        const y = p.base + Math.sin(t * 0.4 + p.desf) * 120;
        p.o.setPosition(x, y).setTexture(`pajaro-${anim ? Math.floor(t * 6 + p.desf) % 2 : 0}`);
        p.sombra.setPosition(x + 60, y + 150);
      });
      this.humo.forEach(h => {
        const k = h.getData('k');
        const c = anim ? (t * 0.25 + k / 4) % 1 : 0.3;
        h.setPosition(M.CASA.x + 66 + c * 30 + Math.sin(c * 6 + k) * 6, M.CASA.y - 210 - c * 90).setScale((0.5 + c * 1.1) / R).setAlpha(0.7 * (1 - c));
      });
      this.nieblas.forEach(n => {
        n.o.setPosition(n.x + (anim ? Math.sin(t * 0.08 + n.desf) * 160 : 0), n.y);
      });
    }
  }

  /* ---------- conexión con la capa común ---------- */

  GU.on('config', c => { cfg = c; if (escena) escena.aplicarConfig(); });
  GU.on('empezar', c => {
    cfg = c;
    if (perfil) DATOS.guardarApariencia(apariencia()).catch(() => {});
    if (escena) escena.empezar(); else empezarPendiente = true;
  });
  GU.on('avanzar', i => escena && escena.avanzar(i));
  GU.on('conversacion', d => escena && escena.conversacion(d));
  GU.on('recogida', i => escena && escena.semillaRecogida(i));
  GU.on('final', d => {
    if (escena) escena.alFinal();
    // el perfil guarda la partida: estrellas, semillas y el diploma de guardián
    if (perfil) DATOS.registrarPartida('ancestros', { puntos: d.puntos, maximo: d.maximo, diploma: true, semillas: GU.estado.semillas.size, nivel: GU.config.nivel, minijuegos: resultadosMinijuegos }).catch(() => {});
  });

  GU.montar(perfil
    ? { nombre: 'Mapa desde arriba', jugador: true, editarAvatar: '../index.html#avatar' }
    : { nombre: 'Mapa desde arriba' });

  // Se espera un momento a la fuente de los letreros (si no hay internet, se usa la del sistema).
  const fuente = document.fonts && document.fonts.load ? document.fonts.load('800 23px "Baloo 2"').catch(() => {}) : Promise.resolve();
  Promise.race([fuente, new Promise(r => setTimeout(r, 1500))]).then(() => {
    const juego = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'mundo',
      backgroundColor: '#e3d4ad',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      render: { antialias: true, powerPreference: 'default' },
      input: { keyboard: false, gamepad: false },
      audio: { noAudio: true },
      banner: false,
      scene: EscenaMapa,
    });
    // Al girar el celular o entrar y salir de pantalla completa, el navegador avisa el cambio de
    // tamaño antes de terminar de acomodarse y el mapa quedaba mal repartido hasta recargar.
    // Se vuelve a medir varias veces mientras se acomoda.
    let relojes = [];
    const remedir = () => {
      relojes.forEach(clearTimeout);
      relojes = [60, 250, 600, 1200].map(ms => setTimeout(() => { juego.scale.refresh(); ubicarHerramientas(); }, ms));
    };
    window.addEventListener('orientationchange', remedir);
    if (screen.orientation) screen.orientation.addEventListener('change', remedir);
    document.addEventListener('fullscreenchange', remedir);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', remedir);
    window.addEventListener('pageshow', remedir);
    remedir();
  });
})();
