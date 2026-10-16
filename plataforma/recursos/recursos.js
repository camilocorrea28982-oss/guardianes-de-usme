/*
 * Guardianes de Usme · recursos pedagógicos imprimibles
 *
 * fichas.html?tipo=fauna | fichas.html?tipo=plantas  → fichas de especies
 * cuento.html                                        → el cuento del recorrido
 *
 * Los dibujos son los mismos del juego (3-mapa-desde-arriba/dibujos.js).
 * TODOS LOS DATOS BIOLÓGICOS SON UN BORRADOR POR VALIDAR con biólogas y biólogos,
 * el Jardín Botánico de Bogotá, el equipo del parque y la comunidad.
 */
(function () {
  // dibujos.js usa GU_MAPA.aleatorio para variar los árboles; aquí basta con esto
  window.GU_MAPA = window.GU_MAPA || { aleatorio(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; } };
  const D = window.GU_DIBUJOS;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Dibuja una figura del juego centrada en un canvas cuadrado.
  function pintar(canvas, dibujar, w, h, escala = 1) {
    const T = 480;
    canvas.width = T; canvas.height = T;
    const { c, ctx } = D.lienzo(w, h, 4);
    dibujar(ctx);
    const fig = D.contorno(c, 5, 'rgba(58,38,22,.85)');
    const x = canvas.getContext('2d');
    const k = Math.min(T * 0.82 / (w * 4), T * 0.82 / (h * 4)) * escala;
    x.drawImage(fig, (T - w * 4 * k) / 2, (T - h * 4 * k) / 2, w * 4 * k, h * 4 * k);
  }

  // Cucarachero de pantano: no está en el juego, se dibuja aquí.
  function cucarachero(ctx) {
    ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.ellipse(40, 44, 20, 14, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9b98a'; ctx.beginPath(); ctx.ellipse(44, 50, 13, 8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6e4424'; ctx.beginPath(); ctx.moveTo(24, 40); ctx.lineTo(14, 18); ctx.lineTo(28, 36); ctx.fill();
    ctx.strokeStyle = '#3e2a18'; ctx.lineWidth = 1.4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(30 + i * 5, 36); ctx.lineTo(33 + i * 5, 44); ctx.stroke(); }
    ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.arc(58, 32, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2e6cc'; ctx.fillRect(54, 29, 9, 2);
    ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.arc(60, 32, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(66, 33); ctx.lineTo(76, 35); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(40, 56); ctx.lineTo(38, 70); ctx.moveTo(46, 56); ctx.lineTo(47, 70); ctx.stroke();
    ctx.strokeStyle = '#6aa84a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, 72); ctx.lineTo(70, 68); ctx.stroke();
  }
  function mortino(ctx) { D.arbusto(ctx, 0.3); [[22, 26], [36, 18], [44, 28], [28, 34], [40, 36], [18, 34]].forEach(([x, y]) => { ctx.fillStyle = '#4a2a5a'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }); }
  function cultivos(ctx) { ctx.save(); ctx.translate(4, 0); D.maiz(ctx); ctx.restore(); ctx.save(); ctx.translate(38, 46); D.papa(ctx); ctx.restore(); }

  const FICHAS = {
    fauna: {
      titulo: 'Fichas de fauna del altiplano cundiboyacense',
      lista: [
        { nombre: 'Tingua bogotana', cientifico: 'Rallus semiplumbeus', color: '#3d6f8f', dibujo: c => pintar(c, x => D.tita(x, 0), 92, 84),
          grupo: 'Ave', donde: 'Humedales del altiplano con juncos y eneas, como los del río Tunjuelo.', come: 'Insectos, caracoles, lombrices y pequeños animales del agua.', estado: 'En peligro.', endemica: 'Sí: solo vive en el altiplano cundiboyacense.',
          dato: 'Camina entre los juncos con sus patas largas y casi no vuela. Su pico largo y rojizo le sirve para buscar comida en el barro.',
          cuida: 'Cuidar los humedales, no botar basura y no dejar perros sueltos cerca de ellos.' },
        { nombre: 'Cucarachero de pantano', cientifico: 'Cistothorus apolinari', color: '#8a5a32', dibujo: c => pintar(c, cucarachero, 84, 80),
          grupo: 'Ave', donde: 'Humedales con juncos y totoras del altiplano, y algunos páramos.', come: 'Insectos y arañas.', estado: 'En peligro.', endemica: 'Sí: de Colombia (cordillera Oriental).',
          dato: 'Es pequeño y muy cantor: se oye mucho más de lo que se ve. Hace su nido entre los juncos.',
          cuida: 'No cortar ni quemar los juncos de los humedales.' },
        { nombre: 'Rana sabanera', cientifico: 'Dendropsophus labialis', color: '#4f8a3c', dibujo: c => pintar(c, D.rita, 68, 58),
          grupo: 'Anfibio', donde: 'Charcas, humedales, quebradas y jardines húmedos de la sabana.', come: 'Insectos pequeños.', estado: 'Por validar.', endemica: 'Sí: de los Andes orientales de Colombia.',
          dato: 'Respira y toma agua por la piel. Por eso, si una rana está sana, el agua está limpia.',
          cuida: 'No echar jabón, aceite ni basura a las quebradas.' },
        { nombre: 'Curí', cientifico: 'Cavia sp. (por validar)', color: '#a87432', dibujo: c => pintar(c, D.cuqui, 68, 54),
          grupo: 'Mamífero', donde: 'Pastizales, bordes de bosque y huertas.', come: 'Pasto, hojas y semillas.', estado: 'Por validar.', endemica: 'Por validar.',
          dato: 'Los pueblos andinos convivieron con los curíes desde hace miles de años.',
          cuida: 'Dejar bordes con pasto alto y matorrales donde pueda esconderse.' },
        { nombre: 'Oso de anteojos', cientifico: 'Tremarctos ornatus', color: '#4a3b31', dibujo: c => pintar(c, D.tomas, 96, 100),
          grupo: 'Mamífero', donde: 'Bosques andinos y páramos, como el de Sumapaz.', come: 'Sobre todo plantas: frutos, bromelias y cogollos.', estado: 'Vulnerable.', endemica: 'No: vive en los Andes de varios países. Es el único oso de Suramérica.',
          dato: 'Las manchas claras de su cara son distintas en cada oso, como una huella. Al comer frutos, siembra semillas por el bosque.',
          cuida: 'Proteger el páramo y el bosque, y no cazarlo.' },
      ],
    },
    plantas: {
      titulo: 'Fichas de plantas del altiplano cundiboyacense',
      lista: [
        { nombre: 'Frailejón', cientifico: 'Espeletia spp.', color: '#9aa86a', dibujo: c => pintar(c, x => D.frailejon(x, true), 64, 100),
          grupo: 'Planta del páramo', donde: 'Páramos, como el de Sumapaz.', come: 'Sus hojas peludas atrapan la humedad de la niebla.', estado: 'Varias especies amenazadas.', endemica: 'Sí: de los páramos del norte de los Andes.',
          dato: 'Crece muy despacio, más o menos un centímetro al año. Un frailejón alto puede tener muchísimos años.',
          cuida: 'No arrancarlos ni pisarlos: el páramo nos da el agua.' },
        { nombre: 'Encenillo', cientifico: 'Weinmannia tomentosa', color: '#4c8a3e', dibujo: c => pintar(c, x => D.arbol(x, 'encenillo', 1, 130, 150), 130, 150),
          grupo: 'Árbol del bosque altoandino', donde: 'Bosques altoandinos y bordes de páramo.', come: 'Hojas pequeñas y brotes rojizos.', estado: 'Por validar.', endemica: 'De los Andes del norte (por validar).',
          dato: 'Es uno de los árboles más comunes del bosque altoandino y da refugio a muchas aves.',
          cuida: 'Sembrar árboles nativos en vez de especies traídas de lejos.' },
        { nombre: 'Gaque', cientifico: 'Clusia multiflora', color: '#2f6e4a', dibujo: c => pintar(c, x => D.arbol(x, 'gaque', 2, 130, 150), 130, 150),
          grupo: 'Árbol del bosque altoandino', donde: 'Bosques húmedos de montaña.', come: 'Hojas gruesas y brillantes; flores blancas o rosadas.', estado: 'Por validar.', endemica: 'Por validar.',
          dato: 'Sus hojas duras resisten el frío y el viento de la montaña.',
          cuida: 'No talar el bosque para potreros.' },
        { nombre: 'Aliso', cientifico: 'Alnus acuminata', color: '#6faa45', dibujo: c => pintar(c, x => D.arbol(x, 'aliso', 0, 130, 150), 130, 150),
          grupo: 'Árbol', donde: 'Orillas de ríos y quebradas.', come: 'Sus raíces ayudan a que el suelo sea más fértil.', estado: 'Por validar.', endemica: 'No: vive en los Andes de varios países.',
          dato: 'Sus raíces sostienen las orillas de los ríos y evitan que la tierra se derrumbe.',
          cuida: 'Dejar árboles en las rondas de los ríos y quebradas.' },
        { nombre: 'Mortiño', cientifico: 'Hesperomeles goudotiana (por validar)', color: '#6a3a7a', dibujo: c => pintar(c, mortino, 64, 46),
          grupo: 'Arbusto', donde: 'Bordes de bosque y matorrales de montaña.', come: 'Da frutos pequeños y morados que comen las aves.', estado: 'Por validar.', endemica: 'Por validar.',
          dato: 'Las aves comen sus frutos y llevan sus semillas a otros lugares.',
          cuida: 'Dejar matorrales nativos: son la despensa de las aves.' },
        { nombre: 'Maíz y papa', cientifico: 'Zea mays · Solanum tuberosum', color: '#c99a3b', dibujo: c => pintar(c, cultivos, 80, 80),
          grupo: 'Cultivos ancestrales', donde: 'Huertas campesinas de Usme y Sumapaz.', come: 'Alimento de los pueblos muiscas y campesinos.', estado: 'Cultivados.', endemica: 'No: fueron domesticados en América hace miles de años.',
          dato: 'Los muiscas también sembraban cubios, ibias y chuguas, y miraban el sol y la luna para saber cuándo sembrar.',
          cuida: 'Guardar y compartir semillas nativas.' },
      ],
    },
  };

  function fichas(tipo) {
    const F = FICHAS[tipo] || FICHAS.fauna;
    document.title = F.titulo + ' · Guardianes de Usme';
    document.getElementById('titulo').textContent = F.titulo;
    const hojas = document.getElementById('hojas');
    hojas.innerHTML = `
      <section class="hoja portada-recurso" style="--c:#c0562f">
        <span class="borrador">Borrador por validar</span>
        <p style="margin:0;font-weight:700;color:var(--tierra);text-transform:uppercase;letter-spacing:.1em">Guardianes de Usme · Recorriendo los pasos de los ancestros</p>
        <h1 style="font-size:2.4rem">${esc(F.titulo)}</h1>
        <p>Para colorear, leer en grupo y conversar después del recorrido.</p>
      </section>
      ${F.lista.map((f, i) => `
      <article class="hoja" style="--c:${f.color}">
        <span class="borrador">Borrador por validar</span>
        <div class="ficha">
          <div class="dibujo"><canvas data-i="${i}" role="img" aria-label="Dibujo: ${esc(f.nombre)}"></canvas></div>
          <div>
            <h2>${esc(f.nombre)}</h2>
            <p class="cientifico">${esc(f.cientifico)}</p>
            <dl class="datos">
              <div><dt>Qué es</dt><dd>${esc(f.grupo)}</dd></div>
              <div><dt>¿Es endémica?</dt><dd>${esc(f.endemica)}</dd></div>
              <div><dt>Dónde vive</dt><dd>${esc(f.donde)}</dd></div>
              <div><dt>${tipo === 'plantas' ? 'Cómo es' : 'Qué come'}</dt><dd>${esc(f.come)}</dd></div>
              <div><dt>Estado de conservación</dt><dd>${esc(f.estado)}</dd></div>
            </dl>
            <p style="margin-top:12px"><b>¿Sabías que…?</b> ${esc(f.dato)}</p>
            <p class="cuida"><b>Cómo la cuidamos:</b> ${esc(f.cuida)}</p>
          </div>
        </div>
      </article>`).join('')}`;
    document.querySelectorAll('canvas[data-i]').forEach(c => F.lista[+c.dataset.i].dibujo(c));
  }

  function cuento() {
    const C = window.GU_CONTENIDO;
    const P = C.PERSONAJES;
    const DIB = {
      rosa: c => pintar(c, D.rosa, 80, 100), tita: c => pintar(c, x => D.tita(x, 0), 92, 84), julian: c => pintar(c, D.julian, 84, 100),
      rita: c => pintar(c, D.rita, 68, 58), cuqui: c => pintar(c, D.cuqui, 68, 54), tomas: c => pintar(c, D.tomas, 96, 100),
    };
    const hojas = document.getElementById('hojas');
    hojas.innerHTML = `
      <section class="hoja portada-recurso" style="--c:#c0562f">
        <span class="borrador">Borrador por validar</span>
        <p style="margin:0;font-weight:700;color:var(--tierra);text-transform:uppercase;letter-spacing:.1em">Guardianes de Usme</p>
        <h1 style="font-size:2.6rem">Recorriendo los pasos de los ancestros</h1>
        <canvas id="portada" role="img" aria-label="Una niña con ruana roja empieza el recorrido por el parque."></canvas>
        <p style="font-size:1.2rem">Un cuento para leer después de recorrer el Parque Arqueológico de Usme.</p>
      </section>
      ${C.ESTACIONES.map((e, i) => `
      <article class="hoja" style="--c:${e.color}">
        <div class="pagina-cuento">
          <canvas data-pj="${e.personaje}" role="img" aria-label="Dibujo: ${esc(P[e.personaje].nombre)}"></canvas>
          <div>
            <p class="num">${i + 1} · ${esc(e.nombre)}</p>
            <h2>${esc(P[e.personaje].nombre)}</h2>
            <p><i>${esc(e.escena)}</i></p>
            ${e.peques.historia.map(l => `<p>${esc(l)}</p>`).join('')}
            <p><b>Para conversar:</b> ${esc(e.grandes.pregunta.texto)}</p>
          </div>
        </div>
      </article>`).join('')}
      <section class="hoja" style="--c:#3c7a45">
        <h2>Lo que aprendimos</h2>
        <ul style="font-size:1.15rem">${C.ESTACIONES.map(e => `<li>${esc(e.peques.pregunta.acierto.replace(/^¡[^!]*!\s*/, ''))}</li>`).join('')}</ul>
        <p style="font-size:1.2rem;margin-top:18px">Ahora tú también eres guardián o guardiana del territorio. ¿Qué vas a cuidar?</p>
        <div style="border:3px dashed var(--borde);border-radius:14px;height:220px;display:grid;place-items:center;color:var(--suave)">Dibuja aquí lo que más te gustó del recorrido</div>
      </section>`;
    pintar(document.getElementById('portada'), x => D.avatar(x, 'nina', 'd', 0, '#c0392b'), 72, 92, 0.85);
    document.querySelectorAll('canvas[data-pj]').forEach(c => DIB[c.dataset.pj](c));
  }

  window.GU_RECURSOS = { fichas, cuento };
  document.getElementById('imprimir').addEventListener('click', () => window.print());
})();
