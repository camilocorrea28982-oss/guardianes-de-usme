/*
 * Guardianes de Usme · sonido
 *
 * Todos los sonidos se generan en el navegador con Web Audio (no hay archivos):
 * río, viento, pájaros, ranas, grillos, la tingua, pasos y efectos.
 * En la versión final se pueden reemplazar por grabaciones reales del parque
 * (lo ideal: grabar el Tunjuelo, las aves y las ranas de Usme).
 *
 * El navegador solo deja sonar audio después de un toque o una tecla,
 * por eso GU_AUDIO.desbloquear() se llama en el botón «¡Empezar!».
 */
(function () {
  let ctx = null, maestro, busAmbiente, busEfectos, ruidoBlanco, ruidoCafe;
  const capas = {};        // nombre → { gain, parar() }
  let volAmbiente = 0.6, volEfectos = 0.8, atenuado = false;

  function desbloquear() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }   // sin dispositivo de audio, el juego sigue en silencio
      maestro = ctx.createGain(); maestro.connect(ctx.destination);
      busAmbiente = ctx.createGain(); busAmbiente.gain.value = volAmbiente; busAmbiente.connect(maestro);
      busEfectos = ctx.createGain(); busEfectos.gain.value = volEfectos; busEfectos.connect(maestro);
      ruidoBlanco = crearRuido('blanco');
      ruidoCafe = crearRuido('cafe');
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function crearRuido(tipo) {
    const largo = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, largo, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < largo; i++) {
      const b = Math.random() * 2 - 1;
      if (tipo === 'cafe') { ultimo = (ultimo + 0.02 * b) / 1.02; d[i] = ultimo * 3.5; }
      else d[i] = b;
    }
    return buf;
  }

  function fuenteRuido(tipo) {
    const s = ctx.createBufferSource();
    s.buffer = tipo === 'cafe' ? ruidoCafe : ruidoBlanco;
    s.loop = true;
    s.loopStart = Math.random() * 2;
    s.start(0, Math.random() * 2);
    return s;
  }

  function panear(valor) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = valor; return p; }
    return ctx.createGain();
  }

  /* ---------- capas de ambiente ---------- */

  function capaRuidoFiltrado(opc) {
    const g = ctx.createGain(); g.gain.value = 0;
    const src = fuenteRuido(opc.ruido);
    const f = ctx.createBiquadFilter(); f.type = opc.filtro; f.frequency.value = opc.freq; f.Q.value = opc.q || 0.7;
    const mod = ctx.createGain(); mod.gain.value = 1;
    src.connect(f); f.connect(mod); mod.connect(g); g.connect(busAmbiente);
    // movimiento lento para que no suene a estática
    const lfo = ctx.createOscillator(); lfo.frequency.value = opc.lfo || 0.15;
    const lfoG = ctx.createGain(); lfoG.gain.value = opc.lfoFreq || 0;
    lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = (opc.lfo || 0.15) * 0.7;
    const lfo2G = ctx.createGain(); lfo2G.gain.value = opc.lfoVol || 0;
    lfo2.connect(lfo2G); lfo2G.connect(mod.gain); lfo2.start();
    return { gain: g, nivel: opc.nivel, parar() { [src, lfo, lfo2].forEach(n => { try { n.stop(); } catch (e) {} }); } };
  }

  function capaEventos(nivel, cadaMin, cadaMax, disparar) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(busAmbiente);
    let vivo = true, t;
    const ciclo = () => {
      if (!vivo) return;
      if (g.gain.value > 0.01) disparar(g);
      t = setTimeout(ciclo, cadaMin + Math.random() * (cadaMax - cadaMin));
    };
    t = setTimeout(ciclo, 300 + Math.random() * 1200);
    return { gain: g, nivel, parar() { vivo = false; clearTimeout(t); } };
  }

  function trino(destino, opc) {
    const ahora = ctx.currentTime;
    const pan = panear(opc.pan ?? (Math.random() * 1.6 - 0.8));
    pan.connect(destino);
    const notas = opc.notas || (3 + Math.floor(Math.random() * 4));
    const base = opc.base || (2200 + Math.random() * 2400);
    for (let i = 0; i < notas; i++) {
      const t0 = ahora + i * (opc.separacion || 0.11);
      const o = ctx.createOscillator(); o.type = opc.tipo || 'sine';
      const gn = ctx.createGain();
      const f0 = base * (1 + (Math.random() * 0.3 - 0.1));
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * (opc.caida || (0.7 + Math.random() * 0.7)), t0 + (opc.dur || 0.08));
      gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(opc.vol || 0.18, t0 + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + (opc.dur || 0.08));
      o.connect(gn); gn.connect(pan);
      o.start(t0); o.stop(t0 + (opc.dur || 0.08) + 0.02);
    }
  }

  function croac(destino, opc = {}) {
    const ahora = ctx.currentTime;
    const pan = panear(opc.pan ?? (Math.random() * 1.4 - 0.7));
    pan.connect(destino);
    const veces = opc.veces || 2;
    for (let i = 0; i < veces; i++) {
      const t0 = ahora + i * 0.22;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(opc.freq || (380 + Math.random() * 160), t0);
      const am = ctx.createOscillator(); am.frequency.value = 38;
      const amG = ctx.createGain(); amG.gain.value = 0.5;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(opc.vol || 0.12, t0 + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      am.connect(amG); amG.connect(gn.gain);
      o.connect(f); f.connect(gn); gn.connect(pan);
      o.start(t0); am.start(t0); o.stop(t0 + 0.18); am.stop(t0 + 0.18);
    }
  }

  function grillo(destino) {
    const ahora = ctx.currentTime;
    const pan = panear(Math.random() * 1.6 - 0.8); pan.connect(destino);
    for (let i = 0; i < 3; i++) {
      const t0 = ahora + i * 0.09;
      const o = ctx.createOscillator(); o.frequency.value = 4300 + Math.random() * 300;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(0.05, t0 + 0.005);
      gn.gain.linearRampToValueAtTime(0, t0 + 0.05);
      o.connect(gn); gn.connect(pan); o.start(t0); o.stop(t0 + 0.06);
    }
  }

  function llamadoTingua(destino, vol = 0.14) {
    // la tingua hace una serie de notas ásperas que van bajando
    trino(destino, { notas: 6, base: 1500, separacion: 0.13, dur: 0.1, caida: 0.6, tipo: 'square', vol: vol * 0.5 });
  }

  const FABRICAS = {
    'viento-suave':  () => capaRuidoFiltrado({ ruido: 'cafe', filtro: 'lowpass', freq: 500, lfo: 0.08, lfoFreq: 250, lfoVol: 0.4, nivel: 0.35 }),
    'viento-fuerte': () => capaRuidoFiltrado({ ruido: 'cafe', filtro: 'bandpass', freq: 700, q: 0.6, lfo: 0.12, lfoFreq: 450, lfoVol: 0.6, nivel: 0.6 }),
    'agua':          () => capaRuidoFiltrado({ ruido: 'blanco', filtro: 'bandpass', freq: 1200, q: 0.4, lfo: 0.4, lfoFreq: 300, lfoVol: 0.15, nivel: 0.16 }),
    'pajaros':       () => capaEventos(1, 1500, 4500, g => trino(g, {})),
    'pajaros-lejos': () => capaEventos(0.4, 4000, 9000, g => trino(g, { vol: 0.1 })),
    'tingua':        () => capaEventos(1, 7000, 14000, g => llamadoTingua(g)),
    'ranas':         () => capaEventos(1, 900, 2600, g => croac(g, { veces: 1 + Math.floor(Math.random() * 3) })),
    'grillos':       () => capaEventos(0.8, 400, 1400, g => grillo(g)),
  };

  function ambiente(lista) {
    if (!ctx) return;
    const quiero = new Set(lista || []);
    const t = ctx.currentTime;
    for (const nombre of Object.keys(capas)) {
      if (!quiero.has(nombre)) {
        const c = capas[nombre];
        c.gain.gain.cancelScheduledValues(t);
        c.gain.gain.setValueAtTime(c.gain.gain.value, t);
        c.gain.gain.linearRampToValueAtTime(0, t + 2);
        setTimeout(() => c.parar(), 2200);
        delete capas[nombre];
      }
    }
    for (const nombre of quiero) {
      if (capas[nombre] || !FABRICAS[nombre]) continue;
      const c = FABRICAS[nombre]();
      c.gain.gain.setValueAtTime(0, t);
      c.gain.gain.linearRampToValueAtTime(c.nivel, t + 2.5);
      capas[nombre] = c;
    }
  }

  /* ---------- efectos ---------- */

  function tono(freq, t0, dur, tipo = 'sine', vol = 0.2, destino = busEfectos) {
    const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(destino); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function efecto(nombre) {
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (nombre) {
      case 'acierto':  [523, 659, 784, 1047].forEach((f, i) => tono(f, t + i * 0.09, 0.35, 'triangle', 0.18)); break;
      case 'intento':  tono(392, t, 0.25, 'sine', 0.15); tono(349, t + 0.15, 0.35, 'sine', 0.12); break;
      case 'semilla':  [1319, 1568, 2093].forEach((f, i) => tono(f, t + i * 0.06, 0.25, 'sine', 0.12)); break;
      case 'llegada':  tono(660, t, 0.5, 'sine', 0.14); tono(990, t + 0.12, 0.6, 'sine', 0.1); break;
      case 'clic':     tono(880, t, 0.06, 'sine', 0.08); break;
      case 'final':    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tono(f, t + i * 0.14, 0.45, 'triangle', 0.16)); break;
      case 'paso': {
        const s = ctx.createBufferSource(); s.buffer = ruidoCafe;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600 + Math.random() * 300;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        s.connect(f); f.connect(g); g.connect(busEfectos); s.start(t, Math.random() * 2); s.stop(t + 0.1);
        break;
      }
      case 'rueda': {
        const s = ctx.createBufferSource(); s.buffer = ruidoBlanco;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 1;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
        s.connect(f); f.connect(g); g.connect(busEfectos); s.start(t, Math.random() * 2); s.stop(t + 0.32);
        break;
      }
      // la «voz» de cada personaje al empezar a hablar
      case 'tingua':     llamadoTingua(busEfectos, 0.25); break;
      case 'rana':       croac(busEfectos, { veces: 2, vol: 0.2, pan: 0 }); break;
      case 'curi':       trino(busEfectos, { notas: 4, base: 2600, separacion: 0.09, dur: 0.06, caida: 1.3, vol: 0.12, pan: 0 }); break;
      case 'oso':        tono(110, t, 0.5, 'sawtooth', 0.06); tono(98, t + 0.2, 0.6, 'sawtooth', 0.05); break;
      case 'voz-humana': tono(523, t, 0.15, 'sine', 0.08); tono(659, t + 0.1, 0.2, 'sine', 0.08); break;
    }
  }

  function aplicarVolumen() {
    if (!ctx) return;
    const t = ctx.currentTime;
    busAmbiente.gain.setTargetAtTime(volAmbiente * (atenuado ? 0.35 : 1), t, 0.3);
    busEfectos.gain.setTargetAtTime(volEfectos, t, 0.1);
  }

  window.GU_AUDIO = {
    desbloquear,
    ambiente,
    efecto,
    volumen(amb, efe) { volAmbiente = amb; volEfectos = efe; aplicarVolumen(); },
    // baja el ambiente mientras habla la narración
    atenuar(si) { atenuado = si; aplicarVolumen(); },
  };
})();
