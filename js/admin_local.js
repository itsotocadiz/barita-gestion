const AdminLocalView = {
  currentTab: 'usuarios', // 'usuarios' | 'promocion' | 'personalizacion' | 'configuracion' | 'mantenimiento'

  render(container) {
    App.setBreadcrumb('Panel de Control - Administración');

    container.innerHTML = `
      <div class="card mb-4" style="border-top: 4px solid var(--primary);">
        <div class="card-header flex justify-between items-center" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="margin:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('settings', 24)} Panel de Control y Administración</h2>
            <p class="text-secondary" style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">Configuración de usuarios, permisos, personalización de vistas y sistema.</p>
          </div>
          <div class="flex gap-2" style="flex-wrap: wrap;">
            <button class="btn ${this.currentTab === 'usuarios' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminLocalView.switchTab('usuarios')">
              ${Icons.get('users', 18)} Usuarios y Roles
            </button>
            <button class="btn ${this.currentTab === 'promocion' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminLocalView.switchTab('promocion')">
              ${Icons.get('graduation-cap', 18)} Promoción y Matrícula
            </button>
            <button class="btn ${this.currentTab === 'personalizacion' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminLocalView.switchTab('personalizacion')">
              ${Icons.get('palette', 18)} Personalización
            </button>
            <button class="btn ${this.currentTab === 'configuracion' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminLocalView.switchTab('configuracion')">
              ${Icons.get('target', 18)} Umbrales e IA
            </button>
            <button class="btn ${this.currentTab === 'mantenimiento' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminLocalView.switchTab('mantenimiento')">
              ${Icons.get('save', 18)} Mantenimiento
            </button>
          </div>
        </div>
      </div>

      <div id="admin-tab-content"></div>
    `;

    const tabContent = document.getElementById('admin-tab-content');
    if (!tabContent) return;

    if (this.currentTab === 'usuarios') {
      tabContent.innerHTML = this.renderTabUsuarios();
      this.loadUsers();
    } else if (this.currentTab === 'promocion') {
      tabContent.innerHTML = this.renderTabPromocion();
      setTimeout(() => this.inicializarTabPromocion(), 50);
    } else if (this.currentTab === 'personalizacion') {
      tabContent.innerHTML = this.renderTabPersonalizacion();
    } else if (this.currentTab === 'configuracion') {
      tabContent.innerHTML = this.renderTabConfiguracion();
      setTimeout(() => {
        this.loadRICEConfig();
        this.loadGlobalKey();
      }, 50);
    } else if (this.currentTab === 'mantenimiento') {
      tabContent.innerHTML = this.renderTabMantenimiento();
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('app-content'));
  },

  /* ─────────────────────────────────────────────────────────────
     PESTAÑA 1: USUARIOS Y ROLES
     ───────────────────────────────────────────────────────────── */
  renderTabUsuarios() {
    return `
      <div class="flex-col gap-4" style="max-width: 900px; margin: 0 auto;">
        
        <!-- Crear Nuevo Usuario -->
        <div class="card" style="padding: 1.5rem; border-top: 3px solid var(--primary);">
          <h3 style="margin-top:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('plus', 20)} Crear Nuevo Usuario</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Crea cuentas de acceso asociadas al colegio activo.</p>
          
          <form id="form-new-user" onsubmit="event.preventDefault(); AdminLocalView.crearUsuario()">
            <div class="grid grid-3 gap-3 items-end mb-3">
              <div class="form-group mb-0">
                <label class="form-label" style="font-weight:600;">Correo Electrónico</label>
                <input type="email" id="new-user-email" class="form-control" required placeholder="correo@ejemplo.com">
              </div>
              <div class="form-group mb-0">
                <label class="form-label" style="font-weight:600;">Contraseña temporal</label>
                <input type="text" id="new-user-password" class="form-control" required placeholder="Mínimo 6 caracteres">
              </div>
              <div class="form-group mb-0">
                <label class="form-label" style="font-weight:600;">Rol del Usuario</label>
                <select id="new-user-role" class="form-control" required>
                  <option value="admin">Admin</option>
                  <option value="coordinadora">Coordinadora</option>
                  <option value="directora">Directora</option>
                  <option value="profesor">Profesor</option>
                  <option value="utp">UTP</option>
                  <option value="PIE">PIE</option>
                  <option value="inspectoria">Inspectoría</option>
                  <option value="finanza">Finanzas</option>
                  <option value="convivencia">Convivencia</option>
                </select>
              </div>
            </div>
            <div style="text-align: right;">
              <button class="btn btn-primary" type="submit" style="padding: 0.6rem 1.5rem;">+ Crear Usuario</button>
            </div>
          </form>
        </div>

        <!-- Listado de Usuarios Registrados -->
        <div class="card" style="padding: 1.5rem; border-top: 3px solid var(--info);">
          <h3 style="margin-top:0; color: var(--text-primary);">👥 Gestión de Cuentas, Roles y Permisos</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Administra los privilegios de los usuarios registrados en la plataforma.</p>
          <div id="admin-users-list">
            <div class="text-center py-4 text-muted">Cargando usuarios...</div>
          </div>
        </div>

      </div>
    `;
  },

  /* ─────────────────────────────────────────────────────────────
     PESTAÑA 2: PERSONALIZACIÓN (LOGOS, MENÚS Y DASHBOARDS)
     ───────────────────────────────────────────────────────────── */
  renderTabPersonalizacion() {
    const schoolProfile = (typeof Storage !== 'undefined' && Storage.getSchoolProfile) ? Storage.getSchoolProfile() : { nombre: 'Escuela Demo', logo: '' };

    return `
      <div class="flex-col gap-4" style="max-width: 900px; margin: 0 auto;">
        
        <!-- Logo y Nombre de la Institución -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary);">
          <h3 style="margin-top:0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('school', 24)} Personalización de la Institución (Logo y Nombre)</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">El nombre y el logo configurados aquí se mostrarán en la esquina superior izquierda de la barra lateral.</p>
          
          <div class="grid grid-2 gap-4 items-start mb-3">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Nombre de la Escuela / Colegio</label>
              <input type="text" id="school-name-input" class="form-control" value="${(schoolProfile.nombre || '').replace(/"/g, '&quot;')}" placeholder="Ej: Colegio San Agustín">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Logo de la Institución</label>
              <div style="display: flex; gap: 1rem; align-items: center;">
                <div id="school-logo-preview" style="width: 56px; height: 56px; border-radius: 8px; border: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: center; background: #f8fafc; overflow: hidden;">
                  ${schoolProfile.logo ? `<img src="${schoolProfile.logo}" style="width:100%; height:100%; object-fit:contain;">` : `<span style="font-size: 1.5rem; display: inline-flex; align-items: center; justify-content: center; color: var(--text-secondary);">${Icons.get('school', 24)}</span>`}
                </div>
                <div style="flex: 1;">
                  <input type="file" id="school-logo-file" accept="image/*" class="form-control" onchange="AdminLocalView.handleLogoFileSelect(event)">
                  <small class="text-muted" style="display:block; margin-top: 0.25rem;">Formato JPG, PNG o SVG (se adapta automáticamente).</small>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 1rem; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <button type="button" class="btn btn-primary inline-flex items-center gap-1.5" onclick="AdminLocalView.saveSchoolProfile()">${Icons.get('save', 16)} Guardar Identidad de la Escuela</button>
          </div>
        </div>

        <!-- Editor de Menús (Sidebar) -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--warning);">
          <h3 style="margin-top:0">📋 Editor de Menús (Barra Lateral)</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Configura qué opciones del menú lateral visualiza cada perfil.</p>
          
          <div class="flex gap-4" style="align-items: flex-start;">
            <div style="flex: 1;">
              <label class="form-label" style="font-weight:600;">Seleccionar Perfil (Rol)</label>
              <select id="editor-menu-role-select" class="form-control" onchange="AdminLocalView.loadMenuEditor(this.value)">
                <option value="superadmin">Super Administrador (Acceso Total)</option>
                <option value="directora">Directora</option>
                <option value="inspectoria">Inspectoría</option>
                <option value="profesor">Profesor</option>
                <option value="admin">Administrador</option>
                <option value="utp">UTP</option>
                <option value="pie">PIE</option>
                <option value="convivencia">Convivencia</option>
                <option value="finanzas">Finanzas</option>
              </select>
            </div>
            
            <div style="flex: 2;">
              <label class="form-label" style="font-weight:600;">Módulos Habilitados</label>
              <div id="editor-menus-container" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; min-height: 100px; display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
                <!-- Se llena dinámicamente -->
              </div>
            </div>
          </div>
          
          <div style="margin-top: 1.5rem; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <button type="button" class="btn btn-warning" onclick="AdminLocalView.saveMenuEditor()">💾 Guardar Configuración de Menús</button>
          </div>
        </div>

        <!-- Configuración de Tipos de Eventos de Fiscalización Docente -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--warning);">
          <h3 style="margin-top:0; color: var(--primary);">⚙️ Tipos de Eventos de Fiscalización Docente</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Administra las opciones del desplegable "Registrar Fiscalización" y define si cada evento se vincula con el módulo UTP y el gráfico de resumen.</p>
          
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center;">
            <input type="text" id="nuevo-tipo-fiscalizacion-nombre" class="form-control" placeholder="Ej: No entrega planificación a tiempo" style="flex: 1;">
            <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap; cursor: pointer; user-select: none;">
              <input type="checkbox" id="nuevo-tipo-fiscalizacion-utp" style="width: 1.1rem; height: 1.1rem;"> Vincular con UTP
            </label>
            <button type="button" class="btn btn-primary" onclick="AdminLocalView.agregarTipoFiscalizacion()" style="white-space: nowrap;">+ Añadir Evento</button>
          </div>

          <div id="fiscalizacion-items-admin-container" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; max-height: 350px; overflow-y: auto;">
            ${(() => {
              const items = (typeof Storage !== 'undefined' && typeof Storage.getTiposFiscalizacion === 'function') ? Storage.getTiposFiscalizacion() : [];
              if (!items || items.length === 0) return '<p class="text-muted text-center m-0">No hay tipos de eventos configurados.</p>';
              return items.map((it) => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid var(--border-color); border-radius: 6px; padding: 0.6rem 0.85rem; margin-bottom: 0.5rem; gap: 1rem;">
                  <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                    <span style="font-weight: 600; color: var(--text-primary);">${Storage.safeHtml(it.nombre)}</span>
                    ${it.vincularUtp ? '<span class="badge" style="background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; font-size: 0.72rem;">🎓 Vinculado con UTP</span>' : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; margin: 0; color: var(--text-secondary);">
                      <input type="checkbox" ${it.vincularUtp ? 'checked' : ''} onchange="AdminLocalView.toggleUtpFiscalizacion('${it.id}', this.checked)"> Vincular UTP
                    </label>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="AdminLocalView.editarTipoFiscalizacion('${it.id}')" title="Editar nombre">✏️ Editar</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="AdminLocalView.eliminarTipoFiscalizacion('${it.id}')" title="Eliminar evento">🗑️ Eliminar</button>
                  </div>
                </div>
              `).join('');
            })()}
          </div>
        </div>

        <!-- Configuración de Inducción Institucional -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--info);">
          <h3 style="margin-top:0; color: var(--primary);">📋 Configuración de Inducción Institucional</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Administra la lista de ítems obligatorios que deben completar los funcionarios durante su proceso de inducción.</p>
          
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <input type="text" id="nuevo-item-induccion-nombre" class="form-control" placeholder="Ej: Entrega de Plan de Aula o Protocolo RICE">
            <button type="button" class="btn btn-primary" onclick="AdminLocalView.agregarItemInduccion()" style="white-space: nowrap;">+ Añadir Ítem</button>
          </div>

          <div id="induccion-items-admin-container" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; max-height: 300px; overflow-y: auto;">
            ${(() => {
              const items = (typeof Storage !== 'undefined' && typeof Storage.getInduccionChecklist === 'function') ? Storage.getInduccionChecklist() : [];
              if (!items || items.length === 0) return '<p class="text-muted text-center m-0">No hay ítems configurados para la inducción.</p>';
              return items.map((it, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid var(--border-color); border-radius: 6px; padding: 0.6rem 0.85rem; margin-bottom: 0.5rem;">
                  <span style="font-weight: 600; color: var(--text-primary);">${Storage.safeHtml(it.label)}</span>
                  <div style="display: flex; gap: 0.35rem;">
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="AdminLocalView.editarItemInduccion('${it.id}')" title="Editar nombre">✏️ Editar</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="AdminLocalView.eliminarItemInduccion('${it.id}')" title="Eliminar ítem">🗑️ Eliminar</button>
                  </div>
                </div>
              `).join('');
            })()}
          </div>
        </div>

      </div>
    `;
  },

  async agregarTipoFiscalizacion() {
    const input = document.getElementById('nuevo-tipo-fiscalizacion-nombre');
    const chkUtp = document.getElementById('nuevo-tipo-fiscalizacion-utp');
    const val = input ? input.value.trim() : '';
    if (!val) {
      App.showToast('Ingresa un nombre para el evento de fiscalización', 'warning');
      return;
    }
    const items = Storage.getTiposFiscalizacion();
    const newId = 'fisc_' + Date.now();
    items.push({ id: newId, nombre: val, vincularUtp: !!(chkUtp && chkUtp.checked) });
    const success = await Storage.saveTiposFiscalizacion(items);
    if (success) {
      App.showToast('Evento de fiscalización agregado correctamente', 'success');
      this.render(document.getElementById('app-content'));
    }
  },

  async toggleUtpFiscalizacion(id, checked) {
    const items = Storage.getTiposFiscalizacion();
    const target = items.find(it => String(it.id) === String(id));
    if (!target) return;
    target.vincularUtp = !!checked;
    const success = await Storage.saveTiposFiscalizacion(items);
    if (success) {
      App.showToast(`Vinculación con UTP ${checked ? 'activada' : 'desactivada'}`, 'info');
      this.render(document.getElementById('app-content'));
    }
  },

  async editarTipoFiscalizacion(id) {
    const items = Storage.getTiposFiscalizacion();
    const target = items.find(it => String(it.id) === String(id));
    if (!target) return;
    const nuevoNombre = prompt('Editar nombre del evento de fiscalización:', target.nombre);
    if (nuevoNombre && nuevoNombre.trim()) {
      target.nombre = nuevoNombre.trim();
      const success = await Storage.saveTiposFiscalizacion(items);
      if (success) {
        App.showToast('Evento de fiscalización actualizado', 'success');
        this.render(document.getElementById('app-content'));
      }
    }
  },

  async eliminarTipoFiscalizacion(id) {
    const items = Storage.getTiposFiscalizacion();
    const filtrados = items.filter(it => String(it.id) !== String(id));
    if (filtrados.length === items.length) return;
    App.showConfirm('Confirmar eliminación', '¿Está seguro de eliminar este evento de fiscalización?', async () => {
      const success = await Storage.saveTiposFiscalizacion(filtrados);
      if (success) {
        App.showToast('Evento de fiscalización eliminado', 'info');
        this.render(document.getElementById('app-content'));
      }
    });
  },

  async agregarItemInduccion() {
    const input = document.getElementById('nuevo-item-induccion-nombre');
    const val = input ? input.value.trim() : '';
    if (!val) {
      App.showToast('Ingresa un nombre para el ítem de inducción', 'warning');
      return;
    }
    const items = Storage.getInduccionChecklist();
    const newId = 'ind_' + Date.now();
    items.push({ id: newId, label: val });
    const success = await Storage.saveInduccionChecklist(items);
    if (success) {
      App.showToast('Ítem de inducción agregado correctamente', 'success');
      this.render(document.getElementById('app-content'));
    }
  },

  async editarItemInduccion(id) {
    const items = Storage.getInduccionChecklist();
    const target = items.find(it => String(it.id) === String(id));
    if (!target) return;
    const nuevoNombre = prompt('Editar nombre del ítem de inducción:', target.label);
    if (nuevoNombre && nuevoNombre.trim()) {
      target.label = nuevoNombre.trim();
      const success = await Storage.saveInduccionChecklist(items);
      if (success) {
        App.showToast('Ítem de inducción actualizado', 'success');
        this.render(document.getElementById('app-content'));
      }
    }
  },

  async eliminarItemInduccion(id) {
    const items = Storage.getInduccionChecklist();
    const filtrados = items.filter(it => String(it.id) !== String(id));
    if (filtrados.length === items.length) return;
    App.showConfirm('Confirmar eliminación', '¿Está seguro de eliminar este ítem de la lista de inducción?', async () => {
      const success = await Storage.saveInduccionChecklist(filtrados);
      if (success) {
        App.showToast('Ítem de inducción eliminado', 'info');
        this.render(document.getElementById('app-content'));
      }
    });
  },

  /* ─────────────────────────────────────────────────────────────
     PESTAÑA 3: CONFIGURACIÓN (UMBRALES E IA)
     ───────────────────────────────────────────────────────────── */
  renderTabConfiguracion() {
    return `
      <div class="flex-col gap-4" style="max-width: 900px; margin: 0 auto;">
        
        <!-- Configuración Dinámica del Semáforo RICE -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid #ef4444;">
          <h3 style="margin-top:0; color: #991b1b; display: inline-flex; align-items: center; gap: 0.5rem;">
            ${Icons.get('bar-chart-3', 24)} Configuración Dinámica del Semáforo RICE
          </h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">
            Parametriza las reglas de ponderación, escalamiento, activación de estados y desescalamiento del motor RICE 2026.
          </p>
          
          <h4 style="color: var(--primary); margin: 1rem 0 0.5rem 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; font-size: 1rem;">
            1. Pesos por Gravedad y Escalamiento
          </h4>
          <div class="flex gap-4" style="flex-wrap: wrap; margin-bottom: 1rem;">
            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label class="form-label" style="font-weight:600;">Peso Falta Leve</label>
              <input type="number" id="rice-peso-leve" class="form-control" value="1" min="1">
            </div>
            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label class="form-label" style="font-weight:600;">Peso Falta Grave</label>
              <input type="number" id="rice-peso-grave" class="form-control" value="3" min="1">
            </div>
            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label class="form-label" style="font-weight:600;">Peso Falta Gravísima</label>
              <input type="number" id="rice-peso-gravisima" class="form-control" value="5" min="1">
            </div>
          </div>

          <div class="flex gap-4" style="flex-wrap: wrap; margin-bottom: 1rem;">
            <div class="form-group" style="flex: 1; min-width: 240px;">
              <label class="form-label" style="font-weight:600;">Leves a Grave (Escalamiento)</label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="number" id="rice-leves-escalan-grave" class="form-control" value="3" min="1" style="width: 80px;">
                <span style="font-size: 0.85rem;">leves en</span>
                <input type="number" id="rice-dias-ventana-leve" class="form-control" value="30" min="1" style="width: 80px;">
                <span style="font-size: 0.85rem;">días → 1 Grave</span>
              </div>
            </div>
            <div class="form-group" style="flex: 1; min-width: 240px;">
              <label class="form-label" style="font-weight:600;">Graves a Gravísima (Escalamiento)</label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="number" id="rice-graves-escalan-gravisima" class="form-control" value="2" min="1" style="width: 80px;">
                <span style="font-size: 0.85rem;">graves en el semestre → 1 Gravísima</span>
              </div>
            </div>
          </div>

          <h4 style="color: var(--primary); margin: 1rem 0 0.5rem 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; font-size: 1rem;">
            2. Umbrales para Activación de Estados
          </h4>
          <div class="flex gap-4" style="flex-wrap: wrap; margin-bottom: 1rem;">
            <div class="form-group" style="flex: 1; min-width: 220px; background: #ecfdf5; padding: 0.75rem; border-radius: 8px; border: 1px solid #a7f3d0;">
              <label class="form-label" style="font-weight:700; color: #065f46; display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Semáforo Verde</label>
              <span style="font-size: 0.85rem; color: #047857; display: block; margin-bottom: 0.4rem;">0 faltas o menos de:</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="number" id="rice-verde-max-leves" class="form-control" value="3" min="1">
                <span style="font-size: 0.8rem; color: #047857;">leves en 30 días</span>
              </div>
            </div>

            <div class="form-group" style="flex: 1; min-width: 220px; background: #fffbeb; padding: 0.75rem; border-radius: 8px; border: 1px solid #fde68a;">
              <label class="form-label" style="font-weight:700; color: #b45309; display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span> Semáforo Amarillo</label>
              <span style="font-size: 0.85rem; color: #b45309; display: block; margin-bottom: 0.4rem;">Se activa con ≥:</span>
              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="number" id="rice-amarillo-min-leves" class="form-control" value="3" min="1" style="width: 70px;">
                  <span style="font-size: 0.8rem; color: #b45309;">leves en 30d OR</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="number" id="rice-amarillo-min-graves" class="form-control" value="1" min="1" style="width: 70px;">
                  <span style="font-size: 0.8rem; color: #b45309;">grave(s) en semestre</span>
                </div>
              </div>
            </div>

            <div class="form-group" style="flex: 1; min-width: 220px; background: #fef2f2; padding: 0.75rem; border-radius: 8px; border: 1px solid #fca5a5;">
              <label class="form-label" style="font-weight:700; color: #991b1b; display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span> Semáforo Rojo</label>
              <span style="font-size: 0.85rem; color: #991b1b; display: block; margin-bottom: 0.4rem;">Se activa con ≥:</span>
              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="number" id="rice-rojo-min-gravisimas" class="form-control" value="1" min="1" style="width: 70px;">
                  <span style="font-size: 0.8rem; color: #991b1b;">gravísima(s) OR</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="number" id="rice-rojo-min-graves" class="form-control" value="2" min="1" style="width: 70px;">
                  <span style="font-size: 0.8rem; color: #991b1b;">grave(s) OR</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <input type="number" id="rice-rojo-min-total" class="form-control" value="10" min="1" style="width: 70px;">
                  <span style="font-size: 0.8rem; color: #991b1b;">faltas totales</span>
                </div>
              </div>
            </div>
          </div>

          <h4 style="color: var(--primary); margin: 1rem 0 0.5rem 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; font-size: 1rem; display: inline-flex; align-items: center; gap: 0.35rem;">
            3. Reglas de Desescalamiento (<span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block;"></span> Rojo → <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span> Amarillo)
          </h4>
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;">
              <input type="checkbox" id="rice-desescalar-compromiso" checked style="width: 1.1rem; height: 1.1rem; accent-color: var(--primary);">
              <label for="rice-desescalar-compromiso" style="font-weight: 600; margin: 0; font-size: 0.9rem;">
                Desescalar al cumplir un Compromiso Conductual Activo de Anotaciones
              </label>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;">
              <input type="checkbox" id="rice-desescalar-gracia" checked style="width: 1.1rem; height: 1.1rem; accent-color: var(--primary);">
              <label for="rice-desescalar-gracia" style="font-weight: 600; margin: 0; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                Desescalar tras
                <input type="number" id="rice-dias-gracia" class="form-control" value="30" min="1" style="width: 75px; padding: 0.15rem 0.4rem;">
                días consecutivos sin registrar anotaciones negativas
              </label>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <input type="checkbox" id="rice-desescalar-manual" checked style="width: 1.1rem; height: 1.1rem; accent-color: var(--primary);">
              <label for="rice-desescalar-manual" style="font-weight: 600; margin: 0; font-size: 0.9rem;">
                Permitir desescalamiento manual mediante 'Cierre de Seguimiento' en Bitácora
              </label>
            </div>
          </div>

          <div style="margin-top: 1.5rem; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <button class="btn btn-danger" onclick="AdminLocalView.saveRICEConfig()" style="font-weight: 700;">⚙️ Guardar Configuración RICE</button>
          </div>
        </div>

        <!-- Inteligencia Artificial -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--info);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h3 style="margin:0; color: var(--primary);">🔑 Configuración de Inteligencia Artificial (Google Gemini)</h3>
            <span id="gemini-status-badge" class="badge" style="background: #e0f2fe; color: #0284c7; padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; border-radius: 20px;">
              🔍 Comprobando clave...
            </span>
          </div>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">
            Ingresa tu API Key oficial de <b>Google Gemini 1.5 Flash</b>. Esta clave permite al asistente responder preguntas sobre los reglamentos del colegio de forma breve, amable y 100% gratuita.
          </p>

          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
            <strong style="color: var(--primary); display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.5rem;">
              <span>💡</span> ¿Cómo obtener tu API Key Gratuita en 3 sencillos pasos?
            </strong>
            <ol style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary); line-height: 1.6;">
              <li>Ingresa a la consola oficial de Google: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline;">Google AI Studio (aistudio.google.com)</a></li>
              <li>Haz clic en el botón azul <b>"Create API key"</b> (Crear clave de API).</li>
              <li>Copia la clave generada (empieza por <code>AIzaSy...</code>) y pégala en la casilla inferior.</li>
            </ol>
          </div>
          
          <div class="form-group mb-3">
            <label class="form-label" style="font-weight:600;">API Key de Gemini</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="password" id="admin-api-key" class="form-control" placeholder="AIzaSy... (temporal: luego migrar a Vercel Env GEMINI_API_KEY)" style="font-family: monospace; letter-spacing: 1px;">
              <button type="button" class="btn btn-secondary" onclick="const input = document.getElementById('admin-api-key'); input.type = input.type === 'password' ? 'text' : 'password'; this.innerText = input.type === 'password' ? '👁️' : '🙈';" title="Mostrar / Ocultar">👁️</button>
            </div>
            <small class="text-muted" style="display:block; margin-top: 0.25rem;">Seguro Fase 3: se usa vía proxy <code>/api/askGemini</code> con <code>GEMINI_API_KEY</code> en Vercel Env. El campo queda habilitado para prueba rápida (se borra de localStorage tras probar).</small>
          </div>

          <div style="text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <button class="btn btn-primary" onclick="AdminLocalView.saveApiKey()">💾 Guardar Clave IA</button>
          </div>
        </div>

      </div>
    `;
  },

  /* ─────────────────────────────────────────────────────────────
     PESTAÑA 4: MANTENIMIENTO Y RESPALDOS
     ───────────────────────────────────────────────────────────── */
  renderTabMantenimiento() {
    return `
      <div class="flex-col gap-4" style="max-width: 900px; margin: 0 auto;">
        
        <!-- Respaldos -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary);">
          <h3 style="margin-top:0">💾 Respaldo y Restauración de Datos</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Genera una copia de seguridad local de la información del establecimiento o restaura un respaldo previo.</p>
          
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="AdminLocalView.exportData()">
              💾 Exportar Respaldo Completo (.json)
            </button>
            
            <button class="btn btn-secondary" onclick="document.getElementById('import-file-admin').click()">
              📂 Importar Respaldo
            </button>
            <input type="file" id="import-file-admin" accept=".json" style="display: none" onchange="AdminLocalView.importData(event)">
          </div>
        </div>

        <!-- Acciones de Emergencia y Generación de Datos -->
        <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--danger);">
          <h3 style="margin-top:0; color:var(--danger)">⚠️ Operaciones Críticas / Generación y Limpieza de Datos</h3>
          <p class="text-secondary" style="margin-bottom: 1.25rem;">Carga datos de prueba de estudiantes y funcionarios o realiza limpiezas de la base de datos.</p>
          ${Storage.activeSchool === 'demo' ? `
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <button class="btn btn-primary" style="background: #2563eb; border: none; padding: 0.75rem 1.25rem; font-weight: 600;" onclick="if(window.injectMock2026) window.injectMock2026(); else App.showToast('Script de carga no disponible','warning');">
              🚀 Cargar Datos de Prueba (Mock 2026)
            </button>
          </div>
          ` : ''}
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-warning" onclick="if(window.limpiarEstudiantesColegioActivo) window.limpiarEstudiantesColegioActivo(); else App.showToast('Función no disponible','warning');">
              🧹 Borrar Todos los Estudiantes y su Historial (${Storage.activeSchool.toUpperCase()})
            </button>
            <button class="btn btn-danger" onclick="if(window.vaciarBaseDeDatos) window.vaciarBaseDeDatos(); else App.showToast('Script no cargado','warning');">
              🗑️ Reiniciar Historial de Actividad (Mantener Alumnos) (${Storage.activeSchool.toUpperCase()})
            </button>
          </div>
        </div>

      </div>
    `;
  },

  /* ─────────────────────────────────────────────────────────────
     LÓGICA Y MÉTODOS AUXILIARES
     ───────────────────────────────────────────────────────────── */

  async loadGlobalKey() {
    try {
      const doc = await window.getSupabaseClient().from('config').select('*').eq('key', 'gemini').single();
      const apiKeyEl = document.getElementById('admin-api-key');
      if (doc.data && doc.data.key && apiKeyEl) {
        apiKeyEl.value = doc.data.key;
      }
    } catch (_e) {}
  },

  async loadThresholds() {
    const thresholds = Storage.cache.config?.thresholds || {
      riesgoCritico: 10,
      riesgoModerado: 3,
      escalamientoCaso: 3
    };
    
    const inputCritico = document.getElementById('umbral-riesgo-critico');
    const inputModerado = document.getElementById('umbral-riesgo-moderado');
    const inputEscalamiento = document.getElementById('umbral-escalamiento-caso');
    
    if (inputCritico) inputCritico.value = thresholds.riesgoCritico;
    if (inputModerado) inputModerado.value = thresholds.riesgoModerado;
    if (inputEscalamiento) inputEscalamiento.value = thresholds.escalamientoCaso;
  },

  async saveThresholds() {
    const thresholds = {
      riesgoCritico: parseInt(document.getElementById('umbral-riesgo-critico').value) || 10,
      riesgoModerado: parseInt(document.getElementById('umbral-riesgo-moderado').value) || 3,
      escalamientoCaso: parseInt(document.getElementById('umbral-escalamiento-caso').value) || 3
    };
    
    if (!Storage.cache.config) Storage.cache.config = {};
    Storage.cache.config.thresholds = thresholds;
    
    if (Storage.localMutations && Storage.localMutations.config) {
      if (!Storage.localMutations.config.main) Storage.localMutations.config.main = {};
      Storage.localMutations.config.main.thresholds = thresholds;
    }
    
    try {
      await window.getSupabaseClient().from('config').upsert({ key: 'main', thresholds });
      App.showToast('Umbrales guardados exitosamente', 'success');
    } catch (e) {
      App.showToast('Solo guardado local (modo test)', 'success');
    }
  },

  currentMenuConfig: null,

  loadMenuEditor(role) {
    if (!this.currentMenuConfig) {
      this.currentMenuConfig = JSON.parse(JSON.stringify(Storage.getMenuConfig()));
    }
    if (!this.currentMenuConfig[role]) {
      this.currentMenuConfig[role] = [];
    }
    this.renderEditorMenus(role);
  },

  renderEditorMenus(role) {
    const container = document.getElementById('editor-menus-container');
    if (!container) return;
    
    const views = this.currentMenuConfig[role] || [];
    const ALL_ITEMS = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'agenda', label: 'Mi Agenda' },
      { id: 'notas', label: 'Muro de Notas' },
      { id: 'casos', label: 'Casos en Seguimiento' },
      { id: 'cursos', label: 'Cursos / Estudiantes' },
      { id: 'funcionarios', label: 'Funcionarios' },
      { id: 'asistencia', label: 'Asistencia / Atrasos' },
      { id: 'alertas_asistencia', label: 'Alertas Asistencia' },
      { id: 'consultas', label: 'Asistencia IA' },
      { id: 'pise', label: 'PISE' },
      { id: 'director', label: 'Directora' },
      { id: 'convivencia', label: 'Convivencia' },
      { id: 'utp', label: 'UTP' },
      { id: 'pie', label: 'PIE' },
      { id: 'profesor', label: 'Profesor' },
      { id: 'inspectoria', label: 'Inspectoría' },
      { id: 'finanzas', label: 'Finanzas' },
      { id: 'documentos', label: 'Documentos' },
      { id: 'admin', label: 'Panel de Control' }
    ];

    const isSuperAdmin = (role === 'superadmin' || role === 'admin');

    if (isSuperAdmin) {
      container.innerHTML = `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem;">
          👑 El perfil ${role === 'superadmin' ? 'Super Administrador' : 'Administrador'} tiene visibilidad y acceso total por defecto a todos los módulos del sistema.
        </div>
      ` + ALL_ITEMS.map(item => `
        <label style="display:flex; align-items:center; gap:0.5rem; background:white; border:1px solid var(--border-color); padding:0.5rem 0.75rem; border-radius:var(--radius-md); cursor:not-allowed; opacity: 0.85;">
          <input type="checkbox" checked disabled style="accent-color: var(--warning); width:1.1rem; height:1.1rem;">
          <span style="font-size:0.9rem; font-weight: 600;">${item.label} (${item.id})</span>
        </label>
      `).join('');
      return;
    }

    container.innerHTML = ALL_ITEMS.map(item => {
      const isChecked = views.includes(item.id);
      return `
        <label style="display:flex; align-items:center; gap:0.5rem; background:white; border:1px solid var(--border-color); padding:0.5rem 0.75rem; border-radius:var(--radius-md); cursor:pointer;">
          <input type="checkbox" onchange="AdminLocalView.toggleMenuVisibility('${role}', '${item.id}', this.checked)" ${isChecked ? 'checked' : ''} style="accent-color: var(--warning); width:1.1rem; height:1.1rem;">
          <span style="font-size:0.9rem;">${item.label} (${item.id})</span>
        </label>
      `;
    }).join('');
  },

  toggleMenuVisibility(role, menuId, isChecked) {
    if (!this.currentMenuConfig) return;
    if (!this.currentMenuConfig[role]) this.currentMenuConfig[role] = [];
    
    if (isChecked) {
      if (!this.currentMenuConfig[role].includes(menuId)) {
        this.currentMenuConfig[role].push(menuId);
      }
    } else {
      this.currentMenuConfig[role] = this.currentMenuConfig[role].filter(id => id !== menuId);
    }
  },

  async saveMenuEditor() {
    if (!this.currentMenuConfig) {
      App.showToast('Atención: No hay cambios para guardar.', 'warning');
      return;
    }
    try {
      App.showToast('Guardando...', 'info');
      const savePromise = Storage.saveMenuConfig(this.currentMenuConfig);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
      await Promise.race([savePromise, timeoutPromise]);
      
      const roleSelect = document.getElementById('editor-menu-role-select');
      const editedRole = roleSelect ? roleSelect.options[roleSelect.selectedIndex].text : 'ese rol';
      App.showToast(`Menús de ${editedRole} guardados.`, 'success');
      setTimeout(() => App.renderSidebar(), 500);
    } catch (e) {
      console.error("Error:", e);
      App.showToast('Error al guardar: ' + e.message, 'danger');
    }
  },

  async saveApiKey() {
    const keyInput = document.getElementById('admin-api-key');
    const badge = document.getElementById('gemini-status-badge');
    const key = keyInput ? keyInput.value.trim() : '';
    if (badge) {
      badge.style.background = '#fef3c7';
      badge.style.color = '#d97706';
      badge.innerText = key ? '⏳ Guardando y probando...' : '⏳ Limpiando...';
    }
    // Fase 3: prueba rápida local + instrucción Vercel Env para persistencia segura
    if (key) {
      try {
        sessionStorage.setItem('barita_gemini_key_temp', key);
        App.showToast('Clave guardada temporalmente (solo esta sesión) y lista para probar chat. Para producción, configura GEMINI_API_KEY en Vercel → Settings → Env Variables.', 'success');
        if (badge) {
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
          badge.innerText = '✅ Clave temporal activa — prueba el chat';
        }
      } catch (_e) {
        App.showToast('Clave lista para probar. Configura también en Vercel Env para que persista.', 'success');
      }
    } else {
      try { sessionStorage.removeItem('barita_gemini_key_temp'); } catch (_e) {}
      App.showToast('Clave temporal eliminada', 'info');
      if (badge) {
        badge.style.background = '#fee2e2';
        badge.style.color = '#b91c1c';
        badge.innerText = '⚠️ Sin Clave';
      }
      if (keyInput) keyInput.value = '';
    }
  },

  async loadGlobalKey() {
    const keyInput = document.getElementById('admin-api-key');
    const badge = document.getElementById('gemini-status-badge');
    let hasTemp = false;
    try { hasTemp = !!sessionStorage.getItem('barita_gemini_key_temp'); } catch (_e) {}
    if (keyInput) {
      keyInput.value = '';
      keyInput.placeholder = hasTemp ? 'Clave temporal activa (sessionStorage) — migrar a Vercel Env pronto' : 'AIzaSy... (se guarda solo sesión temporal)';
    }
    if (badge) {
      if (hasTemp) {
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
        badge.innerText = '✅ Temporal activa';
      } else {
        badge.style.background = '#fee2e2';
        badge.style.color = '#b91c1c';
        badge.innerText = '⚠️ Sin Clave — pega una para probar';
      }
    }
  },

  exportData() {
    try {
      const meta = Storage.exportAll();
      App.showToast(`Exportados ${meta.totalRegistros} registros con éxito`, "success");
    } catch (_e) {
      App.showToast("Error al exportar datos", "danger");
    }
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    App.showConfirm(
      "Importar Datos",
      "Esto reemplazará todos los datos actuales con los del archivo. ¿Estás seguro?",
      () => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const result = await Storage.importAll(e.target.result);
            if (result.success) {
              App.showToast("Datos importados con éxito", "success");
              setTimeout(() => location.reload(), 1500);
            } else {
              App.showToast(`Error al importar: ${result.error}`, "danger");
            }
          } catch (error) {
            App.showToast("Error: El archivo no es válido", "danger");
          }
        };
        reader.readAsText(file);
      }
    );
    event.target.value = '';
  },

  async loadUsers() {
    try {
      const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : '';
      const currentSchool = Storage.activeSchool || 'demo';

      let query = window.supabaseGestion.from('usuarios').select('*').eq('is_active', true);
      
      // Tenant scope: always filter users belonging to the active school context
      query = query.or(`colegio_id.eq.${currentSchool},colegioId.eq.${currentSchool}`);

      const { data: snapshot, error } = await query;
      
      let html = '<table class="data-table"><thead><tr><th>Nombre Completo</th><th>Email / Cuenta</th><th>Rol</th><th>Colegio</th><th>Acciones</th></tr></thead><tbody>';
      let usuariosColegio = snapshot || [];

      // Auto-repair for Escuela Demo
      if (usuariosColegio.length === 0 && currentSchool === 'demo') {
        try {
          await window.supabaseGestion.from('usuarios').upsert({
            id: '11111111-1111-1111-1111-111111111111', // Mock/fallback valid UUID
            email: 'admin@demo.cl',
            role: 'admin',
            nombres: 'Administrador Principal',
            is_active: true,
            colegio_id: 'demo'
          });
          const { data: refetched } = await query;
          usuariosColegio = refetched || [];
        } catch(e) { console.warn('Could not auto-repair demo admin:', e); }
      }

      if (usuariosColegio.length === 0) {
        html = '<p class="text-muted">No hay usuarios registrados para este colegio.</p>';
      } else {
        usuariosColegio.forEach(usr => {
          const roleVal = usr.role || 'utp';
          const schoolVal = usr.colegio_id || usr.colegioId || 'demo';
          const nombresVal = usr.nombres || usr.nombre || 'Sin Nombre';
          const roleDisplay = (roleVal === 'admin' || roleVal === 'administrador') ? 'INSPECTOR GENERAL' : (roleVal === 'directora' ? 'DIRECTORA' : (roleVal === 'convivencia' ? 'CONVIVENCIA ESCOLAR' : roleVal.toUpperCase()));
          html += `
            <tr>
              <td><strong>${S(nombresVal)}</strong></td>
              <td>${S(usr.email || usr.id)}</td>
              <td>
                <span class="badge badge-info" style="text-transform: uppercase;">${S(roleDisplay)}</span>
              </td>
              <td><span class="badge badge-secondary">${S(schoolVal)}</span></td>
              <td>
                <div class="flex items-center gap-2">
                  ${currentRole === 'superadmin' ? `
                  <button class="btn btn-sm" style="background:#8b5cf6; color:white; font-size: 0.8rem; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.25rem; border:none;" onclick="Auth.impersonateUser('${usr.id}', '${roleVal}', { nombres: '${S(nombresVal).replace(/'/g, "\\'")}', email: '${S(usr.email || '').replace(/'/g, "\\'")}', colegio_id: '${S(schoolVal)}' })" title="Simular como este usuario">
                    👁️ Simular
                  </button>
                  ` : ''}
                  <button class="btn btn-sm btn-secondary" style="font-size: 0.8rem; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="AdminLocalView.openEditUserModal('${usr.id}', '${S(nombresVal).replace(/'/g, "\\'")}', '${S(usr.email || '').replace(/'/g, "\\'")}', '${roleVal}')">
                    ✏️ Editar
                  </button>
                  <button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="AdminLocalView.eliminarUsuario('${usr.id}')" title="Eliminar perfil">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        });
        html += '</tbody></table>';
      }
      
      const el = document.getElementById('admin-users-list');
      if (el) el.innerHTML = html;
    } catch(e) {
      const el = document.getElementById('admin-users-list');
      if (el) el.innerHTML = '<p style="color:red">Error cargando usuarios.</p>';
    }
  },

  openEditUserModal(uid, nombres, email, role) {
    let modal = document.getElementById('modal-editar-usuario');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-editar-usuario';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
      document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 480px; width: 90%; padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
          <h3 style="margin: 0; color: var(--primary); font-size: 1.15rem;">✏️ Editar Datos de Usuario</h3>
          <button onclick="document.getElementById('modal-editar-usuario').style.display='none'" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
        
        <form onsubmit="AdminLocalView.guardarEdicionUsuario(event, '${uid}')">
          <div class="form-group mb-3" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 0.35rem;">Nombre Completo</label>
            <input type="text" id="edit-user-nombre" class="form-control" value="${nombres.replace(/"/g, '&quot;')}" required placeholder="Ej: Maximiliano">
          </div>
          
          <div class="form-group mb-3" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 0.35rem;">Correo Electrónico (Email)</label>
            <input type="email" id="edit-user-email" class="form-control" value="${email.replace(/"/g, '&quot;')}" required placeholder="correo@terra.cl">
          </div>
          
          <div class="form-group mb-4" style="margin-bottom: 1.25rem;">
            <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 0.35rem;">Rol Asignado</label>
            <select id="edit-user-role" class="form-control" required style="width: 100%;">
              <option value="utp" ${role === 'utp' ? 'selected' : ''}>UTP</option>
              <option value="directora" ${role === 'directora' || role === 'director' ? 'selected' : ''}>Directora</option>
              <option value="convivencia" ${role === 'convivencia' ? 'selected' : ''}>Convivencia</option>
              <option value="PIE" ${role === 'pie' || role === 'PIE' ? 'selected' : ''}>PIE</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrador</option>
              <option value="profesor" ${role === 'profesor' ? 'selected' : ''}>Profesor</option>
              <option value="inspectoria" ${role === 'inspectoria' ? 'selected' : ''}>Inspectoría</option>
              <option value="finanza" ${role === 'finanza' || role === 'finanzas' ? 'selected' : ''}>Finanzas</option>
              <option value="coordinadora" ${role === 'coordinadora' ? 'selected' : ''}>Coordinadora</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-editar-usuario').style.display='none'">Cancelar</button>
            <button type="submit" class="btn btn-primary">💾 Guardar Cambios</button>
          </div>
        </form>
      </div>
    `;
    modal.style.display = 'flex';
  },

  async guardarEdicionUsuario(event, uid) {
    if (event) event.preventDefault();
    const nombres = document.getElementById('edit-user-nombre').value.trim();
    const email = document.getElementById('edit-user-email').value.trim();
    let role = document.getElementById('edit-user-role').value;

    // Normalización de roles para satisfacer restricciones CHECK de Supabase (usuarios_role_check)
    const roleLower = (role || '').toLowerCase();
    if (roleLower === 'pie') role = 'PIE';
    if (roleLower === 'finanzas') role = 'finanza';
    if (roleLower === 'director') role = 'directora';
    if (roleLower === 'administrador' || roleLower === 'administrator') role = 'admin';

    try {
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : window.supabaseGestion;
      if (client) {
        const { error } = await client.from('usuarios').update({ nombres, email, role }).eq('id', uid);
        if (error) throw error;
      }
      
      const modal = document.getElementById('modal-editar-usuario');
      if (modal) modal.style.display = 'none';
      
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Usuario actualizado correctamente en Supabase', 'success');
      }
      
      this.loadUsers();
    } catch(err) {
      console.error(err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Error al actualizar usuario: ' + (err.message || err), 'danger');
      }
    }
  },

  async changeRole(uid, newRole) {
    App.showConfirm('Confirmar', `¿Estás seguro de cambiar el rol a ${newRole}?`, async () => {
      try {
        await window.supabaseGestion.from('usuarios').update({ role: newRole }).eq('id', uid);
        App.showToast('Rol actualizado correctamente', 'success');
        
        if(Auth.currentUser && Auth.currentUser.uid === uid) {
          Auth.currentRole = newRole;
          Auth.updateUIForRole();
          if(newRole !== 'admin') {
            window.location.hash = '#/dashboard';
            App.handleRoute();
          }
        }
      } catch (_e) {
        App.showToast('Error actualizando rol', 'danger');
        this.loadUsers();
      }
    });
  },

  async eliminarUsuario(uid) {
    if (Auth.currentUser && Auth.currentUser.uid === uid) {
      App.showToast('No puedes eliminar tu propio perfil', 'warning');
      return;
    }

    App.showConfirm('Confirmar', '¿Estás seguro de desactivar este perfil?', async () => {
      try {
        const { error } = await window.supabaseGestion.from('usuarios').update({ is_active: false }).eq('id', uid);
        if (error) throw error;

        App.showToast('Perfil desactivado correctamente', 'success');
        setTimeout(() => this.loadUsers(), 300);

        const el = document.getElementById('sidebar-nav-container');
        if (el && typeof App.renderSidebar === 'function') App.renderSidebar();
      } catch(e) {
        App.showToast('Error al desactivar perfil: ' + (e && e.message ? e.message : 'desconocido'), 'danger');
      }
    });
  },

  async crearUsuario() {
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;
    
    if (!email || !password) {
      App.showToast('Completa correo y contraseña', 'warning');
      return;
    }
    if (password.length < 6) {
      App.showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }
    if (!email.includes('@')) {
      App.showToast('Correo inválido', 'warning');
      return;
    }

    const btn = document.querySelector('#form-new-user button[type="submit"]');
    const oldText = btn ? btn.innerHTML : 'Crear Usuario';
    if (btn) {
      btn.innerHTML = 'Creando...';
      btn.disabled = true;
    }

    try {
      const currentSchool = Storage.activeSchool || 'demo';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : String(email);

      // Intentar Método 1: RPC PostgreSQL SECURITY DEFINER create_user_admin (bypassa RLS de forma segura)
      try {
        const { data: rpcResult, error: rpcError } = await window.supabaseGestion.rpc('create_user_admin', {
          user_email: normalizedEmail,
          user_password: password,
          user_role: role,
          target_colegio_id: currentSchool
        });

        if (!rpcError && rpcResult && rpcResult.success) {
          App.showToast(`Usuario ${rpcResult.action === 'reactivated' ? 'reactivado' : 'creado'} exitosamente para ${currentSchool.toUpperCase()}`, 'success');
          const form = document.getElementById('form-new-user');
          if (form) form.reset();
          this.loadUsers();
          return;
        }
      } catch (_rpcErr) {
        console.warn('RPC create_user_admin no disponible, ejecutando endpoint/client fallback:', _rpcErr);
      }

      // Intentar Método 2: API Endpoint Serverless /api/createUser
      try {
        let token = '';
        if (window.supabaseGestion?.auth?.getSession) {
          const { data: sessionData } = await window.supabaseGestion.auth.getSession();
          token = sessionData?.session?.access_token || '';
        }

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const apiRes = await fetch('/api/createUser', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ email: normalizedEmail, password, role, colegio_id: currentSchool })
        });
        const apiData = await apiRes.json();
        if (apiRes.ok && apiData.success) {
          App.showToast('Usuario registrado exitosamente', 'success');
          const form = document.getElementById('form-new-user');
          if (form) form.reset();
          this.loadUsers();
          return;
        }
      } catch (_apiErr) {
        console.warn('API /api/createUser fallback:', _apiErr);
      }

      // Método 3: Client Fallback con inserción directa inyectando colegio_id explícito
      const existingUser = await window.supabaseGestion.from('usuarios').select('id,is_active,role,email').eq('email', normalizedEmail).maybeSingle();
      if (existingUser.error && !existingUser.error.message.includes('multiple rows')) throw existingUser.error;

      if (existingUser.data && existingUser.data.id) {
        if (existingUser.data.is_active) {
          App.showToast('Ese correo ya tiene una cuenta registrada y activa.', 'danger');
          return;
        }

        const { error: reactivateError } = await window.supabaseGestion.from('usuarios').update({
          is_active: true,
          role,
          colegio_id: currentSchool,
          colegioId: currentSchool,
          updated_at: new Date().toISOString()
        }).eq('id', existingUser.data.id);
        if (reactivateError) throw reactivateError;

        App.showToast('Perfil reactivado y actualizado correctamente.', 'success');
        const form = document.getElementById('form-new-user');
        if (form) form.reset();
        this.loadUsers();
        return;
      }

      const { data, error } = await window.supabaseGestion.auth.signUp({ email: normalizedEmail, password });
      
      if (error) {
        if (error.message && error.message.includes('already registered')) {
          // Si ya existe en auth.users pero faltaba en public.usuarios, creamos/actualizamos el perfil en public.usuarios
          const { error: healError } = await window.supabaseGestion.from('usuarios').upsert({
            email: normalizedEmail,
            role: role,
            nombres: 'Nuevo Usuario',
            is_active: true,
            colegio_id: currentSchool,
            colegioId: currentSchool,
            created_at: new Date().toISOString()
          }, { onConflict: 'email' });

          if (!healError) {
            App.showToast('Cuenta de usuario vinculada e incorporada al colegio exitosamente.', 'success');
            const form = document.getElementById('form-new-user');
            if (form) form.reset();
            this.loadUsers();
            return;
          }
        }
        throw error;
      }

      const uid = data.user ? data.user.id : null;
      if (!uid) throw new Error('No se pudo obtener el identificador del usuario');

      const { error: upsertError } = await window.supabaseGestion.from('usuarios').upsert({
        id: uid,
        email: normalizedEmail,
        role: role,
        nombres: 'Nuevo Usuario',
        is_active: true,
        colegio_id: currentSchool,
        colegioId: currentSchool,
        created_at: new Date().toISOString()
      });
      if (upsertError) throw upsertError;

      App.showToast('Usuario creado exitosamente. Ahora aparece en la lista.', 'success');
      const form = document.getElementById('form-new-user');
      if (form) form.reset();
      this.loadUsers();
    } catch (error) {
      let msg = 'Error creando usuario';
      if (error.message && error.message.includes('already registered')) {
        msg = 'Ese correo ya tiene una cuenta registrada en Auth.';
      } else {
        msg = error.message || msg;
      }
      App.showToast(msg, 'danger');
    } finally {
      if (btn) {
        btn.innerHTML = oldText;
        btn.disabled = false;
      }
    }
  },

  async handleLogoFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      App.showToast('El logo original no debe superar los 5MB', 'warning');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        this._selectedSchoolLogoBase64 = canvas.toDataURL('image/webp', 0.85);
        
        const preview = document.getElementById('school-logo-preview');
        if (preview) {
          preview.innerHTML = `<img src="${this._selectedSchoolLogoBase64}" style="width:100%; height:100%; object-fit:contain;">`;
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },

  async saveSchoolProfile() {
    const nameInput = document.getElementById('school-name-input');
    const newName = nameInput ? nameInput.value.trim() : '';

    if (typeof Storage !== 'undefined' && Storage.saveSchoolProfile) {
      const updated = await Storage.saveSchoolProfile({
        nombre: newName,
        logo: this._selectedSchoolLogoBase64
      });
      App.showToast('Identidad de la escuela guardada con éxito', 'success');
      if (typeof App !== 'undefined' && App.updateSidebarBranding) {
        App.updateSidebarBranding();
      }
    } else {
      App.showToast('Storage no está disponible para guardar', 'danger');
    }
  },

  saveRICEConfig() {
    const config = {
      pesoLeve: Number(document.getElementById('rice-peso-leve')?.value || 1),
      pesoGrave: Number(document.getElementById('rice-peso-grave')?.value || 3),
      pesoGravisima: Number(document.getElementById('rice-peso-gravisima')?.value || 5),
      levesEscalanGrave: Number(document.getElementById('rice-leves-escalan-grave')?.value || 3),
      diasVentanaLeve: Number(document.getElementById('rice-dias-ventana-leve')?.value || 30),
      gravesEscalanGravisima: Number(document.getElementById('rice-graves-escalan-gravisima')?.value || 2),
      verdeMaxLeves30d: Number(document.getElementById('rice-verde-max-leves')?.value || 3),
      amarilloMinLeves30d: Number(document.getElementById('rice-amarillo-min-leves')?.value || 3),
      amarilloMinGraves: Number(document.getElementById('rice-amarillo-min-graves')?.value || 1),
      rojoMinGravisimas: Number(document.getElementById('rice-rojo-min-gravisimas')?.value || 1),
      rojoMinGraves: Number(document.getElementById('rice-rojo-min-graves')?.value || 2),
      rojoMinTotalFaltas: Number(document.getElementById('rice-rojo-min-total')?.value || 10),
      desescalarCompromiso: document.getElementById('rice-desescalar-compromiso')?.checked !== false,
      desescalarGracia: document.getElementById('rice-desescalar-gracia')?.checked !== false,
      diasGracia: Number(document.getElementById('rice-dias-gracia')?.value || 30),
      desescalarManual: document.getElementById('rice-desescalar-manual')?.checked !== false
    };

    if (typeof Storage !== 'undefined' && typeof Storage.setItem === 'function') {
      Storage.setItem('barita_rice_config', JSON.stringify(config));
    } else {
      localStorage.setItem('barita_rice_config', JSON.stringify(config));
    }

    // Re-evaluar motor RICE en tiempo real para estudiantes en memoria
    if (window.RICEEngine && typeof window.RICEEngine.evaluarEstudiante === 'function') {
      const estudiantes = (typeof Storage !== 'undefined' && typeof Storage.getEstudiantes === 'function') ? Storage.getEstudiantes() : [];
      estudiantes.forEach(est => {
        if (est && est.id) window.RICEEngine.evaluarEstudiante(est.id);
      });
    }

    App.showToast('📊 Configuración RICE guardada y aplicada en tiempo real', 'success');
  },

  loadRICEConfig() {
    let custom = null;
    try {
      if (typeof Storage !== 'undefined' && typeof Storage.getItem === 'function') {
        const raw = Storage.getItem('barita_rice_config') || localStorage.getItem('barita_rice_config');
        if (raw) custom = JSON.parse(raw);
      }
    } catch (_e) {}

    if (!custom) return;

    if (document.getElementById('rice-peso-leve')) document.getElementById('rice-peso-leve').value = custom.pesoLeve ?? 1;
    if (document.getElementById('rice-peso-grave')) document.getElementById('rice-peso-grave').value = custom.pesoGrave ?? 3;
    if (document.getElementById('rice-peso-gravisima')) document.getElementById('rice-peso-gravisima').value = custom.pesoGravisima ?? 5;
    if (document.getElementById('rice-leves-escalan-grave')) document.getElementById('rice-leves-escalan-grave').value = custom.levesEscalanGrave ?? 3;
    if (document.getElementById('rice-dias-ventana-leve')) document.getElementById('rice-dias-ventana-leve').value = custom.diasVentanaLeve ?? 30;
    if (document.getElementById('rice-graves-escalan-gravisima')) document.getElementById('rice-graves-escalan-gravisima').value = custom.gravesEscalanGravisima ?? 2;
    if (document.getElementById('rice-verde-max-leves')) document.getElementById('rice-verde-max-leves').value = custom.verdeMaxLeves30d ?? 3;
    if (document.getElementById('rice-amarillo-min-leves')) document.getElementById('rice-amarillo-min-leves').value = custom.amarilloMinLeves30d ?? 3;
    if (document.getElementById('rice-amarillo-min-graves')) document.getElementById('rice-amarillo-min-graves').value = custom.amarilloMinGraves ?? 1;
    if (document.getElementById('rice-rojo-min-gravisimas')) document.getElementById('rice-rojo-min-gravisimas').value = custom.rojoMinGravisimas ?? 1;
    if (document.getElementById('rice-rojo-min-graves')) document.getElementById('rice-rojo-min-graves').value = custom.rojoMinGraves ?? 2;
    if (document.getElementById('rice-rojo-min-total')) document.getElementById('rice-rojo-min-total').value = custom.rojoMinTotalFaltas ?? 10;
    if (document.getElementById('rice-desescalar-compromiso')) document.getElementById('rice-desescalar-compromiso').checked = custom.desescalarCompromiso !== false;
    if (document.getElementById('rice-desescalar-gracia')) document.getElementById('rice-desescalar-gracia').checked = custom.desescalarGracia !== false;
    if (document.getElementById('rice-dias-gracia')) document.getElementById('rice-dias-gracia').value = custom.diasGracia ?? 30;
    if (document.getElementById('rice-desescalar-manual')) document.getElementById('rice-desescalar-manual').checked = custom.desescalarManual !== false;
  },

  async generateBackupCode() {
    try {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barita-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      App.showToast('Backup generado', 'success');
    } catch (e) {
      App.showToast('Error generando backup', 'danger');
    }
  },

  renderTabPromocion() {
    return `
      <div class="card p-4">
        <h3 style="margin-top: 0; color: var(--primary); display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('graduation-cap', 24)} Módulo de Promoción y Matrícula Anual</h3>
        <p class="text-secondary" style="margin-bottom: 1.5rem;">
          Promueve o matricula estudiantes por lote de un curso a otro para el nuevo año escolar. Puedes marcar a los alumnos egresados o retirados.
        </p>

        <!-- Filtros Origen / Destino -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div>
            <label class="form-label" style="font-weight: 600;">Año Origen:</label>
            <select id="prom-anio-origen" class="form-control" onchange="document.getElementById('prom-anio-destino').value = parseInt(this.value) + 1;">
              <option value="2024">2024</option>
              <option value="2025" selected>2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight: 600;">Año Destino (Matrícula):</label>
            <input type="text" id="prom-anio-destino" class="form-control" value="2026" readonly style="background: rgba(0,0,0,0.05); font-weight: bold;">
          </div>
          <div>
            <label class="form-label" style="font-weight: 600;">Curso Origen:</label>
            <select id="prom-curso-origen" class="form-control">
              <option value="">-- Selecciona Curso --</option>
            </select>
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button class="btn btn-primary inline-flex items-center justify-center gap-1.5" onclick="window.AdminLocalView.buscarEstudiantesPromocion()" style="width: 100%;">${Icons.get('search', 16)} Buscar Estudiantes</button>
          </div>
        </div>

        <!-- Acciones Masivas por Lote -->
        <div id="prom-lote-container" style="display: none; margin-bottom: 1.25rem; padding: 1rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <strong style="color: #1e3a8a; font-size: 0.9rem;">Acción por Lote:</strong>
            <select id="prom-estado-lote" class="form-control form-control-sm" style="width: auto; background: white;" onchange="document.getElementById('prom-curso-destino-lote').disabled = (this.value !== 'promovido' && this.value !== 'retenido');">
              <option value="promovido">Promover a Curso Destino</option>
              <option value="retenido">Retener en Curso Origen</option>
              <option value="egresado">Egresado / Graduado</option>
              <option value="retirado">Retirado del Colegio</option>
            </select>
            <select id="prom-curso-destino-lote" class="form-control form-control-sm" style="width: auto; background: white;">
              <option value="">-- Selecciona Curso Destino --</option>
            </select>
            <button class="btn btn-sm btn-primary" onclick="window.AdminLocalView.aplicarAccionLotePromocion()">Aplicar a Seleccionados</button>
          </div>
          <span style="font-size: 0.8rem; color: #1e40af; font-weight: 600;" id="prom-seleccionados-label">0 seleccionados</span>
        </div>

        <!-- Tabla de Estudiantes -->
        <div class="table-responsive" style="margin-bottom: 1.5rem; max-height: 400px; overflow-y: auto;">
          <table class="table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-hover);">
                <th style="width: 40px; text-align: center;"><input type="checkbox" id="prom-select-all" onclick="const checked = this.checked; document.querySelectorAll('.prom-row-check').forEach(c => { c.checked = checked; }); window.AdminLocalView.actualizarConteoSeleccionados();"></th>
                <th>RUT</th>
                <th>Estudiante</th>
                <th>Curso Origen</th>
                <th>Acción / Destino (${parseInt(Storage.getActiveYear()) + 1})</th>
              </tr>
            </thead>
            <tbody id="prom-estudiantes-tbody">
              <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                  Selecciona un curso y presiona "Buscar Estudiantes" para iniciar el proceso.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Botón Ejecutar Promoción -->
        <div id="prom-footer-actions" style="display: none; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
          <button class="btn btn-success" onclick="window.AdminLocalView.ejecutarPromocionMasiva()" style="font-size: 1rem; padding: 0.6rem 2rem; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.2);">
            🚀 Ejecutar Promoción y Matrícula
          </button>
        </div>

      </div>
    `;
  },

  inicializarTabPromocion() {
    const activeYear = Storage.getActiveYear();
    const promAnioOrigen = document.getElementById('prom-anio-origen');
    const promAnioDestino = document.getElementById('prom-anio-destino');
    
    if (promAnioOrigen) promAnioOrigen.value = activeYear;
    if (promAnioDestino) promAnioDestino.value = String(parseInt(activeYear) + 1);

    const cursos = (typeof DATA !== 'undefined' && DATA.cursos) ? DATA.cursos : (Storage.cache?.cursos || []);
    const selectOrigen = document.getElementById('prom-curso-origen');
    const selectDestinoLote = document.getElementById('prom-curso-destino-lote');
    
    if (selectOrigen) {
      selectOrigen.innerHTML = '<option value="">-- Selecciona Curso --</option>' + 
        cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    }
    if (selectDestinoLote) {
      selectDestinoLote.innerHTML = '<option value="">-- Selecciona Curso Destino --</option>' + 
        cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    }
  },

  actualizarConteoSeleccionados() {
    const checkedCount = document.querySelectorAll('.prom-row-check:checked').length;
    const label = document.getElementById('prom-seleccionados-label');
    if (label) {
      label.textContent = `${checkedCount} seleccionado${checkedCount === 1 ? '' : 's'}`;
    }
  },

  buscarEstudiantesPromocion() {
    const cursoOrigen = document.getElementById('prom-curso-origen').value;
    const anioOrigen = document.getElementById('prom-anio-origen').value;
    
    if (!cursoOrigen) {
      App.showToast('Por favor selecciona un Curso Origen', 'warning');
      return;
    }

    const tbody = document.getElementById('prom-estudiantes-tbody');
    if (!tbody) return;

    // Filter students by active school and course directly from cached raw list (decoupled from active year filter)
    const activeSchool = Storage.activeSchool || 'demo';
    const rawStudents = Storage.cache.estudiantes || [];
    const matriculas = Storage.cache.matriculas_anuales || [];
    
    // Find students matriculated in the selected year and course
    const targetStudents = rawStudents.filter(est => {
      if ((est.colegio_id || est.colegioId || 'demo') !== activeSchool) return false;
      
      const matricula = matriculas.find(m => m.estudiante_id === est.id && String(m.anio_escolar) === anioOrigen);
      if (matricula) {
        return matricula.curso_id === cursoOrigen;
      }
      
      // Fallback: if no matriculas exist for this student at all, and source year is 2026, check default course
      if (anioOrigen === '2026') {
        return est.curso === cursoOrigen;
      }
      return false;
    });

    if (targetStudents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            No se encontraron estudiantes matriculados en este curso para el año ${anioOrigen}.
          </td>
        </tr>
      `;
      document.getElementById('prom-lote-container').style.display = 'none';
      document.getElementById('prom-footer-actions').style.display = 'none';
      return;
    }

    const cursos = (typeof DATA !== 'undefined' && DATA.cursos) ? DATA.cursos : (Storage.cache?.cursos || []);
    const cursoOrigenObj = cursos.find(c => c.id === cursoOrigen);
    const cursoOrigenNombre = cursoOrigenObj ? cursoOrigenObj.nombre : cursoOrigen;

    const cursoDestinoOptions = cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    tbody.innerHTML = targetStudents.map(est => {
      return `
        <tr data-student-id="${est.id}">
          <td style="text-align: center;">
            <input type="checkbox" class="prom-row-check" onclick="window.AdminLocalView.actualizarConteoSeleccionados()">
          </td>
          <td style="font-weight: 500;">${est.rut || '-'}</td>
          <td><strong>${est.nombres} ${est.apellidos}</strong></td>
          <td><span class="badge" style="background:#e2e8f0; color:#475569;">${cursoOrigenNombre}</span></td>
          <td>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <select class="form-control form-control-sm prom-student-estado" style="width: auto;" onchange="const cSelect = this.nextElementSibling; cSelect.disabled = (this.value !== 'promovido' && this.value !== 'retenido');">
                <option value="promovido" selected>Promovido a:</option>
                <option value="retenido">Repetir / Retener en:</option>
                <option value="egresado">Egresado / Graduado</option>
                <option value="retirado">Retirado</option>
              </select>
              <select class="form-control form-control-sm prom-student-curso-destino" style="width: auto;">
                <option value="">-- Selecciona Curso --</option>
                ${cursoDestinoOptions}
              </select>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.getElementById('prom-select-all').checked = false;
    this.actualizarConteoSeleccionados();
    document.getElementById('prom-lote-container').style.display = 'flex';
    document.getElementById('prom-footer-actions').style.display = 'block';
  },

  aplicarAccionLotePromocion() {
    const checkboxes = document.querySelectorAll('.prom-row-check:checked');
    if (checkboxes.length === 0) {
      App.showToast('No has seleccionado ningún estudiante', 'warning');
      return;
    }

    const estadoLote = document.getElementById('prom-estado-lote').value;
    const cursoDestinoLote = document.getElementById('prom-curso-destino-lote').value;

    if ((estadoLote === 'promovido' || estadoLote === 'retenido') && !cursoDestinoLote) {
      App.showToast('Por favor selecciona el Curso Destino para la acción por lote', 'warning');
      return;
    }

    checkboxes.forEach(chk => {
      const row = chk.closest('tr');
      if (row) {
        const selectEstado = row.querySelector('.prom-student-estado');
        const selectCurso = row.querySelector('.prom-student-curso-destino');
        
        if (selectEstado) {
          selectEstado.value = estadoLote;
          // Trigger change event to enable/disable curso selector
          selectEstado.dispatchEvent(new Event('change'));
        }
        if (selectCurso && (estadoLote === 'promovido' || estadoLote === 'retenido')) {
          selectCurso.value = cursoDestinoLote;
        }
      }
    });

    App.showToast(`Se aplicó acción por lote a ${checkboxes.length} estudiantes`, 'success');
  },

  async ejecutarPromocionMasiva() {
    const rows = document.querySelectorAll('#prom-estudiantes-tbody tr[data-student-id]');
    if (rows.length === 0) return;

    const anioDestino = parseInt(document.getElementById('prom-anio-destino').value);
    const cursoOrigen = document.getElementById('prom-curso-origen').value;
    const activeSchool = Storage.activeSchool || 'demo';

    let count = 0;
    App.showToast('Registrando promociones en Supabase...', 'info');

    for (const row of rows) {
      const studentId = row.getAttribute('data-student-id');
      const estado = row.querySelector('.prom-student-estado').value;
      const cursoDestino = row.querySelector('.prom-student-curso-destino').value;

      let targetCurso = '';
      let targetEstado = 'activo';

      if (estado === 'promovido') {
        targetCurso = cursoDestino || cursoOrigen;
        targetEstado = 'activo';
      } else if (estado === 'retenido') {
        targetCurso = cursoOrigen;
        targetEstado = 'activo';
      } else if (estado === 'egresado') {
        targetCurso = 'egresado';
        targetEstado = 'egresado';
      } else {
        targetCurso = 'retirado';
        targetEstado = 'retirado';
      }

      const matriculaPayload = {
        id: Storage.generateId(),
        estudiante_id: studentId,
        colegio_id: activeSchool,
        anio_escolar: anioDestino,
        curso_id: targetCurso,
        estado: targetEstado
      };

      await Storage.saveMatriculaAnual(matriculaPayload);
      count++;
    }

    App.showToast(`🚀 ¡Éxito! Se procesaron ${count} matrículas para el año escolar ${anioDestino}`, 'success');
    
    // Refresh view
    this.buscarEstudiantesPromocion();
  }
};

window.AdminLocalView = AdminLocalView;
