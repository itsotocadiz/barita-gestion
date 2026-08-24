/* skills.js — Skills internas de BARITA para postulaciones, matching e informes */
(() => {
const BaritaSkills = {
  SkillPerfilPostulante: {
    armarPerfil(postulante) {
      if (!postulante) return null;
      return {
        cargo: postulante.cargo || '',
        experiencia: Number(postulante.experiencia) || 0,
        especialidad: postulante.especialidad || '',
        nivel: postulante.nivel || '',
        metodologia: postulante.metodologia || '',
        convivencia: postulante.convivencia || '',
        diversidad: postulante.diversidad || '',
        disponibilidad: postulante.disponibilidad || '',
        modalidad: postulante.modalidad || '',
        filosofia: postulante.filosofia || '',
        presentacion: postulante.presentacion || ''
      };
    }
  },
  SkillPerfilColegio: {
    armarPerfil(formulario) {
      if (!formulario) return null;
      return {
        cargo: formulario.cargo || '',
        especialidad: formulario.especialidad || '',
        nivel: formulario.nivel || '',
        experienciaMinima: Number(formulario.experienciaMinima) || 0,
        metodologia: formulario.metodologia || '',
        convivencia: formulario.convivencia || '',
        diversidad: formulario.diversidad || '',
        disponibilidad: formulario.disponibilidad || '',
        modalidad: formulario.modalidad || '',
        filosofia: formulario.filosofia || ''
      };
    }
  },
  SkillMatchingIA: {
    defaultThreshold: 70,
    calcularMatch(perfilPostulante, perfilColegio) {
      if (!perfilPostulante || !perfilColegio) return 0;
      let score = 0;
      if (perfilColegio.cargo && perfilPostulante.cargo === perfilColegio.cargo) score += 20;
      if (perfilColegio.especialidad && perfilPostulante.especialidad === perfilColegio.especialidad) score += 10;
      if (perfilColegio.nivel && perfilPostulante.nivel === perfilColegio.nivel) score += 10;
      if (perfilPostulante.experiencia >= perfilColegio.experienciaMinima) score += 10;
      if (perfilColegio.metodologia && perfilPostulante.metodologia === perfilColegio.metodologia) score += 5;
      if (perfilColegio.convivencia && perfilPostulante.convivencia === perfilColegio.convivencia) score += 5;
      if (perfilColegio.diversidad && perfilPostulante.diversidad === perfilColegio.diversidad) score += 5;
      if (perfilColegio.filosofia && perfilPostulante.filosofia === perfilColegio.filosofia) score += 5;
      if (perfilColegio.disponibilidad && perfilPostulante.disponibilidad === perfilColegio.disponibilidad) score += 5;
      if (perfilColegio.modalidad && perfilPostulante.modalidad === perfilColegio.modalidad) score += 5;
      return Math.max(0, Math.min(score, 100));
    },
    filtrarPorUmbral(candidatos, umbral) {
      const threshold = Number(umbral) || this.defaultThreshold;
      return candidatos.filter(c => (c.matchScore || 0) >= threshold);
    }
  },
  SkillEntrevistador: {
    generarPreguntas(perfil) {
      const base = `Eres entrevistador escolar. Genera 5 preguntas conductuales breves para este perfil: ${JSON.stringify(perfil || {})}. Devuelve lista simple.`;
      const responder = () => {
        AIClient.call('Eres entrevistador escolar experto.', base)
          .then(t => typeof t === 'string' ? t : JSON.stringify(t))
          .catch(() => 'No se pudieron generar preguntas automáticas ahora.');
      };
      if (AIClient) responder();
      return base;
    }
  },
  SkillRedactorIA: {
    async generarCorreo(systemInstruction, contexto) {
      try {
        const text = await AIClient.call(systemInstruction, contexto);
        return text;
      } catch (e) {
        throw e;
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
  },
  SkillReportesIA: {
    generarInformeEstudiante(estudiantes, anotacionesPorEstudiante) {
      const perfiles = (estudiantes || []).slice(0, 20).map(e => {
        const anotaciones = anotacionesPorEstudiante[e.id] || [];
        const paciTotal = Array.isArray(e.paci) ? e.paci.length : 0;
        const paciHechos = Array.isArray(e.paci) ? e.paci.filter(Boolean).length : 0;
        return `${e.nombres || ''} ${e.apellidos || ''}: ${anotaciones.length} anotaciones, PACI ${paciHechos}/${paciTotal}, progreso ${e.progresoPIE ?? '-'}%`;
      }).join('\n');
      return `Informe por estudiante:\n${perfiles || 'Sin datos disponibles'}`;
    },
    generarInformeFuncionario(funcionarios, accionesPorFuncionario) {
      const lineas = (funcionarios || []).slice(0, 20).map(f => {
        const acts = accionesPorFuncionario[f.id] || [];
        const clima = acts.length;
        const felicitaciones = acts.filter(a => a && a.tipo === 'felicitacion').length;
        return `${f.nombres || ''} ${f.apellidos || ''}: cargo ${f.cargo || '-'}, clima ${clima}, felicitaciones ${felicitaciones}`;
      });
      return `Informe por funcionario:\n${lineas.join('\n') || 'Sin datos disponibles'}`;
    },
    generarInformeInstitucional(stats, anotaciones, casos) {
      const resumen = {
        totalEstudiantes: stats.totalEstudiantes,
        totalAnotaciones: stats.totalAnotaciones,
        totalCasosGraves: stats.totalCasosGraves,
        totalFuncionarios: stats.totalFuncionarios
      };
      return `Informe institucional:\n${JSON.stringify(resumen, null, 2)}`;
    }
  }
};
window.BaritaSkills = BaritaSkills;
})();
