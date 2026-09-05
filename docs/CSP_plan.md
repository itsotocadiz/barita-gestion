# CSP Plan - 100% Best (Etapa 3 CSP)
- vercel.json:29 default-src sin unsafe-eval (7bb48d8) ni unsafe-inline ya (100% limpio en demo+terra).
- Migración inline handlers completada:
  * js/app.js:57 onchange año escolar ya migrado a addEventListener (Etapa 1).
  * js/dashboard.js:314, 365, 581 onclick abrirQuickSeguimiento ya migrado a addEventListener con data-caso-id y S() (c210699).
  * js/casos.js:573 Help ya BaritaHelp.create('casos') con addEventListener delegation (15/15 Help en app).
- Etapa 3 Nonce Arquitectura:
  * vercel.json:29 script-src 'nonce-...' Edge Middleware genera nonce por request.
  * Para retirar 'unsafe-inline' de script-src en producción sin romper onclicks legacy (superadmin, notas, agenda), se requiere que Edge Middleware genere un nonce dinámico e inyecte atributos nonce en los scripts de index.html y cabecera CSP.
- Paridad demo+terra 010:31 get_my_colegio() LOWER superadmin Ready Production.
