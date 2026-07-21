import type { ArticleSection } from "./articles";

/**
 * Ampliaciones editoriales por slug. No sustituyen el artículo base:
 * aportan ejemplos colombianos, guías operativas, checklists y modelos de cálculo.
 */
export type ExpandableArticleSlug =
  | "control-de-tiempo-sin-vigilancia"
  | "costo-real-planilla-imperfecta"
  | "buddy-punching-como-prevenirlo"
  | "ley-2466-2025-horas-extra-colombia"
  | "geofence-marcacion-laboral"
  | "biometria-laboral-ley-1581"
  | "reportes-rrhh-que-si-sirven"
  | "roi-software-asistencia-90-dias"
  | "rrhh-ia-api-webhooks-mcp"
  | "elegir-software-asistencia-colombia";

export const articleExpansions: Record<ExpandableArticleSlug, ArticleSection[]> = {

  "control-de-tiempo-sin-vigilancia": [
    {
      heading: "Escenarios colombianos donde la proporcionalidad se pone a prueba",
      paragraphs: [
        "Imagine una planta de ensamble en Cali con tres turnos, un call center en Bogotá con rotación semanal y una red de tiendas en la Costa con jefes de piso que aprueban novedades desde el celular. En los tres casos la empresa necesita evidencia de jornada, pero el riesgo de sobre-recolectar datos es distinto. En la planta basta marcar en kiosco al ingreso y a la salida; en el call center importa también la pausa autorizada; en la tienda, una marcación móvil con sede puede ser suficiente sin grabar la ruta del día.",
        "Cuando RR. HH. diseña el control, conviene mapear cada sede por tipo de riesgo laboral real: liquidación de recargos, cobertura de turno, seguridad industrial o reclamaciones. Si el riesgo es liquidar bien las horas nocturnas de un turno de hospitalidad en Medellín, la finalidad no justifica un panel que muestre en vivo dónde está cada persona. Esa distinción evita convertir una necesidad de nómina en un sistema de vigilancia permanente.",
        "Un cuarto escenario frecuente es el trabajo híbrido administrativo en ciudades intermedias: la persona marca al iniciar la jornada remota y al cerrarla, sin que la empresa necesite capturas de pantalla ni ubicación continua. Si el líder quiere evidencia de entregables, eso pertenece al sistema de gestión del trabajo, no al reloj de asistencia. Mezclar ambas capas suele generar resistencia y peores datos.",
      ],
      bullets: [
        "Lista de finalidades por sede y por rol, revisada con asesoría laboral.",
        "Inventario de datos recolectados hoy: qué se usa y qué solo se acumula.",
        "Canales visibles para que el trabajador vea y cuestione su propia marcación.",
        "Separación explícita entre asistencia, desempeño y seguridad física.",
      ],
    },
    {
      heading: "Guía operativa de implementación en cuatro semanas",
      paragraphs: [
        "Semana 1: documente el flujo actual de entrada, salida, pausas y correcciones. Pregunte a líderes qué decisiones toman con esos datos y qué decisiones no deberían tomar. Semana 2: redacte la política de registro —qué se captura, retención, accesos y excepciones— y alinee el software a esa política, no al revés. Semana 3: capacite con casos reales (marcación olvidada, cambio de sede, hora extra aprobada). Semana 4: mida fricción y calidad del dato antes de ampliar a más sedes.",
        "Un matiz frecuente: los rankings de puntualidad publicados en el tablero del equipo suelen degradar la confianza sin mejorar la operación. Prefiera indicadores agregados por turno o sucursal y reserve el detalle nominal a quienes deben corregir una novedad concreta. Durante la capacitación, practique el lenguaje que usarán los líderes: revisar la marcación no equivale a presumir mala fe.",
        "Si al terminar la semana 4 la tasa de correcciones no baja o suben los reclamos de transparencia, no escale el mismo diseño. Ajuste finalidad, accesos o flujo de excepción antes de llevar el modelo a toda la compañía.",
      ],
    },
    {
      heading: "Checklist de diagnóstico y preguntas para líderes",
      paragraphs: [
        "Antes de endurecer controles, responda: ¿cada campo del sistema tiene una finalidad escrita? ¿El trabajador puede consultar su historial sin pedir un favor? ¿Las alertas de sobrecarga llegan a tiempo para redistribuir carga, o solo alimentan un reporte disciplinario? ¿La evaluación de desempeño usa otros insumos —calidad, cumplimiento de objetivos, contexto del turno— o se reduce a minutos de presencia?",
        "Use la evidencia de bienestar con prudencia. La OMS y la OIT asociaron jornadas de 55 horas o más por semana con 745.000 muertes por cardiopatía isquémica y accidente cerebrovascular en 2016. Ese hallazgo orienta a detectar sobrecarga sistemática, no a justificar más vigilancia. En paralelo, recuerde que el DANE mide productividad con factores más amplios que las horas: en la empresa, combine asistencia con resultados y condiciones de trabajo.",
      ],
      bullets: [
        "¿Hay captura continua de pantalla, audio, video o ubicación sin necesidad demostrada?",
        "¿Existe flujo de corrección con motivo, aprobador e historial?",
        "¿La retención de datos tiene fecha de revisión?",
        "¿Las alertas de exceso de jornada generan acción de redistribución?",
        "¿Desempeño y asistencia viven en procesos separados?",
      ],
    },
    {
      heading: "Modelo simple para priorizar qué registrar",
      paragraphs: [
        "Asigne a cada dato propuesto tres puntajes cualitativos: necesidad laboral (alta, media o baja), invasividad (alta, media o baja) y coste de error si falta (alto, medio o bajo). Conserve solo lo que tenga necesidad alta o media, invasividad baja o media, y coste de error alto. Si un dato es altamente invasivo y de necesidad baja —por ejemplo, ubicación cada cinco minutos—, descártelo aunque el proveedor lo ofrezca incluido en la licencia.",
        "Cierre el ciclo con una revisión trimestral: compare reclamaciones, ajustes de nómina y percepción de justicia. Un control proporcional se sostiene cuando ambas partes pueden explicar, con la misma evidencia, cómo se construyó la jornada. Si un campo nunca se usó en liquidación ni en defensa de un reclamo, elimínelo del alcance y documente la decisión.",
      ],
    },
  ],

  "costo-real-planilla-imperfecta": [
    {
      heading: "Cómo se ve el costo en una operación colombiana típica",
      paragraphs: [
        "En una empresa de logística con sedes en Bogotá y Barranquilla, una marcación faltante del turno noche suele activar una cadena: el supervisor busca el chat, RR. HH. abre la planilla, nómina espera el ajuste y el trabajador pregunta por qué el comprobante no cuadra. Ningún eslabón falla solo: el costo es el tiempo coordinado de todos. Si el cierre quincenal ya pasó, aparece un segundo ciclo de explicación y corrección.",
        "El mismo patrón se observa en retail del Eje Cafetero cuando un cambio de sede no queda registrado, o en un laboratorio clínico de Bucaramanga cuando el personal de apoyo olvida marcar al salir de un refuerzo. El síntoma visible es un dato incompleto; el costo real es la coordinación interrumpida de cuatro roles distintos y, a veces, un pago que hay que volver a explicar.",
        "EY, en su estudio de 2022 sobre nóminas en Estados Unidos, reportó precisión promedio de 80,15%, un costo medio de US$291 por incidente y 26 minutos anuales por empleado para corregir o completar punches. Esas cifras sirven para nombrar rubros —error, tiempo de corrección, incidencia— no para convertirlas a pesos colombianos sin medición propia.",
      ],
    },
    {
      heading: "Modelo de cálculo local sin usar tarifas extranjeras",
      paragraphs: [
        "Defina un periodo de observación de al menos dos cierres. Para cada novedad corregida registre: minutos de supervisor, minutos de RR. HH., minutos de nómina, si hubo ajuste monetario y si el caso se reabrió. Multiplique minutos por el costo interno por hora de cada rol, según su contabilidad. Sume pagos en exceso, pagos incompletos y el tiempo de atención al reclamo del trabajador.",
        "Fórmula orientativa: costo del periodo igual a la suma de minutos por rol multiplicados por su tarifa horaria, más el valor absoluto de ajustes monetarios, más el tiempo de atención valorado. Exprese el resultado por empleado activo y por cierre. Así podrá comparar antes y después de una automatización sin importar la cifra estadounidense de EY.",
        "Agregue una vista de Pareto: ordene las causas por frecuencia y por minutos consumidos. Suele ocurrir que pocas reglas mal configuradas explican la mayoría del tiempo perdido, mientras que los olvidos aislados concentran menos costo del que intuía la gerencia.",
      ],
      bullets: [
        "Separar causas: captura, regla mal configurada, aprobación tardía, integración fallida.",
        "Contar casos reabiertos como costo doble, no como un solo incidente.",
        "Excluir del ahorro cualquier proyección no observada en el piloto.",
        "Registrar también el tiempo del trabajador que reclama o corrige.",
      ],
    },
    {
      heading: "Checklist operativo para cerrar el circuito asistencia y nómina",
      paragraphs: [
        "Tres días antes del cierre: publique un corte preliminar para que líderes y trabajadores revisen. Un día antes: bloquee ediciones libres y deje solo correcciones con aprobación. En el cierre: exporte o integre únicamente registros con versión identificable. Después del pago: registre reclamos y clasifique la causa raíz para el siguiente periodo.",
        "Preguntas de diagnóstico: ¿cuántas novedades llegan después del corte? ¿Qué porcentaje de ajustes nace de duplicados o de turnos mal configurados? ¿Quién es el cuello de botella recurrente? ¿La misma excepción se corrige tres veces en el mes? ¿Hay un dueño claro de cada regla de turno?",
      ],
    },
    {
      heading: "Matices que suelen inflar o subestimar el costo",
      paragraphs: [
        "Subestimar: ignorar el costo de oportunidad de RR. HH. en selección, clima o formación, y tratar cada ajuste como cinco minutos. Sobreestimar: multiplicar la cifra de US$291 de EY por toda la plantilla colombiana sin línea base. El matiz correcto es usar EY como mapa de categorías y su medición como única base de decisión gerencial.",
        "En Colombia, además, una planilla imperfecta puede tensionar la confianza frente a recargos y horas suplementarias. Cuando la Ley 2466 de 2025 exige evidencia explicable del trabajo suplementario, un proceso desordenado no solo cuesta tiempo: debilita la capacidad de demostrar cómo se liquidó ante el trabajador o ante una autoridad.",
      ],
    },
  ],

  "buddy-punching-como-prevenirlo": [
    {
      heading: "Patrones que aparecen en sedes reales",
      paragraphs: [
        "En un centro comercial de Pereira, el reloj biométrico falla en hora pico y alguien ayuda a un compañero con la tarjeta. En una obra en Soacha, el personal se mueve entre frentes y el dispositivo queda lejos del puesto. En un back office de Bucaramanga, compartir un PIN parece inocente hasta que una ausencia injustificada se disfraza de presencia. Los tres casos se llaman buddy punching, pero las causas —falla técnica, diseño de proceso e intención— no son iguales.",
        "Antes de endurecer sanciones, concentre anomalías por turno, dispositivo y sede. Un pico en un solo kiosco suele ser vulnerabilidad operativa; un patrón repetido en la misma pareja de personas, con turnos incompatibles, merece investigación con evidencia. En hospitalidad de Cartagena, el solapamiento de turnos de cierre y apertura puede generar marcaciones confusas si no hay ventana anti-doble claramente comunicada.",
      ],
    },
    {
      heading: "Guía operativa de controles graduados",
      paragraphs: [
        "Nivel 1, diseño: dispositivos accesibles, cola razonable, instrucción clara y alternativa cuando el hardware falla. Nivel 2, identidad: mecanismo personal difícil de compartir, por ejemplo verificación facial o credencial no transferible, siempre con política de datos. Nivel 3, contexto: sede esperada, ventana horaria del turno y detección de duplicados. Nivel 4, trazabilidad: quién marcó, desde qué dispositivo, quién corrigió y con qué motivo.",
        "La biometría es dato sensible bajo la Ley 1581 de 2012. Si la adopta, informe finalidades, gestione la autorización aplicable y ofrezca ruta alternativa. Un falso rechazo no puede convertirse en falta automática. Documente también quién puede autorizar una marcación asistida y en cuánto tiempo debe validarse.",
        "En despliegues multi-sede, evite un único umbral de alerta nacional: una anomalía en un kiosco de alta rotación no se interpreta igual que en una oficina pequeña. Ajuste sensibilidad por contexto para reducir falsos positivos que desgasten la confianza del equipo.",
      ],
      bullets: [
        "Inventario de dispositivos y tasa de fallos por sede.",
        "Política de excepción asistida con validación posterior.",
        "Umbrales de alerta que abren revisión, no sanción inmediata.",
        "Capacitación a líderes sobre sesgo y falso positivo.",
        "Comunicación clara de la ventana anti-doble marcación.",
      ],
    },
    {
      heading: "Preguntas de diagnóstico antes de sancionar",
      paragraphs: [
        "¿El sistema estaba disponible en ese minuto? ¿Había novedad o comisión autorizada? ¿El turno programado coincide con la marcación? ¿Existe soporte del líder? ¿La persona pudo explicar el evento con coherencia temporal? ¿Hubo cola, falla de red o dispositivo reportado ese día?",
        "Documente la respuesta a cada pregunta. La calidad de la investigación protege a la empresa y al trabajador: reduce sanciones injustas y fortalece los casos en los que sí hay abuso deliberado. Conserve evidencia relevante con retención limitada y acceso restringido según el rol.",
      ],
    },
    {
      heading: "Cómo medir si el control funciona",
      paragraphs: [
        "Compare, en ventanas iguales: marcaciones incompatibles con el turno, ajustes de planilla por suplantación sospechada, tiempo de espera en kiosco y tickets de no pude marcar. Si caen las anomalías pero suben los tickets y el tiempo de espera, el control está trasladando fricción sin ganar integridad.",
        "Ningún control aislado es infalible. La combinación de identidad, contexto, trazabilidad y excepción humana supera a cualquier solución tecnológica única. Revise el diseño cada trimestre con RR. HH., operaciones y, si hay biometría, con quien custodia la política de datos personales.",
        "Publique un canal breve de no pude marcar con tiempo máximo de respuesta del líder. Cuando la improvisación deja de ser el único camino, baja tanto la tentación de buddy punching por conveniencia como la sensación de que el sistema castiga a quien sí intenta cumplir.",
        "Cierre con una métrica de justicia percibida: pregunte en la sede piloto si el control se siente como protección mutua o como sospecha colectiva. Si domina la segunda lectura, baje el umbral de sanción automática y suba la calidad de la investigación antes de ampliar el despliegue a más ciudades.",
      ],
    },
  ],

  "ley-2466-2025-horas-extra-colombia": [
    {
      heading: "Traducir los artículos 12 y 13 a rutinas diarias",
      paragraphs: [
        "El artículo 12 exige un registro por trabajador con actividad, número de horas suplementarias y carácter diurno o nocturno, adaptable a la empresa pero no vacío de esos mínimos. En la práctica, el sistema o el procedimiento debe conservar la cadena: marcación, causa o actividad, aprobación, liquidación y soporte de pago. Una cifra total en el desprendible, sin esa cadena, dificulta responder cuando el trabajador o una autoridad la soliciten.",
        "El artículo 13 fija, como regla general, un máximo de dos horas extra diarias y doce semanales, con excepciones legales para sectores de seguridad y salud según su normativa. Configure el software según el sector real de la empresa; no extienda excepciones por analogía a un comercio, un call center o una industria que no esté cubierta.",
        "En una planta de alimentos en el Atlántico o en un centro de distribución en Funza, la tentación operativa es resolver el pico con una hora más. El registro y la alerta existen para que esa decisión se tome a la luz del límite y de la causa, no solo de la urgencia del turno.",
      ],
    },
    {
      heading: "Guía de configuración para RR. HH. y operaciones",
      paragraphs: [
        "Paso 1: clasifique turnos con franjas diurnas y nocturnas según la jornada aplicable y la asesoría laboral. Paso 2: defina quién puede solicitar y quién puede aprobar tiempo suplementario. Paso 3: active alertas cuando la programación o las marcaciones se acerquen a dos horas en el día o doce en la semana. Paso 4: genere un reporte por persona y periodo que incluya actividad o causa, no solo el total.",
        "Haga una prueba retrospectiva: tome un periodo ya liquidado y reconstruya si el nuevo registro habría explicado cada recargo. Las inconsistencias que aparezcan son el mapa de capacitación y de reglas a corregir. Incluya en la prueba al menos un cambio de sede, un refuerzo de fin de semana y una corrección tardía.",
      ],
      bullets: [
        "Campos mínimos: nombre, actividad, horas, diurna o nocturna.",
        "Vínculo a aprobación y a soporte de pago.",
        "Alertas preventivas a líder y RR. HH.",
        "Excepciones sectoriales solo con respaldo normativo documentado.",
        "Glosario común de actividades para sedes distintas.",
      ],
    },
    {
      heading: "Preguntas de diagnóstico de cumplimiento",
      paragraphs: [
        "¿Puede entregar en cinco minutos la relación de horas extra de un trabajador del mes anterior con su soporte? ¿El sistema distingue diurno y nocturno o alguien lo reclasifica a mano al final? ¿Las alertas llegan antes o después del cierre de nómina? ¿Los líderes entienden que aprobar de más no arregla la operación si se supera el límite legal aplicable?",
        "¿Quién responde cuando el trabajador solicita la relación? ¿Hay un procedimiento escrito o se improvisan capturas de pantalla? Este contenido es informativo y no sustituye asesoría jurídica. La aplicación depende del vínculo, el sector, la jornada y el resto de normas vigentes. La fuente primaria es el texto oficial de la Ley 2466 de 2025.",
      ],
    },
    {
      heading: "Matices operativos que suelen pasarse por alto",
      paragraphs: [
        "Una alerta tecnológica no reemplaza el análisis laboral: puede haber tiempo que no es suplementario, o situaciones de disponibilidad distintas. Tampoco basta capacitar solo a nómina; si el líder no registra la causa a tiempo, el artículo 12 queda incompleto aunque el pago sea correcto.",
        "En empresas multi-sede —por ejemplo retail en el Eje Cafetero con bodega central— unifique definiciones de actividad como inventario, cobertura de caja o mantenimiento, para que el registro sea comparable y comprensible. La evidencia útil es la que un tercero puede leer sin conocer el argot interno del equipo. Revise también que la programación semanal no esconda sobrecarga repartiendo minutos que, al sumarse, superan el límite semanal aplicable.",
      ],
    },
  ],

  "geofence-marcacion-laboral": [
    {
      heading: "Cuándo aporta valor en Colombia y cuándo no",
      paragraphs: [
        "Un equipo de mantenimiento que rota por clínicas en el Valle, o vendedores que marcan al llegar a una tienda propia, pueden beneficiarse de un geofence en el instante de la marcación. En cambio, un edificio de oficinas en el centro de Bogotá con torniquete y kiosco rara vez necesita rastrear coordenadas del teléfono. La herramienta debe responder a un vacío de evidencia de sede, no a la curiosidad de saber dónde está alguien a media mañana.",
        "Recuerde los límites: estar dentro del radio no identifica a la persona; estar fuera no prueba fraude. El GPS falla en sótanos, entre edificios altos, con clima adverso o con permisos del sistema operativo denegados. En sedes industriales de la Sabana de Bogotá, un estacionamiento amplio puede exigir un radio distinto al de una tienda de esquina en Manizales.",
      ],
    },
    {
      heading: "Guía de despliegue con privacidad desde el diseño",
      paragraphs: [
        "Configure coordenadas y radio por sucursal tras medir en campo con varios dispositivos y sistemas operativos. Solicite ubicación solo al pulsar marcar; calcule distancia; conserve lo mínimo para justificar el evento. Evite seguimiento continuo en segundo plano para asistencia. Explique en la política finalidad, retención, destinatarios y derechos del titular.",
        "Distinga ubicación y biometría: ambas merecen protección, pero la Ley 1581 clasifica expresamente los datos biométricos como sensibles. No mezcle consentimientos ni reutilice la ubicación para fines de marketing o disciplina no declarados. Si combina geofence con verificación de identidad, documente cada finalidad por separado.",
        "Entrene a líderes para interpretar fuera de radio como señal a revisar, no como veredicto. La primera respuesta debería ser: ¿hubo precisión insuficiente, comisión autorizada o un intento irregular que merece investigación?",
      ],
      bullets: [
        "Piloto de radio por sede antes de bloquear marcaciones.",
        "Bitácora de excepciones con aprobador, motivo y evidencia.",
        "Cifrado, acceso por rol y retención limitada.",
        "Alternativa documentada ante GPS o red insuficiente.",
        "Medición de falsos rechazos por edificio y marca de teléfono.",
      ],
    },
    {
      heading: "Checklist y preguntas de diagnóstico técnico-operativo",
      paragraphs: [
        "¿El radio refleja el perímetro real o un círculo genérico copiado de otra sede? ¿Cuántos falsos rechazos hay por edificio, hora y marca de teléfono? ¿El trabajador sabe qué hacer si el GPS no fija? ¿La excepción queda auditada o se resuelve por WhatsApp sin rastro? ¿Se captura ubicación solo en la marcación o también en segundo plano?",
        "Indicador de éxito: registros válidos con menos correcciones y experiencia razonable, no el número de bloqueos. Si una sede urbana densa produce rechazos sistemáticos, amplíe el radio o combine con otro método; no traslade el fallo técnico al trabajador.",
      ],
    },
    {
      heading: "Modelo de decisión para excepciones",
      paragraphs: [
        "Clasifique cada excepción en: error de precisión, trabajo autorizado fuera de sede, intento irregular o dato insuficiente. Solo la tercera categoría, con evidencia adicional, debería escalar a investigación. Las dos primeras requieren ajuste de radio, de proceso o de autorización de comisión. La cuarta exige reintento asistido, no sanción.",
        "Revise mensualmente la tasa de excepciones por sucursal. Un pico en una sola sede apunta a cartografía o infraestructura; un pico en un turno específico puede ser diseño de jornada; un pico en un individuo, con contexto, puede merecer revisión caso a caso sin automatizar la sanción.",
        "Si la empresa opera en zonas rurales o periurbanas —fincas, proyectos viales, puntos de venta en municipios pequeños— valide el radio con los mismos modelos de teléfono que usa el personal, no solo con el dispositivo del implementador. La diferencia de chipset y de versión del sistema operativo suele explicar más falsos rechazos que la indisciplina del equipo.",
        "Publique a operaciones un resumen agregado mensual de excepciones por causa. Así el geofence se gobierna como proceso de calidad del dato y no como trampa silenciosa. Cuando el resumen muestra que la mayoría son errores de precisión, el siguiente paso es cartografía, no disciplina.",
      ],
    },
  ],

  "biometria-laboral-ley-1581": [
    {
      heading: "Marco de decisión antes de comprar hardware",
      paragraphs: [
        "Parta de un problema concreto: ¿hay suplantación demostrada en marcaciones? ¿Un PIN, tarjeta o kiosco supervisado alcanza el objetivo con menor invasividad? ¿Qué pasa con quien tiene una condición que dificulta el reconocimiento? Documentar esas respuestas es parte de la diligencia, no un trámite cosmética.",
        "El artículo 5 de la Ley 1581 de 2012 incluye los datos biométricos entre los sensibles. En 2025, la Circular Externa 001 de la SIC reforzó, para los sujetos y tratamientos que cubre, finalidades precisas, autorización explícita, proporcionalidad, seguridad adicional y borrado cuando termina la relación y ya no subsiste la finalidad. Esa circular no se extiende automáticamente a todo empleador, pero sí ofrece una referencia de rigor útil al diseñar el programa.",
        "En un grupo con sedes en Medellín y la Costa, resista el mismo kit para todos. El riesgo de buddy punching en un kiosco compartido de planta no es idéntico al de una oficina con acceso controlado; la proporcionalidad se evalúa por contexto.",
      ],
    },
    {
      heading: "Guía operativa del ciclo de vida de la plantilla",
      paragraphs: [
        "Alta: informar en lenguaje claro, gestionar la base jurídica y la autorización aplicable con asesoría, capturar con calidad controlada y almacenar preferiblemente una plantilla matemática protegida, no la fotografía original si ya no es necesaria. Operación: registrar accesos, medir falsos rechazos, mantener alternativa y no reutilizar la plantilla para otra finalidad. Baja: eliminar de forma verificable cuando cese la finalidad y documentar la eliminación.",
        "Separe ambientes, cifre en reposo y en tránsito, evalúe al proveedor como encargado y pruebe restauración y borrado. Trate la plantilla facial como credencial irremplazable: un incidente no se resetea cambiando una contraseña. Defina también el procedimiento cuando una persona cambia de sede o de empresa dentro del mismo grupo empresarial.",
      ],
      bullets: [
        "Finalidad específica comunicada al titular.",
        "Alternativa y procedimiento de excepción.",
        "Inventario de bases y encargados actualizado.",
        "Plan de respuesta a incidentes con roles claros.",
        "Pruebas periódicas de eliminación verificable.",
      ],
    },
    {
      heading: "Preguntas de diagnóstico para el comité de privacidad y RR. HH.",
      paragraphs: [
        "¿Podemos explicar en una página por qué la biometría es necesaria frente a alternativas? ¿Quién aprueba un cambio de finalidad? ¿Cómo atiende consultas y reclamos del titular en los plazos legales aplicables? ¿Una decisión laboral grave puede tomarse solo con un score automatizado, o hay revisión humana? ¿Dónde se alojan las plantillas y quién tiene acceso de administrador?",
        "Transparencia operativa: la persona debe saber cuándo se procesa el rostro, qué resultado produce —coincide, no coincide o error técnico— y cómo corregir una marcación. La opacidad alimenta desconfianza incluso cuando el sistema es jurídicamente defendible.",
      ],
    },
    {
      heading: "Matices colombianos de implementación",
      paragraphs: [
        "En sedes con alta rotación —por ejemplo retail o alimentos— el proceso de enrolamiento y de eliminación debe ser tan ágil como el de contratación y retiro. En multi-empresa o multi-sede, evite bases compartidas sin aislamiento: la plantilla de una compañía no debe ser consultable por otra.",
        "No presente el consentimiento como un checkbox de inducción. Si la autorización es el mecanismo aplicable, debe ser informada, específica y gestionada con el mismo cuidado que cualquier otro dato sensible. Ante duda de base jurídica o de proporcionalidad, priorice asesoría antes de escalar el despliegue nacional.",
        "Alinee el mensaje interno: la biometría no garantiza honestidad; reduce un riesgo concreto de identidad en un punto de marcación. Prometer vigilancia total genera expectativas que el sistema no puede cumplir y aumenta la presión para reutilizar plantillas con finalidades no declaradas. Un piloto en una sola sede, con métricas de falso rechazo y de excepciones, suele revelar más que una compra masiva basada en la demostración del proveedor.",
        "Incluya en el inventario de riesgos el acceso de soporte del proveedor y de administradores internos. Un control biométrico débil en la gestión de privilegios puede anular el cuidado puesto en el enrolamiento. Revise accesos privilegiados con la misma frecuencia con la que revisa falsos rechazos.",
      ],
    },
  ],

  "reportes-rrhh-que-si-sirven": [
    {
      heading: "De la pregunta de negocio al tablero mínimo",
      paragraphs: [
        "En una red de restaurantes en Antioquia, la pregunta útil no es quién llegó tarde ayer en abstracto, sino qué turno quedó descubierto y qué ajuste de personal evita el mismo hueco el viernes. En un BPO en Bogotá, puede ser qué cola de excepciones impedirá cerrar la nómina el jueves. Escriba la decisión primero; el gráfico después.",
        "Cada métrica necesita denominador, periodo, zona horaria y fecha de actualización. Diez ausencias en un equipo de doce no se leen igual que en una operación de cuatrocientas personas. Separe ausencias programadas de no justificadas; mezclarlas distorsiona la conversación con operaciones.",
        "En manufactura del Valle, un tablero de cobertura por línea suele aportar más que un ranking de puntualidad: muestra capacidad, no moralina. En retail, la lectura por sede y franja horaria revela si el problema es ausentismo o mala programación del turno.",
      ],
    },
    {
      heading: "Portafolio accionable y modelo de lectura",
      paragraphs: [
        "Diario: presentes actuales, marcaciones incompletas, excepciones pendientes. Cierre: horas ordinarias y suplementarias, novedades aprobadas, trazabilidad de cambios. Planeación: cobertura versus turno programado por sucursal. Bienestar: patrones de jornadas extensas persistentes.",
        "Sobre bienestar, use la referencia OMS y OIT con responsabilidad: asociaron 745.000 muertes en 2016 por cardiopatía isquémica y accidente cerebrovascular con jornadas de 55 horas o más semanales. En el reporte interno, traduzca eso a alertas de sobrecarga agregada y planes de redistribución, no a rankings punitivos.",
        "Modelo de lectura en tres capas: señal agregada, desglose por turno o sede, y lista nominal solo para quien debe actuar. Evite que la tercera capa circule por correo masivo o chats generales.",
      ],
      bullets: [
        "Calidad del dato: faltantes, duplicados, corregidos.",
        "Cumplimiento: horas extra por día y por semana.",
        "Operación: huecos de cobertura por turno.",
        "Bienestar: personas o equipos con exceso reiterado.",
        "Diccionario de indicadores versionado y con dueño.",
      ],
    },
    {
      heading: "Checklist para evitar conclusiones que el dato no soporta",
      paragraphs: [
        "¿La métrica cambia una decisión esta semana? ¿El total puede rastrearse hasta los eventos fuente? ¿Los grupos pequeños están agregados en vistas ejecutivas? ¿Asistencia se presenta como productividad? El DANE calcula productividad con valor agregado y contribuciones de capital y trabajo; en la empresa, complemente tiempo con resultados y condiciones.",
        "Preguntas de diagnóstico: ¿quién define el diccionario de indicadores? ¿Hay una sola fuente de verdad entre asistencia y nómina? ¿El líder ve el mismo número que RR. HH.? ¿Cuánto tarda resolver una excepción desde que aparece en el tablero? ¿El reporte de horas extra alimenta el registro exigido por la normativa aplicable?",
      ],
    },
    {
      heading: "Ritmo de gobierno del reporte",
      paragraphs: [
        "Asigne un dueño por tablero, una cadencia de revisión —diaria operativa, semanal táctica, mensual de capacidad— y un log de cambios de definición. Cuando cambie una regla de turno o de recargo, versionar el indicador evita disputas del tipo antes daba otro número.",
        "Un buen reporte reduce reuniones de reconstrucción anecdótica. Si después de implementarlo siguen las mismas discusiones en Excel paralelo, el problema no es falta de gráficos sino falta de confianza en el dato o de proceso de corrección. Incluya en la revisión mensual un indicador de calidad del dato: sin él, cualquier KPI de cobertura o cumplimiento es frágil.",
        "Cuando presente resultados a la gerencia, lleve siempre el denominador y un ejemplo de acción tomada. Decir que subieron las horas extra en la sede norte no es un insight; decir que reprogramaron el turno de cierre y bajó la cola de excepciones en siete días sí lo es. El reporte sirve si cambia una decisión observable.",
        "Si el tablero no reduce el Excel paralelo en dos ciclos de cierre, trate eso como defecto de adopción o de calidad del dato, no como falta de gráficos. Congelar nuevas métricas hasta estabilizar la fuente de verdad suele acelerar más las decisiones que agregar otro panel.",
      ],
    },
  ],

  "roi-software-asistencia-90-dias": [
    {
      heading: "Diseñar la línea base con rubros locales",
      paragraphs: [
        "En los primeros 30 días, no se trata de encender el software, sino de fotografiar el costo actual. Elija un cierre completo y registre horas de consolidación, marcaciones corregidas, casos reabiertos, ajustes monetarios y tiempo de respuesta al trabajador, valorados con tarifas internas reales.",
        "Incluya roles que suelen quedar fuera del cálculo: el líder de piso que reconstruye turnos, el analista de nómina que reprocesa y el propio trabajador que escribe por un descuadre. Sin esos minutos, el retorno parecerá más alto de lo que la organización experimentará.",
        "EY reportó en Estados Unidos US$291 por error, cerca de una nómina con error por cada cinco —precisión promedio 80,15%— y 26 minutos por empleado al año para corregir punches. Use esos hallazgos solo para no olvidar categorías de costo; declare ahorro colombiano únicamente con su línea base.",
      ],
    },
    {
      heading: "Piloto de circuito completo entre los días 31 y 60",
      paragraphs: [
        "Seleccione una sede representativa: ni la más sencilla ni un caos excepcional. Configure turnos, excepciones, capacitación de líderes y la salida hacia nómina. Un piloto que termina en la aplicación pero no liquida no demuestra retorno de un software de asistencia.",
        "Revise semanalmente: tasa de marcaciones válidas al primer intento, minutos desde la anomalía hasta su resolución, minutos de consolidación y satisfacción de trabajadores, líderes y nómina. Si RR. HH. ahorra tiempo pero cada colaborador pierde minutos extras, el balance neto debe decirlo con claridad.",
        "Documente fricciones típicas del contexto colombiano: conectividad intermitente en bodegas, dispositivos compartidos, cambios de sede el mismo día y aprobaciones que llegan por chat. Cada fricción es un supuesto a corregir antes de escalar.",
      ],
      bullets: [
        "Separar beneficios realizados de proyecciones a otras sedes.",
        "Incluir licencias, dispositivos, implementación, soporte y gestión del cambio en el costo.",
        "Registrar tickets e intentos fallidos, no solo el éxito promedio.",
        "Comparar la misma ventana calendario antes y después.",
      ],
    },
    {
      heading: "Modelo de retorno neto para los días 61 a 90",
      paragraphs: [
        "El retorno neto observado es el ahorro de tiempo valorizado más la reducción de reprocesos monetarios, menos licencias prorrateadas, implementación prorrateada y operación del periodo. Presente en paralelo una proyección a doce meses etiquetada como supuesto, nunca mezclada con lo medido.",
        "Criterios de decisión: escalar si el piloto mejora calidad del dato y tiempo de cierre con fricción aceptable; ajustar si el valor aparece pero la adopción falla; detener si el costo total supera el beneficio observado sin hipótesis verificable de mejora. Evite declarar retorno positivo solo porque el proveedor mostró una calculadora genérica.",
      ],
    },
    {
      heading: "Preguntas de diagnóstico para la gerencia",
      paragraphs: [
        "¿La línea base cubre al menos un cierre real? ¿El piloto incluye integración o exportación a nómina? ¿Los supuestos están escritos y fechados? ¿Se midió experiencia del trabajador o solo eficiencia de RR. HH.? ¿Quién firmará la decisión de escalar, ajustar o detener?",
        "El DANE publica productividad con metodología explícita; aplique el mismo rigor interno. Un resultado modesto y medido sostiene mejor la decisión de compra que una promesa construida con tarifas extranjeras sin contexto. Guarde el expediente del piloto: será la referencia cuando alguien pida más funciones sin demostrar más valor.",
        "Si al día 90 el ahorro de consolidación es claro pero la adopción de líderes es baja, no declare fracaso del producto automáticamente: puede faltar rediseño de excepciones o de incentivos de proceso. Separe en el informe el valor técnico observado de la brecha de adopción para apuntar al cuello de botella correcto.",
        "Presente a finanzas una tabla de tres columnas: beneficio observado, supuesto de proyección y costo irreversible ya incurrido. Esa separación evita debates en los que se mezcla un ahorro medido en una sede con una extrapolación nacional sin evidencia equivalente.",
      ],
    },
  ],

  "rrhh-ia-api-webhooks-mcp": [
    {
      heading: "Elegir el mecanismo según el ritmo del problema",
      paragraphs: [
        "Si nómina necesita un extracto de horas aprobadas cada quincena, una API bajo demanda suele bastar. Si operaciones debe reaccionar cuando se aprueba una novedad o se registra una marcación crítica, un webhook evita sondeos agresivos. Si un asistente de IA debe responder preguntas como quién está presente en la sede de Cartagena con herramientas gobernadas, MCP puede exponer acciones acotadas sin abrir la base de datos.",
        "Los tres se complementan. El error típico es dar a la IA credenciales amplias para que explore, o martillar una API cada minuto cuando un evento push resolvería el caso con menos carga y menos superficie de ataque.",
        "En un holding con varias razones sociales, el mismo patrón se repite: cada empresa necesita su propio aislamiento. Una automatización inteligente que cruce tenants no es eficiencia; es un incidente de diseño.",
      ],
    },
    {
      heading: "Guía de arquitectura segura multi-empresa",
      paragraphs: [
        "El identificador de empresa debe salir de la credencial, no de un parámetro editable por el cliente. Use tokens por integración, con alcance de lectura o escritura, vencimiento y rotación. Los webhooks deben ir firmados y con reintentos idempotentes. MCP debe limitarse a herramientas que ya validan identidad, tenant y permisos en el backend.",
        "Casos responsables para IA: resumir ausencias, explicar un reporte, listar excepciones pendientes o redactar un borrador. Casos que exigen control humano reforzado o prohibición: aprobar horas extra, sancionar, alterar biometría o exportar datos sensibles a un modelo generativo sin necesidad y base jurídica evaluadas.",
        "Empiece por herramientas de solo lectura. Cuando agregue escritura, exija confirmación humana y registre el actor, la herramienta y el recurso afectado.",
      ],
      bullets: [
        "API: consultas y sincronizaciones deterministas.",
        "Webhooks: reacción a eventos definidos del catálogo.",
        "MCP: herramientas acotadas y auditables para asistentes.",
        "Auditoría: quién consultó o ejecutó cada acción y cuándo.",
        "Rotación y vencimiento de credenciales por integración.",
      ],
    },
    {
      heading: "Checklist de puesta en marcha",
      paragraphs: [
        "Inventarie integraciones actuales y datos que cruzan fronteras de sistema. Defina el evento mínimo viable para webhooks. Documente contratos de API con recursos, errores y paginación. Para MCP, liste herramientas de solo lectura primero. Pruebe aislamiento: un token de la empresa A no debe leer la empresa B.",
        "Preguntas de diagnóstico: ¿hay sondeo que pueda reemplazarse por webhook? ¿La IA cita registros fuente o solo parafrasea? ¿Existe aprobación humana para acciones de escritura? ¿Se envía biometría o ubicaciones innecesarias a terceros? ¿El reintento del webhook puede duplicar un efecto lateral?",
      ],
    },
    {
      heading: "Matices de gobernanza",
      paragraphs: [
        "OpenAI documenta conectores y servidores MCP remotos; Google Cloud publica prácticas de seguridad para API. Consulte la documentación vigente del proveedor, pero mantenga la política interna por encima del tutorial: minimización, trazabilidad, revisión humana y prohibición de usos no evaluados.",
        "En un grupo empresarial colombiano con varias razones sociales, resista la tentación de un super token. El aislamiento por empresa no es un detalle técnico: es el control que evita una fuga multi-tenant disfrazada de automatización inteligente. Revise trimestralmente permisos, destinos de webhook y herramientas MCP expuestas.",
        "Un ejercicio práctico: escriba tres preguntas que un gerente de RR. HH. haría en lenguaje natural y verifique si la cadena de API, webhooks y MCP puede responderlas citando registros fuente. Si la respuesta es un resumen sin enlace a fechas, turnos o novedades, la integración aún no está lista para decisiones operativas.",
        "Documente un catálogo corto de eventos webhook y de herramientas MCP permitidas, con dueño y fecha de revisión. Sin catálogo, cada automatización nueva tiende a pedir más permisos de los necesarios y termina convirtiéndose en una puerta lateral hacia datos de asistencia. Revise también que los logs de auditoría sean legibles para RR. HH. y seguridad, no solo para el equipo técnico.",
      ],
    },
  ],

  "elegir-software-asistencia-colombia": [
    {
      heading: "Prueba de cierre real: el criterio que más discrimina",
      paragraphs: [
        "Pida al proveedor procesar de extremo a extremo sus propios casos: turno nocturno, cambio de sede, ausencia autorizada, marcación olvidada, hora extra y cierre hacia nómina. Una demostración con horario fijo de oficina no revela el comportamiento en retail, salud, logística o call centers colombianos.",
        "Verifique el reporte de trabajo suplementario con nombre, actividad, horas y distinción diurna o nocturna, conforme al artículo 12 de la Ley 2466 de 2025, y alertas frente al límite general del artículo 13 —dos horas diarias y doce semanales como regla general—, con forma clara de configurar excepciones sectoriales legales cuando apliquen.",
        "Incluya en la prueba al menos un usuario que marque desde móvil en zona de conectividad irregular y otro en kiosco compartido. La comparación entre canales suele exponer fricciones que la demostración comercial oculta.",
      ],
    },
    {
      heading: "Checklist de privacidad, seguridad y continuidad",
      paragraphs: [
        "Si hay reconocimiento facial: evaluación de necesidad, política de tratamiento, contrato de encargado, ubicación del alojamiento, cifrado, eliminación verificable, imagen versus plantilla, y alternativa para quien no puede usar el mecanismo. La Ley 1581 y, como referencia de diligencia, la Circular Externa 001 de 2025 de la SIC, orientan el nivel de cuidado esperado ante datos sensibles.",
        "Exija aislamiento entre clientes, respaldos, plan de incidentes, autenticación robusta y auditoría. En móvil: alternativa ante conectividad deficiente. En geofence: captura puntual y manejo de precisión insuficiente sin borrar el derecho a registrar la jornada. Pregunte también por portabilidad: cómo exportar el historial completo al terminar el contrato.",
      ],
      bullets: [
        "Reglas laborales configurables y versionadas.",
        "Correcciones con aprobación e historial.",
        "Exportación o integración estable con nómina.",
        "Soporte, disponibilidad y portabilidad al terminar el contrato.",
        "Aislamiento multi-empresa verificable en la prueba.",
      ],
    },
    {
      heading: "Modelo de costo total y preguntas al comité de compra",
      paragraphs: [
        "El costo total suma licencias, dispositivos, implementación, soporte, integraciones y gestión del cambio. Compárelo con su línea base local de reprocesos. Las cifras de EY —US$291 por error y 26 minutos por empleado en corrección de punches, estudio de Estados Unidos de 2022— ilustran el tipo de costo oculto, pero no sustituyen su medición en pesos y en horas reales.",
        "Pregunte: ¿quién gana con criterios ponderados escritos? ¿El piloto incluyó a trabajadores, líderes, RR. HH. y nómina? ¿Qué pasa con los datos al salir? ¿La biometría o la IA resuelven una necesidad demostrada o solo adornan la propuesta comercial? ¿El proveedor puede mostrar un reporte de horas extra explicable sin trabajo manual posterior?",
      ],
    },
    {
      heading: "Matices de selección en el mercado local",
      paragraphs: [
        "Priorice evidencia trazable y excepciones humanas bien diseñadas sobre la lista más larga de funciones. Un sistema que no puede explicar un recargo o que castiga al trabajador por un fallo de GPS generará más costo político que el ahorro prometido.",
        "Deje por escrito la decisión: puntajes, riesgos residuales y condiciones de salida. Esa memoria evita reabrir la compra cada vez que un proveedor nuevo muestre un video impactante sin superar la prueba de cierre. Si dos opciones empatan en funciones, gane la que reduzca correcciones en el piloto y permita a un tercero entender cómo se liquidó una jornada excepcional.",
        "Antes de firmar, pida un plan de transición de noventa días con responsables del proveedor y de la empresa: configuración de turnos, capacitación, corte paralelo y criterio de aceptación del primer cierre. Sin ese plan, el go-live suele convertirse en un periodo largo de Excel de respaldo que borra el valor de la elección.",
        "Pondere en la matriz de decisión no solo el precio por usuario, sino el costo de no poder explicar un recargo o de depender de un único dispositivo. En el mercado colombiano, la continuidad operativa y la evidencia trazable suelen pesar más que una función llamativa que nadie usa en el cierre.",
      ],
    },
  ],

};

export function getArticleExpansion(slug: string): ArticleSection[] {
  if (slug in articleExpansions) {
    return articleExpansions[slug as ExpandableArticleSlug];
  }

  return [];
}
