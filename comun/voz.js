/*
 * Guardianes de Usme · narración en voz
 *
 * Usa la voz que trae el navegador o el sistema (Web Speech API), sin internet.
 * Prefiere voces de Colombia, luego de Latinoamérica, luego cualquier español.
 * En la versión final lo ideal es grabar voces reales (niños, sabedores) y
 * dejar esta voz sintética solo como respaldo.
 */
(function () {
  const sintesis = window.speechSynthesis;
  let voz = null, velocidad = 1, activa = true, turno = 0;

  function elegirVoz() {
    if (!sintesis) return;
    const voces = sintesis.getVoices().filter(v => /^es/i.test(v.lang));
    const orden = [/es[-_]CO/i, /es[-_](419|MX|US|AR|CL|PE)/i, /es/i];
    for (const re of orden) {
      const v = voces.find(x => re.test(x.lang) && /google|natural|online/i.test(x.name)) || voces.find(x => re.test(x.lang));
      if (v) { voz = v; return; }
    }
  }
  if (sintesis) {
    elegirVoz();
    sintesis.addEventListener?.('voiceschanged', elegirVoz);
  }

  function decir(texto, alTerminar) {
    callar();
    const miTurno = ++turno;
    if (!sintesis || !activa || !texto) { alTerminar && setTimeout(alTerminar, 0); return; }
    // quita emojis y marcas «(por validar)» de lo que se lee en voz alta
    const limpio = texto.replace(/\((fecha )?por validar[^)]*\)/gi, '')
                        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();
    const u = new SpeechSynthesisUtterance(limpio);
    u.lang = voz ? voz.lang : 'es-CO';
    if (voz) u.voice = voz;
    u.rate = velocidad;
    u.pitch = 1.05;
    window.GU_AUDIO?.atenuar(true);
    u.onend = u.onerror = () => {
      if (miTurno !== turno) return;
      window.GU_AUDIO?.atenuar(false);
      alTerminar && alTerminar();
    };
    sintesis.speak(u);
  }

  function callar() {
    turno++;
    if (sintesis) sintesis.cancel();
    window.GU_AUDIO?.atenuar(false);
  }

  window.GU_VOZ = {
    decir,
    callar,
    disponible: !!sintesis,
    configurar(opc) {
      if ('activa' in opc) { activa = opc.activa; if (!activa) callar(); }
      if ('velocidad' in opc) velocidad = opc.velocidad;
    },
  };
})();
