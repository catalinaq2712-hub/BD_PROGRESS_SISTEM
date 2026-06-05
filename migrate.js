require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 1. Configurar conexiones
const oldUrl = process.env.OLD_SUPABASE_URL;
const oldServiceKey = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

const newUrl = process.env.SUPABASE_URL;
const newServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!oldUrl || !oldServiceKey) {
  console.error('ERROR: Faltan las variables de la base de datos antigua (OLD_SUPABASE_URL o OLD_SUPABASE_SERVICE_ROLE_KEY) en el archivo .env');
  process.exit(1);
}

if (!newUrl || !newServiceKey || newUrl === oldUrl) {
  console.error('ERROR: Configura las credenciales de la NUEVA base de datos en SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (y asegúrate de que sean distintas a las antiguas)');
  process.exit(1);
}

// Cliente para SOLO LEER de la DB antigua
const oldSupabase = createClient(oldUrl, oldServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Cliente para ESCRIBIR en la DB nueva
const newSupabase = createClient(newUrl, newServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function migrate() {
  console.log('Iniciando migración segura...');
  console.log('DB Origen (Vieja):', oldUrl);
  console.log('DB Destino (Nueva):', newUrl);
  console.log('-------------------------------------------');

  try {
    // 1. MIGRAR USUARIOS DE AUTENTICACIÓN
    console.log('1. Migrando usuarios de autenticación...');
    
    // Obtener usuarios de la DB antigua
    const { data: { users }, error: usersError } = await oldSupabase.auth.admin.listUsers({
      perPage: 1000
    });

    if (usersError) throw new Error('Error al leer usuarios de la DB antigua: ' + usersError.message);
    console.log(`Se encontraron ${users.length} usuarios en la DB antigua.`);

    for (const user of users) {
      console.log(`Migrando usuario: ${user.email} (${user.id})...`);
      
      // Crear el usuario en la nueva DB conservando exactamente el mismo ID y contraseña/metadatos
      const { error: createError } = await newSupabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        email_confirm: true,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        // Usamos una contraseña por defecto temporal o dejamos que la restauren, 
        // pero para conservar la capacidad de login directo es necesario volver a invitar o setear contraseña.
        password: 'TempPassword123!', // Puedes cambiar esto si es necesario o los usuarios pueden recuperarla.
      });

      if (createError) {
        if (createError.message.includes('already exists') || createError.message.includes('conflict')) {
          console.log(`  El usuario ${user.email} ya existe en la nueva DB. Saltando...`);
        } else {
          console.warn(`  Advertencia al crear usuario ${user.email}:`, createError.message);
        }
      } else {
        console.log(`  Usuario ${user.email} creado con éxito.`);
      }
    }

    // 2. MIGRAR TABLA: perfiles
    await migrateTable('perfiles');

    // 3. MIGRAR TABLA: documentos
    await migrateTable('documentos');

    // 4. MIGRAR TABLA: papelera
    await migrateTable('papelera');

    // 5. MIGRAR TABLA: compartidos
    await migrateTable('compartidos');

    // 6. MIGRAR TABLA: logs_actividad
    await migrateTable('logs_actividad');

    // 7. MIGRAR ARCHIVOS DE STORAGE (PDFs)
    await migrateStorage();

    console.log('-------------------------------------------');
    console.log('¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('Por seguridad, recuerda borrar las variables OLD_ de tu archivo .env cuando termines.');

  } catch (error) {
    console.error('ERROR DURANTE LA MIGRACIÓN:', error.message);
  }
}

async function migrateStorage() {
  console.log('\nIniciando migración de Storage (PDFs)...');
  const bucketName = 'documentos_pdf';

  // 1. Asegurar que el bucket exista en la nueva base de datos
  const { data: buckets, error: listBucketsError } = await newSupabase.storage.listBuckets();
  if (listBucketsError) {
    console.error('  Error al listar buckets en la nueva DB:', listBucketsError.message);
    return;
  }

  const bucketExists = buckets.some(b => b.name === bucketName);
  if (!bucketExists) {
    console.log(`  El bucket "${bucketName}" no existe en la nueva DB. Creándolo...`);
    const { error: createBucketError } = await newSupabase.storage.createBucket(bucketName, {
      public: true, // Lo hacemos público como en la DB anterior
      allowedMimeTypes: ['application/pdf'],
    });
    if (createBucketError) {
      console.error(`  Error al crear el bucket "${bucketName}":`, createBucketError.message);
      return;
    }
    console.log(`  Bucket "${bucketName}" creado con éxito.`);
  } else {
    console.log(`  El bucket "${bucketName}" ya existe en la nueva DB.`);
  }

  // 2. Función recursiva para copiar archivos desde carpetas
  async function copyFolderContents(folderPath = '') {
    const { data: items, error: listError } = await oldSupabase.storage
      .from(bucketName)
      .list(folderPath);

    if (listError) {
      console.error(`  Error al listar archivos en storage de la DB vieja para ruta "${folderPath}":`, listError.message);
      return;
    }

    for (const item of items) {
      const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;

      if (item.id === null) {
        // Es una carpeta (los directorios virtuales en Supabase listan metadata vacía / id: null)
        console.log(`  Explorando carpeta: ${fullPath}...`);
        await copyFolderContents(fullPath);
      } else {
        // Es un archivo
        console.log(`  Copiando archivo: ${fullPath}...`);
        
        // Descargar del viejo
        const { data: fileBlob, error: downloadError } = await oldSupabase.storage
          .from(bucketName)
          .download(fullPath);

        if (downloadError) {
          console.error(`    Error al descargar "${fullPath}":`, downloadError.message);
          continue;
        }

        // Subir al nuevo
        const { error: uploadError } = await newSupabase.storage
          .from(bucketName)
          .upload(fullPath, fileBlob, {
            upsert: true,
            contentType: 'application/pdf'
          });

        if (uploadError) {
          console.log(`    Error al subir "${fullPath}":`, uploadError.message);
        } else {
          console.log(`    ¡Archivo "${fullPath}" migrado con éxito!`);
        }
      }
    }
  }

  await copyFolderContents();
}


async function migrateTable(tableName) {
  console.log(`\nMigrando tabla: "${tableName}"...`);
  
  // LEER datos de la DB vieja
  const { data: rows, error: selectError } = await oldSupabase
    .from(tableName)
    .select('*');

  if (selectError) {
    console.error(`  Error al leer de "${tableName}":`, selectError.message);
    return;
  }

  console.log(`  Se leyeron ${rows.length} registros de la DB antigua.`);
  if (rows.length === 0) return;

  // ESCRIBIR datos en la DB nueva
  // Usamos upsert para evitar errores de duplicación si ya se ejecutó parcialmente
  const { error: insertError } = await newSupabase
    .from(tableName)
    .upsert(rows);

  if (insertError) {
    console.error(`  Error al escribir en "${tableName}":`, insertError.message);
  } else {
    console.log(`  ¡Se migraron ${rows.length} registros a la nueva DB con éxito!`);
  }
}

migrate();
