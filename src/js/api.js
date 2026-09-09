/**
 * API REST Service — DevFlow
 * Módulo encargado de todas las operaciones fetch contra json-server.
 * Endpoint base: http://localhost:3000 (o relativo si está servido en el mismo puerto)
 */

/*PAra mejor cambiar esto a un env*/
const API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port !== '3000' && !window.location.hostname.includes('run.app')))
  ? 'http://localhost:3000'
  : '';

/**
 * Helper para registrar en la consola y disparar eventos de depuración
 */
function logApiEvent(method, endpoint, status = 'OK') {
  console.log(`[API ${method}] ${endpoint} — ${status}`);
  // Notificar a la UI sobre la última llamada REST para actualizar el badge informativo
  window.dispatchEvent(new CustomEvent('api-activity', {
    detail: { method, endpoint, status }
  }));
}

/**
 * Manejador centralizado de errores de conexión con el servidor
 */
function handleApiError(error, customMessage) {
  console.error('[API Error]:', error);
  // Notificar al usuario mediante un evento para mostrar un mensaje claro y amigable
  window.dispatchEvent(new CustomEvent('api-error', {
    detail: { message: customMessage || 'No se ha podido conectar con el servidor.' }
  }));
  throw error;
}

/**
 * 1. Obtener todas las tareas (GET /tasks)
 */
export async function fetchTasks() {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const tasks = await response.json();
    logApiEvent('GET', '/tasks', `${response.status} OK`);
    return tasks;
  } catch (error) {
    handleApiError(error, 'No se ha podido conectar con el servidor al cargar las tareas.');
  }
}

/**
 * 2. Obtener una tarea por ID (GET /tasks/:id)
 */
export async function fetchTaskById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const task = await response.json();
    logApiEvent('GET', `/tasks/${id}`, `${response.status} OK`);
    return task;
  } catch (error) {
    handleApiError(error, `No se ha podido obtener la tarea con ID ${id}.`);
  }
}

/**
 * 3. Crear una nueva tarea (POST /tasks)
 * La nueva tarea se inicializa con status: "todo"
 */
export async function postTask(taskData) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const newTask = await response.json();
    logApiEvent('POST', '/tasks', '201 Created');
    return newTask;
  } catch (error) {
    handleApiError(error, 'No se ha podido guardar la nueva tarea en el servidor.');
  }
}

/**
 * 4. Actualizar parcialmente una tarea (PATCH /tasks/:id)
 * Utilizado al mover tarjetas entre columnas o editar campos
 */
export async function patchTask(id, fieldsToUpdate) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fieldsToUpdate)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const updatedTask = await response.json();
    logApiEvent('PATCH', `/tasks/${id}`, '200 OK');
    return updatedTask;
  } catch (error) {
    handleApiError(error, `No se pudo actualizar la tarea con ID ${id}.`);
  }
}

/**
 * 5. Eliminar una tarea (DELETE /tasks/:id)
 * También elimina sus comentarios asociados para evitar datos huérfanos.
 */
export async function deleteTaskApi(id) {
  try {
    // 5.1 Eliminar comentarios relacionados si existen
    try {
      const comments = await fetchComments(id);
      if (Array.isArray(comments) && comments.length > 0) {
        await Promise.all(
          comments.map(c => deleteCommentApi(c.id).catch(e => console.warn('Comentario huérfano:', e)))
        );
      }
    } catch (e) {
      console.warn('No se pudieron verificar los comentarios antes de borrar la tarea:', e);
    }

    // 5.2 Eliminar la tarea
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    logApiEvent('DELETE', `/tasks/${id}`, '200 OK');
    return true;
  } catch (error) {
    handleApiError(error, `No se pudo eliminar la tarea con ID ${id}.`);
  }
}

/**
 * 6. Obtener comentarios de una tarea (GET /comments?taskId=:id)
 */
export async function fetchComments(taskId) {
  try {
    const endpoint = taskId ? `/comments?taskId=${taskId}` : '/comments';
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const comments = await response.json();
    logApiEvent('GET', endpoint, '200 OK');
    return comments;
  } catch (error) {
    handleApiError(error, 'No se han podido cargar los comentarios.');
  }
}

/**
 * 7. Crear un nuevo comentario (POST /comments)
 */
export async function postComment(commentData) {
  try {
    const response = await fetch(`${API_BASE_URL}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commentData)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const newComment = await response.json();
    logApiEvent('POST', '/comments', '201 Created');
    return newComment;
  } catch (error) {
    handleApiError(error, 'No se pudo publicar el comentario en el servidor.');
  }
}

/**
 * 8. Eliminar un comentario (DELETE /comments/:id)
 */
export async function deleteCommentApi(commentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    logApiEvent('DELETE', `/comments/${commentId}`, '200 OK');
    return true;
  } catch (error) {
    console.error(`Error al eliminar comentario ${commentId}:`, error);
    throw error;
  }
}
