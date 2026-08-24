/* ================================================================
   data.js — Datos estáticos del Colegio Terra di Bimbi
   Cursos, protocolos (RICE 2026), clasificaciones de faltas,
   tipos de anotación, categorías de funcionarios, etc.
   ================================================================ */

const DATA = (() => {
  const state = {
    institucion: { nombre: 'Direccion en gestion', sistema: 'Sistema de Seguimiento Institucional', anio: 2026 },
    DashboardConfig: { directora: [], inspectoria: [], convivencia: [], utp: [], pie: [], profesor: [], finanzas: [], admin: [] },
    niveles: [
      { id: 'parvularia', nombre: 'Educación Parvularia', orden: 1, color: '#805ad5' },
      { id: 'basica-1', nombre: 'Educación Básica (1° Ciclo)', orden: 2, color: '#3182ce' },
      { id: 'basica-2', nombre: 'Educación Básica (2° Ciclo)', orden: 3, color: '#2b6cb0' }
    ],
    cursos: [
      { id: 'medio-mayor-a', nombre: 'Medio Mayor A', nivel: 'parvularia', orden: 1 },
      { id: 'medio-mayor-b', nombre: 'Medio Mayor B', nivel: 'parvularia', orden: 2 },
      { id: 'pre-kinder-regular', nombre: 'Pre-Kinder Regular', nivel: 'parvularia', orden: 3 },
      { id: 'pre-kinder-lenguaje', nombre: 'Pre-Kinder Lenguaje', nivel: 'parvularia', orden: 4 },
      { id: 'kinder-regular', nombre: 'Kinder Regular', nivel: 'parvularia', orden: 5 },
      { id: 'kinder-lenguaje', nombre: 'Kinder Lenguaje', nivel: 'parvularia', orden: 6 },
      { id: '1-basico', nombre: '1° Básico', nivel: 'basica-1', orden: 7 },
      { id: '2-basico', nombre: '2° Básico', nivel: 'basica-1', orden: 8 },
      { id: '3-basico', nombre: '3° Básico', nivel: 'basica-1', orden: 9 },
      { id: '4-basico', nombre: '4° Básico', nivel: 'basica-1', orden: 10 },
      { id: '5-basico', nombre: '5° Básico', nivel: 'basica-2', orden: 11 },
      { id: '6-basico', nombre: '6° Básico', nivel: 'basica-2', orden: 12 },
      { id: '7-basico', nombre: '7° Básico', nivel: 'basica-2', orden: 13 },
      { id: '8-basico', nombre: '8° Básico', nivel: 'basica-2', orden: 14 }
    ],
    categoriasProtocolo: [
      { id: 'convivencia', nombre: 'Convivencia Escolar', color: '#3182ce' },
      { id: 'seguridad', nombre: 'Seguridad', color: '#e53e3e' },
      { id: 'proteccion', nombre: 'Protección', color: '#805ad5' },
      { id: 'inclusion', nombre: 'Inclusión', color: '#38a169' },
      { id: 'gestion', nombre: 'Gestión', color: '#d69e2e' },
      { id: 'prevencion', nombre: 'Prevención', color: '#dd6b20' }
    ],
    protocolos: [
      { id: 'violencia-escolar', nombre: 'Violencia Escolar', nombreCompleto: 'Protocolo de Actuación frente a Situaciones de Violencia Escolar', categoria: 'convivencia' },
      { id: 'accidentes-escolares', nombre: 'Accidentes Escolares', nombreCompleto: 'Protocolo de Actuación frente a Accidentes Escolares', categoria: 'seguridad' },
      { id: 'abuso-sexual', nombre: 'Abuso Sexual Infantil', nombreCompleto: 'Protocolo de Actuación frente a Situaciones de Abuso Sexual Infantil', categoria: 'proteccion' },
      { id: 'situaciones-externas', nombre: 'Situaciones Fuera del Establecimiento', nombreCompleto: 'Protocolo de Actuación ante Situaciones Fuera del Establecimiento', categoria: 'seguridad' },
      { id: 'ciberbullying', nombre: 'Ciberbullying', nombreCompleto: 'Protocolo Institucional ante Ciberbullying', categoria: 'convivencia' },
      { id: 'drogas-alcohol', nombre: 'Drogas y Alcohol', nombreCompleto: 'Protocolo Institucional frente a Situaciones Relacionadas con Drogas y Alcohol', categoria: 'prevencion' },
      { id: 'vulneracion-derechos', nombre: 'Vulneración de Derechos', nombreCompleto: 'Protocolo de Actuación frente a Situaciones de Vulneración de Derechos', categoria: 'proteccion' },
      { id: 'embarazo-maternidad', nombre: 'Embarazo, Maternidad y Paternidad', nombreCompleto: 'Protocolo de Acción frente a Embarazo, Maternidad y Paternidad', categoria: 'inclusion' },
      { id: 'salidas-pedagogicas', nombre: 'Salidas Pedagógicas', nombreCompleto: 'Protocolo de Seguridad en Salidas Pedagógicas', categoria: 'seguridad' },
      { id: 'riesgo-suicida', nombre: 'Ideación o Riesgo Suicida', nombreCompleto: 'Protocolo de Actuación ante Ideación o Riesgo Suicida', categoria: 'proteccion' },
      { id: 'identidad-genero', nombre: 'Identidades de Género', nombreCompleto: 'Protocolo de Acompañamiento a Estudiantes con Identidades de Género', categoria: 'inclusion' },
      { id: 'resguardo-digital', nombre: 'Educación y Resguardo Digital', nombreCompleto: 'Protocolo de Educación y Resguardo Digital Avanzado', categoria: 'prevencion' },
      { id: 'abandono-escolar', nombre: 'Abandono Escolar', nombreCompleto: 'Protocolo para la Prevención y Detección de Abandono Escolar', categoria: 'prevencion' },
      { id: 'formacion-ciudadana', nombre: 'Participación y Formación Ciudadana', nombreCompleto: 'Protocolo de Participación y Formación Ciudadana', categoria: 'gestion' },
      { id: 'porte-armas', nombre: 'Porte y Uso de Armas', nombreCompleto: 'Protocolo de Seguridad frente al Porte y Uso de Armas en el Establecimiento', categoria: 'seguridad' },
      { id: 'balaceras-externas', nombre: 'Balas Locas o Balaceras Externas', nombreCompleto: 'Protocolo de Acción ante Balas Locas o Balaceras Externas', categoria: 'seguridad' },
      { id: 'emergencia-crisis', nombre: 'Emergencia o Crisis', nombreCompleto: 'Protocolo para la Atención en Contextos de Emergencia o Crisis', categoria: 'seguridad' },
      { id: 'desregulacion-cea', nombre: 'Desregulación Estudiante con CEA', nombreCompleto: 'Protocolo de Actuación ante la Desregulación de un Estudiante con CEA', categoria: 'inclusion' },
      { id: 'cancelacion-matricula', nombre: 'Cancelación de Matrícula', nombreCompleto: 'Protocolo de Cancelación de Matrícula', categoria: 'gestion' },
      { id: 'cierre-anticipado', nombre: 'Cierre Anticipado del Año Escolar', nombreCompleto: 'Protocolo de Cierre Anticipado del Año Escolar para Estudiantes', categoria: 'gestion' },
      { id: 'cambio-apoderado', nombre: 'Cambio de Apoderado/a', nombreCompleto: 'Protocolo de Cambio de Apoderado/a', categoria: 'gestion' },
      { id: 'fuga-estudiantes', nombre: 'Fuga Interna o Externa', nombreCompleto: 'Protocolo de Actuación ante Fuga Interna o Externa de Estudiantes', categoria: 'seguridad' },
      { id: 'conductas-disruptivas', nombre: 'Conductas Disruptivas en el Aula', nombreCompleto: 'Protocolo de Acción ante Conductas Disruptivas en el Aula', categoria: 'convivencia' },
      { id: 'uso-indebido-tecnologia', nombre: 'Uso Indebido de Tecnologías', nombreCompleto: 'Protocolo de Actuación ante el Uso Indebido de Tecnologías', categoria: 'prevencion' },
      { id: 'administracion-medicamentos', nombre: 'Administración de Medicamentos', nombreCompleto: 'Protocolo de Administración de Medicamentos en el Establecimiento', categoria: 'seguridad' },
      { id: 'prevencion-acoso', nombre: 'Prevención de Acoso y Violencia', nombreCompleto: 'Estrategias de Prevención y Protocolo de Actuación frente a Acoso y Violencia', categoria: 'prevencion' }
    ],
    tiposFalta: [
      { id: 'leve', nombre: 'Leve', color: '#d69e2e', bgColor: '#fefcbf', descripcion: 'La reiteración de más de 3 faltas leves conlleva un registro de falta grave.' },
      { id: 'grave', nombre: 'Grave', color: '#dd6b20', bgColor: '#feebc8', descripcion: 'La reiteración de más de 2 faltas graves conlleva un registro de falta gravísima.' },
      { id: 'gravisima', nombre: 'Gravísima', color: '#e53e3e', bgColor: '#fed7d7', descripcion: 'Activación inmediata de protocolos de emergencia según corresponda.' }
    ],
    tiposAnotacion: [
      { id: 'positiva', nombre: 'Positiva', color: '#38a169', bgColor: '#c6f6d5', icono: '👍' },
      { id: 'negativa', nombre: 'Negativa', color: '#e53e3e', bgColor: '#fed7d7', icono: '⚠️' },
      { id: 'observacion', nombre: 'Observación', color: '#3182ce', bgColor: '#bee3f8', icono: '📝' }
    ],
    categoriasFuncionario: [
      { id: 'directivo', nombre: 'Directivos' },
      { id: 'docente', nombre: 'Docentes' },
      { id: 'asistente', nombre: 'Asistentes de la Educación' },
      { id: 'otro', nombre: 'Otros' }
    ],
    obligacionesFuncionario: [
      { id: 'ausencia', nombre: 'Ausencia laboral', grupo: 'Asistencia' },
      { id: 'licencia', nombre: 'Licencia médica', grupo: 'Asistencia' },
      { id: 'permiso', nombre: 'Permiso administrativo', grupo: 'Asistencia' },
      { id: 'rutina_tarde', nombre: 'Llega tarde al aula', grupo: 'Faltas de Rutina' },
      { id: 'rutina_leccionario', nombre: 'No completa leccionario', grupo: 'Faltas de Rutina' },
      { id: 'rutina_planificacion', nombre: 'No posee planificaciones', grupo: 'Faltas de Rutina' },
      { id: 'rutina_evaluacion', nombre: 'No envía evaluaciones', grupo: 'Faltas de Rutina' },
      { id: 'retroalimentacion_trabajo', nombre: 'Retroalimentación de trabajo (UTP)', grupo: 'Gestión UTP' },
      { id: 'utp', nombre: 'Función UTP', grupo: 'Funciones Internas' },
      { id: 'inspectoria', nombre: 'Función Inspectoría', grupo: 'Funciones Internas' },
      { id: 'positiva', nombre: 'Acción Positiva / Reconocimiento', grupo: 'Positivo' }
    ],
    estadosProtocolo: [
      { id: 'activado', nombre: 'Activado', color: '#e53e3e', bgColor: '#fed7d7' },
      { id: 'en_seguimiento', nombre: 'En Seguimiento', color: '#d69e2e', bgColor: '#fefcbf' },
      { id: 'cerrado', nombre: 'Cerrado', color: '#38a169', bgColor: '#c6f6d5' }
    ],
    estadosCaso: [
      { id: 'abierto', nombre: 'Abierto', color: '#e53e3e', bgColor: '#fed7d7' },
      { id: 'en_proceso', nombre: 'Activo', color: '#d69e2e', bgColor: '#fefcbf' },
      { id: 'cerrado', nombre: 'Cerrado', color: '#38a169', bgColor: '#c6f6d5' }
    ],
    tiposCaso: [
      { id: 'acoso', nombre: 'Acoso Escolar' },
      { id: 'violencia', nombre: 'Violencia' },
      { id: 'abuso', nombre: 'Abuso / Vulneración de Derechos' },
      { id: 'drogas', nombre: 'Drogas / Alcohol' },
      { id: 'accidente', nombre: 'Accidente' },
      { id: 'conducta', nombre: 'Conducta Disruptiva Grave' },
      { id: 'ausentismo', nombre: 'Ausentismo / Abandono' },
      { id: 'tecnologia', nombre: 'Uso Indebido de Tecnología' },
      { id: 'autolesion', nombre: 'Autolesión / Riesgo Suicida' },
      { id: 'fuga', nombre: 'Fuga del Establecimiento' },
      { id: 'complejo', nombre: 'Estudiante Complejo' },
      { id: 'otro', nombre: 'Otro' }
    ],
    motivosGraves: [
      { id: 'agresion-fisica', nombre: 'Agresión física con lesiones' },
      { id: 'bullying', nombre: 'Acoso escolar grave (Bullying/Ciberbullying)' },
      { id: 'abuso-sexual', nombre: 'Abuso o acoso sexual' },
      { id: 'armas', nombre: 'Porte o uso de armas u objetos peligrosos' },
      { id: 'drogas', nombre: 'Tráfico o consumo de drogas/alcohol' },
      { id: 'vulneracion', nombre: 'Vulneración grave de derechos' },
      { id: 'desregulacion', nombre: 'Desregulación severa con riesgo vital' },
      { id: 'suicidio', nombre: 'Riesgo de suicidio o autolesiones' },
      { id: 'disruptivas-reiteradas', nombre: 'Conductas disruptivas reiteradas' }
    ],
    accionesPrevias: [
      { id: 'entrevista-apoderado', nombre: 'Entrevista con apoderado' },
      { id: 'entrevista-estudiante', nombre: 'Entrevista con estudiante' },
      { id: 'llamado', nombre: 'Llamado telefónico' },
      { id: 'derivacion-convivencia', nombre: 'Derivación a convivencia' },
      { id: 'derivacion-psicologia', nombre: 'Derivación a psicología/orientación' },
      { id: 'medida-disciplinaria', nombre: 'Aplicación de medida disciplinaria' },
      { id: 'reunion-equipo', nombre: 'Reunión de equipo docente/directivo' },
      { id: 'notificacion-autoridades', nombre: 'Notificación a autoridades externas' },
      { id: 'otro', nombre: 'Otro antecedente' }
    ],
    edgMockData: {
      convivencia: { casosAbiertosRojo: 3, casosAbiertosAmarillo: 5, protocolosActivos: 4, psicosocialEspera: 12, psicosocialAtencion: 45 },
      inspectoria: { asistenciaCritica: 18, asistenciaGeneral: 91, faltasGravesMes: 24, mantencionesUrgentes: 2, simulacrosPendientes: 1 },
      rrhh: { ausenciasHoy: 3, climaLaboralAlertas: 1, induccionesPendientes: 4, turnosIncumplidosSemana: 5 }
    },
    protocolos_checklists: {
      accidentes_escolares: {
        titulo: 'Protocolo 1 — Accidentes Escolares',
        fuente: 'Art. 6°, 7° y 8°',
        criterio_cierre: 'Cumplimiento de Registro y Trazabilidad (Art. 7°). No requiere denuncia externa salvo que los hechos lo ameriten.',
        pasos: [
          { id: 'C-1', fase: 'Control', accion: 'Auxilio inmediato al estudiante; contención; solicitar encargado de primeros auxilios', responsable: 'Funcionario testigo', plazo: 'Inmediato' },
          { id: 'H-1', fase: 'Historial', accion: 'Evaluar lesión (leve/mediana/grave); registrar en Libro de Enfermería', responsable: 'Encargado de Primeros Auxilios', plazo: 'Máx 5 min' },
          { id: 'E-1', fase: 'Ejecución', accion: 'Curación básica (leve) o derivación (grave); informar a apoderado vía Inspectoría', responsable: 'Inspectoría General', plazo: 'Máx 15 min (aviso)' },
          { id: 'E-2', fase: 'Ejecución', accion: 'Traslado (SAMU 131 o vehículo institucional) a centro público de salud', responsable: 'Dirección General / Inspectoría', plazo: 'Inmediato' },
          { id: 'K-1', fase: 'Seguimiento', accion: 'Emitir DIAE en triplicado y firmada; entregar en centro de salud', responsable: 'Dirección General', plazo: 'Máx 24 h' },
          { id: 'C-2', fase: 'Cierre', accion: 'Registro completado: Libro de Enfermería, Ficha DIAE, Acta de Bitácora', responsable: 'Inspectoría / Enfermería', plazo: 'Fin del caso' }
        ]
      },
      agresiones_sexuales: {
        titulo: 'Protocolo 2 — Agresiones Sexuales y Hechos de Connotación Sexual',
        fuente: 'Art. 10°, 11° y 17°; Anexo 6',
        criterio_cierre: 'Informe de Cierre del Caso (Anexo 6). Se cierra una vez finalizadas acciones institucionales.',
        pasos: [
          { id: 'C-1', fase: 'Control', accion: 'Detección (revelación espontánea, observación directa, información de terceros)', responsable: 'Funcionario que recibe el relato', plazo: 'Inmediato' },
          { id: 'H-1', fase: 'Historial', accion: 'Escuchar, contener, no investigar; abrir registro de activación', responsable: 'Funcionario que recibe el relato', plazo: 'Inmediato' },
          { id: 'H-2', fase: 'Historial', accion: 'Activar protocolo; notificar a Dirección General e Inspectoría', responsable: 'Dirección General / Inspectoría General', plazo: 'Inmediato' },
          { id: 'E-1', fase: 'Ejecución', accion: 'Aplicar medidas de resguardo inmediatas (separación, protección)', responsable: 'Inspectoría / Convivencia', plazo: 'Mismo día' },
          { id: 'E-2', fase: 'Ejecución', accion: 'Denunciar ante Fiscalía/Carabineros/PDI (obligatorio en 24 h)', responsable: 'Dirección General', plazo: 'Máx 24 h' },
          { id: 'E-3', fase: 'Ejecución', accion: 'Derivar a redes externas cuando corresponda', responsable: 'Dirección / Convivencia', plazo: 'Según necesidad' },
          { id: 'K-1', fase: 'Seguimiento', accion: 'Primer seguimiento psicosocial y bienestar del estudiante', responsable: 'Convivencia Escolar', plazo: '48 h' },
          { id: 'K-2', fase: 'Seguimiento', accion: 'Revisión del caso por Equipo de Convivencia', responsable: 'Equipo de Gestión', plazo: '5 días hábiles' },
          { id: 'C-2', fase: 'Cierre', accion: 'Elaborar Informe de Cierre (Anexo 6) con medidas adoptadas y resultados', responsable: 'Dirección General', plazo: 'Final' }
        ]
      },
      violencia_escolar: {
        titulo: 'Protocolo 3 — Maltrato, Acoso Escolar o Violencia Escolar',
        fuente: 'Art. Procedimiento General; Anexo 7',
        criterio_cierre: 'Medidas implementadas + ausencia de nuevos incidentes + seguimiento realizado + Informe de Cierre (Anexo 7).',
        pasos: [
          { id: 'C-1', fase: 'Control', accion: 'Recepción de denuncia (verbal/escrita/formulario); escuchar sin emitir juicios', responsable: 'Cualquier funcionario', plazo: 'Inmediato' },
          { id: 'H-1', fase: 'Historial', accion: 'Abrir registro formal; asignar N° de caso; notificar a Inspectoría y Convivencia', responsable: 'Inspectoría General / Convivencia', plazo: 'Inmediato' },
          { id: 'H-2', fase: 'Historial', accion: 'Registrar antecedentes mínimos (fecha, hora, personas involucradas)', responsable: 'Convivencia Escolar', plazo: '24 h' },
          { id: 'E-1', fase: 'Ejecución', accion: 'Evaluación inicial: tipo de situación, nivel de riesgo, necesidad de medidas urgentes', responsable: 'Convivencia Escolar', plazo: 'Máx 24 h' },
          { id: 'E-2', fase: 'Ejecución', accion: 'Aplicar medidas cautelares/resguardo; separar involucrados si procede', responsable: 'Inspectoría / Dirección', plazo: 'Mismo día' },
          { id: 'E-3', fase: 'Ejecución', accion: 'Investigar: entrevistas, evidencia documental/digital, informes previos', responsable: 'Convivencia Escolar', plazo: 'Inicio: 48 h' },
          { id: 'E-4', fase: 'Ejecución', accion: 'Resolver: análisis de antecedentes, hechos acreditados, medidas formativas/disciplinarias', responsable: 'Dirección General', plazo: '10 días hábiles' },
          { id: 'K-1', fase: 'Seguimiento', accion: 'Primer seguimiento (15 días) y segundo seguimiento (30 días)', responsable: 'Convivencia Escolar', plazo: '15 y 30 días' },
          { id: 'C-2', fase: 'Cierre', accion: 'Emitir Informe de Cierre (Anexo 7) con medidas implementadas, seguimiento y estado final', responsable: 'Dirección General', plazo: 'Final' }
        ]
      },
      vulneracion_derechos: {
        titulo: 'Protocolo 4 — Vulneración de Derechos de Estudiantes',
        fuente: 'Art. Procedimiento General; Anexo 7 y 8',
        criterio_cierre: 'Cese del riesgo + estabilidad + informe final (Anexo 8).',
        pasos: [
          { id: 'C-1', fase: 'Control', accion: 'Detección (observación, relato, terceros, evidencia, redes externas); informar a Convivencia/Inspectoría', responsable: 'Cualquier integrante', plazo: 'Inmediato' },
          { id: 'H-1', fase: 'Historial', accion: 'Registrar fecha, hora, observaciones, factores de riesgo (Anexo 1); abrir N° de caso', responsable: 'Convivencia / Inspectoría', plazo: 'Mismo día' },
          { id: 'H-2', fase: 'Historial', accion: 'Comunicar a la familia (salvo riesgo por participación del adulto)', responsable: 'Encargado de Convivencia', plazo: '24 h hábiles' },
          { id: 'E-1', fase: 'Ejecución', accion: 'Evaluación preliminar y clasificación de riesgo (Bajo/Medio/Alto)', responsable: 'Encargado de Convivencia', plazo: 'Máx 24 h hábiles' },
          { id: 'E-2', fase: 'Ejecución', accion: 'Implementar medidas de resguardo inmediatas y registrarlas (Anexo 3)', responsable: 'Inspectoría / Convivencia', plazo: 'Mismo día' },
          { id: 'E-3', fase: 'Ejecución', accion: 'Derivar a OLN, Tribunal de Familia, Fiscalía, CESFAM, según corresponda', responsable: 'Dirección General / Convivencia', plazo: 'Inmediato si hay delito' },
          { id: 'K-1', fase: 'Seguimiento', accion: 'Primer seguimiento: 7 días hábiles; segundo seguimiento: 30 días hábiles', responsable: 'Encargado de Convivencia', plazo: '7 y 30 días hábiles' },
          { id: 'C-2', fase: 'Cierre', accion: 'Emitir Informe de Cierre (Anexo 8) cuando cesa el riesgo, hay estabilidad e intervención efectiva', responsable: 'Convivencia / Dirección General', plazo: 'Final' }
        ]
      },
      drogas_alcohol: {
        titulo: 'Protocolo 5 — Drogas y Alcohol',
        fuente: 'Art. Procedimiento General; Anexo 8',
        criterio_cierre: 'Caso cerrado cuando se cumplen objetivos de intervención, existe estabilidad del estudiante e Informe de Cierre firmado',
        pasos: [
          { id: 'C-1', fase: 'Control', accion: 'Detección (olores, conducta, testimonios, evidencia); informar a Inspectoría/Convivencia', responsable: 'Cualquier integrante', plazo: 'Inmediato' },
          { id: 'H-1', fase: 'Historial', accion: 'Registrar fecha, hora, lugar, personas involucradas (Anexo 1); abrir N° de caso', responsable: 'Inspectoría General', plazo: 'Mismo día' },
          { id: 'H-2', fase: 'Historial', accion: 'Clasificación inicial (sospecha/consumo confirmado/porte/microtráfico/tráfico)', responsable: 'Encargado de Convivencia', plazo: 'Mismo día' },
          { id: 'E-1', fase: 'Ejecución', accion: 'Evaluación preliminar y clasificación de riesgo (Bajo/Medio/Alto)', responsable: 'Encargado de Convivencia', plazo: 'Máx 24 h hábiles' },
          { id: 'E-2', fase: 'Ejecución', accion: 'Medidas de resguardo (supervisión, espacios protegidos, derivación salud)', responsable: 'Inspectoría / Convivencia', plazo: 'Mismo día' },
          { id: 'E-3', fase: 'Ejecución', accion: 'Comunicar a la familia (24 h hábiles); derivar a SENDA/CESFAM/Salud Mental/Fiscalía según tipología', responsable: 'Dirección General', plazo: '24 h hábiles (familia)' },
          { id: 'E-4', fase: 'Ejecución', accion: 'Denuncia obligatoria ante Carabineros/PDI/Fiscalía si hay tráfico o delito', responsable: 'Dirección General', plazo: 'Inmediato' },
          { id: 'K-1', fase: 'Seguimiento', accion: 'Primer seguimiento: 7 días hábiles; segundo: 30 días hábiles', responsable: 'Encargado de Convivencia', plazo: '7 y 30 días hábiles' },
          { id: 'C-2', fase: 'Cierre', accion: 'Emitir Informe de Cierre (Anexo 8) cuando se cumplen objetivos de intervención y hay estabilidad', responsable: 'Convivencia / Dirección General', plazo: 'Final' }
        ]
      }
    }
  };

  const getCurso = (id) => state.cursos.find((c) => c.id === id);
  const getNivel = (id) => state.niveles.find((n) => n.id === id);
  const getCursosPorNivel = (nivelId) => state.cursos.filter((c) => c.nivel === nivelId).sort((a, b) => a.orden - b.orden);
  const getProtocolo = (id) => state.protocolos.find((p) => p.id === id);
  const getProtocolosPorCategoria = (catId) => state.protocolos.filter((p) => p.categoria === catId);
  const getTipoFalta = (id) => (state.tiposFalta || []).find((f) => f.id === id);
  const getTipoAnotacion = (id) => (state.tiposAnotacion || []).find((a) => a.id === id);
  const getCategoriaProtocolo = (id) => (state.categoriasProtocolo || []).find((c) => c.id === id);
  const getEstadoProtocolo = (id) => (state.estadosProtocolo || []).find((e) => e.id === id);
  const getEstadoCaso = (id) => (state.estadosCaso || []).find((e) => e.id === id);
  const getMotivoGrave = (id) => (state.motivosGraves || []).find((m) => m.id === id);
  const getAccionPrevia = (id) => (state.accionesPrevias || []).find((a) => a.id === id);
  const getTipoCaso = (id) => (state.tiposCaso || []).find((t) => t.id === id);
  const getCategoriaFuncionario = (id) => (state.categoriasFuncionario || []).find((c) => c.id === id);
  const getObligacionFuncionario = (id) => (state.obligacionesFuncionario || []).find((o) => o.id === id);
  const safe = (list, id, fallback) => {
    if (!Array.isArray(list)) return fallback;
    return list.find((item) => item.id === id) || fallback;
  };

  return {
    ...state,
    getCurso,
    getNivel,
    getCursosPorNivel,
    getProtocolo,
    getProtocolosPorCategoria,
    getTipoFalta,
    getTipoAnotacion,
    getCategoriaProtocolo,
    getEstadoProtocolo,
    getEstadoCaso,
    getMotivoGrave,
    getAccionPrevia,
    getTipoCaso,
    getCategoriaFuncionario,
    getObligacionFuncionario,
    safe
  };
})();

window.DATA = DATA;
