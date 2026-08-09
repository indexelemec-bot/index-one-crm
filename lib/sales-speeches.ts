import type { Account, Opportunity, OpportunityStage, SpeechUsage, Stakeholder } from "@/types/domain";

export interface SalesSpeech {
  id: string;
  stage: OpportunityStage;
  title: string;
  channel: "llamada" | "reunion" | "email" | "whatsapp";
  body: string;
  cta: string;
}

const speech = (id: string, stage: OpportunityStage, title: string, body: string, cta: string, channel: SalesSpeech["channel"] = "llamada"): SalesSpeech => ({ id, stage, title, body, cta, channel });

export const salesSpeeches: SalesSpeech[] = [
  speech("prospecto-mejora", "prospecto_identificado", "Apertura por mejora de gestión", "Buenos días, [Nombre]. Le contacto de INDEX ONE. Trabajamos con juntas que desean mejorar transparencia financiera, mantenimiento y respuesta a propietarios. Me gustaría conocer cómo gestionan hoy esas áreas y determinar si existe una oportunidad real de mejora. ¿Podemos conversar 15 minutos esta semana?", "Coordinar conversación de 15 minutos."),
  speech("prospecto-prevencion", "prospecto_identificado", "Apertura basada en prevención", "Saludos, [Nombre]. Ayudamos a condominios a detectar riesgos administrativos y operativos antes de que se conviertan en gastos extraordinarios o conflictos. ¿Coordinamos una llamada breve para revisar, sin compromiso, los principales puntos de atención de [Condominio]?", "Obtener autorización para una llamada diagnóstica."),
  speech("prospecto-referencia", "prospecto_identificado", "Referencia sectorial", "Hola, [Nombre]. Hemos trabajado con condominios de características similares a [Condominio] en organización financiera, cobros, personal y mantenimiento preventivo. Quisiera entender cómo manejan hoy esos procesos y compartir prácticas útiles. ¿Qué día le conviene conversar?", "Agendar el primer contacto."),

  speech("problema-costo", "problema_detectado", "Costo de mantener el problema", "Por lo que me comenta, el problema no es solamente [Problema]; también está afectando [Impacto]. Cuando se mantiene, suele costar más dinero y tiempo a la directiva. Antes de hablar de una propuesta, quisiera cuantificarlo: ¿cuánto tiempo llevan enfrentándolo y qué han intentado?", "Cuantificar duración, costo e intentos previos."),
  speech("problema-junta", "problema_detectado", "Impacto sobre la junta", "Entiendo que la junta dedica tiempo a asuntos operativos que deberían estar controlados por un proceso profesional. Nuestra meta no sería sustituir sus decisiones, sino liberarles de la ejecución diaria y darles información clara. ¿Cuáles son las tres situaciones que más tiempo les consumen?", "Identificar tres dolores prioritarios."),
  speech("problema-riesgo", "problema_detectado", "Riesgo futuro", "Lo importante es evitar que [Problema] evolucione hacia una emergencia, una cuota extraordinaria o pérdida de confianza. Si no se corrige en los próximos tres a seis meses, ¿qué considera que podría ocurrir?", "Lograr que el prospecto verbalice el riesgo."),

  speech("decisor-mapa", "contacto_decisor", "Mapa de decisión", "Para presentar una solución con posibilidades reales de aprobación, necesito comprender cómo toman este tipo de decisiones. Además de usted, ¿quién participa en la evaluación, quién valida la parte financiera y quién aprueba finalmente?", "Identificar influenciadores, evaluadores y aprobadores."),
  speech("decisor-reunion", "contacto_decisor", "Alineación con la directiva", "Quiero evitar que usted tenga que transmitir toda la información. Lo más eficiente sería escuchar directamente a los miembros clave y responder sus preguntas. ¿Podemos coordinar una reunión conjunta de 30 minutos?", "Conseguir reunión con la junta.", "reunion"),
  speech("decisor-asamblea", "contacto_decisor", "Preparación para asamblea", "Cuando la decisión debe presentarse a propietarios, conviene construir un caso claro: situación, riesgos, solución, beneficios y costo. ¿Quién lideraría internamente esa presentación y qué necesitaría para defenderla?", "Identificar patrocinador interno y requisitos."),

  speech("diagnostico-integral", "diagnostico", "Diagnóstico integral", "Antes de recomendar un servicio evaluaremos cinco áreas: finanzas, cobros, mantenimiento, personal y comunicación. La intención no es señalar errores, sino identificar prioridades. ¿Podemos revisar cada área con la persona responsable?", "Autorizar el levantamiento integral.", "reunion"),
  speech("diagnostico-financiero", "diagnostico", "Diagnóstico financiero", "Para evaluar sostenibilidad necesitamos comprender ingresos, gastos, morosidad, cuentas por pagar, balance y fondo de reserva. Con rangos aproximados podemos detectar brechas. ¿Cuál de esas áreas les preocupa más?", "Determinar la prioridad financiera.", "reunion"),
  speech("diagnostico-operativo", "diagnostico", "Diagnóstico operativo", "En la operación buscamos tres cosas: equipos críticos identificados, mantenimientos programados y responsables definidos. ¿Actualmente cuentan con un plan preventivo y evidencia de los trabajos realizados?", "Confirmar madurez del mantenimiento.", "reunion"),

  speech("solucion-dolor", "solucion_recomendada", "Solución vinculada al dolor", "Según el diagnóstico, la prioridad no es simplemente cambiar de administrador; es resolver [Problema]. Recomendamos [Solución] para lograr el resultado esperado. La junta conserva las decisiones e INDEX ONE asume ejecución, seguimiento y rendición de cuentas. ¿Esto responde a la prioridad que definimos?", "Validar encaje entre problema y solución.", "reunion"),
  speech("solucion-prioridades", "solucion_recomendada", "Plan por prioridades", "No proponemos corregir todo a la vez. Iniciaríamos con tres prioridades, cada una con responsable, fecha, evidencia y reporte. ¿Ese orden coincide con lo que la junta considera más urgente?", "Aprobar el orden de prioridades.", "reunion"),
  speech("solucion-medible", "solucion_recomendada", "Resultado medible", "El valor de una administración profesional debe poder medirse. Proponemos revisar indicadores financieros, operativos y de servicio mensualmente. ¿Cuáles resultados necesita ver la junta para considerar exitosa la gestión?", "Acordar indicadores de éxito.", "reunion"),

  speech("presentacion-ejecutiva", "presentacion", "Presentación ejecutiva", "Hoy nos concentraremos en tres puntos: qué está afectando a [Condominio], cómo lo resolveríamos y cómo la junta comprobará los resultados. Al final determinaremos juntos si existe un encaje real.", "Acordar una evaluación clara al cierre.", "reunion"),
  speech("presentacion-riesgo", "presentacion", "Reducción de riesgo", "Cambiar de administración puede generar preocupación. Reducimos el riesgo con diagnóstico, transición documentada, responsables y reportes periódicos. ¿Cuál es el mayor temor que tendría la junta frente al cambio?", "Identificar la objeción principal.", "reunion"),
  speech("presentacion-prueba", "presentacion", "Prueba social comparable", "Seleccionamos referencias autorizadas de condominios con características similares a [Condominio]. Allí hemos trabajado necesidades relacionadas con [Problema]. ¿Les ayudaría conversar con una referencia comparable?", "Autorizar contacto con una referencia.", "reunion"),

  speech("propuesta-honorarios", "propuesta", "Presentación de honorarios", "Los honorarios mensuales propuestos son de [Monto], con ITBIS incluido. Responden al nivel de gestión requerido por [Condominio]. Recomendamos comparar no solo una cifra, sino alcance, respuesta, controles y resultados. ¿Cuándo podemos revisarla juntos?", "Confirmar recepción y fecha de revisión.", "email"),
  speech("propuesta-unidad", "propuesta", "Valor por unidad", "Al distribuir los honorarios entre [Unidades] unidades, la inversión aproximada es de [ValorUnidad] por apartamento al mes. Esa inversión profesionaliza la gestión y reduce exposición a gastos imprevistos y errores. ¿Cómo percibe la junta esa relación valor-costo?", "Validar la percepción de valor.", "reunion"),
  speech("propuesta-no-decidir", "propuesta", "Costo de no decidir", "También conviene comparar la inversión con el costo actual de [Problema]: emergencias, morosidad, horas de la junta o mantenimiento reactivo. ¿Qué información adicional necesitan para evaluar un retorno razonable?", "Identificar la información faltante.", "reunion"),

  speech("negociacion-precio", "negociacion", "Objeción de precio", "Comprendo que el precio es importante. ¿La preocupación es que supera el presupuesto disponible o que todavía no se percibe claramente el valor del alcance? Son situaciones distintas y quisiera atender la causa real.", "Clasificar la objeción antes de negociar.", "reunion"),
  speech("negociacion-comparacion", "negociacion", "Comparación con competidores", "Es saludable comparar alternativas. Sugerimos usar los mismos criterios: alcance, supervisión, capacidad técnica, reportes, emergencias, referencias y condiciones. ¿Desean que preparemos una matriz objetiva?", "Ofrecer una comparación transparente.", "email"),
  speech("negociacion-condicion", "negociacion", "Condición para avanzar", "Además de esa objeción, ¿existe algún otro motivo que impediría aprobar? Si resolvemos este punto de forma satisfactoria, ¿estarían en posición de avanzar?", "Obtener un compromiso condicionado.", "reunion"),

  speech("aprobacion-pasos", "aprobacion", "Cierre por próximos pasos", "La solución responde a las necesidades y las condiciones han sido aclaradas. El siguiente paso natural es formalizar la aprobación y definir la fecha de firma. ¿Podemos dejar hoy acordados responsable y fecha?", "Definir responsable y fecha.", "reunion"),
  speech("aprobacion-consenso", "aprobacion", "Cierre por consenso", "Antes de cerrar, quisiera confirmar la posición de cada miembro. ¿Existe alguna inquietud pendiente que pueda impedir la aprobación? Prefiero resolverla ahora con total claridad.", "Detectar y resolver la objeción final.", "reunion"),
  speech("aprobacion-fecha", "aprobacion", "Cierre con fecha", "Para organizar la disponibilidad del equipo de transición necesitamos una fecha realista de decisión. ¿Les resulta viable completar la aprobación el [Fecha]?", "Conseguir una fecha definitiva.", "reunion"),

  speech("contrato-formalizacion", "contrato_transicion", "Formalización del acuerdo", "Con la aprobación obtenida, queremos que la firma y transición sean sencillas. Revisaremos contrato, responsables, fecha de inicio y documentación requerida. ¿Quién será el enlace principal de la junta?", "Nombrar el enlace de transición.", "reunion"),
  speech("contrato-continuidad", "contrato_transicion", "Transición sin interrupciones", "La transición no debe afectar los servicios. Trabajaremos con un inventario de documentos, fondos, proveedores, empleados, contratos y pendientes para que cada entrega quede registrada. ¿Revisamos juntos el cronograma?", "Aprobar el cronograma.", "reunion"),
  speech("contrato-expectativas", "contrato_transicion", "Expectativas 30-60-90", "Antes del inicio queremos acordar qué esperan ver durante los primeros 30, 60 y 90 días. ¿Cuáles resultados considerarían indispensables en los primeros tres meses?", "Definir metas 30-60-90.", "reunion"),

  speech("activo-resultados", "cliente_activo", "Validación de primeros resultados", "Ha transcurrido el período inicial y queremos revisar qué ha mejorado, qué requiere ajustes y cuáles son las próximas prioridades. ¿Qué cambio ha sido más valioso para la junta y los propietarios?", "Documentar resultados verificables.", "reunion"),
  speech("activo-expansion", "cliente_activo", "Expansión de soluciones", "Ahora que la operación principal está estabilizada, podemos evaluar oportunidades en mantenimiento, eficiencia, seguridad, proyectos o comunicación. ¿Qué área desean fortalecer a continuación?", "Identificar una oportunidad de expansión.", "reunion"),
  speech("activo-referencia", "cliente_activo", "Solicitud de referencia", "Estamos conversando con un condominio similar que enfrenta una situación parecida. Después de los resultados logrados, ¿podríamos mencionar a [Condominio] como referencia y facilitar un contacto con su autorización?", "Obtener autorización formal de referencia.", "reunion"),

  speech("perdida-aprendizaje", "perdida", "Cierre de aprendizaje", "Gracias por la transparencia durante el proceso. Para mejorar, ¿podría compartir qué factor tuvo mayor peso en la decisión? Respetaremos completamente su elección.", "Registrar el motivo real de pérdida."),
  speech("perdida-puerta", "perdida", "Puerta abierta profesional", "Comprendemos la decisión y agradecemos la oportunidad. Si cambian las condiciones o desean una segunda opinión, estaremos disponibles. ¿Sería apropiado conversar nuevamente en unos meses?", "Obtener permiso para reactivar."),
  speech("perdida-alternativa", "perdida", "Apoyo sin presión", "Aunque no continuemos ahora, con gusto podemos compartir una recomendación puntual sobre [Problema] que ayude a la junta. Nuestro interés es que [Condominio] tome una decisión sostenible.", "Conservar confianza y aportar valor."),
];

export function speechesForStage(stage: OpportunityStage) {
  return salesSpeeches.filter((item) => item.stage === stage);
}

export function personalizeSpeech(item: SalesSpeech, account: Account, opportunity: Opportunity, stakeholder?: Stakeholder) {
  const unitValue = account.units > 0 ? opportunity.monthlyFee / account.units : 0;
  return item.body
    .replaceAll("[Nombre]", stakeholder?.fullName || "miembro de la junta")
    .replaceAll("[Condominio]", account.name)
    .replaceAll("[Problema]", opportunity.primaryProblem || "la situación identificada")
    .replaceAll("[Impacto]", opportunity.impact || "la operación y la confianza de los propietarios")
    .replaceAll("[Solución]", opportunity.proposedSolution || "un plan de administración con controles y seguimiento")
    .replaceAll("[Monto]", new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(opportunity.monthlyFee).replace("DOP", "RD$"))
    .replaceAll("[Unidades]", String(account.units))
    .replaceAll("[ValorUnidad]", new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(unitValue).replace("DOP", "RD$"))
    .replaceAll("[Fecha]", "la fecha acordada");
}

export function availableSpeeches(stage: OpportunityStage, usages: SpeechUsage[], opportunityId: string, stakeholderId?: string) {
  const used = new Set(usages.filter((item) => item.opportunityId === opportunityId && item.stage === stage && (!stakeholderId || item.stakeholderId === stakeholderId)).map((item) => item.speechId));
  return speechesForStage(stage).filter((item) => !used.has(item.id));
}
