/*
 * Guardianes de Usme · datos de la plataforma (prototipo)
 *
 * Profes y talleristas, jugadores, avatares, partidas, diplomas y evidencias.
 *
 * EN ESTE PROTOTIPO TODO SE GUARDA EN ESTE NAVEGADOR (localStorage, y los
 * archivos de evidencias en IndexedDB). Por eso un profe solo ve a los
 * jugadores que jugaron en este mismo equipo. En la versión publicada, estas
 * mismas funciones hablarán con Supabase (ver index.html, «Cómo se arma»):
 * la página no tendrá que cambiar, solo este archivo.
 *
 * Todas las funciones que tocan datos devuelven promesas, igual que lo hará Supabase.
 */
(function () {
  const CLAVE = 'gu-plataforma-v1';

  const JUEGOS = [
    {
      id: 'ancestros',
      nombre: 'Recorriendo los pasos de los ancestros',
      descripcion: 'Camina por el Parque Arqueológico de Usme, del río Tunjuelo al páramo de Sumapaz, y conversa con sus guardianes.',
      ruta: '3-mapa-desde-arriba/index.html',
      maximo: 24,
      recursos: [
        { id: 'fauna', titulo: 'Fichas de fauna del altiplano cundiboyacense', detalle: 'Aves, anfibios y mamíferos del recorrido', ruta: 'plataforma/recursos/fichas.html?tipo=fauna', icono: '🐦' },
        { id: 'plantas', titulo: 'Fichas de plantas del altiplano cundiboyacense', detalle: 'Árboles, frailejones y cultivos ancestrales', ruta: 'plataforma/recursos/fichas.html?tipo=plantas', icono: '🌿' },
        { id: 'cuento', titulo: 'Cuento: Recorriendo los pasos de los ancestros', detalle: 'Lo que se aprende en el recorrido, para leer en clase o en casa', ruta: 'plataforma/recursos/cuento.html', icono: '📖' },
      ],
    },
  ];

  const APARIENCIA = { genero: 'nina', silla: false, piel: '#b27a52', peinado: 'trenzas', pelo: '#2a1c15', ruana: '#c0392b', pantalon: '#3e3a63', zapatos: '#4a2e1f' };

  /* ---------- almacenamiento ---------- */

  function vacio() { return { profes: {}, jugadores: {}, evidencias: [], sesion: { jugador: null, profe: null } }; }
  function leer() {
    try { return { ...vacio(), ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; }
    catch (e) { return vacio(); }
  }
  function guardar(d) {
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); return true; }
    catch (e) { console.error('No se pudo guardar', e); return false; }
  }
  const limpiar = s => String(s || '').trim().replace(/\s+/g, ' ');
  const llave = s => limpiar(s).toLocaleLowerCase('es');

  function validarNick(nick) {
    const n = limpiar(nick);
    if (n.length < 3) return 'El nickname debe tener al menos 3 letras.';
    if (n.length > 20) return 'El nickname puede tener máximo 20 letras.';
    if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) return 'Usa solo letras, números, espacios, puntos o guiones.';
    return null;
  }

  // Contraseña: se guarda solo su huella (SHA-256 con sal), nunca el texto.
  async function huella(clave, sal) {
    const texto = sal + '·' + clave;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; // respaldo si el navegador no tiene crypto.subtle
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv' + (h >>> 0).toString(16);
  }
  function aleatorioTexto(n, abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
    let s = '';
    const v = new Uint32Array(n);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(v) : v.forEach((_, i) => { v[i] = Math.random() * 1e9; });
    v.forEach(x => { s += abc[x % abc.length]; });
    return s;
  }

  /* ---------- profes y talleristas ---------- */

  async function crearProfe({ nick, clave, nombre, institucion }) {
    const err = validarNick(nick);
    if (err) throw new Error(err);
    if (!clave || clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const d = leer();
    const k = llave(nick);
    if (d.profes[k]) throw new Error('Ese nickname ya existe. Prueba con otro o ingresa con tu contraseña.');
    let codigo;
    do { codigo = 'USME-' + aleatorioTexto(4); } while (Object.values(d.profes).some(p => p.codigo === codigo));
    const sal = aleatorioTexto(12);
    d.profes[k] = { nick: limpiar(nick), nombre: limpiar(nombre) || limpiar(nick), institucion: limpiar(institucion), codigo, sal, hash: await huella(clave, sal), creado: new Date().toISOString() };
    d.sesion.profe = k;
    guardar(d);
    return publicoProfe(d.profes[k]);
  }
  async function ingresarProfe(nick, clave) {
    const d = leer();
    const p = d.profes[llave(nick)];
    if (!p || (await huella(clave || '', p.sal)) !== p.hash) throw new Error('El nickname o la contraseña no coinciden.');
    d.sesion.profe = llave(nick);
    guardar(d);
    return publicoProfe(p);
  }
  function salirProfe() { const d = leer(); d.sesion.profe = null; guardar(d); }
  const publicoProfe = p => p && ({ nick: p.nick, nombre: p.nombre, institucion: p.institucion, codigo: p.codigo, creado: p.creado });
  function profeActual() { const d = leer(); return publicoProfe(d.profes[d.sesion.profe]); }
  function profePorCodigo(codigo) {
    const c = limpiar(codigo).toUpperCase();
    if (!c) return null;
    return publicoProfe(Object.values(leer().profes).find(p => p.codigo === c));
  }

  /* ---------- jugadores ---------- */

  const idJugador = (nick, codigo) => (codigo ? limpiar(codigo).toUpperCase() : 'libre') + ':' + llave(nick);

  // Entra o crea el perfil. Con código de grupo, el nickname queda ligado a ese profe.
  async function entrarJugador(nick, codigo) {
    const err = validarNick(nick);
    if (err) throw new Error(err);
    const c = limpiar(codigo).toUpperCase();
    if (c && !profePorCodigo(c)) throw new Error('No encontramos ese código de grupo. Pídeselo otra vez a tu profe.');
    const d = leer();
    const id = idJugador(nick, c);
    let nuevo = false;
    if (!d.jugadores[id]) {
      d.jugadores[id] = { id, nick: limpiar(nick), codigo: c || null, apariencia: { ...APARIENCIA }, partidas: {}, creado: new Date().toISOString() };
      nuevo = true;
    }
    d.sesion.jugador = id;
    guardar(d);
    return { jugador: d.jugadores[id], nuevo };
  }
  function jugadorActual() { const d = leer(); return d.jugadores[d.sesion.jugador] || null; }
  function salirJugador() { const d = leer(); d.sesion.jugador = null; guardar(d); }

  async function guardarApariencia(ap) {
    const d = leer();
    const j = d.jugadores[d.sesion.jugador];
    if (!j) throw new Error('Primero escribe tu nickname.');
    j.apariencia = { ...APARIENCIA, ...j.apariencia, ...ap };
    guardar(d);
    return j;
  }

  // Ligar (o cambiar) el profe a cargo después de creado el perfil.
  async function vincularJugador(codigo) {
    const c = limpiar(codigo).toUpperCase();
    if (!profePorCodigo(c)) throw new Error('No encontramos ese código de grupo.');
    const d = leer();
    const j = d.jugadores[d.sesion.jugador];
    if (!j) throw new Error('Primero escribe tu nickname.');
    const nuevoId = idJugador(j.nick, c);
    if (d.jugadores[nuevoId] && nuevoId !== j.id) throw new Error('En ese grupo ya hay alguien con tu nickname. Elige otro nickname.');
    delete d.jugadores[j.id];
    j.id = nuevoId; j.codigo = c;
    d.jugadores[nuevoId] = j;
    d.evidencias.forEach(e => { e.jugadores = e.jugadores.map(x => (x === j.id ? nuevoId : x)); });
    d.sesion.jugador = nuevoId;
    guardar(d);
    return j;
  }

  async function registrarPartida(juego, datos) {
    const d = leer();
    const j = d.jugadores[d.sesion.jugador];
    if (!j) return null;
    (j.partidas[juego] = j.partidas[juego] || []).push({ fecha: new Date().toISOString(), ...datos });
    guardar(d);
    return j;
  }

  function resumen(j, juego) {
    const lista = (j.partidas && j.partidas[juego]) || [];
    if (!lista.length) return { veces: 0, mejor: 0, diploma: false, ultima: null };
    return {
      veces: lista.length,
      mejor: Math.max(...lista.map(p => p.puntos || 0)),
      diploma: lista.some(p => p.diploma),
      ultima: lista[lista.length - 1].fecha,
    };
  }

  async function jugadoresDelProfe() {
    const p = profeActual();
    if (!p) return [];
    return Object.values(leer().jugadores).filter(j => j.codigo === p.codigo).sort((a, b) => a.nick.localeCompare(b.nick, 'es'));
  }

  /* ---------- evidencias de clase (archivos en IndexedDB) ---------- */

  function bd() {
    return new Promise((ok, mal) => {
      const r = indexedDB.open('gu-evidencias', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('archivos');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }
  async function guardarArchivo(id, archivo) {
    const db = await bd();
    return new Promise((ok, mal) => {
      const t = db.transaction('archivos', 'readwrite');
      t.objectStore('archivos').put(archivo, id);
      t.oncomplete = () => ok(); t.onerror = () => mal(t.error);
    });
  }
  async function leerArchivo(id) {
    const db = await bd();
    return new Promise((ok, mal) => {
      const r = db.transaction('archivos').objectStore('archivos').get(id);
      r.onsuccess = () => ok(r.result || null); r.onerror = () => mal(r.error);
    });
  }
  async function borrarArchivo(id) {
    const db = await bd();
    return new Promise(ok => { const t = db.transaction('archivos', 'readwrite'); t.objectStore('archivos').delete(id); t.oncomplete = () => ok(); });
  }

  async function crearEvidencia({ titulo, descripcion, fecha, jugadores, archivo }) {
    const p = profeActual();
    if (!p) throw new Error('Ingresa como profe.');
    if (!limpiar(titulo)) throw new Error('Ponle un título a la actividad.');
    if (archivo && archivo.size > 8 * 1024 * 1024) throw new Error('El archivo pesa más de 8 MB. Reduce la foto o el documento.');
    const id = 'ev-' + Date.now() + '-' + aleatorioTexto(4);
    if (archivo) await guardarArchivo(id, archivo);
    const d = leer();
    d.evidencias.push({
      id, profe: llave(p.nick), titulo: limpiar(titulo), descripcion: limpiar(descripcion), fecha: fecha || new Date().toLocaleDateString('en-CA'),
      jugadores: jugadores || [], archivo: archivo ? { nombre: archivo.name, tipo: archivo.type, tamano: archivo.size } : null, creado: new Date().toISOString(),
    });
    guardar(d);
  }
  async function evidenciasDelProfe() {
    const p = profeActual();
    if (!p) return [];
    return leer().evidencias.filter(e => e.profe === llave(p.nick)).sort((a, b) => (b.fecha + b.creado).localeCompare(a.fecha + a.creado));
  }
  async function borrarEvidencia(id) {
    const d = leer();
    const p = profeActual();
    d.evidencias = d.evidencias.filter(e => !(e.id === id && p && e.profe === llave(p.nick)));
    guardar(d);
    await borrarArchivo(id);
  }

  window.GU_DATOS = {
    JUEGOS, APARIENCIA, validarNick,
    crearProfe, ingresarProfe, salirProfe, profeActual, profePorCodigo,
    entrarJugador, jugadorActual, salirJugador, guardarApariencia, vincularJugador, registrarPartida, resumen, jugadoresDelProfe,
    crearEvidencia, evidenciasDelProfe, borrarEvidencia, leerArchivo,
  };
})();
