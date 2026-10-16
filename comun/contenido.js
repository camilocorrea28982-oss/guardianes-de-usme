/*
 * Guardianes de Usme · contenido del recorrido
 *
 * TODO ESTE CONTENIDO ES UN BORRADOR PARA EL PROTOTIPO Y ESTÁ POR VALIDAR
 * con sabedores y sabedoras, la Mesa Usmeka, el Semillero Usmeka, el equipo
 * del Parque Arqueológico (Hacienda El Carmen), el ICANH y docentes.
 * Las fechas y datos marcados con «por validar» no se deben publicar sin revisión.
 *
 * Cada estación tiene dos versiones del texto:
 *   peques  → 6 a 8 años: frases cortas, todo se narra, preguntas con dibujos.
 *   grandes → 9 a 12 años: un poco más de información y preguntas para pensar.
 *
 * Para cambiar el contenido basta con editar este archivo: los tres prototipos lo leen.
 */
(function () {
  const PERSONAJES = {
    rosa:   { nombre: 'Doña Rosa',   quien: 'Sabedora campesina de Usme',     emoji: '👵🏽', color: '#c0562f', sonido: 'voz-humana' },
    tita:   { nombre: 'Tita',        quien: 'Una tingua bogotana',             emoji: '🐦',  color: '#3d6f8f', sonido: 'tingua' },
    julian: { nombre: 'Julián',      quien: 'Arqueólogo del parque',           emoji: '🧑🏽‍🔬', color: '#7a5c3e', sonido: 'voz-humana' },
    rita:   { nombre: 'Rita',        quien: 'Una rana sabanera',               emoji: '🐸',  color: '#4f8a3c', sonido: 'rana' },
    cuqui:  { nombre: 'Cuqui',       quien: 'Un curí de la huerta',            emoji: '🐹',  color: '#a87432', sonido: 'curi' },
    tomas:  { nombre: 'Tomás',       quien: 'Un oso de anteojos del Sumapaz',  emoji: '🐻',  color: '#4a3b31', sonido: 'oso' },
  };

  const ESTACIONES = [
    {
      id: 'entrada',
      nombre: 'La entrada al territorio',
      personaje: 'rosa',
      ambiente: ['viento-suave', 'pajaros'],
      color: '#d9b45a',
      escena: 'Estás en la entrada de la antigua Hacienda El Carmen. Hay potreros, cercas de madera y montañas verdes alrededor. Doña Rosa te espera junto a un árbol.',
      semilla: { nombre: 'Semilla de la memoria', emoji: '🌰' },
      peques: {
        historia: [
          '¡Hola! Soy Doña Rosa. Bienvenido, bienvenida a Usme.',
          'Esta tierra es muy antigua. Aquí vivieron los abuelos y las abuelas muiscas.',
          'Debajo de la tierra encontraron sus tumbas y sus vasijas.',
          'Por eso cuidamos este lugar: aquí vive nuestra memoria.',
        ],
        pregunta: {
          texto: '¿Qué encontraron debajo de la tierra en este lugar?',
          opciones: [
            { texto: 'Tumbas y vasijas de los abuelos', emoji: '🏺', correcta: true },
            { texto: 'Huesos de dinosaurio', emoji: '🦖' },
            { texto: 'Carros viejos', emoji: '🚗' },
          ],
          pista: 'Piensa en lo que te conté de los abuelos y las abuelas muiscas.',
          acierto: '¡Muy bien! Encontraron tumbas y vasijas de los pueblos que vivieron aquí.',
        },
      },
      grandes: {
        historia: [
          '¡Hola! Soy Doña Rosa. Mi familia ha sembrado en Usme por muchas generaciones.',
          'En 2007, cuando iban a construir casas en esta hacienda, aparecieron tumbas, huesos y vasijas de los pueblos muiscas. (Fecha por validar.)',
          'Los arqueólogos dicen que es uno de los lugares más importantes para conocer a quienes vivieron en la sabana hace siglos.',
          'Por eso la comunidad pidió que se protegiera como parque arqueológico, en vez de construir encima.',
        ],
        pregunta: {
          texto: '¿Por qué este lugar se protege como parque arqueológico?',
          opciones: [
            { texto: 'Porque guarda la memoria de los pueblos que vivieron aquí', emoji: '🏺', correcta: true },
            { texto: 'Porque hay oro escondido para sacar y vender', emoji: '💰' },
            { texto: 'Porque van a hacer un parque de diversiones', emoji: '🎢' },
          ],
          pista: 'Lo que hay bajo la tierra no es un tesoro para vender: cuenta una historia.',
          acierto: '¡Exacto! El parque protege la memoria de los pueblos muiscas y de la comunidad de Usme.',
        },
      },
    },
    {
      id: 'humedal',
      nombre: 'El río Tunjuelo y el humedal',
      personaje: 'tita',
      ambiente: ['agua', 'pajaros', 'tingua'],
      color: '#5fa3c9',
      escena: 'Llegas a la orilla del río Tunjuelo. Escuchas el agua corriendo. Entre los juncos hay un pájaro de patas largas: es Tita, la tingua.',
      semilla: { nombre: 'Semilla de junco', emoji: '🌾' },
      peques: {
        historia: [
          '¡Cui, cui! Soy Tita, la tingua bogotana.',
          'Vivo entre los juncos, donde el agua es tranquila.',
          'Este río se llama Tunjuelo. Baja de las montañas hasta la ciudad.',
          'Si el río está limpio, mis hijitos y yo podemos vivir aquí.',
        ],
        pregunta: {
          texto: '¿Dónde vive Tita, la tingua?',
          opciones: [
            { texto: 'En el humedal, entre los juncos', emoji: '💧', correcta: true },
            { texto: 'En el desierto', emoji: '🏜️' },
            { texto: 'En un edificio', emoji: '🏢' },
          ],
          pista: 'Tita dijo que vive donde el agua es tranquila.',
          acierto: '¡Sí! Tita vive en el humedal, entre los juncos.',
        },
      },
      grandes: {
        historia: [
          '¡Cui, cui! Soy Tita, una tingua bogotana. Solo vivimos en los humedales de esta región y quedamos muy pocas.',
          'El río Tunjuelo nace arriba, en el páramo de Sumapaz, y atraviesa Usme hasta llegar al río Bogotá.',
          'Se dice que su nombre viene de los «tunjos», figuras que los muiscas ofrendaban en el agua. (Por validar.)',
          'Cuando botan basura o aguas sucias al río, los humedales se secan y yo me quedo sin casa.',
        ],
        pregunta: {
          texto: '¿Dónde nace el río Tunjuelo?',
          opciones: [
            { texto: 'En el páramo de Sumapaz', emoji: '⛰️', correcta: true },
            { texto: 'En el mar', emoji: '🌊' },
            { texto: 'En una fábrica de Bogotá', emoji: '🏭' },
          ],
          pista: 'Tita dijo que el río nace arriba, en las montañas.',
          acierto: '¡Muy bien! El Tunjuelo nace en el páramo de Sumapaz.',
        },
      },
    },
    {
      id: 'ancestros',
      nombre: 'El lugar de los ancestros',
      personaje: 'julian',
      ambiente: ['viento-suave'],
      color: '#a07b56',
      escena: 'Llegas a una explanada tranquila donde estuvieron las tumbas. Hay piedras en círculo y mucho silencio. Julián, el arqueólogo, te saluda en voz baja.',
      semilla: { nombre: 'Semilla del respeto', emoji: '🪶' },
      peques: {
        historia: [
          'Hola, soy Julián. Aquí hablamos bajito.',
          'En este lugar descansan los abuelos y las abuelas de hace mucho tiempo.',
          'Los arqueólogos estudiamos con cuidado lo que dejaron, sin dañarlo.',
          'Para muchas personas este es un lugar sagrado. Lo cuidamos con respeto.',
        ],
        pregunta: {
          texto: '¿Cómo nos portamos en el lugar de los ancestros?',
          opciones: [
            { texto: 'Caminamos con calma y respeto', emoji: '🤫', correcta: true },
            { texto: 'Tiramos basura', emoji: '🗑️' },
            { texto: 'Excavamos para llevarnos cosas', emoji: '⛏️' },
          ],
          pista: 'Julián dijo que aquí hablamos bajito y cuidamos el lugar.',
          acierto: '¡Así es! Aquí caminamos con calma y respeto.',
        },
      },
      grandes: {
        historia: [
          'Hola, soy Julián, arqueólogo. Bienvenido, bienvenida al lugar de los ancestros.',
          'Aquí se encontraron muchísimas tumbas con huesos, vasijas, collares y herramientas. Nos cuentan cómo vivían, qué comían y cómo despedían a sus muertos.',
          'Para las comunidades y los sabedores es un lugar sagrado: la morada de los abuelos. Por eso aquí no se juega ni se hace negocio. (Por validar con sabedores.)',
          'La arqueología no es buscar tesoros: es escuchar con cuidado lo que la tierra guarda.',
        ],
        pregunta: {
          texto: 'Si encuentras una vasija antigua en tu barrio, ¿qué haces?',
          opciones: [
            { texto: 'La dejo donde está y aviso a quienes cuidan el patrimonio', emoji: '📣', correcta: true },
            { texto: 'La vendo en internet', emoji: '💻' },
            { texto: 'La rompo para ver qué tiene adentro', emoji: '🔨' },
          ],
          pista: 'Recuerda: lo que guarda la tierra cuenta una historia de todos.',
          acierto: '¡Muy bien! Si la dejas en su lugar y avisas, ayudas a cuidar la memoria de todos.',
        },
      },
    },
    {
      id: 'quebrada',
      nombre: 'La quebrada del bosque',
      personaje: 'rita',
      ambiente: ['agua', 'ranas', 'grillos'],
      color: '#4f8a3c',
      escena: 'Entras a un bosque húmedo con árboles bajos y musgo. Una quebrada pequeña corre entre las piedras. Sobre una hoja está Rita, la rana.',
      semilla: { nombre: 'Semilla de encenillo', emoji: '🍃' },
      peques: {
        historia: [
          '¡Croac! Soy Rita, la rana sabanera.',
          'De noche canto con mis amigas en la quebrada.',
          'Yo tomo agua por la piel. Por eso necesito agua muy limpia.',
          'Si escuchas ranas cantando, ¡el agua está sana!',
        ],
        pregunta: {
          texto: 'Si las ranas cantan en la quebrada, ¿cómo está el agua?',
          opciones: [
            { texto: 'Limpia y sana', emoji: '💧', correcta: true },
            { texto: 'Llena de aceite', emoji: '🛢️' },
            { texto: 'Hirviendo', emoji: '🔥' },
          ],
          pista: 'Rita dijo que necesita agua muy limpia para vivir.',
          acierto: '¡Sí! Si las ranas cantan, el agua está limpia y sana.',
        },
      },
      grandes: {
        historia: [
          '¡Croac! Soy Rita, una rana sabanera. Puedo ser verde o café, y canto de noche.',
          'Las ranas respiramos y tomamos agua a través de la piel. Por eso sentimos primero que nadie cuando el agua se ensucia.',
          'Este bosque altoandino, con encenillos y musgos, atrapa la niebla como una esponja y la suelta poco a poco en las quebradas.',
          'Cuando talan el bosque, la quebrada se seca y nosotras desaparecemos.',
        ],
        pregunta: {
          texto: '¿Por qué las ranas nos avisan si el agua está sana?',
          opciones: [
            { texto: 'Porque respiran y toman agua por la piel', emoji: '🐸', correcta: true },
            { texto: 'Porque saben leer los avisos', emoji: '📖' },
            { texto: 'Porque no les gusta el sol', emoji: '☀️' },
          ],
          pista: 'Rita contó algo especial de su piel.',
          acierto: '¡Exacto! Su piel absorbe el agua, por eso las ranas sienten primero la contaminación.',
        },
      },
    },
    {
      id: 'huerta',
      nombre: 'La huerta y el calendario',
      personaje: 'cuqui',
      ambiente: ['pajaros', 'grillos'],
      color: '#c99a3b',
      escena: 'Llegas a una huerta con surcos de maíz, papa y cubios. Hay un círculo de piedras para mirar el sol. Entre las matas asoma Cuqui, el curí.',
      semilla: { nombre: 'Semilla de maíz', emoji: '🌽' },
      peques: {
        historia: [
          '¡Ñi, ñi! Soy Cuqui, el curí.',
          'Los abuelos muiscas sembraban maíz, papa y cubios.',
          'Miraban el sol y la luna para saber cuándo sembrar.',
          'Hoy las familias campesinas de Usme siguen sembrando la tierra.',
        ],
        pregunta: {
          texto: '¿Qué sembraban los abuelos muiscas?',
          opciones: [
            { texto: 'Maíz y papa', emoji: '🌽', correcta: true },
            { texto: 'Chocolatinas', emoji: '🍫' },
            { texto: 'Pizza', emoji: '🍕' },
          ],
          pista: 'Mira la huerta: ¿qué plantas ves?',
          acierto: '¡Muy bien! Sembraban maíz, papa y cubios.',
        },
      },
      grandes: {
        historia: [
          '¡Ñi, ñi! Soy Cuqui, un curí. Los muiscas criaban curíes y sembraban maíz, papa, cubios, ibias y frijol.',
          'Observaban con cuidado el sol y la luna para llevar un calendario: así sabían cuándo sembrar y cuándo cosechar.',
          'Ese saber no se perdió: las familias campesinas de Usme todavía siembran según las lunas y guardan sus semillas.',
          'Cuidar las semillas nativas es cuidar la comida y la memoria del territorio.',
        ],
        pregunta: {
          texto: '¿Para qué observaban el sol y la luna los pueblos muiscas?',
          opciones: [
            { texto: 'Para saber cuándo sembrar y cosechar', emoji: '🌙', correcta: true },
            { texto: 'Para saber la hora del bus', emoji: '🚌' },
            { texto: 'Solo porque eran bonitos', emoji: '✨' },
          ],
          pista: 'Cuqui habló de un calendario para la huerta.',
          acierto: '¡Exacto! El sol y la luna eran su calendario para sembrar y cosechar.',
        },
      },
    },
    {
      id: 'paramo',
      nombre: 'El mirador del páramo',
      personaje: 'tomas',
      ambiente: ['viento-fuerte', 'pajaros-lejos'],
      color: '#9aa86a',
      escena: 'Subes a un mirador frío y con viento. Ves frailejones y, a lo lejos, las montañas del Sumapaz entre la niebla. Tomás, el oso de anteojos, mira el paisaje.',
      semilla: { nombre: 'Semilla de frailejón', emoji: '🌼' },
      peques: {
        historia: [
          'Hola, amiguito, amiguita. Soy Tomás, el oso de anteojos.',
          'Allá arriba está el páramo de Sumapaz, mi casa.',
          'Los frailejones guardan el agua de la niebla, como esponjas.',
          'Esa agua baja por los ríos y llega a tu casa. ¡El páramo nos regala agua!',
        ],
        pregunta: {
          texto: '¿Qué nos regala el páramo?',
          opciones: [
            { texto: 'Agua', emoji: '💧', correcta: true },
            { texto: 'Helado', emoji: '🍦' },
            { texto: 'Celulares', emoji: '📱' },
          ],
          pista: 'Tomás dijo que el agua baja del páramo hasta tu casa.',
          acierto: '¡Sí! El páramo nos regala agua.',
        },
      },
      grandes: {
        historia: [
          'Hola. Soy Tomás, un oso de anteojos. Las manchas claras de mi cara parecen gafas, por eso me llaman así.',
          'Allá está el Sumapaz, el páramo más grande del mundo. Usme es la puerta de entrada.',
          'Los frailejones crecen muy despacio: más o menos un centímetro por año. Uno de dos metros puede tener ¡doscientos años!',
          'El páramo atrapa la niebla y la lluvia y llena los ríos que dan agua a Bogotá. Si lo cuidamos, nos cuida.',
        ],
        pregunta: {
          texto: '¿Cuánto crece más o menos un frailejón en un año?',
          opciones: [
            { texto: 'Un centímetro', emoji: '🐌', correcta: true },
            { texto: 'Un metro', emoji: '📏' },
            { texto: 'Diez metros', emoji: '🏢' },
          ],
          pista: 'Tomás dijo que crecen muy, muy despacio.',
          acierto: '¡Exacto! Un centímetro por año. Por eso no hay que arrancarlos nunca.',
        },
      },
    },
  ];

  const AVATARES = [
    { id: 'nina',  nombre: 'Niña',                       emoji: '👧🏽' },
    { id: 'nino',  nombre: 'Niño',                       emoji: '👦🏽' },
    { id: 'silla', nombre: 'Persona en silla de ruedas', emoji: '🧑🏽‍🦽' },
  ];

  const RUANAS = [
    { id: 'roja',     nombre: 'Roja',     color: '#c0392b' },
    { id: 'azul',     nombre: 'Azul',     color: '#2e6da4' },
    { id: 'verde',    nombre: 'Verde',    color: '#3c8d4f' },
    { id: 'amarilla', nombre: 'Amarilla', color: '#e0a526' },
  ];

  // Puntaje: 3 puntos si aciertas al primer intento, 2 al segundo, 1 después.
  // Cada semilla encontrada en el camino suma 1 punto.
  const PUNTOS = { primerIntento: 3, segundoIntento: 2, despues: 1, semilla: 1 };

  window.GU_CONTENIDO = { PERSONAJES, ESTACIONES, AVATARES, RUANAS, PUNTOS };
})();
