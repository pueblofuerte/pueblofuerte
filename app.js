// ══════════════════════════════════════════════════════════════════
// Iglesia Pueblo Fuerte — Panel administrativo
// Habla con el mismo Apps Script que usa la app Android (ver config.js).
// ══════════════════════════════════════════════════════════════════

let anunciosCache = [];
let eventosCache = [];

// ── Llamada genérica al Apps Script ──────────────────────────────────
// Content-Type "text/plain" evita el preflight CORS que Apps Script no
// maneja bien; el propio script igual lee el JSON desde postData.contents.
async function llamarScript(payload) {
  if (!SCRIPT_URL || SCRIPT_URL.indexOf('PEGA_AQUI') !== -1) {
    throw new Error('Falta configurar SCRIPT_URL en config.js');
  }
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Error de red: ' + res.status);
  return res.json();
}

function getClave() {
  return sessionStorage.getItem('adminKey') || '';
}

// ── Sesión ────────────────────────────────────────────────────────────
async function iniciarSesion() {
  const clave = document.getElementById('inputClave').value.trim();
  const msg = document.getElementById('msgLogin');
  if (!clave) { msg.textContent = 'Escribe tu clave de administrador.'; msg.className = 'msg error'; return; }

  msg.textContent = 'Verificando…';
  msg.className = 'msg';
  sessionStorage.setItem('adminKey', clave);

  try {
    // Cualquier acción admin sirve para validar la clave.
    const resp = await llamarScript({ action: 'listar_anuncios_admin', adminKey: clave });
    if (resp.error) {
      msg.textContent = resp.error;
      msg.className = 'msg error';
      sessionStorage.removeItem('adminKey');
      return;
    }
    document.getElementById('vistaLogin').style.display = 'none';
    document.getElementById('vistaPanel').style.display = 'block';
    cargarAnuncios();
    cargarEventos();
    cargarPeticiones();
  } catch (e) {
    msg.textContent = 'No se pudo conectar: ' + e.message;
    msg.className = 'msg error';
  }
}

function cerrarSesion() {
  sessionStorage.removeItem('adminKey');
  document.getElementById('vistaPanel').style.display = 'none';
  document.getElementById('vistaLogin').style.display = 'block';
}

// Si ya había sesión en este navegador (sessionStorage dura hasta cerrar la pestaña)
window.addEventListener('DOMContentLoaded', () => {
  if (getClave()) iniciarSesion0();
});
async function iniciarSesion0() {
  document.getElementById('inputClave').value = getClave();
  await iniciarSesion();
}

// ── Tabs ──────────────────────────────────────────────────────────────
function cambiarTab(nombre) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nombre));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + nombre));
}

// ══════════════════════════════════════════════════════════════════
// ANUNCIOS
// ══════════════════════════════════════════════════════════════════

async function cargarAnuncios() {
  const cont = document.getElementById('listaAnuncios');
  try {
    const resp = await llamarScript({ action: 'listar_anuncios_admin', adminKey: getClave() });
    anunciosCache = resp.anuncios || [];
    pintarAnuncios();
  } catch (e) {
    cont.innerHTML = '<p class="empty-text">Error cargando anuncios: ' + e.message + '</p>';
  }
}

function pintarAnuncios() {
  const cont = document.getElementById('listaAnuncios');
  if (anunciosCache.length === 0) {
    cont.innerHTML = '<p class="empty-text">Aún no hay anuncios.</p>';
    return;
  }
  cont.innerHTML = anunciosCache.map(a => `
    <div class="list-item">
      <div class="info">
        <strong>${escapeHtml(a.titulo)}</strong>
        <span>
          <span class="badge ${a.tipo === 'predicador' ? '' : 'gris'}">${a.tipo === 'predicador' ? 'PREDICADOR' : 'GENERAL'}</span>
          ${a.flotante ? '<span class="badge dorado">FLOTANTE</span>' : ''}
          ${a.activo ? '' : '<span class="badge gris">INACTIVO</span>'}
          · ${escapeHtml(a.fecha)}
        </span>
      </div>
      <div class="actions">
        <button class="secondary" onclick="editarAnuncio('${a.id}')">Editar</button>
        <button class="secondary" onclick="toggleAnuncio('${a.id}', ${!a.activo})">${a.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="danger" onclick="eliminarAnuncio('${a.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function editarAnuncio(id) {
  const a = anunciosCache.find(x => x.id === id);
  if (!a) return;
  document.getElementById('anuncioId').value = a.id;
  document.getElementById('anuncioTipo').value = a.tipo;
  document.getElementById('anuncioTitulo').value = a.titulo;
  document.getElementById('anuncioContenido').value = a.contenido;
  document.getElementById('anuncioFlotante').checked = a.flotante;
  document.getElementById('anuncioActivo').checked = a.activo;
  document.getElementById('tituloFormAnuncio').textContent = 'Editando anuncio';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormAnuncio() {
  document.getElementById('anuncioId').value = '';
  document.getElementById('anuncioTipo').value = 'predicador';
  document.getElementById('anuncioTitulo').value = '';
  document.getElementById('anuncioContenido').value = '';
  document.getElementById('anuncioFlotante').checked = false;
  document.getElementById('anuncioActivo').checked = true;
  document.getElementById('tituloFormAnuncio').textContent = 'Nuevo anuncio';
  document.getElementById('msgAnuncio').textContent = '';
}

async function guardarAnuncio() {
  const msg = document.getElementById('msgAnuncio');
  const payload = {
    action: 'guardar_anuncio',
    adminKey: getClave(),
    id: document.getElementById('anuncioId').value || undefined,
    tipo: document.getElementById('anuncioTipo').value,
    titulo: document.getElementById('anuncioTitulo').value.trim(),
    contenido: document.getElementById('anuncioContenido').value.trim(),
    flotante: document.getElementById('anuncioFlotante').checked,
    activo: document.getElementById('anuncioActivo').checked
  };
  msg.textContent = 'Guardando…'; msg.className = 'msg';
  try {
    const resp = await llamarScript(payload);
    if (!resp.ok) { msg.textContent = resp.error || 'Error al guardar'; msg.className = 'msg error'; return; }
    msg.textContent = 'Guardado ✓'; msg.className = 'msg ok';
    limpiarFormAnuncio();
    cargarAnuncios();
  } catch (e) {
    msg.textContent = 'Error: ' + e.message; msg.className = 'msg error';
  }
}

async function toggleAnuncio(id, nuevoValor) {
  await llamarScript({ action: 'toggle_anuncio_activo', adminKey: getClave(), id, activo: nuevoValor });
  cargarAnuncios();
}

async function eliminarAnuncio(id) {
  if (!confirm('¿Eliminar este anuncio?')) return;
  await llamarScript({ action: 'eliminar_anuncio', adminKey: getClave(), id });
  cargarAnuncios();
}

// ══════════════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════════════

async function cargarEventos() {
  const cont = document.getElementById('listaEventos');
  try {
    const resp = await llamarScript({ action: 'listar_eventos_admin', adminKey: getClave() });
    eventosCache = resp.eventos || [];
    pintarEventos();
  } catch (e) {
    cont.innerHTML = '<p class="empty-text">Error cargando eventos: ' + e.message + '</p>';
  }
}

function pintarEventos() {
  const cont = document.getElementById('listaEventos');
  if (eventosCache.length === 0) {
    cont.innerHTML = '<p class="empty-text">Aún no hay eventos.</p>';
    return;
  }
  cont.innerHTML = eventosCache.map(ev => `
    <div class="list-item">
      <div class="info">
        <strong>${escapeHtml(ev.etiqueta)}</strong>
        <span>${ev.activo ? 'Activo' : 'Inactivo'} · ${escapeHtml(ev.fecha)}</span>
      </div>
      <div class="actions">
        <button class="secondary" onclick="toggleEvento('${ev.id}', ${!ev.activo})">${ev.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="danger" onclick="eliminarEvento('${ev.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function leerArchivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // quita el prefijo data:...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function guardarEvento() {
  const msg = document.getElementById('msgEvento');
  const etiqueta = document.getElementById('eventoEtiqueta').value.trim();
  const archivo = document.getElementById('eventoImagen').files[0];

  if (!etiqueta) { msg.textContent = 'La etiqueta es obligatoria.'; msg.className = 'msg error'; return; }
  if (!archivo) { msg.textContent = 'Selecciona una imagen.'; msg.className = 'msg error'; return; }

  msg.textContent = 'Subiendo imagen…'; msg.className = 'msg';
  try {
    const base64 = await leerArchivoComoBase64(archivo);
    const resp = await llamarScript({
      action: 'guardar_evento',
      adminKey: getClave(),
      etiqueta,
      activo: document.getElementById('eventoActivo').checked,
      imagenBase64: base64,
      imagenNombre: archivo.name,
      imagenTipo: archivo.type
    });
    if (!resp.ok) { msg.textContent = resp.error || 'Error al guardar'; msg.className = 'msg error'; return; }
    msg.textContent = 'Evento guardado ✓'; msg.className = 'msg ok';
    document.getElementById('eventoEtiqueta').value = '';
    document.getElementById('eventoImagen').value = '';
    cargarEventos();
  } catch (e) {
    msg.textContent = 'Error: ' + e.message; msg.className = 'msg error';
  }
}

async function toggleEvento(id, nuevoValor) {
  await llamarScript({ action: 'toggle_evento_activo', adminKey: getClave(), id, activo: nuevoValor });
  cargarEventos();
}

async function eliminarEvento(id) {
  if (!confirm('¿Eliminar este evento? También se borra el flyer de Drive.')) return;
  await llamarScript({ action: 'eliminar_evento', adminKey: getClave(), id });
  cargarEventos();
}

// ══════════════════════════════════════════════════════════════════
// PETICIONES (solo lectura)
// ══════════════════════════════════════════════════════════════════

async function cargarPeticiones() {
  const cont = document.getElementById('listaPeticiones');
  try {
    const resp = await llamarScript({ action: 'obtener_peticiones' });
    const peticiones = resp.peticiones || [];
    if (peticiones.length === 0) {
      cont.innerHTML = '<p class="empty-text">Aún no hay peticiones.</p>';
      return;
    }
    cont.innerHTML = peticiones.map(p => `
      <div class="list-item">
        <div class="info">
          <strong>${escapeHtml(p.texto)}</strong>
          <span>${escapeHtml(p.fecha)}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    cont.innerHTML = '<p class="empty-text">Error cargando peticiones: ' + e.message + '</p>';
  }
}

// ── Util ────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
