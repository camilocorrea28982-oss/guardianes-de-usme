# Contrato entre la capa común y cada mundo

Los tres prototipos comparten `comun/` (contenido, voz, sonido, accesibilidad,
preguntas y puntaje). Cada prototipo **solo** dibuja el mundo y mueve al personaje.
Así, cambiar un texto o una pregunta en `comun/contenido.js` cambia los tres a la vez,
y la accesibilidad se resuelve una sola vez y en HTML real (no dentro del dibujo).

## Estructura de la página de un mundo

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Guardianes de Usme · <nombre del prototipo></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Baloo+2:wght@600;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="../comun/estilos.css">
</head>
<body>
  <main id="mundo" aria-label="Dibujo del parque. Todo lo importante se cuenta en texto y voz."></main>
  <script src="../vendor/<librería>.js"></script>
  <script src="../comun/contenido.js"></script>
  <script src="../comun/audio.js"></script>
  <script src="../comun/voz.js"></script>
  <script src="../comun/juego.js"></script>
  <script src="mundo.js"></script>
</body>
</html>
```

Todo debe abrir con doble clic (`file://`), sin servidor y sin internet: no cargar
imágenes ni audios externos; los dibujos se generan con código.

**Celular acostado.** Un mundo que deba jugarse en horizontal carga
`<script src="../comun/horizontal.js"></script>` antes de los demás: en vertical tapa
la pantalla con «Gira tu celular» y pausa el juego (`GU.pausado()` lo tiene en cuenta);
en Android, al primer toque, pone pantalla completa y fija la orientación. Hoy lo usan
la plataforma (`index.html`) y el mapa. Los estilos compactos para poca altura van en
`@media (orientation: landscape) and (max-height: 500px)` de la página del mundo.

## API `window.GU`

| Llamada | Para qué |
|---|---|
| `GU.montar({ nombre })` | Se llama una vez al cargar. Muestra la pantalla de inicio. |
| `GU.on('empezar', cfg => …)` | El niño tocó «¡Empezar!». Arranca el mundo con `cfg`. |
| `GU.on('config', cfg => …)` | Cambió una opción (p. ej. `cfg.reducirMovimiento`, `cfg.contraste`). |
| `GU.on('avanzar', i => …)` | Modo guiado/pulsador o botón «Llévame»: caminar **solo** hasta la estación `i` y, al llegar, llamar `GU.llegar(i)`. |
| `GU.on('conversacion', ({indice, abierta}) => …)` | Se abrió/cerró una conversación (p. ej. girar la cámara hacia el personaje). |
| `GU.pausado()` | `true` mientras hay conversación, panel abierto o no ha empezado: no mover al personaje. |
| `GU.entrada()` | `{x, y}` entre −1 y 1 (teclado + joystick). `y = -1` es «adelante / arriba». |
| `GU.zona(i)` | Índice de la estación más cercana (cambia el sonido de fondo). Llamarlo seguido; no repite. |
| `GU.cerca(i \| -1)` | Si el personaje está a distancia de conversación de la estación `i`. En modo libre abre la conversación sola la primera vez. |
| `GU.llegar(i)` | Abre la conversación de la estación `i` (devuelve una promesa que se resuelve al cerrar). |
| `GU.paso()` | Sonido de un paso (o de rueda si eligió silla de ruedas). Llamarlo cada ~0,35 s mientras camina. |
| `GU.recoger(i)` | Recogió la semilla escondida cerca de la estación `i` (+1 estrella). En modo guiado se recoge sola al pasar. |
| `GU.on('recogida', i => …)` | Se recogió la semilla `i` (para animarla). |
| Clase `gu-extra` | Un botón propio del mundo con esta clase entra en el recorrido del pulsador. Usa también `gu-btn` para que se vea igual. |
| `GU.estaciones` | Las 6 estaciones: `nombre`, `personaje`, `color`, `semilla`, `escena`… |
| `GU.personaje(i)` | `{ nombre, emoji, color, … }` del personaje de la estación `i`. |
| `GU.avatar()` | `{ id: 'nina' \| 'nino' \| 'silla' }` — el personaje elegido. **La silla de ruedas debe dibujarse.** |
| `GU.colorRuana()` | Color de la ruana del personaje. |
| `GU.siguiente()` | Próxima estación sin completar (−1 si ya terminó). |
| `GU.completada(i)` | Si ya respondió la pregunta de esa estación. |
| `GU.config` | Configuración actual (`nivel`, `control`, `reducirMovimiento`, `contraste`…). |

## Reglas de accesibilidad para el mundo

- El dibujo lleva `aria-hidden` o un `aria-label` general: lo importante ya se dice en texto y voz.
- Con `cfg.reducirMovimiento`: sin balanceo de cámara, sin sacudidas, transiciones cortas.
- Con `cfg.contraste`: colores más fuertes y contornos marcados en personajes y camino.
- El camino debe verse claro y continuo; las estaciones con un marcador visible de lejos
  (color de la estación + figura del personaje) y una señal de «aquí sigue» en la próxima.
- Nada de tiempo límite, nada de perder vidas. Si se sale del camino, no pasa nada malo.
- Debe funcionar en celular (táctil), en computador de colegio (teclado y mouse) y proyectado.
