import { getArticleExpansion } from "./article-expansions";

export interface ArticleSource {
  title: string;
  url: string;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  readingTime: string;
  answer: string;
  sections: ArticleSection[];
  sources: ArticleSource[];
}

const eyPayrollStudy: ArticleSource = {
  title: "EY — Cost and risks due to payroll errors (2022)",
  url: "https://eyquest.com/files/Cost_and_Risks_Due_to_Payroll_Errors_2022_Final.pdf",
};

const whoLongHours: ArticleSource = {
  title: "OMS/OIT — Long working hours increasing deaths from heart disease and stroke",
  url: "https://www.who.int/news/item/17-05-2021-long-working-hours-increasing-deaths-from-heart-disease-and-stroke-who-ilo",
};

const colombianLaborReform: ArticleSource = {
  title: "Función Pública — Ley 2466 de 2025",
  url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=260676",
};

const dataProtectionLaw: ArticleSource = {
  title: "Secretaría Jurídica Distrital — Ley 1581 de 2012",
  url: "https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981",
};

const sicBiometrics: ArticleSource = {
  title: "SIC — Circular Externa 001 de 2025 sobre tratamiento de datos personales",
  url: "https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20No.%20001.pdf",
};

const daneProductivity: ArticleSource = {
  title: "DANE — Productividad Total de los Factores 2025",
  url: "https://www.dane.gov.co/files/operaciones/PTF/bol-PTF-2025.pdf",
};

const baseArticles: Article[] = [
  {
    slug: "control-de-tiempo-sin-vigilancia",
    title: "Control de tiempo sin vigilancia: cómo construir confianza con evidencia",
    description:
      "Una guía para registrar la jornada con proporcionalidad, reglas claras y datos útiles, sin convertir el trabajo en vigilancia permanente.",
    category: "Cultura laboral",
    publishedAt: "2026-07-20",
    readingTime: "8 min",
    answer:
      "Un buen control de tiempo verifica hechos laborales concretos —inicio, fin, pausas y novedades— sin observar cada movimiento. La diferencia está en limitar la finalidad, recolectar solo lo necesario, dar visibilidad al trabajador y usar los datos para corregir procesos, no para presumir mala fe.",
    sections: [
      {
        heading: "Registrar una jornada no equivale a vigilar a una persona",
        paragraphs: [
          "La empresa necesita saber cuándo comienza y termina una jornada para liquidar la nómina, organizar turnos y responder ante una reclamación. Esa necesidad legítima no autoriza a reconstruir cada minuto de la vida del trabajador. El sistema debe probar eventos relevantes, no producir una bitácora de comportamiento.",
          "La prueba más sencilla es preguntar si cada dato tiene una finalidad laboral definida. La hora de entrada puede justificar un recargo; una captura continua de pantalla difícilmente es necesaria para ese mismo propósito. Cuanto más precisa sea la finalidad, más fácil será descartar funciones invasivas.",
          "En la práctica, muchos conflictos no nacen de la tecnología sino del silencio sobre las reglas. Si el equipo no sabe qué se registra, quién lo ve, por cuánto tiempo se conserva y cómo se corrige un error, cualquier marcación se percibe como vigilancia. Documentar esas respuestas en un lenguaje claro reduce la resistencia y mejora la calidad del dato.",
          "También conviene separar tres capas: evidencia de jornada, evidencia de seguridad física y evaluación de desempeño. Mezclarlas en un solo tablero invita a conclusiones injustas. Un retraso de cinco minutos puede ser un tema de puntualidad; no demuestra calidad del trabajo ni intención de fraude.",
        ],
        bullets: [
          "Definir por escrito qué se registra y para qué.",
          "Evitar capturas continuas de audio, video, pantalla o ubicación.",
          "Permitir que cada persona consulte y solicite correcciones de sus marcaciones.",
          "Separar la gestión de asistencia de la evaluación de desempeño.",
          "Publicar el flujo de excepciones y los roles que aprueban.",
        ],
      },
      {
        heading: "Un marco de proporcionalidad para decidir qué medir",
        paragraphs: [
          "Antes de activar una función, escriba el riesgo concreto que busca reducir: marcaciones olvidadas, horas extra no liquidadas, suplantación en una sede o inconsistencias entre turnos. Luego liste alternativas de menor impacto. Solo si esas alternativas no alcanzan el objetivo con un costo razonable, se justifica un control más fuerte.",
          "La Ley 1581 de 2012 recuerda que el tratamiento de datos personales debe respetar principios como finalidad, libertad, transparencia, seguridad y confidencialidad. Aunque el control de asistencia no es, por sí solo, un tratamiento biométrico, la misma lógica de minimización ayuda a diseñar el sistema: recolecte lo necesario, informe y proteja el acceso.",
          "Un modelo útil es el de tres preguntas: (1) ¿qué decisión habilita este dato?, (2) ¿qué pasa si el dato falla o falta?, y (3) ¿quién puede verlo sin necesidad? Si no hay respuesta clara a la primera, el dato es candidato a eliminarse. Si la segunda respuesta es “nada grave”, el control puede ser más flexible. Si la tercera respuesta incluye a demasiadas personas, el acceso debe reducirse.",
          "Ejemplo: un kiosco en recepción puede registrar entrada y salida sin grabar video permanente. Una app móvil puede pedir ubicación solo al marcar. Un tablero de gerencia puede mostrar cobertura agregada por turno, no una lista nominal de cada segundo de presencia.",
        ],
      },
      {
        heading: "Diseñar controles que ayuden a ambas partes",
        paragraphs: [
          "La confianza crece cuando el registro también protege al trabajador: hace visibles las horas extra, evita descuentos por errores y documenta pausas o novedades autorizadas. Un tablero compartido reduce la asimetría porque RR. HH., líderes y colaboradores ven la misma fuente.",
          "También importa el manejo de excepciones. Una marcación olvidada no debería convertirse automáticamente en falta disciplinaria. Conviene abrir un flujo de corrección con motivo, aprobación y trazabilidad. Así se conserva la evidencia sin reemplazar el criterio humano.",
          "Checklist operativa mínima: (a) cada persona puede ver su propio historial del periodo abierto; (b) las correcciones dejan rastro de quién pidió, quién aprobó y por qué; (c) las alertas de exceso de jornada llegan antes del cierre de nómina; (d) los líderes no pueden editar silenciosamente registros ajenos sin auditoría; (e) RR. HH. puede exportar evidencia legible ante una solicitud del trabajador.",
          "Si el sistema solo sirve para “atrapar” y nunca para explicar un pago, el equipo aprenderá a rodearlo. Si el sistema reduce discusiones sobre “yo sí marqué” y acelera la liquidación correcta, la adopción mejora sin necesidad de vigilancia adicional.",
        ],
        bullets: [
          "Alertas preventivas antes de exceder una jornada.",
          "Correcciones con historial, responsable y motivo.",
          "Retención limitada y acceso según el rol.",
          "Indicadores agregados para planear, no rankings individuales permanentes.",
          "Ventana de revisión previa al cierre de nómina.",
        ],
      },
      {
        heading: "Medir bienestar, no solo presencia",
        paragraphs: [
          "La asistencia dice si alguien estuvo, pero no demuestra productividad. El DANE mide la productividad con factores más amplios que el número de horas; en el boletín de Productividad Total de los Factores 2025 preliminar reportó aportes diferenciados del capital, el trabajo y la productividad total al crecimiento del valor agregado. En una empresa, la lectura también debe combinar resultados, calidad, carga y contexto.",
          "Las jornadas excesivas merecen una alerta de salud. La OMS y la OIT estimaron que trabajar 55 horas o más por semana estuvo asociado con 745.000 muertes por cardiopatía isquémica y accidente cerebrovascular en 2016. El dato no sirve para vigilar más, sino para detectar sobrecarga y actuar antes: redistribuir turnos, revisar vacantes, ajustar metas o abrir una conversación de prevención.",
          "Traduzca esa señal a un indicador local: personas con jornadas extendidas de forma reiterada, o turnos que sistemáticamente terminan con suplementarias. El umbral debe definirse con acompañamiento de SST y asesoría laboral interna; no copie un número internacional como si fuera una norma colombiana automática.",
          "Cierre el ciclo con una decisión visible. Si el reporte muestra sobrecarga y nadie cambia la programación, el control de tiempo se vuelve un archivo de riesgos no gestionados. La evidencia solo genera confianza cuando produce correcciones justas y previsibles.",
        ],
      },
      {
        heading: "Plan de 30 días para pasar de vigilancia a evidencia útil",
        paragraphs: [
          "Semana 1: inventarie qué se captura hoy (reloj, Excel, WhatsApp, cámara, GPS) y elimine o pause lo que no tenga finalidad escrita. Semana 2: publique reglas de marcación, excepciones y correcciones; capacite a líderes con casos reales. Semana 3: active alertas de calidad de dato y de exceso de jornada en un piloto. Semana 4: compare el número de ajustes de nómina y el tiempo de consolidación contra el mes anterior.",
          "Indicadores de éxito razonables: menos correcciones posteriores al pago, menos tickets del tipo “no me aparece la entrada”, mayor porcentaje de marcaciones válidas al primer intento y menor uso de canales informales. Evite como KPI el “tiempo medio sentado en el puesto” o rankings de productividad basados solo en presencia.",
          "Este contenido es informativo y no sustituye asesoría jurídica ni de seguridad y salud en el trabajo. El diseño final depende del tipo de contrato, la sede, el sector y las políticas internas vigentes.",
        ],
      },
    ],
    sources: [
      whoLongHours,
      daneProductivity,
      dataProtectionLaw,
    ],
  },  {
    slug: "costo-real-planilla-imperfecta",
    title: "El costo real de una planilla imperfecta va más allá de corregir la nómina",
    description:
      "Cómo estimar el impacto operativo, financiero y humano de marcaciones incompletas sin trasladar cifras internacionales fuera de contexto.",
    category: "Nómina",
    publishedAt: "2026-07-18",
    readingTime: "8 min",
    answer:
      "Una planilla imperfecta cuesta horas de revisión, reprocesos, pagos equivocados y confianza. EY encontró en Estados Unidos una precisión promedio cercana a cuatro de cada cinco nóminas, US$291 por error y 26 minutos anuales por empleado para corregir marcaciones; son referencias, no tarifas aplicables automáticamente a Colombia.",
    sections: [
      {
        heading: "El error visible es apenas el comienzo",
        paragraphs: [
          "Una entrada faltante parece un dato pequeño, pero obliga a localizar al supervisor, reconstruir el turno, modificar la novedad y revisar la liquidación. Si la corrección llega después del cierre, puede exigir un ajuste adicional y una explicación al trabajador. El costo se reparte entre operaciones, RR. HH., nómina y finanzas.",
          "El estudio de EY de 2022, realizado sobre nóminas estadounidenses, reportó una precisión promedio de 80,15% —aproximadamente una de cada cinco con errores— y un costo medio de US$291 por incidente. También calculó 26 minutos por empleado al año para completar o corregir punches. No conviene convertir esos valores directamente a pesos: la estructura salarial, los procesos y el marco regulatorio son distintos.",
          "Además del costo directo, aparecen costos diferidos: molestia por pagos incompletos, pérdida de confianza, tiempo de gerencia en mediaciones y, en escenarios graves, requerimientos de autoridad o litigios. Ninguno de esos rubros aparece en la primera corrección de Excel, pero todos crecen cuando el mismo error se repite cada quincena.",
          "La Ley 2466 de 2025 refuerza la importancia de poder explicar el trabajo suplementario con registro y soporte de pago. Una planilla imperfecta no solo “queda fea”: puede dejar a la empresa sin evidencia ordenada cuando el trabajador o una autoridad la soliciten.",
        ],
      },
      {
        heading: "Modelo de cálculo para una línea base colombiana",
        paragraphs: [
          "La decisión útil no es multiplicar una cifra extranjera por la plantilla, sino medir el proceso local durante varios cierres. Un modelo simple tiene cuatro bloques: (1) volumen de excepciones, (2) minutos por rol, (3) valor monetario de ajustes y (4) costo de oportunidad.",
          "Bloque 1 — volumen: cuente marcaciones faltantes, duplicadas, fuera de sede, sin salida y novedades reabiertas por periodo. Exprese el resultado por cada 100 empleados para comparar sedes. Bloque 2 — minutos: estime el tiempo de trabajador, líder, RR. HH. y nómina por cada tipo de excepción. Multiplique por una tarifa interna realista (costo laboral aproximado del minuto).",
          "Bloque 3 — dinero: sume pagos en exceso, pagos incompletos y ajustes posteriores. Separe errores de captura de errores de regla (por ejemplo, un recargo mal configurado). Bloque 4 — oportunidad: asigne un factor conservador al tiempo que deja de invertirse en planeación, selección o acompañamiento. Documente el supuesto; no lo presente como un hecho contable si no está medido.",
          "Ejemplo ilustrativo (no es un promedio nacional): 200 empleados, 40 excepciones de marcación por quincena, 25 minutos promedio de corrección multi-rol y una tarifa interna de $800 por minuto. El costo operativo estimado sería 40 × 25 × 800 = $800.000 por quincena solo en tiempo, antes de contar ajustes salariales. Cambie las cifras por las suyas; el valor del ejercicio está en el método.",
          "Si quiere contrastar con EY, use los 26 minutos anuales por empleado solo como hipótesis: ¿cuántos minutos está gastando usted hoy? Si mide 40 minutos por empleado al año solo en punches, ya tiene una línea base propia más útil que cualquier conversión automática de dólares a pesos.",
        ],
        bullets: [
          "Marcaciones faltantes o duplicadas por periodo.",
          "Minutos de corrección por rol involucrado.",
          "Pagos en exceso, pagos incompletos y ajustes posteriores.",
          "Casos reabiertos y tiempo de respuesta al trabajador.",
          "Porcentaje de excepciones descubiertas después del pago.",
        ],
      },
      {
        heading: "Clasificar causas para no aplicar la misma solución a todo",
        paragraphs: [
          "Incluya el costo de oportunidad y, sobre todo, distinga causas. Error de captura: el dispositivo falló o la persona olvidó marcar. Regla mal configurada: el turno no refleja la jornada real. Aprobación tardía: el líder valida cuando la nómina ya cerró. Integración fallida: el archivo llegó incompleto al sistema de pagos. Cada causa exige un remedio distinto.",
          "Una matriz práctica tiene filas por causa y columnas por frecuencia, impacto monetario y facilidad de corrección. Priorice primero lo frecuente y caro, aunque sea técnicamente simple: por ejemplo, salidas no marcadas en un turno nocturno. Deje para después las excepciones raras aunque llamativas.",
          "Cuando use cifras de EY, hágalo como hipótesis de orden de magnitud: “si corrigiéramos X minutos por empleado, ¿qué capacidad liberaríamos?”. No declare un ahorro en pesos basado únicamente en US$291 o en 26 minutos sin haber medido la operación local.",
        ],
      },
      {
        heading: "Cerrar el circuito entre asistencia y nómina",
        paragraphs: [
          "La mejora comienza antes del cierre: alertas por anomalías, reglas de turno vigentes y una ventana para que trabajadores y líderes revisen sus datos. Después, una exportación estable o una integración debe transportar únicamente registros aprobados, con una versión identificable.",
          "Defina un “congelamiento” del periodo: a partir de una hora límite solo entran correcciones con justificación. Eso no elimina la flexibilidad; evita que la planilla sea un documento vivo hasta el último minuto. Guarde la versión enviada a nómina y la versión final pagada para poder explicar diferencias.",
          "El objetivo no es prometer una nómina sin excepciones. Es evitar que la misma excepción se descubra tarde y se procese varias veces. Un historial de cambios, responsables y reglas aplicadas reduce discusiones y permite demostrar cómo se llegó al valor pagado.",
        ],
      },
      {
        heading: "Checklist de cierre quincenal",
        paragraphs: [
          "Antes de liquidar: revisar marcaciones incompletas, validar turnos vigentes, confirmar novedades aprobadas, simular recargos diurnos y nocturnos, y publicar un resumen de excepciones abiertas. Después de liquidar: registrar ajustes, medir tiempo total de consolidación y anotar causas raíz de los tres errores más costosos.",
          "En 60 a 90 días, compare la línea base con el nuevo proceso. Si el tiempo de consolidación bajó pero aumentaron las quejas de trabajadores, el sistema transferió carga en lugar de eliminarla. El costo real también incluye la experiencia de quien marca.",
          "Este artículo ofrece un método de estimación y no constituye asesoría contable, tributaria ni jurídica. Valide supuestos con su equipo financiero y con asesoría laboral cuando el análisis se use para decisiones contractuales o disciplinarias.",
        ],
      },

      {
        heading: "Cómo presentar el caso a gerencia sin dramatizar",
        paragraphs: [
          "Lleve una página: problema, método de medición, cifras locales de dos cierres, comparación con referencias internacionales etiquetadas como tales, y una propuesta de experimento de 60 días. Evite apocalipsis (“perdemos millones”) si no tiene base.",
          "Separe costo operativo (tiempo) de costo salarial (ajustes) y de riesgo (solicitudes o eventuales sanciones). Cada audiencia responde a un rubro distinto. Finanzas mira caja; operaciones mira horas; legal mira evidencia.",
          "Proponga un piloto con hipótesis falsable: “si activamos ventana de revisión previa al cierre, las correcciones post-pago bajarán de forma medible”. Si no baja, ajuste el proceso; no declare victoria por haber comprado software.",
          "Mantenga el rigor: las cifras de EY (US$291, una de cada cinco nóminas, 26 minutos) son útiles para educar sobre el tipo de problema, no para sustituir su contabilidad. Este contenido no constituye asesoría financiera ni jurídica.",
        ],
      },
    ],
    sources: [
      eyPayrollStudy,
      colombianLaborReform,
    ],
  },  {
    slug: "buddy-punching-como-prevenirlo",
    title: "Buddy punching: prevenir la suplantación sin castigar a todo el equipo",
    description:
      "Controles proporcionales contra la marcación por terceros, con mejor diseño operativo, verificación de identidad y rutas de excepción.",
    category: "Prevención de fraude",
    publishedAt: "2026-07-16",
    readingTime: "8 min",
    answer:
      "El buddy punching ocurre cuando una persona registra la asistencia de otra. Se reduce combinando identidad, contexto y trazabilidad, pero ningún control aislado es infalible. La respuesta más sana es graduar el riesgo, ofrecer alternativas y revisar evidencia antes de tomar decisiones disciplinarias.",
    sections: [
      {
        heading: "Comprender por qué ocurre",
        paragraphs: [
          "Compartir un código, una tarjeta o una contraseña permite que un compañero marque por otro. A veces hay intención de ocultar una ausencia; otras veces el sistema es tan rígido que el equipo improvisa ante una fila, un dispositivo dañado o una tarea fuera de sede. Confundir ambos escenarios produce controles injustos.",
          "Antes de comprar tecnología, revise dónde se concentran las anomalías: un turno, una sede, un dispositivo o una regla. Los patrones pueden revelar una vulnerabilidad, pero no prueban por sí solos quién actuó ni con qué intención.",
          "Mapee también las “fugas operativas”: un solo PIN compartido en un restaurante, una tarjeta que se deja en el casillero, un kiosco lejos de la zona de trabajo o un proceso de excepción verbal sin registro. Cada fuga sugiere un rediseño distinto. Castigar al equipo completo por un diseño frágil suele empeorar la improvisación.",
          "Una conversación abierta con líderes de turno suele aportar más que una sospecha genérica. Pregunte qué pasa cuando el dispositivo falla, cuánto tarda la fila en hora pico y si existe una vía clara para reportar una marcación olvidada. Las respuestas orientan el control hacia fricción útil, no hacia vigilancia simbólica.",
        ],
      },
      {
        heading: "Combinar señales con proporcionalidad",
        paragraphs: [
          "Una verificación facial puede confirmar que la persona está presente; el geofence puede validar que un móvil se encuentra dentro del área autorizada; y la secuencia de entradas y salidas puede detectar duplicados. Juntas ofrecen mayor contexto, siempre que la empresa limite la finalidad y proteja los datos.",
          "La biometría es sensible bajo la Ley 1581 de 2012. Su adopción exige informar finalidades, obtener la autorización que corresponda y aplicar seguridad reforzada. Además, un fallo de cámara, conectividad o reconocimiento necesita una ruta alternativa para que una persona no pierda su registro.",
          "La Circular Externa 001 de 2025 de la SIC, aunque orientada a un contexto fintech, ilustra una diligencia reforzada útil como referencia: finalidades precisas, autorización explícita, proporcionalidad, medidas de seguridad adicionales y borrado cuando termina la relación y ya no subsiste la finalidad. No la trate como un checklist automático para todo empleador; sí como señal de cuidado esperado ante datos biométricos.",
          "Modelo de capas: capa A (identidad personal no trivial de compartir), capa B (contexto de sede/dispositivo/horario), capa C (trazabilidad de cambios) y capa D (excepción asistida). Empiece por A+C si el riesgo es bajo; agregue B o biometría solo cuando el patrón lo justifique.",
        ],
        bullets: [
          "Identidad: mecanismo personal que no pueda compartirse fácilmente.",
          "Contexto: sede, dispositivo y horario esperado.",
          "Trazabilidad: registro de cambios y aprobaciones.",
          "Excepción: marcación asistida y posterior validación.",
          "Medición: falsos positivos, falsos negativos y tiempo de espera.",
        ],
      },
      {
        heading: "Diseñar la excepción para que no se convierta en agujero",
        paragraphs: [
          "Toda regla dura crea una excepción. Si no la diseña, el equipo la inventará. Defina quién puede hacer una marcación asistida, qué evidencia pide, en qué ventana de tiempo se acepta y cómo queda visible en auditoría.",
          "Ejemplo práctico: si la cámara falla, el líder registra una excepción con foto del ticket del sistema o nota del incidente, y RR. HH. la revisa en las siguientes 24 horas. Si la persona está en visita a cliente, una marcación móvil con geofence amplio o con aprobación previa puede ser más razonable que forzar un kiosco imposible.",
          "Evite excepciones eternas “porque siempre se ha hecho así”. Revise mensualmente las sedes con más excepciones: puede haber un radio mal calibrado, un dispositivo lento o un turno mal modelado. Corregir la causa reduce el buddy punching mejor que aumentar sanciones.",
        ],
      },
      {
        heading: "Investigar antes de sancionar",
        paragraphs: [
          "Una alerta debe iniciar una revisión, no cerrar un juicio. Compare turno, novedades, soporte del líder y disponibilidad del sistema. Conserve la evidencia relevante y permita que la persona explique el evento. Esto mejora la calidad de la decisión y evita que un falso positivo erosione la confianza.",
          "Guión mínimo de investigación: (1) ¿qué señal disparó la alerta?, (2) ¿hubo fallas técnicas ese día?, (3) ¿existen marcaciones vecinas inconsistentes?, (4) ¿hay patrón repetido o es un evento aislado?, (5) ¿qué dijo la persona y qué evidencia aportó? Documente sin dramatizar.",
          "Finalmente, mida si el control corrige el problema: disminución de marcaciones incompatibles, menos ajustes y menos tiempos de espera. Si solo agrega fricción sin mejorar esos indicadores, debe rediseñarse.",
          "Este contenido es informativo y no sustituye asesoría jurídica ni un proceso disciplinario formal. Cualquier medida laboral debe alinearse con el reglamento interno, el debido proceso aplicable y la evaluación del caso concreto.",
        ],
      },
      {
        heading: "Señales tempranas sin caer en paranoia",
        paragraphs: [
          "Hay indicios útiles y hay ruido. Una marcación seguida de otra en menos de un minuto en el mismo dispositivo puede ser una cola mal gestionada o una suplantación; el contexto decide. Una persona que nunca falla el check-in pero acumula ausencias médicas no demostradas tampoco prueba buddy punching por sí sola.",
          "Construya un tablero de anomalías: marcaciones en dispositivos distintos al habitual, entradas sin salida recurrente, coincidencia exacta de minutos entre dos personas en varios días, y picos de excepciones en un solo líder. Use el tablero para priorizar conversaciones, no para publicar sospechas.",
          "Comunique al equipo qué se monitorea y qué no. La transparencia reduce la sensación de cacería y aumenta la legitimidad cuando sí deba investigarse un caso. Incluya ejemplos de falsos positivos para que líderes no interpreten mal las alertas.",
          "Si el problema se concentra en un turno, invierta primero en rediseño: más dispositivos, mejor ubicación del kiosco, ventana de gracia corta o supervisión de apertura. La tecnología de identidad rinde más cuando la operación deja de empujar a las personas a improvisar.",
        ],
        bullets: [
          "Anomalías por dispositivo y por sede.",
          "Patrones repetidos versus eventos aislados.",
          "Tiempo de espera en hora pico.",
          "Excepciones aprobadas sin evidencia.",
        ],
      },
      {
        heading: "Política breve que el equipo sí lee",
        paragraphs: [
          "Redacte una política de una página: propósito del control, métodos permitidos, prohibición de marcar por terceros, canal de excepción, y consecuencias proporcionales según el reglamento interno. Evite lenguaje amenazante; sea claro y específico.",
          "Capacite con escenarios: “llegué tarde y un compañero ofrece marcarme”, “el kiosco no reconoce mi rostro”, “olvidé la salida”. Ensaye la respuesta correcta. La prevención cultural reduce más incidentes que un sensor adicional mal comunicado.",
          "Revise la política cada semestre junto con métricas de fricción. Si las quejas crecen y las anomalías no bajan, el control está mal calibrado. Este contenido no sustituye asesoría jurídica ni un proceso disciplinario formal.",
        ],
      },
    ],
    sources: [
      dataProtectionLaw,
      sicBiometrics,
    ],
  },  {
    slug: "ley-2466-2025-horas-extra-colombia",
    title: "Ley 2466 de 2025: qué cambia en el registro de horas extra",
    description:
      "Lectura práctica de los artículos 12 y 13 para equipos de RR. HH. y operaciones en Colombia, con foco en evidencia y límites.",
    category: "Normativa colombiana",
    publishedAt: "2026-07-14",
    readingTime: "8 min",
    answer:
      "El artículo 12 exige registrar por trabajador la actividad y las horas suplementarias, diferenciando diurnas y nocturnas, y entregar la relación con soporte de pago cuando sea solicitada. El artículo 13 fija como regla general un máximo de dos horas extra diarias y doce semanales, con excepciones legales para salud y seguridad.",
    sections: [
      {
        heading: "Artículo 12: un registro que pueda explicarse",
        paragraphs: [
          "La Ley 2466 de 2025 modificó el numeral 2 del artículo 162 del Código Sustantivo del Trabajo. El empleador debe llevar un registro del trabajo suplementario con nombre, actividad desarrollada, número de horas y precisión sobre su carácter diurno o nocturno. La norma permite adaptarlo a las condiciones de la empresa, pero no elimina esos datos mínimos.",
          "Si el trabajador lo solicita, la empresa debe entregar la relación de horas extra junto con el soporte del pago. También debe aportarla ante autoridades judiciales o administrativas cuando sea requerida. Por eso no basta una cifra final: conviene conservar la cadena entre marcación, novedad, aprobación y liquidación.",
          "En operaciones con múltiples sucursales, el riesgo típico es fragmentar la evidencia: la marcación vive en un sistema, la aprobación en un chat y el pago en otro archivo. Cuando llegue una solicitud, reconstruir esa cadena consume días. Diseñe el registro para que un analista pueda exportarlo en minutos.",
          "Qué suele faltar en la práctica: la “actividad desarrollada” queda genérica (“varios”), no se distingue diurna/nocturna con la regla vigente de jornada, o el soporte de pago no se vincula al mismo identificador del periodo. Corrija esas tres fallas antes de comprar más hardware.",
        ],
      },
      {
        heading: "Artículo 13: controlar el límite antes del cierre",
        paragraphs: [
          "Como regla general, el trabajo suplementario no puede exceder dos horas diarias ni doce semanales. La disposición exceptúa a los sectores de seguridad y salud en los términos de su normativa. La configuración del sistema debe reflejar el sector y no aplicar excepciones por analogía.",
          "Una alerta posterior a la nómina llega tarde. El software debería advertir al líder y a RR. HH. cuando la programación o las marcaciones se acercan al límite. La alerta no reemplaza el análisis laboral, pero convierte el cumplimiento en una práctica diaria.",
          "Ejemplo de umbral operativo: aviso al 75% del límite semanal, bloqueo blando al 100% con ruta de excepción documentada, y revisión semanal de personas cerca del tope. El “bloqueo blando” evita improvisaciones silenciosas y obliga a una decisión consciente.",
          "Recuerde que el parágrafo del artículo 12 indica que no se requiere permiso previo del Ministerio del Trabajo para laborar horas extras, pero si se demuestra falta de remuneración del tiempo suplementario, el Ministerio puede suspender la facultad de autorizar trabajo suplementario por seis meses, sin perjuicio de otras sanciones. La mejor defensa operativa es pagar y documentar a tiempo.",
        ],
        bullets: [
          "Diferenciar horas diurnas y nocturnas.",
          "Asociar la actividad o causa del tiempo suplementario.",
          "Relacionar aprobación y soporte de pago.",
          "Generar un reporte comprensible por persona y periodo.",
          "Alertar antes de alcanzar el tope diario o semanal.",
        ],
      },
      {
        heading: "Traducir la norma a campos del sistema",
        paragraphs: [
          "Una checklist de configuración ayuda a conversar con el proveedor: ¿el sistema guarda actividad por evento o solo un total?, ¿puede separar diurnas y nocturnas según la definición vigente?, ¿exporta un PDF o Excel legible para el trabajador?, ¿conserva la versión pagada y la versión corregida?",
          "Modele también los casos borde: cambio de turno a mitad de semana, trabajo en día de descanso, permisos parciales, y personal que rota entre sedes. Si el software solo entiende un horario fijo de lunes a viernes, el registro del artículo 12 saldrá incompleto aunque la marcación sea perfecta.",
          "Capacite a líderes en el “porqué” del dato. Si alguien aprueba horas extra sin describir la actividad, el registro nace débil. Un formulario de aprobación con campos obligatorios (motivo, sede, franja) suele mejorar más la evidencia que un sensor adicional.",
        ],
      },
      {
        heading: "Implementación responsable y límites de esta guía",
        paragraphs: [
          "Revise reglas, turnos y responsables con asesoría laboral, haga una prueba sobre periodos ya liquidados y documente cómo se resuelven inconsistencias. Capacite a líderes y trabajadores: un sistema correcto con datos tardíos seguirá produciendo una evidencia débil.",
          "Plan sugerido de 45 días: días 1-15 inventario de reglas y brechas; días 16-30 piloto en una sede con exportación de relación de extras; días 31-45 ajuste de alertas y capacitación masiva. Mida tiempo de respuesta a solicitudes del trabajador y porcentaje de extras con actividad descrita.",
          "Este contenido es informativo y no sustituye asesoría jurídica. La aplicación depende del vínculo, el sector, la jornada y las demás normas vigentes. La fuente primaria debe ser siempre el texto oficial de la Ley 2466 de 2025 y el acompañamiento de un profesional del derecho laboral.",
        ],
      },
      {
        heading: "Cómo armar la cadena de evidencia de punta a punta",
        paragraphs: [
          "Piense la evidencia como una cadena con cuatro eslabones: programación del turno, marcación real, aprobación del suplementario y liquidación/pago. Si un eslabón vive en WhatsApp y otro en Excel, la cadena se rompe cuando más se necesita.",
          "Asigne identificadores estables: empleado, periodo, sede y correlativo de novedad. Ese correlativo debe aparecer en el reporte de extras y en el comprobante o detalle de nómina. Así, cuando el trabajador solicite la relación, usted no improvisa una reconstrucción manual.",
          "Defina retenciones internas razonables y accesos por rol. No todos los líderes necesitan ver el histórico completo de otra sede. La minimización también aplica a datos laborales operativos, aunque no sean biométricos.",
          "Pruebe el flujo con un caso real anonimizado: genere tres horas diurnas y dos nocturnas, apruébelas con actividad descrita, liquídelas y exporte la relación. Cronometre cuánto tarda. Si supera quince minutos, el proceso todavía no es operable.",
        ],
      },
      {
        heading: "Preguntas frecuentes de líderes (y respuestas útiles)",
        paragraphs: [
          "“¿Puedo autorizar extras por chat?” Puede conversar por chat, pero la evidencia debería quedar en el sistema con actividad, franja y aprobación nominada. El chat solo rara vez cumple el estándar de un registro entregable.",
          "“¿Qué hago si ya vamos a pasar el tope semanal?” La respuesta operativa es anticipar: reasignar tareas, cubrir con otro turno o documentar una excepción legal si aplica al sector. Improvisar después del hecho debilita el control del artículo 13.",
          "“¿El sistema puede bloquear automáticamente?” Puede advertir o requerir una aprobación adicional; el bloqueo duro debe evaluarse con asesoría laboral y con el impacto en la operación. Un bloqueo mal diseñado empuja a marcar fuera del sistema.",
          "Mantenga estas respuestas en un FAQ interno. La Ley 2466 de 2025 eleva el costo de no documentar; la capacitación reduce ese costo más rápido que comprar otro reloj.",
        ],
        bullets: [
          "FAQ de líderes con ejemplos locales.",
          "Simulacro trimestral de solicitud del trabajador.",
          "Revisión de tops semanales cada lunes.",
          "Inventario de excepciones sectoriales aplicables.",
        ],
      },
    ],
    sources: [
      colombianLaborReform,
    ],
  },  {
    slug: "geofence-marcacion-laboral",
    title: "Geofence para marcación laboral: validar la sede sin rastrear al trabajador",
    description:
      "Qué puede probar una cerca geográfica, cuáles son sus límites técnicos y cómo implementarla con privacidad desde el diseño.",
    category: "Tecnología",
    publishedAt: "2026-07-12",
    readingTime: "9 min",
    answer:
      "Un geofence comprueba si el dispositivo está dentro de un radio autorizado en el momento de marcar; no prueba por sí solo identidad, actividad ni permanencia. Debe activarse solo durante la marcación, explicar el uso de ubicación y ofrecer una excepción cuando el GPS falle.",
    sections: [
      {
        heading: "Qué resuelve y qué no",
        paragraphs: [
          "Una cerca geográfica compara las coordenadas del dispositivo con las de una sucursal y un radio configurado. Es útil para equipos móviles o sedes sin reloj físico porque aporta contexto al evento de entrada o salida.",
          "La ubicación puede variar por edificios, clima, hardware o permisos del sistema operativo. Un punto fuera del radio no demuestra fraude, y uno dentro no identifica a la persona. Por eso el geofence debe ser una señal dentro de un proceso, no una decisión automática.",
          "Casos donde aporta valor: personal de campo que marca al llegar a una tienda, supervisores multi-sede, y operaciones donde el riesgo principal es marcar desde casa sin estar en el punto de trabajo. Casos donde aporta poco: oficinas con kiosco estable, o sedes en sótanos con GPS crónicamente impreciso.",
          "Defina el éxito en términos de calidad de marcación: menos registros remotos injustificados y menos correcciones, no “más bloqueos”. Un geofence agresivo que multiplica excepciones suele costar más que el riesgo que pretendía evitar.",
        ],
      },
      {
        heading: "Privacidad desde el diseño",
        paragraphs: [
          "La opción menos invasiva solicita ubicación cuando la persona pulsa marcar, calcula la distancia y conserva solo lo necesario para justificar el evento. El seguimiento continuo en segundo plano cambia radicalmente el riesgo y rara vez es necesario para controlar asistencia.",
          "La política debe explicar finalidad, datos recolectados, tiempo de conservación, destinatarios y canal para ejercer derechos. También debe distinguir entre ubicación y biometría: ambas requieren protección, pero la Ley 1581 clasifica expresamente los datos biométricos como sensibles.",
          "Preguntas para el proveedor: ¿la app pide permiso de ubicación “siempre” o “mientras se usa”?, ¿se almacenan coordenadas exactas o solo una distancia/resultado dentro-fuera?, ¿quién puede ver el mapa?, ¿cuánto tiempo se retienen los puntos? Prefiera el mínimo dato que sostenga la decisión laboral.",
          "Si combina geofence con reconocimiento facial, documente finalidades separadas. No reutilice una plantilla biométrica para “mejorar analytics” ni convierta la ubicación de marcación en un historial de desplazamiento del día.",
        ],
        bullets: [
          "Radio realista según las condiciones de cada sede.",
          "Captura puntual, no rastreo permanente.",
          "Cifrado, acceso por rol y retención limitada.",
          "Ruta alternativa documentada ante GPS o conectividad insuficiente.",
          "Prueba en dispositivos reales antes de bloquear marcaciones.",
        ],
      },
      {
        heading: "Calibrar el radio con un método simple",
        paragraphs: [
          "Empiece con un radio conservador amplio (por ejemplo, el perímetro del predio más un margen), registre durante dos semanas los falsos rechazos y luego ajuste. No copie el mismo radio para un centro comercial, una bodega abierta y una torre empresarial.",
          "Matriz de calibración: sede × dispositivo × hora del día × tasa de rechazo × tasa de excepción aprobada. Si una sede tiene rechazo alto y excepción casi siempre aprobada, el radio o la señal GPS son el problema, no el equipo.",
          "Considere modos: “bloqueo” solo cuando la precisión del GPS es buena; “advertencia” cuando la precisión es baja; “excepción asistida” cuando no hay señal. Esa gradación reduce injusticias técnicas.",
        ],
      },
      {
        heading: "Operar con excepciones medibles",
        paragraphs: [
          "Pilote el radio en varios dispositivos antes de bloquear marcaciones. Observe falsos rechazos por sede, versión del sistema y hora. Si una sucursal tiene baja precisión, amplíe el radio o use un método complementario en vez de responsabilizar al trabajador por una limitación técnica.",
          "El indicador de éxito no es cuántos eventos bloquea, sino cuántos registros válidos logra con menos correcciones y una experiencia razonable. Una bitácora de excepción debe conservar quién aprobó, por qué y qué evidencia revisó.",
          "Checklist de go-live: política comunicada, radios documentados, excepciones nombradas, soporte de primer nivel entrenado, y un tablero semanal de calidad GPS. Sin esos cinco elementos, el geofence suele convertirse en una fuente diaria de fricción.",
          "Este contenido es informativo y no sustituye asesoría jurídica sobre tratamiento de datos de ubicación. Evalúe el caso con su política interna y, cuando corresponda, con acompañamiento profesional.",
        ],
      },
      {
        heading: "Arquitectura de datos recomendada para ubicación",
        paragraphs: [
          "Prefiera guardar el resultado de validación (dentro/fuera), la precisión estimada del GPS en el momento, el identificador de sede y un hash o redondeo de coordenadas si necesita auditoría. Evite construir un mapa histórico de desplazamientos del día.",
          "Separe ambientes: la app móvil obtiene ubicación puntual; el backend valida radio; el reportería agrega. Los analistas de gerencia no deberían necesitar coordenadas crudas para entender cobertura.",
          "Si usa proveedores de mapas o geocodificación, revise qué se envía fuera de su infraestructura. Un geofence laboral no debería convertirse en una tubería permanente de telemetría hacia terceros sin necesidad y contrato claros.",
          "Documente el ciclo de vida: captura, uso para validar marcación, retención breve, eliminación o anonimización. Incluya este flujo en su política de tratamiento y en la capacitación de líderes.",
        ],
      },
      {
        heading: "Casos borde que rompen un piloto",
        paragraphs: [
          "Centros comerciales con GPS saltarín, parqueaderos subterráneos, fronteras de sede compartidas con otra empresa, y trabajadores que marcan desde la moto en la puerta son casos típicos. Anticipe excepciones para cada uno.",
          "También pruebe dispositivos de gama baja y sistemas operativos desactualizados. La precisión no es uniforme. Un piloto solo con teléfonos nuevos sobreestima el éxito.",
          "Defina un protocolo de incidentes: si el GPS falla de forma masiva en una sede, el líder activa modo excepción temporal y RR. HH. recibe una alerta. Sin protocolo, el equipo vuelve a Excel el mismo día.",
          "Incluya al trabajador en la prueba de aceptación: debe comprender por qué se solicita ubicación, distinguir un rechazo técnico de una falta y conocer el canal de corrección. Esa validación cualitativa complementa la tasa de aciertos y descubre mensajes que pueden sentirse acusatorios aunque el cálculo sea correcto.",
          "Cierre el diseño con una prueba de aceptación firmada por operaciones y privacidad. El geofence exitoso es aburrido: marca bien, falla poco y se explica fácil. Este contenido no sustituye asesoría jurídica sobre datos de ubicación.",
        ],
        bullets: [
          "Prueba en sótanos y bordes de predio.",
          "Dispositivos de distintas gamas.",
          "Modo excepción temporal documentado.",
          "Retención mínima de coordenadas.",
        ],
      },

      {
        heading: "Comunicación al equipo y métricas de adopción",
        paragraphs: [
          "Antes del go-live, explique en una reunión corta qué se valida (estar en el radio al marcar) y qué no se hace (rastreo continuo). Muestre una captura de la pantalla de permiso de ubicación y el flujo de excepción. La claridad reduce tickets el primer lunes.",
          "Publique un canal de soporte de primer nivel con tiempos de respuesta. Si alguien no puede marcar por GPS, debe saber a quién escribir en menos de un minuto. La ambigüedad empuja a soluciones informales que debilitan el control.",
          "Métricas de adopción útiles: porcentaje de marcaciones con validación geográfica exitosa, porcentaje de excepciones por sede, tiempo medio de aprobación de excepciones y satisfacción del marcador (encuesta de una pregunta).",
          "Si a las dos semanas las excepciones superan un umbral acordado, pause el bloqueo duro y recalibre. Un geofence que genera caos operativo no es “estricto”: es un diseño incompleto. Este contenido no sustituye asesoría jurídica sobre tratamiento de ubicación.",
        ],
        bullets: [
          "Reunión de lanzamiento con ejemplos.",
          "Canal claro de soporte de excepciones.",
          "Métricas semanales de adopción y fricción.",
          "Pausa y recalibración si el umbral se dispara.",
        ],
      },
    ],
    sources: [
      dataProtectionLaw,
      sicBiometrics,
    ],
  },  {
    slug: "biometria-laboral-ley-1581",
    title: "Biometría laboral y Ley 1581: una guía de decisiones responsables",
    description:
      "Principios prácticos para evaluar, implementar y gobernar marcación biométrica en Colombia sin tratar el consentimiento como un simple formulario.",
    category: "Protección de datos",
    publishedAt: "2026-07-10",
    readingTime: "8 min",
    answer:
      "Los datos biométricos son sensibles en Colombia. Una empresa debe justificar necesidad y proporcionalidad, informar finalidades específicas, gestionar la autorización aplicable, reforzar seguridad y habilitar los derechos del titular. La plantilla facial debe protegerse como credencial irremplazable.",
    sections: [
      {
        heading: "Por qué la biometría exige mayor diligencia",
        paragraphs: [
          "El artículo 5 de la Ley 1581 de 2012 incluye los datos biométricos entre los datos sensibles: afectan la intimidad y su uso indebido puede generar discriminación. A diferencia de una contraseña, el rostro o la huella no pueden cambiarse de forma práctica después de una filtración.",
          "En 2025 la SIC reiteró, para los sujetos y tratamientos cubiertos por su Circular Externa 001, obligaciones reforzadas como finalidades precisas, autorización explícita, proporcionalidad, seguridad adicional y borrado cuando termina la relación y ya no subsiste la finalidad. Aunque esa circular se dirige al contexto fintech, ofrece una referencia útil de diligencia, no una extensión automática a cualquier empleador.",
          "El riesgo no es solo normativo: un incidente biométrico daña confianza, reputación y continuidad operativa. Por eso la decisión de adoptar reconocimiento facial o huella debería pasar por un análisis escrito de necesidad, no por una preferencia de proveedor.",
          "Distinga además entre verificación uno-a-uno (¿esta persona es quien dice ser?) e identificación uno-a-muchos (¿quién de la base es?). El segundo escenario suele implicar mayor exposición y exige controles más estrictos de acceso, retención y finalidad.",
        ],
      },
      {
        heading: "Preguntas antes de recolectar",
        paragraphs: [
          "La evaluación comienza por la necesidad. ¿Existe un riesgo real de suplantación? ¿Un mecanismo menos intrusivo puede alcanzar el objetivo? ¿Qué ocurre con quien no puede usar el método? Documentar estas respuestas evita adoptar biometría por moda.",
          "Luego debe definirse la arquitectura. En reconocimiento facial conviene almacenar una plantilla matemática protegida y no la fotografía original cuando esta ya no sea necesaria. Deben existir separación de ambientes, cifrado, registros de acceso, pruebas del proveedor y procedimientos de eliminación verificable.",
          "Solicite al proveedor respuestas concretas: dónde se alojan los datos, si hay subencargados, cómo se cifran en tránsito y en reposo, cómo se eliminan plantillas al terminar el vínculo, y qué ocurre con respaldos. Si las respuestas son vagas, el riesgo operativo es alto aunque la demo luzca bien.",
          "Diseñe la alternativa desde el día uno: marcación asistida, tarjeta personal no transferible, o código de un solo uso con supervisión. Una biometría sin alternativa castiga a personas con condiciones médicas, objeciones fundadas o fallos técnicos reiterados.",
        ],
        bullets: [
          "Finalidad específica y comunicada en lenguaje claro.",
          "Base jurídica y autorización gestionadas con asesoría.",
          "Alternativa y procedimiento para excepciones.",
          "Retención, eliminación y respuesta a incidentes.",
          "Medición de falsos rechazos por sede y demografía operativa.",
        ],
      },
      {
        heading: "Gobernar durante todo el ciclo de vida",
        paragraphs: [
          "La obligación no termina al instalar el dispositivo. La empresa debe atender consultas y reclamos, actualizar su inventario de bases, revisar encargados y medir falsos rechazos. Si cambia la finalidad, no debe reutilizar silenciosamente la plantilla.",
          "La transparencia operativa también importa: informe cuándo se procesa el rostro, qué resultado produce y cómo corregir una marcación. Una decisión laboral relevante no debería descansar exclusivamente en un resultado automatizado sin revisión humana.",
          "Checklist trimestral: revisar accesos privilegiados, probar restauración/eliminación, auditar excepciones, actualizar avisos si cambió el proveedor, y verificar que las bajas de personal disparen el borrado o bloqueo de plantillas en el plazo definido.",
          "Este contenido es informativo y no sustituye asesoría jurídica especializada en protección de datos ni un dictamen sobre la viabilidad de un tratamiento concreto. Consulte el texto de la Ley 1581 de 2012, la reglamentación aplicable y acompañamiento profesional antes de implementar.",
        ],
      },
      {
        heading: "Errores frecuentes que conviene evitar",
        paragraphs: [
          "Error 1: confundir “el trabajador firmó un papel” con un tratamiento informado y específico. Error 2: guardar fotos originales “por si acaso”. Error 3: compartir plantillas con terceros sin contrato y controles. Error 4: usar la misma biometría para asistencia, control de acceso de visitantes y analítica de marketing.",
          "Error 5: no medir falsos rechazos. Si un subconjunto del equipo falla sistemáticamente, el sistema genera discriminación práctica aunque nadie lo haya diseñado así. Corrija umbrales, iluminación, altura de cámara o active alternativas.",
          "Cierre con una regla simple: si no puede explicar en una página qué dato guarda, para qué, quién lo ve y cómo se borra, todavía no está listo para recolectar biometría.",
        ],
      },
      {
        heading: "Modelo de decisión en cinco pasos",
        paragraphs: [
          "Paso 1: describir el problema de negocio en una frase medible (por ejemplo, “suplantación recurrente en sede X”). Paso 2: listar alternativas no biométricas y su costo. Paso 3: si la biometría sigue siendo necesaria, definir finalidad, base jurídica y texto de autorización con asesoría. Paso 4: diseñar arquitectura de minimización. Paso 5: definir KPIs de fricción y un plan de salida.",
          "Este modelo evita la compra impulsiva. También crea un expediente útil si más adelante debe explicar por qué eligió ese tratamiento. Guarde versiones de la decisión y de los avisos informativos.",
          "Incluya a SST, TI, legal/compliance y operaciones en la misma mesa. La biometría toca a todos. Un proveedor no debería ser el único autor del diseño de tratamiento.",
          "Si el problema real es cultural o de turnos mal diseñados, la biometría no lo resolverá. A veces el mejor resultado del análisis es no implementarla.",
        ],
      },
      {
        heading: "Controles técnicos mínimos para plantillas faciales",
        paragraphs: [
          "Almacene plantillas, no fotos, cuando sea posible. Cifre en reposo y en tránsito. Separe claves de cifrado del servidor de aplicación. Registre accesos administrativos. Pruebe eliminación al terminar el vínculo laboral y verifique que los backups también respeten la política en un plazo definido.",
          "Controle umbrales de coincidencia por sede y revise falsos rechazos. Un umbral demasiado estricto genera excepciones masivas; uno demasiado laxo debilita el control. Calibre con datos reales y revise sesgos operativos.",
          "Prohíba exportaciones “para demos” con datos reales. Use conjuntos sintéticos o ambientes aislados. El mayor incidente suele empezar con un archivo compartido por comodidad.",
          "Mantenga un runbook de incidentes biométricos: contención, notificación interna, evaluación de impacto y comunicación a titulares según el marco aplicable. Ensaye el runbook una vez al año. Este texto es informativo y no reemplaza asesoría jurídica especializada.",
        ],
        bullets: [
          "Plantilla cifrada y acceso auditado.",
          "Eliminación verificable al egreso.",
          "Calibración de umbrales por sede.",
          "Runbook de incidentes ensayado.",
        ],
      },

      {
        heading: "Qué pedir por escrito al proveedor antes del kickoff",
        paragraphs: [
          "Solicite un diagrama de flujo de datos biométricos, la lista de subencargados, el país de alojamiento, el método de cifrado, el procedimiento de borrado y el tiempo máximo de eliminación tras el egreso. Si no pueden entregarlo por escrito, el riesgo de gobernanza es alto.",
          "Pida también métricas de falsos rechazos observadas en clientes similares y el plan de soporte cuando un dispositivo deja de reconocer a parte del equipo. La biometría sin soporte operativo se convierte en una fuente diaria de excepciones.",
          "Incluya en el contrato auditorías razonables, notificación de incidentes y prohibición de usar plantillas para finalidades distintas a la asistencia. Este contenido es informativo y no sustituye la revisión contractual por un profesional.",
        ],
      },
    ],
    sources: [
      dataProtectionLaw,
      sicBiometrics,
    ],
  },  {
    slug: "reportes-rrhh-que-si-sirven",
    title: "Reportes de RR. HH. que sí sirven: de la asistencia a la decisión",
    description:
      "Un modelo de reportes accionables para convertir marcaciones, turnos y novedades en conversaciones de capacidad, cumplimiento y bienestar.",
    category: "Analítica de RR. HH.",
    publishedAt: "2026-07-08",
    readingTime: "9 min",
    answer:
      "Un reporte útil responde una pregunta, muestra el contexto y permite actuar. RR. HH. necesita combinar asistencia, turnos, novedades y calidad del dato; no acumular tableros. Las métricas deben orientar capacidad y bienestar, nunca presentar presencia como sinónimo de productividad.",
    sections: [
      {
        heading: "Empezar por decisiones, no por gráficos",
        paragraphs: [
          "Antes de construir un tablero, escriba qué decisión habilitará: ajustar un turno, distribuir personal, corregir una regla o revisar sobrecarga. Si una métrica no cambia ninguna conversación ni proceso, probablemente sobra.",
          "Cada cifra necesita denominador y contexto. Diez tardanzas significan algo distinto en un equipo de quince personas que en uno de quinientas; una ausencia programada no debe mezclarse con una no justificada. Muestre cobertura, periodo, zona horaria y última actualización.",
          "Plantilla de definición de métrica: nombre, pregunta de negocio, fórmula, filtros, responsable de la acción y frecuencia de revisión. Sin dueño de acción, el reporte se convierte en decoración.",
          "Evite el “efecto semáforo” vacío: un rojo sin protocolo de respuesta solo genera ansiedad. Cada color debería enlazar a una lista de excepciones o a un flujo concreto.",
        ],
      },
      {
        heading: "Un portafolio mínimo de reportes",
        paragraphs: [
          "Para operación diaria, resultan útiles las personas actualmente presentes, las marcaciones incompletas y las excepciones pendientes. Para el cierre, se necesitan horas ordinarias y suplementarias, novedades aprobadas y trazabilidad de cambios. Para planeación, conviene observar carga por turno y sucursal.",
          "Las jornadas prolongadas requieren atención especial. La estimación OMS/OIT de 745.000 muertes atribuibles en 2016 a cardiopatía isquémica y accidente cerebrovascular asociadas con jornadas de 55 horas o más recuerda que la alerta de exceso es también una herramienta de prevención.",
          "Para cumplimiento con la Ley 2466 de 2025, agregue un reporte de trabajo suplementario por persona con actividad, horas y distinción diurna/nocturna, exportable junto al soporte de pago. Ese artefacto reduce fricción cuando llega una solicitud.",
          "Calidad del dato merece su propio panel: porcentaje de marcaciones válidas al primer intento, excepciones por sede, correcciones post-cierre y tiempo medio de resolución. Si la calidad es mala, el resto de indicadores miente con elegancia.",
        ],
        bullets: [
          "Calidad: registros faltantes, duplicados y corregidos.",
          "Cumplimiento: horas extra por día y semana.",
          "Operación: cobertura frente al turno programado.",
          "Bienestar: patrones persistentes de jornadas extensas.",
          "Cierre: versión de datos enviada a nómina versus version pagada.",
        ],
      },
      {
        heading: "Evitar conclusiones que el dato no soporta",
        paragraphs: [
          "La asistencia no mide la calidad del trabajo. El DANE calcula productividad considerando valor agregado y contribuciones de capital y trabajo; trasladar esa complejidad a una empresa significa complementar tiempo con resultados y condiciones.",
          "Proteja además a grupos pequeños. Un reporte ejecutivo puede usar agregación, mientras el detalle nominal se limita a quienes deben resolver una novedad. Documente definiciones y permita rastrear cada total hasta los eventos que lo componen.",
          "Cuidado con rankings individuales de “productividad por horas”. Pueden incentivar presencia teatral, desincentivar pausas saludables y crear competencia tóxica. Prefiera indicadores de equipo, capacidad y cumplimiento de servicio.",
          "Cuando presente hallazgos a gerencia, separe hechos, hipótesis e implicaciones. Hecho: “12 personas superaron X horas en 3 semanas”. Hipótesis: “faltan vacantes en el turno noche”. Implicación: “revisar contratación o redistribución”. Esa disciplina evita discusiones punitivas improductivas.",
        ],
      },
      {
        heading: "Ritual de revisión que hace vivir los reportes",
        paragraphs: [
          "Proponga un ritual semanal de 30 minutos: calidad del dato (10), cobertura y excepciones (10), alertas de sobrecarga y extras (10). Termine con máximo tres acciones con dueño y fecha. Si la reunión dura una hora y no produce acciones, sobra contenido.",
          "Mensualmente, revise si alguna métrica dejó de usarse. Retírela. El mejor portafolio de RR. HH. es pequeño, estable y accionable.",
          "Este contenido es informativo. Las decisiones laborales o de SST derivadas de un tablero deben contrastarse con contexto humano y, cuando aplique, con asesoría especializada.",
        ],
      },
      {
        heading: "Diccionario de métricas para alinear al equipo",
        paragraphs: [
          "Sin diccionario, cada área inventa definiciones. Acuerde qué es una tardanza (minutos de gracia incluidos o no), qué es una ausencia justificada, cómo se cuenta una persona “presente ahora” y cómo se clasifica una hora suplementaria diurna o nocturna.",
          "Publique el diccionario junto al tablero. Incluya dueño de la definición y fecha de vigencia. Cuando cambie una regla laboral, versiona la métrica para no comparar peras con manzanas entre meses.",
          "Ejemplo: “presente ahora” = último evento del día es CHECK_IN y no hay CHECK_OUT posterior. Esa definición evita contar como presentes a quienes ya salieron. Documente también zonas horarias y cortes de día laboral.",
          "Un buen diccionario reduce discusiones en la reunión semanal y acelera la confianza en los números. Si nadie puede explicar una métrica en treinta segundos, sobra o está mal nombrada.",
        ],
      },
      {
        heading: "De la alerta de sobrecarga a un plan de acción",
        paragraphs: [
          "Cuando el tablero muestre jornadas prolongadas reiteradas, no termine en un comentario. Active un protocolo: validar calidad del dato, confirmar si hay vacantes o picos de demanda, hablar con el líder, y decidir entre redistribución, contratación temporal o ajuste de servicio.",
          "La evidencia OMS/OIT sobre jornadas de 55 horas o más y su asociación con mortalidad cardiovascular en 2016 justifica tratar la sobrecarga como riesgo, no como medalla de compromiso. Adapte umbrales locales con SST; no copie el número internacional como norma interna automática.",
          "Mida también el “eco” de la alerta: ¿cuántas alertas produjeron cambios reales en cuatro semanas? Si el eco es cero, el reporte de bienestar es cosmética.",
          "Presente la tendencia con su denominador y contexto: una sede con cinco alertas entre diez personas no es comparable con otra que tiene cinco entre doscientas. Anote cierres, festivos, ausencias y cambios de turno para evitar que una variación operativa se convierta en una conclusión sobre conducta individual.",
          "Integre el reporte de suplementarias de la Ley 2466 al mismo ritual: capacidad, cumplimiento y evidencia deberían verse juntos. Conserve también la versión revisada que se entregó a nómina para cerrar la trazabilidad. Este contenido no sustituye asesoría de SST ni jurídica.",
        ],
        bullets: [
          "Diccionario versionado de métricas.",
          "Protocolo de sobrecarga con dueño.",
          "Eco de alertas medido mensualmente.",
          "Exportable de extras ligado al cierre.",
        ],
      },

      {
        heading: "Calidad de datos como producto, no como queja",
        paragraphs: [
          "Trate la calidad de asistencia como un producto con backlog. Cada semana elija una causa raíz (dispositivo lento, turno mal cargado, líder que aprueba tarde) y ciérrela. Los tableros mejoran cuando el input mejora, no cuando se agregan colores.",
          "Asigne un “data steward” por sede o por proceso. No tiene que ser un científico de datos: puede ser un analista de RR. HH. con autoridad para pedir correcciones de configuración. Sin steward, los errores regresan cada quincena.",
          "Construya un score simple de salud del dato: 40% marcaciones válidas al primer intento, 30% excepciones resueltas antes del cierre, 20% correcciones post-pago, 10% tickets abiertos. Muestre el score junto a los KPIs de negocio para que gerencia vea la dependencia.",
          "Cuando el score baja, congele nuevas métricas de vanidad y priorice higiene. Un reporte de extras impecable sobre marcaciones incompletas solo exporta inseguridad con formato profesional. Este contenido es informativo y no sustituye asesoría especializada.",
        ],
        bullets: [
          "Backlog semanal de causas raíz.",
          "Data steward por sede o proceso.",
          "Score de salud del dato visible.",
          "Priorizar higiene antes de nuevas métricas.",
        ],
      },
    ],
    sources: [
      whoLongHours,
      daneProductivity,
      colombianLaborReform,
    ],
  },  {
    slug: "roi-software-asistencia-90-dias",
    title: "Cómo demostrar el ROI de un software de asistencia en 90 días",
    description:
      "Un plan de adopción y medición en tres ciclos de 30 días, con línea base, piloto y criterios honestos de retorno.",
    category: "Transformación digital",
    publishedAt: "2026-07-06",
    readingTime: "8 min",
    answer:
      "En 90 días puede demostrarse valor operativo, no necesariamente recuperar toda la inversión. Mida antes y después el tiempo de corrección, las excepciones, el cierre y la experiencia; reste licencias, implementación y operación. Presente ahorro observado y supuestos por separado.",
    sections: [
      {
        heading: "Días 1 a 30: medir antes de automatizar",
        paragraphs: [
          "El primer mes no debe gastarse solo configurando. Tome una línea base de al menos un cierre: horas de consolidación, marcaciones corregidas, casos reabiertos, ajustes y tiempos de respuesta. Registre el costo interno con tarifas reales de la empresa.",
          "EY reportó para Estados Unidos US$291 por error, cerca de una nómina con error por cada cinco y 26 minutos por empleado para corregir marcaciones. Use esos hallazgos para identificar rubros, no para declarar un ahorro colombiano sin medirlo.",
          "Plantilla de línea base: (A) minutos de consolidación por rol, (B) número de excepciones por 100 empleados, (C) valor de ajustes salariales del periodo, (D) tickets o quejas relacionadas con marcación, (E) tiempo medio de resolución. Capture además una narrativa cualitativa: ¿dónde duele más el proceso hoy?",
          "Defina el alcance del piloto con honestidad: una sede, un grupo de turnos, o un proceso completo hasta nómina. Si el piloto no llega al pago, podrá demostrar adopción, pero no ROI de cierre.",
        ],
      },
      {
        heading: "Días 31 a 60: pilotear el circuito completo",
        paragraphs: [
          "Elija una sede representativa, configure turnos y excepciones, capacite a líderes y conecte la salida con nómina. Un piloto que termina en la marcación, pero no llega al cierre, solo prueba la cámara o la aplicación.",
          "Revise semanalmente adopción y fricción. Un menor tiempo de RR. HH. acompañado de más minutos para cada trabajador no es eficiencia completa. Incluya tickets, intentos fallidos y correcciones solicitadas por usuarios.",
          "Gobernanza del piloto: un sponsor de negocio, un dueño de datos, un dueño de soporte y un calendario de decisiones (seguir, ajustar o pausar). Sin sponsor, el piloto muere en la semana tres cuando aparece la primera excepción difícil.",
          "Documente cambios de proceso con el mismo rigor que cambios de software. Si antes las novedades se aprobaban por chat y ahora pasan por un flujo, esa diferencia explica parte del ROI y debe quedar escrita.",
        ],
        bullets: [
          "Tasa de marcaciones válidas al primer intento.",
          "Tiempo desde la anomalía hasta su resolución.",
          "Minutos de consolidación por periodo.",
          "Satisfacción de trabajadores, líderes y nómina.",
          "Porcentaje del piloto que llega limpio a liquidación.",
        ],
      },
      {
        heading: "Días 61 a 90: calcular y decidir",
        paragraphs: [
          "Compare el piloto con la línea base y separe beneficios realizados de proyecciones. El retorno neto considera ahorro de tiempo y reprocesos menos licencias, implementación, dispositivos, soporte y gestión del cambio. Explique el periodo y los supuestos.",
          "Fórmula transparente: ROI del periodo = (beneficios medidos − costos del periodo) / costos del periodo. Beneficios medidos pueden incluir minutos liberados valorizados y reducción de ajustes. Costos incluyen licencia prorrateada, horas de implementación y hardware. No mezcle beneficios proyectados a 12 meses dentro del numerador de 90 días sin etiquetarlos.",
          "Ejemplo ilustrativo: si libera 20 horas de consolidación por quincena a una tarifa interna de $60.000/hora, el beneficio quincenal es $1.200.000. Si el costo mensual del piloto es $2.500.000, el mes todavía puede ser negativo y aun así justificar escalar si la tendencia de calidad es clara. Presente ambos ángulos.",
          "Cierre con una decisión: escalar, ajustar o detener. El DANE reporta productividad con una metodología explícita; el mismo rigor debe aplicarse internamente. Un resultado modesto pero medido es más útil que una promesa grande construida con cifras ajenas.",
        ],
      },
      {
        heading: "Qué no contar como ROI",
        paragraphs: [
          "No cuente como ahorro el salario completo de un analista “porque ahora el sistema trabaja solo” si esa persona sigue dedicando horas a excepciones. No capitalice beneficios reputacionales sin evidencia. No convierta US$291 de EY en pesos colombianos y lo multiplique por la plantilla como si fuera caja real.",
          "Sí cuente: menos horas de consolidación, menos ajustes post-pago, menos tiempo de líderes buscando evidencias, y mejor respuesta ante solicitudes de relación de horas extra. Esos rubros se pueden observar en 90 días.",
          "Este contenido es un marco de medición y no una garantía financiera. El retorno depende de adopción, calidad de datos, integración y disciplina de proceso.",
        ],
      },
      {
        heading: "Tablero de ROI que gerencia entiende",
        paragraphs: [
          "Presente tres columnas: línea base, piloto y diferencia. Filas: minutos de consolidación, excepciones por 100 empleados, ajustes post-pago, tickets de marcación y score de experiencia (1-5). Abajo, costos del periodo. A un lado, supuestos etiquetados.",
          "Evite diapositivas con “ahorro potencial a 3 años” como titular. Ese número puede existir en un anexo, pero el titular de 90 días debe ser lo observado. La credibilidad del proyecto se juega en esa disciplina.",
          "Incluya una fila de “transferencia de carga”: minutos que pasaron de RR. HH. a líderes o trabajadores. Si la transferencia es alta, el ROI operativo neto es menor aunque RR. HH. “se vea más liviano”.",
          "Use el rigor del DANE como metáfora metodológica: muestre cómo midió, qué quedó fuera y qué es preliminar. Eso eleva la conversación por encima de promesas de proveedor.",
        ],
      },
      {
        heading: "Riesgos que distorsionan el cálculo",
        paragraphs: [
          "Efecto novedad: las primeras semanas la gente marca con más cuidado. Extienda la medición o compare contra una sede control. Sesgo de selección: el piloto eligió la sede más ordenada. Contabilice ese sesgo en la decisión de escalar.",
          "Costos ocultos: horas de TI, cables, soporte del vendor, tiempo de capacitación repetida y licencias de integraciones. Si no están en el denominador, el ROI está maquillado.",
          "Beneficios no realizados: una integración “lista” que aún no usa nómina no puede contarse como ahorro de cierre. Separe “capacidad creada” de “capacidad usada”.",
          "Cierre con una recomendación binaria y condiciones: “escalar a tres sedes si la tasa de excepciones sigue bajo X y el soporte responde en Y horas”. Las condiciones evitan discusiones eternas. Este marco no es una garantía financiera.",
        ],
        bullets: [
          "Línea base versus piloto en una tabla.",
          "Supuestos etiquetados y separados.",
          "Costos ocultos en el denominador.",
          "Condiciones claras para escalar.",
        ],
      },

      {
        heading: "Checklist de evidencia para el comité de decisión",
        paragraphs: [
          "Adjunte línea base, tablero de diferencias, costos del periodo, encuesta breve de experiencia, lista de incidentes del piloto y una recomendación con condiciones de escalado. Ese paquete evita que la decisión dependa solo del carisma del proveedor.",
          "Incluya un anexo de riesgos: adopción incompleta, integración frágil, soporte lento y transferencia de carga a líderes. Cada riesgo debe tener mitigación y dueño.",
          "Si el comité pide “el ROI en un número”, ofrezca el número del periodo observado y, separado, un rango proyectado a 12 meses con supuestos. Mezclarlos en un solo titular destruye credibilidad. Este marco no es una garantía financiera.",
        ],
      },
    ],
    sources: [
      eyPayrollStudy,
      daneProductivity,
    ],
  },  {
    slug: "rrhh-ia-api-webhooks-mcp",
    title: "RR. HH. e IA: cuándo usar API, webhooks o MCP",
    description:
      "Una arquitectura práctica para integrar asistencia con automatizaciones e inteligencia artificial sin entregar más datos ni permisos de los necesarios.",
    category: "Integraciones",
    publishedAt: "2026-07-04",
    readingTime: "8 min",
    answer:
      "Use una API para consultar o modificar bajo demanda, webhooks para avisar eventos y MCP para ofrecer herramientas gobernadas a asistentes de IA. Se complementan. El diseño seguro parte de permisos mínimos, aislamiento por empresa, auditoría y aprobación humana para acciones sensibles.",
    sections: [
      {
        heading: "Tres mecanismos, tres ritmos",
        paragraphs: [
          "Una API responde cuando otro sistema pregunta: por ejemplo, nómina solicita las horas aprobadas. Un webhook empuja un aviso cuando ocurre un evento, como una marcación o una novedad aprobada. MCP describe herramientas y contexto para que un asistente compatible pueda invocarlas de forma estructurada.",
          "No conviene usar sondeos frecuentes si un webhook resuelve el evento, ni dar acceso general a la base de datos cuando una API puede exponer un recurso limitado. MCP tampoco reemplaza las reglas del negocio: debe llamar herramientas que ya validan identidad, empresa y permisos.",
          "Analogía operativa: la API es el mostrador donde usted pide un extracto; el webhook es el timbre que avisa cuando llega un paquete; MCP es el instructivo que le dice a un asistente qué botones puede pulsar y bajo qué condiciones. Confundir los tres genera integraciones frágiles o inseguras.",
          "OpenAI documenta conectores y servidores MCP remotos para exponer herramientas a modelos. Google Cloud publica prácticas de seguridad para proteger APIs en entornos empresariales. Use esas guías como referencia técnica y mantenga su política interna de minimización y auditoría.",
        ],
      },
      {
        heading: "Casos de uso responsables para IA",
        paragraphs: [
          "Un asistente puede resumir ausencias, explicar un reporte o localizar excepciones pendientes. También puede preparar un borrador de comunicación. No debería aprobar horas extra, sancionar o modificar datos biométricos sin autorización explícita y controles adicionales.",
          "La salida debe conservar referencias a los registros fuente. Así el usuario puede revisar fechas, turnos y novedades antes de actuar. La IA aporta una interfaz y síntesis; la evidencia sigue en el sistema transaccional.",
          "Patrones seguros: lectura primero (tools de solo consulta), escritura con confirmación humana, y prohibición de enviar plantillas biométricas o documentos de identidad a modelos generativos salvo un análisis jurídico y técnico específico. La Ley 1581 de 2012 y el carácter sensible de la biometría aconsejan extrema cautela.",
          "Ejemplo de flujo MCP: el asistente llama `get_present_now` y `get_attendance_records`, resume hallazgos y sugiere un borrador; un humano decide. Si necesita crear una novedad, el sistema exige un paso de aprobación fuera del modelo.",
        ],
        bullets: [
          "API: sincronización y consultas deterministas.",
          "Webhooks: reacción rápida a eventos definidos.",
          "MCP: herramientas acotadas para asistentes.",
          "Auditoría: quién consultó o ejecutó cada acción.",
          "Aislamiento: companyId derivado del token, nunca del cliente.",
        ],
      },
      {
        heading: "Seguridad y estándares de implementación",
        paragraphs: [
          "Asigne tokens por integración, permisos de lectura o escritura, vencimiento y rotación. El identificador de la empresa debe provenir de la credencial, no de un parámetro que el cliente pueda cambiar. Firme webhooks y procese reintentos de forma idempotente.",
          "Para webhooks: use firma HMAC, timestamps anti-replay, reintentos con backoff y un endpoint que no ejecute dos veces el mismo evento. Para APIs: rate limiting, scopes mínimos y logs estructurados. Para MCP: allowlist de tools, timeouts y revisión de prompts que puedan intentar exfiltrar datos.",
          "Checklist de go-live de integraciones: inventario de destinos, matriz de datos enviados, prueba de fallo del receptor, plan de rotación de secretos y un dueño operativo. Sin dueño, el webhook “huérfano” se convierte en un riesgo silencioso.",
          "Este contenido es técnico-informativo y no sustituye un diseño de seguridad formal ni asesoría jurídica sobre tratamientos automatizados. Evalúe cada integración según su superficie de datos y el impacto de un error.",
        ],
      },
      {
        heading: "Cómo elegir el mecanismo en una reunión de arquitectura",
        paragraphs: [
          "Si la pregunta es “¿nómina necesita el consolidado cada noche?”, use API o exportación programada. Si la pregunta es “¿quiero reaccionar cuando se aprueba una novedad?”, use webhook. Si la pregunta es “¿un asistente debe consultar presentes ahora?”, use MCP sobre tools de lectura.",
          "Evite unificar todo en un único canal “inteligente”. La inteligencia ayuda a interpretar; los contratos de integración deben seguir siendo aburridos, versionados y testeables.",
          "Documente decisiones en una página: evento, dato, mecanismo, permiso, retención y responsable. Esa página vale más que un diagrama bonito sin dueños.",
        ],
      },
      {
        heading: "Diseño de permisos y amenazas comunes",
        paragraphs: [
          "Amenaza 1: un token con scope write usado por un script olvidado. Mitigación: tokens por integración, expiración corta y alertas de uso anómalo. Amenaza 2: un webhook sin firma que acepta eventos falsos. Mitigación: HMAC y validación de timestamp.",
          "Amenaza 3: un asistente MCP que recibe instrucciones para exportar datos masivos. Mitigación: tools de lectura paginada, límites de filas y confirmación para exportaciones. Amenaza 4: filtrar companyId desde el cliente. Mitigación: companyId solo desde el token validado en servidor.",
          "Amenaza 5: enviar biometría o documentos a un LLM. Mitigación: política explícita de datos prohibidos y filtros de salida en las tools. La Ley 1581 y el carácter sensible de la biometría hacen de esta una línea roja operativa.",
          "Haga una tabla de amenazas en una página y revísela cada trimestre. La seguridad de integraciones RR. HH. no es un proyecto de una sola vez.",
        ],
      },
      {
        heading: "Blueprint de referencia para un equipo mediano",
        paragraphs: [
          "Nómina tira cada noche un consolidado vía API read. Un bus interno escucha webhooks de attendance.created y incident.approved para refrescar tableros. Un servidor MCP expone get_present_now, find_employee y get_attendance_records a asistentes internos con SSO y audit log.",
          "Ningún asistente tiene tool de borrado biométrico. Las escrituras sensibles pasan por la UI con roles humanos. Los secretos viven en un gestor, no en hojas de cálculo.",
          "Pruebas: contrato de API con ejemplos, replay de webhooks firmados, y evaluación de prompts adversarios contra MCP. Si no hay pruebas, no hay integración lista.",
          "Documentación viva: un diagrama, una matriz de datos y un runbook de incidentes. OpenAI y Google ofrecen guías de MCP y seguridad de APIs; úselas como referencia y adapte a su aislamiento multi-tenant. Este contenido no sustituye un diseño de seguridad formal.",
        ],
        bullets: [
          "API nocturna para nómina.",
          "Webhooks firmados para eventos.",
          "MCP de solo lectura para asistentes.",
          "Tabla de amenazas revisada cada trimestre.",
        ],
      },

      {
        heading: "Ejercicio de mesa para elegir el canal correcto",
        paragraphs: [
          "Reúna a RR. HH., TI y un usuario final. Escriba cinco historias de usuario en notas adhesivas y clasifíquelas en API, webhook o MCP. Discuta permisos y datos mínimos por historia. En una hora tendrá más claridad que en tres demos.",
          "Ejemplos: “nómina necesita horas aprobadas cada noche” → API. “quiero actualizar el tablero cuando alguien marca” → webhook. “un asistente debe listar excepciones abiertas de mi sede” → MCP read-only.",
          "Termine el ejercicio con un inventario de datos prohibidos para LLMs (biometría, documentos de identidad, datos de salud) y un responsable de secretos. Este contenido no sustituye un diseño de seguridad formal.",
        ],
      },
    ],
    sources: [
      {
        title: "OpenAI — Connectors and remote MCP servers",
        url: "https://platform.openai.com/docs/guides/tools-connectors-mcp",
      },
      {
        title: "Google Cloud — API security best practices",
        url: "https://cloud.google.com/docs/enterprise/best-practices-for-enterprise-organizations#protect-your-apis",
      },
      dataProtectionLaw,
    ],
  },  {
    slug: "elegir-software-asistencia-colombia",
    title: "Cómo elegir software de asistencia en Colombia: lista de verificación",
    description:
      "Criterios legales, técnicos y operativos para comparar proveedores con una prueba real, no solo una demostración comercial.",
    category: "Guías de compra",
    publishedAt: "2026-07-02",
    readingTime: "8 min",
    answer:
      "Elija con una prueba de cierre real. El software debe modelar turnos y recargos, producir el registro exigido por la Ley 2466, proteger datos bajo la Ley 1581, aislar cada empresa, manejar excepciones y exportar evidencia trazable. Biometría o IA solo agregan valor si resuelven una necesidad demostrada.",
    sections: [
      {
        heading: "Validar primero el ajuste laboral",
        paragraphs: [
          "Prepare casos propios: turno nocturno, cambio de sede, ausencia autorizada, marcación olvidada, hora extra y cierre. Pida al proveedor procesarlos de extremo a extremo. Una demostración con horario fijo no revela cómo se comportará el sistema en la operación colombiana.",
          "Compruebe que el reporte de trabajo suplementario incluya nombre, actividad, horas y distinción diurna o nocturna, como exige el artículo 12 de la Ley 2466 de 2025. Verifique también alertas frente al límite general del artículo 13 y la forma de configurar excepciones sectoriales legales.",
          "Incluya en la prueba: personal rotativo, permisos parciales, trabajo en día de descanso y un caso de corrección post-marcación. Si el proveedor pide “simplificar el caso”, anote el riesgo: su operación real no es simple.",
          "Pida exportar la evidencia como la vería un trabajador o una autoridad: legible, completa y vinculada al soporte de pago. Un CSV críptico no cumple la función práctica del registro.",
        ],
      },
      {
        heading: "Revisar privacidad, seguridad y continuidad",
        paragraphs: [
          "Si hay reconocimiento facial, solicite la evaluación de necesidad, la política de tratamiento, el contrato de encargado, la ubicación del alojamiento, el cifrado y el procedimiento de eliminación. Pregunte si se almacena una imagen o una plantilla y cómo se atiende a quien no puede usar el mecanismo.",
          "Exija aislamiento entre clientes, respaldos, plan de incidentes, autenticación robusta y auditoría. Una app móvil debe tener una alternativa para conectividad deficiente; un geofence debe capturar ubicación puntual y manejar precisión insuficiente sin borrar la posibilidad de registrar la jornada.",
          "La Ley 1581 de 2012 y la diligencia reforzada ilustrada por la SIC en contextos de datos sensibles (Circular Externa 001 de 2025) deben orientar sus preguntas al proveedor, sin convertir una circular sectorial en una lista ciega de obligaciones para todo empleador.",
          "Continuidad: ¿qué ocurre si el kiosco falla el domingo a las 6 a. m.? ¿Hay modo offline? ¿Cómo se sincroniza después? ¿Quién da soporte y en qué horario? Un software brillante de lunes a viernes puede ser frágil en turnos 24/7.",
        ],
        bullets: [
          "Reglas laborales configurables y versionadas.",
          "Correcciones con aprobación e historial.",
          "Exportación e integración con nómina.",
          "Soporte, disponibilidad y portabilidad al terminar.",
          "Matriz de roles y permisos multi-sede.",
        ],
      },
      {
        heading: "Comparar costo total y experiencia",
        paragraphs: [
          "Calcule licencias, dispositivos, implementación, soporte, integraciones y gestión del cambio. Compare ese total con una línea base local de reprocesos. Las cifras de EY —US$291 por error y 26 minutos por empleado en corrección de punches— son evidencia del tipo de costo, pero proceden de Estados Unidos y no sustituyen su medición.",
          "Finalmente, invite a trabajadores, líderes, RR. HH. y nómina al piloto. El mejor software no es el que acumula funciones, sino el que produce datos confiables con menos fricción y permite explicar cada resultado. Evalúe con criterios ponderados y deje por escrito por qué gana cada opción.",
          "Matriz sugerida de puntuación (ejemplo): ajuste laboral 30%, privacidad/seguridad 20%, experiencia de marcación 15%, integración/nómina 15%, soporte/continuidad 10%, costo total 10%. Ajuste pesos a su contexto, pero fíjelos antes de ver demos para reducir sesgo.",
          "Exija una cláusula de salida de datos: exportación completa, plazos y formato. Cambiar de proveedor sin portabilidad convierte cualquier ahorro inicial en un costo hundido.",
        ],
      },
      {
        heading: "Script de prueba de 10 días",
        paragraphs: [
          "Días 1-2: cargar turnos y personas reales anonimizadas. Días 3-5: marcar en condiciones reales (hora pico, mala luz, GPS débil). Días 6-7: generar novedades y correcciones. Días 8-9: exportar a nómina y producir relación de extras. Día 10: retrospectiva con puntaje y riesgos abiertos.",
          "Al final, conteste tres preguntas: ¿podemos explicar un pago?, ¿podemos cumplir una solicitud de registro de suplementarias?, ¿el equipo puede marcar sin improvisar? Si alguna respuesta es “aún no”, no cierre la compra solo por precio.",
          "Esta guía es orientativa y no constituye asesoría jurídica, de seguridad ni una recomendación de proveedor. Contraste siempre con el texto normativo vigente y con las necesidades específicas de su operación.",
        ],
      },
      {
        heading: "Preguntas que separan demos de producto real",
        paragraphs: [
          "¿Puedo versionar una regla de recargo y ver qué versión se aplicó en enero? ¿Puedo simular un cierre sin afectar producción? ¿El aislamiento multi-empresa está probado o solo “confíe en nosotros”? ¿Qué pasa con mis datos al cancelar?",
          "¿El proveedor subencarga biometría a un tercero? ¿Dónde están los servidores? ¿Cómo demuestran eliminación de plantillas? ¿Cuál es el tiempo máximo de recuperación ante caída del kiosco?",
          "¿La API tiene scopes, paginación y documentación estable? ¿Los webhooks son firmados? ¿Existe entorno sandbox? Estas preguntas revelan madurez más rápido que una lista de módulos en una presentación comercial.",
          "Pida referencias de clientes con operación similar (multi-sede, turnos nocturnos, alto volumen de novedades). Una referencia de oficina 9-6 no valida un retail 24/7.",
        ],
      },
      {
        heading: "Cierre de compra con evidencia, no con entusiasmo",
        paragraphs: [
          "Antes de firmar, exija el acta del piloto con puntajes, riesgos abiertos y plan de mitigación. Incluya en el contrato: niveles de servicio, tiempos de soporte, portabilidad de datos, ubicación de tratamiento y obligaciones de seguridad.",
          "Negocie un hito de aceptación ligado al primer cierre de nómina real, no solo a la instalación del hardware. El valor aparece en el cierre, no en la foto del kiosco.",
          "Recuerde las cifras de EY solo como recordatorio del costo de la planilla imperfecta, no como garantía de ahorro. Su línea base local decide si el proyecto paga.",
          "Esta guía es orientativa. No constituye asesoría jurídica ni recomendación de un proveedor específico. Contraste siempre con la Ley 2466 de 2025, la Ley 1581 de 2012 y las necesidades de su operación.",
        ],
        bullets: [
          "Acta de piloto con riesgos abiertos.",
          "Aceptación ligada al cierre de nómina.",
          "Cláusulas de portabilidad y seguridad.",
          "Referencias del mismo tipo de operación.",
        ],
      },

      {
        heading: "Errores de compra frecuentes en Colombia",
        paragraphs: [
          "Comprar por el precio del dispositivo y descubrir después que el reporte de extras no distingue diurnas y nocturnas. Comprar biometría sin alternativa. Firmar sin cláusula de portabilidad. Aceptar una demo de oficina para una operación de turnos rotativos.",
          "Otro error: no involucrar a nómina hasta el final. Si nómina no valida la exportación en el piloto, el “ahorro” se evapora en el primer cierre real. Involúcrela desde la matriz de puntuación.",
          "Por último, no documentar la decisión. Dentro de un año nadie recordará por qué se descartó un proveedor. Guarde el acta, los puntajes y los riesgos. Esta guía es orientativa y no constituye asesoría jurídica ni recomendación comercial.",
        ],
      },
    ],
    sources: [
      colombianLaborReform,
      dataProtectionLaw,
      sicBiometrics,
      eyPayrollStudy,
    ],
  },
];

function countArticleWords(article: Article): number {
  const content = [
    article.title,
    article.description,
    article.answer,
    ...article.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]),
  ].join(" ");

  return content.trim().split(/\s+/u).length;
}

export const articles: Article[] = baseArticles.map((article) => {
  const expandedArticle: Article = {
    ...article,
    sections: article.sections.concat(getArticleExpansion(article.slug)),
  };
  const minutes = Math.max(1, Math.ceil(countArticleWords(expandedArticle) / 190));

  return {
    ...expandedArticle,
    readingTime: `${minutes} min`,
  };
});

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
