const SUPABASE_URL = 'https://anzravhguhsdfnjfsjcm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sIB2jrePXiRBfBidFDFRjA_JeYe5cfP';
let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Error al inicializar Supabase Client:", e);
    supabaseClient = {
        from: () => ({
            select: () => ({
                eq: () => Promise.resolve({ data: [], error: null })
            })
        })
    };
}
const userId = sessionStorage.getItem('ds_user') || 'demo_user';

const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// --- SIMULACIONES PARA MODO DEMO ---
function obtenerMisDocsSimulados() {
    return [
        {
            id: 'sim_1',
            nombre: 'farmaciaDB_auditoria_final',
            acceso: 'Personal',
            fecha_mod: new Date().toISOString(),
            contenido: {
                documentation: '# Auditoría de FarmaciaDB\nAnálisis heurístico completado con 100% de normalización.',
                pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            }
        }
    ];
}

function obtenerCompartidosSimulados() {
    return [
        {
            id: 'shared_sim_1',
            documento: {
                id: 'sim_shared_1',
                nombre: 'empresa_ventas_externo',
                acceso: 'Compartido',
                fecha_mod: new Date().toISOString(),
                contenido: {
                    documentation: '# Reporte de Ventas compartido\nEste esquema muestra la relación de clientes externos.',
                    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
                }
            },
            propietario: 'María Rodríguez'
        }
    ];
}

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m==='&'?'&amp;':m==='<'?'&lt;':'&gt;'); }

const timeoutPromise = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

// --- CARGAR MIS DOCUMENTOS (PARA COMPARTIR) ---
async function cargarMisDocumentos() {
    if (!isUuid(userId)) {
        return obtenerMisDocsSimulados();
    }
    let data = [];
    try {
        const fetchPromise = supabaseClient.from('documentos').select('*').eq('usuario_id', userId).order('created_at', { ascending: false });
        const result = await Promise.race([fetchPromise, timeoutPromise(5000)]);
        if (result.error) console.error("Error al cargar mis documentos:", result.error);
        data = result.data || [];
    } catch (e) {
        console.warn("Carga de mis documentos excedió tiempo límite o falló.");
    }
    return data;
}

// --- CARGAR COMPARTIDOS CONMIGO ---
async function cargarCompartidosConmigo() {
    if (!isUuid(userId)) {
        return obtenerCompartidosSimulados();
    }
    
    let data = [];
    try {
        // 1. Obtener los enlaces en 'compartidos'
        const fetchShares = supabaseClient.from('compartidos').select('id, documento_id').eq('usuario_compartido_id', userId);
        const resultShares = await Promise.race([fetchShares, timeoutPromise(5000)]);
        if (resultShares.error) throw resultShares.error;
        
        const shares = resultShares.data || [];
        if (shares.length === 0) return [];
        
        const docIds = shares.map(s => s.documento_id);
        
        // 2. Obtener los documentos reales
        const fetchDocs = supabaseClient.from('documentos').select('id, nombre, acceso, fecha_mod, contenido, usuario_id').in('id', docIds);
        const resultDocs = await Promise.race([fetchDocs, timeoutPromise(5000)]);
        if (resultDocs.error) throw resultDocs.error;
        
        const docs = resultDocs.data || [];
        
        // 3. Obtener nombres de los propietarios
        const ownerIds = [...new Set(docs.map(d => d.usuario_id))];
        let perfiles = [];
        if (ownerIds.length > 0) {
            const fetchProfiles = supabaseClient.from('perfiles').select('id, nombres, apellidos').in('id', ownerIds);
            const resultProfiles = await Promise.race([fetchProfiles, timeoutPromise(5000)]);
            if (!resultProfiles.error) {
                perfiles = resultProfiles.data || [];
            }
        }
        
        const perfilesMap = {};
        perfiles.forEach(p => {
            perfilesMap[p.id] = `${p.nombres} ${p.apellidos}`;
        });
        
        // 4. Mapear todo
        data = shares.map(s => {
            const doc = docs.find(d => d.id === s.documento_id);
            if (!doc) return null;
            return {
                id: s.id,
                documento: doc,
                propietario: perfilesMap[doc.usuario_id] || 'Usuario desconocido'
            };
        }).filter(Boolean);
        
    } catch (e) {
        console.error("Error cargando compartidos de Supabase:", e);
    }
    return data;
}

let misDocsList = [];
let compartidosConmigoList = [];

// --- RENDERIZAR TABLA DE "COMPARTIR MIS DOCUMENTOS" (ARRIBA) ---
async function renderMisDocs() {
    misDocsList = await cargarMisDocumentos();
    const container = document.getElementById('misDocsCompartidosContainer');
    if (misDocsList.length === 0) {
        container.innerHTML = `
            <div class="seccion-tabla">
                <h2>📤 Compartir mis documentos</h2>
                <div class="empty-message">No tienes documentos guardados para compartir. Genera uno en "Generar documento".</div>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="seccion-tabla">
            <h2>📤 Compartir mis documentos</h2>
            <table class="doc-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Acceso</th>
                        <th>Fecha modificación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    misDocsList.forEach((doc, idx) => {
        let fechaModStr = 'No disponible';
        if (doc.fecha_mod) {
            const dateObj = new Date(doc.fecha_mod);
            if (!isNaN(dateObj.getTime())) {
                fechaModStr = dateObj.toLocaleDateString();
            }
        }
        html += `
            <tr>
                <td>${escapeHtml(doc.nombre)}</td>
                <td>${escapeHtml(doc.acceso)}</td>
                <td>${fechaModStr}</td>
                <td class="action-buttons">
                    <button class="share-doc" data-idx="${idx}">Compartir</button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    // Bind click listeners
    document.querySelectorAll('#misDocsCompartidosContainer .share-doc').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const doc = misDocsList[idx];
            mostrarModalCompartir(doc);
        });
    });
}

// --- RENDERIZAR TABLA DE "COMPARTIDOS CONMIGO" (ABAJO) ---
async function renderCompartidosConmigo() {
    compartidosConmigoList = await cargarCompartidosConmigo();
    const container = document.getElementById('compartidosConmigoContainer');
    if (compartidosConmigoList.length === 0) { 
        container.innerHTML = `
            <div class="seccion-tabla">
                <h2>👥 Compartidos conmigo</h2>
                <div class="empty-message">No tienes ningún documento compartido.</div>
            </div>
        `; 
        return; 
    }
    let html = `
        <div class="seccion-tabla">
            <h2>👥 Compartidos conmigo</h2>
            <table class="doc-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Compartido por</th>
                        <th>Fecha modificación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    compartidosConmigoList.forEach((item, idx) => {
        let fechaModStr = 'No disponible';
        if (item.documento.fecha_mod) {
            const dateObj = new Date(item.documento.fecha_mod);
            if (!isNaN(dateObj.getTime())) {
                fechaModStr = dateObj.toLocaleDateString();
            }
        }
        html += `
            <tr>
                <td>${escapeHtml(item.documento.nombre)}</td>
                <td>${escapeHtml(item.propietario)}</td>
                <td>${fechaModStr}</td>
                <td class="action-buttons">
                    <button class="view-doc" data-idx="${idx}">Ver</button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // Bind click listeners
    document.querySelectorAll('#compartidosConmigoContainer .view-doc').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const item = compartidosConmigoList[idx];
            const doc = item.documento;
            
            // Manejar de forma robusta si es un objeto o un String JSONB
            let contenido = doc.contenido || {};
            if (typeof contenido === 'string') {
                try {
                    contenido = JSON.parse(contenido);
                } catch (e) {
                    console.error("Error al parsear contenido JSON string:", e);
                    contenido = {};
                }
            }

            let modalHtml = '';
            if (contenido.pdfUrl || contenido.pdfBase64) {
                const fileLink = contenido.pdfUrl || contenido.pdfBase64;
                modalHtml = `
                    <div class="pdf-modal-view" style="color: #fff; font-family: 'Outfit', sans-serif;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                            <h3 style="font-size: 1.4rem; color: #a78bfa; margin: 0;">📄 ${escapeHtml(doc.nombre)}</h3>
                            <a href="${fileLink}" target="_blank" download="${doc.nombre}.pdf" class="action-btn" style="text-decoration: none; display: inline-flex; align-items: center; background: linear-gradient(135deg, #a78bfa, #5e6ad2); color: #fff; padding: 10px 18px; border-radius: 30px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 15px rgba(94, 106, 210, 0.4); border: none; cursor: pointer; transition: transform 0.2s;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Descargar PDF
                            </a>
                        </div>
                        <p style="color: #9ca3af; margin-bottom: 15px; font-size: 0.9rem;">
                            Compartido por: <strong style="color: #a78bfa;">${escapeHtml(item.propietario)}</strong>
                        </p>
                        
                        <!-- Visor de PDF Integrado en Tiempo Real -->
                        <div style="border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); background: #1e1e2e; margin-bottom: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);">
                            <iframe src="${fileLink}" style="width: 100%; height: 550px; border: none; display: block;"></iframe>
                        </div>
                    </div>
                `;
            } else {
                modalHtml = `<pre style="color: #fff;">No hay PDF disponible para este documento.</pre>`;
            }
            document.getElementById('modalBody').innerHTML = modalHtml;
            document.getElementById('docModal').style.display = 'flex';
        });
    });
}

// --- MODAL DE COMPARTIR (REUTILIZADO) ---
async function mostrarModalCompartir(doc) {
    if (doc.id.startsWith('sim_') || !isUuid(userId)) {
        alert("Esta función requiere estar autenticado con una cuenta real y tener documentos guardados en Supabase.");
        return;
    }
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = '<div class="loading">Cargando datos para compartir...</div>';
    document.getElementById('docModal').style.display = 'flex';
    
    try {
        // 1. Obtener todos los perfiles de usuario
        const { data: perfiles, error: perfError } = await supabaseClient
            .from('perfiles')
            .select('id, nombres, apellidos')
            .neq('id', userId);
            
        if (perfError) throw perfError;
        
        // 2. Obtener usuarios con acceso actual al documento
        const { data: compartidos, error: compError } = await supabaseClient
            .from('compartidos')
            .select('id, usuario_compartido_id')
            .eq('documento_id', doc.id);
            
        if (compError) throw compError;
        
        // Renderizar la UI
        let userOptions = perfiles.map(p => `<option value="${p.id}">${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)}</option>`).join('');
        if (perfiles.length === 0) {
            userOptions = `<option value="">No hay otros usuarios registrados</option>`;
        }
        
        const compartidosConNombre = compartidos.map(c => {
            const perfil = perfiles.find(p => p.id === c.usuario_compartido_id);
            return {
                id: c.id,
                nombreCompleto: perfil ? `${perfil.nombres} ${perfil.apellidos}` : 'Usuario desconocido'
            };
        });
        
        let sharedListHtml = compartidosConNombre.map(c => `
            <div class="shared-user-item">
                <span class="shared-user-name">👤 ${escapeHtml(c.nombreCompleto)}</span>
                <button class="revoke-share-btn" data-share-id="${c.id}">Quitar acceso</button>
            </div>
        `).join('');
        
        if (compartidosConNombre.length === 0) {
            sharedListHtml = '<div class="empty-message" style="padding:15px; font-size:0.85rem;">Este documento aún no ha sido compartido.</div>';
        }
        
        modalBody.innerHTML = `
            <div class="share-modal-container">
                <h3 class="share-modal-title">Compartir Documento</h3>
                <p style="margin-bottom: 20px; font-size: 0.95rem; color: #9ca3af;">
                    Documento: <strong style="color: #f3f4f6;">${escapeHtml(doc.nombre)}</strong>
                </p>
                
                <div class="share-form">
                    <select id="shareUserSelect" class="share-select" ${perfiles.length === 0 ? 'disabled' : ''}>
                        ${userOptions}
                    </select>
                    <button id="btnConcederAcceso" class="share-submit-btn" ${perfiles.length === 0 ? 'disabled' : ''}>
                        Conceder Acceso
                    </button>
                </div>
                
                <h4 class="shared-list-title">Usuarios con acceso:</h4>
                <div class="shared-users-list">
                    ${sharedListHtml}
                </div>
            </div>
        `;
        
        document.getElementById('btnConcederAcceso')?.addEventListener('click', async () => {
            const selectEl = document.getElementById('shareUserSelect');
            const targetUserId = selectEl.value;
            if (!targetUserId) return;
            
            const btn = document.getElementById('btnConcederAcceso');
            btn.disabled = true;
            btn.innerText = 'Compartiendo...';
            
            try {
                const { error } = await supabaseClient.from('compartidos').insert([
                    {
                        documento_id: doc.id,
                        usuario_compartido_id: targetUserId
                    }
                ]);
                if (error) {
                    if (error.code === '23505') {
                        alert('Este documento ya está compartido con ese usuario.');
                    } else {
                        throw error;
                    }
                } else {
                    mostrarModalCompartir(doc);
                }
            } catch (err) {
                console.error(err);
                alert('Error al compartir: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = 'Conceder Acceso';
            }
        });
        
        document.querySelectorAll('.revoke-share-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const shareId = btn.dataset.shareId;
                if (!shareId) return;
                
                btn.disabled = true;
                btn.innerText = 'Quitando...';
                
                try {
                    const { error } = await supabaseClient.from('compartidos').delete().eq('id', shareId);
                    if (error) throw error;
                    mostrarModalCompartir(doc);
                } catch (err) {
                    console.error(err);
                    alert('Error al revocar acceso: ' + err.message);
                    btn.disabled = false;
                    btn.innerText = 'Quitar acceso';
                }
            });
        });
        
    } catch (err) {
        console.error("Error al cargar modal de compartir:", err);
        modalBody.innerHTML = `<div class="empty-message" style="color: #f87171;">⚠️ Error al cargar: ${escapeHtml(err.message)}</div>`;
    }
}

// --- RENDER TODO ---
async function renderTodo() {
    document.getElementById('misDocsCompartidosContainer').innerHTML = '<div class="loading">Cargando mis documentos...</div>';
    document.getElementById('compartidosConmigoContainer').innerHTML = '<div class="loading">Cargando compartidos...</div>';
    await renderMisDocs();
    await renderCompartidosConmigo();
}

// --- MANEJO DEL MODAL ---
const modal = document.getElementById('docModal');
document.querySelector('.close-modal')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (modal && e.target === modal) modal.style.display = 'none'; });

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Error signing out:', err);
    }
    sessionStorage.clear();
    window.location.href = '/';
});

renderTodo();
