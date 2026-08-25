/* ================================================================
   notas.js — Muro de Notas y Feedback Colaborativo (Vanilla JS)
   Tablero interactivo de Sticky Notes con hilo de comentarios,
   firma/confirmación de lectura y filtros dinámicos.
   ================================================================ */

var NotasView = (() => {
  let activeFilter = 'todas'; // 'todas', 'enviadas', 'recibidas'
  let focusedNotaId = null;

  // Dynamic utility: build email-to-displayName map from the active school's users
  function _buildEmailToNameMap() {
    const map = {};
    const roleMasks = {
      admin: 'Inspector General', administrador: 'Inspector General',
      utp: 'UTP', directora: 'Directora', director: 'Directora',
      convivencia: 'Convivencia Escolar', pie: 'PIE',
      profesor: 'Profesor', coordinadora: 'Coordinadora',
      inspectoria: 'Inspectoría', finanzas: 'Finanzas', superadmin: 'Super Admin'
    };
    try {
      const usuarios = (typeof Storage !== 'undefined' && Storage.getUsuarios) ? Storage.getUsuarios() : [];
      usuarios.forEach(u => {
        if (u && u.email) {
          const roleLabel = roleMasks[(u.role || '').toString().trim().toLowerCase()] || (u.role || 'Funcionario');
          const name = u.nombres || u.nombre || 'Funcionario';
          map[u.email.toLowerCase()] = `${roleLabel} - ${name}`;
        }
      });
    } catch (_e) {}
    return map;
  }

  const COLOR_PALETTE = {
    amarillo: {
      label: 'General / Aviso',
      bg: '#fef9c3',
      border: '#fef08a',
      headerBg: '#fef08a',
      accent: '#ca8a04',
      badgeClass: 'badge-warning',
      icon: '🟡'
    },
    azul: {
      label: 'Feedback Pedagógico',
      bg: '#eff6ff',
      border: '#bfdbfe',
      headerBg: '#dbeafe',
      accent: '#2563eb',
      badgeClass: 'badge-info',
      icon: '🔵'
    },
    rojo: {
      label: 'Urgente / Importante',
      bg: '#fef2f2',
      border: '#fecaca',
      headerBg: '#fee2e2',
      accent: '#dc2626',
      badgeClass: 'badge-danger',
      icon: '🔴'
    },
    verde: {
      label: 'Reconocimiento',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      headerBg: '#dcfce7',
      accent: '#16a34a',
      badgeClass: 'badge-success',
      icon: '🟢'
    }
  };

  function parseQueryId() {
    try {
      const hash = window.location.hash || '';
      if (hash.includes('?')) {
        const queryStr = hash.split('?')[1];
        const params = new URLSearchParams(queryStr);
        return params.get('id');
      }
    } catch (_e) {}
    return null;
  }

  function render(container, routeId = null) {
    if (!container) return;

    // Protección de ventanas modales abiertas al cambiar de pestaña o foco en el navegador
    const createModal = document.getElementById('modal-crear-nota');
    const commentModal = document.getElementById('modal-comentarios-nota');
    const revisarModal = document.getElementById('modal-revisar-nota');
    const isCreateOpen = createModal && createModal.style.display !== 'none' && !createModal.classList.contains('hidden');
    const isCommentOpen = commentModal && commentModal.style.display !== 'none' && !commentModal.classList.contains('hidden');
    const isRevisarOpen = revisarModal && revisarModal.style.display !== 'none' && !revisarModal.classList.contains('hidden');

    if (isCreateOpen || isCommentOpen || isRevisarOpen) {
      return;
    }

    if (typeof App !== 'undefined' && App.setBreadcrumb) {
      App.setBreadcrumb('Muro de Notas / Feedback');
    }

    focusedNotaId = routeId || parseQueryId();

    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : 'funcionario';
    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'terra_di_bimbi';

    const currentNotas = (typeof Storage !== 'undefined' && Storage.getNotasColaborativas) ? Storage.getNotasColaborativas() : [];

    // Sincronización asíncrona en segundo plano desde Supabase (Garantiza descarga inicial completa)
    if (typeof Storage !== 'undefined' && Storage.loadNotasFromSupabase && !NotasView._isFetchingSync && !NotasView._hasSyncedCurrentSession) {
      NotasView._isFetchingSync = true;
      Storage.loadNotasFromSupabase().then(() => {
        NotasView._isFetchingSync = false;
        NotasView._hasSyncedCurrentSession = true;
        const contentBody = document.getElementById('app-content');
        if (contentBody && window.location.hash.includes('#/notas')) {
          render(contentBody, focusedNotaId);
        }
      }).catch((_err) => { NotasView._isFetchingSync = false; });
    }
    
    // Filtro por colegio activo
    const schoolNotas = currentNotas.filter(n => n.id !== 'nota_demo_1').filter(n => {
      const sch = (n.colegio_id || n.colegioId || 'terra_di_bimbi').toString().trim();
      return sch === activeSchool || sch === 'terra_di_bimbi';
    });

    const myId = currentUser ? (currentUser.id || currentUser.uid) : null;
    const myEmail = currentUser ? (currentUser.email || '').toLowerCase() : '';
    const myRole = currentRole.toLowerCase();

    // Mapeo directo de nombres de funcionarios de Terra Di Bimbi por email
    const userProfile = (typeof Auth !== 'undefined' && Auth.userProfile) ? Auth.userProfile : null;
    const myName = (userProfile && (userProfile.nombres || userProfile.nombre)) ? (userProfile.nombres || userProfile.nombre).toLowerCase() : '';
    const terraNamesByEmail = {
      'admin@terra.cl': 'italo',
      'utp@terra.cl': 'maximiliano',
      'dire1@terra.cl': 'silvana c',
      'conv@terra.cl': 'silvana p',
      'utp2@terra.cl': 'jessica',
      'dire2@terra.cl': 'rommy',
      'pie@terra.cl': 'pamela'
    };
    const mappedName = terraNamesByEmail[myEmail] || '';

    // Comprobador de visibilidad por receptor / emisor
    const isNotaUserMatch = (n) => {
      if (!n) return false;
      // Nota privada: solo emisor (ni admin ve)
      const isPriv = n.visibilidad === 'privada' || n.is_privada === true || (n.receptor_nombre && String(n.receptor_nombre).toLowerCase().includes('solo yo')) || (n.receptor_id && String(n.receptor_id).toLowerCase().includes('privada'));
      if (isPriv) {
        const emisorIdStrPriv = String(n.emisor_id || '').toLowerCase();
        if (myId && emisorIdStrPriv === String(myId).toLowerCase()) return true;
        if (myEmail && (n.creador_email || '').toLowerCase() === myEmail) return true;
        return false;
      }
      if (myRole === 'superadmin' || myRole === 'admin') return true;

      const emisorIdStr = String(n.emisor_id || '').toLowerCase();
      const emisorNombreStr = (n.emisor_nombre || '').toLowerCase();

      // 1. Es emisor
      if (myId && emisorIdStr === String(myId).toLowerCase()) return true;
      if (myEmail && (n.creador_email || '').toLowerCase() === myEmail) return true;
      if (myEmail && emisorNombreStr.includes(myEmail)) return true;

      const recIdStr = (n.receptor_id || '').toLowerCase();
      const recNombreStr = (n.receptor_nombre || '').toLowerCase();
      const recCombined = `${recIdStr},${recNombreStr}`;
      const recTokens = recCombined.split(/[,|]/).map(s => s.trim());

      // 2. Destinatario global / colectivo
      if (recIdStr.includes('todos') || recNombreStr.includes('todo el equipo') || recTokens.includes('todos')) return true;

      // 3. Coincidencia por Rol
      if ((recCombined.includes('utp') || recTokens.includes('utp')) && (myRole === 'utp' || myRole === 'coordinadora')) return true;
      if ((recCombined.includes('direccion') || recCombined.includes('dirección') || recTokens.includes('direccion')) && (myRole === 'directora' || myRole === 'admin' || myRole === 'superadmin')) return true;
      if ((recCombined.includes('convivencia') || recTokens.includes('convivencia')) && myRole === 'convivencia') return true;
      if ((recCombined.includes('pie') || recTokens.includes('pie')) && myRole === 'pie') return true;
      if ((recCombined.includes('inspectoria') || recCombined.includes('inspectoría') || recTokens.includes('inspectoria')) && (myRole === 'admin' || myRole === 'inspectoria' || myRole === 'superadmin')) return true;

      // 4. Coincidencia por Correo Electrónico
      if (myEmail && (recCombined.includes(myEmail) || recTokens.includes(myEmail))) return true;

      // 5. Coincidencia por ID de usuario
      if (myId && (recCombined.includes(String(myId).toLowerCase()) || recTokens.includes(String(myId).toLowerCase()))) return true;

      // 6. Coincidencia por Nombre Completo / Nombre de Pila (ej: "Silvana P", "Maximiliano", "Pamela", "Italo", "Jessica", "Rommy", "Silvana C")
      if (myName && (recCombined.includes(myName) || recTokens.includes(myName))) return true;
      if (mappedName && (recCombined.includes(mappedName) || recTokens.includes(mappedName))) return true;

      // 7. Coincidencia por rol exacto
      if (myRole && (recCombined.includes(myRole) || recTokens.includes(myRole))) return true;

      return false;
    };

    let filteredNotas = [];
    if (activeFilter === 'todas') {
      filteredNotas = schoolNotas.filter(n => !n.is_deleted && isNotaUserMatch(n));
    } else if (activeFilter === 'recibidas') {
      filteredNotas = schoolNotas.filter(n => !n.is_deleted && !n.leido && isNotaUserMatch(n));
    } else if (activeFilter === 'enviadas') {
      // Bitácora de Evidencia Institucional: Muestra el historial completo emitido (activas y eliminadas)
      filteredNotas = schoolNotas.filter(n => {
        if (myRole === 'superadmin' || myRole === 'admin') return true;
        if (myId && String(n.emisor_id) === String(myId)) return true;
        if (myEmail && (n.creador_email || '').toLowerCase() === myEmail) return true;
        if (myEmail && (n.emisor_nombre || '').toLowerCase().includes(myEmail)) return true;
        return false;
      });
    }

    const pendingCount = schoolNotas.filter(n => !n.is_deleted && !n.leido && isNotaUserMatch(n)).length;

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 1.5rem 0;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h2 style="margin: 0; display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
              ${Icons.get('pin', 22)} Muro de Notas y Feedback
              ${pendingCount > 0 ? `<span class="badge badge-danger" style="font-size: 0.85rem; padding: 0.2rem 0.6rem;">${pendingCount} Pendientes</span>` : ''}
            </h2>
            <p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.9rem;">
              Notas adhesivas colaborativas, reconocimientos y avisos del equipo directivo y docente.
            </p>
          </div>
          
          <button class="btn btn-primary" onclick="NotasView.openCreateModal()" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; padding: 0.6rem 1.25rem; border-radius: 8px;">
            ${Icons.get('plus', 16)} Crear Nueva Nota
          </button>
        </div>

        <!-- Toolbar Filtros -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: white; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-sm ${activeFilter === 'todas' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1" onclick="NotasView.setFilter('todas')">
              ${Icons.get('pin', 14)} Todas (${schoolNotas.filter(n => !n.is_deleted && isNotaUserMatch(n)).length})
            </button>
            <button class="btn btn-sm ${activeFilter === 'recibidas' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1" onclick="NotasView.setFilter('recibidas')">
              ${Icons.get('inbox', 14)} Pendientes / Recibidas (${pendingCount})
            </button>
            <button class="btn btn-sm ${activeFilter === 'enviadas' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1" onclick="NotasView.setFilter('enviadas')">
              ${Icons.get('send', 14)} Mis Enviadas / Historial
            </button>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Mostrando ${filteredNotas.length} nota(s)
          </div>
        </div>

        <!-- Vista Pestaña Mis Enviadas / Bitácora de Evidencia vs Muro Principal -->
        ${activeFilter === 'enviadas' ? renderBitacoraTablaHTML(filteredNotas) : (
          filteredNotas.length === 0 ? `
            <div class="card text-center text-muted" style="padding: 3rem; background: #fafafa; border-style: dashed;">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem; display: flex; justify-content: center; color: var(--text-secondary);">${Icons.get('edit-3', 40)}</div>
              <h4 style="margin: 0.5rem 0 0.5rem 0; color: var(--text-primary);">No hay notas activas en esta sección</h4>
              <p style="margin: 0; font-size: 0.9rem;">Crea una nueva nota para comunicarte con tu equipo docente o directivo.</p>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;">
              ${filteredNotas.map(nota => renderNotaCardHTML(nota)).join('')}
            </div>
          `
        )}
      </div>

      <!-- Modal Crear Nota -->
      <div id="modal-crear-nota" class="confirm-overlay hidden" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; padding: 1rem;">
        <div style="background: white; border-radius: 12px; max-width: 520px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); overflow: hidden;">
          
          <!-- Header Fijo -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 1.25rem 1.5rem; background: white;">
            <h3 style="margin: 0; color: var(--text-primary); font-size: 1.2rem; display: inline-flex; align-items: center; gap: 0.5rem;">${Icons.get('edit-3', 20)} Crear Nueva Nota Adhesiva</h3>
            <button onclick="NotasView.closeCreateModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
          </div>

          <!-- Form Wrap -->
          <form id="form-crear-nota" onsubmit="event.preventDefault(); NotasView.handleSaveNota();" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; margin: 0;">
            
            <!-- Cuerpo Desplazable (ModalBody) -->
            <div style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem;">
              <div style="display:flex;flex-direction:column;gap:.6rem;">
                <label style="font-weight:600;font-size:.85rem;color:var(--text-primary);">Visibilidad</label>
                <div class="barita-segmented" role="radiogroup" aria-label="Visibilidad de la nota">
                  <button type="button" id="btn-vis-compartida" class="is-active" aria-pressed="true" onclick="NotasView.setVisibilidadNota('compartida')">👥 Compartida</button>
                  <button type="button" id="btn-vis-privada" aria-pressed="false" onclick="NotasView.setVisibilidadNota('privada')">🔒 Solo para mí</button>
                </div>
                <div id="nota-privada-banner" class="barita-private-banner hidden">
                  <span>🔒</span><span><strong>Nota privada</strong> — Solo tú podrás verla en el Muro. Ideal para recordatorios personales.</span>
                </div>
              </div>
              <div id="wrap-destinatarios">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <label style="font-weight: 600; font-size: 0.85rem; color: #334155; margin: 0;">Seleccionar Destinatarios (Múltiples)</label>
                  <div style="display: flex; gap: 0.35rem;">
                    <button type="button" class="btn btn-sm btn-secondary" style="font-size: 0.72rem; padding: 0.15rem 0.4rem;" onclick="NotasView.toggleSelectAllDestinatarios(true)">Seleccionar Todo</button>
                    <button type="button" class="btn btn-sm btn-secondary" style="font-size: 0.72rem; padding: 0.15rem 0.4rem;" onclick="NotasView.toggleSelectAllDestinatarios(false)">Limpiar</button>
                  </div>
                </div>
                
                <div id="container-destinatarios-multiselect" style="max-height: 210px; overflow-y: auto; border: 1px solid var(--border-card); border-radius: 8px; padding: 0.5rem; background: var(--bg-hover); display: flex; flex-direction: column; gap: 0.35rem;">
                  ${getMultiSelectDestinatariosHTML()}
                </div>
                <small style="display: block; margin-top: 0.25rem; color: #64748b; font-size: 0.78rem;">
                  💡 Puedes marcar más de un funcionario individual o grupo colectivo a la vez. En privado se omite.
                </small>
              </div>



              <div>
                <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">Mensaje de la Nota</label>
                <textarea id="nota-mensaje" class="form-control" rows="3" placeholder="Escribe el mensaje o retroalimentación..." style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit;" required></textarea>
              </div>

              <div>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #334155; cursor: pointer;">
                  <input type="checkbox" id="nota-confirmacion" style="width: 16px; height: 16px;" checked>
                  <span><strong>Requiere Confirmación / Firma de Lectura</strong></span>
                </label>
              </div>
            </div>

            <!-- Pie de Página Fijo (Sticky Action Buttons) -->
            <div style="padding: 1rem 1.5rem; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" class="btn btn-secondary" onclick="NotasView.closeCreateModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary">Publicar Nota</button>
            </div>
          </form>

        </div>
      </div>

      <!-- Modal Hilo de Comentarios / Detalle -->
      <div id="modal-comentarios-nota" class="confirm-overlay hidden" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;">
        <div style="background: white; border-radius: 12px; max-width: 580px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
          <div id="modal-comentarios-header" style="padding: 1.25rem; border-bottom: 1px solid #e2e8f0;"></div>
          <div id="modal-comentarios-body" style="padding: 1.25rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 0.75rem; background: #f8fafc;"></div>
          <div style="padding: 1rem; border-top: 1px solid #e2e8f0; background: white; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
            <form onsubmit="event.preventDefault(); NotasView.handleSendComment();" style="display: flex; gap: 0.5rem;">
              <input type="text" id="input-nuevo-comentario" class="form-control" placeholder="Escribe una respuesta o comentario..." style="flex: 1; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1;" required>
              <button type="submit" class="btn btn-primary btn-sm" style="padding: 0.5rem 1rem;">Enviar</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Modal Pop-Out Revisar Nota Completa y Comentarios -->
      <div id="modal-revisar-nota" class="confirm-overlay hidden" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; padding: 1rem; backdrop-filter: blur(2px);">
        <div style="background: white; border-radius: 14px; max-width: 620px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
              🔍 Revisión Auditada de Nota Adhesiva
            </h3>
            <button onclick="NotasView.closeRevisarNotaModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; padding: 0.2rem 0.5rem; border-radius: 4px;">✕</button>
          </div>
          <div id="modal-revisar-body" style="padding: 1.25rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem; background: #f1f5f9;"></div>
          <div style="padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; background: white; display: flex; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="NotasView.closeRevisarNotaModal()" style="padding: 0.4rem 1rem;">Cerrar Vista</button>
          </div>
        </div>
      </div>
    `;

    // Highlight focused note if query string had ?id=...
    if (focusedNotaId) {
      setTimeout(() => {
        const el = document.getElementById(`nota-card-${focusedNotaId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.boxShadow = '0 0 0 3px #2563eb, 0 10px 15px -3px rgba(0,0,0,0.1)';
        }
      }, 300);
    }
  }

  function renderBitacoraTablaHTML(notas) {
    if (!notas || notas.length === 0) {
      return `
        <div class="card text-center text-muted" style="padding: 3rem; background: #fafafa; border-style: dashed;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📋</div>
          <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">No hay registros en la Bitácora de Evidencia</h4>
          <p style="margin: 0; font-size: 0.9rem;">Las notas que envíes quedarán registradas históricamente en este panel.</p>
        </div>
      `;
    }

    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'terra_di_bimbi';
    const usuariosList = (typeof Storage !== 'undefined' && Storage.getUsuarios) ? Storage.getUsuarios() : [];
    const filteredStaff = usuariosList.filter(u => {
      const sch = (u.colegio_id || u.colegioId || '').toString().trim();
      return sch === activeSchool && u.is_active !== false;
    });

    const rows = notas.map(n => {
      const fechaEnvio = n.created_at ? new Date(n.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---';
      const destinatarios = n.receptor_nombre || 'Todo el Equipo';
      const extracto = (n.mensaje || '').length > 60 ? (n.mensaje || '').substring(0, 60) + '...' : (n.mensaje || '');

      const receptorIdStr = String(n.receptor_id || '').toLowerCase();
      const receptorTokens = receptorIdStr.split(/[,|]/).map(s => s.trim());

      const requiredUsers = filteredStaff.filter(u => {
        const uEmail = (u.email || '').toLowerCase();
        const uId = String(u.id || '').toLowerCase();
        const uRole = (u.role || u.rol || '').toLowerCase();
        if (receptorTokens.includes('todos') || receptorIdStr.includes('todos')) return true;
        if (uEmail && receptorTokens.includes(uEmail)) return true;
        if (uId && receptorTokens.includes(uId)) return true;
        if (uRole && receptorTokens.includes(uRole)) return true;
        if (uRole === 'coordinadora' && receptorTokens.includes('utp')) return true;
        if ((uRole === 'directora' || uRole === 'admin' || uRole === 'superadmin') && receptorTokens.includes('direccion')) return true;
        if ((uRole === 'admin' || uRole === 'inspectoria' || uRole === 'superadmin') && receptorTokens.includes('inspectoria')) return true;
        return false;
      });

      const signatures = Array.isArray(n.confirmaciones) ? n.confirmaciones : [];
      const isFullyRead = !n.requiere_confirmacion || (requiredUsers.length > 0 && requiredUsers.every(reqUser => {
        const reqEmail = (reqUser.email || '').toLowerCase();
        const reqId = String(reqUser.id || '').toLowerCase();
        return signatures.some(sig => 
          (reqId && String(sig.usuario_id).toLowerCase() === reqId) ||
          (reqEmail && String(sig.email).toLowerCase() === reqEmail)
        );
      })) || (requiredUsers.length === 0 && (n.leido || signatures.length > 0));

      const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : '';
      const isAdmin = currentRole === 'superadmin' || currentRole === 'admin';
      const canDelete = isFullyRead || isAdmin;

      let estadoLecturaHTML = '';
      if (n.requiere_confirmacion) {
        const labelColor = isFullyRead ? '#166534' : '#92400e';
        const labelBg = isFullyRead ? '#dcfce7' : '#fef3c7';
        const labelBorder = isFullyRead ? '#86efac' : '#fde68a';
        const statusText = isFullyRead ? '✅ Completa' : '⏳ Pendiente';

        estadoLecturaHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start;">
            <span class="badge" style="font-size: 0.75rem; background: ${labelBg}; color: ${labelColor}; border: 1px solid ${labelBorder}; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600;">
              ${statusText} (${signatures.length}/${requiredUsers.length})
            </span>
            <small style="font-size: 0.7rem; color: #64748b;" title="Firmas: ${signatures.map(s => s.nombre).join(', ')}">
              ${signatures.length > 0 ? signatures.map(s => s.nombre.split(' - ')[1] || s.nombre).join(', ') : 'Ninguna firma'}
            </small>
          </div>
        `;
      } else {
        estadoLecturaHTML = `<span class="badge badge-secondary" style="font-size: 0.75rem; background: #f1f5f9; color: #475569; padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">📌 Informativa</span>`;
      }

      let estadoBorradoHTML = '';
      if (n.is_deleted) {
        const fechaBorrado = n.deleted_at ? new Date(n.deleted_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const borrador = n.deleted_by ? S(n.deleted_by) : 'Usuario';
        estadoBorradoHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start;">
            <span style="font-size: 0.75rem; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;" title="Eliminada de muro por ${borrador} el ${fechaBorrado}">
              🗑️ Eliminada por ${borrador}
            </span>
            <button class="btn btn-sm btn-danger" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer; border: 1px solid #dc2626; background: transparent; color: #dc2626; font-weight: 600;" onclick="NotasView.handlePurgarNota('${n.id}')">
              💥 Eliminar Definitivamente
            </button>
          </div>
        `;
      } else {
        estadoBorradoHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start;">
            <span class="badge badge-info" style="font-size: 0.75rem; background: #e0f2fe; color: #075985; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block;">📌 Activa en Muro</span>
            ${canDelete ? `
              <button class="btn btn-sm btn-danger" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer; border: none; background: #ef4444; color: white;" onclick="NotasView.handleEliminarNota('${n.id}')">
                🗑️ Eliminar
              </button>
            ` : `
              <span style="font-size: 0.72rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; display: inline-block;" title="Faltan firmas para poder eliminar esta nota">
                🔒 Bloqueada (Faltan lecturas)
              </span>
            `}
          </div>
        `;
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 0.75rem 0.8rem; font-weight: 500; color: #334155; white-space: nowrap;">${fechaEnvio}</td>
          <td style="padding: 0.75rem 0.8rem; font-weight: 600; color: #1e293b;">${S(destinatarios)}</td>
          <td style="padding: 0.75rem 0.8rem; color: #475569; max-width: 280px;">
            <div style="font-weight: 500; color: #1e293b; margin-bottom: 0.35rem; line-height: 1.3;" title="${S(n.mensaje)}">${S(extracto)}</div>
            <button class="btn btn-sm" style="background: #2563eb; color: white; border: none; font-size: 0.74rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; box-shadow: 0 1px 2px rgba(37,99,235,0.2); cursor: pointer;" onclick="NotasView.openRevisarNotaModal('${n.id}')">
              👁️ Ver Nota Completa
            </button>
          </td>
          <td style="padding: 0.75rem 0.8rem;">${estadoLecturaHTML}</td>
          <td style="padding: 0.75rem 0.8rem;">${estadoBorradoHTML}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="background: white; border-radius: 12px; border: 1px solid var(--border-color); padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
            📋 Bitácora de Evidencia Institucional (Historial de Notas Emitidas)
          </h3>
          <span style="font-size: 0.8rem; color: #64748b; font-weight: 500;">
            ${notas.length} registro(s) auditables
          </span>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.83rem;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #475569;">
                <th style="padding: 0.65rem 0.8rem;">Fecha de Envío</th>
                <th style="padding: 0.65rem 0.8rem;">Destinatario(s)</th>
                <th style="padding: 0.65rem 0.8rem;">Extracto del Mensaje</th>
                <th style="padding: 0.65rem 0.8rem;">Estado de Lectura</th>
                <th style="padding: 0.65rem 0.8rem;">Estado de Borrado</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function getMultiSelectDestinatariosHTML(usuariosList = []) {
    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'terra_di_bimbi';
    
    // Filtramos la lista de usuarios para la escuela actual
    const filteredStaff = (usuariosList || []).filter(u => {
      const sch = (u.colegio_id || u.colegioId || '').toString().trim();
      return sch === activeSchool;
    });

    // Detectamos los roles existentes en el personal filtrado
    const rolesPresentes = new Set(filteredStaff.map(u => (u.role || u.rol || 'staff').toLowerCase()));

    // 1. Grupos Colectivos / Por Rol (Dinámicos) — labels cortos para ahorrar espacio
    const grupos = [
      { id: 'todos', icon: Icons.get('globe', 14), label: 'EQUIPO', condicion: () => true },
      { id: 'utp', icon: Icons.get('book-open', 14), label: 'UTP', condicion: () => rolesPresentes.has('utp') },
      { id: 'direccion', icon: Icons.get('landmark', 14), label: 'DIRECCIÓN', condicion: () => rolesPresentes.has('director') || rolesPresentes.has('directora') },
      { id: 'convivencia', icon: Icons.get('message-square', 14), label: 'CONVIVENCIA', condicion: () => rolesPresentes.has('convivencia') },
      { id: 'pie', icon: Icons.get('shield', 14), label: 'PIE', condicion: () => rolesPresentes.has('pie') },
      { id: 'inspectoria', icon: Icons.get('eye', 14), label: 'INSPECTORÍA', condicion: () => rolesPresentes.has('admin') || rolesPresentes.has('administrador') || rolesPresentes.has('administrator') }
    ];

    const gruposActivos = grupos.filter(g => g.condicion());

    const gruposHTML = gruposActivos.map(g => `
      <label title="${g.label}" style="display: inline-flex; align-items: center; justify-content:center; gap:0.25rem; padding: 0.35rem 0.6rem; background: var(--bg-card); border-radius: 9999px; border: 1px solid var(--border-card); cursor: pointer; font-size: 0.85rem; color: var(--text-primary); min-width:36px; height:32px; flex-shrink:0; overflow:visible; line-height:1;" aria-label="${g.label}">
        <input type="checkbox" name="destinatario_check" value="${g.id}|${g.label}" style="width: 13px; height: 13px; accent-color: var(--primary); flex-shrink:0;">
        <span style="display:inline-flex; align-items:center; line-height:1;">${g.icon}</span>
      </label>
    `).join('');

    // 2. Destinatarios Individuales (Nómina dinámica filtrada por colegio activo)
    const roleMasks = {
      admin: 'Inspector General',
      administrador: 'Inspector General',
      administrator: 'Inspector General',
      utp: 'UTP',
      directora: 'Directora',
      director: 'Directora',
      convivencia: 'Convivencia Escolar',
      pie: 'PIE',
      superadmin: 'SuperAdmin'
    };

    const usuariosHTML = filteredStaff.map(u => {
      const nombre = u.nombres || u.nombre || u.email || 'Funcionario';
      const r = (u.role || u.rol || 'staff').toLowerCase();
      const roleLabel = roleMasks[r] || r.toUpperCase();
      return `
        <label style="display: none; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; background: white; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer; font-size: 0.83rem; color: #334155;">
          <input type="checkbox" name="destinatario_check" value="${u.email || u.id}|${nombre}" style="width: 15px; height: 15px; accent-color: #2563eb;">
          <span>👤 <strong>${nombre}</strong> <small style="color:#64748b;">(${roleLabel})</small></span>
        </label>
      `;
    }).join('');

    return `
      <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.2rem 0;">A. Grupos por Rol</div>
      <div style="display:flex; gap:0.3rem; flex-wrap:nowrap; overflow-x:auto; overflow-y:visible; align-items:center; min-height:40px; padding:2px 0; margin-bottom:0.35rem;">${gruposHTML}</div>
      <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.35rem 0 0.2rem 0;">B. Persona específica</div>
      <input type="text" id="nota-buscador" placeholder="🔍 Escribe nombre..." oninput="NotasView.filtrarDestinatarios(this.value)" style="width:100%; padding:0.45rem 0.6rem; border:1px solid var(--border-card); border-radius:8px; font-size:0.83rem; margin-bottom:0.4rem;">
      <div id="lista-usuarios-filtrada" style="display:flex; flex-direction:column; gap:0.3rem; max-height:110px; overflow-y:auto; padding-right:2px; min-height:0;">
        ${usuariosHTML || '<small style="color:#94a3b8; font-size:0.78rem; text-align:center; padding:0.5rem;">Sin funcionarios en este colegio</small>'}
      </div>
    `;
  }

  function toggleSelectAllDestinatarios(selectAll) {
    const checkboxes = document.querySelectorAll('#container-destinatarios-multiselect input[type="checkbox"]');
    checkboxes.forEach(cb => { cb.checked = !!selectAll; });
  }
  function filtrarDestinatarios(q) {
    const term = (q||'').toLowerCase().trim();
    let visible=0;
    const showAll = false; // lista vacía al inicio, solo muestra al escribir
    document.querySelectorAll('#lista-usuarios-filtrada label').forEach(lb=>{
      const txt = lb.textContent.toLowerCase();
      const show = term.length>=2 && txt.includes(term);
      lb.style.display = show ? 'flex' : 'none';
      if(show) visible++;
    });
    let hint=document.getElementById('nota-busqueda-hint');
    if(!hint){
      const cont=document.getElementById('lista-usuarios-filtrada');
      if(cont){
        hint=document.createElement('small');
        hint.id='nota-busqueda-hint';
        hint.style.cssText='color:#94a3b8;font-size:0.78rem;text-align:center;padding:0.4rem;display:none;';
        cont.parentNode.insertBefore(hint, cont.nextSibling);
      }
    }
    if(hint){
      if(!term) { hint.style.display='none'; }
      else if(visible===0) { hint.style.display='block'; hint.textContent='Sin resultados para "'+q+'"'; }
      else hint.style.display='none';
    }
  }

  // Visibilidad Solo para mí / Compartida
  let _visibilidad = 'compartida';
  function setVisibilidadNota(modo) {
    _visibilidad = modo;
    const isPriv = modo === 'privada';
    const btnPriv = document.getElementById('btn-vis-privada');
    const btnComp = document.getElementById('btn-vis-compartida');
    if (btnPriv) { btnPriv.classList.toggle('is-active', isPriv); btnPriv.setAttribute('aria-pressed', isPriv); }
    if (btnComp) { btnComp.classList.toggle('is-active', !isPriv); btnComp.setAttribute('aria-pressed', !isPriv); }
    const banner = document.getElementById('nota-privada-banner');
    if (banner) banner.classList.toggle('hidden', !isPriv);
    const wrap = document.getElementById('container-destinatarios-multiselect');
    if (wrap) wrap.classList.toggle('is-disabled', isPriv);
    const chk = document.getElementById('nota-confirmacion');
    if (chk) { if (isPriv) { chk.checked = false; chk.disabled = true; } else chk.disabled = false; }
    const submit = document.querySelector('#form-crear-nota button[type="submit"]');
    if (submit) submit.textContent = isPriv ? '💾 Guardar privada' : 'Publicar Nota';
  }

  function renderNotaCardHTML(nota) {
    const pal = COLOR_PALETTE[nota.color] || COLOR_PALETTE.amarillo;
    const comentarios = (typeof Storage !== 'undefined' && Storage.getNotaComentarios) ? Storage.getNotaComentarios(nota.id) : [];

    const isFocused = focusedNotaId === nota.id;
    const dateStr = nota.created_at ? new Date(nota.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole.toLowerCase() : '';
    const myId = currentUser ? (currentUser.id || currentUser.uid) : null;
    const myEmail = currentUser ? (currentUser.email || '').toLowerCase() : '';

    const isSender = (myId && String(nota.emisor_id) === String(myId)) || 
                     (myEmail && nota.emisor_nombre && nota.emisor_nombre.toLowerCase().includes(myEmail)) ||
                     (myEmail && nota.creador_email && nota.creador_email.toLowerCase() === myEmail) ||
                     (nota.emisor_id === 'direccion');

    const isAdmin = currentRole === 'superadmin' || currentRole === 'admin';

    // Resolver nómina de destinatarios requeridos
    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'terra_di_bimbi';
    const usuariosList = (typeof Storage !== 'undefined' && Storage.getUsuarios) ? Storage.getUsuarios() : [];
    const filteredStaff = usuariosList.filter(u => {
      const sch = (u.colegio_id || u.colegioId || '').toString().trim();
      return sch === activeSchool && u.is_active !== false;
    });

    const receptorIdStr = String(nota.receptor_id || '').toLowerCase();
    const receptorTokens = receptorIdStr.split(/[,|]/).map(s => s.trim());

    const requiredUsers = filteredStaff.filter(u => {
      const uEmail = (u.email || '').toLowerCase();
      const uId = String(u.id || '').toLowerCase();
      const uRole = (u.role || u.rol || '').toLowerCase();
      if (receptorTokens.includes('todos') || receptorIdStr.includes('todos')) return true;
      if (uEmail && receptorTokens.includes(uEmail)) return true;
      if (uId && receptorTokens.includes(uId)) return true;
      if (uRole && receptorTokens.includes(uRole)) return true;
      if (uRole === 'coordinadora' && receptorTokens.includes('utp')) return true;
      if ((uRole === 'directora' || uRole === 'admin' || uRole === 'superadmin') && receptorTokens.includes('direccion')) return true;
      if ((uRole === 'admin' || uRole === 'inspectoria' || uRole === 'superadmin') && receptorTokens.includes('inspectoria')) return true;
      return false;
    });

    const signatures = Array.isArray(nota.confirmaciones) ? nota.confirmaciones : [];
    const isFullyRead = !nota.requiere_confirmacion || (requiredUsers.length > 0 && requiredUsers.every(reqUser => {
      const reqEmail = (reqUser.email || '').toLowerCase();
      const reqId = String(reqUser.id || '').toLowerCase();
      return signatures.some(sig => 
        (reqId && String(sig.usuario_id).toLowerCase() === reqId) ||
        (reqEmail && String(sig.email).toLowerCase() === reqEmail)
      );
    })) || (requiredUsers.length === 0 && (nota.leido || signatures.length > 0));

    const canDelete = isFullyRead;
    const hasSigned = signatures.some(sig => 
      (myId && String(sig.usuario_id) === String(myId)) || 
      (myEmail && String(sig.email).toLowerCase() === myEmail)
    );

    return `
      <div id="nota-card-${nota.id}" style="
        background: ${pal.bg};
        border: 2px solid ${pal.border};
        border-radius: 12px;
        box-shadow: ${isFocused ? '0 0 0 3px #2563eb, 0 8px 12px -2px rgba(0,0,0,0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'};
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      " onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='translateY(0)'">
        
        <!-- Tape / Pin Accent -->
        <div style="background: ${pal.headerBg}; padding: 0.6rem 0.85rem; border-bottom: 1px solid ${pal.border}; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.75rem; font-weight: 700; color: ${pal.accent}; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.35rem;">
            ${pal.icon} ${pal.label}
          </span>
          <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">${dateStr}</span>
        </div>

        <div style="padding: 1rem; flex: 1;">
          <!-- De / Para Header -->
          <div style="font-size: 0.8rem; color: #475569; margin-bottom: 0.75rem; border-bottom: 1px dashed ${pal.border}; padding-bottom: 0.5rem;">
            <div><strong>De:</strong> ${S(nota.emisor_nombre || 'Dirección')}</div>
            <div><strong>Para:</strong> ${S(nota.receptor_nombre || 'Todo el Equipo')}</div>
          </div>

          <!-- Mensaje -->
          <div style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; font-family: inherit;">
            ${S(nota.mensaje)}
          </div>
        </div>

        <!-- Footer Actions -->
        <div style="padding: 0.75rem 1rem; background: rgba(255,255,255,0.6); border-top: 1px solid ${pal.border}; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${nota.requiere_confirmacion ? (
              isSender ? '' : (
                hasSigned ? `
                  <span style="font-size: 0.76rem; font-weight: 700; color: #15803d; background: #dcfce7; border: 1px solid #86efac; padding: 0.3rem 0.65rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem;" title="Lectura registrada el ${nota.fecha_lectura ? new Date(nota.fecha_lectura).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'recientemente'}">
                    ✅ Ya Leído por ti
                  </span>
                ` : `
                  <button class="btn btn-sm" style="background: #16a34a; color: white; border: none; padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(22,163,74,0.3); transition: all 0.2s;" onclick="NotasView.handleMarcarLeida('${nota.id}')">
                    ✓ Marcar como Leído
                  </button>
                `
              )
            ) : `
              <span style="font-size: 0.76rem; color: #475569; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 0.3rem 0.65rem; border-radius: 6px;">
                📌 Informativa
              </span>
            `}

            <!-- Contador de firmas para el Muro -->
            ${nota.requiere_confirmacion ? `
              <span style="font-size: 0.75rem; color: #475569; background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.3rem 0.65rem; border-radius: 6px; font-weight: 600;" title="Lecturas de: ${signatures.map(s => s.nombre).join(', ')}">
                👥 ${signatures.length}/${requiredUsers.length} leídos
              </span>
            ` : ''}

            ${canDelete ? `
              <button class="btn btn-sm btn-danger" style="font-size: 0.78rem; padding: 0.3rem 0.65rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="NotasView.handleEliminarNota('${nota.id}')" title="Borrar Nota">
                🗑️ Borrar Nota
              </button>
            ` : `
              <span style="font-size: 0.72rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 0.3rem 0.65rem; border-radius: 6px; font-weight: 600;" title="Faltan firmas para poder eliminar esta nota">
                🔒 Bloqueada (Faltan lecturas)
              </span>
            `}
          </div>

          <button class="btn btn-sm btn-secondary" style="font-size: 0.8rem; display: flex; align-items: center; gap: 0.35rem;" onclick="NotasView.openCommentThread('${nota.id}')">
            💬 Comentarios (${comentarios.length})
          </button>
        </div>
      </div>
    `;
  }

  function setFilter(filter) {
    activeFilter = filter;
    const contentBody = document.getElementById('app-content');
    render(contentBody);
  }

  async function openCreateModal() {
    const el = document.getElementById('modal-crear-nota');
    if (el) {
      el.style.display = 'flex';
      el.classList.remove('hidden');
      
      const container = document.getElementById('container-destinatarios-multiselect');
      if (container) {
        container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #64748b; font-size: 0.85rem;">⏳ Cargando funcionarios...</div>';
        
        try {
          const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
          const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'demo';
          
          let usuariosList = [];
          if (client) {
            const { data, error } = await client.from('usuarios').select('id, email, role, nombres, apellidos, colegio_id').eq('is_active', true);
            if (!error && data) {
              usuariosList = data;
            }
          }
          container.innerHTML = getMultiSelectDestinatariosHTML(usuariosList);
          // Default compartida (usuario elige si quiere solo para mí)
          setTimeout(()=>{ try{ setVisibilidadNota('compartida'); }catch(_e){} }, 0);
        } catch (err) {
          console.warn('Error fetching usuarios para notas:', err);
          container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #ef4444; font-size: 0.85rem;">⚠️ Error al cargar funcionarios</div>';
        }
      }
    }
  }

  function closeCreateModal() {
    const el = document.getElementById('modal-crear-nota');
    if (el) {
      el.style.display = 'none';
      el.classList.add('hidden');
    }
  }

  async function handleSaveNota() {
    const isPrivada = _visibilidad === 'privada';
    let receptorId, receptorNombre, destinatariosEmails, destinatariosRoles, destinatariosIds;

    if (isPrivada) {
      const curUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
      const myIdPriv = curUser ? (curUser.id || curUser.uid || 'yo') : 'yo';
      const myEmailPriv = curUser ? (curUser.email || '') : '';
      receptorId = String(myIdPriv);
      receptorNombre = 'Solo yo (Privada)';
      destinatariosEmails = myEmailPriv ? [myEmailPriv] : [];
      destinatariosRoles = [];
      destinatariosIds = [String(myIdPriv)];
    } else {
      const checkedBoxes = Array.from(document.querySelectorAll('#container-destinatarios-multiselect input[type="checkbox"]:checked'));
      if (checkedBoxes.length === 0) {
        if (typeof App !== 'undefined' && App.showToast) App.showToast('Selecciona al menos un destinatario o grupo colectivo', 'warning');
        return;
      }
      const receptorIdsList = checkedBoxes.map(cb => cb.value.split('|')[0]);
      const receptorNombresList = checkedBoxes.map(cb => cb.value.split('|')[1]);
      receptorId = receptorIdsList.join(',');
      receptorNombre = receptorNombresList.join(', ');
      destinatariosEmails = receptorIdsList.filter(v => v.includes('@'));
      destinatariosRoles = receptorIdsList.filter(v => !v.includes('@') && v !== 'todos');
      destinatariosIds = receptorIdsList;
    }

    const color = 'amarillo';

    const mensaje = (document.getElementById('nota-mensaje').value || '').trim();
    const requiereConfirmacion = document.getElementById('nota-confirmacion').checked;

    if (!mensaje) {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Ingresa un mensaje para la nota', 'warning');
      return;
    }

    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const userProfile = (typeof Auth !== 'undefined' && Auth.userProfile) ? Auth.userProfile : null;
    const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : 'usuario';
    const emisorId = currentUser ? (currentUser.id || currentUser.uid || 'direccion') : 'direccion';

    const rawName = (userProfile && userProfile.nombres) ? userProfile.nombres : (currentUser ? (currentUser.email || 'Dirección') : 'Dirección');
    const roleLabels = {
      superadmin: 'SuperAdmin',
      admin: 'Inspector General',
      administrador: 'Inspector General',
      directora: 'Directora',
      director: 'Directora',
      utp: 'UTP',
      pie: 'PIE',
      convivencia: 'Convivencia Escolar',
      inspectoria: 'Inspectoría General',
      profesor: 'Profesor',
      finanzas: 'Finanzas',
      coordinadora: 'Coordinadora'
    };
    const roleTag = roleLabels[currentRole.toLowerCase()] || currentRole.toUpperCase();
    const cleanName = rawName.replace(/^(UTP|Directora|Director|Convivencia|Convivencia Escolar|PIE|Administrador|Admin|Inspector General|Super Admin)\s*[-–]\s*/i, '').trim();
    const emisorNombreFormatted = `${roleTag} - ${cleanName}`;

    const activeSchool = (typeof Storage !== 'undefined' && Storage.activeSchool) ? Storage.activeSchool : 'terra_di_bimbi';

    const nuevaNota = {
      id: 'nota_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      emisor_id: emisorId,
      emisor_nombre: emisorNombreFormatted,
      creador_email: currentUser ? currentUser.email : '',
      receptor_id: receptorId,
      receptor_nombre: receptorNombre,
      destinatarios_emails: destinatariosEmails,
      destinatarios_roles: destinatariosRoles,
      destinatarios_ids: destinatariosIds,
      mensaje: mensaje,
      color: color,
      requiere_confirmacion: isPrivada ? false : requiereConfirmacion,
      leido: false,
      is_deleted: false,
      colegio_id: activeSchool,
      visibilidad: isPrivada ? 'privada' : 'compartida',
      is_privada: isPrivada,
    };

    try {
      if (typeof Storage !== 'undefined' && Storage.saveNotaColaborativa) {
        await Storage.saveNotaColaborativa(nuevaNota);
      }
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Nota publicada correctamente en el Muro', 'success');
    } catch (err) {
      console.error('Error guardando nota:', err);
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Error al publicar la nota: ' + (err.message || err), 'danger');
    } finally {
      closeCreateModal();
      const form = document.getElementById('form-crear-nota');
      if (form) form.reset();
      const contentBody = document.getElementById('app-content');
      if (contentBody) render(contentBody);
    }
  }

  async function handleMarcarLeida(notaId) {
    const userProfile = (typeof Auth !== 'undefined' && Auth.userProfile) ? Auth.userProfile : null;
    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : 'usuario';
    const rawName = (userProfile && userProfile.nombres) ? userProfile.nombres : (currentUser ? (currentUser.email || 'Funcionario') : 'Funcionario');
    const roleMasks = {
      admin: 'Inspector General',
      administrador: 'Inspector General',
      directora: 'Directora',
      director: 'Directora',
      utp: 'UTP',
      pie: 'PIE',
      convivencia: 'Convivencia Escolar',
      inspectoria: 'Inspectoría General'
    };
    const roleTag = roleMasks[currentRole.toLowerCase()] || currentRole.toUpperCase();
    const cleanName = rawName.replace(/^(UTP|Directora|Director|Convivencia|Convivencia Escolar|PIE|Administrador|Admin|Inspector General|Super Admin)\s*[-–]\s*/i, '').trim();
    const lectorNombre = `${roleTag} - ${cleanName}`;

    // 1. Actualización optimista inmediata en la vista local (0ms de retraso)
    if (typeof Storage !== 'undefined' && Storage.getNotasColaborativas) {
      const list = Storage.getNotasColaborativas();
      const n = list.find(x => String(x.id) === String(notaId));
      if (n) {
        n.leido = true;
        n.fecha_lectura = new Date().toISOString();
        n.leido_por_nombre = lectorNombre;
      }
    }

    const contentBody = document.getElementById('app-content');
    if (contentBody) render(contentBody);

    // 2. Persistencia asíncrona remota en Supabase
    try {
      if (typeof Storage !== 'undefined' && Storage.markNotaLeida) {
        await Storage.markNotaLeida(notaId, lectorNombre);
      }
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Nota marcada como leída. Sello de evidencia generado.', 'success');
      }
      if (contentBody) render(contentBody);
    } catch (err) {
      console.error('Error al marcar leída:', err);
    }
  }

  // Auto-sincronización periódica en segundo plano para actualizar el estado del muro en tiempo real entre cuentas
  if (typeof window !== 'undefined' && !window._notasAutoPollInterval) {
    window._notasAutoPollInterval = setInterval(() => {
      if (window.location.hash.includes('#/notas') && typeof Storage !== 'undefined' && Storage.loadNotasFromSupabase && !NotasView._isFetchingSync) {
        const createModal = document.getElementById('modal-crear-nota');
        const commentModal = document.getElementById('modal-comentarios-nota');
        const revisarModal = document.getElementById('modal-revisar-nota');
        const isCreateModalOpen = createModal && createModal.style.display !== 'none' && !createModal.classList.contains('hidden');
        const isCommentModalOpen = commentModal && commentModal.style.display !== 'none' && !commentModal.classList.contains('hidden');
        const isRevisarModalOpen = revisarModal && revisarModal.style.display !== 'none' && !revisarModal.classList.contains('hidden');

        // Permitir la descarga de datos desde Supabase siempre en segundo plano
        Storage.loadNotasFromSupabase().then(() => {
          const body = document.getElementById('app-content');
          if (!body || !window.location.hash.includes('#/notas')) return;

          // Si el chat de comentarios está abierto, actualizamos quirúrgicamente los comentarios del modal
          if (isCommentModalOpen && activeThreadNotaId) {
            // Renderiza los comentarios en el modal abierto (sin animar de nuevo los viejos)
            renderThreadCommentsHTML(activeThreadNotaId, false);
            
            // Actualizar la tarjeta del fondo con el nuevo conteo de comentarios
            const cardBtn = document.querySelector(`#nota-card-${activeThreadNotaId} button[onclick*="openCommentThread"]`);
            if (cardBtn) {
              const comentarios = (typeof Storage !== 'undefined' && Storage.getNotaComentarios) ? Storage.getNotaComentarios(activeThreadNotaId) : [];
              cardBtn.innerHTML = `💬 Comentarios (${comentarios.length})`;
            }
          } 
          // Si no hay modales abiertos, refrescamos el muro completo
          else if (!isCreateModalOpen && !isRevisarModalOpen) {
            render(body);
          }
        }).catch(() => {});
      }
    }, 3000); // Polling de 3 segundos para una interacción del chat más fluida
  }

  let activeThreadNotaId = null;

  function openCommentThread(notaId) {
    activeThreadNotaId = notaId;
    const notas = (typeof Storage !== 'undefined' && Storage.getNotasColaborativas) ? Storage.getNotasColaborativas() : [];
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;

    const modal = document.getElementById('modal-comentarios-nota');
    const headerEl = document.getElementById('modal-comentarios-header');
    const bodyEl = document.getElementById('modal-comentarios-body');

    if (!modal || !headerEl || !bodyEl) return;

    const pal = COLOR_PALETTE[nota.color] || COLOR_PALETTE.amarillo;

    headerEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="badge ${pal.badgeClass}" style="margin-bottom: 0.35rem; display: inline-block;">${pal.icon} ${pal.label}</span>
          <h4 style="margin: 0; color: #1e293b;">Hilo de Retroalimentación / Comentarios</h4>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #64748b;">De: <strong>${S(nota.emisor_nombre)}</strong> para <strong>${S(nota.receptor_nombre)}</strong></p>
        </div>
        <button onclick="NotasView.closeCommentThread()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
      </div>
    `;

    renderThreadCommentsHTML(notaId);

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
  }

  function renderThreadCommentsHTML(notaId, animateNewest = false) {
    const bodyEl = document.getElementById('modal-comentarios-body');
    if (!bodyEl) return;

    const comentarios = (typeof Storage !== 'undefined' && Storage.getNotaComentarios) ? Storage.getNotaComentarios(notaId) : [];

    if (comentarios.length === 0) {
      bodyEl.innerHTML = `
        <div class="text-center text-muted" style="padding: 2rem 1rem;">
          💬 No hay comentarios aún en esta nota. Sé el primero en responder.
        </div>
      `;
      return;
    }

    const keyframesCSS = `
      <style id="style-comment-anim">
        @keyframes commentSlideIn {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      </style>
    `;

    const emailToName = _buildEmailToNameMap();

    const commentsHTML = comentarios.map((c, index) => {
      const isLatest = animateNewest && index === comentarios.length - 1;
      const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const animStyle = isLatest ? 'animation: commentSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; border-left: 4px solid #2563eb; background: #eff6ff;' : '';

      let nombreDisplay = c.usuario_nombre || 'Funcionario';
      if (emailToName[nombreDisplay.toLowerCase()]) {
        nombreDisplay = emailToName[nombreDisplay.toLowerCase()];
      }

      return `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03); transition: all 0.2s ease; ${animStyle}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong style="font-size: 0.85rem; color: #2563eb;">👤 ${S(nombreDisplay)}</strong>
            <span style="font-size: 0.75rem; color: #94a3b8;">${dateStr}</span>
          </div>
          <div style="font-size: 0.9rem; color: #334155; white-space: pre-wrap;">${S(c.comentario)}</div>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = keyframesCSS + commentsHTML;

    // Desplazamiento suave (smooth scroll) al final del contenedor de comentarios
    setTimeout(() => {
      bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: 'smooth' });
    }, 40);
  }

  function closeCommentThread() {
    activeThreadNotaId = null;
    const modal = document.getElementById('modal-comentarios-nota');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  }

  function handleSendComment() {
    if (!activeThreadNotaId) return;
    const input = document.getElementById('input-nuevo-comentario');
    const text = (input ? input.value : '').trim();

    if (!text) return;

    // 1. Limpieza inmediata del input para respuesta táctil instantánea (0ms)
    if (input) input.value = '';

    // 2. Guardar comentario en local cache y Supabase (0ms respuesta)
    if (typeof Storage !== 'undefined' && Storage.addNotaComentario) {
      Storage.addNotaComentario(activeThreadNotaId, text);
    }

    // 3. Renderizar e insertar el nuevo comentario en el hilo visible con animación (0ms)
    renderThreadCommentsHTML(activeThreadNotaId, true);

    // 4. Actualizar de forma quirúrgica el contador del botón en la tarjeta del fondo sin alterar el modal
    const cardBtn = document.querySelector(`#nota-card-${activeThreadNotaId} button[onclick*="openCommentThread"]`);
    if (cardBtn) {
      const comentarios = (typeof Storage !== 'undefined' && Storage.getNotaComentarios) ? Storage.getNotaComentarios(activeThreadNotaId) : [];
      cardBtn.innerHTML = `💬 Comentarios (${comentarios.length})`;
    }
  }

  function handleEliminarNota(notaId) {
    if (!notaId) return;

    const userProfile = (typeof Auth !== 'undefined' && Auth.userProfile) ? Auth.userProfile : null;
    const currentUser = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser : null;
    const currentRole = (typeof Auth !== 'undefined' && Auth.currentRole) ? Auth.currentRole : 'usuario';
    const rawName = (userProfile && userProfile.nombres) ? userProfile.nombres : (currentUser ? (currentUser.email || 'Funcionario') : 'Funcionario');
    const roleMasks = {
      admin: 'Inspector General',
      administrador: 'Inspector General',
      directora: 'Directora',
      director: 'Directora',
      utp: 'UTP',
      pie: 'PIE',
      convivencia: 'Convivencia Escolar',
      inspectoria: 'Inspectoría General'
    };
    const roleTag = roleMasks[currentRole.toLowerCase()] || currentRole.toUpperCase();
    const cleanName = rawName.replace(/^(UTP|Directora|Director|Convivencia|Convivencia Escolar|PIE|Administrador|Admin|Inspector General|Super Admin)\s*[-–]\s*/i, '').trim();
    const usuarioNombre = `${roleTag} - ${cleanName}`;

    // Obtener la nota para validar si el usuario actual es el emisor
    const notas = (typeof Storage !== 'undefined' && Storage.getNotasColaborativas) ? Storage.getNotasColaborativas() : [];
    const nota = notas.find(n => String(n.id) === String(notaId));
    
    const myId = currentUser ? (currentUser.id || currentUser.uid) : null;
    const myEmail = currentUser ? (currentUser.email || '').toLowerCase() : '';
    
    const isSender = nota && (
      (myId && String(nota.emisor_id) === String(myId)) || 
      (myEmail && nota.emisor_nombre && nota.emisor_nombre.toLowerCase().includes(myEmail)) ||
      (myEmail && nota.creador_email && nota.creador_email.toLowerCase() === myEmail) ||
      (nota.emisor_id === 'direccion')
    );

    const doDelete = async () => {
      // Feedback visual instantaneo: Fade out y escala
      const cardEl = document.getElementById(`nota-card-${notaId}`);
      if (cardEl) {
        cardEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.9)';
        setTimeout(() => cardEl.remove(), 250);
      }

      try {
        if (typeof Storage !== 'undefined' && Storage.deleteNotaColaborativa) {
          await Storage.deleteNotaColaborativa(notaId, usuarioNombre);
        }
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Nota removida del Muro. Conservada en Bitácora de Evidencia.', 'success');
        }
      } catch (err) {
        console.error('Error al eliminar nota:', err);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Error al eliminar nota: ' + (err.message || err), 'danger');
        }
      }

      setTimeout(() => {
        const contentBody = document.getElementById('app-content');
        if (contentBody) render(contentBody);
      }, 300);
    };

    let tituloConfirm = '🗑️ Borrar Nota';
    let mensajeConfirm = '¿Deseas quitar esta nota del Muro principal? (Quedará resguardada en la Bitácora de Evidencia).';

    if (!isSender) {
      tituloConfirm = '⚠️ Advertencia de Eliminación';
      mensajeConfirm = 'Si eliminas esta nota, se quitará del muro para todo el equipo y todos perderán esta información.\n\nSe sugiere dejar un comentario en la nota solicitando a quien la envió originalmente que la elimine.\n\n¿Estás seguro de que deseas eliminarla de todas formas?';
    }

    if (typeof App !== 'undefined' && App.confirm) {
      App.confirm(tituloConfirm, mensajeConfirm, doDelete);
    } else if (window.confirm(mensajeConfirm)) {
      doDelete();
    }
  }

  function handlePurgarNota(notaId) {
    if (!notaId) return;

    const doPurge = async () => {
      try {
        if (typeof Storage !== 'undefined' && Storage.purgeNotaColaborativa) {
          await Storage.purgeNotaColaborativa(notaId);
        }
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Nota eliminada definitivamente del historial.', 'success');
        }
      } catch (err) {
        console.error('Error al purgar nota:', err);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Error al eliminar nota permanentemente: ' + (err.message || err), 'danger');
        }
      }

      setTimeout(() => {
        const contentBody = document.getElementById('app-content');
        if (contentBody) render(contentBody);
      }, 300);
    };

    if (typeof App !== 'undefined' && App.confirm) {
      App.confirm('⚠️ Eliminar Definitivamente', '¿Estás seguro de que deseas eliminar permanentemente esta nota de los registros históricos? Esta acción es irreversible.', doPurge);
    } else if (window.confirm('¿Estás seguro de que deseas eliminar permanentemente esta nota de los registros históricos? Esta acción es irreversible.')) {
      doPurge();
    }
  }

  function openRevisarNotaModal(notaId) {
    const notas = (typeof Storage !== 'undefined' && Storage.getNotasColaborativas) ? Storage.getNotasColaborativas() : [];
    const nota = notas.find(n => String(n.id) === String(notaId));
    if (!nota) return;

    let modal = document.getElementById('modal-revisar-nota');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-revisar-nota';
      modal.className = 'confirm-overlay hidden';
      modal.style.cssText = 'display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; padding: 1rem; backdrop-filter: blur(2px);';
      modal.innerHTML = `
        <div style="background: white; border-radius: 14px; max-width: 620px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
              🔍 Revisión Auditada de Nota Adhesiva
            </h3>
            <button onclick="NotasView.closeRevisarNotaModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; padding: 0.2rem 0.5rem; border-radius: 4px;">✕</button>
          </div>
          <div id="modal-revisar-body" style="padding: 1.25rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem; background: #f1f5f9;"></div>
          <div style="padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; background: white; display: flex; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="NotasView.closeRevisarNotaModal()" style="padding: 0.4rem 1rem;">Cerrar Vista</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    const bodyEl = document.getElementById('modal-revisar-body');
    if (!bodyEl) return;

    const pal = COLOR_PALETTE[nota.color] || COLOR_PALETTE.amarillo;
    const comentarios = (typeof Storage !== 'undefined' && Storage.getNotaComentarios) ? Storage.getNotaComentarios(nota.id) : [];
    const fechaEnvio = nota.created_at ? new Date(nota.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    
    const emailToName = _buildEmailToNameMap();

    let estadoLecturaHTML = '';
    if (nota.leido) {
      const fechaLeido = nota.fecha_lectura ? new Date(nota.fecha_lectura).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const lector = nota.leido_por_nombre ? S(nota.leido_por_nombre) : 'Funcionario';
      estadoLecturaHTML = `<span style="font-size: 0.8rem; font-weight: 700; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 0.3rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem;">✅ Leído por ${lector} (${fechaLeido})</span>`;
    } else {
      estadoLecturaHTML = `<span style="font-size: 0.8rem; font-weight: 600; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 0.3rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem;">⏳ Pendiente de lectura</span>`;
    }

    let estadoBorradoHTML = '';
    if (nota.is_deleted) {
      const fechaBorrado = nota.deleted_at ? new Date(nota.deleted_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const borrador = nota.deleted_by ? S(nota.deleted_by) : 'Usuario';
      estadoBorradoHTML = `<span style="font-size: 0.8rem; font-weight: 600; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 0.3rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem;">🗑️ Eliminada de muro por ${borrador} (${fechaBorrado})</span>`;
    } else {
      estadoBorradoHTML = `<span style="font-size: 0.8rem; font-weight: 600; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 0.3rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem;">📌 Activa en Muro Principal</span>`;
    }

    const commentsListHTML = comentarios.map(c => {
      const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      let nombreDisplay = c.usuario_nombre || 'Funcionario';
      if (emailToName[nombreDisplay.toLowerCase()]) {
        nombreDisplay = emailToName[nombreDisplay.toLowerCase()];
      }
      return `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong style="font-size: 0.85rem; color: #2563eb;">👤 ${S(nombreDisplay)}</strong>
            <span style="font-size: 0.75rem; color: #94a3b8;">${dateStr}</span>
          </div>
          <div style="font-size: 0.9rem; color: #334155; white-space: pre-wrap;">${S(c.comentario)}</div>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = `
      <!-- Tarjeta Principal Pop-Out -->
      <div style="background: ${pal.bg}; border: 2px solid ${pal.border}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: ${pal.headerBg}; padding: 0.65rem 1rem; border-bottom: 1px solid ${pal.border}; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; font-weight: 700; color: ${pal.accent}; text-transform: uppercase;">${pal.icon} ${pal.label}</span>
          <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">📅 ${fechaEnvio}</span>
        </div>
        <div style="padding: 1.25rem;">
          <div style="font-size: 0.85rem; color: #475569; margin-bottom: 0.85rem; border-bottom: 1px dashed ${pal.border}; padding-bottom: 0.6rem;">
            <div><strong>De:</strong> ${S(nota.emisor_nombre || 'Dirección')}</div>
            <div><strong>Para:</strong> ${S(nota.receptor_nombre || 'Todo el Equipo')}</div>
          </div>
          <div style="font-size: 1rem; color: #1e293b; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
            ${S(nota.mensaje)}
          </div>
        </div>
      </div>

      <!-- Resumen Trazable Auditado -->
      <div style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
        <h4 style="margin: 0; font-size: 0.88rem; color: #334155; text-transform: uppercase; letter-spacing: 0.04em;">📊 Estado de Trazabilidad Institucional</h4>
        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
          ${estadoLecturaHTML}
          ${estadoBorradoHTML}
        </div>
      </div>

      <!-- Hilo de Respuestas y Evidencia -->
      <div style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
        <h4 style="margin: 0; font-size: 0.9rem; color: #1e293b; display: flex; align-items: center; gap: 0.35rem;">
          💬 Hilo de Comentarios & Evidencia (${comentarios.length})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.65rem; max-height: 220px; overflow-y: auto; background: #f8fafc; padding: 0.65rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          ${comentarios.length > 0 ? commentsListHTML : `<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 1rem;">No hay comentarios o sellos registrados para esta nota.</div>`}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
  }

  function closeRevisarNotaModal() {
    const modal = document.getElementById('modal-revisar-nota');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  }

  // Safe string sanitizer
  function S(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    render,
    setFilter,
    openCreateModal,
    closeCreateModal,
    handleSaveNota,
    handleMarcarLeida,
    handleEliminarNota,
    handlePurgarNota,
    openCommentThread,
    closeCommentThread,
    handleSendComment,
    openRevisarNotaModal,
    closeRevisarNotaModal,
    toggleSelectAllDestinatarios,
    setVisibilidadNota,
    filtrarDestinatarios
  };
})();

window.NotasView = NotasView;
