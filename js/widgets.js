/* ================================================================
   widgets.js — Motor de Widgets
   Componentes visuales reutilizables para Dashboards.
   Nota: los renderers genéricos fueron eliminados.
   Se deja stub para nuevos widgets personalizados.
   ================================================================ */

const Widgets = (() => {
  return {
    render(config) {
      return `<div class="card"><div class="card-body text-muted">Widget pendiente de implementación: ${config.type || 'desconocido'}</div></div>`;
    }
  };
})();

window.Widgets = Widgets;
