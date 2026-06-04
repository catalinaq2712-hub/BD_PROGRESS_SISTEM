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

function limpiarMarkdownFences(text) {
    if (!text) return '';
    let clean = text.trim();
    const markdownMatch = clean.match(/```(?:markdown|html)?\s?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
        clean = markdownMatch[1];
    }
    return clean.trim();
}

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
        const fetchShares = supabaseClient.from('compartidos').select('id, documento_id, permiso').eq('usuario_compartido_id', userId);
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
                permiso: s.permiso || 'ver',
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
async function abrirModalVisualizador(doc, propietario = 'Usuario', permiso = 'ver') {
    let contenido = doc.contenido || {};
    if (typeof contenido === 'string') {
        try {
            contenido = JSON.parse(contenido);
        } catch (e) {
            console.error("Error al parsear contenido:", e);
            contenido = {};
        }
    }

    const docName = doc.nombre;
    const docId = doc.id;
    const fileLink = contenido.pdfUrl || contenido.pdfBase64 || '';
    const documentationTextRaw = contenido.documentation || '';
    const documentationText = limpiarMarkdownFences(documentationTextRaw);

    const modalBody = document.getElementById('modalBody');

    // Función para renderizar la vista de sólo lectura
    function renderVistaLectura() {
        const fileLinkBase = fileLink ? fileLink.split('#')[0].split('?')[0] : '';
        const cacheBuster = Date.now();
        const fileLinkClean = fileLinkBase ? `${fileLinkBase}?t=${cacheBuster}#toolbar=1&navpanes=0&view=FitH` : '';
        
        modalBody.innerHTML = `
            <div class="pdf-modal-view" style="color: #fff; font-family: 'Outfit', sans-serif;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="font-size: 1.4rem; color: #a78bfa; margin: 0;">📄 ${escapeHtml(docName)}</h3>
                    <div style="display: flex; gap: 10px;">
                        ${permiso === 'editar' ? `
                        <button id="btnEditarContenido" class="action-btn" style="display: inline-flex; align-items: center; background: #10b981; color: #fff; padding: 10px 18px; border-radius: 30px; font-weight: 600; font-size: 0.85rem; border: none; cursor: pointer; transition: transform 0.2s;">
                            ✏️ Editar Contenido
                        </button>
                        ` : ''}
                        <a href="${fileLinkBase}" target="_blank" download="${docName}.pdf" class="action-btn" style="text-decoration: none; display: inline-flex; align-items: center; background: linear-gradient(135deg, #a78bfa, #5e6ad2); color: #fff; padding: 10px 18px; border-radius: 30px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 15px rgba(94, 106, 210, 0.4); border: none; cursor: pointer; transition: transform 0.2s;">
                            📥 Descargar PDF
                        </a>
                    </div>
                </div>
                <p style="color: #9ca3af; margin-bottom: 15px; font-size: 0.9rem;">
                    Compartido por: <strong style="color: #a78bfa;">${escapeHtml(propietario)}</strong>
                </p>
                
                <div style="border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); background: #1e1e2e; margin-bottom: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);">
                    <iframe id="pdfViewerIframe" src="${fileLinkClean}" style="width: 100%; height: 550px; border: none; display: block;" onload="this.style.opacity=1" onerror="document.getElementById('pdfViewerIframe').src=this.src"></iframe>
                </div>
            </div>
        `;

        document.getElementById('btnEditarContenido')?.addEventListener('click', renderVistaEdicion);
    }

    // Función para renderizar el editor WYSIWYG con TinyMCE + Preview PDF en vivo
    function renderVistaEdicion() {
        modalBody.innerHTML = `
            <div class="edit-modal-view" style="color: #fff; font-family: 'Outfit', sans-serif;">
                <div style="flex-shrink:0; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                    <h3 style="font-size:1.3rem; color:#a78bfa; margin:0;">✏️ Editar: ${escapeHtml(docName)}</h3>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button id="btnGuardarEdicion" class="action-btn" style="display:inline-flex; align-items:center; background:#10b981; color:#fff; padding:10px 18px; border-radius:30px; font-weight:600; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.2s;">
                            💾 Guardar
                        </button>
                        <button id="btnGuardarYVer" class="action-btn" style="display:inline-flex; align-items:center; background:linear-gradient(135deg,#a78bfa,#5e6ad2); color:#fff; padding:10px 18px; border-radius:30px; font-weight:600; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.2s; box-shadow:0 4px 15px rgba(94, 106, 210, 0.4);">
                            💾 Guardar y Ver
                        </button>
                        <button id="btnCancelarEdicion" class="action-btn" style="display:inline-flex; align-items:center; background:#6b7280; color:#fff; padding:10px 18px; border-radius:30px; font-weight:600; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.2s;">
                            ❌ Cancelar
                        </button>
                    </div>
                </div>
                <p style="color:#9ca3af; margin-bottom:10px; font-size:0.85rem; flex-shrink:0;">
                    Usa el botón <b>Salto de página</b> en la barra de herramientas para cortar las hojas. La vista previa se actualiza automáticamente.
                </p>
                <div style="display:flex; gap:14px; overflow:hidden; height:720px;">
                    <div style="flex:1 1 50%; min-width:320px; height:100%;">
                        <textarea id="editorTiny"></textarea>
                    </div>
                    <div style="flex:1 1 50%; min-width:320px; display:flex; flex-direction:column; background:#161621; border-radius:12px; border:1px solid rgba(255,255,255,0.1); overflow:hidden; height:100%;">
                        <div style="flex-shrink:0; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#a78bfa; font-weight:600; font-size:0.9rem;">📄 Vista Previa PDF</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span id="previewStatus" style="color:#6b7280; font-size:0.75rem;">Listo</span>
                                <button id="btnActualizarPreview" class="action-btn" style="background:rgba(94,106,210,0.2); border:1px solid rgba(94,106,210,0.4); color:#a78bfa; padding:4px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer;">🔄 Actualizar</button>
                            </div>
                        </div>
                        <iframe id="pdfPreviewIframe" style="flex:1; width:100%; border:none; background:#1e1e2e;"></iframe>
                    </div>
                </div>
            </div>
        `;

        // Preparar HTML inicial
        let docHtml = '';
        if (documentationText.trim().startsWith('<') || documentationText.trim().includes('</p>') || documentationText.trim().includes('</h1>')) {
            docHtml = documentationText;
        } else {
            docHtml = window.marked.parse(documentationText);
        }

        // Función auxiliar: limpiar HTML para PDF
        function prepararHtmlParaPdf(rawHtml) {
            return rawHtml
                .replace(/<!-- pagebreak -->/gi, '<div class="html2pdf__page-break"></div>')
                .replace(/<hr[^>]*class=["']?mce-pagebreak["']?[^>]*>/gi, '<div class="html2pdf__page-break"></div>')
                .replace(/<div[^>]*class=["']?mce-pagebreak["']?[^>]*>.*?<\/div>/gi, '<div class="html2pdf__page-break"></div>');
        }

        // Función auxiliar: generar Blob PDF desde HTML limpio
        async function generarPdfBlob(pdfHtml, esPreview = false) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
            const hiddenDiv = document.createElement('div');
            hiddenDiv.style.cssText = 'width:210mm;background:#ffffff;padding:15mm 20mm;box-sizing:border-box;color:#1f2937;';
            hiddenDiv.innerHTML = pdfHtml;
            wrapper.appendChild(hiddenDiv);
            document.body.appendChild(wrapper);

            hiddenDiv.querySelectorAll('*').forEach(el => {
                el.style.backgroundColor = 'transparent';
                if (el.classList.contains('html2pdf__page-break')) {
                    el.style.cssText = 'page-break-after: always; height: 0px; margin: 0px; padding: 0px; border: none; overflow: hidden;';
                    return;
                }
                if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
                    el.style.color = '#1e3a8a';
                    el.style.borderBottom = '2px solid #e5e7eb';
                    el.style.paddingBottom = '6px';
                    el.style.marginTop = '28px';
                    el.style.marginBottom = '16px';
                    el.style.fontWeight = '700';
                    el.style.pageBreakAfter = 'avoid';
                } else if (el.tagName === 'P') {
                    el.style.color = '#374151';
                    el.style.lineHeight = '1.7';
                    el.style.marginBottom = '16px';
                } else if (el.tagName === 'TABLE') {
                    el.style.width = '100%';
                    el.style.borderCollapse = 'collapse';
                    el.style.marginBottom = '20px';
                    el.style.pageBreakInside = 'avoid';
                } else if (el.tagName === 'TR') {
                    el.style.pageBreakInside = 'avoid';
                } else if (el.tagName === 'TH') {
                    el.style.color = '#111827';
                    el.style.backgroundColor = '#e5e7eb';
                    el.style.border = '2px solid #374151';
                    el.style.fontWeight = '700';
                    el.style.padding = '10px';
                    el.style.fontSize = '0.9rem';
                } else if (el.tagName === 'TD') {
                    el.style.color = '#111827';
                    el.style.border = '1.5px solid #6b7280';
                    el.style.padding = '10px';
                    el.style.fontSize = '0.85rem';
                } else if (el.tagName === 'A') {
                    el.style.color = '#2563eb';
                } else if (el.tagName === 'PRE' || el.tagName === 'CODE') {
                    el.style.backgroundColor = '#f8fafc';
                    el.style.color = '#0f172a';
                    el.style.border = '1px solid #e2e8f0';
                    el.style.padding = '12px';
                    el.style.borderRadius = '6px';
                    el.style.fontSize = '0.85rem';
                    el.style.whiteSpace = 'pre-wrap';
                    el.style.wordBreak = 'break-all';
                    el.style.pageBreakInside = 'avoid';
                } else if (el.tagName === 'LI') {
                    el.style.color = '#374151';
                    el.style.marginBottom = '8px';
                    el.style.lineHeight = '1.6';
                } else {
                    el.style.color = '#374151';
                }
            });

            const opt = {
                margin: [10, 10, 10, 10],
                filename: `${docName}.pdf`,
                image: { type: 'jpeg', quality: esPreview ? 0.85 : 0.98 },
                html2canvas: { scale: esPreview ? 1 : 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'] }
            };

            const pdfBlob = await window.html2pdf().set(opt).from(hiddenDiv).output('blob');
            document.body.removeChild(wrapper);
            return pdfBlob;
        }

        let previewDebounceTimer = null;
        let currentPreviewUrl = null;
        let isGeneratingPreview = false;

        async function actualizarPreview() {
            if (isGeneratingPreview) return;
            const editor = window.tinymce.get('editorTiny');
            if (!editor) return;
            const statusEl = document.getElementById('previewStatus');
            isGeneratingPreview = true;
            if (statusEl) statusEl.innerText = 'Generando...';

            try {
                const rawHtml = editor.getContent();
                const pdfHtml = prepararHtmlParaPdf(rawHtml);
                const blob = await generarPdfBlob(pdfHtml, true);

                if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
                currentPreviewUrl = URL.createObjectURL(blob);

                const iframe = document.getElementById('pdfPreviewIframe');
                if (iframe) iframe.src = currentPreviewUrl + '#toolbar=0&navpanes=0&view=FitH';
                if (statusEl) statusEl.innerText = 'Actualizado';
            } catch (e) {
                console.warn('Error al generar vista previa:', e);
                if (statusEl) statusEl.innerText = 'Error';
            } finally {
                isGeneratingPreview = false;
            }
        }

        // Inicializar TinyMCE
        if (window.tinymce) {
            window.tinymce.remove('#editorTiny');
        }
        window.tinymce.init({
            selector: '#editorTiny',
            height: 650,
            plugins: 'pagebreak lists table code searchreplace fullscreen',
            toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | table | pagebreak | removeformat',
            skin: 'oxide-dark',
            content_css: false,
            content_style: `
                body {
                    background: #ffffff !important;
                    color: #1f2937 !important;
                    font-family: 'Outfit', sans-serif;
                    font-size: 11pt;
                    line-height: 1.7;
                    padding: 16px;
                    background-image: repeating-linear-gradient(
                        to bottom,
                        transparent,
                        transparent 920px,
                        rgba(167, 139, 250, 0.35) 920px,
                        rgba(167, 139, 250, 0.35) 921px
                    ) !important;
                }
                h1, h2, h3, h4 { color: #1e3a8a; font-weight: 700; margin-top: 20px; margin-bottom: 10px; }
                p { margin-bottom: 12px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                th, td { border: 1px solid #9ca3af; padding: 8px; text-align: left; }
                th { background-color: #e5e7eb; font-weight: 700; }
                img { max-width: 100%; height: auto; }
                a { color: #2563eb; }
                hr.mce-pagebreak {
                    border: none;
                    border-top: 3px dashed #a78bfa;
                    margin: 20px 0;
                    height: 3px;
                    background: transparent;
                }
            `,
            setup: function(editor) {
                editor.on('init', function() {
                    editor.setContent(docHtml);
                    setTimeout(actualizarPreview, 800);
                });
                editor.on('input change undo redo setcontent', function() {
                    clearTimeout(previewDebounceTimer);
                    const statusEl = document.getElementById('previewStatus');
                    if (statusEl) statusEl.innerText = 'Escribiendo...';
                    previewDebounceTimer = setTimeout(actualizarPreview, 2500);
                });
            }
        });

        document.getElementById('btnActualizarPreview')?.addEventListener('click', actualizarPreview);

        document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => {
            if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
            window.tinymce.remove('#editorTiny');
            renderVistaLectura();
        });

        async function guardarCambios(verDespues = false) {
            const editor = window.tinymce.get('editorTiny');
            if (!editor) {
                alert('El editor no está listo aún. Espera un momento e intenta de nuevo.');
                return;
            }
            const nuevoHtml = prepararHtmlParaPdf(editor.getContent());

            const btnGuardar = document.getElementById('btnGuardarEdicion');
            const btnVer = document.getElementById('btnGuardarYVer');
            if (btnGuardar) { btnGuardar.disabled = true; }
            if (btnVer) { btnVer.disabled = true; }

            const btnActivo = verDespues ? btnVer : btnGuardar;
            if (btnActivo) btnActivo.innerText = '⚡ Regenerando PDF...';

            try {
                const pdfBlob = await generarPdfBlob(nuevoHtml);

                // Eliminar el PDF anterior de Storage si existe
                const urlAnterior = contenido.pdfUrl || '';
                if (urlAnterior) {
                    try {
                        const storagePrefix = '/storage/v1/object/public/documentos_pdf/';
                        const idxPrefix = urlAnterior.indexOf(storagePrefix);
                        if (idxPrefix !== -1) {
                            const pathAnterior = decodeURIComponent(urlAnterior.substring(idxPrefix + storagePrefix.length).split('?')[0].split('#')[0]);
                            await supabaseClient.storage.from('documentos_pdf').remove([pathAnterior]);
                        }
                    } catch (delErr) {
                        console.warn('No se pudo eliminar el PDF anterior:', delErr);
                    }
                }

                // Subir el nuevo PDF a Storage (usando la carpeta del usuario actual que edita para evitar restricciones de Storage)
                const nuevoFilePath = `user_${userId}/${docId}_documentacion.pdf`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('documentos_pdf')
                    .upload(nuevoFilePath, pdfBlob, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Obtener URL pública
                const { data: publicUrlData } = supabaseClient.storage
                    .from('documentos_pdf')
                    .getPublicUrl(nuevoFilePath);

                const nuevaPdfUrl = publicUrlData.publicUrl;

                // Actualizar la base de datos
                const nuevoContenido = {
                    ...contenido,
                    documentation: nuevoHtml,
                    pdfUrl: nuevaPdfUrl
                };

                const { error: updateError } = await supabaseClient
                    .from('documentos')
                    .update({
                        contenido: nuevoContenido,
                        fecha_mod: new Date().toISOString()
                    })
                    .eq('id', docId);

                if (updateError) throw updateError;

                // Registrar log de edicion
                try {
                    await fetch('/api/logs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            usuarioId: userId,
                            usuarioEmail: sessionStorage.getItem('ds_email') || '',
                            accion: 'editar_contenido_compartido',
                            detalles: {
                                documentoId: docId,
                                nombreDocumento: docName
                            }
                        })
                    });
                } catch (logErr) {
                    console.error('Error registrando log de edicion:', logErr);
                }

                if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
                window.tinymce.remove('#editorTiny');

                contenido = nuevoContenido;
                doc.contenido = nuevoContenido;

                alert('¡Cambios guardados y PDF regenerado con éxito!');
                renderTodo();

                if (verDespues) {
                    setTimeout(() => {
                        abrirModalVisualizador(doc, propietario, permiso);
                    }, 600);
                } else {
                    document.getElementById('docModal').style.display = 'none';
                }

            } catch (err) {
                console.error("Error al guardar edición:", err);
                alert("Error al guardar cambios: " + err.message);
                if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerText = '💾 Guardar'; }
                if (btnVer) { btnVer.disabled = false; btnVer.innerText = '💾 Guardar y Ver'; }
            }
        }

        document.getElementById('btnGuardarEdicion')?.addEventListener('click', () => guardarCambios(false));
        document.getElementById('btnGuardarYVer')?.addEventListener('click', () => guardarCambios(true));
    }

    renderVistaLectura();
    document.getElementById('docModal').style.display = 'flex';
}

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
                        <th>Permiso</th>
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
        const permiso = item.permiso || 'ver';
        html += `
            <tr>
                <td>${escapeHtml(item.documento.nombre)}</td>
                <td>${escapeHtml(item.propietario)}</td>
                <td>
                    <span style="display:inline-flex; align-items:center; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; 
                        ${permiso === 'editar' ? 'background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.25);' : 'background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.25);'}">
                        ${permiso === 'editar' ? `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 5px;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>Editor
                        ` : `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 5px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>Lector
                        `}
                    </span>
                </td>
                <td>${fechaModStr}</td>
                <td class="action-buttons">
                    <button class="view-doc" data-idx="${idx}">Ver</button>
                    ${permiso === 'editar' ? `<button class="edit-doc" data-idx="${idx}">Editar</button>` : ''}
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
            abrirModalVisualizador(item.documento, item.propietario, item.permiso || 'ver');
        });
    });

    document.querySelectorAll('#compartidosConmigoContainer .edit-doc').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.idx);
            const item = compartidosConmigoList[idx];
            const doc = item.documento;
            const nuevo = prompt('Nuevo nombre del documento:', doc.nombre);
            if (nuevo) {
                const { error } = await supabaseClient
                    .from('documentos')
                    .update({ nombre: nuevo.trim() })
                    .eq('id', doc.id);
                
                if (error) {
                    alert('Error al renombrar: ' + error.message);
                } else {
                    try {
                        await fetch('/api/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                usuarioId: userId,
                                usuarioEmail: sessionStorage.getItem('ds_email') || '',
                                accion: 'renombrar_documento_compartido',
                                detalles: {
                                    documentoId: doc.id,
                                    nombreAnterior: doc.nombre,
                                    nombreNuevo: nuevo.trim()
                                }
                            })
                        });
                    } catch (logErr) {
                        console.error('Error registrando log de renombrar:', logErr);
                    }
                    renderTodo();
                }
            }
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
            .select('id, usuario_compartido_id, permiso')
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
                nombreCompleto: perfil ? `${perfil.nombres} ${perfil.apellidos}` : 'Usuario desconocido',
                permiso: c.permiso || 'ver'
            };
        });
        
        let sharedListHtml = compartidosConNombre.map(c => `
            <div class="shared-user-item">
                <span class="shared-user-name" style="display: inline-flex; align-items: center; gap: 8px;">
                    👤 ${escapeHtml(c.nombreCompleto)}
                    <span style="display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; 
                        ${c.permiso === 'editar' ? 'background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2);' : 'background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.2);'}">
                        ${c.permiso === 'editar' ? 'Editor' : 'Lector'}
                    </span>
                </span>
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
                
                <div class="share-form" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px;">
                        <select id="shareUserSelect" class="share-select" style="flex: 1;" ${perfiles.length === 0 ? 'disabled' : ''}>
                            ${userOptions}
                        </select>
                        <select id="sharePermisoSelect" class="share-select" style="width: 170px;">
                            <option value="ver">Lector (Solo ver)</option>
                            <option value="editar">Editor (Ver y editar)</option>
                        </select>
                    </div>
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
            const permisoEl = document.getElementById('sharePermisoSelect');
            const permiso = permisoEl ? permisoEl.value : 'ver';
            if (!targetUserId) return;
            
            const btn = document.getElementById('btnConcederAcceso');
            btn.disabled = true;
            btn.innerText = 'Compartiendo...';
            
            try {
                const { error } = await supabaseClient.from('compartidos').insert([
                    {
                        documento_id: doc.id,
                        usuario_compartido_id: targetUserId,
                        permiso: permiso
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
document.querySelector('.close-modal')?.addEventListener('click', () => { 
    if (modal) modal.style.display = 'none'; 
    if (window.tinymce) window.tinymce.remove('#editorTiny');
});
window.addEventListener('click', (e) => { 
    if (modal && e.target === modal) {
        modal.style.display = 'none'; 
        if (window.tinymce) window.tinymce.remove('#editorTiny');
    }
});

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
