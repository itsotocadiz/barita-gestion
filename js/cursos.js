/* ================================================================
   cursos.js — Módulo de Cursos
   Listado de cursos agrupados por nivel y lista de estudiantes.
   ================================================================ */

(() => {
const CursosView = {
  renderList(container) {
    App.setBreadcrumb(`Cursos ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('cursos'):''}`);
    
    console.log("CursosView.renderList - CACHE:", Storage.cache.estudiantes);
    const estudiantes = Storage.getEstudiantes().filter(e => e.activo !== false);
    console.log("CursosView.renderList - filtrados por getEstudiantes:", estudiantes);
    
    let html = '<div class="cursos-container flex-col gap-4">';
    
    DATA.niveles.forEach(nivel => {
      const cursosNivel = DATA.getCursosPorNivel(nivel.id);
      const totalEstudiantesNivel = estudiantes.filter(e => {
        const c = DATA.getCurso(e.curso);
        return c && c.nivel === nivel.id;
      }).length;
      
      html += `
        <details class="nivel-section mb-4 card" style="border-left: 4px solid ${nivel.color}; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px;">
          <summary style="cursor: pointer; padding: 1rem 1.5rem; font-size: 1.25rem; font-weight: 600; background: #f8fafc; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; user-select: none;">
            <span style="color: ${nivel.color};">${nivel.nombre} <small style="font-size: 0.85rem; font-weight: normal; color: var(--text-secondary);">(${totalEstudiantesNivel} estudiantes)</small></span>
            <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: normal;">▼ Desplegar</span>
          </summary>
          <div style="padding: 1.5rem;">
            <div class="cursos-grid">
      `;
      
      cursosNivel.forEach(curso => {
        const numEstudiantes = estudiantes.filter(e => e.curso === curso.id).length;
        
        html += `
          <div class="curso-card" onclick="window.location.hash='#/cursos/${curso.id}'" style="border-top-color: ${nivel.color}">
            <div class="flex justify-between items-center mb-2">
              <h3 style="margin: 0; font-size: 1.25rem;">${curso.nombre}</h3>
            </div>
            <div class="flex justify-between mt-4 text-muted">
              <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${Icons.get('users', 16)} ${numEstudiantes} estudiantes</span>
              <span>Ver curso →</span>
            </div>
          </div>
        `;
      });
      
      html += `
            </div>
          </div>
        </details>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  },
  
  renderCurso(container, cursoId) {
    const curso = DATA.getCurso(cursoId);
    if (!curso) {
      container.innerHTML = '<div class="card"><div class="card-body"><h2 class="card-title">Curso no encontrado</h2><p class="text-muted">Redirigiendo al listado...</p></div></div>';
      setTimeout(() => { window.location.hash = '#/cursos'; }, 1500);
      return;
    }
    
    const nivel = DATA.getNivel(curso.nivel);
    App.setBreadcrumb(`<a href="#/cursos">Cursos</a> / ${curso.nombre}`);
    
    const estudiantes = Storage.getEstudiantesByCurso(cursoId).sort((a, b) => {
      const nombreA = a.apellidos + ' ' + a.nombres;
      const nombreB = b.apellidos + ' ' + b.nombres;
      return nombreA.localeCompare(nombreB);
    });
    
    let html = `
      <div class="card mb-4">
        <div class="card-header flex justify-between items-center">
            <div>
              <h2 class="card-title" style="color: ${nivel.color}; font-size: 1.5rem; margin:0;">${curso.nombre}</h2>
              <span class="text-muted" style="font-size: 0.875rem;">${nivel.nombre} • ${estudiantes.length} Estudiantes</span>
            </div>
            ${Auth.canWriteEstudiantes() ? `
            <div class="flex gap-2">
              <button class="btn btn-secondary" onclick="CursosView.abrirModalImportacion('${cursoId}')">
                📥 Importar Excel
              </button>
              <button class="btn btn-primary" onclick="CursosView.nuevoEstudiante('${cursoId}')">
                + Añadir Estudiante
              </button>
            </div>
            ` : ''}
          </div>
      </div>
      
      <div class="card">
        ${estudiantes.length === 0 ? 
          '<div class="text-center py-4 text-muted">No hay estudiantes registrados en este curso.</div>' :
          `
          <div style="padding: 0.85rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; gap: 0.6rem; align-items: center; background: #f8fafc;">
            <span style="display: inline-flex; align-items: center; justify-content: center; color: #64748b;">${Icons.get('search', 16)}</span>
            <input type="text" id="buscador-estudiantes" placeholder="Buscar estudiante por nombre, apellidos o RUT..." style="flex: 1; padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.88rem; outline: none; transition: border-color 0.2s; box-sizing: border-box;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'" onkeyup="CursosView.filtrarEstudiantes(this.value)">
          </div>
          <div class="table-responsive">
            <table class="table" id="tabla-estudiantes">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Apellidos, Nombres</th>
                  <th>RUT</th>
                  <th>Apoderado</th>
                  <th>Alertas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${estudiantes.map((est, index) => {
                  const anotaciones = Storage.getAnotacionesByEstudiante(est.id);
                  const numGraves = anotaciones.filter(a => a.categoriaFalta === 'grave' || a.categoriaFalta === 'gravisima').length;
                  const protocolos = Storage.getProtocolosByEstudiante(est.id).filter(p => p.estado !== 'cerrado');
                  
                  let alertasHtml = '';
                  if (numGraves > 0) alertasHtml += `<span class="badge" style="background: var(--danger); color: white;" title="${numGraves} faltas graves/gravísimas">${numGraves} Faltas</span> `;
                  if (protocolos.length > 0) alertasHtml += `<span class="badge" style="background: var(--warning); color: #000;" title="${protocolos.length} protocolos activos">${protocolos.length} Prot.</span>`;
                  if (!alertasHtml) alertasHtml = '<span class="text-muted">-</span>';
                  
                  return `
                    <tr>
                      <td style="width: 50px;">${index + 1}</td>
                      <td style="font-weight: 500;">
                        <a href="#/estudiantes/${est.id}" style="color: var(--text-primary); text-decoration: underline;">
                          ${est.apellidos}, ${est.nombres}
                        </a>
                      </td>
                      <td>${est.rut || '-'}</td>
                      <td>${est.apoderado && typeof est.apoderado === 'object' ? est.apoderado.nombre : (est.apoderado || '-')}</td>
                      <td>${alertasHtml}</td>
                      <td style="width: 160px;">
                        <div class="flex gap-2">
                          <a href="#/estudiantes/${est.id}" class="btn btn-sm btn-secondary inline-flex items-center gap-1">
                            ${Icons.get('external-link', 14)} Abrir Ficha
                          </a>
                          ${Auth.canWriteEstudiantes() ? `
                          <button class="btn btn-sm btn-secondary text-danger inline-flex items-center" onclick="EstudiantesView.eliminar('${est.id}')" title="Eliminar estudiante">
                            ${Icons.get('trash-2', 14)}
                          </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>`
        }
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  nuevoEstudiante(cursoId) {
    const curso = DATA.getCurso(cursoId);
    
    const html = `
      <form id="form-estudiante" onsubmit="event.preventDefault(); CursosView.guardarEstudiante('${cursoId}')">
        <div class="form-group">
          <label class="form-label">Nombres *</label>
          <input type="text" id="est-nombres" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Apellidos *</label>
          <input type="text" id="est-apellidos" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">RUT * (Sin puntos, ej: 12345678-9)</label>
          <input type="text" id="est-rut" class="form-control" placeholder="12345678-9" required autocomplete="off">
          <div id="est-rut-feedback" class="mt-1"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Curso Asignado *</label>
          <input type="text" class="form-control" value="${curso.nombre}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento *</label>
          <input type="date" id="est-fecha-nacimiento" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre del Apoderado</label>
          <input type="text" id="est-apoderado" class="form-control" placeholder="Ej. Juan Pérez (Opcional)">
        </div>
      </form>
    `;
    
    const footerHtml = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="document.getElementById('form-estudiante').requestSubmit()">Guardar</button>
    `;
    
    App.openModal(`Nuevo Estudiante en ${curso.nombre}`, html, footerHtml);
    setTimeout(() => {
      Validator.attachRutInputHandler('est-rut', 'est-rut-feedback');
    }, 50);
  },
  
  async guardarEstudiante(cursoId) {
    const rawRut = document.getElementById('est-rut').value;
    const formattedRut = Validator.formatRutWithoutDots(rawRut);
    if (!Validator.isValidRut(formattedRut)) {
      App.showToast('El RUT ingresado no es válido (ejemplo correcto: 12345678-5).', 'error');
      return;
    }

    const existe = (Storage.getEstudiantes() || []).some(e => e.rut === formattedRut);
    if (existe) {
      App.showToast('El RUT ingresado ya se encuentra registrado para otro estudiante.', 'danger');
      return;
    }

    const estudiante = {
      nombres: document.getElementById('est-nombres').value,
      apellidos: document.getElementById('est-apellidos').value,
      rut: formattedRut,
      fechaNacimiento: document.getElementById('est-fecha-nacimiento').value,
      curso: cursoId,
      apoderado: document.getElementById('est-apoderado').value.trim(),
      telefono: "",
      email: ""
    };
    
    await Storage.saveEstudiante(estudiante);
    App.closeModal();
    App.showToast('Estudiante guardado correctamente', 'success');
    
    // Refresh view
    this.renderCurso(document.getElementById('app-content'), cursoId);
  },

  descargarPlantillaImportacion(cursoNombre = 'Curso') {
    const data = [
      ["Nombres", "Apellidos", "RUT", "Fecha de Nacimiento", "Nombre del Apoderado"],
      ["Juan Carlos", "Pérez Soto", "12345678-9", "2012-05-15", "María Soto González"],
      ["Camila Andrea", "Gómez Rojas", "23456789-0", "2012-08-20", "Carlos Gómez Morales"]
    ];

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");
      XLSX.writeFile(wb, `Plantilla_Importacion_Estudiantes_${cursoNombre.replace(/\s+/g, '_')}.xlsx`);
    } else {
      const csvStr = "\ufeff" + data.map(e => e.join(";")).join("\n");
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Plantilla_Importacion_Estudiantes_${cursoNombre.replace(/\s+/g, '_')}.csv`;
      a.click();
    }
  },

  abrirModalImportacion(cursoId) {
    const curso = DATA.getCurso(cursoId);
    const cursoNombre = curso ? curso.nombre : 'Curso';
    
    const html = `
      <div class="alert alert-info">
        <p class="mb-2">Sube una planilla de Excel (.xlsx) o CSV con la lista de estudiantes para este curso. El archivo debe contener los siguientes encabezados en la primera fila:</p>
        <ul class="mt-2 mb-2 text-xs" style="padding-left: 1.2rem;">
          <li><strong>Nombres</strong> (Obligatorio)</li>
          <li><strong>Apellidos</strong> (Obligatorio)</li>
          <li><strong>RUT</strong> (Sin puntos, ej: <code>12345678-9</code>)</li>
          <li><strong>Fecha de Nacimiento</strong> (Formato: <code>AAAA-MM-DD</code> o <code>DD/MM/AAAA</code>)</li>
          <li><strong>Nombre del Apoderado</strong> (Opcional)</li>
        </ul>
        <div class="mt-3">
          <button type="button" onclick="CursosView.descargarPlantillaImportacion('${cursoNombre}')" class="btn btn-sm btn-secondary">
            📊 Descargar Plantilla Modelo (Excel / CSV)
          </button>
        </div>
      </div>
      
      <div class="form-group mt-3">
        <label class="form-label font-semibold">Seleccionar Archivo (Excel o CSV) *</label>
        <input type="file" id="archivo-importacion" class="form-control" accept=".xlsx, .xls, .csv">
      </div>
    `;
    
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button id="btn-importar-estudiantes" class="btn btn-primary" onclick="CursosView.procesarImportacion('${cursoId}')">📥 Importar Estudiantes</button>
    `;
    
    App.openModal(`Importar Estudiantes a ${cursoNombre}`, html, footer);
  },

  procesarImportacion(cursoId) {
    const input = document.getElementById('archivo-importacion');
    if (!input || !input.files || input.files.length === 0) {
      App.showToast('Por favor selecciona un archivo de Excel o CSV.', 'danger');
      return;
    }
    
    const btn = document.getElementById('btn-importar-estudiantes');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Importando...';
    }

    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON
        const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        
        let agregados = 0;
        let duplicados = 0;
        
        for (const row of json) {
          // Normalizar las llaves (sin acentos, minúsculas, remover caracteres no alfanuméricos)
          const normalizedRow = {};
          const keysList = [];
          for (let key in row) {
            const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            normalizedRow[cleanKey] = String(row[key] || '').trim();
            keysList.push({ orig: key, clean: cleanKey, val: String(row[key] || '').trim() });
          }
          
          let nombres = '';
          let apellidos = '';
          let rut = '';
          let fechaNac = '';
          let apoderado = '';

          // Búsqueda por coincidencia de palabras clave en la clave limpia
          for (const item of keysList) {
            const k = item.clean;
            const v = item.val;
            if (!v) continue;

            if (!nombres && (k.includes('nombre') || k.includes('nombres')) && !k.includes('apoderado') && !k.includes('tutor') && !k.includes('apellido')) {
              nombres = v;
            } else if (!apellidos && (k.includes('apellido') || k.includes('apellidos'))) {
              apellidos = v;
            } else if (!rut && (k.includes('rut') || k.includes('run'))) {
              rut = v;
            } else if (!fechaNac && (k.includes('fecha') || k.includes('nacimiento') || k.includes('cumplean') || k.includes('fnac'))) {
              fechaNac = v;
            } else if (!apoderado && (k.includes('apoderado') || k.includes('tutor') || k.includes('responsable'))) {
              apoderado = v;
            }
          }

          // Fallback por posición SOLO si hay al menos 5 columnas bien estructuradas
          if (!nombres && keysList.length > 0) nombres = keysList[0].val;
          if (!apellidos && keysList.length > 1) apellidos = keysList[1].val;
          if (!rut && keysList.length > 2) rut = keysList[2].val;
          if (!fechaNac && keysList.length > 3 && keysList[3].val && keysList[3].val !== rut && keysList[3].val !== nombres) fechaNac = keysList[3].val;
          if (!apoderado && keysList.length > 4 && keysList[4].val && keysList[4].val !== rut && keysList[4].val !== nombres) apoderado = keysList[4].val;

          // Si la fecha de nacimiento viene en formato dd-mm-yyyy o dd/mm/yyyy o dd.mm.yyyy, convertir a yyyy-mm-dd
          if (fechaNac && typeof fechaNac === 'string') {
            const parts = fechaNac.split(/[-/.]/);
            if (parts.length === 3) {
              if (parts[0].length === 2 && parts[2].length === 4) {
                // dd-mm-yyyy -> yyyy-mm-dd
                fechaNac = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          // Formatear RUT sin puntos
          if (rut && typeof Validator !== 'undefined' && Validator.formatRutWithoutDots) {
            rut = Validator.formatRutWithoutDots(rut);
          }

          if (nombres || apellidos) {
            const nomFinal = (nombres || '').toString().trim();
            const apeFinal = (apellidos || '').toString().trim();

            if (!nomFinal && !apeFinal) continue;

            // Verificar si RUT ya existe para evitar duplicados masivos
            if (rut) {
              const existeRut = (Storage.getEstudiantes() || []).some(e => e.rut === rut);
              if (existeRut) {
                duplicados++;
                continue;
              }
            }

            const nuevoEst = {
              nombres: nomFinal || 'Estudiante',
              apellidos: apeFinal || 'Sin Apellido',
              rut: rut,
              fechaCumpleanos: fechaNac || null,
              fechaNacimiento: fechaNac || null,
              fecha_nacimiento: fechaNac || null,
              apoderado: apoderado || null,
              curso: cursoId,
              fechaIngreso: new Date().toISOString(),
              enSeguimiento: false,
              esComplejo: false,
              requiereApoyoPsicosocial: false,
              planUtpActivo: false,
              medidasPie: false,
              activo: true
            };
            await Storage.saveEstudiante(nuevoEst);
            agregados++;
          }
        }
        
        App.closeModal();
        if (agregados > 0) {
          let msg = `Se importaron ${agregados} estudiantes correctamente.`;
          if (duplicados > 0) msg += ` (${duplicados} omitidos por RUT ya existente).`;
          App.showToast(msg, 'success');
          this.renderCurso(document.getElementById('app-content'), cursoId);
        } else {
          App.showToast('No se encontraron estudiantes válidos en el archivo. Verifica los encabezados (Nombres, Apellidos, RUT, Fecha de Nacimiento).', 'warning');
        }
        
      } catch (err) {
        console.error('Error procesando importación:', err);
        App.showToast('Error al leer el archivo. Asegúrate de que sea un Excel o CSV válido.', 'danger');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '📥 Importar Estudiantes';
        }
      }
    };
    
    reader.onerror = () => {
      console.error('Error al leer el archivo');
      App.showToast('Error de lectura del archivo.', 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📥 Importar Estudiantes';
      }
    };
    
    reader.readAsArrayBuffer(file);
  },

  filtrarEstudiantes(value) {
    const q = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const rows = document.querySelectorAll('#tabla-estudiantes tbody tr');
    rows.forEach(row => {
      const nombre = (row.querySelector('td:nth-child(2)')?.textContent || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const rut = (row.querySelector('td:nth-child(3)')?.textContent || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (nombre.includes(q) || rut.includes(q)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }
};
window.CursosView = CursosView;
})();
