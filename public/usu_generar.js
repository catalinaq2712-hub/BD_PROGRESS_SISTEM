// Variables globales
let selectedFile = null;
let currentResults = null;

const SUPABASE_URL = 'https://anzravhguhsdfnjfsjcm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sIB2jrePXiRBfBidFDFRjA_JeYe5cfP';
let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Error al inicializar Supabase Client:", e);
}

// Elementos del DOM
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFileBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzePythonBtn = document.getElementById('analyzePythonBtn');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initPaywallUI();
});

function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);
    
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    removeFileBtn.addEventListener('click', removeFile);
    analyzeBtn.addEventListener('click', analyzeFile);
    analyzePythonBtn.addEventListener('click', analyzeFileWithPython);
    
    // Nuevo listener para convertidor
    const targetFormat = document.getElementById('targetFormat');
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.addEventListener('click', convertSchema);
    }
    if (targetFormat) {
        targetFormat.addEventListener('change', () => {
            resetConversionResult();
            updateConverterButtons();
        });
    }

    // Listeners para el diagrama
    const diagramZoom = document.getElementById('diagramZoom');
    if (diagramZoom) {
        diagramZoom.addEventListener('input', handleZoom);
    }

    const downloadDiagramBtn = document.getElementById('downloadDiagramBtn');
    if (downloadDiagramBtn) {
        downloadDiagramBtn.addEventListener('click', downloadDiagram);
    }

    // Botones de Documentación IA
    const downloadWordBtn = document.getElementById('downloadWordBtn');
    if (downloadWordBtn) {
        downloadWordBtn.addEventListener('click', downloadWord);
    }

    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', downloadPdf);
    }

    const printDocBtn = document.getElementById('printDocBtn');
    if (printDocBtn) {
        printDocBtn.addEventListener('click', printDocumentation);
    }

    // Botones de Diagrama ER
    const downloadDiagramPdfBtn = document.getElementById('downloadDiagramPdfBtn');
    if (downloadDiagramPdfBtn) {
        downloadDiagramPdfBtn.addEventListener('click', downloadDiagramPdf);
    }

    const printDiagramBtn = document.getElementById('printDiagramBtn');
    if (printDiagramBtn) {
        printDiagramBtn.addEventListener('click', printDiagram);
    }

    // Botón de Convertidor
    const downloadConvertedBtn = document.getElementById('downloadConvertedBtn');
    if (downloadConvertedBtn) {
        downloadConvertedBtn.addEventListener('click', downloadConverted);
    }

    // Botones de Esquema Bruto
    const downloadSchemaWordBtn = document.getElementById('downloadSchemaWordBtn');
    if (downloadSchemaWordBtn) {
        downloadSchemaWordBtn.addEventListener('click', downloadSchemaWord);
    }

    const downloadSchemaPdfBtn = document.getElementById('downloadSchemaPdfBtn');
    if (downloadSchemaPdfBtn) {
        downloadSchemaPdfBtn.addEventListener('click', downloadSchemaPdf);
    }

    const printSchemaBtn = document.getElementById('printSchemaBtn');
    if (printSchemaBtn) {
        printSchemaBtn.addEventListener('click', printSchema);
    }

    // Anomalias
    const printAnomaliesBtn = document.getElementById('printAnomaliesBtn');
    if (printAnomaliesBtn) {
        printAnomaliesBtn.addEventListener('click', printAnomalies);
    }

    // Descargar Anomalías ---------------------------------------------------------------------------------------------------
    const downloadAnomaliesPdfBtn = document.getElementById('downloadAnomaliesPdfBtn');
    if (downloadAnomaliesPdfBtn) {
        downloadAnomaliesPdfBtn.addEventListener('click', downloadAnomaliesPdf);
    }

    // Descargar Esquema Bruto
    const downloadSchemaPdfBtnEl = document.getElementById('downloadSchemaPdfBtn');
    if (downloadSchemaPdfBtnEl) {
        downloadSchemaPdfBtnEl.addEventListener('click', downloadSchemaPdf);
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });

    const saveDocBtn = document.getElementById('saveDocBtn');
    if (saveDocBtn) {
        saveDocBtn.addEventListener('click', saveDocumentToSupabase);
    }

    // Datos de Prueba
    const quickGenerateBtn = document.getElementById('quickGenerateBtn');
    if (quickGenerateBtn) {
        quickGenerateBtn.addEventListener('click', generateTestData);
    }
    const downloadTestDataBtn = document.getElementById('downloadTestDataBtn');
    if (downloadTestDataBtn) {
        downloadTestDataBtn.addEventListener('click', downloadTestData);
    }
}



// Manejo de archivos
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    // Validar tipo de archivo
    const allowedExtensions = ['.sql', '.json', '.txt', '.dbml', '.yaml', '.yml', '.xlsx', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
        showError('Tipo de archivo no permitido. Solo se permiten: .sql, .json, .txt, .dbml, .yaml, .yml, .xlsx, .csv');
        return;
    }
    
    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('El archivo es demasiado grande. Máximo 10MB');
        return;
    }
    
    selectedFile = file;
    currentResults = null;
    displayFileInfo();
    hideError();
    hideResults();
    resetConversionResult();
}

function displayFileInfo() {
    fileName.textContent = selectedFile.name;
    fileSize.textContent = formatFileSize(selectedFile.size);
    fileInfo.style.display = 'block';
    analyzeBtn.disabled = false;
    analyzePythonBtn.disabled = false;
    
    const role = sessionStorage.getItem('ds_role') || 'usuario';
    if (role === 'usuario') {
        analyzeBtn.innerHTML = '<span class="btn-text">Análisis con IA (Premium)</span>';
        analyzeBtn.style.background = 'linear-gradient(135deg, #444, #555)';
    } else {
        analyzeBtn.innerHTML = '<span class="btn-text">Análisis con IA</span>';
        analyzeBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
    }
}

function removeFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    analyzeBtn.disabled = true;
    analyzePythonBtn.disabled = true;
    hideResults();
    resetConversionResult();
    hideError();
    
    const role = sessionStorage.getItem('ds_role') || 'usuario';
    if (role === 'usuario') {
        analyzeBtn.innerHTML = '<span class="btn-text">Análisis con IA (Premium)</span>';
    } else {
        analyzeBtn.innerHTML = '<span class="btn-text">Análisis con IA</span>';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Análisis de archivo con IA
async function analyzeFile() {
    const role = sessionStorage.getItem('ds_role') || 'usuario';
    if (role === 'usuario') {
        showPremiumUpgradeModal();
        return;
    }
    if (!selectedFile) return;
    
    showLoading(true, 'ai');
    hideResults();
    hideError();
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
        const userId = sessionStorage.getItem('ds_user') || '';
        const userEmail = sessionStorage.getItem('ds_email') || '';
        const response = await fetch('/upload', {
            method: 'POST',
            headers: {
                'x-user-id': userId,
                'x-user-email': userEmail
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentResults = result;
            try {
                displayResults(result);
            } catch (renderError) {
                console.error('Render error:', renderError);
                showError('Error al mostrar los resultados: ' + renderError.message);
            }
        } else {
            showError(result.error || 'Error al procesar el archivo');
        }
    } catch (error) {
        showError('Error de conexión o de red: ' + error.message);
        console.error('Fetch Error:', error);
    } finally {
        showLoading(false, 'ai');
    }
}

// Análisis de archivo con Python
async function analyzeFileWithPython() {
    if (!selectedFile) return;
    
    showLoading(true, 'python');
    hideResults();
    hideError();
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
        const userId = sessionStorage.getItem('ds_user') || '';
        const userEmail = sessionStorage.getItem('ds_email') || '';
        const response = await fetch('/analyze-python', {
            method: 'POST',
            headers: {
                'x-user-id': userId,
                'x-user-email': userEmail
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentResults = result;
            try {
                displayResults(result);
            } catch (renderError) {
                console.error('Render error:', renderError);
                showError('Error al mostrar los resultados: ' + renderError.message);
            }
        } else {
            showError(result.error || 'Error al procesar el archivo con Python');
        }
    } catch (error) {
        showError('Error de conexión o de red: ' + error.message);
        console.error('Fetch Error:', error);
    } finally {
        showLoading(false, 'python');
    }
}

function showLoading(show, type = 'ai') {
    const btn = type === 'python' ? analyzePythonBtn : analyzeBtn;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loading-spinner');
    
    if (show) {
        const message = type === 'python' ? 'Analizando con Python...' : 'Analizando con IA...';
        btnText.textContent = message;
        spinner.style.display = 'inline-block';
        btn.disabled = true;
    } else {
        const originalText = type === 'python' ? 'Análisis Python' : 'Análisis con IA';
        btnText.textContent = originalText;
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

// Mostrar resultados
function displayResults(results) {
    // ...
    displaySchema(results.schema);
    displayDocumentation(results.documentation);
    displayDiagram(results.schema);
    displayAnomalies(results.schema);
    displayTestData(results.schema);
    resultsSection.style.display = 'block';
    resetConversionResult();
    updateConverterButtons();
    
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetConversionResult() {
    const convertedCodeEl = document.getElementById('convertedCode');
    const placeholderText = document.querySelector('.placeholder-text');
    const downloadConvertedBtn = document.getElementById('downloadConvertedBtn');

    if (convertedCodeEl) {
        convertedCodeEl.textContent = '';
        convertedCodeEl.style.display = 'none';
    }
    if (placeholderText) {
        placeholderText.style.display = 'block';
        placeholderText.textContent = 'Selecciona un formato y presiona Transformar...';
    }
    if (downloadConvertedBtn) {
        downloadConvertedBtn.disabled = true;
    }
}

function updateConverterButtons() {
    const targetFormat = document.getElementById('targetFormat');
    const convertBtn = document.getElementById('convertBtn');
    const downloadConvertedBtn = document.getElementById('downloadConvertedBtn');
    const convertedCodeEl = document.getElementById('convertedCode');
    const hasSchema = currentResults && currentResults.schema;
    const hasTarget = targetFormat && targetFormat.value;

    if (convertBtn) {
        convertBtn.disabled = !hasSchema || !hasTarget;
    }
    if (downloadConvertedBtn) {
        downloadConvertedBtn.disabled = !convertedCodeEl || !convertedCodeEl.textContent.trim();
    }
}

function displaySchema(schema) {
    // Mostrar estadísticas
    const statsHtml = `
        <div class="stat-card">
            <h4>Tablas Encontradas</h4>
            <p>${schema.tables.length}</p>
        </div>
        <div class="stat-card">
            <h4>Relaciones Inferidas</h4>
            <p>${schema.relations ? schema.relations.length : 0}</p>
        </div>
        <div class="stat-card">
            <h4>Columnas Totales</h4>
            <p>${schema.tables.reduce((total, table) => total + table.columns.length, 0)}</p>
        </div>
    `;
    document.getElementById('schemaStats').innerHTML = statsHtml;
    
    // Mostrar tablas
    const tablesHtml = schema.tables.map(table => `
        <div class="table-card">
            <div class="table-name">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                ${escapeHtml(table.name)}
            </div>
            <div class="table-columns">
                ${table.columns.map(column => `
                    <div class="column-item">
                        <span class="column-name">${escapeHtml(column.name)}</span>
                        <span class="column-type">${escapeHtml(column.type)}</span>
                        <div class="badges-wrapper">
                            ${column.primaryKey ? '<span class="column-badge badge-primary">PK</span>' : ''}
                            ${!column.nullable ? '<span class="column-badge badge-nullable">NOT NULL</span>' : ''}
                            ${column.autoIncrement ? '<span class="column-badge badge-auto">AUTO</span>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    document.getElementById('tablesContainer').innerHTML = tablesHtml;
}

async function displayDiagram(schema) {
    const diagramContainer = document.getElementById('mermaidDiagram');
    diagramContainer.innerHTML = ''; // Limpiar anterior
    
    if (!schema.tables || schema.tables.length === 0) {
        diagramContainer.innerHTML = '<p class="no-data">No hay datos suficientes para generar un diagrama.</p>';
        return;
    }

    // Generar sintaxis de Mermaid para ER Diagram
    let mermaidCode = 'erDiagram\n';
    
    // Definir tablas y campos
    schema.tables.forEach(table => {
        const cleanTableName = table.name.replace(/\s+/g, '_');
        mermaidCode += `    ${cleanTableName} {\n`;
        table.columns.forEach(col => {
            const type = col.type.split('(')[0].replace(/\s+/g, '_');
            const name = col.name.replace(/\s+/g, '_');
            const pk = col.primaryKey ? 'PK' : '';
            mermaidCode += `        ${type} ${name} ${pk}\n`;
        });
        mermaidCode += `    }\n`;
    });

    // Definir relaciones
    if (schema.relations && schema.relations.length > 0) {
        schema.relations.forEach(rel => {
            const from = rel.from.replace(/\s+/g, '_');
            const to = rel.to.replace(/\s+/g, '_');
            // Usamos una relación genérica 1:N si no se especifica
            mermaidCode += `    ${from} ||--o{ ${to} : "relaciona"\n`;
        });
    }

    try {
        // Inicializar Mermaid con tema oscuro
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                background: '#0c0e12',
                primaryColor: '#0c0e12',
                lineColor: '#ffffff',
                textColor: '#ffffff'
            }
        });
        
        // Renderizar usando la API de Mermaid
        const { render } = mermaid;
        const id = 'mermaid-' + Date.now();
        const { svg } = await mermaid.render(id, mermaidCode);
        diagramContainer.innerHTML = svg;
    } catch (error) {
        console.error('Error rendering mermaid:', error);
        diagramContainer.innerHTML = '<p class="error-text">Error al generar el diagrama visual. Revisa el esquema bruto.</p>';
    }
}


// ===================== ANOMALÍAS (SIN EMOJIS, CON TABLAS) =====================
function analyzeAnomalies(schema) {
    const tables = schema.tables || [];
    const anomaliesByType = {
        singleColumnTables: [],
        sequentialColumnNames: [],
        implicitForeignKeys: [],
        floatColumns: [],
        tablesWithoutPK: [],
        longVarcharColumns: []
    };

    for (const table of tables) {
        // 1. Tabla con una sola columna
        if (table.columns.length === 1) {
            anomaliesByType.singleColumnTables.push({
                table: table.name,
                columnCount: table.columns.length
            });
        }

        // 2. Columnas con nombres secuenciales (desnormalización)
        const sequentialPattern = /^(col|field|attr|column|columna|campo)\d+$/i;
        const sequentialCols = table.columns.filter(col => sequentialPattern.test(col.name));
        if (sequentialCols.length > 0) {
            anomaliesByType.sequentialColumnNames.push({
                table: table.name,
                columns: sequentialCols.map(c => c.name).join(', ')
            });
        }

        // 3. Posibles claves foráneas implícitas (terminan en _id sin restricción formal)
        const fks = table.foreignKeys || [];
        const implicitFkCols = table.columns.filter(col => {
            const colNameLower = col.name.toLowerCase();
            const isFk = colNameLower.endsWith('_id');
            if (!isFk) return false;
            // Verificar si esta columna ya tiene una clave foránea explícita
            const isExplicit = fks.some(fk => {
                const fkCol = (fk.column || '').toLowerCase();
                return fkCol === colNameLower;
            });
            return !isExplicit;
        });
        if (implicitFkCols.length > 0) {
            anomaliesByType.implicitForeignKeys.push({
                table: table.name,
                columns: implicitFkCols.map(c => c.name).join(', ')
            });
        }

        // 4. Columnas tipo FLOAT/DOUBLE
        const floatCols = table.columns.filter(col => 
            col.type.toLowerCase().includes('float') || col.type.toLowerCase().includes('double')
        );
        if (floatCols.length > 0) {
            anomaliesByType.floatColumns.push({
                table: table.name,
                columns: floatCols.map(c => `${c.name} (${c.type})`).join(', ')
            });
        }

        // 5. Tabla sin Primary Key
        const hasPK = table.columns.some(col => col.primaryKey === true);
        if (!hasPK) {
            anomaliesByType.tablesWithoutPK.push({
                table: table.name
            });
        }

        // 6. Columnas VARCHAR mayores a 255
        const longVarchars = table.columns.filter(col => {
            const match = col.type.match(/varchar\((\d+)\)/i);
            return match && parseInt(match[1]) > 255;
        });
        if (longVarchars.length > 0) {
            anomaliesByType.longVarcharColumns.push({
                table: table.name,
                columns: longVarchars.map(c => `${c.name} (${c.type})`).join(', ')
            });
        }
    }

    return anomaliesByType;
}

function displayAnomalies(schema) {
    const container = document.getElementById('anomaliesContainer');
    if (!container) return;

    const anomalies = analyzeAnomalies(schema);
    const totalTables = schema.tables.length;
    
    // Contar cuántos tipos de anomalía tienen al menos una incidencia
    let anomalyTypesWithIssues = 0;
    let totalIncidencias = 0;
    for (const key in anomalies) {
        if (anomalies[key].length > 0) {
            anomalyTypesWithIssues++;
            totalIncidencias += anomalies[key].length;
        }
    }

    // Generar el HTML con tres tarjetas
    let html = `
        <div class="schema-stats" style="margin-bottom: 24px;">
            <div class="stat-card">
                <h4>Tablas analizadas</h4>
                <p>${totalTables}</p>
            </div>
            <div class="stat-card">
                <h4>Tipos de anomalía</h4>
                <p>${anomalyTypesWithIssues}</p>
            </div>
            <div class="stat-card">
                <h4>Incidencias totales</h4>
                <p>${totalIncidencias}</p>
            </div>
        </div>
        <div class="anomalies-list">
    `;

    // Definir los títulos y descripciones de cada tipo de anomalía
    const anomalyDefinitions = [
        { key: 'singleColumnTables', title: 'Tablas con una sola columna', description: 'Una tabla con una única columna suele indicar un diseño pobre o una entidad mal modelada. Normalizar o fusionar con otra tabla podría ser necesario.' },
        { key: 'sequentialColumnNames', title: 'Columnas con nombres secuenciales', description: 'Nombres como col1, col2, campo3 sugieren desnormalización (atributos repetidos horizontalmente). Se recomienda migrar a una estructura vertical (una fila por valor).' },
        { key: 'implicitForeignKeys', title: 'Posibles claves foráneas implícitas', description: 'Columnas terminadas en "_id" que podrían referenciar otra tabla, pero sin restricción formal de integridad referencial. Considere agregar FOREIGN KEY o documentar la relación.' },
        { key: 'floatColumns', title: 'Uso de FLOAT o DOUBLE', description: 'Los tipos flotantes pueden causar errores de redondeo en valores monetarios o críticos. Emplee DECIMAL/NUMERIC en su lugar.' },
        { key: 'tablesWithoutPK', title: 'Tablas sin clave primaria', description: 'La ausencia de una clave primaria impide la identificación única de filas y afecta la integridad referencial.' },
        { key: 'longVarcharColumns', title: 'Columnas VARCHAR excesivamente largas', description: 'VARCHAR con longitud > 255 puede degradar el rendimiento. Evalúe si realmente se necesita tanta capacidad.' }
    ];

    for (const def of anomalyDefinitions) {
        const items = anomalies[def.key];
        if (items && items.length > 0) {
            html += `
                <div class="anomaly-card">
                    <div class="anomaly-header">
                        <h3>${def.title}</h3>
                        <span class="badge-issue">${items.length} incidencia(s)</span>
                    </div>
                    <p class="anomaly-description">${def.description}</p>
                    <div class="anomaly-table-wrapper">
                        <table class="anomaly-table">
                            <thead>
                                <tr><th>Tabla</th><th>Detalle</th></tr>
                            </thead>
                            <tbody>
            `;
            for (const item of items) {
                if (def.key === 'singleColumnTables') {
                    html += `<tr><td>${escapeHtml(item.table)}</td><td>La tabla tiene exactamente 1 columna.</td></tr>`;
                } else if (def.key === 'sequentialColumnNames') {
                    html += `<tr><td>${escapeHtml(item.table)}</td><td>Columnas con nombres secuenciales: ${escapeHtml(item.columns)}</td></tr>`;
                } else if (def.key === 'implicitForeignKeys') {
                    html += `<tr><td>${escapeHtml(item.table)}</td><td>Columnas: ${escapeHtml(item.columns)}</td></tr>`;
                } else if (def.key === 'floatColumns') {
                    html += `<tr><td>${escapeHtml(item.table)}</td><td>Columnas: ${escapeHtml(item.columns)}</td></tr>`;
                } else if (def.key === 'tablesWithoutPK') {
                    html += `<tr><td>${escapeHtml(item.table)}</td><td>No se definió ninguna clave primaria.</td></tr>`;
                } else if (def.key === 'longVarcharColumns') {
                    html += `<tr><td>${escapeHtml(item.table)}</td><td>Columnas: ${escapeHtml(item.columns)}</td></tr>`;
                }
            }
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }

    // Si no hay ningún tipo de anomalía, mostrar mensaje global
    const hasAnyAnomaly = anomalyDefinitions.some(def => anomalies[def.key] && anomalies[def.key].length > 0);
    if (!hasAnyAnomaly) {
        html += `
            <div class="anomaly-card clean">
                <div class="anomaly-header">
                    <h3>Sin anomalías detectadas</h3>
                    <span class="badge-clean">OK</span>
                </div>
                <p class="clean-message">El esquema analizado no presenta ninguna de las anomalías revisadas: tablas de una columna, nombres secuenciales, claves foráneas implícitas, tipos float, falta de PK o VARCHAR excesivos.</p>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}
//-------------------------------

function displayDocumentation(documentation) {
    // Limpiar bloques de código markdown si la IA los incluyó
    let cleanDoc = documentation;
    
    // Eliminar bloques ```markdown ... ``` o simplemente ``` ... ```
    const markdownMatch = cleanDoc.match(/```(?:markdown)?\s?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
        cleanDoc = markdownMatch[1];
    }
    
    // Detectar y transformar la barra de progreso de auditoría
    // Patrón: [████████░░] 80%
    const progressBarRegex = /\[[█░]+\]\s*(\d+)%/g;
    cleanDoc = cleanDoc.replace(progressBarRegex, (match, percentage) => {
        return `
<div class="audit-bar-wrapper">
    <div class="audit-bar-label">
        <span>Nivel de Cumplimiento Técnico</span>
        <span>${percentage}%</span>
    </div>
    <div class="audit-bar-bg">
        <div class="audit-bar-fill" data-width="${percentage}"></div>
    </div>
</div>`;
    });
    
    // Usar marked para parsear el markdown
    const html = marked.parse(cleanDoc);
    document.getElementById('documentationContent').innerHTML = html;

    // Disparar la animación de la barra después de un breve delay
    setTimeout(() => {
        const fills = document.querySelectorAll('.audit-bar-fill');
        fills.forEach(fill => {
            const width = fill.getAttribute('data-width');
            fill.style.width = width + '%';
        });
    }, 100);
}

// Tab switching
function switchTab(event) {
    const tabName = event.target.dataset.tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Manejo de errores
function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    hideResults();
}

function hideError() {
    errorSection.style.display = 'none';
}

function hideResults() {
    resultsSection.style.display = 'none';
    currentResults = null;

    const documentationContent = document.getElementById('documentationContent');
    const schemaStats = document.getElementById('schemaStats');
    const tablesContainer = document.getElementById('tablesContainer');
    const mermaidDiagram = document.getElementById('mermaidDiagram');

    if (documentationContent) documentationContent.innerHTML = '';
    if (schemaStats) schemaStats.innerHTML = '';
    if (tablesContainer) tablesContainer.innerHTML = '';
    if (mermaidDiagram) mermaidDiagram.innerHTML = '';

    resetConversionResult();
    updateConverterButtons();
}

// Reset upload
function resetUpload() {
    removeFile();
    hideError();
}

// Utilidades
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Manejo de Zoom del Diagrama
function handleZoom(event) {
    const scale = event.target.value;
    const diagram = document.querySelector('#mermaidDiagram svg');
    const zoomValue = document.getElementById('zoomValue');
    
    if (diagram) {
        diagram.style.transform = `scale(${scale})`;
        diagram.style.transformOrigin = 'top center';
    }
    if (zoomValue) {
        zoomValue.textContent = `${Math.round(scale * 100)}%`;
    }
}

// Descargar Diagrama como SVG
function downloadDiagram() {
    const svgElement = document.querySelector('#mermaidDiagram svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagrama_er_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getDocumentationCleanText() {
    if (!currentResults || !currentResults.documentation) return '';
    let text = currentResults.documentation;
    const markdownMatch = text.match(/```(?:markdown)?\s?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
        text = markdownMatch[1];
    }
    return text.trim();
}

function downloadWord() {
    if (!currentResults || !currentResults.documentation) {
        showError('No hay documentación IA disponible para descargar.');
        return;
    }

    const documentationHtml = marked.parse(getDocumentationCleanText());

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Documentación IA</title>
<style>
    body { font-family: Arial, sans-serif; padding: 32px; background: #ffffff; color: #1a1a1a; }
    h1.doc-title { color: #5e6ad2; font-size: 1.6rem; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 28px; }
    h1 { font-size: 1.4rem; color: #5e6ad2; margin: 24px 0 10px; border-bottom: 2px solid #e0e4ff; padding-bottom: 6px; }
    h2 { font-size: 1.2rem; color: #5e6ad2; margin: 20px 0 8px; border-bottom: 1px solid #e0e4ff; padding-bottom: 4px; }
    h3 { font-size: 1.05rem; color: #7c3aed; margin: 16px 0 6px; }
    p { margin-bottom: 12px; color: #333; line-height: 1.7; }
    ul, ol { padding-left: 24px; margin-bottom: 12px; }
    li { margin-bottom: 5px; color: #333; }
    strong { color: #1a1a1a; }
    code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.88rem; color: #7c3aed; }
    pre { background: #f5f5ff; border: 1px solid #e0e4ff; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
    blockquote { border-left: 4px solid #5e6ad2; padding: 8px 14px; background: #f5f5ff; margin-bottom: 12px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #f0f2f5; }
    th { padding: 10px 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; }
    td { padding: 10px 12px; border-bottom: 1px solid #e8e8e8; color: #444; }
    hr { border: none; border-top: 1px solid #e0e4ff; margin: 20px 0; }
    .audit-bar-wrapper { margin: 16px 0; }
    .audit-bar-label { display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem; margin-bottom: 6px; }
    .audit-bar-bg { background: #e0e4ff; border-radius: 8px; height: 16px; overflow: hidden; }
    .audit-bar-fill { background: linear-gradient(90deg, #5e6ad2, #9d4edd); height: 16px; border-radius: 8px; }
</style>
</head>
<body>
    <h1 class="doc-title">Documentación IA</h1>
    <p class="subtitle">Generado automáticamente por DataScript AI</p>
    ${documentationHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `documentacion_ia_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadPdf() {
    if (!currentResults || !currentResults.documentation) {
        showError('No hay documentación IA disponible para descargar.');
        return;
    }

    const docText = getDocumentationCleanText();
    let jsPDF;

    // Intentar diferentes formas de acceder a jsPDF
    if (window.jsPDF) {
        jsPDF = window.jsPDF;
    } else if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
    } else {
        showError('La librería PDF no está disponible. Recarga la página e inténtalo de nuevo.');
        return;
    }

    try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
        const textLines = doc.splitTextToSize(docText, pageWidth);
        doc.setFontSize(11);
        doc.text(textLines, margin, 20);
        doc.save(`documentacion_ia_${Date.now()}.pdf`);
    } catch (error) {
        console.error('Error generando PDF:', error);
        showError('Error al generar el PDF. Inténtalo de nuevo.');
    }
}

function printDocumentation() {
    if (!currentResults || !currentResults.documentation) {
        showError('No hay documentación IA disponible para imprimir.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showError('No se pudo abrir la ventana de impresión. Verifica tu navegador.');
        return;
    }

    const documentationHtml = marked.parse(getDocumentationCleanText());

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Documentación IA</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 32px; background: #ffffff; color: #1a1a1a; }
    h1.doc-title { color: #5e6ad2; font-size: 1.6rem; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 28px; }

    /* Markdown general */
    .markdown-body { line-height: 1.7; font-size: 0.95rem; color: #1a1a1a; }
    .markdown-body h1 { font-size: 1.4rem; color: #5e6ad2; margin: 24px 0 10px; border-bottom: 2px solid #e0e4ff; padding-bottom: 6px; }
    .markdown-body h2 { font-size: 1.2rem; color: #5e6ad2; margin: 20px 0 8px; border-bottom: 1px solid #e0e4ff; padding-bottom: 4px; }
    .markdown-body h3 { font-size: 1.05rem; color: #7c3aed; margin: 16px 0 6px; }
    .markdown-body p { margin-bottom: 12px; color: #333; }
    .markdown-body ul, .markdown-body ol { padding-left: 24px; margin-bottom: 12px; }
    .markdown-body li { margin-bottom: 5px; color: #333; }
    .markdown-body strong { color: #1a1a1a; font-weight: 700; }
    .markdown-body em { color: #555; }
    .markdown-body code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.88rem; color: #7c3aed; }
    .markdown-body pre { background: #f5f5ff; border: 1px solid #e0e4ff; border-radius: 8px; padding: 14px; margin-bottom: 14px; overflow-x: auto; }
    .markdown-body pre code { background: none; padding: 0; color: #333; }
    .markdown-body blockquote { border-left: 4px solid #5e6ad2; padding: 8px 14px; background: #f5f5ff; border-radius: 0 8px 8px 0; margin-bottom: 12px; color: #555; }
    .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .markdown-body thead tr { background: #f0f2f5; }
    .markdown-body th { padding: 10px 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; font-size: 0.88rem; }
    .markdown-body td { padding: 10px 12px; border-bottom: 1px solid #e8e8e8; color: #444; font-size: 0.88rem; }
    .markdown-body hr { border: none; border-top: 1px solid #e0e4ff; margin: 20px 0; }

    /* Barra de auditoría */
    .audit-bar-wrapper { margin: 16px 0; }
    .audit-bar-label { display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem; margin-bottom: 6px; color: #333; }
    .audit-bar-bg { background: #e0e4ff; border-radius: 8px; height: 16px; overflow: hidden; }
    .audit-bar-fill { background: linear-gradient(90deg, #5e6ad2, #9d4edd); height: 16px; border-radius: 8px; }

    @media print { body { padding: 16px; } }
</style>
</head>
<body>
    <h1 class="doc-title">Documentación IA</h1>
    <p class="subtitle">Generado automáticamente por DataScript AI</p>
    <div class="markdown-body">${documentationHtml}</div>
<script>
    // Animar barras de auditoría
    document.querySelectorAll('.audit-bar-fill[data-width]').forEach(el => {
        el.style.width = el.getAttribute('data-width') + '%';
    });
</script>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// Convertidor de Esquemas
async function convertSchema() {
    const role = sessionStorage.getItem('ds_role') || 'usuario';
    if (role === 'usuario') {
        if (currentResults && currentResults.analysisType === 'python') {
            // Permitir conversión local con python
        } else {
            showPremiumUpgradeModal();
            return;
        }
    }
    if (!currentResults || !currentResults.schema) {
        showError('Primero debes analizar un archivo para tener un esquema que convertir.');
        return;
    }
    
    const targetFormat = document.getElementById('targetFormat').value;
    const convertBtn = document.getElementById('convertBtn');
    const convertedCodeEl = document.getElementById('convertedCode');
    const placeholderText = document.querySelector('.placeholder-text');

    // Si se analizó con Python y ya tenemos la conversión disponible localmente
    if (currentResults.analysisType === 'python' && currentResults.conversions && currentResults.conversions.success) {
        let code = '';
        const formats = currentResults.conversions.formats || {};
        const fmt = targetFormat ? targetFormat.toLowerCase() : '';

        if (fmt === 'mysql' || fmt === 'mariadb') {
            code = formats.mysql || formats.sqlite || '';
        } else if (fmt === 'postgresql') {
            code = formats.postgres || '';
        } else if (fmt === 'mongodb') {
            code = formats.mongodb || '';
        } else if (fmt === 'prisma') {
            code = formats.prisma || '';
        } else if (fmt === 'graphql') {
            code = formats.graphql || '';
        } else if (fmt === 'json' || fmt === 'json_schema') {
            code = formats.json_schema || '';
        } else if (fmt === 'json_crack') {
            code = formats.json_crack || '';
        } else if (formats[fmt]) {
            code = formats[fmt];
        }

        if (typeof code === 'object') {
            code = JSON.stringify(code, null, 2);
        }

        if (code) {
            convertedCodeEl.textContent = code;
            convertedCodeEl.style.display = 'block';
            if (placeholderText) placeholderText.style.display = 'none';
            updateConverterButtons();

            // Registrar log de conversión local
            try {
                const userId = sessionStorage.getItem('ds_user') || '';
                const userEmail = sessionStorage.getItem('ds_email') || '';
                fetch('/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuarioId: userId,
                        usuarioEmail: userEmail,
                        accion: 'convert',
                        detalles: {
                            targetFormat: targetFormat,
                            tipo: 'local_python'
                        }
                    })
                });
            } catch (logErr) {
                console.error('Error registrando log de conversion local:', logErr);
            }

            return;
        }
    }
    
    // Mostrar cargando
    convertBtn.disabled = true;
    convertBtn.innerHTML = 'Convirtiendo...';
    
    try {
        const userId = sessionStorage.getItem('ds_user') || '';
        const userEmail = sessionStorage.getItem('ds_email') || '';
        const response = await fetch('/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
                'x-user-email': userEmail
            },
            body: JSON.stringify({
                schema: currentResults.schema,
                targetFormat: targetFormat
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            let code = result.convertedCode || '';
            // Limpiar bloques de código markdown si existen
            code = code.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
            
            convertedCodeEl.textContent = code;
            convertedCodeEl.style.display = 'block';
            if (placeholderText) placeholderText.style.display = 'none';

            updateConverterButtons();
            if (!code.trim()) {
                showError('No se generó un esquema convertido válido para descargar.');
            }
        } else {
            showError('Error en la conversión: ' + result.error);
        }
    } catch (error) {
        showError('Error de conexión: ' + error.message);
    } finally {
        convertBtn.disabled = false;
        convertBtn.innerHTML = 'Transformar Esquema';
    }
}

// Funciones para Diagrama ER
function downloadDiagramPdf() {
    const svgElement = document.querySelector('#mermaidDiagram svg');
    if (!svgElement) {
        showError('No hay diagrama disponible para descargar.');
        return;
    }

    let jsPDF;
    if (window.jsPDF) {
        jsPDF = window.jsPDF;
    } else if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
    } else {
        showError('La librería PDF no está disponible.');
        return;
    }

    try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const svgData = new XMLSerializer().serializeToString(svgElement);
        
        // Crear una imagen temporal del SVG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            doc.save(`diagrama_er_${Date.now()}.pdf`);
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } catch (error) {
        console.error('Error generando PDF del diagrama:', error);
        showError('Error al generar el PDF del diagrama.');
    }
}

function printDiagram() {
    const svgElement = document.querySelector('#mermaidDiagram svg');
    if (!svgElement) {
        showError('No hay diagrama disponible para imprimir.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showError('No se pudo abrir la ventana de impresión.');
        return;
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Imprimir Diagrama ER</title>
<style>
body { margin: 0; padding: 20px; background: white; }
svg { max-width: 100%; height: auto; }
</style>
</head>
<body>${svgData}</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// Función para Convertidor
function downloadConverted() {
    const convertedCodeEl = document.getElementById('convertedCode');
    if (!convertedCodeEl || !convertedCodeEl.textContent.trim()) {
        showError('No hay código convertido disponible para descargar.');
        return;
    }

    const targetFormat = document.getElementById('targetFormat').value;
    const code = convertedCodeEl.textContent;
    
    // Determinar extensión según el formato
    let extension = 'txt';
    switch (targetFormat) {
        case 'sql': extension = 'sql'; break;
        case 'mariadb': extension = 'sql'; break;
        case 'mongodb': extension = 'js'; break;
        case 'prisma': extension = 'prisma'; break;
        case 'graphql': extension = 'graphql'; break;
        case 'json': extension = 'json'; break;
    }
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esquema_convertido_${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Funciones auxiliares para Esquema Bruto
function getSchemaText() {
    if (!currentResults || !currentResults.schema) return '';
    
    let text = 'ESQUEMA DE BASE DE DATOS\n\n';
    
    // Estadísticas
    const tables = currentResults.schema.tables || [];
    text += `Tablas encontradas: ${tables.length}\n`;
    text += `Relaciones inferidas: ${currentResults.schema.relations ? currentResults.schema.relations.length : 0}\n`;
    text += `Columnas totales: ${tables.reduce((total, table) => total + table.columns.length, 0)}\n\n`;
    
    // Detalles de tablas
    tables.forEach(table => {
        text += `TABLA: ${table.name}\n`;
        text += 'COLUMNAS:\n';
        table.columns.forEach(col => {
            const pk = col.primaryKey ? ' (PK)' : '';
            const nn = !col.nullable ? ' (NOT NULL)' : '';
            const ai = col.autoIncrement ? ' (AUTO)' : '';
            text += `  - ${col.name}: ${col.type}${pk}${nn}${ai}\n`;
        });
        text += '\n';
    });
    
    return text;
}

// Funciones para Esquema Bruto
function downloadSchemaWord() {
    const schemaText = getSchemaText();
    if (!schemaText) {
        showError('No hay esquema disponible para descargar.');
        return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Esquema de Base de Datos</title>
</head>
<body><pre>${schemaText}</pre></body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esquema_bruto_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function downloadSchemaPdf() {
    if (!currentResults || !currentResults.schema) {
        showError('No hay esquema disponible para descargar.');
        return;
    }

    const originalBtn = document.getElementById('downloadSchemaPdfBtn');
    const originalContent = originalBtn.innerHTML;
    originalBtn.disabled = true;
    originalBtn.innerHTML = 'Generando PDF...';

    try {
        const schema = currentResults.schema;
        const tables = schema.tables || [];
        const totalColumns = tables.reduce((t, table) => t + table.columns.length, 0);
        const totalRelations = schema.relations ? schema.relations.length : 0;

        // Construir HTML visual igual al de anomalías
        let tablesHtml = '';
        tables.forEach(table => {
            const hasPK = table.columns.some(c => c.primaryKey);
            const rowsHtml = table.columns.map(col => {
                const badges = [];
                if (col.primaryKey) badges.push('<span style="background:#5e6ad2;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:bold;">PK</span>');
                if (col.autoIncrement) badges.push('<span style="background:#9d4edd;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:bold;">AUTO</span>');
                if (!col.nullable) badges.push('<span style="background:#ff9800;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:bold;">NOT NULL</span>');
                return `
                    <tr>
                        <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#333;">${col.name}</td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#555;font-family:monospace;">${col.type}</td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;">${badges.join(' ')}</td>
                    </tr>`;
            }).join('');

            tablesHtml += `
                <div style="background:#f9f9ff;border-radius:16px;padding:20px;margin-bottom:20px;
                            border-left:6px solid #5e6ad2;border-top:1px solid #eee;
                            border-right:1px solid #eee;border-bottom:1px solid #eee;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                        <h3 style="margin:0;color:#1a1a1a;font-size:1.1rem;">&#128203; ${table.name}</h3>
                        <span style="background:${hasPK ? '#5e6ad2' : '#ff5252'};color:white;padding:4px 12px;
                                     border-radius:20px;font-size:0.8rem;font-weight:bold;">
                            ${table.columns.length} columna(s)
                        </span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Columna</th>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Tipo</th>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Atributos</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>`;
        });

        // Relaciones
        let relationsHtml = '';
        if (schema.relations && schema.relations.length > 0) {
            const relRows = schema.relations.map(rel => `
                <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#333;">${rel.from}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#555;">&#8594;</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#333;">${rel.to}</td>
                </tr>`).join('');

            relationsHtml = `
                <div style="background:#f9f9ff;border-radius:16px;padding:20px;margin-bottom:20px;
                            border-left:6px solid #9d4edd;border-top:1px solid #eee;
                            border-right:1px solid #eee;border-bottom:1px solid #eee;">
                    <h3 style="margin:0 0 14px 0;color:#1a1a1a;font-size:1.1rem;">&#128279; Relaciones inferidas</h3>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Desde</th>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;"></th>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Hacia</th>
                            </tr>
                        </thead>
                        <tbody>${relRows}</tbody>
                    </table>
                </div>`;
        }

        const fullHtml = `
            <div style="font-family:Arial,sans-serif;padding:40px;background:#ffffff;color:#000;width:800px;">
                <h1 style="color:#5e6ad2;margin-bottom:6px;font-size:1.6rem;">Esquema de Base de Datos</h1>
                <p style="color:#888;margin-bottom:24px;font-size:0.9rem;">Generado automáticamente</p>

                <div style="display:flex;gap:20px;margin-bottom:28px;">
                    <div style="background:#f0f4ff;padding:16px;border-radius:12px;text-align:center;flex:1;border:1px solid #d0d7ff;">
                        <div style="font-size:0.85rem;color:#555;margin-bottom:6px;">Tablas encontradas</div>
                        <div style="font-size:2rem;font-weight:700;color:#5e6ad2;">${tables.length}</div>
                    </div>
                    <div style="background:#f0f4ff;padding:16px;border-radius:12px;text-align:center;flex:1;border:1px solid #d0d7ff;">
                        <div style="font-size:0.85rem;color:#555;margin-bottom:6px;">Relaciones inferidas</div>
                        <div style="font-size:2rem;font-weight:700;color:#5e6ad2;">${totalRelations}</div>
                    </div>
                    <div style="background:#f0f4ff;padding:16px;border-radius:12px;text-align:center;flex:1;border:1px solid #d0d7ff;">
                        <div style="font-size:0.85rem;color:#555;margin-bottom:6px;">Columnas totales</div>
                        <div style="font-size:2rem;font-weight:700;color:#5e6ad2;">${totalColumns}</div>
                    </div>
                </div>

                ${tablesHtml}
                ${relationsHtml}
            </div>`;

        // Montar en DOM oculto
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-9999px';
        wrapper.style.top = '0';
        wrapper.style.zIndex = '-1';
        wrapper.innerHTML = fullHtml;
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(wrapper.firstElementChild, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');

        let jsPDF;
        if (window.jsPDF) {
            jsPDF = window.jsPDF;
        } else if (window.jspdf && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
        } else {
            throw new Error('La librería jsPDF no está cargada correctamente.');
        }

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 190;
        const pageHeight = 287;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 10;

        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 10);

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`esquema_bruto_${Date.now()}.pdf`);
        document.body.removeChild(wrapper);

    } catch (error) {
        console.error('Error generando PDF del esquema:', error);
        showError('Error al generar el PDF del esquema: ' + error.message);
    } finally {
        originalBtn.disabled = false;
        originalBtn.innerHTML = originalContent;
    }
}

function printSchema() {
    if (!currentResults || !currentResults.schema) {
        showError('No hay esquema disponible para imprimir.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showError('No se pudo abrir la ventana de impresión.');
        return;
    }

    const schema = currentResults.schema;
    const tables = schema.tables || [];
    const totalColumns = tables.reduce((t, table) => t + table.columns.length, 0);
    const totalRelations = schema.relations ? schema.relations.length : 0;

    // Construir tarjetas de tablas
    let tablesHtml = '';
    tables.forEach(table => {
        const hasPK = table.columns.some(c => c.primaryKey);
        const rowsHtml = table.columns.map(col => {
            const badges = [];
            if (col.primaryKey) badges.push('<span class="badge badge-pk">PK</span>');
            if (col.autoIncrement) badges.push('<span class="badge badge-auto">AUTO</span>');
            if (!col.nullable) badges.push('<span class="badge badge-nn">NOT NULL</span>');
            return `
                <tr>
                    <td>${col.name}</td>
                    <td class="mono">${col.type}</td>
                    <td>${badges.join(' ')}</td>
                </tr>`;
        }).join('');

        tablesHtml += `
            <div class="card card-blue">
                <div class="card-header">
                    <h3>&#128203; ${table.name}</h3>
                    <span class="badge ${hasPK ? 'badge-pk' : 'badge-issue'}">
                        ${table.columns.length} columna(s)
                    </span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Columna</th>
                            <th>Tipo</th>
                            <th>Atributos</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>`;
    });

    // Construir sección de relaciones
    let relationsHtml = '';
    if (schema.relations && schema.relations.length > 0) {
        const relRows = schema.relations.map(rel => `
            <tr>
                <td>${rel.from}</td>
                <td style="text-align:center;">&#8594;</td>
                <td>${rel.to}</td>
            </tr>`).join('');

        relationsHtml = `
            <div class="card card-purple">
                <div class="card-header">
                    <h3>&#128279; Relaciones inferidas</h3>
                    <span class="badge badge-auto">${totalRelations} relación(es)</span>
                </div>
                <table>
                    <thead>
                        <tr><th>Desde</th><th></th><th>Hacia</th></tr>
                    </thead>
                    <tbody>${relRows}</tbody>
                </table>
            </div>`;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Imprimir Esquema Bruto</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 32px; background: #ffffff; color: #1a1a1a; }
    h1 { color: #5e6ad2; font-size: 1.6rem; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 24px; }

    .stats { display: flex; gap: 16px; margin-bottom: 28px; }
    .stat-card { background: #f0f4ff; border: 1px solid #d0d7ff; border-radius: 12px;
                 padding: 16px; flex: 1; text-align: center; }
    .stat-card .label { font-size: 0.82rem; color: #555; margin-bottom: 6px; }
    .stat-card .value { font-size: 2rem; font-weight: 700; color: #5e6ad2; }

    .card { border-radius: 14px; padding: 20px; margin-bottom: 20px;
            border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee; }
    .card-blue  { border-left: 6px solid #5e6ad2; background: #f9f9ff; }
    .card-purple { border-left: 6px solid #9d4edd; background: #fdf6ff; }

    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .card-header h3 { font-size: 1.05rem; color: #1a1a1a; }

    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f0f2f5; }
    th { padding: 10px 12px; text-align: left; font-weight: 600; color: #333;
         border-bottom: 2px solid #ddd; font-size: 0.88rem; }
    td { padding: 10px 12px; border-bottom: 1px solid #e8e8e8; color: #444; font-size: 0.88rem; }
    .mono { font-family: monospace; color: #555; }

    .badge { display: inline-block; padding: 2px 9px; border-radius: 10px;
             font-size: 0.75rem; font-weight: bold; color: white; margin-right: 4px; }
    .badge-pk   { background: #5e6ad2; }
    .badge-auto { background: #9d4edd; }
    .badge-nn   { background: #ff9800; }
    .badge-issue { background: #ff5252; }

    @media print {
        body { padding: 16px; }
        .card { page-break-inside: avoid; }
    }
</style>
</head>
<body>
    <h1>Esquema de Base de Datos</h1>
    <p class="subtitle">Generado automáticamente</p>

    <div class="stats">
        <div class="stat-card">
            <div class="label">Tablas encontradas</div>
            <div class="value">${tables.length}</div>
        </div>
        <div class="stat-card">
            <div class="label">Relaciones inferidas</div>
            <div class="value">${totalRelations}</div>
        </div>
        <div class="stat-card">
            <div class="label">Columnas totales</div>
            <div class="value">${totalColumns}</div>
        </div>
    </div>

    ${tablesHtml}
    ${relationsHtml}
</body>
</html>`);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}


function printAnomalies() {
    if (!currentResults || !currentResults.schema) {
        showError('No hay anomalías para imprimir.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showError('No se pudo abrir la ventana de impresión.');
        return;
    }

    const anomalies = analyzeAnomalies(currentResults.schema);
    const totalTables = currentResults.schema.tables.length;
    let anomalyTypesWithIssues = 0;
    let totalIncidencias = 0;
    for (const key in anomalies) {
        if (anomalies[key].length > 0) { anomalyTypesWithIssues++; totalIncidencias += anomalies[key].length; }
    }

    const anomalyDefinitions = [
        { key: 'singleColumnTables', title: 'Tablas con una sola columna', description: 'Una tabla con una única columna suele indicar un diseño pobre o una entidad mal modelada. Normalizar o fusionar con otra tabla podría ser necesario.' },
        { key: 'sequentialColumnNames', title: 'Columnas con nombres secuenciales', description: 'Nombres como col1, col2, campo3 sugieren desnormalización (atributos repetidos horizontalmente). Se recomienda migrar a una estructura vertical (una fila por valor).' },
        { key: 'implicitForeignKeys', title: 'Posibles claves foráneas implícitas', description: 'Columnas terminadas en "_id" que podrían referenciar otra tabla, pero sin restricción formal de integridad referencial. Considere agregar FOREIGN KEY o documentar la relación.' },
        { key: 'floatColumns', title: 'Uso de FLOAT o DOUBLE', description: 'Los tipos flotantes pueden causar errores de redondeo en valores monetarios o críticos. Emplee DECIMAL/NUMERIC en su lugar.' },
        { key: 'tablesWithoutPK', title: 'Tablas sin clave primaria', description: 'La ausencia de una clave primaria impide la identificación única de filas y afecta la integridad referencial.' },
        { key: 'longVarcharColumns', title: 'Columnas VARCHAR excesivamente largas', description: 'VARCHAR con longitud > 255 puede degradar el rendimiento. Evalúe si realmente se necesita tanta capacidad.' }
    ];

    let cardsHtml = '';
    const hasAny = anomalyDefinitions.some(def => anomalies[def.key] && anomalies[def.key].length > 0);

    if (hasAny) {
        for (const def of anomalyDefinitions) {
            const items = anomalies[def.key];
            if (!items || items.length === 0) continue;
            let rows = '';
            for (const item of items) {
                let detalle = '';
                if (def.key === 'singleColumnTables') detalle = 'La tabla tiene exactamente 1 columna.';
                else if (def.key === 'tablesWithoutPK') detalle = 'No se definió ninguna clave primaria.';
                else detalle = 'Columnas' + (def.key === 'sequentialColumnNames' ? ' con nombres secuenciales: ' : ': ') + item.columns;
                rows += `<tr><td>${item.table}</td><td>${detalle}</td></tr>`;
            }
            cardsHtml += `
                <div class="card card-red">
                    <div class="card-header">
                        <h3>${def.title}</h3>
                        <span class="badge badge-issue">${items.length} incidencia(s)</span>
                    </div>
                    <p class="description">${def.description}</p>
                    <table>
                        <thead><tr><th>Tabla</th><th>Detalle</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        }
    } else {
        cardsHtml = `
            <div class="card card-green">
                <div class="card-header">
                    <h3>Sin anomalías detectadas</h3>
                    <span class="badge badge-clean">OK</span>
                </div>
                <p class="clean-msg">El esquema analizado no presenta ninguna de las anomalías revisadas.</p>
            </div>`;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Reporte de Anomalías</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 32px; background: #ffffff; color: #1a1a1a; }
    h1 { color: #e53935; font-size: 1.6rem; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 28px; }
    .stat-card { background: #fff5f5; border: 1px solid #ffcdd2; border-radius: 12px; padding: 16px; flex: 1; text-align: center; }
    .stat-card .label { font-size: 0.82rem; color: #555; margin-bottom: 6px; }
    .stat-card .value { font-size: 2rem; font-weight: 700; color: #e53935; }
    .card { border-radius: 14px; padding: 20px; margin-bottom: 20px; border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee; }
    .card-red   { border-left: 6px solid #ff5252; background: #fff9f9; }
    .card-green { border-left: 6px solid #4caf50; background: #f9fff9; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .card-header h3 { font-size: 1.05rem; color: #1a1a1a; }
    .description { font-size: 0.9rem; color: #555; margin-bottom: 14px; line-height: 1.5; }
    .clean-msg { font-size: 0.95rem; color: #2e7d32; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f0f2f5; }
    th { padding: 10px 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; font-size: 0.88rem; }
    td { padding: 10px 12px; border-bottom: 1px solid #e8e8e8; color: #444; font-size: 0.88rem; }
    .badge { display: inline-block; padding: 3px 11px; border-radius: 20px; font-size: 0.78rem; font-weight: bold; color: white; }
    .badge-issue { background: #ff5252; }
    .badge-clean { background: #4caf50; }
    @media print { body { padding: 16px; } .card { page-break-inside: avoid; } }
</style>
</head>
<body>
    <h1>Reporte de Anomalías</h1>
    <p class="subtitle">Generado automáticamente</p>
    <div class="stats">
        <div class="stat-card"><div class="label">Tablas analizadas</div><div class="value">${totalTables}</div></div>
        <div class="stat-card"><div class="label">Tipos de anomalía</div><div class="value">${anomalyTypesWithIssues}</div></div>
        <div class="stat-card"><div class="label">Incidencias totales</div><div class="value">${totalIncidencias}</div></div>
    </div>
    ${cardsHtml}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

async function downloadAnomaliesPdf() {
    if (!currentResults || !currentResults.schema) {
        showError('No hay contenido de anomalías para exportar a PDF.');
        return;
    }

    const originalBtn = document.getElementById('downloadAnomaliesPdfBtn');
    const originalContent = originalBtn.innerHTML;
    originalBtn.disabled = true;
    originalBtn.innerHTML = 'Generando PDF...';

    try {
        const anomalies = analyzeAnomalies(currentResults.schema);
        const totalTables = currentResults.schema.tables.length;
        let anomalyTypesWithIssues = 0, totalIncidencias = 0;
        for (const key in anomalies) {
            if (anomalies[key].length > 0) { anomalyTypesWithIssues++; totalIncidencias += anomalies[key].length; }
        }

        const anomalyDefinitions = [
            { key: 'singleColumnTables', title: 'Tablas con una sola columna', description: 'Una tabla con una única columna suele indicar un diseño pobre o una entidad mal modelada.' },
            { key: 'sequentialColumnNames', title: 'Columnas con nombres secuenciales', description: 'Nombres como col1, col2, campo3 sugieren desnormalización. Se recomienda migrar a una estructura vertical.' },
            { key: 'implicitForeignKeys', title: 'Posibles claves foráneas implícitas', description: 'Columnas terminadas en "_id" sin restricción formal de integridad referencial.' },
            { key: 'floatColumns', title: 'Uso de FLOAT o DOUBLE', description: 'Los tipos flotantes pueden causar errores de redondeo. Emplee DECIMAL/NUMERIC en su lugar.' },
            { key: 'tablesWithoutPK', title: 'Tablas sin clave primaria', description: 'La ausencia de clave primaria impide la identificación única de filas.' },
            { key: 'longVarcharColumns', title: 'Columnas VARCHAR excesivamente largas', description: 'VARCHAR con longitud > 255 puede degradar el rendimiento.' }
        ];

        let cardsHtml = '';
        const hasAny = anomalyDefinitions.some(def => anomalies[def.key] && anomalies[def.key].length > 0);

        if (hasAny) {
            for (const def of anomalyDefinitions) {
                const items = anomalies[def.key];
                if (!items || items.length === 0) continue;
                let rows = '';
                for (const item of items) {
                    let detalle = '';
                    if (def.key === 'singleColumnTables') detalle = 'La tabla tiene exactamente 1 columna.';
                    else if (def.key === 'tablesWithoutPK') detalle = 'No se definió ninguna clave primaria.';
                    else detalle = 'Columnas' + (def.key === 'sequentialColumnNames' ? ' con nombres secuenciales: ' : ': ') + item.columns;
                    rows += `<tr><td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#333;">${item.table}</td><td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;color:#555;">${detalle}</td></tr>`;
                }
                cardsHtml += `
                    <div style="background:#fff9f9;border-radius:16px;padding:20px;margin-bottom:20px;
                                border-left:6px solid #ff5252;border-top:1px solid #eee;
                                border-right:1px solid #eee;border-bottom:1px solid #eee;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                            <h3 style="margin:0;color:#1a1a1a;font-size:1.05rem;">${def.title}</h3>
                            <span style="background:#ff5252;color:white;padding:3px 11px;border-radius:20px;font-size:0.78rem;font-weight:bold;">${items.length} incidencia(s)</span>
                        </div>
                        <p style="font-size:0.9rem;color:#555;margin-bottom:14px;line-height:1.5;">${def.description}</p>
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Tabla</th>
                                <th style="padding:10px 12px;background:#f0f2f5;text-align:left;color:#333;font-weight:600;border-bottom:2px solid #ddd;">Detalle</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>`;
            }
        } else {
            cardsHtml = `
                <div style="background:#f9fff9;border-radius:16px;padding:20px;margin-bottom:20px;
                            border-left:6px solid #4caf50;border-top:1px solid #eee;
                            border-right:1px solid #eee;border-bottom:1px solid #eee;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <h3 style="margin:0;color:#1a1a1a;">Sin anomalías detectadas</h3>
                        <span style="background:#4caf50;color:white;padding:3px 11px;border-radius:20px;font-size:0.78rem;font-weight:bold;">OK</span>
                    </div>
                    <p style="color:#2e7d32;">El esquema analizado no presenta ninguna de las anomalías revisadas.</p>
                </div>`;
        }

        const fullHtml = `
            <div style="font-family:Arial,sans-serif;padding:40px;background:#ffffff;color:#000;width:800px;">
                <h1 style="color:#e53935;margin-bottom:6px;font-size:1.6rem;">Reporte de Anomalías</h1>
                <p style="color:#888;margin-bottom:24px;font-size:0.9rem;">Generado automáticamente</p>
                <div style="display:flex;gap:20px;margin-bottom:28px;">
                    <div style="background:#fff5f5;padding:16px;border-radius:12px;text-align:center;flex:1;border:1px solid #ffcdd2;">
                        <div style="font-size:0.85rem;color:#555;margin-bottom:6px;">Tablas analizadas</div>
                        <div style="font-size:2rem;font-weight:700;color:#e53935;">${totalTables}</div>
                    </div>
                    <div style="background:#fff5f5;padding:16px;border-radius:12px;text-align:center;flex:1;border:1px solid #ffcdd2;">
                        <div style="font-size:0.85rem;color:#555;margin-bottom:6px;">Tipos de anomalía</div>
                        <div style="font-size:2rem;font-weight:700;color:#e53935;">${anomalyTypesWithIssues}</div>
                    </div>
                    <div style="background:#fff5f5;padding:16px;border-radius:12px;text-align:center;flex:1;border:1px solid #ffcdd2;">
                        <div style="font-size:0.85rem;color:#555;margin-bottom:6px;">Incidencias totales</div>
                        <div style="font-size:2rem;font-weight:700;color:#e53935;">${totalIncidencias}</div>
                    </div>
                </div>
                ${cardsHtml}
            </div>`;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:210mm;background:#ffffff;padding:15mm 20mm;box-sizing:border-box;';
        wrapper.innerHTML = fullHtml;
        document.body.appendChild(wrapper);

        // Configurar opciones de html2pdf
        const opt = {
            margin:       [10, 10, 10, 10], // Margen de 10mm alrededor de cada página
            filename:     `reporte_anomalias_${Date.now()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Salto de página inteligente automático
        };

        await html2pdf().set(opt).from(wrapper.firstElementChild).save();
        document.body.removeChild(wrapper);

    } catch (error) {
        console.error('Error generando PDF de anomalías:', error);
        showError('Error al generar el PDF: ' + error.message);
    } finally {
        originalBtn.disabled = false;
        originalBtn.innerHTML = originalContent;
    }
}


async function downloadSchemaPdfBtn() {
    const anomaliesContainer = document.getElementById('anomaliesContainer');
    if (!anomaliesContainer || !anomaliesContainer.innerHTML.trim()) {
        showError('No hay contenido de anomalías para exportar a PDF.');
        return;
    }

    // Mostrar un indicador de carga si fuera necesario
    const originalBtn = document.getElementById('downloadSchemaPdfBtn');
    const originalContent = originalBtn.innerHTML;
    originalBtn.disabled = true;
    originalBtn.innerHTML = 'Generando PDF...';

    try {
        // Clonar el contenedor para no afectar la vista original
        const cloneContainer = anomaliesContainer.cloneNode(true);
        
        // Estilos para el clon
        cloneContainer.style.position = 'fixed';
        cloneContainer.style.left = '-9999px';
        cloneContainer.style.top = '0';
        cloneContainer.style.width = '800px'; // Ancho fijo para consistencia
        cloneContainer.style.backgroundColor = '#ffffff';
        cloneContainer.style.color = '#000000';
        cloneContainer.style.padding = '40px';
        cloneContainer.style.zIndex = '-1';
        
        document.body.appendChild(cloneContainer);

        // Estilos específicos para el PDF
        const style = document.createElement('style');
        style.textContent = `
            .schema-stats { display: flex; gap: 20px; margin-bottom: 24px; }
            .stat-card { background: #f0f4ff; padding: 16px; border-radius: 12px; text-align: center; flex: 1; border: 1px solid #d0d7ff; }
            .stat-card h4 { margin: 0 0 8px 0; font-size: 0.9rem; color: #333; }
            .stat-card p { font-size: 1.8rem; font-weight: 700; margin: 0; color: #5e6ad2; }
            .anomaly-card { background: #f9f9ff; border-radius: 16px; padding: 20px; margin-bottom: 20px; border-left: 6px solid #ff5252; border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee; }
            .anomaly-card.clean { border-left-color: #4caf50; }
            .anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .anomaly-header h3 { margin: 0; color: #1a1a1a; }
            .badge-issue { background: #ff5252; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
            .badge-clean { background: #4caf50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
            .anomaly-description { font-size: 0.95rem; color: #444; margin-bottom: 16px; line-height: 1.4; }
            .anomaly-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .anomaly-table th, .anomaly-table td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; text-align: left; }
            .anomaly-table th { background: #f0f2f5; font-weight: 600; color: #333; }
            .anomaly-table td { color: #555; }
            .clean-message { background: #e8f5e9; padding: 15px; border-radius: 8px; color: #2e7d32; border: 1px solid #c8e6c9; }
        `;
        cloneContainer.prepend(style);

        // Usar html2canvas para generar la imagen
        const canvas = await html2canvas(cloneContainer, { 
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Detectar jsPDF de forma robusta
        let jsPDF;
        if (window.jsPDF) {
            jsPDF = window.jsPDF;
        } else if (window.jspdf && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
        } else {
            throw new Error('La librería jsPDF no está cargada correctamente.');
        }

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 190; // Margen de 10mm a cada lado
        const pageHeight = 287; // Margen de 5mm arriba/abajo
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 10; // Margen superior inicial

        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 10);

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        pdf.save(`reporte_anomalias_${Date.now()}.pdf`);
        
        // Limpiar
        document.body.removeChild(cloneContainer);

    } catch (error) {
        console.error('Error generando PDF de anomalías:', error);
        showError('Error al generar el PDF: ' + error.message);
    } finally {
        originalBtn.disabled = false;
        originalBtn.innerHTML = originalContent;
    }
}

async function saveDocumentToSupabase() {
    if (!currentResults) {
        alert('No hay resultados de documentación para guardar.');
        return;
    }
    const userId = sessionStorage.getItem('ds_user');
    const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!userId || !isUuid(userId)) {
        alert('Sesión de usuario no válida o de demostración. Inicia sesión con una cuenta real para guardar en Supabase.');
        return;
    }

    const defaultName = selectedFile ? selectedFile.name.split('.')[0] + '_doc' : 'Documento';
    const nombre = prompt('Ingresa un nombre para guardar esta documentación en Supabase:', defaultName);
    if (!nombre) return;

    const saveBtn = document.getElementById('saveDocBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⚡ Subiendo PDF a Storage...';

    try {
        // Generar PDF como Blob
        let pdfUrl = '';
        const element = document.getElementById('documentationContent');
        if (element) {
            // Clonar y dar estilo al elemento para html2pdf
            const clone = element.cloneNode(true);
            clone.style.color = '#1f2937';
            clone.style.backgroundColor = '#ffffff';
            clone.style.padding = '15mm 20mm';
            clone.style.width = '210mm'; // Ancho de A4 para garantizar proporciones exactas
            clone.style.boxSizing = 'border-box';
            
            // Forzar a todos los elementos internos a tener colores legibles en fondo blanco
            clone.querySelectorAll('*').forEach(el => {
                el.style.backgroundColor = 'transparent';
                if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
                    el.style.color = '#1e3a8a'; // Azul corporativo elegante
                    el.style.borderBottom = '2px solid #e5e7eb';
                    el.style.paddingBottom = '6px';
                    el.style.marginTop = '28px'; // Espaciado cómodo arriba
                    el.style.marginBottom = '16px';
                    el.style.fontWeight = '700';
                    el.style.pageBreakAfter = 'avoid'; // Evitar títulos huérfanos al final de página
                } else if (el.tagName === 'P') {
                    el.style.color = '#374151';
                    el.style.lineHeight = '1.7';
                    el.style.marginBottom = '16px';
                } else if (el.tagName === 'TABLE') {
                    el.style.width = '100%';
                    el.style.borderCollapse = 'collapse';
                    el.style.marginBottom = '20px';
                    el.style.pageBreakInside = 'avoid'; // Evitar romper la tabla entera si cabe en una página
                } else if (el.tagName === 'TR') {
                    el.style.pageBreakInside = 'avoid'; // ¡Crucial! Evita cortar filas de tabla a la mitad
                } else if (el.tagName === 'TH') {
                    el.style.color = '#111827';
                    el.style.backgroundColor = '#f3f4f6';
                    el.style.border = '1px solid #d1d5db';
                    el.style.fontWeight = '600';
                    el.style.padding = '10px';
                    el.style.fontSize = '0.9rem';
                } else if (el.tagName === 'TD') {
                    el.style.color = '#374151';
                    el.style.border = '1px solid #e5e7eb';
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
                    el.style.pageBreakInside = 'avoid'; // Evitar cortar fragmentos de código
                } else if (el.tagName === 'LI') {
                    el.style.color = '#374151';
                    el.style.marginBottom = '8px';
                    el.style.lineHeight = '1.6';
                } else {
                    el.style.color = '#374151';
                }
            });

            // Configurar opciones de html2pdf
            const opt = {
                margin:       [10, 10, 10, 10], // Margen de 10mm alrededor de cada página
                filename:     `${nombre.trim()}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Salto de página inteligente automático
            };

            const pdfBlob = await html2pdf().set(opt).from(clone).output('blob');
            const filePath = `user_${userId}/${Date.now()}_documentacion.pdf`;

            // Subir a la sección de Storage de Supabase
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('documentos_pdf')
                .upload(filePath, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.warn('Error al subir al Storage de Supabase. El documento se guardará sin PDF:', uploadError.message);
                pdfUrl = '';
            } else {
                // Obtener la URL pública del PDF subido
                const { data: publicUrlData } = supabaseClient.storage
                    .from('documentos_pdf')
                    .getPublicUrl(filePath);

                pdfUrl = publicUrlData.publicUrl;
            }
        }

        // Generar contenido en base a los resultados actuales
        const contenido = {
            documentation: currentResults.documentation || '',
            schema: currentResults.schema || null,
            anomalies: currentResults.schema ? analyzeAnomalies(currentResults.schema) : null,
            diagramSvg: document.querySelector('#mermaidDiagram svg') ? new XMLSerializer().serializeToString(document.querySelector('#mermaidDiagram svg')) : '',
            pdfUrl: pdfUrl
        };

        const { data, error } = await supabaseClient.from('documentos').insert([
            {
                usuario_id: userId,
                nombre: nombre.trim(),
                acceso: 'Personal',
                contenido: contenido
            }
        ]);

        if (error) throw error;

        // Registrar log de guardado de documento
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuarioId: userId,
                    usuarioEmail: sessionStorage.getItem('ds_email') || '',
                    accion: 'guardar_documento',
                    detalles: {
                        nombreDocumento: nombre.trim()
                    }
                })
            });
        } catch (logErr) {
            console.error('Error registrando log de guardado:', logErr);
        }

        if (pdfUrl) {
            alert('¡Documentación y PDF guardados y subidos con éxito en Supabase!');
        } else {
            alert('¡Documentación guardada con éxito en Supabase! (Nota: El PDF no pudo subirse, asegúrate de crear el bucket "documentos_pdf" en tu consola de Supabase).');
        }
    } catch (err) {
        console.error('Error al guardar en Supabase:', err);
        alert('Error: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// ===================== DATOS DE PRUEBA =====================
let lastGeneratedScript = '';
let lastGeneratedDialect = 'sql';

function displayTestData(schema) {
    const summary = document.getElementById('testdataSummary');
    const advanced = document.getElementById('testdataAdvanced');
    const tableList = document.getElementById('testdataTableList');
    const preview = document.getElementById('testdataPreview');
    const codeEl = document.getElementById('testdataCode');
    const downloadBtn = document.getElementById('downloadTestDataBtn');

    if (!summary || !advanced || !tableList) return;

    lastGeneratedScript = '';
    lastGeneratedDialect = 'sql';
    if (downloadBtn) downloadBtn.disabled = true;
    if (preview) preview.style.display = 'none';
    if (codeEl) codeEl.textContent = '';

    if (!schema || !schema.tables || schema.tables.length === 0) {
        summary.innerHTML = '<p class="placeholder-text" style="position:static; transform:none; width:auto;">No se encontraron tablas en el esquema.</p>';
        advanced.style.display = 'none';
        return;
    }

    const tables = schema.tables;
    const required = getRequiredTables(schema);
    const dialect = getDialectFromSchema(schema);
    const isNoSql = dialect === 'json' || schema.type === 'nosql' || schema.type === 'json' || schema.type === 'yaml' || schema.type === 'excel';
    lastGeneratedDialect = isNoSql ? 'json' : 'sql';

    summary.innerHTML = `
        <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
            <div>
                <strong style="color:var(--accent-hover);">Esquema detectado:</strong> 
                <span style="color:var(--text-muted);">${isNoSql ? 'NoSQL / JSON' : 'SQL (' + (schema.dialect || 'genérico').toUpperCase() + ')'}</span>
                <br>
                <span style="color:var(--text-muted); font-size:0.9rem;">${tables.length} tabla(s) disponibles.</span>
            </div>
            <button id="toggleAdvancedBtn" class="action-btn" style="min-width:auto; padding:8px 16px;">
                Configurar tablas
            </button>
        </div>
    `;

    const toggleBtn = document.getElementById('toggleAdvancedBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = advanced.style.display === 'none';
            advanced.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? 'Ocultar configuración' : 'Configurar tablas';
        });
    }

    // Renderizar lista de tablas
    let html = '';
    tables.forEach((table, idx) => {
        const tname = table.name;
        const isRequired = required.has(tname);
        html += `
            <div class="testdata-table-row" style="display:flex; align-items:center; gap:12px; padding:10px 12px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:8px; flex-wrap:wrap;">
                <input type="checkbox" id="td-check-${idx}" ${isRequired ? 'checked disabled' : 'checked'} 
                    style="width:18px; height:18px; accent-color:var(--accent); cursor:pointer;">
                <label for="td-check-${idx}" style="flex:1; min-width:120px; font-weight:500; cursor:${isRequired ? 'default' : 'pointer'};">
                    ${escapeHtml(tname)}
                    ${isRequired ? '<span class="badge-required">REQUERIDA</span>' : ''}
                </label>
                <div style="display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:0.9rem;">
                    <span>Filas:</span>
                    <input type="number" id="td-rows-${idx}" min="1" max="20" value="5" 
                        style="width:64px; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); color:var(--text-main); padding:6px 10px; border-radius:8px; font-family:var(--font-family);">
                </div>
            </div>
        `;
    });
    tableList.innerHTML = html;
    advanced.style.display = 'none';
}

function getRequiredTables(schema) {
    const required = new Set();
    const tables = schema.tables || [];
    tables.forEach(t => {
        const fks = t.foreignKeys || [];
        fks.forEach(fk => {
            const refTable = fk.referencesTable || (fk.references && fk.references.table) || '';
            if (refTable) required.add(refTable);
        });
    });
    return required;
}

function getDialectFromSchema(schema) {
    if (!schema) return 'mysql';
    if (schema.dialect) return schema.dialect.toLowerCase();
    if (schema.type) return schema.type.toLowerCase();
    return 'mysql';
}

async function generateTestData() {
    if (!currentResults || !currentResults.schema) {
        showError('Primero debes analizar un archivo para generar datos de prueba.');
        return;
    }

    const schema = currentResults.schema;
    const tables = schema.tables || [];
    const required = getRequiredTables(schema);
    const preview = document.getElementById('testdataPreview');
    const codeEl = document.getElementById('testdataCode');
    const downloadBtn = document.getElementById('downloadTestDataBtn');
    const quickBtn = document.getElementById('quickGenerateBtn');

    // Construir config desde UI
    const configTables = {};
    tables.forEach((table, idx) => {
        const tname = table.name;
        const checkbox = document.getElementById(`td-check-${idx}`);
        const rowsInput = document.getElementById(`td-rows-${idx}`);
        const enabled = checkbox ? checkbox.checked : true;
        const rows = rowsInput ? Math.min(parseInt(rowsInput.value) || 5, 20) : 5;
        configTables[tname] = {
            enabled: enabled || required.has(tname),
            rows: rows
        };
    });

    const config = {
        maxRows: 5,
        tables: configTables
    };

    quickBtn.disabled = true;
    quickBtn.innerHTML = 'Generando...';

    try {
        const userId = sessionStorage.getItem('ds_user') || '';
        const userEmail = sessionStorage.getItem('ds_email') || '';
        const response = await fetch('/generate-data', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': userId,
                'x-user-email': userEmail
            },
            body: JSON.stringify({ schema, config })
        });

        const result = await response.json();

        if (response.ok && result.sqlScript) {
            lastGeneratedScript = result.sqlScript;
            codeEl.textContent = result.sqlScript;
            preview.style.display = 'block';
            downloadBtn.disabled = false;

            // Scroll al preview
            preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            showError(result.error || 'No se pudo generar el script de datos de prueba.');
        }
    } catch (error) {
        showError('Error de conexión: ' + error.message);
    } finally {
        quickBtn.disabled = false;
        quickBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Generar INSERTs de Prueba
        `;
    }
}

function downloadTestData() {
    if (!lastGeneratedScript) {
        showError('No hay datos generados para descargar.');
        return;
    }
    const extension = lastGeneratedDialect === 'json' ? 'js' : 'sql';
    const blob = new Blob([lastGeneratedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datos_prueba_${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// PREMIUM PAYWALL SYSTEM INTERACTION
function initPaywallUI() {
    const role = sessionStorage.getItem('ds_role') || 'usuario';
    
    // Inject custom premium styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .premium-paywall-card {
            background: linear-gradient(135deg, rgba(30, 35, 55, 0.7), rgba(15, 18, 30, 0.9));
            border: 1px solid rgba(123, 136, 255, 0.3);
            border-radius: 16px;
            padding: 24px;
            margin-top: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(94, 106, 210, 0.15);
            animation: fadeIn 0.5s ease;
        }
        .premium-paywall-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(94, 106, 210, 0.1) 0%, transparent 60%);
            pointer-events: none;
        }
        .premium-card-info {
            flex: 1;
            z-index: 1;
        }
        .premium-card-info h3 {
            font-size: 1.4rem;
            color: #fff;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .premium-card-info p {
            color: var(--text-muted);
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .premium-badge {
            background: linear-gradient(90deg, #ff6b6b, #9d4edd);
            color: #fff;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.4);
        }
        .premium-badge-glowing {
            background: linear-gradient(90deg, #ff6b6b, #9d4edd);
            color: #fff;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.4);
        }
        .premium-card-action {
            z-index: 1;
        }
        .premium-upgrade-btn {
            background: linear-gradient(135deg, #7b88ff, #9d4edd);
            color: #fff;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: 600;
            font-family: var(--font-family);
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(157, 78, 221, 0.4);
            white-space: nowrap;
        }
        .premium-upgrade-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(157, 78, 221, 0.6);
            background: linear-gradient(135deg, #8c97ff, #ae5efd);
        }
        
        /* Modal Upgrade Styles */
        .premium-modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(10, 12, 22, 0.85);
            backdrop-filter: blur(12px);
            z-index: 20000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }
        .premium-modal-backdrop.active {
            opacity: 1;
            pointer-events: auto;
        }
        .premium-modal {
            background: linear-gradient(135deg, rgba(25, 29, 48, 0.95), rgba(15, 17, 30, 0.98));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            width: 90%;
            max-width: 550px;
            padding: 40px;
            position: relative;
            transform: translateY(30px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(94, 106, 210, 0.25);
        }
        .premium-modal-backdrop.active .premium-modal {
            transform: translateY(0);
        }
        .premium-modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.05);
            border: none;
            color: var(--text-muted);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.2s;
        }
        .premium-modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        .premium-modal-header {
            text-align: center;
            margin-bottom: 28px;
        }
        .premium-modal-icon {
            font-size: 3rem;
            margin-bottom: 12px;
            animation: pulseGlow 2s infinite alternate;
        }
        .premium-modal-title {
            font-size: 1.8rem;
            font-weight: 700;
            background: linear-gradient(90deg, #ff6b6b, #ae5efd, #7b88ff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            margin-bottom: 8px;
        }
        .premium-modal-subtitle {
            color: var(--text-muted);
            font-size: 0.95rem;
        }
        .premium-feature-list {
            margin-bottom: 32px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .premium-feature-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        .premium-feature-check {
            color: #4caf50;
            font-size: 1.2rem;
            line-height: 1;
            margin-top: 2px;
        }
        .premium-feature-text h4 {
            color: #fff;
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 2px;
        }
        .premium-feature-text p {
            color: var(--text-muted);
            font-size: 0.85rem;
            line-height: 1.4;
        }
        .premium-modal-footer {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
        }
        .premium-modal-cta {
            width: 100%;
            background: linear-gradient(135deg, #7b88ff, #9d4edd);
            color: #fff;
            border: none;
            padding: 16px;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            font-family: var(--font-family);
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(157, 78, 221, 0.4);
        }
        .premium-modal-cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 25px rgba(157, 78, 221, 0.6);
            background: linear-gradient(135deg, #8c97ff, #ae5efd);
        }
        .premium-demo-badge {
            font-size: 0.8rem;
            color: #ffcc80;
            background: rgba(255, 167, 38, 0.1);
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px dashed rgba(255, 167, 38, 0.3);
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 10px;
            text-align: center;
            width: 100%;
        }
        .premium-demo-badge:hover {
            background: rgba(255, 167, 38, 0.2);
            color: #fff;
        }
        
        @keyframes pulseGlow {
            0% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(255, 107, 107, 0.5)); }
            100% { transform: scale(1.1); filter: drop-shadow(0 0 20px rgba(157, 78, 221, 0.8)); }
        }
    `;
    document.head.appendChild(style);

    // If role is usuario, show a beautiful upgrade banner inside the upload section
    if (role === 'usuario') {
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            const paywallCard = document.createElement('div');
            paywallCard.className = 'premium-paywall-card';
            paywallCard.innerHTML = `
                <div class="premium-card-info">
                    <h3>
                        ⚡ ¡Pásate a Premium! 
                        <span class="premium-badge">IA + Conversión</span>
                    </h3>
                    <p>Desbloquea el análisis experto cognitivo basado en IA (OpenAI), explicaciones detalladas y sugerencias inteligentes de índices, además de conversiones de esquema a MongoDB, Prisma y GraphQL.</p>
                </div>
                <div class="premium-card-action">
                    <button class="premium-upgrade-btn" onclick="showPremiumUpgradeModal()">Saber Más</button>
                </div>
            `;
            // Insert it at the end of uploadSection
            uploadSection.appendChild(paywallCard);
        }
        
        // Also modify the analyzeBtn initially
        if (analyzeBtn) {
            analyzeBtn.innerHTML = '<span class="btn-icon">🔒</span><span class="btn-text">Análisis con IA (Premium)</span>';
            analyzeBtn.style.background = 'linear-gradient(135deg, #444, #555)';
        }
    }
}

function showPremiumUpgradeModal() {
    // Check if modal backdrop already exists
    let modalBackdrop = document.querySelector('.premium-modal-backdrop');
    if (!modalBackdrop) {
        modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'premium-modal-backdrop';
        modalBackdrop.innerHTML = `
            <div class="premium-modal">
                <button class="premium-modal-close" onclick="closePremiumUpgradeModal()">&times;</button>
                <div class="premium-modal-header">
                    <div class="premium-modal-icon">⚡</div>
                    <h2 class="premium-modal-title">DataScript AI Premium</h2>
                    <p class="premium-modal-subtitle">Lleva la auditoría y diseño de base de datos al siguiente nivel</p>
                </div>
                <div class="premium-feature-list">
                    <div class="premium-feature-item">
                        <div class="premium-feature-check">✦</div>
                        <div class="premium-feature-text">
                            <h4>Análisis de Negocio Avanzado con IA</h4>
                            <p>Procesamiento semántico para extraer descripciones precisas, diagramas estructurados y optimizaciones heurísticas recomendadas.</p>
                        </div>
                    </div>
                    <div class="premium-feature-item">
                        <div class="premium-feature-check">✦</div>
                        <div class="premium-feature-text">
                            <h4>Conversión con Inteligencia Artificial</h4>
                            <p>Transforma esquemas SQL a Prisma, MongoDB Mongoose, GraphQL y esquemas JSON validados con un solo clic.</p>
                        </div>
                    </div>
                    <div class="premium-feature-item">
                        <div class="premium-feature-check">✦</div>
                        <div class="premium-feature-text">
                            <h4>Generación de Datos de Prueba Inteligentes</h4>
                            <p>Genera instantáneamente scripts SQL con datos aleatorios coherentes y realistas que coinciden exactamente con la estructura analizada.</p>
                        </div>
                    </div>
                </div>
                <div class="premium-modal-footer">
                    <button class="premium-modal-cta" onclick="triggerUpgradeSimulation()">Activar Premium</button>
                    <div class="premium-demo-badge" onclick="demoInstantUpgrade()">
                        ✨ [MODO DEMO] Convertirse en Premium al instante (Cambiar Rol gratis)
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalBackdrop);
        
        // Trigger reflow then add active class
        setTimeout(() => modalBackdrop.classList.add('active'), 10);
    } else {
        modalBackdrop.classList.add('active');
    }
}

function closePremiumUpgradeModal() {
    const modalBackdrop = document.querySelector('.premium-modal-backdrop');
    if (modalBackdrop) {
        modalBackdrop.classList.remove('active');
    }
}

function triggerUpgradeSimulation() {
    alert("¡Gracias por tu interés en DataScript AI Premium! En esta versión académica, por favor usa el botón de abajo [MODO DEMO] para simular la activación y cambiar tu rol en la base de datos.");
}

async function demoInstantUpgrade() {
    try {
        const userId = sessionStorage.getItem('ds_user');
        if (!userId) {
            alert("No se encontró sesión iniciada.");
            return;
        }
        
        // Hacer una llamada al backend para actualizar el rol en la base de datos a 'premium'
        const response = await fetch('/api/admin/users/' + userId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-id': userId // Se usa a sí mismo como bypass para esta demo interactiva
            },
            body: JSON.stringify({
                rol: 'premium'
            })
        });
        
        if (response.ok) {
            sessionStorage.setItem('ds_role', 'premium');
            alert("¡Felicidades! Tu cuenta ha sido actualizada a Premium (Bypass Demo). Recargaremos la página para aplicar los cambios.");
            window.location.reload();
        } else {
            // Si la llamada falla porque no somos admins, lo cambiamos en local storage y recargamos para simulación
            sessionStorage.setItem('ds_role', 'premium');
            alert("¡Felicidades! Rol Premium activado localmente en sesión. Recargaremos la página.");
            window.location.reload();
        }
    } catch (err) {
        sessionStorage.setItem('ds_role', 'premium');
        alert("¡Felicidades! Rol Premium activado localmente en sesión. Recargaremos la página.");
        window.location.reload();
    }
}
