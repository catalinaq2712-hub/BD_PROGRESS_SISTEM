# Documentador de Base de Datos

Este repositorio contiene un sistema híbrido para auditoría, documentación y análisis de estructuras de bases de datos.
El proyecto combina un servidor Node.js/Express con integración a Supabase, una interfaz web estática y un motor local en Python para el análisis técnico de esquemas.

## Resumen del proyecto

El sistema está diseñado para:
- registrar y autenticar usuarios con Supabase,
- administrar perfiles y roles,
- almacenar logs de actividades,
- gestionar datos y documentos compartidos,
- ofrecer análisis de bases de datos tanto con Python local como con capacidades opcionales de OpenAI,
- proporcionar herramientas de auditoría, visualización y conversión de esquemas.

## Funciones principales

1. Autenticación y gestión de usuarios
- Registro y login a través de Supabase Auth.
- Perfiles de usuario en la tabla `perfiles`.
- Control de roles y permisos.
- Campos de estado de cuenta: `activo` y `suspendido`.

2. Registro y auditoría de actividad
- Registro de eventos en `logs_actividad`.
- Endpoints de administración para consultar logs y métricas.
- Control de acceso administrativo mediante el header `x-admin-id`.

3. Administración de usuarios y métricas
- Creación, actualización y eliminación de usuarios desde la API administrativa.
- Consulta de métricas de uso: total de usuarios, documentos, compartidos y logs.
- Sincronización entre Supabase Auth y la tabla de perfiles.

4. Análisis de bases de datos
- Motor local en `python_analyzer/` para procesamiento técnico de esquemas.
- Soporte para análisis de estructuras SQL y NoSQL desde el servidor.
- Capacidad de generar diagramas y convertir esquemas a distintos formatos.

## Roles y permisos

El sistema define al menos dos roles principales:
- `admin`
- `usuario`

Además, el perfil de usuario incluye un estado que puede ser:
- `activo`
- `suspendido`

Un usuario con estado `suspendido` tiene acceso restringido y recibe un error 403 en las rutas protegidas.

## Cómo funciona el sistema

- El servidor `server.js` carga el frontend desde `public/` y expone las rutas API.
- `supabaseClient.js` establece la conexión con Supabase usando las variables de entorno `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- El frontend en `public/js/` maneja el login, registro, sesión y llamadas a la API.
- Tras el inicio de sesión, el cliente guarda en `sessionStorage` datos de usuario, correo y rol.
- El sistema registra eventos relevantes como inicios de sesión y acciones de usuario mediante `/api/logs`.
- Las operaciones de administración solo permiten acceso a usuarios con rol `admin`.
- El análisis local de esquemas se realiza desde `python_analyzer/` y es opcional, mientras que la integración con OpenAI depende de `OPENAI_API_KEY`.

## Tecnologías usadas

- Node.js 16 o superior
- Express.js
- Supabase JavaScript SDK
- Multer para carga de archivos
- OpenAI SDK (opcional)
- XLSX para procesamiento de archivos Excel
- Python 3.9 o superior para el motor de análisis local
- HTML, CSS y JavaScript para el frontend

## Requisitos

- Node.js 16 o superior
- Python 3.9 o superior para el análisis local
- Una cuenta de Supabase con los valores:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Si se desea usar OpenAI: `OPENAI_API_KEY`

## Instalación

1. Instalar dependencias de Node:

```bash
npm install
```

2. Crear un archivo `.env` en la raíz del proyecto:

```env
OPENAI_API_KEY=tu_api_key_aqui
PORT=3000
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
```

3. Si se utilizará el análisis local en Python, instalar dependencias:

```bash
pip install sqlglot pandas matplotlib networkx pyyaml jsonschema
```

4. Iniciar el servidor:

```bash
npm start
```

5. Abrir la aplicación en el navegador:

```text
http://localhost:3000
```

## Estructura del proyecto

- `server.js`: servidor Express y APIs.
- `supabaseClient.js`: conexión con Supabase.
- `public/`: frontend de la aplicación.
  - `public/html/`: páginas de la interfaz.
  - `public/js/`: lógica cliente para login, panel, administración y usuarios.
  - `public/css/`: estilos de la aplicación.
- `python_analyzer/`: motor local de análisis y generación de diagramas.
- `api/`: scripts auxiliares del backend.
- Archivos de ejemplo y esquemas en la raíz: `20tablasjson.json`, `basededatos.csv`, `basededatos.dbml`, `basededatos.yaml`, `basededatos.yml`, `mi_empresaDBMariaDb.sql`, `supabase_schema.sql`.

## Endpoints relevantes

- `POST /api/logs`: registra eventos de usuario.
- `GET /api/admin/logs`: obtiene logs de actividad (solo admin).
- `GET /api/admin/metrics`: obtiene métricas globales (solo admin).
- `GET /api/admin/users`: lista usuarios con conteo de documentos (solo admin).
- `POST /api/admin/users`: crea un usuario mediante Supabase Admin (solo admin).
- `PUT /api/admin/users/:id`: actualiza datos de usuario (solo admin).
- `DELETE /api/admin/users/:id`: elimina un usuario (solo admin).

## Prácticas de uso

- Registrar usuarios desde la página de login/registro.
- Revisar los roles y el estado en la tabla `perfiles`.
- Administrar usuarios, métricas y registros desde las rutas administrativas.
- Utilizar la carpeta `public/` para ampliar interfaces y agregar nuevas vistas.
- Mantener el `.env` con claves válidas y reiniciar el servidor tras cambios.

## Consideraciones

- `supabaseClient.js` requiere credenciales de servicio para operar correctamente.
- El análisis local en Python permite procesar estructuras sin depender exclusivamente de OpenAI.
- La integración de OpenAI es opcional y se activa cuando `OPENAI_API_KEY` está configurada.

## Licencia

Este proyecto utiliza la licencia MIT.
