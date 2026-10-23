/*
 * Guardianes de Usme · diploma de guardián del territorio
 *
 * Dibuja el diploma en un <canvas> (hoja carta acostada) y lo deja:
 *   - imprimir: solo se imprime la imagen del diploma, en horizontal
 *   - compartir en PDF o como imagen (WhatsApp, correo…): con la hoja de compartir del
 *     celular; en el computador, donde no se puede compartir archivos, se descarga.
 *
 * El PDF se arma aquí mismo (una página con la imagen JPEG), sin librerías: funciona sin internet.
 *
 * Uso (lo llama comun/juego.js en la pantalla final):
 *   const c = GU_DIPLOMA.dibujar({ nombre, guardiana, puntos, maximo, semillas, totalSemillas, juego, avatar });
 *   GU_DIPLOMA.imprimir(c); GU_DIPLOMA.compartir(c, 'pdf' | 'imagen');
 */
(function () {
  const W = 2200, H = 1700; // proporción de una hoja carta acostada (11 × 8,5)
  const LETRA = "'Atkinson Hyperlegible', system-ui, 'Segoe UI', Roboto, sans-serif";
  const TITULO = "'Baloo 2', 'Atkinson Hyperlegible', system-ui, sans-serif";
  const NOMBRE_ARCHIVO = 'diploma-guardianes-de-usme';

  // Personajes que acompañan el diploma (solo si la página trae los dibujos del mapa).
  const PJS = [['tita', 92, 84], ['rita', 68, 58], ['julian', 84, 100], ['rosa', 80, 100], ['cuqui', 68, 54], ['tomas', 96, 100]];

  function figura(D, dibujar, w, h) {
    const { c, ctx } = D.lienzo(w, h, 4);
    dibujar(ctx);
    return D.contorno(c, 5, 'rgba(58,38,22,.8)');
  }

  // Ajusta el tamaño de la letra para que el texto quepa en `ancho`.
  function letraQueCabe(ctx, texto, peso, tam, familia, ancho) {
    let t = tam;
    do { ctx.font = `${peso} ${t}px ${familia}`; t -= 4; } while (ctx.measureText(texto).width > ancho && t > 30);
  }
  function parrafo(ctx, texto, x, y, ancho, alto) {
    const palabras = texto.split(' ');
    const lineas = [];
    let linea = '';
    palabras.forEach(p => {
      const prueba = linea ? linea + ' ' + p : p;
      if (ctx.measureText(prueba).width > ancho && linea) { lineas.push(linea); linea = p; } else linea = prueba;
    });
    if (linea) lineas.push(linea);
    lineas.forEach((l, i) => ctx.fillText(l, x, y + i * alto));
    return lineas.length;
  }
  function estrella(ctx, x, y, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }

  function dibujar(d) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const D = window.GU_DIBUJOS && window.GU_DIBUJOS.APARIENCIA_BASE ? window.GU_DIBUJOS : null;

    // papel y bordes
    const fondo = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.7);
    fondo.addColorStop(0, '#fffaf0'); fondo.addColorStop(1, '#f3e6c8');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c0562f'; ctx.lineWidth = 22; ctx.strokeRect(50, 50, W - 100, H - 100);
    ctx.strokeStyle = '#3c7a45'; ctx.lineWidth = 6; ctx.strokeRect(92, 92, W - 184, H - 184);
    // franja tejida (como la de las ruanas) arriba y abajo
    [118, H - 140].forEach(y => {
      for (let x = 120; x < W - 120; x += 44) {
        ctx.fillStyle = ['#c0562f', '#e0a526', '#3c7a45', '#2e6da4'][(x / 44 | 0) % 4];
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y + 22); ctx.lineTo(x + 44, y); ctx.lineTo(x + 22, y - 0); ctx.closePath(); ctx.fill();
      }
    });
    // soles en las esquinas
    [[150, 150], [W - 150, 150], [150, H - 150], [W - 150, H - 150]].forEach(([x, y]) => {
      ctx.fillStyle = '#e0a526'; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e0a526'; ctx.lineWidth = 7;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42); ctx.lineTo(x + Math.cos(a) * 58, y + Math.sin(a) * 58); ctx.stroke(); }
    });

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = D ? W * 0.61 : W / 2;
    const anchoTexto = D ? 1180 : 1700;
    ctx.fillStyle = '#c0562f'; ctx.font = `800 40px ${LETRA}`;
    ctx.fillText('PARQUE ARQUEOLÓGICO DE USME · BOGOTÁ', cx, 270);
    ctx.fillStyle = '#2b2118';
    letraQueCabe(ctx, 'Diploma de guardián del territorio', 800, 120, TITULO, anchoTexto);
    ctx.fillText(d.guardiana ? 'Diploma de guardiana del territorio' : 'Diploma de guardián del territorio', cx, 400);
    ctx.fillStyle = '#6b5a48'; ctx.font = `400 46px ${LETRA}`;
    ctx.fillText('Se entrega con orgullo a', cx, 510);
    // nombre
    const nombre = d.nombre || (d.guardiana ? 'Guardiana de Usme' : 'Guardián de Usme');
    ctx.fillStyle = '#2b2118';
    letraQueCabe(ctx, nombre, 800, 150, TITULO, anchoTexto);
    ctx.fillText(nombre, cx, 670);
    ctx.strokeStyle = '#c0562f'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx - anchoTexto / 2 + 60, 705); ctx.lineTo(cx + anchoTexto / 2 - 60, 705); ctx.stroke();
    // motivo
    ctx.fillStyle = '#2b2118'; ctx.font = `400 46px ${LETRA}`;
    const n = parrafo(ctx, `por recorrer «${d.juego}», conocer a sus guardianes y aprender a cuidar la memoria de los ancestros, el agua, el bosque, la huerta y el páramo.`, cx, 800, anchoTexto, 62);
    // estrellas y semillas
    const yE = 800 + n * 62 + 70;
    estrella(ctx, cx - 250, yE - 22, 46, '#e0a526');
    ctx.textAlign = 'left'; ctx.fillStyle = '#2b2118'; ctx.font = `800 60px ${TITULO}`;
    ctx.fillText(`${d.puntos} de ${d.maximo} estrellas`, cx - 190, yE);
    ctx.textAlign = 'center'; ctx.fillStyle = '#6b5a48'; ctx.font = `400 40px ${LETRA}`;
    if (d.totalSemillas) ctx.fillText(`Encontraste ${d.semillas} de ${d.totalSemillas} semillas`, cx, yE + 70);

    // fecha y firma
    const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.fillStyle = '#2b2118'; ctx.font = `400 38px ${LETRA}`;
    ctx.fillText(`Bogotá, ${fecha}`, cx - anchoTexto / 4, H - 410);
    ctx.fillText('Guardianes de Usme', cx + anchoTexto / 4, H - 410);
    ctx.strokeStyle = '#6b5a48'; ctx.lineWidth = 3;
    [cx - anchoTexto / 4, cx + anchoTexto / 4].forEach(x => { ctx.beginPath(); ctx.moveTo(x - 220, H - 470); ctx.lineTo(x + 220, H - 470); ctx.stroke(); });

    if (D) {
      // el avatar del jugador, grande, a la izquierda, sobre un círculo de pasto
      const g = ctx.createRadialGradient(430, 860, 40, 430, 860, 300);
      g.addColorStop(0, '#e9dcae'); g.addColorStop(0.6, '#cfe0a6'); g.addColorStop(1, 'rgba(185,211,138,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(430, 860, 300, 0, Math.PI * 2); ctx.fill();
      if (d.avatar) {
        const av = figura(D, x => D.avatar(x, d.avatar.tipo, 'd', 0, d.avatar.color, d.avatar.ap), 72, 92);
        ctx.drawImage(av, 430 - 36 * 6, 1110 - 88 * 6, 72 * 6, 92 * 6);
      }
      // medalla
      ctx.fillStyle = '#c0562f'; ctx.beginPath(); ctx.moveTo(600, 600); ctx.lineTo(570, 720); ctx.lineTo(610, 690); ctx.lineTo(650, 720); ctx.lineTo(620, 600); ctx.fill();
      ctx.fillStyle = '#e0a526'; ctx.beginPath(); ctx.arc(610, 580, 62, 0, Math.PI * 2); ctx.fill();
      estrella(ctx, 610, 583, 40, '#fffaf0');
      // los guardianes del parque, abajo
      const base = H - 175, paso = 230, x0 = W / 2 - paso * (PJS.length - 1) / 2;
      PJS.forEach(([id, w, h], i) => {
        if (typeof D[id] !== 'function') return;
        const e = 1.7;
        const fig = figura(D, x => D[id](x, 0), w, h);
        ctx.fillStyle = 'rgba(30,20,10,.15)'; ctx.beginPath(); ctx.ellipse(x0 + i * paso, base, w * e * 0.4, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(fig, x0 + i * paso - w * e / 2, base - h * e, w * e, h * e);
      });
    }
    return c;
  }

  /* ---------- imprimir ---------- */

  const css = document.createElement('style');
  css.textContent = `
    #gu-diploma-imp { display: none; }
    @media print {
      @page { size: landscape; margin: 0; }
      html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
      body.gu-imprimiendo > * { display: none !important; }
      body.gu-imprimiendo > #gu-diploma-imp { display: block !important; }
      #gu-diploma-imp img { display: block; width: 100%; height: auto; max-height: 100vh; object-fit: contain; }
    }`;
  document.head.appendChild(css);

  function imprimir(canvas) {
    let caja = document.getElementById('gu-diploma-imp');
    if (!caja) { caja = document.createElement('div'); caja.id = 'gu-diploma-imp'; document.body.appendChild(caja); }
    caja.innerHTML = '';
    const img = new Image();
    img.alt = 'Diploma de guardián del territorio';
    img.src = canvas.toDataURL('image/jpeg', 0.92);
    caja.appendChild(img);
    document.body.classList.add('gu-imprimiendo');
    const listo = () => { window.removeEventListener('afterprint', listo); document.body.classList.remove('gu-imprimiendo'); };
    window.addEventListener('afterprint', listo);
    // se espera a que la imagen esté lista antes de abrir la ventana de impresión
    const abrir = () => setTimeout(() => window.print(), 50);
    if (img.decode) img.decode().then(abrir, abrir); else img.onload = abrir;
  }

  /* ---------- PDF de una página con la imagen ---------- */

  function base64ABytes(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function pdf(canvas) {
    const jpg = base64ABytes(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
    const pw = 792, ph = 612; // carta acostada, en puntos
    const contenido = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    const partes = [];
    const offsets = [];
    let largo = 0;
    const agregar = p => { const b = typeof p === 'string' ? new TextEncoder().encode(p) : p; partes.push(b); largo += b.length; };
    const objeto = (n, cuerpo) => { offsets[n] = largo; agregar(`${n} 0 obj\n${cuerpo}\nendobj\n`); };
    agregar('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objeto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objeto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
    objeto(4, `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
    offsets[5] = largo;
    agregar(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    agregar(jpg);
    agregar('\nendstream\nendobj\n');
    const xref = largo;
    agregar(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => String(offsets[n]).padStart(10, '0') + ' 00000 n \n').join('')}`);
    agregar(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(partes, { type: 'application/pdf' });
  }

  /* ---------- compartir o descargar ---------- */

  // ¿El navegador deja compartir archivos (celulares)? Si no, se descarga.
  const puedeCompartir = (() => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); }
    catch (e) { return false; }
  })();

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // formato: 'pdf' | 'imagen'. Devuelve 'compartido' | 'descargado' | 'cancelado'.
  async function compartir(canvas, formato) {
    const blob = formato === 'pdf' ? pdf(canvas) : await new Promise(r => canvas.toBlob(r, 'image/png'));
    const nombre = `${NOMBRE_ARCHIVO}.${formato === 'pdf' ? 'pdf' : 'png'}`;
    const archivo = new File([blob], nombre, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: 'Mi diploma de Guardianes de Usme', text: '¡Soy guardián del territorio de Usme! 🌄' });
        return 'compartido';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
      }
    }
    descargar(blob, nombre);
    return 'descargado';
  }

  window.GU_DIPLOMA = { dibujar, imprimir, compartir, pdf, puedeCompartir };
})();
