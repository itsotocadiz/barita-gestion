/* help.js - BARITA HelpCircle dual Manual+LIRMI - Scrumban S1 */
const BaritaHelp = {
  registry: {
    dashboard: { title: 'Dashboard', text: 'Cola priorizada de seguimientos vencidos y de hoy. Tu meta es dejarlo en 0. Si reprogramas fecha próxima, desaparece de aquí.' },
    cursos: { title: 'Cursos', text: 'Foto de tus cursos del año seleccionado. Entra a uno para ver su lista. Importar Excel LIRMI carga estudiantes/anotaciones sin duplicar.' },
    ficha_estudiante: { title: 'Ficha Estudiante', text: 'Historia transversal 2024-2026. Bitácora + casos + PACI/PIE no se borran al cambiar de año. Añade evidencia Manual o vinculada de LIRMI.' },
    ficha_funcionario: { title: 'Ficha Funcionario', text: 'Acompañamiento docente anual: licencias, permisos, fiscalizaciones UTP. Continuidad 2025→2026. No es asistencia diaria (eso es LIRMI).' },
    casos: { title: 'Casos', text: 'Dual: Manual (vacío) o Vincular evidencia LIRMI (Excel). Se guarda en caso_anotaciones con origen manual|lirmi_excel. No comunica a apoderados.' },
    convivencia: { title: 'Convivencia', text: 'Protocolos RICE en ejecución (24h/5d). Cruza anotaciones LIRMI con tu RICE. Es tu evidencia para Superintendencia.' },
    pie: { title: 'PIE', text: 'Alumnos con adecuaciones. PACI queda aquí, no en LIRMI. Historia no se pierde.' },
    utp: { title: 'UTP', text: 'No es leccionario (LIRMI). Es alerta de trayectoria: antecedente LIRMI + caso activo = gestión UTP.' },
    inspectoria: { title: 'Seguimiento y Cumplimiento', text: 'Tu radar: ¿Quién no cumplió fecha? Custodias que nada quede vencido.' },
    agenda: { title: 'Agenda', text: 'Reuniones y citaciones internas. Lo de hoy te alerta en Dashboard.' },
    notas: { title: 'Muro Notas', text: 'Comunicación entre estamentos (UTP-Convivencia-PIE-Dirección). No va a apoderados.' },
    pise: { title: 'PISE', text: 'Plan integral seguridad escolar. Documentos y simulacros.' },
    finanzas: { title: 'Finanzas', text: 'Gastos SEP/PIE. Solo Dirección/Admin.' },
    documentos: { title: 'Documentos', text: 'Repositorio de evidencia por caso (actas, compromisos).' },
    director: { title: 'Dirección', text: '4 números: casos vencidos, docentes con licencia >10d, estudiantes >15% inasistencia, PACI incompletos.' }
  },
  create(id) {
    const d = this.registry[id]; if (!d) return '';
    const uid = `help-${id}-${Math.random().toString(36).slice(2,6)}`;
    const title = (typeof Storage!=='undefined'&&Storage.escapeHtml)?Storage.escapeHtml(d.title):d.title;
    const text = (typeof Storage!=='undefined'&&Storage.escapeHtml)?Storage.escapeHtml(d.text):d.text;
    return `<span class="barita-help-wrap"><button type="button" class="barita-help-trigger" aria-label="Ayuda: ${title}" aria-expanded="false" aria-controls="${uid}" data-help-id="${id}">?</button><div id="${uid}" class="barita-help-popover" role="dialog" aria-label="${title}" hidden><p class="barita-help-title">${title}</p><p class="barita-help-text">${text}</p></div></span>`;
  },
  bind(root=document){
    root.addEventListener('click', e=>{
      const btn = e.target.closest('.barita-help-trigger');
      if(!btn) {
        // click fuera cierra todos
        if(!e.target.closest('.barita-help-popover')) {
          root.querySelectorAll('.barita-help-trigger[aria-expanded="true"]').forEach(b=>{
            b.setAttribute('aria-expanded','false');
            const p=document.getElementById(b.getAttribute('aria-controls')); if(p){ p.hidden=true; p.classList.remove('is-open'); }
          });
        }
        return;
      }
      const pop = document.getElementById(btn.getAttribute('aria-controls'));
      const open = btn.getAttribute('aria-expanded')==='true';
      root.querySelectorAll('.barita-help-trigger[aria-expanded="true"]').forEach(b=>{
        if(b!==btn){ b.setAttribute('aria-expanded','false'); const pp=document.getElementById(b.getAttribute('aria-controls')); if(pp){ pp.hidden=true; pp.classList.remove('is-open'); } }
      });
      if(!open){ btn.setAttribute('aria-expanded','true'); pop.hidden=false; requestAnimationFrame(()=>pop.classList.add('is-open')); }
      else { btn.setAttribute('aria-expanded','false'); pop.classList.remove('is-open'); setTimeout(()=>pop.hidden=true,180); }
    });
    root.addEventListener('keydown', e=>{ if(e.key==='Escape') root.querySelectorAll('.barita-help-trigger[aria-expanded="true"]').forEach(b=>b.click()); });
  }
};
document.addEventListener('DOMContentLoaded', ()=> BaritaHelp.bind());
window.BaritaHelp = BaritaHelp;
