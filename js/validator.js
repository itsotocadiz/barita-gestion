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

  function getYoutubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const s = url.trim();
    try {
      const parsed = new URL(s.startsWith('http') ? s : 'https://' + s);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const validHosts = ['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'];
      if (!validHosts.includes(host)) return null;

      let id = null;
      if (host === 'youtu.be') {
        id = parsed.pathname.slice(1).split('/')[0];
      } else if (parsed.pathname.startsWith('/embed/')) {
        id = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/shorts/')) {
        id = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/v/')) {
        id = parsed.pathname.split('/')[2];
      } else {
        id = parsed.searchParams.get('v');
      }

      if (id && /^[\w-]{11}$/.test(id)) {
        return id;
      }
    } catch (_) {}

    const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return (m && /^[\w-]{11}$/.test(m[1])) ? m[1] : null;
  }

  function isYoutubeUrl(val) {
    if (!val || typeof val !== 'string') return false;
    const v = val.trim();
    if (!v.includes('youtube.com') && !v.includes('youtu.be') && !v.includes('youtube-nocookie.com')) return false;
    return !!getYoutubeVideoId(v);
  }

  const DRIVE_REGEX = /^https:\/\/(drive|docs)\.google\.com\/(file\/d\/|open\?id=|uc\?id=)[-\w]{25,}/;

  function getDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    const s = url.trim();
    try {
      const parsed = new URL(s.startsWith('http') ? s : 'https://' + s);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

      const matchPath = parsed.pathname.match(/\/file\/d\/([-\w]{25,})/);
      if (matchPath && matchPath[1]) return matchPath[1];

      const idParam = parsed.searchParams.get('id');
      if (idParam && /^([-\w]{25,})$/.test(idParam)) return idParam;
    } catch (_) {}

    const m = s.match(/google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([-\w]{25,})/);
    return (m && /^([-\w]{25,})$/.test(m[1])) ? m[1] : null;
  }

  function isDriveUrl(val) {
    if (!val || typeof val !== 'string') return false;
    const s = val.trim();
    return DRIVE_REGEX.test(s) && !!getDriveFileId(s);
  }

  function isAllowedVideoUrl(val) {
    return isYoutubeUrl(val) || isDriveUrl(val);
  }

  function normalizeVideoUrl(val) {
    if (!val || typeof val !== 'string') return '';
    const s = val.trim();
    const ytId = getYoutubeVideoId(s);
    if (ytId) {
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}`;
    }
    const driveId = getDriveFileId(s);
    if (driveId) {
      return `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`;
    }
    return '';
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
