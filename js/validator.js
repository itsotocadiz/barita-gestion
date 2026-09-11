/* ================================================================
   validator.js — Módulo centralizado para validación de datos
   Previene XSS, inyecciones y valida formatos antes de Firestore
   ================================================================ */

const Validator = (() => {
  function isValidRut(rut) {
    if (!rut || typeof rut !== 'string') return false;
    const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length < 8) return false;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const expectedDv = 11 - (sum % 11);
    const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();

    return dv === calculatedDv;
  }

  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function isValidString(str, minLength = 1, maxLength = 255) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    return trimmed.length >= minLength && trimmed.length <= maxLength;
  }

  function stripHtml(str) {
    if (typeof str !== 'string') return str;
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      return DOMPurify.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }
    return str.replace(/<[^>]*>?/gm, '');
  }

  function validatePersona(data) {
    const errors = [];

    if (data.rut && !isValidRut(data.rut)) {
      errors.push('El RUT ingresado no es válido.');
    }
    if (data.correo && !isValidEmail(data.correo)) {
      errors.push('El correo electrónico no es válido.');
    }
    if (!isValidString(data.nombres, 2, 100)) {
      errors.push('El nombre es requerido y debe tener entre 2 y 100 caracteres.');
    }
    if (!isValidString(data.apellidos, 2, 100)) {
      errors.push('El apellido es requerido y debe tener entre 2 y 100 caracteres.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  function formatRutWithoutDots(val) {
    if (!val || typeof val !== 'string') return '';
    let clean = val.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length === 0) return '';
    if (clean.length < 8) return clean;
    if (clean.length > 9) clean = clean.slice(0, 9);
    
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body}-${dv}`;
  }

  function attachRutInputHandler(inputId, feedbackId) {
    const inputEl = typeof inputId === 'string' ? document.getElementById(inputId) : inputId;
    const feedbackEl = typeof feedbackId === 'string' ? document.getElementById(feedbackId) : feedbackId;
    if (!inputEl) return;

    const handler = () => {
      const raw = inputEl.value;
      const formatted = formatRutWithoutDots(raw);
      inputEl.value = formatted;
      if (feedbackEl) {
        const clean = raw.replace(/[^0-9kK]/g, '');
        if (clean.length === 0) {
          feedbackEl.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted);">Sin puntos. Ej: 12345678-5</span>';
        } else if (clean.length < 8) {
          feedbackEl.innerHTML = '<span style="font-size: 0.75rem; color: #f59e0b; font-weight: 500;">Ingresando RUT... (mínimo 8 dígitos)</span>';
        } else if (isValidRut(formatted)) {
          feedbackEl.innerHTML = '<span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">✓ RUT completo y válido</span>';
        } else {
          feedbackEl.innerHTML = '<span style="font-size: 0.75rem; color: #ef4444; font-weight: 600;">✗ RUT inválido (revisa el dígito verificador)</span>';
        }
      }
    };

    inputEl.addEventListener('input', handler);
    if (inputEl.value) handler();
  }

  function getDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (!host.endsWith('drive.google.com') && !host.endsWith('docs.google.com')) return null;
      const pathMatch = parsed.pathname.match(/\/file\/d\/([-\w]{25,})/i);
      if (pathMatch && pathMatch[1]) return pathMatch[1];
      const idParam = parsed.searchParams.get('id');
      if (idParam && /^[-\w]{25,}$/.test(idParam)) return idParam;
    } catch (_) {}
    return null;
  }

  function isDriveUrl(url) {
    return !!getDriveFileId(url);
  }

  function getYoutubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'youtube.com' && !host.endsWith('.youtube.com') && host !== 'youtu.be') return null;
      if (host === 'youtu.be') {
        const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      const v = parsed.searchParams.get('v');
      return (v && /^[\w-]{11}$/.test(v)) ? v : null;
    } catch (_) {}
    return null;
  }

  function isYoutubeUrl(url) {
    return !!getYoutubeVideoId(url);
  }

  function isAllowedVideoUrl(url) {
    return isYoutubeUrl(url) || isDriveUrl(url);
  }

  function normalizeVideoUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    const ytId = getYoutubeVideoId(trimmed);
    if (ytId) {
      return `https://www.youtube-nocookie.com/embed/${ytId}`;
    }
    const driveId = getDriveFileId(trimmed);
    if (driveId) {
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }
    return trimmed;
  }

  return {
    isValidRut,
    formatRutWithoutDots,
    attachRutInputHandler,
    isValidEmail,
    isValidString,
    stripHtml,
    validatePersona,
    isDriveUrl,
    getDriveFileId,
    isYoutubeUrl,
    getYoutubeVideoId,
    isAllowedVideoUrl,
    normalizeVideoUrl
  };
})();

if (typeof window !== 'undefined') {
  window.Validator = Validator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validator;
}
