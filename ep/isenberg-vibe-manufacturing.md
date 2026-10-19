# YA ESTÁ AQUÍ LA VIBE MANUFACTURING

Por Greg Isenberg

Por PRIMERA VEZ en la HISTORIA, puedes describir un producto físico en una frase y, una semana después, tenerlo en las manos, cortado en metal y hecho a tus medidas exactas.

Eso es la VIBE MANUFACTURING, la fabricación «a golpe de intuición», y está a punto de hacerles a los productos físicos lo que el vibe coding le hizo al software. Quizá no hoy, pero sí en los próximos 24 meses.

El vibe coding permitió crear aplicaciones a gente que nunca había escrito código. La vibe manufacturing permite a cualquiera fabricar cosas reales. Describes lo que quieres. Una IA lo convierte en un archivo de diseño preciso. Una impresora encima de tu mesa lo prueba durante la noche. Una fábrica que encontraste en una web te da presupuesto en segundos y te envía las piezas en días. Un chip de 5 dólares lo vuelve inteligente y tu agente de IA lo maneja.

Ya está pasando sin hacer ruido. Unas 30.000 personas tienen ya una impresora 3D funcionando más de siete horas al día, según Bambu Lab, la empresa que fabrica las impresoras de consumo más populares del mundo. Eso es una jornada completa. Están montando pequeñas fábricas en habitaciones libres y garajes, imprimiendo productos, vendiéndolos en Etsy y TikTok Shop y volviendo a imprimir lo que se vende. La web de Bambu para compartir diseños, MakerWorld, tiene 10 millones de usuarios al mes y 2,6 millones de diseños originales, y sus usuarios registraron 290 millones de horas de impresión en 2025. Dentro de las casas de la gente está creciendo una economía manufacturera oculta, y la IA está a punto de echarle gasolina.

Esta es la guía COMPLETA de la vibe manufacturing. Si alguna vez has querido fabricar un producto físico, o si buscas la próxima gran oportunidad de negocio en IA, es para ti. Hablaré de qué ha cambiado, de cómo fabricar tu primer producto real paso a paso, de las oportunidades de negocio a las que yo iría y de cómo encajan los agentes personales y cosas como Hugging Face.

### Por qué el hardware era tan difícil

En Silicon Valley hay una frase antigua que dice que el hardware es difícil, y durante décadas fue lo más cierto que nadie decía. Tengo esa frase grabada a fuego en el cerebro de tanto oírsela a inversores de capital riesgo.

Si en 2010 querías fabricar un producto físico, esto es lo que te esperaba. Contratabas a un diseñador industrial para que lo bocetara y a un ingeniero mecánico para que convirtiera el boceto en archivos CAD. Volabas a Shenzhen, recorrías fábricas e intentabas averiguar cuáles se tomarían en serio un pedido pequeño. Pagabas decenas de miles de dólares por un molde de inyección antes de que existiera una sola unidad. Pedías 5.000 unidades porque ese era el mínimo, las guardabas en un almacén y rezabas para que la gente quisiera las 5.000. Si una medida estaba mal, volvías a pagar el molde.

La era de Kickstarter entreabrió la puerta. Recuerdo cuando Pebble recaudó más de 10 millones de dólares para un reloj inteligente en 2012 y, de repente, equipos pequeños podían financiar los utillajes con reservas anticipadas. Pero una enorme proporción de esos proyectos se entregaron tarde, reventaron su presupuesto o murieron en la fábrica, porque las partes difíciles seguían siendo difíciles. Seguías necesitando a alguien que hablara CAD, a alguien que entendiera cómo piensan las fábricas y un montón de dinero inmovilizado en inventario.

Así que el hardware siguió siendo un juego para empresas con mucha financiación, y a todos los demás les tocó el producto medio diseñado para el cliente medio.

### Los cuatro cambios que lo cambiaron todo

El software pasó por lo mismo y salió por el otro lado. Primero necesitabas ingenieros. Luego las herramientas sin código permitieron a quienes no eran ingenieros crear cositas sencillas. Luego la programación con IA permitió que casi cualquiera construyera casi cualquier cosa. El hardware está viviendo ahora mismo su versión de ese momento, porque han pasado 4 cosas más o menos a la vez.

1/ El diseño se convirtió en código.

Hay toda una familia de herramientas CAD, como OpenSCAD y CadQuery, en las que una pieza se escribe con unas pocas líneas de código en lugar de dibujarse con el ratón. Una caja con las esquinas redondeadas y cuatro agujeros para tornillos no es más que un script corto con números. En teoría, cualquier IA que escriba código podría escribir piezas. En la práctica, durante años los resultados fueron sobre todo juguetes.

Entonces, el mes pasado, OpenAI lanzó GPT 6 Astra, y ese fue el momento en que mucha gente empezó a creer que la IA podía hacer CAD de verdad (yo incluido). OpenAI lo probó en un nuevo banco de pruebas llamado BenchCAD, en el que el modelo mira fotos de un objeto desde varios ángulos y tiene que reconstruirlo escribiendo código CAD. Astra obtuvo un 95,9 %, muy por delante de todo lo anterior.

En cuestión de días, la gente ya estaba haciendo «vibe CAD». Alguien en un foro de FIRST Robotics conectó Astra a Autodesk Inventor y le hizo diseñar en unas 7 horas todo el sistema de recogida de un robot, con reductoras y articulaciones plegables incluidas. Todavía tenía fallos que tuvo que corregir una persona, pero hace un año eso eran días de trabajo para un ingeniero experto.

Ahora puedes describir una pieza en lenguaje normal, o enseñarle unas cuantas fotos, y recibir un diseño preciso y editable. Una locura.

Y una oleada de startups compite por hacerlo aún más fácil. Text-to-CAD, de Zoo, convierte una frase en un archivo CAD real en un solo paso. Adam, que sale de Y Combinator, cerró una ronda semilla el pasado octubre y ya tiene decenas de miles de usuarios que diseñan piezas chateando con él. Backflip, fundada por los creadores de la empresa de impresoras 3D Markforged, recaudó 30 millones de dólares de NEA y a16z, y uno de sus mejores trucos es el escaneo a CAD: apuntas un escáner 3D a un objeto físico y obtienes un modelo CAD editable.

Todo está en sus inicios, pero ha empezado.

2/ Las fábricas se convirtieron en API.

Sube un archivo de diseño a SendCutSend, Xometry, Protolabs o JLCPCB y obtienes un precio al instante, sin llamadas, sin mínimos y sin necesidad de tener una relación. Las piezas suelen enviarse en cuestión de días, y puedes pedir exactamente una.

Solo Xometry facturó 630 millones de dólares en su mercado en 2025, con un crecimiento del 30 %, y tiene unas 5.000 fábricas y talleres mecánicos al otro lado de su web. Piensa en lo que significa. Ahora existe una nube de fábricas que puedes alquilar por pieza, igual que AWS te permite alquilar servidores por horas.

3/ Lo inteligente se abarató.

El ESP32 es un chip con wifi y Bluetooth que cuesta unos pocos dólares y puede mover un motor, leer un sensor, encender un LED y hablar con tu móvil. Hace veinte años, meter un ordenador conectado dentro de un producto era un proyecto para un equipo de ingenieros eléctricos. Hoy es una pieza de 5 dólares y probablemente 3 horas.

4/ Cada casa tiene ahora una fábrica.

Este es el cambio que la gente infravalora. Bambu Lab hizo impresoras 3D que funcionan nada más sacarlas de la caja y, según algunas estimaciones, sus ventas se triplicaron más o menos el año pasado. Una máquina de entre 300 y 600 dólares imprime ahora piezas que hace una década habrían necesitado un taller profesional. Eso significa que puedes probar un diseño en tu mesa durante la noche, corregirlo por la mañana y volver a probarlo esa misma noche. Iterar en hardware solía llevar meses. Ahora va casi a la velocidad del software.

Recuerdo que, cuando estaba en la universidad (allá por 2009 y 2010), la impresión 3D personal empezaba a despegar, pero era cara y, ah, sí, necesitabas muchísimo para conseguir que imprimiera algo que valiera la pena. Ya no estamos en esa época.

Cualquiera de estos cambios por separado es interesante. Los cuatro juntos cambian quién puede fabricar cosas.

### Los productos se están convirtiendo en archivos

No dejo de darle vueltas a esto.

A lo largo de toda la historia, un producto era un objeto físico. El valor estaba en el inventario. Si fabricabas estanterías, tu negocio eran las 5.000 estanterías que había en un almacén, y tu mayor riesgo era que nadie las quisiera.

En la vibe manufacturing, el producto es un archivo. Más concretamente, es un diseño escrito como código, con cada dimensión importante guardada como una variable al principio: el ancho, el alto, el grosor, la separación entre agujeros. Cambias un número y todo el diseño se reconstruye solo. Ese archivo puede producir una estantería para mi pared y otra ligeramente distinta para la tuya, y ninguna de las dos existe hasta que alguien la paga.

Lo realmente chulo es que se trata de un modelo de negocio completamente distinto. Los bienes físicos empiezan a comportarse como el software. La parte cara, el diseño, se hace una sola vez. Cada copia a partir de ahí se personaliza gratis y se fabrica bajo demanda. No hay almacén ni stock muerto, y los márgenes empiezan a parecerse mucho más a los de una empresa de software que a los de una de hardware.

Ya se puede ver la versión temprana de esto. MakerWorld permite a los diseñadores publicar modelos personalizables, en los que escribes tus medidas y la web genera un archivo que encaja. Las grandes granjas de impresión ofrecen API que se conectan a una tienda de Shopify e imprimen cada pedido en el momento en que se hace. Las piezas de una cadena completa, del archivo de diseño al producto personalizado y a la puerta de casa, ya existen. Simplemente todavía no se han cosido entre sí en la mayoría de las categorías.

Lo otro que pasa cuando los productos se convierten en archivos es que se pueden bifurcar, como el código abierto. El mejor ejemplo es Gridfinity, un sistema de almacenaje de código abierto basado en una sencilla cuadrícula de 42 milímetros que un youtuber llamado Zack Freedman publicó en 2022. Como el estándar era abierto, miles de personas diseñaron cajas, soportes para herramientas y cajones que encajan todos en la misma cuadrícula. Se convirtió en todo un ecosistema con sus propios vendedores, sus propios accesorios y sus propios fans, construido sobre un único archivo gratuito.

Ese es el patrón por el que yo apostaría. Quien cree un gran estándar abierto para una categoría consigue una comunidad que construye sobre él, y quien haga los mejores productos para ese estándar se queda con los clientes.

### Los cacharros que nadie fabricaría

Durante más de 100 años, los productos tenían que diseñarse para el cliente medio, porque la única forma de que salieran las cuentas era fabricar miles de unidades de lo mismo. Eras tú quien adaptaba tu casa, tu mesa y tu vida al producto.

Cuando el diseño es un archivo y la fábrica hace las piezas de una en una, el producto puede adaptarse a ti. Y eso abre una categoría que yo llamo los cacharros que nadie fabricaría. Productos para un mercado de 500 personas, o de 50, o de una. Una gran empresa se reiría del tamaño de ese mercado. Un creador en solitario puede vivir muy bien ahí, porque un producto que encaja a la perfección con 500 personas puede cobrar lo que quiera.

Hay tres sitios en los que yo miraría primero.

1. Accesorios para cosas que la gente ya ha comprado. Cada producto popular crea una larga cola de necesidades que su fabricante nunca va a atender. Alguien compra una bici eléctrica concreta, una cafetera de espresso concreta, una camper concreta, e inmediatamente quiere un soporte, un sujetador, un organizador o una mejora diseñados exactamente para ese modelo. Los mejores nichos van ligados a algo en lo que la gente ya se ha gastado mucho dinero, porque es fácil encontrar a esos propietarios y no les importa gastar un poco más.

2. Piezas de recambio. Millones de electrodomésticos, herramientas y juguetes en perfecto estado acaban en la basura porque se partió una piececita de plástico y el fabricante dejó de hacerla hace años. Con el escaneo a CAD, puedes fotografiar o escanear la pieza rota y recibir un diseño limpio. La gente pagará encantada 40 dólares por una pieza de 2 que salva un lavavajillas de 900, y ya la está buscando, lo que significa que tienes demanda antes de haber fabricado nada.

3. Necesidades raras de empresas. Clínicas veterinarias, peluquerías, restaurantes, laboratorios, gimnasios, propietarios de barcos y contratistas tienen problemas curiosamente específicos para los que nadie fabrica un producto. Un soporte para una tableta en un sitio concreto. Una protección para una máquina. Un soporte para una herramienta que solo existe en un oficio. Las empresas compran más rápido que los consumidores, se fijan menos en el precio y vuelven a por más cuando algo funciona.

Esto es exactamente lo que le pasó al software. Cuando construir se abarató, la gente construyó para nichos diminutos, y muchos de esos nichos resultaron ser negocios de verdad. Los productos físicos están a punto de tener su larga cola.

La misma idea.

### Tus agentes necesitan un cuerpo

Escúchame un momento.

Ahora mismo todos estamos creando agentes personales de IA. Leen nuestro correo, gestionan nuestro calendario, investigan por nosotros y nos hacen recados en internet. Pero viven por completo dentro de pantallas. Tu agente puede contratar a alguien para pasear al perro y seguir sin tener ni idea de si el perro está en casa. Puede hacer la compra y no tiene ni idea de lo que hay en la nevera.

Cada dispositivo inteligente barato que construyes se convierte en un sentido o en una mano para tu agente. Un sensor en el buzón le dice que ha llegado un paquete. Una báscula debajo del bote del café le dice que te queda poco, así que vuelve a pedirlo. Una pequeña pantalla de tinta electrónica junto a la puerta de entrada muestra lo que crea que necesitas saber antes de salir. Una cerradura en la puerta lateral le permite abrirle al paseador del perro a las dos y cerrar a las dos y media.

La fontanería para esto ya existe. Home Assistant, el centro de control de código abierto para casas inteligentes, puede exponer todos los dispositivos de tu casa a un agente de IA mediante MCP, el mismo estándar que usan los agentes para hablar con Gmail o con Notion. Espressif, la empresa que fabrica el ESP32, lanzó el pasado diciembre su propia plataforma de agentes para que los desarrolladores puedan meter un agente de voz capaz de usar herramientas directamente en sus chips. Hay aficionados conectando placas ESP32 que anuncian sus capacidades a un agente en cuanto se conectan, como un empleado nuevo que se presenta: «Sé leer la temperatura, sé abrir la rejilla de ventilación, sé pitar».

Creo que estamos a punto de tener una nueva disciplina de diseño: hardware hecho primero para agentes y después para humanos. He estado hablando de esto con mi estudio de diseño, LCA, y creo que el hardware nativo para agentes tiene unos cuantos rasgos.

1. Se describe a sí mismo. Cuando se conecta, le dice al agente exactamente qué puede detectar y qué puede hacer, en lenguaje llano.

2. Informa de su estado constantemente. Cerrado o abierto con llave, lleno o vacío, abierto o cerrado, para que el agente siempre sepa lo que es cierto.

3. Mantiene un control manual físico. Los agentes se equivocan, así que una persona siempre puede abrir la cerradura, accionar el interruptor o desenchufarlo a mano.

Falla de forma segura. Cuando se cae el wifi, la puerta sigue pudiéndose usar y la estufa se apaga.

Las grandes empresas venderán versiones genéricas de estos dispositivos. Los interesantes serán los personalizados, construidos para una casa, una tienda o un flujo de trabajo concretos por personas que entienden tanto al agente como el espacio físico.

### Cómo usar Hugging Face

Hugging Face es la mayor biblioteca de modelos de IA abiertos del mundo, y desempeña tres papeles muy distintos en la vibe manufacturing. La mayoría de la gente solo conoce el primero, y es el que le mete en líos.

1. Formas. En Hugging Face hay modelos de texto a 3D y de imagen a 3D, como TRELLIS y Hunyuan3D, que convierten una frase o una foto en una forma 3D en segundos. Son fantásticos para todo lo orgánico o decorativo: una figurita, una lámpara escultórica, un tirador con la forma de tu logotipo, una pieza de juego personalizada. Aquí está la trampa. Crean formas que parecen correctas pero miden mal. Lo que producen es una malla, una superficie hecha de miles de triangulitos, sin dimensiones exactas. Una fábrica que corta metal necesita que un agujero de 40 milímetros mida exactamente 40 milímetros. Así que usa los modelos 3D para todo lo que la gente mira, y el CAD basado en código para todo lo que tiene que encajar.

2. Cerebros. Hugging Face también aloja modelos pequeños que funcionan en hardware barato dentro de tu cacharro, sin enviar nada a la nube. Un modelo de voz pequeño como Whisper permite que un dispositivo entienda órdenes habladas. Un modelo de visión diminuto permite que una cámara distinga a tu perro de un mapache. Ya hay módulos adicionales para hardware de la clase del ESP32 que ejecutan un modelo de lenguaje de quinientos millones de parámetros con unos 1,5 vatios, totalmente sin conexión. Para cualquier cosa que esté dentro de la casa de alguien, «nunca envía tus datos a ninguna parte» es un argumento de venta potentísimo, y los modelos abiertos lo hacen posible.

3. Cuerpos. Aquí es donde la cosa se pone salvaje. Hugging Face compró la empresa francesa de robótica Pollen Robotics en abril de 2025 y empezó a lanzar robots de código abierto, entre ellos un pequeño robot de escritorio llamado Reachy Mini que parte de unos 300 dólares. Su proyecto LeRobot regala el software, los conjuntos de datos y los diseños de brazos robóticos de bajo coste que la gente imprime y monta en casa, y a los que luego enseña tareas nuevas mostrándoselas unas cuantas docenas de veces.

Junta esas tres cosas y verás hacia dónde va esto. La misma persona que esta noche imprime una carcasa puede descargarse mañana un modelo de visión y, para el fin de semana, construir un brazo robótico que le clasifique los tornillos. La robótica está siguiendo exactamente el mismo camino que siguió el software, de cerrada y cara a abierta y barata, y Hugging Face intenta ser su GitHub.

### Monta tu taller: la carpeta y los agentes

¿Cómo montas un pequeño equipo de hardware con IA, con agentes, en la plataforma de agentes que prefieras (Hermes, Claude Code, Cursor, etcétera)?

Pues bien, un agente de programación con IA vive dentro de una carpeta de tu ordenador. Lee todos los archivos que hay en ella, ejecuta código y recuerda lo que has decidido porque todo está por escrito. Dale una carpeta bien organizada y deja de adivinar. Esta es la estructura que yo usaría para un proyecto de vibe manufacturing:

Unos pocos de estos archivos hacen la mayor parte del trabajo.

requirements.md: escribe lo que tiene que hacer el producto con números concretos: «aguanta 2 kilos de llaves, sobrevive a un recibidor a 40 °C en verano, se fija con dos tornillos y cuesta menos de 35 dólares fabricarlo». Así, cada diseño que produzca la IA se comprueba contra algo real, en lugar de contra si queda bonito.

factory-rules/ guarda las directrices de diseño de cada fábrica que uses, descargadas y guardadas como texto. La IA las lee antes de diseñar nada, así que deja de dibujar piezas que no se pueden fabricar.

materials.md es donde van las lecciones aprendidas a golpes. «El PLA se combó en un coche al sol». «El aluminio 6061 se agrietó en el doblez; cambiado a 5052». Una línea así te ahorra pagar dos veces por el mismo error.

library/ es tu arma secreta a largo plazo. Cada bisagra, soporte y carcasa que te sale bien se convierte en un bloque de construcción. Para tu quinto producto, el agente se dedica sobre todo a encajar piezas que ya sabes que funcionan.

tests/ está sacado directamente del software. Escribe comprobaciones que el código pueda ejecutar automáticamente: todas las paredes de al menos 2 milímetros de grosor, todos los agujeros al menos tan anchos como el grosor del metal y el conjunto de menos de 300 milímetros de ancho para que quepa en la caja de envío más barata. Cada vez que cambia el diseño se ejecutan las pruebas, y encuentras los problemas en tu pantalla en lugar de en tu buzón.

Los agentes:

Una vez que existe la carpeta, puedes repartir el trabajo entre unos cuantos agentes, cada uno con su propio archivo de instrucciones en agents/. Créalos de uno en uno.

1/ El agente de diseño convierte los requisitos y las medidas en código CAD paramétrico. El truco es que, después de cada cambio, renderice imágenes de la pieza desde tres ángulos y revise su propio trabajo, igual que se revisan a sí mismos los mejores modelos. Así detecta un número sorprendente de sus propios errores.

2/ El agente de fabricabilidad lee el diseño y las normas de la fábrica y devuelve una lista de problemas, cada uno con la línea de código que hay que cambiar y una propuesta de solución. Ejecútalo después de cada cambio de diseño, igual que los equipos de software ejecutan las pruebas antes de publicar.

3/ El agente de compras pide presupuestos a SendCutSend, Xometry y JLCPCB, busca componentes electrónicos en webs como DigiKey y LCSC y mantiene al día bom.csv, la lista de materiales. Prepara los pedidos, y es una persona quien pulsa el botón de comprar.

4/ El agente de firmware escribe la configuración de ESPHome, conecta el dispositivo a Home Assistant y comprueba que cada sensor e interruptor informa correctamente antes de soldar nada.

5/ El agente de costes suma piezas, acabados, embalaje y envío para calcular el coste unitario a 1, 10, 50 y 500 unidades, y te avisa cuando un cambio de diseño baja tu margen por debajo del objetivo. La mayoría de los negocios de hardware mueren porque nadie estaba vigilando esta cifra.

6/ El agente de pedidos es el que convierte todo esto en un negocio. Un cliente introduce sus medidas, el agente las comprueba con los límites de requirements.md, genera los archivos personalizados, los pasa por el agente de fabricabilidad y deja el pedido en cola para que lo apruebes.

Cada agente escribe una línea en build-log.md cuando cambia algo. Cuando una pieza llega mal, puedes rastrear exactamente qué cambio lo provocó, y esa es la diferencia entre un pasatiempo y una empresa.

### Cómo construir tu primera cosa (para venderla o solo para ti)

Vamos a concretar. Pongamos que quieres una estantería de metal estrecha para la entrada que sujete las llaves, la cartera y las gafas de sol, que encaje en el trozo exacto de pared que hay entre el marco de la puerta y el interruptor de la luz, y que le diga a tu agente cuándo has salido por la puerta sin las llaves. Así es como la construiría yo.

Mide como si te fuera el dinero en ello, porque te va. Las malas medidas son la razón número uno por la que fallan las primeras construcciones. La IA diseñará encantada una pieza preciosa que mide 4 milímetros de más, y la fábrica la cortará encantada. Cómprate un calibre digital por unos 25 dólares para todo lo pequeño, como los agujeros de los tornillos o el grosor del llavero del coche. Para la pared en sí, una aplicación de LiDAR para el móvil como Polycam te da la forma general, y un metro te da los números que importan. Apunta todas las medidas en un único archivo de texto con una foto de dónde las tomaste, y mide tres veces las críticas.

Haz que la IA escriba el diseño como código. Describe la pieza a un modelo de frontera y pídele que escriba el diseño en CadQuery o en OpenSCAD. La instrucción puede ser así de sencilla:

Esa frase de poner cada dimensión en una variable es el hábito más importante de toda esta guía. Cuando una medida no cuadra, cambias un número y todo se actualiza. Cuando un amigo quiere una para su pared, cambias tres números. Esa es la semilla de un producto.

Ten claro qué archivo va a cada sitio. STL es para impresión 3D, una malla hecha de triángulos. STEP es el formato universal para piezas 3D precisas y es lo que envías a un taller mecánico. DXF es un dibujo plano en 2D y es lo que envías para chapa cortada con láser. Para piezas dobladas, la mayoría de los talleres de chapa aceptan un archivo STEP de la forma terminada y calculan ellos el desarrollo plano.

Comprueba que de verdad se puede fabricar. Un diseño puede quedar perfecto en pantalla y ser imposible de fabricar. El metal solo se dobla hasta cierto punto, los agujeros solo pueden ser hasta cierto punto pequeños en relación con el material y una herramienta de corte redonda nunca puede hacer una esquina interior perfectamente afilada. El truco es que toda fábrica seria publica sus directrices de diseño. Descárgalas, pégalas en el chat y pide a la IA que compruebe tu diseño con ellas línea por línea. Detectará un agujero demasiado cerca de un doblez, que rasgaría el metal, antes de que te cueste nada.

Imprímelo primero en plástico. Antes de pagar por el metal, imprime una versión en una impresora doméstica. Rara vez necesitas imprimirlo entero. Si la parte arriesgada es cómo se une la estantería a la pared, imprime solo esa esquina: 40 minutos de impresión en lugar de 14 horas. La gente del hardware las llama pruebas de ajuste, y así es como se itera cinco veces en un día. Para piezas grandes y planas, imprime el contorno en papel a tamaño real y pégalo con cinta en la pared. No cuesta nada y detecta la mitad de tus errores.

Paga a un ingeniero por una hora. Antes de tu primer pedido real, busca un ingeniero mecánico en Upwork y págale una hora para que revise los archivos. Hazle tres preguntas: ¿por dónde se va a romper esto? ¿Qué va a rechazar la fábrica? ¿Qué cambiarías para que saliera más barato? Te costará unos 100 dólares y es el seguro más barato que vas a comprar nunca. Un solo comentario como «usa aluminio 5052 en lugar de 6061, porque el 6061 se agrieta al doblarlo» puede salvar un pedido entero.

Mándalo a fabricar. Sube tus archivos y obtén un presupuesto al instante. SendCutSend corta y dobla chapa y también puede roscar, insertar tornillería a presión y pintar las piezas al polvo en tu color, para que lleguen con aspecto de producto terminado. Xometry y Protolabs se encargan del mecanizado CNC, el moldeo por inyección y la impresión 3D industrial en materiales mucho más resistentes que cualquier cosa que vayas a imprimir en casa. JLCPCB y PCBWay fabrican placas de circuito y te sueldan los componentes. Pide dos juegos de piezas. Vas a estropear uno durante el montaje, y el de repuesto cuesta menos que otra semana de espera.

Añade el cerebro. Empieza con una placa de desarrollo ESP32, unos cuantos cables de conexión y un sensor barato, como una pequeña báscula o un interruptor magnético debajo de cada gancho. Para la primera versión no hace falta soldar. Prográmalo con ESPHome, donde en lugar de escribir firmware escribes un archivo de configuración corto que dice «este pin lee el gancho uno», y ese archivo te lo puede escribir la IA. ESPHome se conecta directamente a Home Assistant, y Home Assistant se lo pasa a tu agente. Ahora puedes decirle a tu agente: «si salgo de casa y mis llaves siguen en el gancho, mándame un mensaje».

Cuando funcione en tu mesa, haz que la IA te ayude a diseñar una placa de circuito ordenada en KiCad, la herramienta gratuita de código abierto, y mándala a JLCPCB. Aquí hay dos decisiones que te ahorran meses más adelante. Alimenta el dispositivo con un adaptador de pared certificado comprado en tienda que dé baja tensión, para que tu cacharro nunca toque directamente la corriente de la red. Y usa un módulo ESP32 que ya tenga la certificación FCC para su radio, lo que te permite saltarte una parte grande y cara de las pruebas.

Haz uno y luego corrígelo. Tu primera versión fallará en algo. Un tornillo caerá justo en un montante, un gancho quedará 3 milímetros demasiado bajo. Es normal, y por eso haces uno antes de hacer diez. Cambia una variable cada vez, lleva un registro breve de la construcción y guarda tus archivos de diseño en git, como el software, para poder volver siempre a la versión que funcionaba. Para la tercera versión, parecerá sacada de una tienda y encajará mejor que cualquier cosa que venda una tienda.

### El modelo de negocio

Mucha gente se quedará en fabricar cosas para sí misma, y es un resultado estupendo. Me parece genial. Una casa llena de cosas hechas exactamente para tu vida solía ser un lujo reservado a los muy ricos.

Pero, si quieres vender, la economía aquí es distinta a todo lo que tuvieron que afrontar antes los fundadores de hardware.

Vende antes de fabricar. Como tu producto es un archivo, puedes coger primero el pedido y fabricar después. Un cliente escribe sus medidas en un formulario sencillo de tu web, el código genera un diseño que encaja, paga y solo entonces se corta o se imprime algo. En el mundo antiguo te jugabas todo a 5.000 unidades antes de tener un solo cliente. Aquí, cada unidad está vendida antes de existir, lo que significa que puedes empezar casi sin dinero.

Haz las cuentas antes de enamorarte. Súmalo todo: piezas, acabados, electrónica, tu tiempo de montaje, embalaje, envío de ida y vuelta, comisiones de pago y la unidad que de vez en cuando llega doblada. La mayoría de los que construyen por primera vez se olvidan de al menos tres de estas cosas. Además, los productos personalizados son difíciles de revender, así que las devoluciones duelen más de lo normal. Una regla general habitual en hardware es vender a entre tres y cinco veces lo que te cuesta fabricar una unidad. El trabajo personalizado a menudo puede ir más arriba, porque el cliente paga por el ajuste, que nadie más le puede dar.

Véndelo de tres formas. El producto terminado es la obvia. Pero también puedes vender un kit para quienes disfrutan montando y un archivo personalizable para quienes tienen impresora. El archivo tiene márgenes de casi el 100 % y convierte a tus clientes en una comunidad que te sugiere tu próximo producto.

Deja que la construcción sea el marketing. Un vídeo de un producto que pasa de una frase a una pieza de metal terminada en una semana es más convincente que cualquier anuncio que puedas comprar, y cada versión que haces es otro contenido. Los que están ganando en esto construyen en público, y su audiencia suele ser sus primeros 100 clientes.

Trata la certificación como un foso defensivo. Si tu producto se enchufa a la pared, te interesa una marca de seguridad como UL o ETL en Estados Unidos. Si lleva radio, necesita la aprobación de la FCC. Si es para niños, hay todo un conjunto aparte de normas y pruebas, y Europa tiene sus propias marcas. Es lento, pesado y caro, y precisamente por eso es un foso. La mayoría de los aficionados nunca lo harán, así que los creadores que lo hacen acceden a minoristas, aseguradoras y clientes empresariales a los que todos los demás no pueden llegar.

Escala cuando la demanda sea real. Cuando los pedidos sean constantes y el diseño haya dejado de cambiar, pasa a fabricar por lotes. Pedir 50 unidades de una pieza en lugar de una cada vez baja rápido tu coste unitario, porque la fábrica reparte su tiempo de preparación entre más piezas. Con un volumen serio, las piezas de plástico pueden pasar de la impresión al moldeo por inyección, donde cada pieza cuesta céntimos. La diferencia con el mundo antiguo es que llegas ahí con clientes reales y demanda real, en lugar de con una suposición.

Nota: en los próximos 30 días iré añadiendo más ideas de startups de hardware a Ideabrowser.com.

### Dónde falla (porque a veces sale mal)

La IA se muestra segura sobre una física que apenas entiende. Diseñará un soporte que parece perfecto y que se parte la primera vez que alguien cuelga en él un abrigo pesado, porque nunca pensó en la carga, la palanca o la fatiga del metal. Todo lo que sostiene peso, se calienta, gira o toca la piel necesita una prueba real y, a ser posible, un ingeniero de verdad.

Los materiales te darán sorpresas. El plástico de impresión 3D más común, el PLA, empieza a reblandecerse en torno a los 60 °C, lo que significa que una pieza que se deja en el salpicadero del coche en julio puede acabar derretida como un charco. Los errores pequeños también se acumulan. Tres piezas que se desvían cada una medio milímetro pueden sumar un conjunto que se niega a cerrar.

Los imitadores son rápidos. Si tu producto es una forma sencilla, alguien se descargará la foto, hará que su propia IA lo recree y te rebajará el precio en Etsy antes del viernes. Los negocios defendibles se construyen sobre cosas difíciles de copiar: un ajuste perfecto para un producto concreto, un personalizador paramétrico, la certificación, una marca en la que la gente confía y una comunidad que construye sobre tu estándar.

Y la responsabilidad es real. En el momento en que vendes algo que se enchufa a la pared, sostiene a un niño o cierra una puerta, eres responsable de lo que pase cuando falle. Contrata un seguro, cumple las normas de certificación y diseña cada dispositivo conectado a un agente para que una persona siempre pueda anularlo a mano.

Cada una de estas cosas es una razón para empezar ya y aprenderlo bien, porque quienes lo hagan tendrán una ventaja real frente a la avalancha de gente imprimiendo lo que esté de moda.

### Hacia dónde va esto

Si quieres empezar esta semana, hazlo a lo pequeño. Cómprate un calibre. Elige una cosa molesta de tu casa que ninguna tienda venda en el tamaño adecuado: una estantería, un soporte, un organizador de cables, un sujetador para algo que tengas. Haz que una IA lo escriba en CadQuery, imprímelo, corrígelo y luego pide una versión en metal a SendCutSend. Si ya tienes acceso a una impresora, probablemente todo te cueste menos de 100 dólares. La primera vez que te llegue una caja con una pieza que diseñaste a partir de una frase, algo en tu cerebro se recablea.

Luego da un paso más. Hazte con una placa ESP32 y haz que una cosa de tu casa informe a tu agente. Una puerta, un buzón, una planta. Verás cuánto más útil se vuelve tu agente en el momento en que puede ver el mundo real.

Creo que miraremos atrás a esta época igual que miramos los primeros tiempos de la App Store. Un pequeño grupo de personas se dio cuenta de que las herramientas habían cambiado antes que los demás, y construyeron la primera oleada de productos mientras el terreno estaba completamente abierto.

Mi apuesta es que, en pocos años, una parte importante de las cosas que tenemos en casa estarán hechas específicamente para nosotros. Diseñadas por alguien que nunca fue a una escuela de ingeniería, fabricadas en una fábrica que nunca visitó, vendidas antes de existir y manejadas por un agente que conoce nuestras rutinas. Las grandes marcas seguirán vendiendo el producto medio a todo el mundo. Lo interesante vendrá de personas que fabrican cosas para un mercado de 500, o de 50, o de una.

El vibe coding cambió quién puede crear software. La vibe manufacturing está cambiando quién puede crear todo lo demás. E incluso si solo fabricas cosas para ti, es una de las habilidades más divertidas que puedes aprender ahora mismo.

Bienvenido a la era de la vibe manufacturing.

Si quieres más ideas como esta, las desgloso cada semana en el podcast @startupideaspod: YouTube, Spotify, Apple.

Si quieres crear productos agénticos o buscas llevar tu empresa a la era de la IA, habla con nuestro estudio de diseño, LCA. Somos el estudio de diseño de producto líder en IA.

Y si quieres ideas y tendencias de startups para despertar tu creatividad, echa un vistazo a Ideabrowser.com (tienes una idea al día gratis, es mi regalo para ti).

Escríbeme si alguna vez te puedo ayudar. No puedo responder a todo el mundo, ¡pero sí a algunos!

Estoy contigo.

Greg Isenberg
