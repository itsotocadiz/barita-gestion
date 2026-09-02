/* ================================================================
   director.js — Módulo Directora
   Vista ejecutiva con indicadores clave y acceso a informes.
   ================================================================ */

window.DirectoraView = (() => {
  return {
    render(container) {
      App.setBreadcrumb(`Directora ${typeof BaritaHelp!=='undefined'?BaritaHelp.create('director'):''}`);
      const stats = Storage.getStats();
      const anotaciones = Storage.getAnotacionesByEstudiante();
      const casos = Storage.getCasos();

      const resumen = typeof BaritaSkillsGestion !== 'undefined' && BaritaSkillsGestion.SkillDirector
        ? BaritaSkillsGestion.SkillDirector.resumirParaDirector({
            year: stats.year,
            estudiantes: stats.totalEstudiantes,
            funcionarios: stats.totalFuncionarios,
            anotaciones: stats.totalAnotaciones,
            casosAbiertos: casos.filter(c => c && c.estado && c.estado !== 'cerrado').length
          })
        : `Año ${stats.year}: Estudiantes ${stats.totalEstudiantes}, Funcionarios ${stats.totalFuncionarios}, Anotaciones ${stats.totalAnotaciones}`;

      container.innerHTML = `
        <div class="card mb-4" style="border-top: 4px solid var(--primary);">
          <div class="card-header"><h2 style="margin:0; color: var(--primary);">👩‍💼 Dirección</h2></div>
        </div>
        <div class="dashboard-grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem;">
          <div class="card">
            <div class="card-header"><h3 class="card-title">Resumen Ejecutivo</h3></div>
            <div class="card-body">
              <div class="ai-insight" style="font-size:1.1rem; line-height:1.6;">
                ${resumen}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">Acciones Directas</h3></div>
            <div class="card-body text-center">
               <button class="btn btn-secondary w-100 mb-3" onclick="window.location.hash='#/informes'">Generar Informes</button>
               <button class="btn btn-primary w-100 mb-3" onclick="window.location.hash='#/protocolos'">Revisar Protocolos</button>
               <button class="btn btn-danger w-100" onclick="window.location.hash='#/casos'">Monitorear Casos Críticos</button>
            </div>
          </div>
        </div>
      `;
    }
  };
})();
