# La empresa que se conduce sola

Por Amjad Masad

Estamos empezando a ver qué pasa cuando una empresa aprende a funcionar por sí misma.

En los últimos seis meses, los ingenieros de Replit casi han triplicado su producción de código. Los tiempos de revisión se han mantenido estables. Las reversiones y los incidentes de producto no han subido. Las métricas de calidad han mejorado y los lanzamientos se han acelerado. No se ha producido ninguna de las contrapartidas típicas que cabría esperar.

Aunque el código es la parte visible, lo que está pasando bajo la superficie es mucho más interesante.

Ahora los agentes investigan incidentes de producción, revisan pull requests, responden preguntas, analizan datos de negocio, clasifican tickets de soporte, investigan cuentas comerciales y mejoran los sistemas en los que se basa el propio Replit Agent.

Da la sensación de que hay una única inteligencia maestra entretejida en cada empleado, aunque no es así. Es un sistema de agentes en expansión que opera en toda la empresa: recibe objetivos de las personas, reúne contexto, hace el trabajo, comprueba los resultados y escala el asunto cuando hace falta criterio humano.

Creemos que esto representa el comienzo de un nuevo tipo de organización: la empresa que se conduce sola.

Una empresa que se conduce sola no es una empresa sin personas. Las personas siguen eligiendo el destino. Deciden qué problemas importan, toman decisiones difíciles entre alternativas, aplican su gusto y asumen la responsabilidad del resultado.

Pero, cada vez más, no son ellas quienes realizan cada paso necesario para llegar.

El cambio empezó a finales del año pasado. Como a mucha gente que trabaja en IA, al volver de las vacaciones de Navidad nos dio la sensación de que algo fundamental había cambiado. Los modelos eran capaces de sostener el trabajo durante horizontes mucho más largos.

Tareas que habían fallado una y otra vez, como la clasificación de alertas y la investigación de causas raíz, empezaron a funcionar. La IA empezó a resolver algunos de nuestros errores más rebeldes. Así que dejamos de tratar a los agentes como herramientas que vivían dentro de un editor o de una ventana de chat. Los entretejimos, con cuidado, en el tejido de la propia empresa.

Cuando ingeniería demostró su valor, la adopción cobró vida propia. Un equipo tras otro empezó a descargarse del trabajo más tedioso y a recuperar tiempo para el pensamiento estratégico y creativo que de verdad hace avanzar el negocio. La gente no siente que la hayan automatizado. Siente que la han ascendido.

Esta es la historia de cómo la IA ha cambiado por completo nuestra forma de trabajar en Replit.

### Ingeniería fue la primera en notar el impacto

A finales de enero pusimos en marcha la infraestructura necesaria para experimentar rápidamente con casos de uso internos de agentes. Aprovechamos nuestro entorno de ejecución de agentes, las microVM y nuestra infraestructura de sistema de archivos remoto para que cualquier ingeniero pudiera orquestar enjambres de agentes en paralelo. Después blindamos todo con políticas de acceso, proxies de tokens, registros de auditoría y nuestra red ZeroTrust. Llegados a ese punto, nos sentimos seguros dándole al agente acceso a todo lo que usamos para hacer nuestro trabajo: GitHub, GCP, Azure, Linear, Notion, Slack, ZenDesk y más.

Con contexto de todos los sistemas, vimos un salto adelante en productividad. Los experimentos que antes fallaban se volvieron fáciles. El impacto más inmediato se vio en las estadísticas de código.

Estábamos en la semana de sprint previa al lanzamiento de Agent 4, en marzo, cuando normalmente vemos un gran pico. Las reuniones desaparecen, el alcance está claro e ingeniería pasa a modo de ejecución pura (a menudo hasta 16 horas al día). Pero esta vez fue distinto. Nuestra curva de productividad se curvó hacia arriba como ninguno de nosotros había visto antes, y eso se explica por la adopción de nuestro nuevo sistema agéntico interno. Desde principios de enero hasta finales de junio, las líneas de código aportadas se multiplicaron por 5,8.

Parte de este aumento se debe a haber contratado bien. Nuestro nuevo agente acelera el tiempo que tarda alguien en ser productivo, lo cual es estupendo, pero podemos eliminar el efecto de las contrataciones para tener datos más limpios. Si mantenemos un grupo constante de autores, vemos 2,9 veces más código que antes. Tradicionalmente, se considera excelente mantener estable la producción por ingeniero mientras el equipo crece. Nosotros acabamos de triplicar la producción por ingeniero mientras duplicábamos el equipo.

Quizá te preguntes quién revisa todo este código nuevo y si hemos creado un nuevo cuello de botella en el proceso de revisión. Nuestra latencia de revisión de código se ha mantenido estable, en gran parte porque pusimos a nuestro agente a revisar código. Ahora es capaz de evaluar niveles de riesgo y solo llamar a un segundo revisor humano cuando hace falta. Eso significa que nos hemos ahorrado un 30 % (y subiendo) del tiempo humano de revisión de pull requests.

Con nuestro agente escribiendo y revisando más código, deberíamos estar preocupados por la calidad. Si miramos las tasas de reversión de pull requests (a la izquierda) y los incidentes abiertos, las tendencias son planas. Eso significa que, en términos relativos, en realidad estamos mejorando.

Una de las razones es que estos procesos también están asistidos por agentes. Las revisiones de código humanas cuentan con un correvisor agéntico, así que se detectan más errores. Las investigaciones de incidentes (errores importantes o incidentes reales) cuentan con la ayuda de un agente que intenta encontrar la causa raíz, así que el tiempo medio hasta la mitigación (MTTM) está bajando.

La prueba definitiva es si ese código adicional se traduce en valor real. Al fin y al cabo, ingeniería entrega funcionalidades a los usuarios. Hacemos seguimiento de los proyectos en Linear para que los equipos de ventas y marketing sepan cuándo comunicar a los usuarios las novedades. Se ve que el ritmo de proyectos completados ha subido con fuerza junto con nuestro volumen de código.

Un equipo de ingeniería que se conduce solo puede entregar más y, al mismo tiempo, subir la calidad.

### Nuestro agente de agentes está permitiendo la ingeniería en bucle a escala

Si hacemos zoom, nos hacemos una idea de cómo es esto. Cuando los ingenieros encuentran la manera de generar bucles, mandando una flota de agentes a completar una tarea verificable, es cuando vemos el cambio más espectacular. Cada empleado tiene acceso a un agente gestor que puede lanzar varios agentes, lo que permite orquestar agentes que trabajan en bucle en tu nombre. Los bucles dieron lugar a unos gráficos de pull requests con un aspecto muy peculiar, como estos:

Un ingeniero completó una migración de nuestro sistema de CSS que llevaba mucho tiempo atascada y compartió lo que aprendió. Otro ingeniero automatizó una migración que nos permitió localizar el producto a otros idiomas. Otro más automatizó el mantenimiento de las pruebas inestables. Nuestro director de tecnología por fin resolvió, con un enjambre de agentes, uno de nuestros errores de red más difíciles, relacionado con PSC y el cierre de descriptores de archivo. Todas nuestras suposiciones sobre lo que es posible han cambiado.

El ejemplo más emocionante de funcionamiento autónomo viene de nuestro equipo de IA. Construyeron un sistema de aprendizaje continuo que analiza los comentarios de los usuarios, propone mejoras y usa una combinación de pruebas de rendimiento y pruebas A/B para validar los avances. ¡Replit Agent se mejora a sí mismo!

La conversación entre construir o comprar ha cambiado

Nuestro nuevo agente interno también cambió las conversaciones sobre si construir o comprar software. Probamos con regularidad nuevas herramientas de IA. Comprar soluciones puede ayudarnos a ir más rápido, y también analizamos el mercado constantemente. Pero cuanto más construimos, menos necesitamos hacerlo. Nuestro agente interno supera ya a productos que probamos y que se consideran líderes del mercado. Acabamos de dar de baja una solución SaaS de siete cifras porque nuestra aplicación interna, construida íntegramente en Replit, era superior y los empleados ya se habían pasado a ella.

De repente, las herramientas parecen hechas a nuestra medida. La integración profunda con nuestras bases de conocimiento, y la personalización que hemos hecho, hacen que otras soluciones parezcan inferiores.

Lo que más nos sorprendió fue que nuestro agente interno también superó a productos especializados en sectores concretos que evaluamos. Una herramienta para ayudar a los ingenieros a clasificar alertas y encontrar la causa raíz de los incidentes ofreció una calidad parecida, pero costaba diez veces más que ejecutarlo con nuestro agente. Una herramienta de pruebas de penetración automatizadas encontró menos vulnerabilidades que nuestra versión interna, con un coste diez veces mayor. Nuestras dos versiones se pusieron en producción sin problemas, reduciendo el MTTM en los incidentes y blindando sistemas críticos frente a ataques.

Con todo lo que aún estamos aprendiendo, y con lo que están mejorando los modelos, está claro que esto es solo el principio.

### Más allá de ingeniería: todo el negocio

Una empresa que se conduce sola no se queda en ingeniería. Todas las áreas de Replit están cambiando.

El uso se extendió rápidamente fuera de ingeniería, sobre todo gracias a una interfaz en Slack. El resto de la empresa vio que los ingenieros etiquetaban a nuestro agente para encargarle tareas y lo probó por su cuenta. Al principio, el caso de uso más popular era hacer preguntas. Al combinar nuestra base de conocimiento con el estado del código, cualquiera podía aclarar lo que se esperaba del producto sin esperar a que respondiera ingeniería. Después, esos empleados podían corregir textos o documentación. Fue una mejora inmediata en la capacidad de responder antes a los usuarios.

Pero eso fue solo el principio. A partir de ahí empezaron a llegar aportaciones de nuevas habilidades e integraciones desde todos los rincones de la empresa.

El primer gran desbloqueo vino de nuestro equipo de datos. Le dieron al agente una capa semántica sobre nuestro almacén de datos, para que sepa qué tablas son fuentes de verdad y cómo se relacionan entre sí.

Ahora cualquiera en Replit puede hacer preguntas de inteligencia de negocio y obtener una respuesta fiable. Pueden crear gráficos y presentaciones a partir de datos en directo (incluidos todos los gráficos de este artículo). El equipo de datos dedica su tiempo a profundizar en los problemas más difíciles en lugar de atender peticiones. Hace poco, un responsable de producto pudo hacer por su cuenta un análisis complejo de un lanzamiento, porque nuestro agente entiende los eventos del código, cómo aparecen en nuestra plataforma de datos de clientes y cómo cruzarlos con estados de suscripción complejos.

Ventas encontró la misma palanca. El equipo de desarrollo de ventas usa el agente para encontrar y enriquecer clientes potenciales cualificados por el producto, recurriendo a conocimiento interno que las herramientas más genéricas no ven, así que los contactos llegan con más contexto. Los ejecutivos de cuentas lo usan para preparar las conversaciones con clientes: entender quién está sacando más valor, qué proyectos están más activos y cómo evoluciona el uso de créditos frente a su contrato. Todo esto se empaqueta después en diapositivas con la marca, personalizadas para cada cuenta. Un equipo de ventas que se conduce solo tiene más puntos de contacto, y de más calidad, con sus clientes.

Nuestro equipo de marketing puede usar el agente para redactar especificaciones de producto desde cero con una sola instrucción, a partir de conversaciones y documentos de ingeniería y producto. Eso les permite empezar a moverse antes con los lanzamientos y estar al día sin tener que estar en todas las reuniones. Tienen más tiempo para planificar y ser creativos, lo que hará que nuestros lanzamientos tengan más impacto cuando salgan al mundo.

Nuestro equipo de soporte le dio al agente habilidades para investigar problemas y seguir los protocolos estándar. Puede optar por ofrecer una respuesta con nuestro tono estándar de atención al cliente o escalar el caso a ingeniería con un resumen del ticket y de la investigación. Un equipo de soporte que se conduce solo cierra los tickets más difíciles (los que se escalan a humanos) un 60 % más rápido. Los usuarios vuelven antes a construir.

En todos los ejemplos, el humano no quedó automatizado. Lo ascendieron. Conducirse solo convierte a los que ejecutan en directores, y quienes están prosperando son los que piensan en resultados y marcan el rumbo. Ese es ahora el trabajo más valioso que existe.

—

¿Y ahora, qué?

Hacernos más productivos es emocionante, pero lo que de verdad motiva a la gente de Replit es democratizar la tecnología.

Queremos llevar esta nueva forma de trabajar a todos nuestros usuarios. Estamos trabajando duro para asegurarnos de poder hacerlo con las políticas, los permisos, la seguridad y los controles de costes necesarios para desplegarlo a escala. Los usuarios más activos de Replit son emprendedores y usuarios empresariales que están construyendo negocios reales. Conducirse solo necesita medidas de seguridad capaces de escalar al nivel de esos usuarios.

Estamos trabajando duro en construirlo ahora mismo.

Viendo todos los gráficos de arriba, no tendrás que esperar mucho.
