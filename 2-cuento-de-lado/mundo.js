/*
 * Guardianes de Usme · Prototipo 2: «Cuento de lado»
 *
 * Mundo en 2D con desplazamiento lateral y paralaje, hecho con Phaser 3.
 * El recorrido va de izquierda a derecha y sube poco a poco del valle al páramo.
 * Este archivo solo dibuja y mueve: la capa común (comun/juego.js) se encarga de
 * la pantalla de inicio, las conversaciones, las preguntas y el puntaje.
 *
 * Capas, de atrás hacia adelante (entre paréntesis, cuánto se mueven con la cámara):
 *   cielo (0) · nubes (0,06) · montañas lejanas (0,12) · montañas (0,25)
 *   colinas (0,45) · prado con árboles (0,72) · camino y personajes (1)
 *   plantas de primer plano (1,3) · niebla
 *
 * Coordenadas: x crece hacia la derecha; y hacia abajo (como en Phaser).
 * Las capas de fondo no se mueven en vertical: su «0» siempre es la línea del
 * suelo en pantalla, así nunca queda un hueco aunque el camino suba o baje.
 *
 * Rendimiento: el lienzo de Phaser (modo RESIZE) usa píxeles CSS, sin multiplicar
 * por la densidad de la pantalla: en celulares de alta densidad dibuja 4 veces
 * menos píxeles. Todo se dibuja una sola vez en texturas al cargar.
 */
(function () {
  const D = window.GU_DIBUJOS;
  const C = D.color;
  const E = GU.estaciones;

  GU.montar({ nombre: 'Prototipo 2 · Cuento de lado' });

  /* ---------- el recorrido ---------- */

  const SX = [900, 2400, 3900, 5400, 6900, 8400];       // dónde está cada personaje
  const ANCHO = 9300;
  const PLANO = [[420, 420], [680, 620], [420, 480], [460, 420], [420, 440], [420, 600]]; // tramo plano antes/después
  const SUBIDA = 44;                                     // cuánto sube el camino entre estaciones
  const SUELO = 600;
  const CANALES = [
    { x0: SX[1] - 480, x1: SX[1] - 260, prof: 74, tipo: 'rio' },
    { x0: SX[3] - 430, x1: SX[3] - 280, prof: 52, tipo: 'quebrada' },
  ];
  const DIST_CHARLA = 230;      // a esta distancia del personaje empieza la conversación
  const PARADA = 150;           // donde se detiene al caminar solo
  const VEL = 270, VEL_SOLO = 400;

  // Colores de cada estación; entre una y otra se mezclan suavemente
  const PALETAS = [
    { cieloA: '#6fb1e3', cieloB: '#fde7bd', lejos: '#9db6d6', monte: '#7fa6a8', colina: '#8fc06a', prado: '#7db35a', pasto: '#79b04e', frente: '#689f45', camino: '#e2c08c' },
    { cieloA: '#73b5e0', cieloB: '#e6f2dc', lejos: '#97b4d0', monte: '#6f9ea6', colina: '#7cb877', prado: '#72ad5e', pasto: '#6aab55', frente: '#5a984b', camino: '#d9bc8e' },
    { cieloA: '#7fb2dc', cieloB: '#fbdca6', lejos: '#a4b4cf', monte: '#8aa39a', colina: '#a9bb68', prado: '#9bb35a', pasto: '#98ae52', frente: '#859d47', camino: '#e0b880' },
    { cieloA: '#86b2cc', cieloB: '#e2ead6', lejos: '#94abc4', monte: '#5f8f80', colina: '#5d9a5c', prado: '#4f8d4c', pasto: '#4e8f45', frente: '#417e3b', camino: '#c4a272' },
    { cieloA: '#68ade0', cieloB: '#fde4a4', lejos: '#9fb3d2', monte: '#7fa292', colina: '#9cbc5e', prado: '#8bb052', pasto: '#86ab4a', frente: '#74993f', camino: '#d9b47a' },
    { cieloA: '#97b0c8', cieloB: '#ece8dc', lejos: '#8797b5', monte: '#7d8f99', colina: '#ada96e', prado: '#a3a462', pasto: '#a9a85e', frente: '#929351', camino: '#c4ab84' },
  ];

  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const suave = t => { t = lim(t, 0, 1); return t * t * (3 - 2 * t); };

  // Altura del camino (donde pisan los personajes)
  function caminoY(x) {
    let y = SUELO;
    for (let i = 0; i < SX.length - 1; i++) {
      const a = SX[i] + PLANO[i][1], b = SX[i + 1] - PLANO[i + 1][0];
      y -= SUBIDA * suave((x - a) / (b - a));
    }
    // ondulaciones suaves lejos de las estaciones
    let d = Infinity;
    for (const s of SX) d = Math.min(d, Math.abs(x - s));
    const k = suave((d - 380) / 260);
    return y + k * (5 * Math.sin(x / 170) + 3 * Math.sin(x / 61 + 1));
  }
  // Altura del terreno: igual al camino salvo en el río y la quebrada
  function terrenoY(x) {
    let y = caminoY(x);
    for (const c of CANALES) {
      if (x > c.x0 && x < c.x1) y += c.prof * Math.pow(Math.sin(Math.PI * (x - c.x0) / (c.x1 - c.x0)), 0.6);
    }
    return y;
  }
  const enCanal = x => CANALES.some(c => x > c.x0 + 4 && x < c.x1 - 4);

  // Mezcla de estaciones en la posición x del mundo
  function mezcla(x) {
    const s = lim((x - SX[0]) / (SX[1] - SX[0]), 0, SX.length - 1);
    const k = Math.min(SX.length - 2, Math.floor(s));
    return { k, t: suave((s - k - 0.25) / 0.5) };
  }
  function colorEn(x, campo) {
    const { k, t } = mezcla(x);
    return C.mezclar(PALETAS[k][campo], PALETAS[k + 1][campo], t);
  }
  // Peso de una estación en x (1 en la estación, 0 lejos): para elegir decorado
  function peso(x, i) {
    const { k, t } = mezcla(x);
    return k === i ? 1 - t : k + 1 === i ? t : 0;
  }
  function estacionEn(x, r) {
    const { k, t } = mezcla(x);
    return r < t ? k + 1 : k;
  }
  const masCercana = x => SX.reduce((m, s, i) => Math.abs(x - s) < Math.abs(x - SX[m]) ? i : m, 0);

  /* ---------- la escena ---------- */

  class Escena extends Phaser.Scene {
    constructor() { super('cuento'); }

    create() {
      this.cfg = GU.config;
      this.reloj = 0;
      window.__cuento = this;   // para las pruebas automáticas
      this.t =D.crearTexturas(this, E, GU.personajes);
      D.contraste = !!this.cfg.contraste;
      if (D.contraste) D.redibujar(true);
      this.contrasteActual = D.contraste;

      this.capas = [];
      this.crearCielo();
      this.crearFondo();
      this.crearPrado();
      this.crearSuelo();
      this.crearEstaciones();
      this.crearDecorado();
      this.crearPrimerPlano();
      this.crearVida();

      // cámara
      this.cam = this.cameras.main;
      this.z = this.zoomBase(); this.f = this.fraccionBase();
      this.camX = 700; this.sueloSuave = caminoY(700);
      this.conv = -1;
      this.avatar = null;
      this.auto = null;
      this.toque = null;

      this.instalarEntrada();
      this.aplicarConfig(this.cfg);
      this.scale.on('resize', () => { this.z = this.zoomBase(); });

      GU.on('empezar', () => this.empezar());
      GU.on('config', c => this.aplicarConfig(c));
      GU.on('avanzar', i => this.caminarA(i));
      GU.on('conversacion', ({ indice, abierta }) => {
        this.conv = abierta ? indice : -1;
        if (abierta && this.avatar) { this.auto = null; this.avatar.mira = SX[indice] < this.avatar.x ? -1 : 1; }
      });
      GU.on('recogida', i => this.animarSemilla(i));

      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.letreros.forEach(l => l.texto.updateText()));
      this.game.canvas.setAttribute('aria-hidden', 'true');
      this.game.canvas.setAttribute('tabindex', '-1');
    }

    /* ---------- tamaños de pantalla ---------- */

    vertical() { return this.scale.height > this.scale.width * 1.05; }
    zoomBase() {
      const w = this.scale.width, h = this.scale.height;
      // en vertical se acerca más para que el avatar y el personaje no queden diminutos
      let z = this.vertical() ? Math.min(h / 600, w / 390) : h / 600;
      z = Math.max(z, w / 2200);
      return lim(z, 0.42, 2.4);
    }
    fraccionBase() { return this.vertical() ? 0.62 : 0.7; }

    /* ---------- cielo ---------- */

    crearCielo() {
      PALETAS.forEach((p, k) => {
        const tex = this.textures.createCanvas('cielo-' + k, 8, 512);
        const c = tex.getContext();
        const g = c.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0, p.cieloA);
        g.addColorStop(0.45, C.mezclar(p.cieloA, p.cieloB, 0.5));
        g.addColorStop(0.74, p.cieloB);
        g.addColorStop(1, C.tono(p.cieloB, 0.2));
        c.fillStyle = g; c.fillRect(0, 0, 8, 512);
        tex.refresh();
      });
      this.cieloA = this.add.image(0, 0, 'cielo-0').setOrigin(0).setScrollFactor(0).setDepth(-100);
      this.cieloB = this.add.image(0, 0, 'cielo-1').setOrigin(0).setScrollFactor(0).setDepth(-99).setAlpha(0);
      // sol con resplandor
      const tex = this.textures.createCanvas('sol', 260, 260), c = tex.getContext();
      const g = c.createRadialGradient(130, 130, 10, 130, 130, 130);
      g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.2, 'rgba(255,240,190,.95)');
      g.addColorStop(0.24, 'rgba(255,236,170,.45)'); g.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = g; c.fillRect(0, 0, 260, 260); tex.refresh();
      this.sol = this.add.image(0, 0, 'sol').setScrollFactor(0).setDepth(-98);
    }

    /* ---------- montañas y colinas (texturas largas por trozos) ---------- */

    // Crea una capa de fondo dibujada en un lienzo, partida en trozos de ≤ 2048 px
    capaLienzo(nombre, sf, res, arriba, dibujar, prof, abajo = 16) {
      const L0 = -1300, L1 = ANCHO * sf + 1300, alto = arriba + abajo;
      const cont = this.add.container(0, 0).setScrollFactor(sf, 0).setDepth(prof);
      const maxW = Math.floor(2000 / res);
      for (let x0 = L0; x0 < L1; x0 += maxW) {
        const x1 = Math.min(L1, x0 + maxW), w = x1 - x0, clave = `${nombre}-${x0}`;
        const tex = this.textures.createCanvas(clave, Math.ceil(w * res), Math.ceil(alto * res));
        const ctx = tex.getContext();
        ctx.scale(res, res); ctx.translate(-x0, arriba);
        dibujar(ctx, x0, x1);
        tex.refresh();
        cont.add(this.add.image(x0, -arriba, clave).setOrigin(0, 0).setScale(1 / res));
      }
      this.capas.push({ cont, sf, tipo: 'suelo' });
      return cont;
    }

    crearFondo() {
      const degradado = (...a) => this.degradado(...a);
      function silueta(ctx, x0, x1, alt, paso = 6) {
        ctx.beginPath(); ctx.moveTo(x0 - 10, 20);
        for (let L = x0 - 10; L <= x1 + 10; L += paso) ctx.lineTo(L, alt(L));
        ctx.lineTo(x1 + 10, 20); ctx.closePath();
      }
      // bruma: hacia abajo la montaña se funde con el color del horizonte
      function bruma(ctx, x0, x1, sf, arriba, fuerza) {
        for (let L = x0; L < x1; L += 100) {
          const col = C.rgb(colorEn(L / sf, 'cieloB'));
          const g = ctx.createLinearGradient(0, -arriba, 0, 0);
          g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${fuerza})`);
          ctx.fillStyle = g; ctx.fillRect(L, -arriba, 100, arriba + 20);
        }
      }
      function picos(sf, semilla, alto, ancho, escala) {
        const r = D.azar(semilla), lista = [];
        for (let L = -1800; L < ANCHO * sf + 1800; L += ancho * (0.55 + r() * 0.6)) {
          lista.push({ x: L, h: alto * (0.55 + r() * 0.5) * escala(L / sf), w: ancho * (0.8 + r() * 0.7) });
        }
        return lista;
      }
      const bump = u => Math.abs(u) >= 1 ? 0 : Math.pow((Math.cos(Math.PI * u) + 1) / 2, 0.85);
      const altura = (lista, L) => { let m = 0; for (const p of lista) { const v = p.h * bump((L - p.x) / p.w); if (v > m) m = v; } return m; };
      function sombrear(ctx, lista, x0, x1, base, col) {
        ctx.fillStyle = col;
        for (const p of lista) {
          if (p.x < x0 - 400 || p.x > x1 + 400) continue;
          // ladera en sombra: sigue la curva del pico por la derecha, solo dentro de su propio pico
          ctx.save();
          ctx.beginPath(); ctx.moveTo(p.x - p.w, base + 10);
          for (let u = -1; u <= 1.001; u += 0.1) ctx.lineTo(p.x + u * p.w, base - p.h * bump(u));
          ctx.lineTo(p.x + p.w, base + 10); ctx.closePath(); ctx.clip();
          ctx.beginPath();
          for (let u = 0; u <= 1.001; u += 0.1) ctx.lineTo(p.x + u * p.w, base - p.h * bump(u) + 1);
          ctx.lineTo(p.x + p.w * 0.3, base + 10);
          ctx.quadraticCurveTo(p.x + p.w * 0.04, base - p.h * 0.45, p.x, base - p.h + 1);
          ctx.fill();
          ctx.restore();
        }
      }

      // Montañas lejanas: crecen hacia el final, son las del Sumapaz
      const sfL = 0.12;
      const escalaL = X => 1 + 0.45 * suave((X - 4200) / 4000);
      const picosL = picos(sfL, 11, 210, 230, escalaL);
      const altL = L => -150 - Math.max(50 + 18 * Math.sin(L / 90), altura(picosL, L));
      this.capaLienzo('lejos', sfL, 0.5, 470, (ctx, x0, x1) => {
        silueta(ctx, x0, x1, altL);
        ctx.fillStyle = degradado(ctx, x0, x1, sfL, 'lejos'); ctx.fill();
        ctx.save(); silueta(ctx, x0, x1, altL); ctx.clip();
        bruma(ctx, x0, x1, sfL, 300, 0.75);
        ctx.restore();
      }, -90);

      // Montañas cercanas con bosque en la cresta
      const sfM = 0.25;
      const picosM = picos(sfM, 23, 130, 170, X => 1 + 0.3 * suave((X - 5000) / 3000));
      const altM = L => -110 - Math.max(40 + 14 * Math.sin(L / 70 + 2), altura(picosM, L));
      this.capaLienzo('montes', sfM, 0.6, 320, (ctx, x0, x1) => {
        silueta(ctx, x0, x1, altM);
        ctx.fillStyle = degradado(ctx, x0, x1, sfM, 'monte'); ctx.fill();
        ctx.save(); silueta(ctx, x0, x1, altM); ctx.clip();
        sombrear(ctx, picosM, x0, x1, -110, 'rgba(20,50,40,.08)');
        // arbolitos en la cresta
        const r = D.azar(Math.floor(x0) + 5);
        for (let L = x0 - 10; L < x1 + 10; L += 4 + r() * 5) {
          const X = L / sfM, y = altM(L), bosque = 0.35 + peso(X, 3) * 0.6 + peso(X, 1) * 0.2 - peso(X, 5) * 0.3;
          if (r() > bosque) continue;
          ctx.fillStyle = C.tono(colorEn(X, 'monte'), -0.05 - r() * 0.07);
          ctx.beginPath(); ctx.arc(L, y + 3 + r() * 9, 3.5 + r() * 3.5, 0, Math.PI * 2); ctx.fill();
        }
        bruma(ctx, x0, x1, sfM, 200, 0.5);
        ctx.restore();
      }, -80);

      // Colinas con potreros, bosque o páramo según el tramo
      const sfC = 0.45;
      const altC = L => -70 - (46 + 26 * Math.sin(L / 260 + 1) + 16 * Math.sin(L / 113) + 8 * Math.sin(L / 57 + 2));
      this.capaLienzo('colinas', sfC, 0.8, 190, (ctx, x0, x1) => {
        silueta(ctx, x0, x1, altC, 5);
        ctx.fillStyle = degradado(ctx, x0, x1, sfC, 'colina'); ctx.fill();
        ctx.save(); silueta(ctx, x0, x1, altC, 5); ctx.clip();
        const r = D.azar(Math.floor(x0) + 77);
        // potreros: parches de colores con cercas vivas
        for (let L = x0 - 80; L < x1 + 80; L += 50 + r() * 50) {
          const X = L / sfC, campo = peso(X, 0) + peso(X, 1) * 0.8 + peso(X, 2) * 0.9 + peso(X, 4);
          if (r() > campo) continue;
          const y = altC(L) + 8 + r() * 30, w = 50 + r() * 60, h = 16 + r() * 22, sesgo = (r() - 0.5) * 20;
          const base = colorEn(X, 'colina');
          const tonos = [C.tono(base, 0.12), C.tono(base, -0.1), C.mezclar(base, '#d8c27a', 0.45), C.mezclar(base, '#c79a5a', 0.3)];
          ctx.fillStyle = tonos[Math.floor(r() * tonos.length)];
          ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + w, y + sesgo * 0.3); ctx.lineTo(L + w + sesgo, y + h); ctx.lineTo(L + sesgo, y + h + sesgo * 0.2); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = C.tono(base, -0.25); ctx.lineWidth = 1.4; ctx.stroke();
          // casita campesina de vez en cuando
          if (r() < 0.12) {
            const cx = L + w * 0.5, cy = y + 4;
            ctx.fillStyle = '#f6f1e6'; ctx.fillRect(cx - 6, cy - 6, 12, 7);
            ctx.fillStyle = '#b5502e'; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 5); ctx.lineTo(cx, cy - 11); ctx.lineTo(cx + 8, cy - 5); ctx.fill();
          }
        }
        // bosque altoandino: manchas oscuras
        for (let L = x0 - 30; L < x1 + 30; L += 10 + r() * 10) {
          const X = L / sfC, bosque = peso(X, 3) * 0.9 + peso(X, 2) * 0.15 + peso(X, 1) * 0.15;
          if (r() > bosque) continue;
          ctx.fillStyle = C.tono(colorEn(X, 'colina'), -0.15 - r() * 0.15);
          ctx.beginPath(); ctx.arc(L, altC(L) + 8 + r() * 40, 8 + r() * 7, 0, Math.PI * 2); ctx.fill();
        }
        // páramo: frailejones lejanos
        for (let L = x0; L < x1; L += 6 + r() * 10) {
          const X = L / sfC;
          if (r() > peso(X, 5) * 0.8) continue;
          const y = altC(L) + 6 + r() * 50;
          ctx.fillStyle = '#6d5f4a'; ctx.fillRect(L - 0.8, y - 7, 1.6, 7);
          ctx.fillStyle = '#b9c2a0'; ctx.beginPath(); ctx.arc(L, y - 8, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        bruma(ctx, x0, x1, sfC, 120, 0.25);
        ctx.restore();
      }, -70);

      // velo para alto contraste: el fondo pierde detalle y resaltan personajes y camino
      this.velo = this.add.rectangle(0, 0, 10, 10, 0xf4efe0, 0.55).setOrigin(0).setScrollFactor(0).setDepth(-55).setVisible(false);

      // nubes
      this.nubes = this.add.container(0, 0).setScrollFactor(0.06, 0).setDepth(-95);
      this.capas.push({ cont: this.nubes, sf: 0.06, tipo: 'suelo' });
      const r = D.azar(3);
      for (let L = -1300; L < ANCHO * 0.06 + 1300; L += 260 + r() * 260) {
        const t = this.t.nube[Math.floor(r() * 3)];
        const n = this.add.image(L, -330 - r() * 170, t.clave).setOrigin(0.5, t.oy).setScale((0.7 + r() * 0.6) / t.S);
        n.vel = 4 + r() * 6;
        this.nubes.add(n);
      }
      this.nubes.rango = [-1300, ANCHO * 0.06 + 1300];
    }

    /* ---------- prado de la capa media, con árboles ---------- */

    crearPrado() {
      const sf = 0.72;
      const tope = L => -46 + 7 * Math.sin(L / 230) + 4 * Math.sin(L / 97);
      this.prado = this.capaLienzo('prado', sf, 0.5, 70, (ctx, x0, x1) => {
        ctx.beginPath(); ctx.moveTo(x0 - 10, 200);
        for (let L = x0 - 10; L <= x1 + 10; L += 8) ctx.lineTo(L, tope(L));
        ctx.lineTo(x1 + 10, 200); ctx.closePath();
        ctx.fillStyle = this.degradado(ctx, x0, x1, sf, 'prado'); ctx.fill();
        // borde de arriba un poco más claro, como papel recortado
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,240,.18)'; ctx.lineWidth = 5;
        ctx.beginPath(); for (let L = x0 - 10; L <= x1 + 10; L += 8) ctx.lineTo(L, tope(L) + 1); ctx.stroke();
        ctx.restore();
      }, -60, 110);
      const L0 = -1300, L1 = ANCHO * sf + 1300;
      this.decoMedio = [];
      const r = D.azar(9);
      const elegir = (lista) => lista[Math.floor(r() * lista.length)];
      for (let L = L0; L < L1; L += 70 + r() * 110) {
        const X = L / sf, i = estacionEn(X, r());
        let t;
        if (i === 0) t = elegir([this.t.redondo[0], this.t.redondo[1], this.t.eucalipto, this.t.arbusto[0]]);
        else if (i === 1) t = elegir([this.t.juncos[0], this.t.juncos[1], this.t.arbusto[1], this.t.eucalipto, this.t.redondo[2]]);
        else if (i === 2) t = elegir([this.t.arbusto[1], this.t.arbusto[3], this.t.redondo[2], this.t.piedra[0]]);
        else if (i === 3) t = elegir([this.t.encenillo[0], this.t.encenillo[1], this.t.arbusto[2], this.t.encenillo[1]]);
        else if (i === 4) t = elegir([this.t.maiz[0], this.t.maiz[1], this.t.redondo[1], this.t.eucalipto, this.t.arbusto[0]]);
        else t = elegir([this.t.frailejon[0], this.t.frailejon[1], this.t.frailejon[3], this.t.pajonal[0], this.t.pajonal[1]]);
        const esc = 0.6 + r() * 0.2;
        const im = this.add.image(L, tope(L) + 6, t.clave).setOrigin(0.5, t.oy).setScale(esc / t.S);
        im.setTint(0xe6eef2);
        this.prado.add(im);
        this.decoMedio.push(im);
      }
    }

    // degradado horizontal con los colores de cada tramo (L en coordenadas de la capa)
    degradado(ctx, x0, x1, sf, campo, ajuste = 0) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      const n = Math.max(2, Math.ceil((x1 - x0) / 60));
      for (let k = 0; k <= n; k++) {
        const L = x0 + (x1 - x0) * k / n;
        g.addColorStop(k / n, C.tono(colorEn(L / sf, campo), ajuste));
      }
      return g;
    }

    /* ---------- suelo: pasto, camino y frente ---------- */

    crearSuelo() {
      // agua animada del río y la quebrada (detrás del suelo)
      this.aguas = [];
      for (const c of CANALES) {
        const key = 'agua-' + c.tipo;
        if (!this.textures.exists(key)) {
          const tex = this.textures.createCanvas(key, 128, 128), o = tex.getContext();
          const g = o.createLinearGradient(0, 0, 0, 128);
          g.addColorStop(0, c.tipo === 'rio' ? '#7cc0dd' : '#8fd0d8'); g.addColorStop(1, c.tipo === 'rio' ? '#3d7fa8' : '#4f9aa6');
          o.fillStyle = g; o.fillRect(0, 10, 128, 118);
          o.fillStyle = 'rgba(255,255,255,.75)';
          o.beginPath(); o.moveTo(0, 14);
          for (let x = 0; x <= 128; x += 4) o.lineTo(x, 10 + Math.sin(x / 128 * Math.PI * 4) * 3);
          o.lineTo(128, 16); o.lineTo(0, 16); o.fill();
          o.strokeStyle = 'rgba(255,255,255,.35)'; o.lineWidth = 2;
          for (let k = 0; k < 6; k++) { const y = 28 + k * 16, x = (k * 37) % 128; o.beginPath(); o.moveTo(x, y); o.lineTo(x + 26, y); o.stroke(); }
          tex.refresh();
        }
        const yAgua = caminoY((c.x0 + c.x1) / 2) + 16;
        const ts = this.add.tileSprite(c.x0 - 6, yAgua - 10, c.x1 - c.x0 + 12, c.prof + 30, key).setOrigin(0, 0).setDepth(95);
        this.aguas.push(ts);
      }
      // el humedal: agua quieta detrás del camino
      {
        const tex = this.textures.createCanvas('agua-humedal', 128, 64), o = tex.getContext();
        const g = o.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, '#a9d6e6'); g.addColorStop(1, '#5f9fc0');
        o.fillStyle = g; o.fillRect(0, 0, 128, 64);
        o.strokeStyle = 'rgba(255,255,255,.55)'; o.lineWidth = 2;
        [[10, 14, 30], [70, 26, 36], [30, 40, 24], [90, 52, 20]].forEach(([x, y, l]) => { o.beginPath(); o.moveTo(x, y); o.lineTo(x + l, y); o.stroke(); });
        tex.refresh();
        const x0 = SX[1] - 700, x1 = SX[1] + 640, y = caminoY(SX[1]);
        const hum = this.add.tileSprite(x0, y - 62, x1 - x0, 58, 'agua-humedal').setOrigin(0, 0).setDepth(96);
        this.aguas.push(hum);
        this.humedal = hum;
        // orillas redondeadas del humedal
        const tapa = this.add.graphics().setDepth(97);
        tapa.fillStyle(C.aNum(colorEn(x0, 'pasto')), 1);
        tapa.fillEllipse(x0, y - 33, 120, 70); tapa.fillEllipse(x1, y - 33, 120, 70);
      }
      // El suelo se dibuja en texturas por trozos: arriba nítido (pasto y camino)
      // y abajo, la pradera del frente, en baja resolución porque es solo color.
      this.trozosSuelo = [];
      for (let a = -200; a < ANCHO + 200; a += 1000) {
        const b = Math.min(ANCHO + 200, a + 1000);
        let yMin = Infinity, yMax = -Infinity;
        for (let x = a; x <= b; x += 5) { const t = terrenoY(x); yMin = Math.min(yMin, t, caminoY(x)); yMax = Math.max(yMax, t); }
        const trozo = { a, b, y0: Math.floor(yMin - 36), y1: Math.ceil(yMax + 126), clave: 'suelo-' + a };
        trozo.tex = this.textures.createCanvas(trozo.clave, b - a, trozo.y1 - trozo.y0);
        trozo.img = this.add.image(a, trozo.y0, trozo.clave).setOrigin(0, 0).setDepth(100);
        this.trozosSuelo.push(trozo);
      }
      const res = 0.3;
      for (let a = -200; a < ANCHO + 200; a += 2400) {
        const b = Math.min(ANCHO + 200, a + 2400);
        let yMin = Infinity;
        for (let x = a; x <= b; x += 10) yMin = Math.min(yMin, caminoY(x));
        const y0 = Math.floor(yMin + 96), y1 = y0 + 1100, clave = 'suelo-hondo-' + a;
        const tex = this.textures.createCanvas(clave, Math.ceil((b - a) * res), Math.ceil((y1 - y0) * res));
        const ctx = tex.getContext();
        ctx.scale(res, res); ctx.translate(-a, -y0);
        const banda = (dy, amp, per, ajuste) => {
          ctx.beginPath(); ctx.moveTo(a - 10, y1 + 10);
          for (let x = a - 10; x <= b + 10; x += 20) ctx.lineTo(x, Math.max(y0 - 10, caminoY(x) + dy + amp * Math.sin(x / per)));
          ctx.lineTo(b + 10, y1 + 10); ctx.closePath();
          ctx.fillStyle = this.degradado(ctx, a, b, 1, 'frente', ajuste); ctx.fill();
        };
        banda(-200, 0, 1, -0.05);
        banda(170, 10, 190, -0.13);
        banda(290, 10, 230, -0.2);
        banda(470, 14, 260, -0.26);
        tex.refresh();
        this.add.image(a, y0, clave).setOrigin(0, 0).setScale(1 / res).setDepth(99);
      }
      this.dibujarSuelo();
    }

    dibujarSuelo() {
      const contraste = D.contraste;
      const mata = x => { const m = ((x % 12) + 12) % 12; return (m < 6 ? m : 12 - m) * 1.3; };
      for (const t of this.trozosSuelo) {
        const { a, b, y0, y1 } = t, ctx = t.tex.getContext();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, b - a, y1 - y0);
        ctx.translate(-a, -y0);
        const franja = (arriba, paso, campo, ajuste) => {
          ctx.beginPath(); ctx.moveTo(a - 10, y1 + 10);
          for (let x = a - 10; x <= b + 10; x += paso) ctx.lineTo(x, arriba(x));
          ctx.lineTo(b + 10, y1 + 10); ctx.closePath();
          ctx.fillStyle = this.degradado(ctx, a, b, 1, campo, ajuste); ctx.fill();
        };
        // pasto detrás del camino, con matitas
        franja(x => terrenoY(x) - 13 - mata(x), 6, 'pasto', 0);
        // camino de tierra (no pasa por el agua: allí hay puente o piedras)
        const tramos = [];
        let ini = null;
        for (let x = a - 10; x <= b + 10; x += 10) {
          const agua = enCanal(x);
          if (!agua && ini === null) ini = x;
          if ((agua || x + 10 > b + 10) && ini !== null) { tramos.push([ini, agua ? x - 10 : x]); ini = null; }
        }
        ctx.fillStyle = this.degradado(ctx, a, b, 1, 'camino');
        for (const [p, q] of tramos) {
          ctx.beginPath();
          for (let x = p; x <= q; x += 10) ctx.lineTo(x, caminoY(x) - 5);
          for (let x = q; x >= p; x -= 10) ctx.lineTo(x, caminoY(x) + 14);
          ctx.closePath(); ctx.fill();
        }
        // piedritas del camino
        const r = D.azar(a + 1000);
        ctx.fillStyle = 'rgba(140,105,65,.45)';
        for (let x = a; x < b; x += 14 + r() * 30) {
          if (enCanal(x)) continue;
          ctx.beginPath(); ctx.ellipse(x, caminoY(x) + 2 + r() * 8, 1.5 + r() * 2, 1 + r() * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        // frente: pradera que baja hacia el borde de la pantalla
        franja(x => terrenoY(x) + 10, 10, 'frente', 0.04);
        ctx.strokeStyle = 'rgba(255,255,230,.22)'; ctx.lineWidth = 3;
        ctx.beginPath(); for (let x = a - 10; x <= b + 10; x += 10) ctx.lineTo(x, terrenoY(x) + 11.5); ctx.stroke();
        franja(x => caminoY(x) + 74 + 8 * Math.sin(x / 140), 20, 'frente', -0.05);
        // alto contraste: bordes oscuros gruesos a lado y lado del camino
        if (contraste) {
          ctx.strokeStyle = '#1d140d'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          for (const [p, q] of tramos) for (const borde of [-5, 14]) {
            ctx.beginPath();
            for (let x = p; x <= q; x += 10) ctx.lineTo(x, caminoY(x) + borde);
            ctx.stroke();
          }
        }
        t.tex.refresh();
      }
    }

    /* ---------- utilidades para poner figuras ---------- */

    img(x, y, t, prof, esc = 1, cuadro) {
      const im = this.add.image(x, y, t.clave, cuadro).setOrigin(0.5, t.oy).setScale(esc / t.S).setDepth(prof);
      return im;
    }
    spr(x, y, t, prof, esc = 1) {
      const s = this.add.sprite(x, y, t.clave, '0').setOrigin(0.5, t.oy).setScale(esc / t.S).setDepth(prof);
      s.escBase = esc / t.S;
      return s;
    }

    /* ---------- estaciones: personajes, letreros y semillas ---------- */

    crearEstaciones() {
      const t = this.t;
      this.pjs = [];
      this.letreros = [];
      this.semillas = [];
      const pj = (i, tex, x, y, esc, accion) => {
        const s = this.spr(x, y, tex, 200, esc);
        s.i = i; s.accion = accion; s.baseY = y;
        s.setInteractive({ useHandCursor: true, pixelPerfect: false });
        s.on('pointerdown', () => this.tocarPersonaje(i));
        this.pjs.push(s);
        return s;
      };
      // 1. Doña Rosa, junto al árbol grande y la casa
      pj(0, t.rosa, SX[0], caminoY(SX[0]) + 2, 1, 'respira');
      // 2. Tita, la tingua, entre los juncos
      pj(1, t.tita, SX[1], caminoY(SX[1]) + 2, 1.15, 'picotea');
      // 3. Julián, el arqueólogo
      pj(2, t.julian, SX[2], caminoY(SX[2]) + 2, 1, 'brocha');
      // 4. Rita, la rana, sobre una piedra con musgo
      this.img(SX[3], caminoY(SX[3]) + 4, t.roca, 190);
      pj(3, t.rita, SX[3] + 2, caminoY(SX[3]) - 31, 1.05, 'salta');
      // 5. Cuqui, el curí, sobre un montoncito de paja
      this.img(SX[4], caminoY(SX[4]) + 4, t.monticulo, 190, 1.1);
      pj(4, t.cuqui, SX[4], caminoY(SX[4]) - 4, 1.15, 'mordisquea');
      // 6. Tomás, el oso de anteojos
      pj(5, t.tomas, SX[5], caminoY(SX[5]) + 2, 1.05, 'saluda');

      // animaciones de quieto: respirar, parpadear y la acción de cada uno
      this.pjs.forEach(s => {
        s.tRespira = Math.random() * 6;
        s.proxParpadeo = 1 + Math.random() * 3;
        s.proxAccion = 2 + Math.random() * 3;
        s.finAccion = 0; s.finParpadeo = 0;
      });

      // letreros de madera con el nombre, el color y el chulo
      E.forEach((e, i) => {
        // el letrero va antes del personaje (en el humedal y la quebrada, antes del agua)
        const x = SX[i] - [330, 650, 330, 560, 330, 330][i], y = caminoY(x) - 8;
        const im = this.img(x, y, t.letrero[i], 140);
        const texto = this.add.text(x, y - 84, e.nombre, {
          fontFamily: '"Baloo 2", "Atkinson Hyperlegible", "Trebuchet MS", system-ui, sans-serif',
          fontSize: '21px', fontStyle: 'bold', color: '#fffaf0', align: 'center',
          stroke: '#5a3a20', strokeThickness: 4, wordWrap: { width: 186 }, lineSpacing: -6,
        }).setOrigin(0.5).setResolution(2).setDepth(141);
        if (texto.height > 56) texto.setScale(56 / texto.height);
        const ch = this.img(x + 98, y - 108, t.chulo, 142).setVisible(false);
        this.letreros.push({ im, texto, ch, x, y });
      });

      // señal de «aquí sigue»: brillo detrás del personaje y flecha que rebota
      this.brillo = this.add.image(0, 0, t.halo.clave).setOrigin(0.5, t.halo.oy).setDepth(150).setScale(3.2 / t.halo.S).setAlpha(0.6);
      this.flecha = this.add.image(0, 0, t.flecha[0].clave).setOrigin(0.5, t.flecha[0].oy).setDepth(250).setScale(1 / t.flecha[0].S);

      // semillas escondidas cerca de cada estación
      const lugares = [
        { dx: 70, alto: 196 },    // en una rama del árbol grande
        { dx: 300, alto: 14 },    // entre los juncos
        { dx: 440, alto: 14 },    // junto a una vasija
        { dx: 330, alto: 150 },   // en una rama con musgo
        { dx: -520, alto: 96 },   // entre las matas de maíz
        { dx: 330, alto: 16 },    // detrás de un frailejón
      ];
      lugares.forEach((l, i) => {
        const x = SX[i] + l.dx, y = caminoY(x) - l.alto;
        const halo = this.img(x, y + 26, t.halo, 158, 1.1).setAlpha(0);
        const s = this.img(x, y, t.semilla, 160, 1, String(i));
        s.setInteractive(new Phaser.Geom.Circle(t.semilla.fw * t.semilla.S / 2, (t.semilla.fh - 6 - 16) * t.semilla.S, 36 * t.semilla.S), Phaser.Geom.Circle.Contains);
        s.on('pointerdown', () => this.tocarSemilla(i));
        const burbuja = this.img(x, y - 34, t.burbuja, 330).setVisible(false);
        this.semillas.push({ i, x, y, s, halo, burbuja, recogida: false });
      });
    }

    /* ---------- decorado de cada estación y del camino ---------- */

    crearDecorado() {
      const t = this.t, Y = caminoY;
      const atras = (x, tex, esc = 1, dy = -8, prof = 120) => this.img(x, Y(x) + dy, tex, prof, esc);
      const frente = (x, tex, esc = 1, dy = 34, prof = 330) => this.img(x, terrenoY(x) + dy, tex, prof, esc);
      this.mecen = [];

      // 1. Entrada: casa campesina, cerca de madera y árbol grande
      atras(SX[0] - 470, t.casa, 1, -14, 110);
      atras(SX[0] - 250, t.eucalipto, 0.95, -16, 105);
      [SX[0] - 800, SX[0] - 680].forEach(x => atras(x, t.cerca, 1, -10, 112));
      [SX[0] + 230, SX[0] + 360, SX[0] + 490, SX[0] + 620].forEach(x => atras(x, t.cerca, 1, -10, 112));
      atras(SX[0] + 140, t.arbolGrande, 1, -12, 115);
      atras(SX[0] - 140, t.flores[0], 1, -6, 125);
      frente(SX[0] - 620, t.flores[2], 1, 40);
      frente(SX[0] + 300, t.hierba[0], 1, 30);
      // portada de madera al comienzo del camino
      {
        const g = this.add.graphics().setDepth(118), x = 300, y = Y(300) - 6;
        g.fillStyle(0x7a5236, 1);
        g.fillRoundedRect(x - 70, y - 150, 12, 150, 3); g.fillRoundedRect(x + 58, y - 150, 12, 150, 3);
        g.fillStyle(0x8a6240, 1); g.fillRoundedRect(x - 84, y - 162, 168, 18, 5);
        g.fillStyle(0xa9472b, 1); g.fillTriangle(x - 92, y - 160, x, y - 196, x + 92, y - 160);
        g.fillStyle(0xbd5a35, 1); g.fillTriangle(x - 80, y - 162, x, y - 190, x + 80, y - 162);
        this.add.text(x, y - 153, 'Parque Arqueológico', { fontFamily: '"Baloo 2", system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fffaf0' }).setOrigin(0.5).setResolution(2).setDepth(119);
      }

      // 2. Humedal: juncos, puente sobre el Tunjuelo
      const c0 = CANALES[0];
      this.img((c0.x0 + c0.x1) / 2, Y(c0.x0) + 8, t.puente, 280);
      [SX[1] - 640, SX[1] - 560, SX[1] - 160, SX[1] - 60, SX[1] + 90, SX[1] + 200, SX[1] + 420, SX[1] + 520].forEach((x, k) => atras(x, t.juncos[k % 3], 0.9 + (k % 3) * 0.12, -40, 98));
      [SX[1] - 100, SX[1] + 160, SX[1] + 560].forEach((x, k) => atras(x, t.juncos[(k + 1) % 3], 0.8, -6, 125));
      frente(c0.x0 - 40, t.juncos[2], 0.9, 30);
      frente(c0.x1 + 50, t.juncos[0], 0.85, 30);
      // la semilla de junco queda detrás de una mata de juncos
      atras(SX[1] + 320, t.juncos[1], 0.75, 10, 320);

      // 3. Lugar de los ancestros: círculo de piedras, vasijas y corte del suelo
      atras(SX[2] + 210, t.circulo, 1, -18, 112);
      atras(SX[2] - 120, t.vasijaSemi, 1, -10, 118);
      atras(SX[2] + 470, t.vasijaSemi, 0.9, -6, 118);
      atras(SX[2] + 420, t.vasija, 0.75, -6, 119);
      this.img(SX[2] + 210, Y(SX[2] + 210) + 16, t.corte, 105);
      atras(SX[2] - 520, t.arbusto[3], 0.9, -10, 112);
      atras(SX[2] + 700, t.piedra[1], 1, -8, 118);

      // 4. Quebrada: bosque altoandino y piedras para cruzar
      const c1 = CANALES[1];
      [-760, -600, -480, -150, 120, 300, 520, 700].forEach((dx, k) => atras(SX[3] + dx, t.encenillo[k % 2], 0.85 + (k % 3) * 0.1, -14, 108 + k % 2));
      for (let x = c1.x0 + 24; x < c1.x1; x += 46) this.img(x, Y(x) + 12, t.piedraPaso[(x / 46 | 0) % 2], 150);
      [SX[3] - 300, SX[3] + 200, SX[3] + 440].forEach((x, k) => atras(x, t.helecho[k % 2], 0.8, -6, 125));
      frente(c1.x0 - 30, t.helecho[0], 0.8, 34);
      frente(SX[3] + 80, t.helecho[1], 0.7, 36);
      atras(SX[3] - 680, t.piedra[2], 0.9, -6, 118);

      // 5. Huerta: maíz, papa, calendario de piedras con el sol
      for (let x = SX[4] - 680; x < SX[4] - 120; x += 52) {
        const m = atras(x, t.maiz[(x / 52 | 0) % 3], 0.95 + ((x / 52 | 0) % 2) * 0.1, -10, 112 + ((x / 52 | 0) % 2));
        this.mecen.push(m);
      }
      atras(SX[4] + 260, t.calendario, 1, -18, 112);
      atras(SX[4] - 760, t.espantapajaros, 1, -10, 111);
      for (let x = SX[4] - 700; x < SX[4] + 620; x += 70) frente(x, t.papa[(x / 70 | 0) % 2], 0.9, 46, 325);

      // 6. Páramo: frailejones y pajonal
      const rp = D.azar(66);
      for (let x = SX[5] - 900; x < ANCHO; x += 70 + rp() * 90) {
        if (Math.abs(x - SX[5]) < 90) continue;
        atras(x, t.frailejon[Math.floor(rp() * 4)], 0.8 + rp() * 0.5, -12 - rp() * 6, 108 + Math.floor(rp() * 4));
      }
      for (let x = SX[5] - 1000; x < ANCHO; x += 60 + rp() * 70) atras(x, t.pajonal[Math.floor(rp() * 2)], 0.9, -6, 124);
      // la semilla del frailejón queda detrás de un frailejón cercano
      atras(SX[5] + 350, t.frailejon[1], 0.9, 8, 320);

      // entre estaciones: arbustos, piedras, flores y hierba
      const r = D.azar(42);
      for (let x = 120; x < ANCHO - 100; x += 90 + r() * 140) {
        if (SX.some(s => Math.abs(x - s) < 520)) continue;
        if (CANALES.some(c => x > c.x0 - 80 && x < c.x1 + 80)) continue;
        const i = estacionEn(x, r());
        const opciones = [
          [t.arbusto[0], t.redondo[0], t.flores[0], t.hierba[0], t.piedra[0]],
          [t.juncos[0], t.arbusto[1], t.flores[1], t.hierba[1]],
          [t.arbusto[3], t.piedra[1], t.flores[2], t.hierba[0]],
          [t.encenillo[0], t.helecho[0], t.arbusto[2], t.helecho[1]],
          [t.maiz[1], t.arbusto[0], t.flores[0], t.papa[0]],
          [t.frailejon[2], t.pajonal[0], t.hierbaSeca[0], t.frailejon[0]],
        ][i];
        const tex = opciones[Math.floor(r() * opciones.length)];
        atras(x, tex, 0.8 + r() * 0.3, -8, 110 + Math.floor(r() * 10));
        if (r() < 0.55) frente(x + 60 + r() * 80, [t.flores[i % 3], t.hierba[0], t.hierbaSeca[1]][i === 5 ? 2 : Math.floor(r() * 2)], 0.8, 34 + r() * 20);
      }

      // pradera del frente: matas, flores y piedras regadas para que no quede vacía
      const rf = D.azar(77);
      for (let x = 60; x < ANCHO; x += 60 + rf() * 110) {
        const hondo = rf();
        const dy = 70 + hondo * 230;
        if (x > SX[2] + 60 && x < SX[2] + 380 && dy < 230) continue;      // el corte del suelo
        if (x > SX[4] - 720 && x < SX[4] + 640 && dy < 110) continue;     // los surcos de papa
        const i = estacionEn(x, rf());
        const op = [
          [t.hierba[0], t.flores[0], t.hierba[1], t.piedra[0]],
          [t.hierba[1], t.juncos[2], t.flores[1]],
          [t.hierba[0], t.flores[2], t.piedra[1], t.hierbaSeca[0]],
          [t.helecho[0], t.helecho[1], t.hierba[1]],
          [t.flores[1], t.hierba[0], t.papa[0]],
          [t.pajonal[0], t.pajonal[1], t.hierbaSeca[1], t.piedra[2]],
        ][i];
        const tex = op[Math.floor(rf() * op.length)];
        this.img(x, caminoY(x) + dy, tex, 330 + Math.round(hondo * 20), 0.55 + hondo * 0.5);
      }
    }

    /* ---------- primer plano (pasa rápido, abajo de la pantalla) ---------- */

    crearPrimerPlano() {
      const sf = 1.3;
      this.frente = this.add.container(0, 0).setScrollFactor(sf, 0).setDepth(400);
      this.capas.push({ cont: this.frente, sf, tipo: 'abajo' });
      const r = D.azar(17), t = this.t;
      for (let L = -1300; L < ANCHO * sf + 1300; L += 240 + r() * 300) {
        const X = L / sf, i = estacionEn(X, r());
        const op = [
          [t.flores[0], t.hierba[0], t.helecho[1]],
          [t.juncos[0], t.juncos[2], t.hierba[1]],
          [t.flores[2], t.hierba[0], t.hierbaSeca[0]],
          [t.helecho[0], t.helecho[1], t.hierba[1]],
          [t.flores[1], t.hierba[0], t.papa[1]],
          [t.pajonal[0], t.hierbaSeca[1], t.frailejon[3]],
        ][i];
        const tex = op[Math.floor(r() * op.length)];
        const im = this.add.image(L, 24, tex.clave).setOrigin(0.5, tex.oy).setScale((1.3 + r() * 0.4) / tex.S);
        im.setTint(0xb8c4a8);
        this.frente.add(im);
      }
    }

    /* ---------- detalles vivos: pájaros, mariposas, hojas, niebla ---------- */

    crearVida() {
      const t = this.t;
      // bandada de pájaros que cruza el cielo
      this.pajaros = [];
      for (let k = 0; k < 4; k++) {
        const p = this.add.sprite(-100, -100, t.pajaro.clave, '0').setScrollFactor(0).setDepth(-94).setScale(0.9 / t.pajaro.S).setVisible(false);
        p.fase = Math.random() * 6;
        this.pajaros.push(p);
      }
      this.bandada = { activa: false, espera: 3 };
      // mariposas cerca de las flores
      this.mariposas = [];
      [SX[0] - 200, SX[0] + 420, SX[1] + 380, SX[2] - 300, SX[2] + 600, SX[4] - 200, SX[4] + 420, SX[3] + 600].forEach((x, k) => {
        const tex = t.mariposa[k % 3];
        const m = this.add.sprite(x, caminoY(x) - 60, tex.clave, '0').setDepth(260).setScale(1 / tex.S);
        m.cx = x; m.fase = k * 1.7;
        this.mariposas.push(m);
      });
      // hojas que caen de los árboles
      this.hojas = [];
      [SX[0] + 100, SX[0] + 180, SX[3] - 150, SX[3] + 120, SX[3] + 300, SX[3] + 520].forEach((x, k) => {
        const h = this.add.sprite(x, 0, t.hoja.clave, String(k % 3)).setDepth(255).setScale(1.2 / t.hoja.S);
        h.x0 = x; h.alto = 170 + (k % 3) * 20; h.fase = k; h.prog = Math.random();
        this.hojas.push(h);
      });
      // niebla que pasa por el páramo (y un poco en la quebrada)
      this.niebla = this.add.container(0, 0).setScrollFactor(1.08, 0).setDepth(135);
      this.capas.push({ cont: this.niebla, sf: 1.08, tipo: 'suelo' });
      this.nieblaAtras = this.add.container(0, 0).setScrollFactor(0.6, 0).setDepth(-58);
      this.capas.push({ cont: this.nieblaAtras, sf: 0.6, tipo: 'suelo' });
      const r = D.azar(8);
      const poner = (cont, sf, desde, hasta, n, alfa, yy) => {
        for (let k = 0; k < n; k++) {
          const X = desde + (hasta - desde) * (k + r() * 0.6) / n;
          const im = this.add.image(X * sf, yy + r() * 30, t.niebla.clave).setOrigin(0.5, t.niebla.oy).setScale((2 + r() * 1.2) / t.niebla.S).setAlpha(alfa);
          im.vel = 8 + r() * 10; im.desde = desde * sf - 400; im.hasta = hasta * sf + 400;
          cont.add(im);
        }
      };
      poner(this.niebla, 1.08, SX[5] - 900, ANCHO + 200, 6, 0.55, -10);
      poner(this.nieblaAtras, 0.6, SX[5] - 1400, ANCHO + 400, 7, 0.75, -40);
      poner(this.nieblaAtras, 0.6, SX[3] - 600, SX[3] + 600, 3, 0.45, -40);
    }

    /* ---------- avatar ---------- */

    empezar() {
      const id = GU.avatar().id;
      const tex = D.crearAvatar(this, id, GU.colorRuana());
      if (this.avatar) this.avatar.partes.forEach(p => p.destroy());
      const x = this.avatar ? this.avatar.x : 230;
      const a = { id, tex, x, mira: 1, dist: 0, pasoT: 0, partes: [], parpadeo: 0, proxParpadeo: 2 };
      if (id === 'silla') {
        a.cuerpo = this.spr(x, 0, tex.cuerpo, 300);
        a.rueda = this.spr(x, 0, tex.rueda, 301);
        a.ruedita = this.spr(x, 0, tex.ruedita, 301);
        a.brazo = this.spr(x, 0, tex.brazo, 302);
        a.partes = [a.cuerpo, a.rueda, a.ruedita, a.brazo];
      } else {
        a.cuerpo = this.spr(x, 0, tex.cuerpo, 300);
        a.partes = [a.cuerpo];
      }
      this.avatar = a;
      this.colocarAvatar(0);
    }

    colocarAvatar(dx) {
      const a = this.avatar, y = caminoY(a.x), voltea = a.mira < 0, sg = voltea ? -1 : 1;
      a.cuerpo.setPosition(a.x, y).setFlipX(voltea);
      if (a.id === 'silla') {
        a.rueda.setPosition(a.x - 10 * sg, y - 30);
        a.ruedita.setPosition(a.x + 19 * sg, y - 8);
        a.brazo.setPosition(a.x, y).setFlipX(voltea);
        a.rueda.rotation += dx / 30;
        a.ruedita.rotation += dx / 8;
      }
    }

    animarAvatar(dt, moviendo, dx) {
      const a = this.avatar, quieto = this.cfg.reducirMovimiento;
      a.dist += Math.abs(dx);
      // parpadeo
      a.proxParpadeo -= dt;
      if (a.proxParpadeo < 0) { a.parpadeo = 0.14; a.proxParpadeo = 2.5 + Math.random() * 3; }
      a.parpadeo -= dt;
      const ojos = a.parpadeo > 0 && !quieto ? '1' : '0';
      if (a.id === 'silla') {
        a.cuerpo.setFrame(ojos);
        a.brazo.setFrame(moviendo ? String(1 + (Math.floor(a.dist / 34) % 2)) : '0');
      } else {
        a.cuerpo.setFrame(moviendo ? String(2 + (Math.floor(a.dist / 15) % 4)) : ojos);
      }
    }

    /* ---------- entrada: toques, semillas y personajes ---------- */

    instalarEntrada() {
      this.input.on('pointerdown', (p, objetos) => {
        if (objetos.length) return;
        if (this.puedeCaminarLibre()) this.toque = p;
      });
      const soltar = p => { if (this.toque === p) this.toque = null; };
      this.input.on('pointerup', soltar);
      this.input.on('pointerupoutside', soltar);
      this.input.on('gameout', () => { this.toque = null; });
    }
    puedeCaminarLibre() { return this.avatar && !GU.pausado() && !this.auto && GU.config.control === 'libre'; }

    tocarSemilla(i) {
      const s = this.semillas[i];
      if (!this.avatar || GU.pausado() || s.recogida) return;
      if (Math.abs(this.avatar.x - s.x) < 480) GU.recoger(i);
      else if (this.puedeCaminarLibre()) this.toque = this.input.activePointer;
    }
    tocarPersonaje(i) {
      if (!this.avatar || GU.pausado() || this.auto) return;
      if (Math.abs(this.avatar.x - SX[i]) < DIST_CHARLA + 40) GU.llegar(i);
      else if (this.puedeCaminarLibre()) this.toque = this.input.activePointer;
    }

    caminarA(i) {
      if (!this.avatar) return;
      const lado = this.avatar.x <= SX[i] ? -1 : 1;
      this.auto = { i, x: SX[i] + lado * PARADA };
      this.toque = null;
    }

    llegarSolo(i) {
      this.auto = null;
      this.avatar.mira = SX[i] < this.avatar.x ? -1 : 1;
      GU.zona(i);
      GU.recoger(i);
      GU.llegar(i);
    }

    animarSemilla(i) {
      const s = this.semillas[i];
      if (!s || s.recogida) return;
      s.recogida = true;
      s.burbuja.setVisible(false);
      s.s.disableInteractive();
      const a = this.avatar;
      const destinoX = a ? a.x : s.x, destinoY = a ? caminoY(a.x) - 150 : s.y - 80;
      if (this.cfg.reducirMovimiento) { s.s.setVisible(false); s.halo.setVisible(false); return; }
      this.tweens.add({ targets: s.halo, alpha: 1, scale: s.halo.scale * 1.8, duration: 300, yoyo: true, onComplete: () => s.halo.setVisible(false) });
      this.tweens.add({
        targets: s.s, x: destinoX, y: destinoY, scale: s.s.scale * 1.6, duration: 650, ease: 'Sine.easeInOut',
        onComplete: () => this.tweens.add({ targets: s.s, alpha: 0, scale: s.s.scale * 0.4, y: destinoY + 40, duration: 350, onComplete: () => s.s.setVisible(false) }),
      });
    }

    /* ---------- configuración ---------- */

    aplicarConfig(c) {
      this.cfg = c;
      if (!this.sys || !this.cam) return;
      const contraste = !!c.contraste;
      if (contraste !== this.contrasteActual) {
        this.contrasteActual = contraste;
        D.redibujar(contraste);
        this.dibujarSuelo();
      }
      this.velo.setVisible(contraste);
      this.decoMedio.forEach(m => m.setVisible(!contraste));
      this.frente.setVisible(!contraste);
      this.nubes.setVisible(!contraste);
      this.niebla.setVisible(!c.reducirMovimiento && !contraste);
      // con menos movimiento el primer plano se mueve igual que el camino
      const sfFrente = c.reducirMovimiento ? 1 : 1.3;
      this.frente.setScrollFactor(sfFrente, 0);
      this.capas.find(k => k.cont === this.frente).sfVisible = sfFrente;
      if (c.reducirMovimiento) {
        this.pjs.forEach(s => { s.setFrame('0'); s.y = s.baseY; s.setScale(s.escBase); });
        this.mecen.forEach(m => m.setAngle(0));
        this.pajaros.forEach(p => p.setVisible(false)); this.bandada.activa = false;
      }
      this.mariposas.forEach(m => m.setVisible(!c.reducirMovimiento));
      this.hojas.forEach(h => h.setVisible(!c.reducirMovimiento));
    }

    /* ---------- cada cuadro ---------- */

    update(_, ms) {
      const dt = Math.min(ms / 1000, 0.1);
      this.reloj += dt;
      const c = this.cfg, quieto = c.reducirMovimiento;
      const w = this.scale.width, h = this.scale.height;
      const a = this.avatar;

      // mover al avatar
      let dx = 0;
      if (a) {
        let dir = 0, vel = VEL;
        if (this.auto && !GU.pausado()) {
          const falta = this.auto.x - a.x;
          vel = VEL_SOLO;
          if (Math.abs(falta) <= vel * dt) { dx = falta; a.x = this.auto.x; this.llegarSolo(this.auto.i); }
          else dir = Math.sign(falta);
        } else if (!GU.pausado()) {
          dir = GU.entrada().x;
          if (this.toque && this.toque.isDown) {
            const px = this.cam.getWorldPoint(this.toque.x, this.toque.y).x;
            if (Math.abs(px - a.x) > 24) dir = Math.sign(px - a.x);
          }
        }
        if (dir) {
          const antes = a.x;
          a.x = lim(a.x + dir * vel * dt, 110, ANCHO - 140);
          dx = a.x - antes;
          if (Math.abs(dir) > 0.1) a.mira = dir < 0 ? -1 : 1;
        }
        const moviendo = Math.abs(dx) > 0.01;
        if (moviendo) {
          a.pasoT -= dt;
          if (a.pasoT <= 0) { GU.paso(); a.pasoT = 0.35; }
        } else a.pasoT = 0;
        this.colocarAvatar(dx);
        this.animarAvatar(dt, moviendo, dx);

        // zona, cercanía y semillas
        if (!GU.pausado()) {
          const i = masCercana(a.x);
          GU.zona(i);
          if (this.auto) GU.cerca(-1);
          else GU.cerca(Math.abs(a.x - SX[i]) < DIST_CHARLA ? i : -1);
        }
      }
      this.actualizarSemillas(dt);
      this.actualizarEstaciones(dt);
      this.actualizarCamara(dt, w, h);
      this.actualizarVida(dt, w, h);
    }

    actualizarSemillas() {
      const a = this.avatar, libre = GU.config.control === 'libre', quieto = this.cfg.reducirMovimiento;
      for (const s of this.semillas) {
        if (s.recogida) continue;
        const cerca = a && Math.abs(a.x - s.x) < 110;
        const pulso = quieto ? 0.5 : 0.5 + 0.5 * Math.sin(this.reloj * 5 + s.i);
        s.halo.setAlpha(cerca ? 0.55 + 0.45 * pulso : 0.18 + 0.12 * pulso);
        s.s.setScale((cerca ? 1.15 + 0.1 * pulso : 1) / this.t.semilla.S);
        s.burbuja.setVisible(!!cerca && libre && !GU.pausado());
        if (s.burbuja.visible) s.burbuja.y = s.y - 36 - (quieto ? 0 : Math.abs(Math.sin(this.reloj * 4)) * 6);
        if (cerca && libre && !GU.pausado() && GU.entrada().y < -0.5) GU.recoger(s.i);
      }
    }

    actualizarEstaciones(dt) {
      const a = this.avatar, quieto = this.cfg.reducirMovimiento;
      for (const s of this.pjs) {
        // mirar hacia el jugador
        s.setFlipX(a ? a.x < s.x : true);
        if (quieto) continue;
        s.tRespira += dt;
        s.setScale(s.escBase * (1 + 0.012 * Math.sin(s.tRespira * 2.4)), s.escBase * (1 + 0.025 * Math.sin(s.tRespira * 2.4)));
        // parpadeo
        s.proxParpadeo -= dt; s.finParpadeo -= dt; s.proxAccion -= dt; s.finAccion -= dt;
        if (s.proxParpadeo < 0) { s.finParpadeo = 0.14; s.proxParpadeo = 2.2 + Math.random() * 3; }
        if (s.proxAccion < 0) {
          s.finAccion = { picotea: 0.45, salta: 0.5, mordisquea: 0.5, saluda: 1.1, brocha: 0.7, respira: 0 }[s.accion];
          s.proxAccion = { picotea: 2.4, salta: 3, mordisquea: 2.2, saluda: 4.5, brocha: 3.2, respira: 99 }[s.accion] + Math.random() * 1.5;
        }
        let cuadro = s.finParpadeo > 0 ? '1' : '0';
        s.y = s.baseY;
        if (s.finAccion > 0) {
          if (s.accion === 'salta') { cuadro = '2'; s.y = s.baseY - Math.sin((s.finAccion / 0.5) * Math.PI) * 30; }
          else if (s.accion === 'brocha') cuadro = Math.floor(s.finAccion * 8) % 2 ? '2' : '0';
          else cuadro = '2';
        }
        if (s.frame.name !== cuadro) s.setFrame(cuadro);
      }
      // letreros: chulo en las completadas
      this.letreros.forEach((l, i) => l.ch.setVisible(GU.completada(i)));
      // señal de la próxima estación
      const sig = GU.siguiente();
      const ver = sig >= 0 && this.conv < 0;
      this.flecha.setVisible(ver); this.brillo.setVisible(ver);
      if (ver) {
        const p = this.pjs[sig];
        const alto = p.displayHeight * p.originY;
        const rebote = quieto ? 0 : Math.abs(Math.sin(this.reloj * 3.2)) * 14;
        if (this.flecha.texture.key !== this.t.flecha[sig].clave) this.flecha.setTexture(this.t.flecha[sig].clave);
        this.flecha.setPosition(SX[sig], p.baseY - alto - 18 - rebote);
        this.brillo.setPosition(SX[sig], caminoY(SX[sig]) + 30);
        this.brillo.setAlpha(quieto ? 0.55 : 0.45 + 0.2 * Math.sin(this.reloj * 2.5));
      }
      // el maíz se mece con el viento
      if (!quieto) this.mecen.forEach((m, k) => m.setAngle(Math.sin(this.reloj * 1.3 + k * 0.7) * 2.2));
    }

    actualizarCamara(dt, w, h) {
      const c = this.cfg, quieto = c.reducirMovimiento, a = this.avatar;
      const base = this.zoomBase();
      let zObj = base, fObj = this.fraccionBase(), xObj;
      if (!a) {
        // antes de empezar: paseo lento por el parque detrás de la pantalla de inicio
        if (quieto) xObj = SX[0] - 120;
        else { const r = 700 + ((this.reloj * 34) % ((ANCHO - 1400) * 2)); xObj = r > ANCHO - 700 ? 2 * (ANCHO - 700) - r + 0 : r; }
      } else {
        xObj = a.x + (this.auto ? 0 : a.mira * 60);
        if (this.conv >= 0) {
          xObj = (a.x + SX[this.conv]) / 2;
          // que los personajes queden encima del cuadro de diálogo
          const d = document.getElementById('gu-dialogo');
          const arriba = d && !d.hidden ? d.getBoundingClientRect().top : h;
          // (si casi no queda espacio, como en un celular acostado, no se mueve la cámara)
          if (arriba - 64 > 120) {
            fObj = lim((arriba - 14) / h, 0.36, fObj);
            const espacio = fObj * h - 64;
            // que quepan los dos de lado a lado
            const ancho = w / (Math.abs(a.x - SX[this.conv]) + 170);
            zObj = lim(Math.min(base * 1.2, espacio / 175, ancho), base * 0.7, base * 1.2);
            if (quieto) zObj = Math.min(base, zObj);
          }
        }
      }
      const k = 1 - Math.exp(-dt * (a ? 4 : 2));
      const kz = quieto ? 1 : 1 - Math.exp(-dt * 3);
      this.z += (zObj - this.z) * kz;
      this.f += (fObj - this.f) * kz;
      const mitad = w / (2 * this.z);
      this.camX += (xObj - this.camX) * (a ? k : 1);
      this.camX = lim(this.camX, mitad, Math.max(mitad, ANCHO - mitad));
      const sueloObj = caminoY(a ? a.x : this.camX);
      this.sueloSuave += (sueloObj - this.sueloSuave) * k;
      const z = this.z, f = this.f;
      this.cam.setZoom(z);
      this.cam.centerOn(this.camX, this.sueloSuave - (f - 0.5) * h / z);

      // capas de fondo: su 0 vertical es la línea del suelo en pantalla
      const ySuelo = h / 2 + (f - 0.5) * h / z, yAbajo = h / 2 + h / (2 * z);
      for (const capa of this.capas) {
        const sf = capa.sfVisible || capa.sf;
        capa.cont.x = (w / 2) * (1 - sf);
        capa.cont.y = capa.tipo === 'abajo' ? yAbajo : ySuelo;
      }
      // el cielo cubre toda la pantalla
      const x0 = w / 2 - w / (2 * z), y0 = h / 2 - h / (2 * z);
      const { k: ke, t } = mezcla(this.camX);
      if (this.cieloA.texture.key !== 'cielo-' + ke) { this.cieloA.setTexture('cielo-' + ke); this.cieloB.setTexture('cielo-' + (ke + 1)); }
      for (const s of [this.cieloA, this.cieloB]) s.setPosition(x0, y0).setDisplaySize(w / z + 2, h / z + 2);
      this.cieloB.setAlpha(t);
      this.sol.setPosition(x0 + (w / z) * 0.8, y0 + (f * h / z) * 0.28).setScale(Math.max(0.6, 0.9 / Math.sqrt(z)));
      this.sol.setAlpha(1 - peso(this.camX, 5) * 0.45 - peso(this.camX, 3) * 0.25);
      this.velo.setPosition(x0, y0).setSize(w / z + 2, h / z + 2);
    }

    actualizarVida(dt, w, h) {
      if (this.cfg.reducirMovimiento) return;
      const z = this.z;
      // agua que corre
      this.aguas.forEach((a, k) => { a.tilePositionX -= dt * (a === this.humedal ? 6 : 40); });
      // nubes
      const [n0, n1] = this.nubes.rango;
      this.nubes.list.forEach(n => { n.x += n.vel * dt; if (n.x > n1) n.x = n0; });
      // niebla
      [this.niebla, this.nieblaAtras].forEach(cont => cont.list.forEach(m => { m.x += m.vel * dt; if (m.x > m.hasta) m.x = m.desde; }));
      // bandada
      const b = this.bandada, x0 = w / 2 - w / (2 * z), y0 = h / 2 - h / (2 * z);
      if (!b.activa) {
        b.espera -= dt;
        if (b.espera < 0 && !this.cfg.contraste) {
          b.activa = true; b.x = -60; b.y = 0.12 + Math.random() * 0.18; b.vel = 70 + Math.random() * 40;
          this.pajaros.forEach(p => p.setVisible(true));
        }
      } else {
        b.x += b.vel * dt;
        this.pajaros.forEach((p, k) => {
          const px = b.x - k * 34 - (k % 2) * 10, py = (b.y * h) / z + (k % 2 ? 14 : 0) + Math.sin(this.reloj * 2 + k) * 4;
          p.setPosition(x0 + px, y0 + py);
          p.setFrame(Math.floor(this.reloj * 7 + p.fase) % 2 ? '1' : '0');
        });
        if (b.x - 160 > w / z) { b.activa = false; b.espera = 7 + Math.random() * 8; this.pajaros.forEach(p => p.setVisible(false)); }
      }
      // mariposas
      this.mariposas.forEach(m => {
        const t = this.reloj + m.fase;
        m.x = m.cx + Math.sin(t * 0.6) * 70 + Math.sin(t * 1.7) * 12;
        m.y = caminoY(m.cx) - 56 + Math.sin(t * 2.1) * 16;
        m.setFlipX(Math.cos(t * 0.6) < 0);
        m.setFrame(Math.floor(t * 9) % 2 ? '1' : '0');
      });
      // hojas
      this.hojas.forEach(hj => {
        hj.prog += dt * 0.12;
        if (hj.prog > 1) hj.prog = 0;
        const yb = caminoY(hj.x0);
        hj.y = yb - hj.alto * (1 - hj.prog) + 4;
        hj.x = hj.x0 + Math.sin(hj.prog * 9 + hj.fase) * 22 + hj.prog * 40;
        hj.rotation = Math.sin(hj.prog * 7 + hj.fase) * 1.2;
        hj.setAlpha(hj.prog > 0.92 ? (1 - hj.prog) / 0.08 : Math.min(1, hj.prog * 8));
      });
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'mundo',
    backgroundColor: '#bcd9e6',
    scale: { mode: Phaser.Scale.RESIZE },
    render: { pixelArt: false, antialias: true, powerPreference: 'low-power' },
    input: { keyboard: false },
    banner: false,
    fps: { target: 60 },
    scene: Escena,
  });
})();
