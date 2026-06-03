// DataScript AI - Controlador del Panel de Administración
let allLogs = [];
let chartInstance = null;

const SUPABASE_URL = 'https://anzravhguhsdfnjfsjcm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sIB2jrePXiRBfBidFDFRjA_JeYe5cfP';
let supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar cliente Supabase
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("Error al inicializar Supabase:", e);
    }

    // Verificar Rol e iniciar carga
    const adminId = sessionStorage.getItem('ds_user');
    const role = sessionStorage.getItem('ds_role');
    
    if (!adminId || role !== 'admin') {
        window.location.replace('login.html');
        return;
    }

    // Cargar datos
    await cargarMetricasGlobales(adminId);
    await cargarLogsGlobales(adminId);

    // Configurar listeners de filtros
    document.getElementById('searchUser').addEventListener('input', filtrarLogs);
    document.getElementById('filterAction').addEventListener('change', filtrarLogs);
});

// Obtener estadísticas globales desde el backend
async function cargarMetricasGlobales(adminId) {
    try {
        const response = await fetch('/api/admin/metrics', {
            method: 'GET',
            headers: {
                'x-admin-id': adminId
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            document.getElementById('metricUsers').textContent = data.metrics.totalUsuarios;
            document.getElementById('metricDocs').textContent = data.metrics.totalDocumentos;
            document.getElementById('metricShares').textContent = data.metrics.totalCompartidos;
            document.getElementById('metricLogs').textContent = data.metrics.totalLogs;
        } else {
            console.error('Error cargando métricas:', data.error);
        }
    } catch (err) {
        console.error('Error de red cargando métricas:', err);
    }
}

// Obtener logs de auditoría desde el backend
async function cargarLogsGlobales(adminId) {
    try {
        const response = await fetch('/api/admin/logs', {
            method: 'GET',
            headers: {
                'x-admin-id': adminId
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            allLogs = data.logs || [];
            filtrarLogs(); // Renderiza y dibuja gráfico
        } else {
            document.getElementById('logsTableBody').innerHTML = `
                <tr><td colspan="5" class="empty-message" style="color: #f87171;">Error al cargar registros: ${data.error || 'No autorizado'}</td></tr>
            `;
        }
    } catch (err) {
        console.error('Error de red cargando logs:', err);
        document.getElementById('logsTableBody').innerHTML = `
            <tr><td colspan="5" class="empty-message" style="color: #f87171;">Error de conexión con el servidor.</td></tr>
        `;
    }
}

// Filtrar logs según inputs del Administrador
function filtrarLogs() {
    const searchVal = document.getElementById('searchUser').value.trim().toLowerCase();
    const actionVal = document.getElementById('filterAction').value;

    const filtered = allLogs.filter(log => {
        // Filtro por email/id de usuario
        const email = (log.usuario_email || '').toLowerCase();
        const id = (log.usuario_id || '').toLowerCase();
        const matchesSearch = !searchVal || email.includes(searchVal) || id.includes(searchVal);

        // Filtro por acción
        const matchesAction = actionVal === 'ALL' || log.accion === actionVal;

        return matchesSearch && matchesAction;
    });

    renderizarLogsTable(filtered);
    actualizarGrafico(filtered);
}

// Traducir acciones técnicas a etiquetas legibles en español
function obtenerEtiquetaAccion(accion) {
    const etiquetas = {
        'login': 'Inicio de Sesión',
        'upload_ai': 'Análisis con IA',
        'upload_python': 'Análisis con Python',
        'convert': 'Conversión de Esquema',
        'generate_data': 'Generación de Datos',
        'guardar_documento': 'Documento Guardado',
        'mover_papelera': 'Movido a Papelera',
        'restaurar_documento': 'Documento Restaurado',
        'eliminar_definitivo': 'Eliminado Definitivo',
        'compartir_documento': 'Documento Compartido',
        'revocar_compartir': 'Acceso Revocado',
        'renombrar_documento': 'Documento Renombrado',
        'editar_contenido': 'Contenido Editado'
    };
    return etiquetas[accion] || accion;
}

// Formatear detalles JSON en una hermosa tabla de pares clave-valor
function formatDetailsHTML(details) {
    if (!details || Object.keys(details).length === 0) {
        return '<p style="color: #9ca3af;">No hay detalles adicionales registrados.</p>';
    }

    const keysMap = {
        'fileName': 'Archivo Procesado',
        'fileSize': 'Tamaño del Archivo',
        'fileType': 'Extensión',
        'targetFormat': 'Formato Destino',
        'tables': 'Tablas Generadas',
        'agent': 'Navegador / Agente',
        'nombreDocumento': 'Nombre del Documento',
        'documentoId': 'ID del Documento',
        'compartidoConId': 'ID Usuario Destinatario',
        'shareId': 'ID de Compartido',
        'tipo': 'Tipo de Proceso',
        'nombreAnterior': 'Nombre Anterior',
        'nombreNuevo': 'Nombre Nuevo',
        'error': 'Error Técnico'
    };

    let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 5px;">';
    for (const key in details) {
        const title = keysMap[key] || key;
        let value = details[key];

        if (key === 'fileSize') {
            const bytes = parseInt(value);
            if (bytes > 1024 * 1024) value = (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            else if (bytes > 1024) value = (bytes / 1024).toFixed(2) + ' KB';
            else value = bytes + ' Bytes';
        } else if (Array.isArray(value)) {
            value = value.join(', ');
        } else if (typeof value === 'object') {
            value = JSON.stringify(value);
        }

        // Si es el agente (user agent), recortar para no desbordar
        if (key === 'agent' && typeof value === 'string') {
            const isBrave = navigator.brave !== undefined || value.includes('Brave');
            value = `<span title="${value}">${value.substring(0, 75)}... ${isBrave ? '<b>(Brave)</b>' : ''}</span>`;
        }

        html += `
            <tr style="border-bottom: 1px solid #2d3a5e;">
                <td style="padding: 12px 10px; color: #c084fc; font-weight: 600; width: 35%; font-size: 0.85rem;">${title}</td>
                <td style="padding: 12px 10px; color: #cbd5e1; font-size: 0.85rem; word-break: break-all;">${value}</td>
            </tr>
        `;
    }
    html += '</table>';
    return html;
}

// Dibujar filas de logs en la tabla
function renderizarLogsTable(logs) {
    const tbody = document.getElementById('logsTableBody');
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5" class="empty-message">No se encontraron logs coincidentes.</td></tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const fecha = new Date(log.created_at).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const badgeClass = `badge-action badge-${log.accion}`;
        const userDisplay = log.usuario_email || `<span style="color: #6b7280; font-style: italic;">Invitado (${log.usuario_id || 'N/D'})</span>`;
        const ipDisplay = log.ip_address || 'Local/Interno';
        
        // Botón detalles si detalles contiene algo
        const detailsBtn = log.detalles && Object.keys(log.detalles).length > 0 
            ? `<button class="json-details-btn" onclick='showDetailsModal(${JSON.stringify(log.detalles)})'>Detalles</button>`
            : '<span style="color: #4b5563; font-size: 0.8rem;">Ninguno</span>';

        return `
            <tr>
                <td>${fecha}</td>
                <td>${userDisplay}</td>
                <td><span class="${badgeClass}">${obtenerEtiquetaAccion(log.accion)}</span></td>
                <td><code>${ipDisplay}</code></td>
                <td>${detailsBtn}</td>
            </tr>
        `;
    }).join('');
}

// Actualizar gráfico de pastel de acciones con Chart.js
function actualizarGrafico(logs) {
    const counts = {
        'Inicios de sesión': 0,
        'Análisis IA': 0,
        'Análisis Python': 0,
        'Conversiones': 0,
        'Generación de datos': 0,
        'Documentos guardados': 0,
        'Papelera / Eliminaciones': 0,
        'Procesos compartidos': 0
    };

    logs.forEach(log => {
        if (log.accion === 'login') counts['Inicios de sesión']++;
        else if (log.accion === 'upload_ai') counts['Análisis IA']++;
        else if (log.accion === 'upload_python') counts['Análisis Python']++;
        else if (log.accion === 'convert') counts['Conversiones']++;
        else if (log.accion === 'generate_data') counts['Generación de datos']++;
        else if (log.accion === 'guardar_documento') counts['Documentos guardados']++;
        else if (log.accion === 'mover_papelera' || log.accion === 'restaurar_documento' || log.accion === 'eliminar_definitivo') counts['Papelera / Eliminaciones']++;
        else if (log.accion === 'compartir_documento' || log.accion === 'revocar_compartir') counts['Procesos compartidos']++;
    });

    const ctx = document.getElementById('operacionesChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.7)',  // Inicios de sesión - Azul
                    'rgba(167, 139, 250, 0.7)', // Análisis IA - Morado
                    'rgba(34, 197, 94, 0.7)',   // Análisis Python - Verde
                    'rgba(245, 158, 11, 0.7)',  // Conversiones - Naranja
                    'rgba(14, 165, 233, 0.7)',  // Generación de datos - Celeste
                    'rgba(16, 185, 129, 0.7)',  // Documentos guardados - Esmeralda
                    'rgba(239, 68, 68, 0.7)',   // Papelera - Rojo
                    'rgba(236, 72, 153, 0.7)'   // Compartidos - Rosado
                ],
                borderColor: [
                    '#3b82f6',
                    '#a78bfa',
                    '#22c55e',
                    '#f59e0b',
                    '#0ea5e9',
                    '#10b981',
                    '#ef4444',
                    '#ec4899'
                ],
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#cbd5e1',
                        font: {
                            family: 'Outfit',
                            size: 11
                        },
                        padding: 15
                    }
                }
            }
        }
    });
}

// Modal JSON para detalles
function showDetailsModal(details) {
    const modal = document.getElementById('detailsModal');
    const contentDiv = document.getElementById('jsonDetailsContent');
    contentDiv.innerHTML = formatDetailsHTML(details);
    modal.style.display = 'flex';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

// Cerrar modal al hacer click fuera
window.onclick = function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
