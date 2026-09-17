// ══════════════════════════════════════════════════════════════════
// Iglesia Pueblo Fuerte — Panel administrativo
// Habla con el mismo Apps Script que usa la app Android (ver config.js).
// ══════════════════════════════════════════════════════════════════

let anunciosCache = [];
let eventosCache = [];

const DIAS_PREDICADOR = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
let diasPredicador = []; // [{dia:'Lunes', nombre:'Juan'}, ...]

// ── Llamada genérica al Apps Script ──────────────────────────────────
// Content-Type "text/plain" evita el preflight CORS que Apps Script no
// maneja bien; el propio script igual lee el JSON desde postData.contents.
async function llamarScript(payload, intento = 1) {
  if (!SCRIPT_URL || SCRIPT_URL.indexOf('PEGA_AQUI') !== -1) {
    throw new Error('Falta configurar SCRIPT_URL en config.js');
  }
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Error de red: ' + res.status);
  const data = await res.json();

  // Apps Script a veces "pierde" el cuerpo del POST al seguir su propia
  // redirección interna, y el script responde como si no hubiera acción.
  // Cuando pasa, reintentamos una vez automáticamente antes de mostrar error.
  const pareceRedireccionRota = !data.ok && typeof data.error === 'string' &&
    data.error.indexOf('Acción no reconocida') !== -1;

  if (pareceRedireccionRota && intento < 3) {
    await new Promise(r => setTimeout(r, 400));
    return llamarScript(payload, intento + 1);
  }

  return data;
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
  actualizarModoAnuncio();

  const inputNombre = document.getElementById('predicadorNombreInput');
  inputNombre.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      agregarDiaPredicador();
    }
  });
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

// Muestra/oculta el editor según el tipo de anuncio elegido.
// Predicador de la semana: se arma día por día y no tiene flotante
// (la app ya ignora ese campo para este tipo).
function actualizarModoAnuncio() {
  const tipo = document.getElementById('anuncioTipo').value;
  const esPredicador = tipo === 'predicador';

  document.getElementById('contenidoGeneralWrap').style.display = esPredicador ? 'none' : 'block';
  document.getElementById('contenidoPredicadorWrap').style.display = esPredicador ? 'block' : 'none';
  document.getElementById('filaFlotante').style.display = esPredicador ? 'none' : 'flex';

  if (esPredicador) {
    document.getElementById('anuncioFlotante').checked = false;
  }
}

function agregarDiaPredicador() {
  const input = document.getElementById('predicadorNombreInput');
  const nombre = input.value.trim();
  if (!nombre) return;
  if (diasPredicador.length >= DIAS_PREDICADOR.length) return;

  diasPredicador.push({ dia: DIAS_PREDICADOR[diasPredicador.length], nombre });
  input.value = '';
  pintarDiasPredicador();

  if (diasPredicador.length >= DIAS_PREDICADOR.length) {
    input.disabled = true;
    input.placeholder = 'Ya completaste los 5 días';
  }
}

function deshacerUltimoDia() {
  diasPredicador.pop();
  const input = document.getElementById('predicadorNombreInput');
  input.disabled = false;
  input.placeholder = 'Escribe un nombre y presiona Enter';
  pintarDiasPredicador();
}

function pintarDiasPredicador() {
  const cont = document.getElementById('predicadorLista');
  cont.innerHTML = diasPredicador.map(d =>
    `<div class="dia-chip"><strong>${escapeHtml(d.dia)}</strong>: ${escapeHtml(d.nombre)}</div>`
  ).join('');

  document.getElementById('btnDeshacerDia').style.display = diasPredicador.length > 0 ? 'inline-flex' : 'none';

  // Este textarea sigue siendo la fuente real que se envía al script.
  document.getElementById('anuncioContenido').value =
    diasPredicador.map(d => `**${d.dia}**: ${d.nombre}`).join('\n');
}

// Reconstruye la lista de días a partir de un contenido ya guardado
// (formato **Día**: Nombre, uno por línea) — para poder editarlo.
function cargarDiasPredicadorDesdeContenido(contenido) {
  diasPredicador = [];
  const lineas = (contenido || '').split('\n');
  lineas.forEach(linea => {
    const match = linea.match(/^\*\*(.+?)\*\*:\s*(.*)$/);
    if (match && DIAS_PREDICADOR.includes(match[1])) {
      diasPredicador.push({ dia: match[1], nombre: match[2].trim() });
    }
  });
  const input = document.getElementById('predicadorNombreInput');
  input.disabled = diasPredicador.length >= DIAS_PREDICADOR.length;
  input.placeholder = input.disabled ? 'Ya completaste los 5 días' : 'Escribe un nombre y presiona Enter';
  pintarDiasPredicador();
}

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
          <span class="badge ${a.tipo === 'predicador' ? '' : 'dorado'}">${a.tipo === 'predicador' ? 'PREDICADOR' : 'GENERAL'}</span>
          ${a.flotante ? '<span class="badge roja">FLOTANTE</span>' : ''}
          ${a.activo ? '' : '<span class="badge gris">INACTIVO</span>'}
          · ${escapeHtml(a.fecha)}
        </span>
      </div>
      <div class="actions">
        <button class="btn small" onclick="editarAnuncio('${a.id}')">Editar</button>
        <button class="btn small" onclick="toggleAnuncio('${a.id}', ${!a.activo})">${a.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="btn small danger" onclick="eliminarAnuncio('${a.id}')">Eliminar</button>
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

  actualizarModoAnuncio();
  if (a.tipo === 'predicador') cargarDiasPredicadorDesdeContenido(a.contenido);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormAnuncio() {
  document.getElementById('anuncioId').value = '';
  document.getElementById('anuncioTipo').value = 'general';
  document.getElementById('anuncioTitulo').value = '';
  document.getElementById('anuncioContenido').value = '';
  document.getElementById('anuncioFlotante').checked = false;
  document.getElementById('anuncioActivo').checked = true;
  document.getElementById('tituloFormAnuncio').textContent = 'Nuevo anuncio';
  document.getElementById('msgAnuncio').textContent = '';

  diasPredicador = [];
  const inputNombre = document.getElementById('predicadorNombreInput');
  inputNombre.value = '';
  inputNombre.disabled = false;
  inputNombre.placeholder = 'Escribe un nombre y presiona Enter';
  pintarDiasPredicador();

  actualizarModoAnuncio();
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
      <img class="evento-thumb" src="${escapeHtml(ev.imagenUrl)}" alt="">
      <div class="info">
        <strong>${escapeHtml(ev.etiqueta)}</strong>
        <span>${ev.activo ? 'Activo' : 'Inactivo'} · ${escapeHtml(ev.fecha)}</span>
      </div>
      <div class="actions">
        <button class="btn small" onclick="toggleEvento('${ev.id}', ${!ev.activo})">${ev.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="btn small danger" onclick="eliminarEvento('${ev.id}')">Eliminar</button>
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

// Muestra el flyer elegido antes de subirlo, para confirmar que es el correcto.
function previsualizarFlyer(input) {
  const preview = document.getElementById('previewFlyer');
  const archivo = input.files[0];
  if (!archivo) { preview.style.display = 'none'; return; }
  preview.src = URL.createObjectURL(archivo);
  preview.style.display = 'block';
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
    document.getElementById('previewFlyer').style.display = 'none';
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