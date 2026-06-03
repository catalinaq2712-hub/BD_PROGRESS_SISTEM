# 🚀 AI Database Auditor & Documentation System (Hybrid Edition)

Un sistema avanzado y profesional para la auditoría, documentación y conversión de estructuras de bases de datos. Combina la potencia de la **Inteligencia Artificial (OpenAI GPT-4o-mini)** con un robusto **Motor de Análisis Local basado en Python** para ofrecer precisión técnica y visión crítica.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.9-blue.svg)
![OpenAI](https://img.shields.io/badge/AI-OpenAI%20GPT--4o--mini-orange.svg)

---

## ✨ Características Principales

### 1. 🔍 Análisis Híbrido (IA + Python)
- **Análisis con IA**: Genera documentación descriptiva, críticas contables y sugerencias estratégicas.
- **Análisis con Python**: Motor local ultra-rápido para detección precisa de tipos de datos, llaves primarias, foráneas (incluso implícitas) y métricas de normalización.

### 2. 📊 Diagramas ER Interactivos (Mermaid.js & NetworkX)
Visualiza tu base de datos al instante.
- **Detección de Relaciones**: Identifica claves foráneas explícitas e infiere relaciones por nombres de columnas (Fuzzy Matching).
- **Controles de Zoom & SVG**: Navega por esquemas complejos y descarga los diagramas para tus reportes.

### 3. 🔄 Convertidor de Esquemas Profesional
Transforma tu estructura de datos a cualquier tecnología moderna:
- **Formatos**: MySQL, PostgreSQL, SQLite, MongoDB (Mongoose), Prisma, GraphQL, JSON Schema, CSV, YAML.

---

## 🛠️ Requisitos del Sistema

### Core
- **Node.js** v16.0 o superior.
- **OpenAI API Key** (opcional, requerida solo para la pestaña de Análisis IA).

### Motor Python (Requerido para Análisis Local)
- **Python** 3.9 o superior.
- **Dependencias**:
  ```bash
  pip install sqlglot pandas matplotlib networkx pyyaml jsonschema
  ```

---

## 🚀 Instalación y Configuración

### 1. Clonar e Instalar Node
```bash
npm install
```

### 2. Configurar Python
Asegúrate de tener instaladas las dependencias mencionadas arriba.

### 3. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
OPENAI_API_KEY=tu_api_key_aqui
PORT=3000
```

### 4. Iniciar el Sistema
```bash
npm start
```
Visita `http://localhost:3000` en tu navegador.

---

## 📖 Cómo Usar el Sistema

1. **Subida**: Arrastra tu archivo (`.sql`, `.json`, `.xlsx`, etc.).
2. **Análisis Local (Python)**: Úsalo para obtener métricas técnicas exactas, detectar relaciones implícitas y generar el diagrama ER sin coste de API.
3. **Análisis IA (OpenAI)**: Úsalo para obtener una auditoría crítica desde una perspectiva contable y de arquitectura de software.
4. **Visualización**: Ve a la pestaña "Diagrama ER" para ver las conexiones entre tablas.
5. **Conversión**: Exporta tu esquema a otros formatos en la pestaña "Convertidor".
6. **Exportación**: Genera reportes en Word, PDF o imprime directamente desde la interfaz.

---

## 🛡️ Estructura del Proyecto
- `public/`: Frontend (HTML, CSS, JS Moderno).
- `python_analyzer/`: Motor de análisis local (Analizadores SQL, NoSQL, Diagramas).
- `server.js`: Servidor Express y orquestador del sistema.
- `uploads/`: Carpeta temporal para procesamiento de archivos.

---

## 📄 Licencia
Este proyecto está bajo la Licencia **MIT**.
