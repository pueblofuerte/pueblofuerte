# Panel Admin — Iglesia Pueblo Fuerte

Sitio estático (HTML/CSS/JS, sin build, sin dependencias) para administrar
Anuncios, Eventos y ver Peticiones. Habla directo con tu Apps Script.

## Publicar en GitHub Pages con GitHub Desktop

1. Abre **GitHub Desktop** → **File → New repository**.
   - Nombre: por ejemplo `pueblo-fuerte-admin`.
   - Local path: donde quieras.
   - Deja "Initialize with a README" desmarcado (ya trae uno).
2. Copia **todo el contenido de esta carpeta** (`index.html`, `style.css`,
   `app.js`, `config.js`, este `README.md`) directo dentro de la carpeta
   del repositorio que acabas de crear (sin subcarpeta intermedia).
3. En GitHub Desktop: verás los archivos como cambios pendientes →
   escribe un mensaje (ej. "Primera versión") → **Commit to main**.
4. **Publish repository** (arriba a la derecha). Puede ser público o privado
   — si tu plan de GitHub es gratuito y quieres Pages, el repo debe ser
   **público** (GitHub Pages gratis no funciona en repos privados en
   cuentas free).
5. Ve a **github.com** → tu repositorio → **Settings → Pages**.
   - Source: **Deploy from a branch**.
   - Branch: **main**, carpeta **/ (root)**.
   - Guardar.
6. Espera 1–2 minutos. Tu panel queda en:
   `https://TU-USUARIO.github.io/pueblo-fuerte-admin/`

## Antes de usarlo: configura `config.js`

Abre `config.js` y reemplaza la URL:

```js
const SCRIPT_URL = "PEGA_AQUI_TU_URL_DE_APPS_SCRIPT";
```

por la URL `/exec` que te da Apps Script al implementar el backend
(ver `Code.gs` — es un archivo aparte, no va en este repo de GitHub Pages,
se pega directo en el editor de Apps Script). Guarda, haz commit y push
de nuevo desde GitHub Desktop — GitHub Pages se actualiza solo en 1-2 min.

## Primer ingreso

La clave de administrador la genera `configurarProyecto()` en Apps Script
(queda escrita en los "Registros/Logs" de esa ejecución). Cópiala y
pégala en la pantalla de login del panel — se guarda solo en el navegador
mientras la pestaña está abierta (`sessionStorage`), no queda en el código.

## Qué hace cada archivo

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de las 3 pestañas: Anuncios, Eventos, Peticiones |
| `style.css` | Estilos — misma paleta azul/dorado de la app |
| `config.js` | El único archivo que editas: la URL de tu Apps Script |
| `app.js` | Toda la lógica: login, listar/crear/editar/borrar anuncios y eventos, subir flyers |
