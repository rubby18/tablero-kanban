/**
 * UI Service — DevFlow
 * Módulo encargado de la manipulación del DOM, renderizado de tarjetas,
 * actualización de estadísticas y control de modales.
 */

/**
 * Escapa cadenas para prevenir inyecciones XSS en el HTML dinámico
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

/**
 * Genera el HTML para el badge de prioridad diferenciado visualmente
 */
export function renderPriorityBadge(priority) {
  const norm = (priority || 'Media').toLowerCase();
  let label = 'Media';
  let badgeClass = 'media';

  if (norm === 'alta') {
    label = 'Alta';
    badgeClass = 'alta';
  } else if (norm === 'baja') {
    label = 'Baja';
    badgeClass = 'baja';
  }

  return `
    <span class="badge-priority ${badgeClass}">
      <span class="badge-priority-dot"></span>
      ${label}
    </span>
  `;
}

/**
 * Genera el elemento DOM de una tarjeta de tarea
 */
export function createTaskCardElement(task, commentCount = 0) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.dataset.id = String(task.id);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Tarea: ${task.title}, prioridad ${task.priority || 'Media'}`);

  const hasComments = commentCount > 0;

  card.innerHTML = `
    <div class="card-top">
      <span class="card-id">#${escapeHtml(task.id)}</span>
      ${renderPriorityBadge(task.priority)}
    </div>
    <h3 class="card-title">${escapeHtml(task.title)}</h3>
    <p class="card-desc">${escapeHtml(task.description || 'Sin descripción adicional.')}</p>
    <footer class="card-footer">
      <div class="card-footer-item" title="Fecha límite">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>${escapeHtml(task.dueDate || 'Sin fecha')}</span>
      </div>
      <div class="card-footer-item" title="${commentCount} comentario(s)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="card-comments-count ${hasComments ? 'has-comments' : ''}">${commentCount}</span>
      </div>
    </footer>
  `;

  return card;
}

/**
 * Renderiza todas las tareas en sus columnas correspondientes (renderTasks)
 */
export function renderTasks(tasks, commentsCounts = {}, searchTerm = '') {
  const tracks = {
    todo: document.getElementById('track-todo'),
    doing: document.getElementById('track-doing'),
    done: document.getElementById('track-done')
  };

  // Limpiar pistas
  Object.values(tracks).forEach(track => {
    if (track) track.innerHTML = '';
  });

  const term = searchTerm.toLowerCase().trim();

  tasks.forEach(task => {
    // Filtro en tiempo real por título
    if (term && !task.title.toLowerCase().includes(term)) {
      return;
    }

    const targetTrack = tracks[task.status] || tracks.todo;
    if (!targetTrack) return;

    const count = commentsCounts[task.id] || 0;
    const cardEl = createTaskCardElement(task, count);
    targetTrack.appendChild(cardEl);
  });

  // Mostrar mensaje de vacío si una columna no tiene tarjetas
  Object.keys(tracks).forEach(status => {
    const track = tracks[status];
    if (track && track.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'column-empty-state';
      empty.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
        <span>Sin tarjetas</span>
      `;
      track.appendChild(empty);
    }
  });
}

// Alias para compatibilidad
export const renderBoard = renderTasks;

/**
 * Actualiza los contadores de las columnas y de la barra de estadísticas (updateCounters)
 */
export function updateCounters(tasks) {
  const counts = {
    todo: 0,
    doing: 0,
    done: 0
  };

  tasks.forEach(t => {
    if (counts[t.status] !== undefined) {
      counts[t.status]++;
    } else {
      counts.todo++;
    }
  });

  const total = counts.todo + counts.doing + counts.done;

  // Barra de estadísticas
  const totalEl = document.getElementById('stat-total');
  const todoEl = document.getElementById('stat-todo');
  const doingEl = document.getElementById('stat-doing');
  const doneEl = document.getElementById('stat-done');

  if (totalEl) totalEl.textContent = total;
  if (todoEl) todoEl.textContent = counts.todo;
  if (doingEl) doingEl.textContent = counts.doing;
  if (doneEl) doneEl.textContent = counts.done;

  // Cabeceras de columnas
  const colTodoEl = document.getElementById('col-count-todo');
  const colDoingEl = document.getElementById('col-count-doing');
  const colDoneEl = document.getElementById('col-count-done');

  if (colTodoEl) colTodoEl.textContent = counts.todo;
  if (colDoingEl) colDoingEl.textContent = counts.doing;
  if (colDoneEl) colDoneEl.textContent = counts.done;
}

/**
 * Control de apertura de modales
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    // Enfocar el primer input para accesibilidad
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) firstInput.focus();
  }
}

/**
 * Control de cierre de modales
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Rellena el modal de detalle con los datos de una tarea y sus comentarios
 */
export function populateDetailModal(task, comments = []) {
  const idEl = document.getElementById('detail-id-badge');
  const priorityBadgeEl = document.getElementById('detail-priority-badge-container');
  const titleInput = document.getElementById('detail-title');
  const descInput = document.getElementById('detail-description');
  const statusSelect = document.getElementById('detail-status');
  const prioritySelect = document.getElementById('detail-priority');
  const dateInput = document.getElementById('detail-duedate');

  if (idEl) idEl.textContent = `#${task.id}`;
  if (priorityBadgeEl) priorityBadgeEl.innerHTML = renderPriorityBadge(task.priority);
  if (titleInput) titleInput.value = task.title || '';
  if (descInput) descInput.value = task.description || '';
  if (statusSelect) statusSelect.value = task.status || 'todo';
  if (prioritySelect) prioritySelect.value = task.priority || 'Media';
  if (dateInput) dateInput.value = task.dueDate || '';

  renderCommentsList(comments);
}

/**
 * Renderiza la lista de comentarios en el modal de detalle
 */
export function renderCommentsList(comments = []) {
  const container = document.getElementById('detail-comments-list');
  const countEl = document.getElementById('detail-comments-count');

  if (countEl) countEl.textContent = comments.length;
  if (!container) return;

  container.innerHTML = '';

  if (comments.length === 0) {
    container.innerHTML = `<p class="empty-comments-text">No hay comentarios todavía.</p>`;
    return;
  }

  comments.forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    // Formatear fecha legible
    let dateStr = comment.createdAt || '';
    if (dateStr && dateStr.includes('T')) {
      const d = new Date(dateStr);
      dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    item.innerHTML = `
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(comment.author || 'Anónimo')}</span>
        <span class="comment-date">${escapeHtml(dateStr)}</span>
      </div>
      <p class="comment-text">${escapeHtml(comment.text || '')}</p>
    `;

    container.appendChild(item);
  });
}

/**
 * Muestra u oculta el banner de error de conexión con el servidor
 */
export function showServerNotification(message) {
  const banner = document.getElementById('server-error-banner');
  const textEl = document.getElementById('server-error-text');
  if (banner && textEl) {
    textEl.textContent = message;
    banner.classList.add('visible');
  }
}

export function hideServerNotification() {
  const banner = document.getElementById('server-error-banner');
  if (banner) {
    banner.classList.remove('visible');
  }
}
