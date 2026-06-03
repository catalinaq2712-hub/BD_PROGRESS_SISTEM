require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');
const OpenAI = require('openai');
const xlsx = require('xlsx');
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Función para registrar logs de actividad en Supabase
async function registrarLog(usuarioId, usuarioEmail, accion, detalles, req) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        
        // Limpiar IP de notación IPv6 si es necesario
        const cleanIp = ip && ip.includes('::ffff:') ? ip.split('::ffff:')[1] : ip;

        const { error } = await supabase
            .from('logs_actividad')
            .insert([{
                usuario_id: usuarioId ? usuarioId : null,
                usuario_email: usuarioEmail ? usuarioEmail : null,
                accion: accion,
                detalles: detalles || {},
                ip_address: cleanIp
            }]);
            
        if (error) {
            console.error('Error registrando log de actividad:', error);
        }
    } catch (err) {
        console.error('Error catastrófico en registrarLog:', err);
    }
}

// Función auxiliar para validar estado y privilegios Premium del usuario
async function verificarUsuario(userId, res, requierePremium = false) {
    if (!userId) return true; // Permitir invitados por defecto
    
    try {
        const { data: perfil, error } = await supabase
            .from('perfiles')
            .select('rol, estado')
            .eq('id', userId)
            .single();
            
        if (error || !perfil) {
            return true; // Si no hay perfil, dejar pasar
        }
        
        if (perfil.estado === 'suspendido') {
            res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta al administrador para más información.' });
            return false;
        }
        
        if (requierePremium && perfil.rol === 'usuario') {
            res.status(403).json({ error: 'Esta característica está reservada exclusivamente para miembros Premium. ¡Adquiere tu suscripción para desbloquearla!' });
            return false;
        }
        
        return true;
    } catch (err) {
        console.error('Error en verificarUsuario:', err);
        return true;
    }
}

// Endpoint para recibir logs desde el cliente (como inicios de sesión)
app.post('/api/logs', async (req, res) => {
    try {
        const { usuarioId, usuarioEmail, accion, detalles } = req.body;
        await registrarLog(usuarioId, usuarioEmail, accion, detalles, req);
        res.json({ success: true });
    } catch (error) {
        console.error('Error en POST /api/logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para obtener logs globales (Solo admin)
app.get('/api/admin/logs', async (req, res) => {
    try {
        const adminId = req.headers['x-admin-id'];
        if (!adminId) {
            return res.status(401).json({ error: 'No autorizado. Se requiere x-admin-id' });
        }

        // Verificar que el rol sea admin
        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', adminId)
            .single();

        if (perfilError || !perfil || perfil.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
        }

        // Obtener logs
        const { data: logs, error: logsError } = await supabase
            .from('logs_actividad')
            .select('*')
            .order('created_at', { ascending: false });

        if (logsError) {
            throw logsError;
        }

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Error en GET /api/admin/logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para obtener métricas globales de administración (Solo admin)
app.get('/api/admin/metrics', async (req, res) => {
    try {
        const adminId = req.headers['x-admin-id'];
        if (!adminId) {
            return res.status(401).json({ error: 'No autorizado. Se requiere x-admin-id' });
        }

        // Verificar que el rol sea admin
        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', adminId)
            .single();

        if (perfilError || !perfil || perfil.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
        }

        // Consultar métricas
        // 1. Total usuarios
        const { count: totalUsuarios, error: errUsers } = await supabase
            .from('perfiles')
            .select('*', { count: 'exact', head: true });

        // 2. Total documentos
        const { count: totalDocumentos, error: errDocs } = await supabase
            .from('documentos')
            .select('*', { count: 'exact', head: true });

        // 3. Total compartidos
        const { count: totalCompartidos, error: errShares } = await supabase
            .from('compartidos')
            .select('*', { count: 'exact', head: true });

        // 4. Logs totales
        const { count: totalLogs, error: errLogs } = await supabase
            .from('logs_actividad')
            .select('*', { count: 'exact', head: true });

        if (errUsers || errDocs || errShares || errLogs) {
            throw new Error('Error al consultar estadísticas globales');
        }

        res.json({
            success: true,
            metrics: {
                totalUsuarios: totalUsuarios || 0,
                totalDocumentos: totalDocumentos || 0,
                totalCompartidos: totalCompartidos || 0,
                totalLogs: totalLogs || 0
            }
        });
    } catch (error) {
        console.error('Error en GET /api/admin/metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===================== CRUD DE USUARIOS (SOLO ADMIN) =====================

// Obtener lista completa de usuarios con cantidad de documentos guardados
app.get('/api/admin/users', async (req, res) => {
    try {
        const adminId = req.headers['x-admin-id'];
        if (!adminId) return res.status(401).json({ error: 'No autorizado' });

        const { data: adminP, error: adminErr } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', adminId)
            .single();

        if (adminErr || !adminP || adminP.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Obtener todos los perfiles
        const { data: perfiles, error: perfErr } = await supabase
            .from('perfiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (perfErr) throw perfErr;

        // Obtener todos los usuarios de Auth para emparejar sus correos electrónicos
        const emailMap = {};
        try {
            const { data: authData, error: authUsersErr } = await supabase.auth.admin.listUsers();
            if (!authUsersErr && authData && authData.users) {
                authData.users.forEach(u => {
                    emailMap[u.id] = u.email;
                });
            }
        } catch (authErr) {
            console.error('Error al listar correos de Supabase Auth:', authErr);
        }

        // Obtener documentos para mapear el conteo
        const { data: docs, error: docsErr } = await supabase
            .from('documentos')
            .select('usuario_id');

        if (docsErr) throw docsErr;

        const docsCount = {};
        docs.forEach(d => {
            docsCount[d.usuario_id] = (docsCount[d.usuario_id] || 0) + 1;
        });

        const users = perfiles.map(p => ({
            ...p,
            email: emailMap[p.id] || 'Sin correo',
            documentosCount: docsCount[p.id] || 0
        }));

        res.json({ success: true, users });
    } catch (err) {
        console.error('Error en GET /api/admin/users:', err);
        res.status(500).json({ error: err.message });
    }
});

// Crear usuario instantáneamente sin confirmación de email
app.post('/api/admin/users', async (req, res) => {
    try {
        const adminId = req.headers['x-admin-id'];
        if (!adminId) return res.status(401).json({ error: 'No autorizado' });

        const { data: adminP, error: adminErr } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', adminId)
            .single();

        if (adminErr || !adminP || adminP.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const { nombres, apellidos, email, password, rol, tipo_uso, foto_url } = req.body;

        // Crear en Auth usando la API del Administrador (bypassea RLS y confirmaciones)
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nombres, apellidos, tipo_uso, rol, foto_url }
        });

        if (authErr) throw authErr;

        // Forzar inserción relacional en perfiles
        const { error: perfErr } = await supabase
            .from('perfiles')
            .upsert([{
                id: authUser.user.id,
                nombres,
                apellidos,
                tipo_uso: tipo_uso || 'Personal',
                rol: rol || 'usuario',
                estado: 'activo',
                foto_url: foto_url || null
            }]);

        if (perfErr) throw perfErr;

        res.json({ success: true, user: authUser.user });
    } catch (err) {
        console.error('Error en POST /api/admin/users:', err);
        res.status(500).json({ error: err.message });
    }
});

// Actualizar usuario
app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const adminId = req.headers['x-admin-id'];
        if (!adminId) return res.status(401).json({ error: 'No autorizado' });

        const { data: adminP, error: adminErr } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', adminId)
            .single();

        if (adminErr || !adminP || adminP.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const userId = req.params.id;
        const { nombres, apellidos, email, password, rol, tipo_uso, estado, foto_url } = req.body;

        // Actualizar perfiles
        const { error: perfErr } = await supabase
            .from('perfiles')
            .update({ nombres, apellidos, rol, tipo_uso, estado, foto_url })
            .eq('id', userId);

        if (perfErr) throw perfErr;

        // Sincronizar en Auth
        const updateData = {
            user_metadata: { nombres, apellidos, tipo_uso, rol, foto_url }
        };
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        const { error: authErr } = await supabase.auth.admin.updateUserById(userId, updateData);
        if (authErr) {
            console.warn('Advertencia al actualizar Auth:', authErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error en PUT /api/admin/users/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// Eliminar usuario
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const adminId = req.headers['x-admin-id'];
        if (!adminId) return res.status(401).json({ error: 'No autorizado' });

        const { data: adminP, error: adminErr } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', adminId)
            .single();

        if (adminErr || !adminP || adminP.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const userId = req.params.id;

        // Eliminar de Auth
        const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
        if (authErr) throw authErr;

        // Asegurar borrado en perfiles
        await supabase.from('perfiles').delete().eq('id', userId);

        res.json({ success: true });
    } catch (err) {
        console.error('Error en DELETE /api/admin/users/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// Servir jsPDF desde node_modules
app.get('/jspdf.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/jspdf/dist/jspdf.umd.min.js'));
});

// Configuración de Multer para subir archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, os.tmpdir());
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: function (req, file, cb) {
        const allowedExtensions = ['.sql', '.json', '.txt', '.dbml', '.prisma', '.graphql', '.csv', '.js', '.ts', '.yaml', '.yml', '.xlsx'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo se permiten: .sql, .json, .txt, .dbml, .prisma, .graphql, .csv, .js, .ts, .yaml, .xlsx'));
        }
    }
});

// Detectar dialecto SQL del contenido
function detectSQLDialect(content) {
    const c = content.toLowerCase();
    if (c.includes('identity(') || c.includes('nvarchar') || c.includes('datetime2') || c.includes('uniqueidentifier') || c.includes('smalldatetime') || c.includes('sql_variant')) return 'sqlserver';
    if (c.includes('autoincrement') || c.includes('integer primary key')) return 'sqlite';
    if (c.includes('serial') || c.includes('bigserial') || c.includes('jsonb') || c.includes('bytea') || c.includes('tsvector')) return 'postgres';
    if (c.includes('auto_increment') || c.includes('engine=') || c.includes('charset=')) return 'mysql';
    return 'mysql';
}

// Parser de archivos SQL mejorado
function parseSQL(content) {
    const tables = [];
    const relations = [];

    // 1. Detectar CREATE TABLE
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(([\s\S]*?)\)(?:\s*;|(?=\s*CREATE)|(?=\s*ALTER)|$)/gi;
    let match;

    while ((match = createTableRegex.exec(content)) !== null) {
        const tableName = match[1];
        const tableContent = match[2];

        const columns = [];
        const foreignKeys = [];

        // Dividir el contenido de la tabla por comas, pero ignorando comas dentro de paréntesis (ej: DECIMAL(10,2))
        const parts = [];
        let currentPart = '';
        let parenDepth = 0;

        for (let i = 0; i < tableContent.length; i++) {
            const char = tableContent[i];
            if (char === '(') parenDepth++;
            if (char === ')') parenDepth--;
            if (char === ',' && parenDepth === 0) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        if (currentPart.trim()) parts.push(currentPart.trim());

        for (const line of parts) {
            const upperLine = line.toUpperCase();

            // Ignorar PRIMARY KEY al final de la lista si es redundante
            if (upperLine.startsWith('PRIMARY KEY') && line.includes('(')) continue;
            if (upperLine.startsWith('KEY') || upperLine.startsWith('INDEX') || upperLine.startsWith('UNIQUE')) continue;
            if (upperLine.startsWith('CONSTRAINT')) {
                // Manejar CONSTRAINT ... FOREIGN KEY
                if (upperLine.includes('FOREIGN KEY')) {
                    const fkMatch = line.match(/FOREIGN\s+KEY\s*\((?:`|")?(\w+)(?:`|")?\)\s*REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)/i);
                    if (fkMatch) {
                        const fk = { column: fkMatch[1], referencesTable: fkMatch[2], referencesColumn: fkMatch[3] };
                        foreignKeys.push(fk);
                        relations.push({ from: tableName, to: fk.referencesTable, type: 'foreign_key', column: fk.column, referencesColumn: fk.referencesColumn });
                    }
                }
                continue;
            }

            if (upperLine.startsWith('FOREIGN KEY')) {
                const fkMatch = line.match(/FOREIGN\s+KEY\s*\((?:`|")?(\w+)(?:`|")?\)\s*REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)/i);
                if (fkMatch) {
                    const fk = { column: fkMatch[1], referencesTable: fkMatch[2], referencesColumn: fkMatch[3] };
                    foreignKeys.push(fk);
                    relations.push({ from: tableName, to: fk.referencesTable, type: 'foreign_key', column: fk.column, referencesColumn: fk.referencesColumn });
                }
                continue;
            }

            // Detectar relación en la misma línea de la columna (inline)
            // Ejemplo: user_id INT REFERENCES users(id)
            const inlineFkMatch = line.match(/^(?:`|")?(\w+)(?:`|")?\s+[\w()]+\s+.*?REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)/i);
            if (inlineFkMatch) {
                const fk = { column: inlineFkMatch[1], referencesTable: inlineFkMatch[2], referencesColumn: inlineFkMatch[3] };
                foreignKeys.push(fk);
                relations.push({ from: tableName, to: fk.referencesTable, type: 'foreign_key', column: fk.column, referencesColumn: fk.referencesColumn });
            }

            // Parsear definición de columna
            const columnMatch = line.match(/^(?:`|")?(\w+)(?:`|")?\s+([A-Za-z]+(?:\([\d,]+\))?)(.*)$/);
            if (columnMatch) {
                const columnName = columnMatch[1];
                const columnType = columnMatch[2];
                const constraints = columnMatch[3] || '';

                columns.push({
                    name: columnName,
                    type: columnType,
                    nullable: !constraints.toUpperCase().includes('NOT NULL'),
                    primaryKey: constraints.toUpperCase().includes('PRIMARY KEY'),
                    autoIncrement: constraints.toUpperCase().includes('AUTO_INCREMENT') || constraints.toUpperCase().includes('IDENTITY')
                });
            }
        }

        tables.push({
            name: tableName,
            columns: columns,
            foreignKeys: foreignKeys
        });
    }

    // 2. Detectar ALTER TABLE para llaves foráneas
    const alterTableRegex = /ALTER\s+TABLE\s+(?:`|")?(\w+)(?:`|")?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\((?:`|")?(\w+)(?:`|")?\)\s*REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)/gi;
    let alterMatch;
    while ((alterMatch = alterTableRegex.exec(content)) !== null) {
        const tableName = alterMatch[1];
        const colName = alterMatch[2];
        const refTable = alterMatch[3];
        const refCol = alterMatch[4];

        relations.push({
            from: tableName,
            to: refTable,
            type: 'foreign_key',
            column: colName,
            referencesColumn: refCol
        });

        // Agregar a la tabla correspondiente si existe
        const table = tables.find(t => t.name === tableName);
        if (table) {
            table.foreignKeys.push({
                column: colName,
                referencesTable: refTable,
                referencesColumn: refCol
            });
        }
    }

    // Extraer vistas, triggers y procedimientos
    const views = [];
    const triggers = [];
    const procedures = [];

    const viewRegex = /CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s+AS/gi;
    let viewMatch;
    while ((viewMatch = viewRegex.exec(content)) !== null) {
        views.push({ name: viewMatch[1] });
    }

    const triggerRegex = /CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+(?:`|")?(\w+)(?:`|")?/gi;
    let triggerMatch;
    while ((triggerMatch = triggerRegex.exec(content)) !== null) {
        triggers.push({
            name: triggerMatch[1],
            action: triggerMatch[2].toUpperCase(),
            event: triggerMatch[3].toUpperCase(),
            table: triggerMatch[4]
        });
    }

    const procRegex = /CREATE\s+PROCEDURE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(([\s\S]*?)\)/gi;
    let procMatch;
    while ((procMatch = procRegex.exec(content)) !== null) {
        procedures.push({
            name: procMatch[1],
            parameters: procMatch[2].replace(/\s+/g, ' ').trim()
        });
    }

    return { tables, relations, views, triggers, procedures, dialect: detectSQLDialect(content), type: 'sql' };
}

// Parser de archivos JSON (esquemas)
function parseJSON(content) {
    try {
        const data = JSON.parse(content);
        const tables = [];
        const relations = [];

        if (Array.isArray(data)) {
            // Si es un array de tablas
            data.forEach((table, index) => {
                const columns = table.columns || table.fields;
                if (typeof table === 'object' && table.name && columns) {
                    tables.push({
                        name: table.name,
                        columns: columns.map(col => ({
                            name: col.name || col.column,
                            type: col.type || 'string',
                            nullable: col.nullable !== false,
                            primaryKey: col.primaryKey || false,
                            autoIncrement: col.autoIncrement || false
                        }))
                    });
                }
            });
        } else if (typeof data === 'object') {
            const tablesArray = data.tables || data.collections;
            if (Array.isArray(tablesArray)) {
                tablesArray.forEach(table => {
                    const columns = table.columns || table.fields;
                    if (table.name && columns) {
                        tables.push({
                            name: table.name,
                            columns: columns.map(col => ({
                                name: col.name || col.column,
                                type: col.type || 'string',
                                nullable: col.nullable !== false,
                                primaryKey: col.primaryKey || false,
                                autoIncrement: col.autoIncrement || false
                            }))
                        });
                    }
                });
            } else {
                // Si es un objeto con tablas
                const hasExplicitColumns = Object.keys(data).some(tableName => {
                    const tableData = data[tableName];
                    return typeof tableData === 'object' && tableData !== null && (tableData.columns || tableData.fields);
                });

                if (hasExplicitColumns) {
                    Object.keys(data).forEach(tableName => {
                        const tableData = data[tableName];
                        const columns = tableData && (tableData.columns || tableData.fields);
                        if (typeof tableData === 'object' && columns) {
                            tables.push({
                                name: tableName,
                                columns: columns.map(col => ({
                                    name: col.name || col.column,
                                    type: col.type || 'string',
                                    nullable: col.nullable !== false,
                                    primaryKey: col.primaryKey || false,
                                    autoIncrement: col.autoIncrement || false
                                }))
                            });
                        }
                    });
                } else {
                    // Si es un objeto donde cada clave es una colección/tabla directa (ej. usuarios: [...])
                    Object.keys(data).forEach(tableName => {
                        if (tableName === 'relations') return;
                        const tableData = data[tableName];
                        if (Array.isArray(tableData)) {
                            // Extraer columnas de los objetos del array
                            const columnsMap = {};
                            tableData.forEach(row => {
                                if (typeof row === 'object' && row !== null) {
                                    Object.keys(row).forEach(colName => {
                                        if (!columnsMap[colName]) {
                                            const val = row[colName];
                                            let inferredType = 'string';
                                            if (typeof val === 'number') inferredType = Number.isInteger(val) ? 'integer' : 'float';
                                            else if (typeof val === 'boolean') inferredType = 'boolean';
                                            else if (typeof val === 'object' && val !== null) inferredType = 'json';
                                            
                                            columnsMap[colName] = {
                                                name: colName,
                                                type: inferredType,
                                                nullable: true,
                                                primaryKey: colName.toLowerCase() === 'id' || colName.toLowerCase() === '_id',
                                                autoIncrement: false
                                            };
                                        }
                                    });
                                }
                            });

                            const columns = Object.values(columnsMap);
                            if (columns.length > 0) {
                                tables.push({
                                    name: tableName,
                                    columns: columns
                                });
                            }
                        }
                    });
                }
            }
            if (Array.isArray(data.relations)) {
                relations.push(...data.relations);
            }
        }

        return { tables, relations, type: 'json' };
    } catch (error) {
        throw new Error('JSON inválido o no contiene estructura de base de datos válida');
    }
}

// Parser de archivos XLSX
function parseXLSX(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const tables = [];
        const relations = [];

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (data.length > 0) {
                const headers = data[0];
                tables.push({
                    name: sheetName,
                    columns: headers.map(header => ({
                        name: header || 'ColumnaSinNombre',
                        type: 'string', // Inferencia simple
                        nullable: true,
                        primaryKey: false,
                        autoIncrement: false
                    })),
                    foreignKeys: []
                });
            }
        });

        return { tables, relations, type: 'excel' };
    } catch (error) {
        throw new Error('Error al leer el archivo Excel: ' + error.message);
    }
}

// Validar si el contenido es relacionado a bases de datos
function validateDatabaseContent(content, fileExtension) {
    const contentLower = content.toLowerCase();

    if (fileExtension === '.sql') {
        return contentLower.includes('create table') ||
            contentLower.includes('insert into') ||
            contentLower.includes('select') ||
            contentLower.includes('alter table') ||
            contentLower.includes('drop table');
    }

    if (fileExtension === '.json') {
        try {
            const parsed = JSON.parse(content);
            return parsed.hasOwnProperty('tables') ||
                parsed.hasOwnProperty('collections') ||
                Array.isArray(parsed) ||
                (typeof parsed === 'object' && Object.keys(parsed).some(key => {
                    const val = parsed[key];
                    return (typeof val === 'object' && val !== null && (val.hasOwnProperty('columns') || val.hasOwnProperty('fields'))) ||
                           (Array.isArray(val) && (val.length === 0 || typeof val[0] === 'object'));
                }));
        } catch {
            return false;
        }
    }

    if (fileExtension === '.txt') {
        return contentLower.includes('create table') ||
            contentLower.includes('insert into') ||
            contentLower.includes('select');
    }

    if (['.prisma', '.graphql', '.js', '.ts', '.yaml', '.yml', '.csv', '.xlsx'].includes(fileExtension)) {
        // Para estos formatos nuevos, permitimos el paso si tienen algo de contenido
        return true; 
    }
    
    return false;
}

// Generar documentación con OpenAI
async function generateDocumentation(schema, dbType) {
    try {
        // Verificar que la API Key esté configurada
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'tu_clave_de_openai_aqui') {
            throw new Error('API Key de OpenAI no configurada correctamente en el archivo .env');
        }

        // Validar que haya estructuras antes de enviar a OpenAI
        if (!schema.tables || schema.tables.length === 0) {
            throw new Error('No se encontraron estructuras válidas en el archivo para analizar.');
        }
        
        const prompt = `
Actúa como un Arquitecto Senior de Base de Datos y Auditor Financiero. Tu tono debe ser CRÍTICO, ANALÍTICO y AUDITOR. No adornes la realidad; si algo está mal diseñado o es contablemente incorrecto, dilo claramente.

Tu tarea es realizar una DOCUMENTACIÓN TÉCNICA del siguiente esquema detectado como tipo: ${dbType === 'sql' ? 'RELACIONAL (SQL)' : 'NO RELACIONAL (NoSQL/JSON)'}.

ESQUEMA PARA AUDITAR:
${JSON.stringify(schema, null, 2)}

REGLAS DE FORMATO Y ESTILO (IMPORTANTE):
- Usa lenguaje Markdown. 
- Los títulos principales de cada sección (ANÁLISIS GENERAL, DICCIONARIO DE DATOS, etc.) deben ser **h2** (## ).
- Los nombres de las tablas dentro del diccionario deben ser **h3** (### ) y en negrita.
- No uses colores HTML/CSS en el Markdown; solo aplica la estructura de títulos.
- La barra de progreso visual debe mostrarse como texto al inicio de la sección "ANÁLISIS GENERAL", por ejemplo: [████████░░] 80%
- Respetas exactamente las secciones obligatorias que se indican abajo.

REGLAS CRÍTICAS DE CONTENIDO:
- NO cambiar títulos, orden, formato ni nombres de secciones.
- NO omitir secciones.
- NO agregar secciones nuevas.
- ESTRUCTURA OBLIGATORIA DE TU RESPUESTA (Usa Markdown):

## 1. ANÁLISIS GENERAL
   - Muestra una barra de progreso visual al inicio según el nivel de cumplimiento (normalización, integridad, tipos de datos): Ej: [████████░░] 80%
   - Métricas: Indica de forma limpia los porcentajes de integridad, normalización y consistencia de tipos en guiones.
        - Integridad: XX%
        - Normalización: XX%
        - Tipos de datos: XX%
    - Reglas:
        - Si es 100%, di: "TODO ESTÁ CORRECTO, pero puedo sugerir mejoras opcionales".
        - Si es <100%, explica QUÉ fallas encontraste y CÓMO corregirlas de forma técnica.

## 2. DICCIONARIO DE DATOS

REGLAS OBLIGATORIAS:
- Cada tabla DEBE usar formato de tabla Markdown.
- NO usar listas, NO usar texto libre para describir campos.
- Dejar UNA línea en blanco entre cada tabla.

Estructura exacta por tabla:

### **NombreTabla**
Descripción: [Explicación clara de la finalidad de la tabla en el contexto del negocio o sistema. Qué entidad representa y su rol.]

| Campo | Tipo de dato | Descripción | Observaciones |
|-------|--------------|-------------|----------------|
| [nombre] | [tipo] | [Explicación del propósito del campo. Para qué se usa, qué almacena. Si es una clave foránea, mencionar a qué tabla referencia. Si es un campo de auditoría, indicar su función (fecha de creación, modificación, etc.)] | [Aquí debes incluir al menos 3 elementos de la siguiente lista, separados por comas: PK, FK (referencia a tabla.columna), NOT NULL, NULL permitido, UNIQUE, AUTO_INCREMENT, DEFAULT (valor), INDEX, longitud recomendada, validaciones, criticidad para auditoría, recomendación de tipo alternativo si aplica, advertencia de rendimiento, etc. Además, si el campo tiene lógica contable o financiera (montos, tasas, fechas críticas), evalúa su diseño y sugiere mejoras.] |

Ejemplo de tabla bien documentada:

### **usuarios**
Descripción: Almacena los datos de los usuarios registrados en el sistema. Es la entidad central para autenticación y trazabilidad de acciones.

| Campo | Tipo de dato | Descripción | Observaciones |
|-------|--------------|-------------|----------------|
| id | INT UNSIGNED | Identificador único del usuario. | PK, AUTO_INCREMENT, NOT NULL, índice clúster. |
| email | VARCHAR(100) | Correo electrónico del usuario, utilizado como nombre de usuario para login. | UNIQUE, NOT NULL, INDEX para búsquedas rápidas. Validar formato antes de insertar. |
| fecha_registro | DATETIME | Momento en que el usuario se registró en el sistema. | NOT NULL, DEFAULT CURRENT_TIMESTAMP, crítico para auditoría de creación de cuentas. |
| saldo | DECIMAL(12,2) | Saldo actual disponible del usuario en la moneda base. | NOT NULL, DEFAULT 0.00. Usar DECIMAL en lugar de FLOAT para evitar errores de redondeo en valores monetarios. Índice no necesario. |

INSTRUCCIONES ADICIONALES PARA LA IA:
- No inventes campos ni tablas que no estén en el esquema.
- Si el diseño original usa un tipo de dato inapropiado (ej. FLOAT para dinero), indícalo en "Observaciones" con una sugerencia de corrección.
- Para campos que sean claves foráneas (FK), especifica explícitamente la tabla y columna de referencia.
- Evalúa si falta un índice crítico (por ejemplo, en campos de búsqueda frecuente) y recomiéndalo en "Observaciones".
- Si el campo es parte de una restricción de integridad (CHECK, UNIQUE compuesto), menciónalo.
- Mantén el lenguaje técnico pero claro. Usa siglas estándar (PK, FK, INDEX, etc.).
- Las "Observaciones" deben ser una lista o frase concisa pero informativa, no solo una palabra suelta.

## 3. ANÁLISIS DE VÍNCULOS Y RELACIONES
   - Crítica detallada sobre integridad referencial, llaves foráneas faltantes, relaciones huérfanas.
   - Evalúa si el diseño soporta ACID compliance y trazabilidad de auditoría.
   - Enumera cada comentario de forma clara y con ejemplos técnicos.

## 4. SUGERENCIAS DE OPTIMIZACIÓN
   - Brinda observaciones críticas (mínimo 5, máximo 15 según la complejidad).
   - Incluye estándares internacionales (ej: nombres en inglés como 'companies').
   - Señala redundancias y problemas de normalización.
   - Formato obligatorio para cada sugerencia:
        - [CRÍTICO]
        - [MEJORA]
        - [ESTÁNDAR]

## 5. CRÍTICA OBLIGATORIA
   - Señala errores graves. Sé directo y rudo (ej: "Uso de FLOAT para dinero", "Falta de Timestamps").
   - Evalúa si el diseño soporta auditorías financieras externas.

REGLAS ADICIONALES:
- No inventes campos.
- Si el diseño es mediocre, critícalo con dureza técnica, pero ofrece soluciones concretas.
- Idioma de salida: Español (excepto términos técnicos y sugerencias de nombres, que pueden ir en inglés).
- Formatos soportados: .sql, .json, .txt, .dbml, .csv, .xlsx.
`;
        
        console.log(`Enviando solicitud a OpenAI para esquema de tipo: ${dbType}...`);
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "user", 
                    content: prompt
                }
            ],
            temperature: 0.7,
        });

        const text = response.choices[0].message.content;
        
        if (!text || text.trim().length === 0) {
            throw new Error('La IA no generó contenido');
        }
        
        console.log(`Respuesta de OpenAI (${dbType}) recibida`);
        return text;
        
    } catch (error) {
        console.error('Error detallado al generar documentación con OpenAI:', error);
        
        if (error.status === 401) {
            throw new Error('API Key de OpenAI inválida. Por favor, verifica tu API Key en el archivo .env');
        } else if (error.status === 429) {
            throw new Error('Cuota de OpenAI excedida o demasiadas solicitudes. Intenta más tarde');
        } else {
            throw new Error(`Error al generar documentación: ${error.message}`);
        }
    }
}

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint de prueba para API Key de OpenAI
app.get('/test-openai', async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'tu_clave_de_openai_aqui') {
            return res.status(500).json({
                success: false,
                error: 'API Key de OpenAI no configurada'
            });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Hola, responde con 'API de OpenAI funcionando correctamente'" }],
        });

        res.json({
            success: true,
            message: 'API Key válida',
            response: response.choices[0].message.content
        });

    } catch (error) {
        console.error('Error en prueba de API:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para análisis con Python
app.post('/analyze-python', upload.single('file'), async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userEmail = req.headers['x-user-email'];
        if (!(await verificarUsuario(userId, res, false))) return;

        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        const filePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        
        // Compatibilidad con Vercel: Reenviar la petición a la función serverless de Python
        if (process.env.VERCEL) {
            const host = req.headers.host;
            const url = `https://${host}/api/analyze_python`;
            
            const fileBuffer = fs.readFileSync(filePath);
            const formData = new FormData();
            const blob = new Blob([fileBuffer]);
            formData.append('file', blob, req.file.originalname);
            
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            // Eliminar archivo temporal
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            if (result.success) {
                return res.json({
                    success: true,
                    schema: result.analysis.schema,
                    documentation: generatePythonDocumentation(result.analysis),
                    conversions: result.analysis.conversions,
                    diagram: result.analysis.diagram,
                    analysisType: 'python',
                    fileName: req.file.originalname
                });
            } else {
                return res.status(400).json({ error: result.error || 'Error en análisis serverless de Vercel' });
            }
        }
        
        // Ejecución local o servidores tradicionales (Render, etc)
        const { spawn } = require('child_process');
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        
        // Llamar al script Python
        const pythonProcess = spawn(pythonCmd, ['python_analyzer/main.py', '--file', filePath], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Eliminar archivo temporal
            fs.unlinkSync(filePath);

            if (code !== 0) {
                console.error('Python script error:', errorOutput);
                return res.status(500).json({
                    error: 'Error en el análisis Python: ' + errorOutput
                });
            }

            try {
                const result = JSON.parse(output);
                
                if (result.success) {
                    // Formatear resultados para compatibilidad con frontend
                    const formattedResult = {
                        success: true,
                        schema: result.analysis.schema,
                        documentation: generatePythonDocumentation(result.analysis),
                        conversions: result.analysis.conversions,
                        diagram: result.analysis.diagram,
                        analysisType: 'python',
                        fileName: req.file.originalname
                    };
                    
                    // Registrar log de éxito
                    registrarLog(userId, userEmail, 'upload_python', {
                        fileName: req.file.originalname,
                        fileSize: req.file.size,
                        fileType: fileExtension
                    }, req);
                    
                    res.json(formattedResult);
                } else {
                    res.status(400).json({
                        error: result.error || 'Error en el análisis Python'
                    });
                }
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                res.status(500).json({
                    error: 'Error al procesar resultados de Python'
                });
            }
        });

        pythonProcess.on('error', (error) => {
            // Eliminar archivo temporal
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            console.error('Python process error:', error);
            res.status(500).json({
                error: 'Error al ejecutar Python. Asegúrate de tener Python instalado.'
            });
        });

    } catch (error) {
        console.error('Error en el procesamiento Python:', error);

        // Eliminar archivo si existe
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: error.message || 'Error al procesar el archivo'
        });
    }
});

// Función para generar documentación básica con Python
function generatePythonDocumentation(analysis) {
    const schema = analysis.schema;
    const metrics = analysis.metrics || {};
    const anomalies = analysis.anomalies || [];
    const normScore = metrics.normalizationScore || 50;
    
    // Calcular el porcentaje para la barra de progreso
    const progressFill = Math.round(normScore / 10);
    const progressEmpty = 10 - progressFill;
    const bar = '[' + '█'.repeat(progressFill) + '░'.repeat(progressEmpty) + `] ${normScore}%`;

    let doc = `# Documentación Técnica de Base de Datos (Generada Localmente)\n\n`;

    // ----------------- SECCIÓN 1: ANÁLISIS GENERAL -----------------
    doc += `## 1. ANÁLISIS GENERAL\n\n`;
    doc += `${bar}\n\n`;
    
    // Opinión General generada en main.py
    if (analysis.opinion) {
        doc += `${analysis.opinion}\n\n`;
    }

    doc += `### Métricas Clave\n`;
    doc += `- **Integridad y Relaciones**: ${schema.relations ? schema.relations.length : 0} detectadas.\n`;
    doc += `- **Normalización**: ${normScore}%\n`;
    doc += `- **Tablas Totales**: ${metrics.totalTables || 0}\n`;
    doc += `- **Columnas Totales**: ${metrics.totalColumns || 0}\n\n`;

    // ----------------- SECCIÓN 2: DICCIONARIO DE DATOS -----------------
    doc += `## 2. DICCIONARIO DE DATOS\n\n`;
    schema.tables?.forEach(table => {
        doc += `### **${table.name}**\n`;
        doc += `Descripción: Entidad que almacena los registros correspondientes a ${table.name}. Cuenta con ${table.columns?.length || 0} columnas.\n\n`;
        doc += `| Campo | Tipo de dato | Descripción | Observaciones |\n`;
        doc += `|-------|--------------|-------------|----------------|\n`;
        
        table.columns?.forEach(column => {
            let obs = [];
            if (column.primaryKey) obs.push("PK");
            if (!column.nullable) obs.push("NOT NULL");
            if (column.autoIncrement) obs.push("AUTO_INCREMENT");
            
            // Detectar FK simple basándose en el nombre
            const fk = table.foreignKeys?.find(f => f.column === column.name);
            if (fk) obs.push(`FK -> ${fk.references?.table || fk.referencesTable}`);
            
            doc += `| ${column.name} | ${column.type} | Campo '${column.name}' de tipo ${column.type}. | ${obs.join(", ") || "-"} |\n`;
        });
        doc += `\n`;
    });

    // ----------------- SECCIÓN 3: ANÁLISIS DE VÍNCULOS Y RELACIONES -----------------
    doc += `## 3. ANÁLISIS DE VÍNCULOS Y RELACIONES\n\n`;
    if (schema.relations && schema.relations.length > 0) {
        doc += `Se han detectado las siguientes relaciones clave en el esquema:\n\n`;
        schema.relations.forEach(rel => {
            doc += `- **${rel.from}** se relaciona con **${rel.to}** mediante el campo \`${rel.column}\`.\n`;
        });
    } else {
        doc += `No se han detectado relaciones (Foreign Keys) explícitas en el esquema. Esto puede comprometer la integridad referencial si se trata de un modelo relacional.\n`;
    }
    doc += `\n`;

    // ----------------- SECCIÓN 4: SUGERENCIAS DE OPTIMIZACIÓN -----------------
    doc += `## 4. SUGERENCIAS DE OPTIMIZACIÓN\n\n`;
    const optimizationAnomalies = anomalies.filter(a => a.type === 'optimization' || a.severity === 'medium');
    
    if (optimizationAnomalies.length > 0) {
        optimizationAnomalies.forEach(anomaly => {
            doc += `- **[MEJORA]** En tabla **${anomaly.table}**: ${anomaly.message}\n`;
        });
    } else {
        doc += `- **[ESTÁNDAR]** El esquema cumple con estándares básicos. Se recomienda asegurar el uso de índices en campos de búsqueda frecuente.\n`;
        doc += `- **[MEJORA]** Revise que los nombres de tablas mantengan coherencia (singular vs plural).\n`;
    }
    doc += `\n`;

    // ----------------- SECCIÓN 5: CRÍTICA OBLIGATORIA -----------------
    doc += `## 5. CRÍTICA OBLIGATORIA\n\n`;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'high');
    
    if (criticalAnomalies.length > 0) {
        doc += `El esquema presenta errores estructurales graves que deben ser abordados:\n\n`;
        criticalAnomalies.forEach(anomaly => {
            doc += `- **[CRÍTICO]** **${anomaly.table}**: ${anomaly.message}\n`;
        });
    } else if (normScore < 70) {
        doc += `El diseño es funcional, pero el nivel de normalización (${normScore}%) es bajo. Esto puede llevar a redundancia de datos o problemas de actualización a futuro. Considere aplicar hasta la 3FN.\n`;
    } else {
        doc += `El diseño estructural es sólido. No se observan bloqueadores críticos. Sin embargo, en auditorías financieras se recomienda siempre asegurar que campos monetarios usen tipos exactos (ej. DECIMAL) y no aproximados (FLOAT).\n`;
    }
    doc += `\n`;

    // ----------------- SECCIÓN 6: COMPONENTES AVANZADOS (VISTAS, TRIGGERS Y PROCEDIMIENTOS) -----------------
    if ((schema.views && schema.views.length > 0) || (schema.triggers && schema.triggers.length > 0) || (schema.procedures && schema.procedures.length > 0)) {
        doc += `## 6. COMPONENTES AVANZADOS (VISTAS, TRIGGERS Y PROCEDIMIENTOS)\n\n`;
        
        if (schema.views && schema.views.length > 0) {
            doc += `### Vistas Detectadas\n`;
            schema.views.forEach(v => {
                doc += `- **${v.name}**: Vista virtual que simplifica el acceso a consultas complejas.\n`;
            });
            doc += `\n`;
        }
        
        if (schema.triggers && schema.triggers.length > 0) {
            doc += `### Triggers (Disparadores) Detectados\n`;
            schema.triggers.forEach(t => {
                doc += `- **${t.name}**: Se ejecuta **${t.action} ${t.event}** sobre la tabla \`${t.table}\` para automatizar lógica de negocio.\n`;
            });
            doc += `\n`;
        }
        
        if (schema.procedures && schema.procedures.length > 0) {
            doc += `### Procedimientos Almacenados Detectados\n`;
            schema.procedures.forEach(p => {
                doc += `- **${p.name}(${p.parameters || ''})**: Automatiza tareas repetitivas y consultas complejas en el servidor.\n`;
            });
            doc += `\n`;
        }
    }

    return doc;
}

// Endpoint para subir y analizar archivos
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userEmail = req.headers['x-user-email'];
        if (!(await verificarUsuario(userId, res, true))) return; // REQUIERE PREMIUM!

        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        const filePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        const content = fs.readFileSync(filePath, 'utf8');

        // Validar contenido
        if (!validateDatabaseContent(content, fileExtension)) {
            fs.unlinkSync(filePath); // Eliminar archivo inválido
            return res.status(400).json({
                error: 'El archivo no contiene contenido relacionado a bases de datos'
            });
        }

        // Parsear contenido según tipo de archivo
        let schema;
        if (fileExtension === '.sql' || fileExtension === '.txt' || fileExtension === '.dbml') {
            schema = parseSQL(content);
        } else if (fileExtension === '.json') {
            schema = parseJSON(content);
            schema.type = schema.type || 'json';
        } else if (fileExtension === '.xlsx') {
            schema = parseXLSX(filePath);
            schema.type = schema.type || 'excel';
        } else {
            fs.unlinkSync(filePath); // Eliminar archivo no soportado
            return res.status(400).json({
                error: 'Tipo de archivo no soportado para análisis'
            });
        }

        // Determinar tipo de DB para la IA de forma más precisa
        let dbType = 'sql';
        const nosqlKeywords = ['collections', 'fields', 'documents', 'mongodb', 'nosql', 'type object', 'type array'];
        const isJson = fileExtension === '.json';
        const hasNosqlKeywords = nosqlKeywords.some(k => content.toLowerCase().includes(k));
        
        if (isJson || hasNosqlKeywords) {
            dbType = 'nosql';
        }
        
        if (fileExtension === '.sql' || content.toLowerCase().includes('create table') || content.toLowerCase().includes('alter table')) {
            dbType = 'sql';
        }
        
        // Generar documentación con IA
        const documentation = await generateDocumentation(schema, dbType);

        // Eliminar archivo temporal
        fs.unlinkSync(filePath);

        // Registrar log de éxito
        registrarLog(userId, userEmail, 'upload_ai', {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: fileExtension
        }, req);

        res.json({
            success: true,
            schema: schema,
            documentation: documentation,
            analysisType: 'ai',
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('Error en el procesamiento:', error);

        // Eliminar archivo si existe
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: error.message || 'Error al procesar el archivo'
        });
    }
});

// Endpoint para generar datos de prueba
app.post('/generate-data', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userEmail = req.headers['x-user-email'];
        if (!(await verificarUsuario(userId, res, false))) return;

        const { schema, config } = req.body;
        
        if (!schema || !schema.tables) {
            return res.status(400).json({ error: 'Esquema con tablas es requerido' });
        }

        console.log('Generando datos de prueba...');

        // En Vercel, reenviar a función serverless si aplica
        if (process.env.VERCEL) {
            // Podría reutilizarse el mismo endpoint serverless con un flag; por ahora, fallback a Node simple
            return res.status(501).json({ error: 'Generación de datos no disponible en Vercel serverless aún.' });
        }

        const { spawn } = require('child_process');
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        
        const payload = JSON.stringify({ schema, config: config || {} });
        
        const pythonProcess = spawn(pythonCmd, ['python_analyzer/main.py', '--generate-data'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdin.write(payload);
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Python data generation error:', errorOutput);
                return res.status(500).json({
                    error: 'Error en la generación de datos: ' + errorOutput
                });
            }

            try {
                const result = JSON.parse(output);
                if (result.success) {
                    // Registrar log de éxito
                    registrarLog(userId, userEmail, 'generate_data', {
                        tables: schema.tables.map(t => t.name)
                    }, req);

                    res.json(result.data);
                } else {
                    res.status(400).json({ error: result.error || 'Error en generación de datos' });
                }
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                res.status(500).json({ error: 'Error al procesar resultados de generación de datos' });
            }
        });

        pythonProcess.on('error', (error) => {
            console.error('Python process error:', error);
            res.status(500).json({
                error: 'Error al ejecutar Python. Asegúrate de tener Python instalado.'
            });
        });

    } catch (error) {
        console.error('Error en generación de datos:', error);
        res.status(500).json({ error: error.message || 'Error al generar datos de prueba' });
    }
});

// Endpoint para conversión de esquemas
app.post('/convert', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userEmail = req.headers['x-user-email'];
        if (!(await verificarUsuario(userId, res, true))) return; // REQUIERE PREMIUM!

        const { schema, targetFormat } = req.body;
        
        if (!schema || !targetFormat) {
            return res.status(400).json({ error: 'Esquema y formato de destino son requeridos' });
        }

        console.log(`Convirtiendo esquema a: ${targetFormat}...`);

        const prompt = `
Actúa como un experto Arquitecto de Datos y Desarrollador Fullstack. 
Toma el siguiente esquema de base de datos:

${JSON.stringify(schema, null, 2)}

Tu tarea es CONVERTIR este esquema íntegramente al formato: ${targetFormat.toUpperCase()}.

INSTRUCCIONES:
1. Genera el código completo y válido para el formato solicitado.
2. Si es POSTGRESQL, usa sintaxis estándar de PostgreSQL:
   - Usa comillas dobles (") para identificadores o déjalos sin comillas. ¡NUNCA uses comillas invertidas (\`)!
   - Usa tipos de datos SERIAL, BIGSERIAL o GENERATED ALWAYS AS IDENTITY para campos auto-incrementables. ¡NUNCA uses AUTO_INCREMENT!
   - Incluye restricciones formales de llaves primarias y foráneas.
3. Si es MYSQL o MARIADB, usa sintaxis MySQL:
   - Usa comillas invertidas (\`) para identificadores.
   - Usa AUTO_INCREMENT para campos auto-incrementables.
   - Incluye llaves primarias y foráneas con la sintaxis ENGINE=InnoDB.
4. Si es MongoDB, usa formato de esquema de Mongoose o JSON Schema.
5. Si es GraphQL, usa el lenguaje de definición de tipos (SDL).
6. Si es Prisma, usa el formato de archivo schema.prisma.
7. Mantén los nombres de las entidades y campos lo más parecidos posible.
8. Agrega comentarios breves explicando decisiones de diseño.

Responde ÚNICAMENTE con el bloque de código del nuevo esquema. No incluyas explicaciones largas fuera del código.
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3, // Menor temperatura para mayor precisión técnica
        });

        // Registrar log de éxito
        registrarLog(userId, userEmail, 'convert', {
            targetFormat: targetFormat
        }, req);

        res.json({
            success: true,
            convertedCode: response.choices[0].message.content
        });

    } catch (error) {
        console.error('Error en la conversión:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manejo de errores de Multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 10MB' });
        }
    }

    if (error.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`API Key de OpenAI configurada: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'tu_clave_de_openai_aqui' ? 'Sí' : 'No'}`);
});

module.exports = app;
