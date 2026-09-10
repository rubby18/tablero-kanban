/**
 * Aplicación Principal — DevFlow (Tablero Kanban)
 * Tecnologías: HTML5, CSS3, JavaScript Vanilla ES6+, SortableJS, json-server
 * Nivel Académico 1: Código claro, legible y modular.
 */

import {
  fetchTasks,
  fetchTaskById,
  postTask,
  patchTask,
  deleteTaskApi,
  fetchComments,
  postComment
} from './api.js';

import {
  renderTasks,
  updateCounters,
  openModal,
  closeModal,
  populateDetailModal,
  renderCommentsList,
  showServerNotification,
  hideServerNotification
} from './ui.js';

// --- Estado Global en Memoria del Tablero ---
let tasks = [];
let commentsCounts = {};
let activeTaskId = null;
let currentSearchTerm = '';
let sortableInstances = [];

/**
 * 1. Cargar tareas y comentarios desde json-server (GET /tasks & GET /comments)
 */
async function loadTasks() {
  try {
    hideServerNotification();
    
    // Obtener tareas y todos los comentarios en paralelo
    const [fetchedTasks, allComments] = await Promise.all([
      fetchTasks(),
      fetchComments().catch(() => [])
    ]);

    if (Array.isArray(fetchedTasks)) {
      tasks = fetchedTasks;
      
      // Mapear cantidad de comentarios por tarea
      commentsCounts = {};
      if (Array.isArray(allComments)) {
        allComments.forEach(c => {
          const tid = String(c.taskId);
          commentsCounts[tid] = (commentsCounts[tid] || 0) + 1;
        });
      }

      // Renderizar el tablero y actualizar los contadores
      renderTasks(tasks, commentsCounts, currentSearchTerm);
      updateCounters(tasks);

      // Inicializar SortableJS para Drag & Drop
      initializeSortable();
    }
  } catch (error) {
    console.error('Error al inicializar las tareas:', error);
    showServerNotification('No se ha podido conectar con el servidor.');
  }
}

/**
 * 2. Crear una nueva tarea (POST /tasks)
 */
async function createTask(e) {
  if (e && e.preventDefault) e.preventDefault();

  const titleInput = document.getElementById('create-title');
  const descInput = document.getElementById('create-description');
  const prioritySelect = document.getElementById('create-priority');
  const dateInput = document.getElementById('create-duedate');

  const title = titleInput.value.trim();
  if (!title) return;

  const newTaskData = {
    title,
    description: descInput.value.trim(),
    priority: prioritySelect.value || 'Media',
    dueDate: dateInput.value || '',
    status: 'todo'
  };

  try {
    const createdTask = await postTask(newTaskData);
    if (createdTask) {
      tasks.push(createdTask);
      commentsCounts[createdTask.id] = 0;
      
      // Actualizar interfaz sin recargar la página
      renderTasks(tasks, commentsCounts, currentSearchTerm);
      updateCounters(tasks);

      // Limpiar y cerrar modal
      document.getElementById('form-create-task').reset();
      closeModal('modal-create');
    }
  } catch (error) {
    console.error('Error al crear tarea:', error);
    showServerNotification('No se ha podido conectar con el servidor para crear la tarea.');
  }
}

/**
 * 3. Abrir modal para crear tarea
 */
function openCreateModal(defaultStatus = 'todo') {
  const form = document.getElementById('form-create-task');
  if (form) form.reset();

  const statusInput = document.getElementById('create-status');
  if (statusInput) statusInput.value = defaultStatus;

  const prioritySelect = document.getElementById('create-priority');
  if (prioritySelect) prioritySelect.value = 'Media';

  // Sugerir fecha por defecto en 5 días
  const dateInput = document.getElementById('create-duedate');
  if (dateInput) {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    dateInput.value = d.toISOString().split('T')[0];
  }

  openModal('modal-create');
}

/**
 * 4. Cargar comentarios de una tarea y abrir modal de detalle
 */
async function loadComments(taskId) {
  try {
    const comments = await fetchComments(taskId);
    if (Array.isArray(comments)) {
      renderCommentsList(comments);
      commentsCounts[taskId] = comments.length;
      
      // Actualizar contador en la tarjeta visible
      const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
      if (card) {
        const countSpan = card.querySelector('.card-comments-count');
        if (countSpan) {
          countSpan.textContent = comments.length;
          countSpan.classList.toggle('has-comments', comments.length > 0);
        }
      }
    }
  } catch (err) {
    console.warn('No se pudieron cargar los comentarios en este momento:', err);
  }
}

/**
 * Abrir detalle de tarea (GET /tasks/:id)
 */
async function openTaskDetail(taskId) {
  activeTaskId = String(taskId);
  const task =await fetchTaskById(activeTaskId);
  if (!task) return;

  // Rellenar inicialmente con los datos en memoria
  populateDetailModal(task, []);
  openModal('modal-detail');

  // Cargar comentarios frescos desde la API REST
  await loadComments(activeTaskId);
}

/**
 * 5. Guardar edición de tarea (PATCH /tasks/:id)
 */
async function updateTask() {
  if (!activeTaskId) return;

  const title = document.getElementById('detail-title').value.trim();
  const description = document.getElementById('detail-description').value.trim();
  const status = document.getElementById('detail-status').value;
  const priority = document.getElementById('detail-priority').value;
  const dueDate = document.getElementById('detail-duedate').value;

  if (!title) {
    alert('El título de la tarea no puede estar vacío.');
    return;
  }

  const updatedFields = {
    title,
    description,
    status,
    priority,
    dueDate
  };

  try {
    const updated = await patchTask(activeTaskId, updatedFields);
    if (updated) {
      // Actualizar estado local
      const idx = tasks.findIndex(t => String(t.id) === activeTaskId);
      if (idx !== -1) {
        tasks[idx] = { ...tasks[idx], ...updated };
      }

      renderTasks(tasks, commentsCounts, currentSearchTerm);
      updateCounters(tasks);
      closeModal('modal-detail');
    }
  } catch (error) {
    console.error('Error al actualizar la tarea:', error);
    showServerNotification('No se ha podido conectar con el servidor para guardar los cambios.');
  }
}

/**
 * 6. Eliminar tarea (DELETE /tasks/:id)
 */
async function deleteTask() {
  if (!activeTaskId) return;

  const task = tasks.find(t => String(t.id) === activeTaskId);
  const taskTitle = task ? task.title : 'esta tarea';

  const confirmed = window.confirm(`¿Confirmas que deseas eliminar la tarea "${taskTitle}"?`);
  if (!confirmed) return;

  try {
    await deleteTaskApi(activeTaskId);
    
    // Eliminar del estado local
    tasks = tasks.filter(t => String(t.id) !== activeTaskId);
    delete commentsCounts[activeTaskId];

    // Actualizar interfaz
    renderTasks(tasks, commentsCounts, currentSearchTerm);
    updateCounters(tasks);
    closeModal('modal-detail');
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    showServerNotification('No se ha podido conectar con el servidor para eliminar la tarea.');
  }
}

/**
 * 7. Crear comentario (POST /comments)
 */
async function createComment(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!activeTaskId) return;

  const authorInput = document.getElementById('comment-author');
  const textInput = document.getElementById('comment-text');

  const author = authorInput.value.trim() || 'Usuario';
  const text = textInput.value.trim();

  if (!text) return;

  const newCommentData = {
    taskId: activeTaskId,
    author,
    text,
    createdAt: new Date().toISOString()
  };

  try {
    const created = await postComment(newCommentData);
    if (created) {
      // Recargar comentarios
      await loadComments(activeTaskId);
      updateCounters(tasks);

      // Limpiar textarea
      textInput.value = '';
    }
  } catch (error) {
    console.error('Error al enviar comentario:', error);
    showServerNotification('No se ha podido conectar con el servidor para publicar el comentario.');
  }
}

/**
 * 8. Configuración e inicialización de Drag & Drop con SortableJS
 */
function initializeSortable() {
  // Destruir instancias previas si existían
  sortableInstances.forEach(inst => inst.destroy());
  sortableInstances = [];

  const tracks = [
    document.getElementById('track-todo'),
    document.getElementById('track-doing'),
    document.getElementById('track-done')
  ];

  if (typeof window.Sortable === 'undefined') {
    console.warn('SortableJS no está cargado todavía en el entorno global.');
    return;
  }

  tracks.forEach(track => {
    if (!track) return;

    const sortable = new window.Sortable(track, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      handle: '.task-card',
      onEnd: async function (evt) {
        const itemEl = evt.item;
        const targetTrack = evt.to;
        const sourceTrack = evt.from;

        if (targetTrack !== sourceTrack) {
          const taskId = itemEl.dataset.id;
          const newStatus = targetTrack.dataset.status;

          if (!taskId || !newStatus) return;

          // 1. Actualizar estado local inmediatamente
          const task = tasks.find(t => String(t.id) === String(taskId));
          if (task) {
            task.status = newStatus;
          }
          
          // 2. Actualizar contadores de inmediato
          updateCounters(tasks);

          // 3. Persistir cambio mediante PATCH /tasks/:id
          try {
            await patchTask(taskId, { status: newStatus });
          } catch (error) {
            console.error('Error al sincronizar el arrastre con el servidor:', error);
            showServerNotification('No se ha podido conectar con el servidor. Reintentando sincronizar...');
            // En caso de fallo, recargar para mantener coherencia
            loadTasks();
          }
        }
      }
    });

    sortableInstances.push(sortable);
  });
}

/**
 * 9. Filtro del buscador en tiempo real (filterTasks)
 */
function filterTasks(term) {
  currentSearchTerm = term;
  
  // Sincronizar inputs desktop y móvil
  const desktopSearch = document.getElementById('search-input');
  const mobileSearch = document.getElementById('mobile-search-input');

  if (desktopSearch && desktopSearch.value !== term) desktopSearch.value = term;
  if (mobileSearch && mobileSearch.value !== term) mobileSearch.value = term;

  renderTasks(tasks, commentsCounts, currentSearchTerm);
}

/**
 * 10. Inicialización de Eventos del DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  // Carga inicial
  loadTasks();

  // --- Buscador en tiempo real ---
  const desktopSearch = document.getElementById('search-input');
  const mobileSearch = document.getElementById('mobile-search-input');

  if (desktopSearch) {
    desktopSearch.addEventListener('input', e => filterTasks(e.target.value));
  }
  if (mobileSearch) {
    mobileSearch.addEventListener('input', e => filterTasks(e.target.value));
  }

  // --- Botón abrir modal crear tarea ---
  const btnCreateMain = document.getElementById('btn-open-create-modal');
  if (btnCreateMain) {
    btnCreateMain.addEventListener('click', () => openCreateModal('todo'));
  }

  // Delegación de eventos para botones de añadir en columnas
  document.querySelectorAll('[data-action="add-task"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const status = e.currentTarget.dataset.status || 'todo';
      openCreateModal(status);
    });
  });

  // --- Formulario Crear Tarea (POST) ---
  const formCreate = document.getElementById('form-create-task');
  if (formCreate) {
    formCreate.addEventListener('submit', createTask);
  }

  // --- Click en tarjeta para abrir modal detalle ---
  document.getElementById('board-container').addEventListener('click', (e) => {
    const card = e.target.closest('.task-card');
    if (card && card.dataset.id) {
      openTaskDetail(card.dataset.id);
    }
  });

  // Soporte teclado para abrir tarjetas (Enter o Espacio)
  document.getElementById('board-container').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.task-card');
      if (card && card.dataset.id) {
        e.preventDefault();
        openTaskDetail(card.dataset.id);
      }
    }
  });

  // --- Botones de Modales: Guardar Cambios y Eliminar ---
  const btnSaveDetail = document.getElementById('btn-save-detail');
  if (btnSaveDetail) {
    btnSaveDetail.addEventListener('click', updateTask);
  }

  const btnDeleteDetail = document.getElementById('btn-delete-task');
  if (btnDeleteDetail) {
    btnDeleteDetail.addEventListener('click', deleteTask);
  }

  // --- Formulario Añadir Comentario ---
  const formComment = document.getElementById('form-new-comment');
  if (formComment) {
    formComment.addEventListener('submit', createComment);
  }

  // --- Cierre de Modales por Botón o Fondo ---
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.closeModal;
      closeModal(modalId);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('open');
      }
    });
  });

  // Cierre de modales con la tecla Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => {
        m.classList.remove('open');
      });
    }
  });

  // --- Menú Hamburguesa Móvil (Vanilla JS) ---
  const hamburgerBtn = document.getElementById('btn-hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  const hamburgerIcon = document.getElementById('hamburger-icon');

  if (hamburgerBtn && mobileNav) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.contains('open');
      if (isOpen) {
        mobileNav.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        if (hamburgerIcon) hamburgerIcon.textContent = 'menu';
      } else {
        mobileNav.classList.add('open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        if (hamburgerIcon) hamburgerIcon.textContent = 'close';
      }
    });
  }

  // --- Pestañas de Filtrado de Columnas en Móvil ---
  document.querySelectorAll('.mobile-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');

      const target = tabBtn.dataset.target;
      const columns = {
        'col-todo': document.getElementById('col-todo'),
        'col-doing': document.getElementById('col-doing'),
        'col-done': document.getElementById('col-done')
      };

      if (target === 'all') {
        Object.values(columns).forEach(col => {
          if (col) col.style.display = '';
        });
      } else {
        Object.entries(columns).forEach(([id, col]) => {
          if (col) {
            col.style.display = (id === target) ? 'flex' : 'none';
          }
        });
      }
    });
  });

  // --- Indicador de Actividad REST API ---
  window.addEventListener('api-activity', (e) => {
    const tag = document.getElementById('api-status-tag');
    if (tag && e.detail) {
      tag.textContent = `${e.detail.method} ${e.detail.endpoint} ${e.detail.status}`;
    }
  });

  // --- Evento de Error de Conexión ---
  window.addEventListener('api-error', (e) => {
    showServerNotification(e.detail.message || 'No se ha podido conectar con el servidor.');
  });
});
