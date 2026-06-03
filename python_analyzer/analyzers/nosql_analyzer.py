"""
Analizador NoSQL/JSON/YAML/Excel con librerías especializadas
Procesa documentos NoSQL, JSON, YAML y archivos Excel
"""

import json
import yaml
import pandas as pd
from jsonschema import validate, ValidationError
from typing import Dict, List, Any

class NoSQLAnalyzer:
    def __init__(self):
        self.supported_formats = ['.json', '.yaml', '.yml', '.xlsx', '.xls', '.csv']
    
    def parse_json(self, content: str) -> Dict[str, Any]:
        """Parsea contenido JSON y extrae esquema"""
        try:
            data = json.loads(content)
            return self._extract_schema_from_data(data, 'json')
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON inválido: {str(e)}")
    
    def parse_yaml(self, content: str) -> Dict[str, Any]:
        """Parsea contenido YAML y extrae esquema"""
        try:
            data = yaml.safe_load(content)
            return self._extract_schema_from_data(data, 'yaml')
        except yaml.YAMLError as e:
            raise ValueError(f"YAML inválido: {str(e)}")

    def parse_csv(self, file_path) -> Dict[str, Any]:
        """Parsea un archivo CSV (soportando formato estándar y formato multi-tabla personalizado)"""
        try:
            from pathlib import Path
            import csv
            file_path = Path(file_path)
            
            tables = []
            relations = []
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = [line.strip() for line in f.readlines()]
                
            # Detectar si es el formato personalizado multi-tabla
            is_multi_table = any(line.upper().startswith('TABLA,') for line in lines)
            
            if is_multi_table:
                current_table_name = None
                headers = []
                rows = []
                
                def save_current_table():
                    if current_table_name and headers:
                        columns = []
                        for col in headers:
                            # Inferir tipo básico analizando los valores cargados en rows
                            inferred_type = 'VARCHAR(255)'
                            col_idx = headers.index(col)
                            for row in rows:
                                if col_idx < len(row):
                                    val = row[col_idx]
                                    if val.lower() in ['true', 'false']:
                                        inferred_type = 'BOOLEAN'
                                        break
                                    try:
                                        int(val)
                                        inferred_type = 'INT'
                                        break
                                    except ValueError:
                                        try:
                                            float(val)
                                            inferred_type = 'DECIMAL(10,2)'
                                            break
                                        except ValueError:
                                            pass
                            
                            columns.append({
                                'name': col,
                                'type': inferred_type,
                                'nullable': True,
                                'primaryKey': col.lower() in ['id', 'uuid', 'pk', 'codigo'],
                                'autoIncrement': False
                            })
                            
                        tables.append({
                            'name': current_table_name,
                            'columns': columns,
                            'primaryKeys': [c['name'] for c in columns if c['primaryKey']],
                            'foreignKeys': []
                        })
                
                i = 0
                while i < len(lines):
                    line = lines[i]
                    if line.upper().startswith('TABLA,'):
                        # Guardar tabla anterior si existía
                        save_current_table()
                        current_table_name = line.split(',', 1)[1].strip()
                        headers = []
                        rows = []
                        # La siguiente línea no vacía contiene los headers
                        i += 1
                        while i < len(lines) and not lines[i]:
                            i += 1
                        if i < len(lines):
                            headers = [h.strip() for h in csv.reader([lines[i]]).__next__()]
                    elif line and current_table_name and headers:
                        # Es una fila de datos
                        row_data = [r.strip() for r in csv.reader([line]).__next__()]
                        rows.append(row_data)
                    i += 1
                    
                # Guardar la última tabla procesada
                save_current_table()
            else:
                # Fallback: CSV plano tradicional
                df = pd.read_csv(file_path)
                columns = []
                for col in df.columns:
                    dtype = str(df[col].dtype)
                    sql_type = self._pandas_type_to_sql_type(dtype)
                    columns.append({
                        'name': str(col),
                        'type': sql_type,
                        'nullable': bool(df[col].isnull().any()),
                        'primaryKey': str(col).lower() in ['id', 'uuid', 'pk', 'codigo'],
                        'autoIncrement': False
                    })
                table_name = file_path.stem
                tables = [{
                    'name': table_name,
                    'columns': columns,
                    'primaryKeys': [col['name'] for col in columns if col['primaryKey']],
                    'foreignKeys': []
                }]
                
            # Encontrar relaciones implícitas
            from analyzers.sql_analyzer import SQLAnalyzer
            sql_analyzer = SQLAnalyzer()
            implicit_relations = sql_analyzer._detect_implicit_relations(tables)
            relations.extend(implicit_relations)
            
            seen_rels = set()
            unique_relations = []
            for rel in relations:
                source, target, col = str(rel['from']), str(rel['to']), str(rel.get('column', ''))
                rel_id = f"{source.lower()}->{target.lower()} ({col.lower()})"
                if rel_id not in seen_rels and source.lower() != target.lower():
                    unique_relations.append({
                        'from': source, 'to': target, 'type': rel.get('type', 'foreign_key'),
                        'column': col, 'references': str(rel.get('references', 'id'))
                    })
                    seen_rels.add(rel_id)
            
            return {
                'tables': tables,
                'relations': unique_relations,
                'format': 'csv',
                'totalTables': len(tables),
                'totalRelations': len(unique_relations)
            }
        except Exception as e:
            raise ValueError(f"Error al leer CSV: {str(e)}")
    
    def parse_excel(self, file_path) -> Dict[str, Any]:
        """Parsea archivo Excel y extrae esquema"""
        try:
            # Leer todas las hojas
            excel_file = pd.ExcelFile(file_path)
            tables = []
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                
                # Extraer información de columnas
                columns = []
                for col in df.columns:
                    # Inferir tipo de dato
                    dtype = str(df[col].dtype)
                    python_type = self._pandas_type_to_sql_type(dtype)
                    
                    columns.append({
                        'name': str(col),
                        'type': python_type,
                        'nullable': df[col].isnull().any(),
                        'primaryKey': False,
                        'autoIncrement': False
                    })
                
                tables.append({
                    'name': sheet_name,
                    'columns': columns,
                    'primaryKeys': [],
                    'foreignKeys': []
                })
            
            return {
                'tables': tables,
                'relations': [],
                'format': 'excel',
                'totalTables': len(tables),
                'totalRelations': 0
            }
            
        except Exception as e:
            raise ValueError(f"Error al leer Excel: {str(e)}")
    
    def _extract_schema_from_data(self, data: Any, format_type: str) -> Dict[str, Any]:
        """Extrae esquema desde datos JSON/YAML"""
        tables = []
        relations = []
        
        if isinstance(data, dict):
            # Si el diccionario tiene una única clave y su valor es otro diccionario,
            # lo desempaquetamos para procesar las tablas internas correctamente (ej. {"basededatos": {"usuarios": [...]}})
            if len(data) == 1:
                single_key = list(data.keys())[0]
                single_val = data[single_key]
                if isinstance(single_val, dict) and not any(k in single_val for k in ['$schema', 'definitions', '$defs', 'properties']):
                    data = single_val

            # Detectar si es un JSON Schema
            is_json_schema = any(key in data for key in ['$schema', 'definitions', '$defs', 'properties'])
            # Verificar si las propiedades parecen definiciones de esquemas
            if is_json_schema:
                return self._extract_from_json_schema(data, format_type)
            
            # Caso 1: Objeto con tablas/collections
            if 'tables' in data or 'collections' in data:
                items = data.get('tables', data.get('collections', {}))
                
                if isinstance(items, list):
                    # Lista de tablas
                    for item in items:
                        table = self._extract_table_from_object(item)
                        if table:
                            tables.append(table)
                elif isinstance(items, dict):
                    # Diccionario de tablas
                    for name, item in items.items():
                        table = self._extract_table_from_object(item, name)
                        if table:
                            tables.append(table)
            
            # Caso 1.5: Objeto donde las claves representan colecciones (ej. {"usuarios": [...], "productos": [...]})
            elif any(isinstance(v, list) and (len(v) == 0 or any(isinstance(item, dict) for item in v)) for v in data.values()):
                for name, val in data.items():
                    if isinstance(val, list):
                        if len(val) == 0 or any(isinstance(item, dict) for item in val):
                            table = self._extract_table_from_array(val, name)
                            if table:
                                tables.append(table)
                    elif isinstance(val, dict):
                        table = self._extract_table_from_object(val, name)
                        if table:
                            tables.append(table)
            
            # Caso 2: Objeto simple - tratar como una tabla
            else:
                table = self._extract_table_from_object(data, 'main')
                if table:
                    tables.append(table)
        
        elif isinstance(data, list):
            # Caso 3: Array de documentos - tratar como una tabla
            if data:
                table = self._extract_table_from_array(data, 'documents')
                if table:
                    tables.append(table)
        
        # Extraer relaciones si existen explícitamente
        if isinstance(data, dict) and 'relations' in data:
            explicit_relations = data['relations']
            if isinstance(explicit_relations, list):
                relations.extend(explicit_relations)
        
        # Consolidar y validar relaciones (Fuzzy Matching)
        valid_table_names = [t['name'] for t in tables]
        for table in tables:
            for fk in table.get('foreignKeys', []):
                inferred_target = fk['references']['table']
                
                # Intentar encontrar la tabla real más cercana
                actual_target = self._find_best_table_match(inferred_target, valid_table_names)
                if actual_target:
                    fk['references']['table'] = actual_target
                    relations.append({
                        'from': table['name'],
                        'to': actual_target,
                        'type': 'foreign_key',
                        'column': fk['column']
                    })
        
        return {
            'tables': tables,
            'relations': relations,
            'format': format_type,
            'totalTables': len(tables),
            'totalRelations': len(relations)
        }

    def _find_best_table_match(self, target: str, table_names: List[str]) -> str:
        """Encuentra la mejor coincidencia para un nombre de tabla (fuzzy)"""
        target_lower = target.lower()
        
        # Coincidencia exacta
        for name in table_names:
            if name.lower() == target_lower:
                return name
        
        # Coincidencia parcial (ej: 'principio' en 'PrincipiosActivos')
        for name in table_names:
            name_lower = name.lower()
            if target_lower in name_lower or name_lower in target_lower:
                return name
        
        return None

    def _extract_from_json_schema(self, data: Dict[str, Any], format_type: str) -> Dict[str, Any]:
        """Extrae tablas y relaciones desde un JSON Schema"""
        tables = []
        relations = []
        
        # Buscar definiciones de tablas en properties o definitions
        sources = {
            'properties': data.get('properties', {}),
            'definitions': data.get('definitions', {}),
            '$defs': data.get('$defs', {})
        }
        
        for source_name, source_data in sources.items():
            if not isinstance(source_data, dict):
                continue
                
            for name, schema in source_data.items():
                if isinstance(schema, dict):
                    # Si tiene propiedades o es tipo objeto, es una tabla
                    if schema.get('type') == 'object' or 'properties' in schema:
                        table = self._extract_table_from_object(schema, name)
                        if table:
                            tables.append(table)
        
        # Consolidar y validar relaciones (Fuzzy Matching)
        valid_table_names = [t['name'] for t in tables]
        for table in tables:
            for fk in table.get('foreignKeys', []):
                inferred_target = fk['references']['table']
                actual_target = self._find_best_table_match(inferred_target, valid_table_names)
                
                if actual_target:
                    fk['references']['table'] = actual_target
                    relations.append({
                        'from': table['name'],
                        'to': actual_target,
                        'type': 'foreign_key',
                        'column': fk['column']
                    })
        
        return {
            'tables': tables,
            'relations': relations,
            'format': f"{format_type}_schema",
            'totalTables': len(tables),
            'totalRelations': len(relations)
        }
    
    def _extract_table_from_object(self, obj: Any, table_name: str = None) -> Dict[str, Any]:
        """Extrae tabla desde objeto"""
        if not isinstance(obj, dict):
            return None
        
        # Si el objeto tiene 'properties' (JSON Schema style)
        if 'properties' in obj:
            name = table_name or obj.get('title', 'unknown')
            columns = self._normalize_columns(obj['properties'])
            
            # Intentar extraer PKs desde 'required' o buscando campos id
            primary_keys = []
            for col in columns:
                if col['name'].lower() in ['id', '_id', f'id_{name.lower()}', f'{name.lower()}_id']:
                    col['primaryKey'] = True
                    primary_keys.append(col['name'])
            
            # Detectar FKs en columnas
            foreign_keys = self._detect_foreign_keys(columns)
            
            return {
                'name': name,
                'columns': columns,
                'primaryKeys': primary_keys,
                'foreignKeys': foreign_keys
            }
        
        # Si el objeto tiene 'columns' o 'fields' explícitos
        elif 'columns' in obj or 'fields' in obj:
            name = table_name or obj.get('name', 'unknown')
            columns = self._normalize_columns(obj.get('columns', obj.get('fields', [])))
            
            return {
                'name': name,
                'columns': columns,
                'primaryKeys': obj.get('primaryKeys', []),
                'foreignKeys': obj.get('foreignKeys', [])
            }
        
        # Si no, inferir estructura desde las propiedades del objeto (data simple)
        else:
            name = table_name or 'inferred_table'
            columns = []
            
            for key, value in obj.items():
                col_type = self._infer_type_from_value(value)
                is_pk = key.lower() in ['id', '_id']
                
                columns.append({
                    'name': key,
                    'type': col_type,
                    'nullable': True,
                    'primaryKey': is_pk,
                    'autoIncrement': False
                })
            
            foreign_keys = self._detect_foreign_keys(columns)
            
            return {
                'name': name,
                'columns': columns,
                'primaryKeys': [col['name'] for col in columns if col['primaryKey']],
                'foreignKeys': foreign_keys
            }

    def _detect_foreign_keys(self, columns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detecta llaves foráneas implícitas en una lista de columnas"""
        foreign_keys = []
        for col in columns:
            key = col['name']
            is_pk = col.get('primaryKey', False)
            
            is_fk = False
            ref_table = None
            
            if not is_pk:
                # Caso 1: termina en _id o id (ej: user_id, userId)
                if key.lower().endswith('_id') or (key.lower().endswith('id') and len(key) > 2):
                    ref_table = key.lower().replace('_id', '').replace('id', '')
                    is_fk = True
                # Caso 2: empieza por id_ (ej: id_user)
                elif key.lower().startswith('id_'):
                    ref_table = key.lower().replace('id_', '')
                    is_fk = True
            
            if is_fk and ref_table:
                # Pluralización básica para inferencia
                if ref_table[-1] in 'aeiou': ref_table_plural = ref_table + 's'
                else: ref_table_plural = ref_table + 'es'
                
                foreign_keys.append({
                    'column': key,
                    'references': {
                        'table': ref_table_plural, # Será refinado con fuzzy match después
                        'column': 'id'
                    }
                })
        return foreign_keys
    
    def _extract_table_from_array(self, arr: List[Any], table_name: str) -> Dict[str, Any]:
        """Extrae tabla desde array de documentos"""
        if not arr:
            return None
        
        all_keys = set()
        for item in arr:
            if isinstance(item, dict):
                all_keys.update(item.keys())
        
        columns = []
        for key in all_keys:
            inferred_type = 'STRING'
            for item in arr:
                if isinstance(item, dict) and key in item and item[key] is not None:
                    inferred_type = self._infer_type_from_value(item[key])
                    break
            
            is_pk = key.lower() in ['id', '_id']
            columns.append({
                'name': key,
                'type': inferred_type,
                'nullable': True,
                'primaryKey': is_pk,
                'autoIncrement': False
            })
        
        foreign_keys = self._detect_foreign_keys(columns)
        
        return {
            'name': table_name,
            'columns': columns,
            'primaryKeys': [col['name'] for col in columns if col['primaryKey']],
            'foreignKeys': foreign_keys
        }
    
    def _normalize_columns(self, columns: Any) -> List[Dict[str, Any]]:
        """Normaliza diferentes formatos de columnas"""
        if isinstance(columns, list):
            return columns
        elif isinstance(columns, dict):
            result = []
            for name, col_info in columns.items():
                if isinstance(col_info, dict):
                    # JSON Schema style: "name": {"type": "string", ...}
                    col_type = col_info.get('type', 'STRING')
                    if isinstance(col_type, list): col_type = col_type[0]
                    
                    result.append({
                        'name': name,
                        'type': str(col_type).upper(),
                        'nullable': True,
                        'primaryKey': False,
                        'autoIncrement': False
                    })
                else:
                    # Simple type string
                    result.append({
                        'name': name,
                        'type': str(col_info).upper(),
                        'nullable': True,
                        'primaryKey': False,
                        'autoIncrement': False
                    })
            return result
        return []
    
    def _infer_type_from_value(self, value: Any) -> str:
        """Infiere tipo SQL desde valor Python"""
        if value is None:
            return 'NULL'
        elif isinstance(value, bool):
            return 'BOOLEAN'
        elif isinstance(value, int):
            return 'INTEGER'
        elif isinstance(value, float):
            return 'FLOAT'
        elif isinstance(value, str):
            if value.lower() in ('true', 'false'):
                return 'BOOLEAN'
            elif value.isdigit():
                return 'INTEGER'
            elif self._is_float(value):
                return 'FLOAT'
            elif len(value) > 255:
                return 'TEXT'
            else:
                return 'VARCHAR(255)'
        elif isinstance(value, list):
            return 'ARRAY'
        elif isinstance(value, dict):
            return 'JSON'
        return 'VARCHAR(255)'
    
    def _is_float(self, value: str) -> bool:
        try:
            float(value)
            return '.' in value
        except ValueError:
            return False
    
    def _pandas_type_to_sql_type(self, dtype: str) -> str:
        dtype = dtype.lower()
        if 'int' in dtype: return 'INTEGER'
        elif 'float' in dtype: return 'FLOAT'
        elif 'bool' in dtype: return 'BOOLEAN'
        elif 'datetime' in dtype: return 'DATETIME'
        return 'VARCHAR(255)'
    
    def validate_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        validation = {'isValid': True, 'errors': [], 'warnings': [], 'suggestions': []}
        tables = schema.get('tables', [])
        if not tables:
            validation['errors'].append("No se encontraron tablas")
            validation['isValid'] = False
            return validation
        for table in tables:
            if not table.get('name'):
                validation['errors'].append("Tabla sin nombre encontrada")
                validation['isValid'] = False
                continue
            columns = table.get('columns', [])
            if not columns:
                validation['warnings'].append(f"Tabla {table['name']} sin columnas")
                continue
            for col in columns:
                if col.get('type') in ['STRING', 'OBJECT', 'JSON']:
                    validation['suggestions'].append(f"Refinar tipo en {table['name']}.{col['name']}")
        return validation
    
    def calculate_metrics(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        tables = schema.get('tables', [])
        total_columns = sum(len(t.get('columns', [])) for t in tables)
        total_pks = sum(len(t.get('primaryKeys', [])) for t in tables)
        total_fks = sum(len(t.get('foreignKeys', [])) for t in tables)
        total_rels = len(schema.get('relations', []))
        
        type_dist = {}
        for t in tables:
            for c in t.get('columns', []):
                ctype = c.get('type', 'UNKNOWN')
                type_dist[ctype] = type_dist.get(ctype, 0) + 1
        
        return {
            'totalTables': len(tables),
            'totalColumns': total_columns,
            'totalPrimaryKeys': total_pks,
            'totalForeignKeys': total_fks,
            'totalRelations': total_rels,
            'avgColumnsPerTable': total_columns / len(tables) if tables else 0,
            'typeDistribution': type_dist,
            'structureScore': self._calculate_structure_score(tables),
            'format': schema.get('format', 'unknown')
        }
    
    def _calculate_structure_score(self, tables: List[Dict[str, Any]]) -> float:
        if not tables: return 0.0
        score = 50.0
        for table in tables:
            cols = table.get('columns', [])
            if cols: score += 10
            if table.get('primaryKeys'): score += 15
            if table.get('foreignKeys'): score += 10
        return min(100.0, score)

    def detect_anomalies(self, schema: Dict[str, Any]) -> List[Dict[str, Any]]:
        anomalies = []
        tables = schema.get('tables', [])
        
        for table in tables:
            name = table.get('name', 'unknown')
            columns = table.get('columns', [])
            pks = table.get('primaryKeys', [])
            fks = table.get('foreignKeys', [])
            
            # Regla 1: Identificar tablas o colecciones sin Clave Primaria (o ID)
            if not pks:
                anomalies.append({
                    'type': 'warning',
                    'severity': 'high',
                    'table': name,
                    'message': f"El documento/tabla '{name}' no tiene un campo identificador único (ID o Clave Primaria). Esto dificulta la búsqueda o modificación de registros específicos."
                })
                
            # Regla 2: Documentos con demasiadas propiedades
            if len(columns) > 25:
                anomalies.append({
                    'type': 'optimization',
                    'severity': 'medium',
                    'table': name,
                    'message': f"La estructura '{name}' tiene {len(columns)} propiedades. Es bastante densa. Evalúe si algunas propiedades podrían anidarse o separarse en otra colección."
                })
                
            # Regla 3: Referencias o IDs sueltos
            for col in columns:
                col_name = col.get('name', '').lower()
                if ('id' in col_name or 'codigo' in col_name) and col_name not in [pk.lower() for pk in pks]:
                    has_fk = any(fk['column'].lower() == col_name for fk in fks)
                    if not has_fk:
                        anomalies.append({
                            'type': 'suggestion',
                            'severity': 'low',
                            'table': name,
                            'message': f"El campo '{col.get('name')}' sugiere una relación hacia otra colección/tabla, pero no se ha podido inferir una referencia clara."
                        })
                        
            # Regla 4: Tipos de datos "desconocidos" o puros VARCHAR(255)
            unknown_cols = [c['name'] for c in columns if c.get('type') == 'VARCHAR(255)' or c.get('type') == 'UNKNOWN']
            if unknown_cols and len(unknown_cols) > len(columns) * 0.8:
                anomalies.append({
                    'type': 'typing',
                    'severity': 'medium',
                    'table': name,
                    'message': f"Más del 80% de los campos en '{name}' son de texto genérico (VARCHAR/String). Esto puede consumir más espacio o afectar la validación."
                })

        return anomalies
