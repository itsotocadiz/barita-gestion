// skills-gestion.js — Skills de gestión escolar para BARITA
// Se apoya en Storage, Auth, AIClient y la estructura actual por colecciones.

window.BaritaSkillsGestion = (() => {
  return {
    SkillTrazabilidad: {
      setAnioEscolar(anio) {
        try { Storage.setActiveYear(anio); } catch (e) {}
      },
      getAnioEscolar() {
        try { return Storage.getActiveYear(); } catch (e) { return String(new Date().getFullYear()); }
      }
    },

    SkillAsistencia: {
      calcularPorcentaje(registros) {
        if (!Array.isArray(registros)) return 100;
        const presentes = registros.filter(r => r && r.estado === 'presente').length;
        return registros.length ? Math.round((presentes / registros.length) * 100) : 100;
      }
    },

    SkillFinanzas: {
      calcularMorosidad(pagos) {
        if (!Array.isArray(pagos)) return 0;
        const pendientes = pagos.filter(p => p && p.estado !== 'pagado');
        return Math.round((pendientes.length / pagos.length) * 100) || 0;
      }
    },

    SkillPIE: {
      armarPerfilNEE(estudiante) {
        if (!estudiante) return null;
        return {
          id: estudiante.id,
          nombre: `${estudiante.nombres || ''} ${estudiante.apellidos || ''}`.trim(),
          necesidades: Array.isArray(estudiante.necesidades) ? estudiante.necesidades : [],
          adaptaciones: Array.isArray(estudiante.adaptaciones) ? estudiante.adaptaciones : [],
          progreso: typeof estudiante.progresoPIE === 'number' ? estudiante.progresoPIE : 0
        };
      }
    },

    SkillUTP: {
      contrastarPerfil(funcionario, metricas) {
        try {
          const texto = `Perfil: ${funcionario.nombres || ''} ${funcionario.apellidos || ''}. Cargo: ${funcionario.cargo || '-'}. Categoría: ${funcionario.categoria || '-'}. Indicadores: ${JSON.stringify(metricas || {})}.`;
          return texto;
        } catch (e) {
          return 'Perfil no disponible para análisis UTP.';
        }
      }
    },

    SkillDirector: {
      resumirParaDirector(datosAgregados) {
        try {
          const partes = Object.entries(datosAgregados || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
          return partes || 'Sin datos agregados disponibles.';
        } catch (e) {
          return 'Error generando resumen para director.';
        }
      }
    }
  };
})();
