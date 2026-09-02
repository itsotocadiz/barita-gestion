window.injectMock2026 = async function() {
  if (typeof Storage === 'undefined' || typeof DATA === 'undefined') {
    App.showToast('Sistema no inicializado completamente.', 'danger');
    return;
  }

  const currentYear = Storage.getActiveYear();
  const activeSchool = (Storage.activeSchool || 'demo').toString().trim();

  App.showConfirm('Confirmar', `Esto ELIMINARÁ todos los datos actuales del año ${currentYear} en la Escuela DEMO y cargará 2 estudiantes por curso + 3 funcionarios de prueba. ¿Estás seguro?`, async () => {
    try {
      let hadError = false;
      const collections = ['estudiantes', 'funcionarios', 'casos', 'anotaciones'];
      for (const col of collections) {
        try {
          const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseGestion;
          const { data: rows } = await client.from(col).select('id,colegio_id');
          if (!rows) continue;
          const ids = rows
            .filter(r => ((r.colegioId || r.colegio_id || 'demo').toString().trim() === activeSchool) && (col === 'funcionarios' || r.anio === currentYear || !r.anio))
            .map(r => r.id);
          if (!ids.length) continue;
          const { error } = await client.from(col).delete().in('id', ids);
          if (error) throw error;
        } catch (err) {
          console.warn('No se pudo vaciar la colección ' + col + ' por permisos: ' + (err.message || err));
        }
      }

      const nombresFunc = ['María','José','Ana','Luis','Carmen','Carlos','Marta','Jorge'];
      const apellidosFunc = ['Silva','Rojas','Soto','Contreras','Sepúlveda','Morales','Pérez','González'];
      const roles = ['director','profesor','utp'];

      // Generar exactamente 2 funcionarios de prueba - RUT válido módulo11 (rango reservado 99.x)
      const dv = (num) => { let s=0,m=2; for(let i=String(num).length-1;i>=0;i--){ s+=parseInt(String(num)[i])*m; m=m===7?2:m+1; } let r=11-(s%11); return r===11?'0':r===10?'K':String(r); };
      for (let i = 0; i < 2; i++) {
        const nombre = nombresFunc[i % nombresFunc.length];
        const apellido1 = apellidosFunc[i % apellidosFunc.length];
        const apellido2 = apellidosFunc[(i + 1) % apellidosFunc.length];
        const baseRut = 99000000 + i;

        const f = {
          id: `mock_func_${activeSchool}_${i}`,
          rut: `99.000.00${i}-${dv(baseRut)}`,
          nombres: nombre,
          apellidos: `${apellido1} ${apellido2}`,
          email: `${nombre.toLowerCase()}.${apellido1.toLowerCase()}@colegiodemo.cl`,
          telefono: '+569' + Math.floor(10000000 + Math.random() * 90000000),
          cargo: roles[i],
          obligaciones: [],
          colegioId: activeSchool,
          colegio_id: activeSchool
        };
        // Inserción directa en caché de funcionarios
        if (typeof Storage !== 'undefined') {
          if (!Storage.cache.funcionarios) Storage.cache.funcionarios = [];
          const idxF = Storage.cache.funcionarios.findIndex(fn => fn.id === f.id);
          if (idxF >= 0) Storage.cache.funcionarios[idxF] = f;
          else Storage.cache.funcionarios.push(f);

          if (!Storage.localMutations) Storage.localMutations = {};
          if (!Storage.localMutations.funcionarios) Storage.localMutations.funcionarios = {};
          Storage.localMutations.funcionarios[f.id] = JSON.parse(JSON.stringify(f));
          Storage.persistLocalMutations();
        }

        try { 
          const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseGestion;
          const { error } = await client.from('funcionarios').upsert(Storage.injectColegioId(f)); 
          if(error) { console.error("Error upsert funcionario:", error); hadError = true; }
        } catch (_e) { console.error(_e); hadError = true; }
      }

      const nombresEst = ['Sofía','Agustín','Isabella','Benjamín','Emilia','Vicente','Martina','Mateo'];
      let estCount = 0;

      // Generar 2 estudiantes de prueba por curso para DEMO
      for (const curso of DATA.cursos) {
        for (let i = 0; i < 2; i++) {
          estCount++;
          const nombre = nombresEst[(estCount + i) % nombresEst.length];
          const apellido1 = apellidosFunc[estCount % apellidosFunc.length];
          const apellido2 = apellidosFunc[(estCount + 2) % apellidosFunc.length];

          const baseEst = 99100000 + estCount*2 + i;
          const est = {
            id: `mock_est_${activeSchool}_${curso.id}_${i}`,
            rut: `99.${String(baseEst).slice(2,5)}.${String(baseEst).slice(5,8)}-${dv(baseEst)}`,
            nombres: nombre,
            apellidos: `${apellido1} ${apellido2}`,
            curso: curso.id,
            estado: 'regular',
            fechaNacimiento: (()=>{ const orden=curso.orden||7; const año = orden<=6? (2021-Math.floor(Math.random()*1)) : (2012+Math.floor(Math.random()*2)); const mes=String(1+Math.floor(Math.random()*12)).padStart(2,'0'); const dia=String(1+Math.floor(Math.random()*28)).padStart(2,'0'); return `${año}-${mes}-${dia}`; })(),
            direccion: '',
            apoderado: {
              nombre: `Apoderado ${apellido1}`,
              parentesco: 'Apoderado Titular',
              telefono: '',
              email: ''
            },
            pise: {},
            pie: {},
            anio: currentYear,
            colegioId: activeSchool,
            colegio_id: activeSchool
          };

          // Inserción directa en caché de memoria y mutaciones locales (independiente del rol)
          if (typeof Storage !== 'undefined') {
            if (!Storage.cache.estudiantes) Storage.cache.estudiantes = [];
            const idx = Storage.cache.estudiantes.findIndex(e => e.id === est.id);
            if (idx >= 0) Storage.cache.estudiantes[idx] = est;
            else Storage.cache.estudiantes.push(est);

            if (!Storage.localMutations) Storage.localMutations = {};
            if (!Storage.localMutations.estudiantes) Storage.localMutations.estudiantes = {};
            Storage.localMutations.estudiantes[est.id] = JSON.parse(JSON.stringify(est));
            Storage.persistLocalMutations();
          }

          try {
            const payload = Storage.prepareEstudiantePayload ? Storage.prepareEstudiantePayload(est) : Storage.injectColegioId(est);
            const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseGestion;
            const { error } = await client.from('estudiantes').upsert(payload, { onConflict: 'id' });
            if (error) { console.error("Error upsert estudiante:", error, payload); hadError = true; }
          } catch (_e) { console.error(_e); hadError = true; }
        }
      }

      if (hadError) {
        App.showToast(`Ocurrieron errores al inyectar los datos en la base de datos (revisa la consola F12). No se recargará la página.`, 'danger');
      } else {
        App.showToast(`¡Éxito! Se han inyectado funcionarios y ${estCount} estudiantes de prueba. Revisa la consola F12.`, 'success');
        console.log("CACHE ACTUAL:", Storage.cache.estudiantes);
        
        // Diagnóstico: Verificar si Supabase guardó los estudiantes
        const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseGestion;
        const { data: dbEstudiantes, error: dbErr } = await client.from('estudiantes').select('*').eq('colegio_id', activeSchool);
        console.log("DIAGNÓSTICO SUPABASE - Estudiantes encontrados en DB:", dbEstudiantes?.length, "Error:", dbErr);
        console.log("Muestra del primer estudiante en DB:", dbEstudiantes?.[0]);
      }
    } catch (error) {
      App.showToast('Error al procesar la base de datos: ' + (error.message || error), 'danger');
    }
  });
};

window.limpiarEstudiantesColegioActivo = async function() {
  const activeSchool = (Storage.activeSchool || 'demo').toString().trim();
  App.showConfirm('⚠️ ELIMINAR ESTUDIANTES Y SU HISTORIAL', `ADVERTENCIA CRÍTICA: Esto ELIMINARÁ de forma permanente a TODOS los estudiantes de ${activeSchool.toUpperCase()} y TODO su historial asociado (anotaciones, asistencia, casos, eventos, etc.). Los funcionarios se mantendrán intactos. Esta acción NO se puede deshacer. ¿Deseas continuar?`, async () => {
    try {
      const client = window.getSupabaseClient();
      let dbErrors = [];
      if (client) {
        const tablasDependientes = [
          'casos', 'anotaciones', 'eventos', 'acciones', 'asistencia_diaria',
          'asistencia_atrasos', 'atrasos', 'inasistencias', 'justificativos',
          'clima_laboral', 'eventos_agenda', 'derivaciones', 'alertas_utp',
          'alertas_inspectoria', 'protocolos_activos', 'notas_colaborativas', 'nota_comentarios'
        ];
        
        App.showToast('Borrando datos asociados (anotaciones, casos, etc)...', 'info');
        for (const tabla of tablasDependientes) {
          try {
            const r1 = await client.from(tabla).delete().eq('colegio_id', activeSchool).neq('id', 'imposible_id_9999');
            if (r1.error) dbErrors.push(`${tabla}(colegio_id): ${r1.error.message}`);
            const r2 = await client.from(tabla).delete().eq('colegioId', activeSchool).neq('id', 'imposible_id_9999');
            if (r2.error && !r2.error.message?.includes('column')) dbErrors.push(`${tabla}(colegioId): ${r2.error.message}`);
          } catch (e) {
            console.warn(`No se pudo limpiar ${tabla}:`, e);
          }
        }

        App.showToast('Borrando estudiantes de la base de datos...', 'info');
        // Strategy 1: Delete by colegio_id
        const del1 = await client.from('estudiantes').delete().eq('colegio_id', activeSchool);
        if (del1.error) dbErrors.push(`estudiantes(colegio_id): ${del1.error.message}`);

        // Strategy 2: Delete mock students by ID prefix pattern (mock_est_{school}_)
        const mockPrefix = `mock_est_${activeSchool}_`;
        const { data: mockStudents } = await client.from('estudiantes').select('id').like('id', `${mockPrefix}%`);
        if (mockStudents && mockStudents.length > 0) {
          console.log(`Encontrados ${mockStudents.length} estudiantes mock por prefijo, eliminando...`);
          for (const s of mockStudents) {
            await client.from('estudiantes').delete().eq('id', s.id);
          }
        }

        // Strategy 3: Verify deletion — if students remain, report
        const { data: remaining } = await client.from('estudiantes').select('id, colegio_id').eq('colegio_id', activeSchool);
        if (remaining && remaining.length > 0) {
          console.warn(`⚠️ Aún quedan ${remaining.length} estudiantes en Supabase para ${activeSchool}. Posible bloqueo de RLS.`);
          dbErrors.push(`Aún quedan ${remaining.length} estudiantes. Es posible que la política de seguridad (RLS) esté bloqueando el borrado.`);
        }

        if (dbErrors.length > 0) {
          console.error('Errores durante limpieza:', dbErrors);
          App.showToast(`⚠️ Algunos datos no se pudieron borrar de la base de datos: ${dbErrors[0]}`, 'warning');
        }
      }

      // Always clear local cache regardless of DB result
      Storage.cache.estudiantes = [];
      ['casos', 'anotaciones', 'eventos', 'acciones', 'asistencia_diaria', 'notas_colaborativas'].forEach(col => {
          Storage.cache[col] = [];
      });
      if (Storage.localMutations) {
        Storage.localMutations.estudiantes = {};
        Storage.localMutations.anotaciones = {};
        Storage.localMutations.casos = {};
        Storage.localMutations.eventos = {};
        Storage.localMutations.acciones = {};
        Storage.persistLocalMutations();
      }
      // Clear notas from localStorage
      try { localStorage.removeItem('barita_notas_colaborativas'); } catch (_e) {}
      try { localStorage.removeItem('barita_nota_comentarios'); } catch (_e) {}

      App.showToast('Limpieza completada. Recarga la página (F5) para confirmar.', 'success');
      if (typeof AdminLocalView !== 'undefined' && window.location.hash.includes('admin')) {
        AdminLocalView.render(document.getElementById('app-content'));
      }
    } catch (err) {
      App.showToast('Error al limpiar estudiantes: ' + err.message, 'danger');
    }
  });
};

window.vaciarBaseDeDatos = async function() {
  App.showConfirm('⚠️ REINICIAR HISTORIAL DE ACTIVIDAD', `ADVERTENCIA CRÍTICA: Esto ELIMINARÁ TODO EL HISTORIAL de actividad (anotaciones, asistencias, atrasos, justificativos, casos, protocolos, etc.) de TODOS los estudiantes. Sus fichas personales y las de los funcionarios quedarán intactas (útil para iniciar un nuevo año). Esta acción NO se puede deshacer. ¿Deseas proceder?`, async () => {
    App.showToast('Iniciando limpieza de datos de prueba...', 'info');

    try {
      if (typeof Storage !== 'undefined' && Storage.limpiezaGeneralPruebas) {
        await Storage.limpiezaGeneralPruebas();
      }

      const client = window.getSupabaseClient();
      if (client) {
        const tablas = [
          'casos',
          'anotaciones',
          'eventos',
          'acciones',
          'asistencia_diaria',
          'asistencia_atrasos',
          'atrasos',
          'inasistencias',
          'justificativos',
          'clima_laboral',
          'eventos_agenda',
          'derivaciones',
          'alertas_utp',
          'alertas_inspectoria',
          'protocolos_activos',
          'notas_colaborativas',
          'nota_comentarios'
        ];

        const activeSchool = (Storage.activeSchool || 'demo').toString().trim();
        for (const tabla of tablas) {
          try {
            await client.from(tabla).delete().eq('colegio_id', activeSchool).neq('id', 'imposible_id_9999');
          } catch (errCol) {
            console.warn(`No se pudo vaciar la tabla ${tabla} para el colegio ${activeSchool}:`, errCol);
          }
        }
      }

      if (typeof AsistenciaView !== 'undefined') {
        AsistenciaView.atrasosCache = [];
        AsistenciaView.inasistenciasCache = [];
        AsistenciaView.isFetched = false;
      }

      // Clear notas from localStorage to prevent phantom dashboard notifications
      try { localStorage.removeItem('barita_notas_colaborativas'); } catch (_e) {}
      try { localStorage.removeItem('barita_nota_comentarios'); } catch (_e) {}

      App.showToast('¡Limpieza completada! Estudiantes y funcionarios conservados. Recarga (F5) para confirmar.', 'success');
      if (typeof AdminLocalView !== 'undefined' && window.location.hash.includes('admin')) {
        AdminLocalView.render(document.getElementById('app-content'));
      }
    } catch(e) {
      console.error(e);
      App.showToast('Error al vaciar la base de datos: ' + e.message, 'danger');
    }
  });
};
