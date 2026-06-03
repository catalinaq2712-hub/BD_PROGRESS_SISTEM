#!/usr/bin/env python3
"""
Generador de datos de prueba para bases de datos.
Respeta PKs, FKs, tipos de dato y orden topológico.
Soporta SQL (MySQL, PostgreSQL, SQLite) y NoSQL/JSON.
Límite máximo: 20 filas por tabla.
"""

import json
import re
import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict, deque

# Intentar importar faker; si falla, usar generador casero
FAKER_AVAILABLE = False
try:
    from faker import Faker
    fake = Faker('es_ES')  # Español para datos realistas
    FAKER_AVAILABLE = True
except ImportError:
    pass


class DataGenerator:
    def __init__(self, schema: dict, config: dict = None):
        self.schema = schema
        self.config = config or {}
        self.max_rows = min(self.config.get('maxRows', 5), 20)  # Límite global 20
        self.rows_per_table = {}  # {table_name: int}
        self.generated_data = {}  # {table_name: [rows]}
        self.pk_values = {}  # {table_name: {column_name: [val1, val2, ...]}}
        self.dialect = schema.get('dialect', 'mysql').lower() if schema else 'mysql'
        self.db_type = schema.get('type', 'sql').lower() if schema else 'sql'
        self.warnings = []

        # Si es un archivo JSON/YAML, puede venir como type='nosql'/'json'
        if self.db_type in ('nosql', 'json', 'yaml', 'excel'):
            self.db_type = 'json'

    def generate(self) -> dict:
        """
        Genera los datos de prueba y retorna un dict con:
        {
            'sqlScript': str,
            'stats': {...},
            'warnings': [...]
        }
        """
        tables = self.schema.get('tables', [])
        if not tables:
            return {
                'sqlScript': '-- No se encontraron tablas en el esquema.',
                'stats': {'totalTables': 0, 'totalRows': 0},
                'warnings': ['No hay tablas para generar datos.']
            }

        # Identificar tablas requeridas (referenciadas por FKs)
        required_tables = self._get_required_tables(tables)

        # Configurar filas por tabla
        for table in tables:
            tname = table['name']
            user_cfg = self.config.get('tables', {}).get(tname, {})
            if user_cfg.get('enabled', True):
                self.rows_per_table[tname] = min(user_cfg.get('rows', self.max_rows), 20)
            else:
                # Si la tabla es requerida, forzar habilitación
                if tname in required_tables:
                    self.rows_per_table[tname] = min(user_cfg.get('rows', self.max_rows), 20)
                    self.warnings.append(f"Tabla '{tname}' fue forzada porque es referenciada por FKs.")
                else:
                    self.rows_per_table[tname] = 0

        # Orden topológico (padres primero)
        ordered_tables = self._topological_sort(tables)

        # Generar datos
        for table in ordered_tables:
            tname = table['name']
            n_rows = self.rows_per_table.get(tname, 0)
            if n_rows > 0:
                self.generated_data[tname] = self._generate_table_data(table, n_rows)

        # Construir script final
        if self.db_type == 'json':
            script = self._build_json_script()
        else:
            script = self._build_sql_script()

        total_rows = sum(len(rows) for rows in self.generated_data.values())
        stats = {
            'totalTables': len(tables),
            'tablesGenerated': len(self.generated_data),
            'totalRows': total_rows,
            'dialect': self.dialect,
            'dbType': self.db_type
        }

        return {
            'sqlScript': script,
            'stats': stats,
            'warnings': self.warnings
        }

    def _get_required_tables(self, tables: List[dict]) -> set:
        """Devuelve conjunto de tablas que son destino de al menos una FK."""
        required = set()
        for table in tables:
            fks = table.get('foreignKeys', [])
            for fk in fks:
                ref_table = fk.get('referencesTable') or fk.get('references', {}).get('table', '')
                if ref_table:
                    required.add(ref_table)
        return required

    def _topological_sort(self, tables: List[dict]) -> List[dict]:
        """Ordena las tablas para que las padres vayan antes que las hijas (por FKs)."""
        table_names = {t['name'] for t in tables}
        name_to_table = {t['name']: t for t in tables}

        # Construir grafo de dependencias
        in_degree = {t['name']: 0 for t in tables}
        adj = defaultdict(list)

        for table in tables:
            tname = table['name']
            fks = table.get('foreignKeys', [])
            for fk in fks:
                ref = fk.get('referencesTable') or fk.get('references', {}).get('table', '')
                if ref and ref in table_names and ref != tname:
                    # tname depende de ref
                    adj[ref].append(tname)
                    in_degree[tname] += 1

        # Kahn's algorithm
        queue = deque([n for n, d in in_degree.items() if d == 0])
        ordered = []
        while queue:
            node = queue.popleft()
            ordered.append(name_to_table[node])
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # Si quedaron nodos (ciclo), añadirlos al final
        if len(ordered) < len(tables):
            visited = {t['name'] for t in ordered}
            for table in tables:
                if table['name'] not in visited:
                    ordered.append(table)
                    self.warnings.append(f"Ciclo de FKs detectado; tabla '{table['name']}' insertada al final (FKs pueden fallar).")

        return ordered

    def _is_string_type(self, ctype: str) -> bool:
        """Devuelve True si el tipo SQL es un tipo string/texto."""
        return bool(re.search(r'VARCHAR|CHAR|TEXT|STRING|CLOB|NVARCHAR|NCHAR|UUID', ctype.upper()))

    def _generate_pk_value(self, ctype: str, index: int, tname: str, cname: str) -> Any:
        """Genera un valor único y nunca NULL para una Primary Key."""
        if self._is_string_type(ctype):
            # PK de tipo string (MongoDB, UUID, etc.)
            if 'UUID' in ctype.upper():
                return str(uuid.uuid4())
            prefix = tname[0:3].lower() if tname else 'id'
            return f"{prefix}_{index + 1}_{random.randint(1000,9999)}"
        # PK numérica: secuencial a partir de 1
        return index + 1

    def _generate_table_data(self, table: dict, n_rows: int) -> List[dict]:
        """Genera n_rows filas de datos para una tabla."""
        rows = []
        columns = table.get('columns', [])
        fks = table.get('foreignKeys', [])
        tname = table['name']

        # Mapear FKs por columna para fácil acceso
        fk_map = {}
        for fk in fks:
            col = fk.get('column', '')
            ref_table = fk.get('referencesTable') or fk.get('references', {}).get('table', '')
            ref_col = fk.get('referencesColumn') or fk.get('references', {}).get('column', 'id')
            fk_map[col] = {'table': ref_table, 'column': ref_col}

        for i in range(n_rows):
            row = {}
            for col in columns:
                cname = col['name']
                ctype = col.get('type', 'VARCHAR(255)')
                is_pk = col.get('primaryKey', False)
                is_auto = col.get('autoIncrement', False)
                is_nullable = col.get('nullable', True)

                # --- REGLA CRÍTICA: Primary Key NUNCA puede ser NULL ---
                if is_pk:
                    if is_auto:
                        # Auto-incremental: secuencial numérica
                        val = i + 1
                    elif cname in fk_map:
                        # PK que también es FK → valor de la tabla padre
                        ref_info = fk_map[cname]
                        ref_t = ref_info['table']
                        ref_c = ref_info['column']
                        if ref_t in self.generated_data and self.generated_data[ref_t]:
                            ref_row = random.choice(self.generated_data[ref_t])
                            val = ref_row.get(ref_c, i + 1)
                        else:
                            val = i + 1
                    else:
                        # PK sin auto ni FK → secuencial según tipo
                        val = self._generate_pk_value(ctype, i, tname, cname)
                elif cname in fk_map:
                    # FK normal (no PK)
                    ref_info = fk_map[cname]
                    ref_t = ref_info['table']
                    ref_c = ref_info['column']
                    if ref_t in self.generated_data and self.generated_data[ref_t]:
                        ref_row = random.choice(self.generated_data[ref_t])
                        val = ref_row.get(ref_c, i + 1)
                    else:
                        val = i + 1  # fallback
                else:
                    # Columna normal (puede ser NULL si es nullable)
                    val = self._generate_value_for_column(cname, ctype, is_nullable)

                row[cname] = val

            rows.append(row)

        return rows

    def _bool_value(self) -> Any:
        """Devuelve valor booleano según el dialecto:
        - PostgreSQL: 'TRUE' / 'FALSE' (strings, se renderizan sin comillas en SQL)
        - Otros (MySQL, SQL Server, SQLite, genérico): 0 / 1 (integers)
        - NoSQL: True / False (Python nativo)
        """
        if self.db_type == 'json':
            return random.choice([True, False])
        if self.dialect == 'postgres' or self.dialect == 'postgresql':
            return 'TRUE' if random.random() > 0.5 else 'FALSE'
        return 1 if random.random() > 0.5 else 0

    def _generate_value_for_column(self, col_name: str, col_type: str, nullable: bool) -> Any:
        """Genera un valor de prueba según el nombre y tipo de columna."""
        col_name_lower = col_name.lower()
        ctype = col_type.upper()

        # Detectar NULL aleatorio (10% de probabilidad si es nullable)
        if nullable and random.random() < 0.1:
            return None

        # Mapeo por nombre de columna (automático)
        if any(k in col_name_lower for k in ('email', 'correo', 'mail')):
            return fake.email() if FAKER_AVAILABLE else f"usuario{random.randint(1,9999)}@mail.com"
        if any(k in col_name_lower for k in ('nombre', 'name', 'first_name', 'full_name')):
            return fake.name() if FAKER_AVAILABLE else f"Nombre {random.randint(1,999)}"
        if any(k in col_name_lower for k in ('apellido', 'last_name')):
            return fake.last_name() if FAKER_AVAILABLE else f"Apellido {random.randint(1,999)}"
        if any(k in col_name_lower for k in ('telefono', 'phone', 'cell', 'celular', 'movil')):
            return fake.phone_number() if FAKER_AVAILABLE else f"+34 {random.randint(600000000,699999999)}"
        if any(k in col_name_lower for k in ('direccion', 'address', 'calle', 'street')):
            return fake.address() if FAKER_AVAILABLE else f"Calle {random.randint(1,99)} #{random.randint(1,99)}"
        if any(k in col_name_lower for k in ('ciudad', 'city', 'municipio')):
            return fake.city() if FAKER_AVAILABLE else f"Ciudad {random.randint(1,99)}"
        if any(k in col_name_lower for k in ('pais', 'country')):
            return fake.country() if FAKER_AVAILABLE else f"Pais {random.randint(1,99)}"
        if any(k in col_name_lower for k in ('codigo_postal', 'zip', 'postal')):
            return fake.postcode() if FAKER_AVAILABLE else f"{random.randint(10000,99999)}"
        if any(k in col_name_lower for k in ('fecha', 'date', 'created_at', 'updated_at', 'deleted_at', 'timestamp')):
            d = fake.date_time_between(start_date='-2y', end_date='now') if FAKER_AVAILABLE else datetime.now() - timedelta(days=random.randint(0,730))
            # SQL Server: formato ISO inequívoco para evitar ambigüedades de locale
            if self.dialect == 'sqlserver' or self.dialect == 'mssql':
                if 'TIME' in ctype and 'DATE' not in ctype:
                    return d.strftime('%H:%M:%S')
                if 'DATE' in ctype and 'TIME' not in ctype:
                    return d.strftime('%Y%m%d')  # YYYYMMDD es seguro en SQL Server
                # DATETIME / DATETIME2 / TIMESTAMP
                return d.strftime('%Y-%m-%dT%H:%M:%S')
            return d.isoformat() if 'timestamp' in col_name_lower or 'at' in col_name_lower else d.strftime('%Y-%m-%d')
        if any(k in col_name_lower for k in ('descripcion', 'description', 'bio', 'texto', 'notes', 'comentario', 'comment')):
            return fake.text(max_nb_chars=200) if FAKER_AVAILABLE else f"Texto de prueba generado para {col_name}."
        if any(k in col_name_lower for k in ('titulo', 'title', 'asunto', 'subject')):
            return fake.sentence(nb_words=6) if FAKER_AVAILABLE else f"Titulo de prueba {random.randint(1,999)}"
        if any(k in col_name_lower for k in ('precio', 'price', 'amount', 'total', 'monto', 'saldo', 'costo')):
            return round(random.uniform(10.0, 5000.0), 2)
        if any(k in col_name_lower for k in ('cantidad', 'quantity', 'stock', 'numero', 'count')):
            return random.randint(1, 100)
        if any(k in col_name_lower for k in ('estado', 'status', 'active', 'activo', 'enabled')):
            # BOOLEAN → valor booleano según dialecto
            if 'BOOLEAN' in ctype or ctype == 'BOOL':
                return self._bool_value()
            # BIT/TINYINT/INT → 0/1
            if 'BIT' in ctype or 'TINYINT' in ctype or 'INT' in ctype:
                return 1 if random.random() > 0.5 else 0
            return random.choice(['activo', 'inactivo', 'pendiente'])
        if any(k in col_name_lower for k in ('rol', 'role', 'tipo', 'type', 'categoria', 'category')):
            return random.choice(['admin', 'user', 'editor', 'guest']) if 'VARCHAR' in ctype or 'TEXT' in ctype else random.randint(1, 5)
        if any(k in col_name_lower for k in ('url', 'link', 'website', 'sitio')):
            return fake.url() if FAKER_AVAILABLE else f"https://ejemplo{random.randint(1,999)}.com"
        if any(k in col_name_lower for k in ('imagen', 'image', 'foto', 'photo', 'avatar')):
            return fake.image_url() if FAKER_AVAILABLE else f"https://picsum.photos/200/200?random={random.randint(1,999)}"
        if any(k in col_name_lower for k in ('uuid', 'guid')):
            return str(uuid.uuid4())
        if any(k in col_name_lower for k in ('color', 'colour')):
            return fake.hex_color() if FAKER_AVAILABLE else f"#{random.randint(0,0xFFFFFF):06x}"
        if any(k in col_name_lower for k in ('lat', 'latitud', 'latitude')):
            return round(random.uniform(-90.0, 90.0), 6)
        if any(k in col_name_lower for k in ('lng', 'longitud', 'longitude')):
            return round(random.uniform(-180.0, 180.0), 6)

        # Fallback por tipo SQL
        return self._generate_by_sql_type(ctype, nullable)

    def _generate_by_sql_type(self, ctype: str, nullable: bool) -> Any:
        ctype = ctype.upper()

        # Enteros
        if re.search(r'INT|SERIAL|INTEGER|BIGINT|SMALLINT|TINYINT|MEDIUMINT', ctype):
            # TINYINT(1) como booleano numérico (MySQL)
            if 'TINYINT(1)' in ctype:
                return 1 if random.random() > 0.5 else 0
            return random.randint(1, 10000)

        # BOOLEAN (PostgreSQL) → TRUE/FALSE
        if ctype == 'BOOL' or 'BOOLEAN' in ctype:
            return self._bool_value()

        # BIT (SQL Server) → 0/1
        if 'BIT' in ctype:
            return 1 if random.random() > 0.5 else 0

        # Decimales / Floats / Doubles / Numeric
        if re.search(r'DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|MONEY', ctype):
            precision = 2
            if 'DECIMAL' in ctype or 'NUMERIC' in ctype:
                m = re.search(r'\((\d+)(?:,\s*(\d+))?\)', ctype)
                if m and m.group(2):
                    precision = int(m.group(2))
            return round(random.uniform(0.0, 10000.0), precision)

        # Fechas
        if re.search(r'DATE|TIME|DATETIME|TIMESTAMP|YEAR', ctype):
            d = datetime.now() - timedelta(days=random.randint(0, 730))
            # SQL Server: usar formatos inequívocos para evitar ambigüedad de locale
            if self.dialect == 'sqlserver' or self.dialect == 'mssql':
                if 'TIME' in ctype and 'DATE' not in ctype:
                    return d.strftime('%H:%M:%S')
                if 'DATE' in ctype and 'TIME' not in ctype:
                    return d.strftime('%Y%m%d')
                return d.strftime('%Y-%m-%dT%H:%M:%S')
            if 'DATE' in ctype and 'TIME' not in ctype:
                return d.strftime('%Y-%m-%d')
            if 'TIME' in ctype and 'DATE' not in ctype:
                return d.strftime('%H:%M:%S')
            return d.strftime('%Y-%m-%d %H:%M:%S')

        # Texto / Varchar / Char / Text
        if re.search(r'VARCHAR|CHAR|TEXT|STRING|CLOB|NVARCHAR|NCHAR', ctype):
            length = 50
            m = re.search(r'\((\d+)\)', ctype)
            if m:
                length = int(m.group(1))
            if length <= 5:
                return fake.lexify(text='?' * length) if FAKER_AVAILABLE else 'A' * length
            if length <= 255:
                return fake.pystr(min_chars=5, max_chars=min(length, 100)) if FAKER_AVAILABLE else f"Texto{random.randint(1,999)}"
            return fake.text(max_nb_chars=min(length, 200)) if FAKER_AVAILABLE else f"Texto largo generado para pruebas."

        # JSON / BLOB / Binary
        if 'JSON' in ctype:
            return json.dumps({'key': f'value{random.randint(1,99)}'})
        if 'BLOB' in ctype or 'BINARY' in ctype:
            return f"0x{random.randint(0,255):02x}{random.randint(0,255):02x}"
        if 'ENUM' in ctype:
            m = re.search(r"ENUM\(([^)]+)\)", ctype, re.IGNORECASE)
            if m:
                vals = [v.strip().strip("'\"") for v in m.group(1).split(',')]
                return random.choice(vals) if vals else 'A'
            return 'A'
        if 'SET' in ctype:
            return 'a,b'

        # UUID
        if 'UUID' in ctype:
            return str(uuid.uuid4())

        # Default genérico
        return f"valor_{random.randint(1,9999)}"

    def _build_sql_script(self) -> str:
        """Construye script SQL con INSERTs individuales por fila, según dialecto."""
        lines = []
        lines.append(f"-- Datos de prueba generados automáticamente")
        lines.append(f"-- Dialecto detectado: {self.dialect.upper()}")
        lines.append(f"-- Tablas: {len(self.generated_data)}")
        lines.append(f"-- Total de filas: {sum(len(r) for r in self.generated_data.values())}")
        lines.append("")

        # Ordenar por el orden topológico ya respetado
        ordered_names = list(self.generated_data.keys())

        for tname in ordered_names:
            rows = self.generated_data[tname]
            if not rows:
                continue

            # Detectar si esta tabla tiene columnas autoIncrement/IDENTITY
            table_schema = next((t for t in self.schema.get('tables', []) if t['name'] == tname), None)
            has_identity = False
            if table_schema:
                has_identity = any(col.get('autoIncrement', False) for col in table_schema.get('columns', []))

            lines.append(f"-- Tabla: {tname} ({len(rows)} filas)")

            # SQL Server requiere SET IDENTITY_INSERT ON/OFF para insertar valores en columnas IDENTITY
            if (self.dialect == 'sqlserver' or self.dialect == 'mssql') and has_identity:
                lines.append(f"SET IDENTITY_INSERT {self._quote_identifier(tname)} ON;")

            columns = list(rows[0].keys())
            col_list = ', '.join([self._quote_identifier(c) for c in columns])

            for row in rows:
                values = []
                for c in columns:
                    v = row[c]
                    if v is None:
                        values.append('NULL')
                    elif isinstance(v, bool):
                        values.append('TRUE' if v else 'FALSE')
                    elif isinstance(v, (int, float)):
                        values.append(str(v))
                    elif v == 'TRUE' or v == 'FALSE':
                        # PostgreSQL boolean keyword — no quotes
                        values.append(v)
                    else:
                        # Escapar comillas simples
                        sv = str(v).replace("'", "''")
                        values.append(f"'{sv}'")

                val_list = ', '.join(values)
                lines.append(f"INSERT INTO {self._quote_identifier(tname)} ({col_list}) VALUES ({val_list});")

            if (self.dialect == 'sqlserver' or self.dialect == 'mssql') and has_identity:
                lines.append(f"SET IDENTITY_INSERT {self._quote_identifier(tname)} OFF;")

            lines.append("")

        return '\n'.join(lines)

    def _build_json_script(self) -> str:
        """Construye script JSON/MongoDB con inserts."""
        lines = []
        lines.append("// Datos de prueba generados automáticamente")
        lines.append(f"// Formato: JSON / NoSQL")
        lines.append("")

        for tname, rows in self.generated_data.items():
            if not rows:
                continue
            lines.append(f"// Colección: {tname} ({len(rows)} documentos)")
            for row in rows:
                lines.append(f"db.{tname}.insertOne({json.dumps(row, ensure_ascii=False, indent=2)});")
            lines.append("")

        return '\n'.join(lines)

    def _quote_identifier(self, identifier: str) -> str:
        """Cita identificadores según el dialecto."""
        if self.dialect == 'sqlserver' or self.dialect == 'mssql':
            return f'[{identifier}]'
        if self.dialect == 'postgres' or self.dialect == 'postgresql':
            return f'"{identifier}"'
        if self.dialect == 'mysql' or self.dialect == 'mariadb':
            return f"`{identifier}`"
        # SQLite usa comillas dobles para identificadores
        if self.dialect == 'sqlite':
            return f'"{identifier}"'
        # Genérico / desconocido: sin comillas (SQL estándar, compatible con casi todo)
        return identifier


def generate_test_data(schema: dict, config: dict) -> dict:
    """Función de conveniencia para ser llamada desde main.py o el endpoint."""
    generator = DataGenerator(schema, config)
    return generator.generate()
