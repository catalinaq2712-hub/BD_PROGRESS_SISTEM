"""
Analizador SQL con SQLGlot y sql-metadata
Reemplaza análisis de OpenAI para SQL con librerías especializadas
"""

import re
import sqlglot
from typing import Dict, List, Any

class SQLAnalyzer:
    def __init__(self):
        self.supported_dialects = [
            'mysql', 'postgres', 'sqlite', 'sqlserver', 'oracle', 
            'bigquery', 'snowflake', 'redshift', 'clickhouse'
        ]
    
    def parse_dbml(self, content: str) -> Dict[str, Any]:
        """Parsea contenido DBML y extrae esquema con tablas y relaciones"""
        tables = []
        relations = []
        
        # Encontrar bloques de Table name { ... }
        table_regex = re.compile(r'Table\s+(?:`|")?(\w+)(?:`|")?\s*\{([\s\S]*?)\}', re.IGNORECASE)
        for table_match in table_regex.finditer(content):
            table_name = table_match.group(1)
            body = table_match.group(2)
            
            columns = []
            primary_keys = []
            foreign_keys = []
            
            # Procesar cada línea del cuerpo de la tabla
            for line in body.split('\n'):
                line = re.sub(r'(//|#).*$', '', line).strip() # Eliminar comentarios
                if not line:
                    continue
                
                # Ejemplo de línea: id integer [primary key, increment]
                field_match = re.match(r'^(?:`|")?(\w+)(?:`|")?\s+([A-Za-z0-9_]+(?:\([\s\S]*?\))?)(?:\s+\[([\s\S]*?)\])?', line)
                if field_match:
                    col_name = field_match.group(1)
                    col_type = field_match.group(2).upper()
                    settings = field_match.group(3) or ''
                    
                    primary_key = 'primary key' in settings.lower() or 'pk' in settings.lower()
                    auto_increment = 'increment' in settings.lower() or 'unique' in settings.lower()
                    nullable = 'not null' not in settings.lower()
                    
                    if primary_key:
                        primary_keys.append(col_name)
                        
                    columns.append({
                        'name': col_name,
                        'type': col_type,
                        'nullable': nullable,
                        'primaryKey': primary_key,
                        'autoIncrement': auto_increment
                    })
            
            tables.append({
                'name': table_name,
                'columns': columns,
                'primaryKeys': primary_keys,
                'foreignKeys': foreign_keys
            })
            
        # Encontrar relaciones Ref
        ref_regex = re.compile(r'Ref(?:\s+\w+)?\s*:\s*(?:`|")?(\w+)(?:`|")?\.([A-Za-z0-9_]+)\s*([><-])\s*(?:`|")?(\w+)(?:`|")?\.([A-Za-z0-9_]+)', re.IGNORECASE)
        for ref_match in ref_regex.finditer(content):
            table_from = ref_match.group(1)
            col_from = ref_match.group(2)
            op = ref_match.group(3)
            table_to = ref_match.group(4)
            col_to = ref_match.group(5)
            
            if op == '<':
                table_from, table_to = table_to, table_from
                col_from, col_to = col_to, col_from
                
            relations.append({
                'from': table_from,
                'to': table_to,
                'type': 'foreign_key',
                'column': col_from,
                'references': col_to
            })
            
            table = next((t for t in tables if t['name'] == table_from), None)
            if table:
                table['foreignKeys'].append({
                    'column': col_from,
                    'references': {'table': table_to, 'column': col_to}
                })
                
        implicit_relations = self._detect_implicit_relations(tables)
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
            'dialect': 'dbml',
            'totalTables': len(tables),
            'totalRelations': len(unique_relations)
        }

    def parse_sql(self, content: str) -> Dict[str, Any]:
        """Parsea contenido SQL y extrae esquema completo"""
        try:
            dialect = self._detect_dialect(content)
            parsed = sqlglot.parse(content, dialect=dialect)
            tables = []
            relations = []
            
            for stmt in parsed:
                if not stmt: continue
                if stmt.key == 'create':
                    is_table = str(stmt.args.get('kind', '')).upper() == 'TABLE'
                    if not is_table:
                        is_table = hasattr(stmt.this, 'key') and stmt.this.key == 'schema'
                    if is_table:
                        table_info = self._extract_table_info(stmt)
                        if table_info and table_info.get('columns'):
                            tables.append(table_info)
                elif stmt.key == 'alter':
                    relation = self._extract_relation(stmt)
                    if relation:
                        relations.append(relation)
            
            for table in tables:
                for fk in table.get('foreignKeys', []):
                    relations.append({
                        'from': table['name'],
                        'to': fk['references']['table'],
                        'type': 'foreign_key',
                        'column': fk['column'],
                        'references': fk['references']['column']
                    })
            
            implicit_relations = self._detect_implicit_relations(tables)
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
            
            result = {
                'tables': tables, 'relations': unique_relations, 'dialect': dialect,
                'totalTables': len(tables), 'totalRelations': len(unique_relations)
            }
        except Exception:
            result = self._fallback_parse(content)
            
        result['triggers'] = self._extract_triggers(content)
        result['procedures'] = self._extract_procedures(content)
        result['views'] = self._extract_views(content)
        return result
    
    def _extract_triggers(self, content: str) -> List[Dict[str, Any]]:
        triggers = []
        trigger_regex = re.compile(r'CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+(?:`|")?(\w+)(?:`|")?', re.IGNORECASE)
        for m in trigger_regex.finditer(content):
            triggers.append({
                'name': m.group(1),
                'action': m.group(2).upper(),
                'event': m.group(3).upper(),
                'table': m.group(4)
            })
        return triggers

    def _extract_procedures(self, content: str) -> List[Dict[str, Any]]:
        procedures = []
        proc_regex = re.compile(r'CREATE\s+PROCEDURE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(([\s\S]*?)\)', re.IGNORECASE)
        for m in proc_regex.finditer(content):
            procedures.append({
                'name': m.group(1),
                'parameters': re.sub(r'\s+', ' ', m.group(2)).strip()
            })
        return procedures

    def _extract_views(self, content: str) -> List[Dict[str, Any]]:
        views = []
        view_regex = re.compile(r'CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s+AS', re.IGNORECASE)
        for m in view_regex.finditer(content):
            views.append({
                'name': m.group(1)
            })
        return views

    def _detect_dialect(self, content: str) -> str:
        c = content.lower()
        # SQL Server
        if any(k in c for k in ('identity(', 'nvarchar', 'ntext', 'datetime2', 
                                 'datetimeoffset', 'smalldatetime', 'uniqueidentifier',
                                 'money', 'smallmoney', 'image', 'sql_variant')):
            return 'sqlserver'
        # SQLite
        if any(k in c for k in ('autoincrement', 'integer primary key')):
            return 'sqlite'
        # PostgreSQL
        if any(k in c for k in ('serial', 'bigserial', 'text', 'boolean', 'bytea',
                                 'jsonb', 'inet', 'macaddr', 'uuid', 'tsvector')):
            return 'postgres'
        # MySQL / MariaDB
        if any(k in c for k in ('auto_increment', 'engine=', 'charset=', 'collate=',
                                 'using btree', 'enum(')):
            return 'mysql'
        return 'mysql'
    
    def _extract_table_info(self, stmt) -> Dict[str, Any]:
        schema_expr = stmt.this
        if not schema_expr: return None
        if schema_expr.key == 'schema':
            table_name = str(schema_expr.this.this) if hasattr(schema_expr.this, 'this') else str(schema_expr.this)
            expressions = schema_expr.args.get('expressions', [])
        else:
            table_name = str(schema_expr.this)
            expressions = stmt.args.get('columns', [])
            
        columns, primary_keys, foreign_keys = [], [], []
        for part in expressions:
            if not part: continue
            if part.key == 'columndef':
                col_name = str(part.this.this) if hasattr(part.this, 'this') else str(part.this)
                col_type = self._get_column_type(part)
                nullable, auto_increment, primary_key = True, False, False
                for constraint in part.args.get('constraints', []):
                    kind = constraint.args.get('kind')
                    ctype = str(kind.key).lower() if kind and hasattr(kind, 'key') else str(kind).lower()
                    if 'not' in ctype: nullable = False
                    elif 'primary' in ctype:
                        primary_key = True
                        primary_keys.append(col_name)
                    elif 'auto' in ctype or 'identity' in ctype: auto_increment = True
                columns.append({'name': col_name, 'type': col_type, 'nullable': nullable, 'primaryKey': primary_key, 'autoIncrement': auto_increment})
            elif part.key == 'foreignkey':
                cols = [str(c.this) for c in part.args.get('expressions', [])]
                reference = part.args.get('reference')
                if reference and reference.this:
                    ref_table = str(reference.this.this.this) if hasattr(reference.this, 'this') and hasattr(reference.this.this, 'this') else str(reference.this.this)
                    ref_cols = [str(c.this) for c in reference.this.args.get('expressions', [])]
                    for col in cols:
                        foreign_keys.append({'column': col, 'references': {'table': ref_table, 'column': ref_cols[0] if ref_cols else 'id'}})
            elif part.key == 'primarykey':
                primary_keys.extend([str(c.this) for c in part.args.get('expressions', [])])

        primary_keys = list(dict.fromkeys(primary_keys))
        for col in columns:
            if col['name'] in primary_keys: col['primaryKey'] = True
        return {'name': table_name, 'columns': columns, 'primaryKeys': primary_keys, 'foreignKeys': foreign_keys}

    def _extract_relation(self, stmt) -> Dict[str, Any]:
        try:
            table_name = str(stmt.this.this) if hasattr(stmt.this, 'this') else str(stmt.this)
            for action in stmt.args.get('actions', []):
                kind = action.args.get('kind')
                if kind and kind.key == 'foreignkey':
                    cols = [str(c.this) for c in kind.args.get('expressions', [])]
                    ref = kind.args.get('reference')
                    if ref and ref.this:
                        ref_table = str(ref.this.this.this) if hasattr(ref.this, 'this') and hasattr(ref.this.this, 'this') else str(ref.this.this)
                        ref_cols = [str(c.this) for c in ref.this.args.get('expressions', [])]
                        return {'from': table_name, 'to': ref_table, 'type': 'foreign_key', 'column': cols[0] if cols else 'id', 'references': ref_cols[0] if ref_cols else 'id'}
        except: pass
        return None

    def _get_column_type(self, column_def) -> str:
        kind = column_def.args.get('kind', {})
        if hasattr(kind, 'this'):
            tname = str(kind.this)
            if tname.startswith('DType.'): tname = tname[6:]
            return f"ENUM({', '.join([str(e) for e in kind.args.get('expressions', [])])})" if tname.upper() == 'ENUM' else tname
        return 'VARCHAR'

    def _detect_implicit_relations(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        relations = []
        tnames = [t['name'] for t in tables]
        for table in tables:
            for col in table.get('columns', []):
                cname = col['name'].lower()
                if col.get('primaryKey'): continue
                ref = None
                if cname.startswith('id_'): ref = cname[3:]
                elif cname.endswith('_id'): ref = cname[:-3]
                elif cname.endswith('id') and len(cname) > 2: ref = cname[:-2]
                if ref:
                    match = self._find_best_table_match(ref, tnames)
                    if match and match != table['name']:
                        relations.append({'from': table['name'], 'to': match, 'type': 'implicit_foreign_key', 'column': col['name'], 'references': 'id'})
        return relations

    def _find_best_table_match(self, target: str, table_names: List[str]) -> str:
        tl = target.lower()
        for n in table_names:
            nl = n.lower()
            if nl == tl or nl == tl + 's' or nl == tl + 'es': return n
            if len(tl) > 3 and (tl in nl or nl in tl): return n
        return None
    
    def _fallback_parse(self, content: str) -> Dict[str, Any]:
        tables = []
        relations = []
        
        # Encontrar bloques de CREATE TABLE ... ( ... )
        # Usamos un regex para encontrar CREATE TABLE, capturando el nombre de la tabla y todo el bloque interior.
        # Manejamos los paréntesis anidados contando su profundidad.
        matches = list(re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?\s*\(', content, re.IGNORECASE))
        
        for i, match in enumerate(matches):
            table_name = match.group(1)
            start_pos = match.end()
            
            # Encontrar el paréntesis de cierre correspondiente
            paren_depth = 1
            end_pos = start_pos
            while paren_depth > 0 and end_pos < len(content):
                char = content[end_pos]
                if char == '(':
                    paren_depth += 1
                elif char == ')':
                    paren_depth -= 1
                end_pos += 1
            
            if paren_depth == 0:
                table_content = content[start_pos:end_pos-1]
                table_content = re.sub(r'/\*[\s\S]*?\*/', '', table_content) # Eliminar comentarios de bloque
                
                columns = []
                primary_keys = []
                foreign_keys = []
                
                # Dividir por comas respetando paréntesis anidados (ej. DECIMAL(10,2))
                parts = []
                current_part = []
                p_depth = 0
                for char in table_content:
                    if char == '(':
                        p_depth += 1
                    elif char == ')':
                        p_depth -= 1
                    
                    if char == ',' and p_depth == 0:
                        parts.append("".join(current_part).strip())
                        current_part = []
                    else:
                        current_part.append(char)
                if current_part:
                    parts.append("".join(current_part).strip())
                
                for line in parts:
                    line = re.sub(r'(--|#).*$', '', line).strip() # Eliminar comentarios de línea
                    if not line:
                        continue
                    upper_line = line.upper()
                    
                    # Ignorar PRIMARY KEY al final si es redundante, o capturar PKs compuestas
                    if upper_line.startswith('PRIMARY KEY'):
                        pk_match = re.search(r'PRIMARY\s+KEY\s*\((.*?)\)', line, re.IGNORECASE)
                        if pk_match:
                            pks = [p.strip().replace('`', '').replace('"', '') for p in pk_match.group(1).split(',')]
                            primary_keys.extend(pks)
                        continue
                        
                    if upper_line.startswith('KEY') or upper_line.startswith('INDEX') or upper_line.startswith('UNIQUE'):
                        continue
                        
                    if upper_line.startswith('CONSTRAINT') or upper_line.startswith('FOREIGN KEY'):
                        fk_match = re.search(r'FOREIGN\s+KEY\s*\((?:`|")?(\w+)(?:`|")?\)\s*REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)', line, re.IGNORECASE)
                        if fk_match:
                            col_name = fk_match.group(1)
                            ref_table = fk_match.group(2)
                            ref_col = fk_match.group(3)
                            foreign_keys.append({
                                'column': col_name,
                                'references': {'table': ref_table, 'column': ref_col}
                            })
                            relations.append({
                                'from': table_name,
                                'to': ref_table,
                                'type': 'foreign_key',
                                'column': col_name,
                                'references': ref_col
                            })
                        continue
                    
                    # Detectar relación en la misma línea de la columna (inline)
                    inline_fk_match = re.search(r'^(?:`|")?(\w+)(?:`|")?\s+[\w()]+\s+.*?REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)', line, re.IGNORECASE)
                    if inline_fk_match:
                        col_name = inline_fk_match.group(1)
                        ref_table = inline_fk_match.group(2)
                        ref_col = inline_fk_match.group(3)
                        foreign_keys.append({
                            'column': col_name,
                            'references': {'table': ref_table, 'column': ref_col}
                        })
                        relations.append({
                            'from': table_name,
                            'to': ref_table,
                            'type': 'foreign_key',
                            'column': col_name,
                            'references': ref_col
                        })
                    
                    # Parsear columna: nombre, tipo, constraints
                    col_match = re.match(r'^(?:`|")?(\w+)(?:`|")?\s+([A-Za-z0-9_]+(?:\([\s\S]*?\))?)(.*)$', line)
                    if col_match:
                        col_name = col_match.group(1)
                        col_type = col_match.group(2)
                        constraints = col_match.group(3) or ''
                        
                        nullable = not 'NOT NULL' in constraints.upper()
                        primary_key = 'PRIMARY KEY' in constraints.upper()
                        auto_increment = 'AUTO_INCREMENT' in constraints.upper() or 'IDENTITY' in constraints.upper()
                        
                        if primary_key:
                            primary_keys.append(col_name)
                            
                        columns.append({
                            'name': col_name,
                            'type': col_type.upper(),
                            'nullable': nullable,
                            'primaryKey': primary_key,
                            'autoIncrement': auto_increment
                        })
                
                # Consolidar PKs en las columnas
                primary_keys = list(dict.fromkeys(primary_keys))
                for col in columns:
                    if col['name'] in primary_keys:
                        col['primaryKey'] = True
                        
                tables.append({
                    'name': table_name,
                    'columns': columns,
                    'primaryKeys': primary_keys,
                    'foreignKeys': foreign_keys
                })
        
        # Buscar relaciones ALTER TABLE para llaves foráneas fuera de CREATE TABLE
        alter_table_regex = re.compile(r'ALTER\s+TABLE\s+(?:`|")?(\w+)(?:`|")?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\((?:`|")?(\w+)(?:`|")?\)\s*REFERENCES\s+(?:`|")?(\w+)(?:`|")?\s*\((?:`|")?(\w+)(?:`|")?\)', re.IGNORECASE)
        for alter_match in alter_table_regex.finditer(content):
            table_name = alter_match.group(1)
            col_name = alter_match.group(2)
            ref_table = alter_match.group(3)
            ref_col = alter_match.group(4)
            
            relations.append({
                'from': table_name,
                'to': ref_table,
                'type': 'foreign_key',
                'column': col_name,
                'references': ref_col
            })
            
            table = next((t for t in tables if t['name'] == table_name), None)
            if table:
                table['foreignKeys'].append({
                    'column': col_name,
                    'references': {'table': ref_table, 'column': ref_col}
                })
                
        # Consolidar y detectar relaciones implícitas
        implicit_relations = self._detect_implicit_relations(tables)
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
            'tables': tables, 'relations': unique_relations, 'dialect': self._detect_dialect(content),
            'totalTables': len(tables), 'totalRelations': len(unique_relations)
        }

    def validate_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        return {'isValid': True, 'errors': [], 'warnings': [], 'suggestions': []}

    def calculate_metrics(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        t = schema.get('tables', [])
        r = schema.get('relations', [])
        total_pks = sum(len(tab.get('primaryKeys', [])) for tab in t)
        total_fks = sum(len(tab.get('foreignKeys', [])) for tab in t)
        total_cols = sum(len(tab.get('columns', [])) for tab in t)
        return {
            'totalTables': len(t), 'totalRelations': len(r), 'totalColumns': total_cols,
            'totalPrimaryKeys': total_pks, 'totalForeignKeys': total_fks,
            'avgColumnsPerTable': round(total_cols / len(t), 1) if t else 0,
            'normalizationScore': self._calculate_norm(t),
            'format': schema.get('dialect', 'sql')
        }
    
    def _calculate_norm(self, tables: List[Dict[str, Any]]) -> float:
        if not tables: return 0.0
        score = sum(1 for t in tables if t.get('primaryKeys')) + sum(1 for t in tables if t.get('foreignKeys'))
        return round(float(min(100, (score / (len(tables) * 2)) * 100)), 2)

    def detect_anomalies(self, schema: Dict[str, Any]) -> List[Dict[str, Any]]:
        anomalies = []
        tables = schema.get('tables', [])
        
        for table in tables:
            name = table.get('name', 'unknown')
            columns = table.get('columns', [])
            pks = table.get('primaryKeys', [])
            fks = table.get('foreignKeys', [])
            
            # Regla 1: Identificar tablas sin Clave Primaria
            if not pks:
                anomalies.append({
                    'type': 'warning',
                    'severity': 'high',
                    'table': name,
                    'message': f"La tabla '{name}' no tiene Clave Primaria definida. Esto afecta gravemente el rendimiento y la integridad de los datos."
                })
                
            # Regla 2: Tablas con demasiadas columnas (Falta de Normalización)
            if len(columns) > 15:
                anomalies.append({
                    'type': 'optimization',
                    'severity': 'medium',
                    'table': name,
                    'message': f"La tabla '{name}' tiene {len(columns)} columnas. Es una cantidad elevada que sugiere falta de normalización. Se recomienda dividirla (1FN/2FN)."
                })
                
            # Regla 3: Identificar posibles relaciones huérfanas (nombres de columna sugerentes)
            for col in columns:
                col_name = col.get('name', '').lower()
                if ('id' in col_name or 'codigo' in col_name) and col_name not in [pk.lower() for pk in pks]:
                    has_fk = any(fk['column'].lower() == col_name for fk in fks)
                    if not has_fk:
                        anomalies.append({
                            'type': 'suggestion',
                            'severity': 'low',
                            'table': name,
                            'message': f"La columna '{col.get('name')}' parece ser una referencia externa, pero no tiene una llave foránea (FOREIGN KEY) explícita configurada."
                        })
                        
        # Regla 4: Bases de datos desconectadas (Tablas sin ninguna relación)
        if len(tables) > 1:
            all_referenced_tables = [fk['references']['table'].lower() for t in tables for fk in t.get('foreignKeys', [])]
            for table in tables:
                name_lower = table.get('name', '').lower()
                if not table.get('foreignKeys') and name_lower not in all_referenced_tables:
                    anomalies.append({
                        'type': 'isolation',
                        'severity': 'medium',
                        'table': table.get('name', ''),
                        'message': f"La tabla '{table.get('name')}' se encuentra aislada. No tiene relaciones de salida ni de entrada con el resto del esquema."
                    })

        return anomalies
