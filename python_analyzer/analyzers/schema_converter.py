"""
Convertidor de Esquemas Multi-formato con Python
Convierte entre SQL, NoSQL, JSON, YAML, Excel y otros formatos
"""

import json
import yaml
import pandas as pd
from typing import Dict, List, Any
import sqlglot

class SchemaConverter:
    def __init__(self):
        self.supported_formats = [
            'mysql', 'postgres', 'sqlite', 'mongodb', 
            'json', 'yaml', 'csv', 'prisma', 'graphql'
        ]
    
    def generate_conversions(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Genera conversiones a múltiples formatos"""
        conversions = {}
        tables = schema.get('tables', [])
        
        if not tables:
            return {'error': 'No tables found for conversion'}
        
        # Generar conversiones SQL
        conversions['mysql'] = self._convert_to_mysql(tables)
        conversions['postgres'] = self._convert_to_postgres(tables)
        conversions['sqlite'] = self._convert_to_sqlite(tables)
        
        # Generar conversiones NoSQL
        conversions['mongodb'] = self._convert_to_mongodb(tables)
        conversions['json_schema'] = self._convert_to_json_schema(tables)
        
        # Generar formatos modernos
        conversions['prisma'] = self._convert_to_prisma(tables)
        conversions['graphql'] = self._convert_to_graphql(tables)
        
        # Generar CSV/Excel
        conversions['csv'] = self._convert_to_csv(tables)
        conversions['yaml'] = self._convert_to_yaml(tables)
        
        # Generar formato para visualización (JSON Crack / JSONC)
        conversions['json_crack'] = self._convert_to_json_crack(tables)
        
        return {
            'success': True,
            'formats': conversions,
            'availableFormats': list(conversions.keys())
        }
    
    def _convert_to_mysql(self, tables: List[Dict[str, Any]]) -> str:
        """Convierte a MySQL SQL"""
        sql_statements = []
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            primary_keys = table.get('primaryKeys', [])
            
            # CREATE TABLE
            sql_lines = [f"CREATE TABLE `{table_name}` ("]
            
            # Columnas
            for i, col in enumerate(columns):
                col_name = col['name']
                col_type = self._map_type_to_mysql(col['type'])
                nullable = "NOT NULL" if not col.get('nullable', True) else "NULL"
                
                auto_increment = ""
                if col.get('autoIncrement', False):
                    # En MySQL, AUTO_INCREMENT requiere un tipo numérico entero
                    if col_type.upper() not in ('INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT'):
                        col_type = 'INT'
                    auto_increment = "AUTO_INCREMENT"
                
                col_def = f"    `{col_name}` {col_type} {nullable} {auto_increment}"
                if i < len(columns) - 1:
                    col_def += ","
                
                sql_lines.append(col_def)
            
            # Primary Key
            if primary_keys:
                pk_cols = ", ".join([f"`{pk}`" for pk in primary_keys])
                sql_lines.append(f",    PRIMARY KEY ({pk_cols})")
            
            sql_lines.append(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;")
            sql_statements.append("\n".join(sql_lines))
        
        return "\n\n".join(sql_statements)
    
    def _convert_to_postgres(self, tables: List[Dict[str, Any]]) -> str:
        """Convierte a PostgreSQL SQL"""
        sql_statements = []
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            primary_keys = table.get('primaryKeys', [])
            
            sql_lines = [f"CREATE TABLE {table_name} ("]
            
            # Columnas
            for i, col in enumerate(columns):
                col_name = col['name']
                col_type = self._map_type_to_postgres(col['type'])
                nullable = "NOT NULL" if not col.get('nullable', True) else "NULL"
                
                # PostgreSQL auto-increment requiere SERIAL
                if col.get('autoIncrement', False):
                    if col_type.upper() == 'BIGINT':
                        col_type = 'BIGSERIAL'
                    else:
                        col_type = 'SERIAL'
                    # SERIAL en PG es implícitamente NOT NULL y autoincremental
                    nullable = ""
                
                col_def = f"    {col_name} {col_type} {nullable}".strip()
                if i < len(columns) - 1:
                    col_def += ","
                
                sql_lines.append(col_def)
            
            # Primary Key
            if primary_keys:
                pk_cols = ", ".join(primary_keys)
                sql_lines.append(f",    PRIMARY KEY ({pk_cols})")
            
            sql_lines.append(");")
            sql_statements.append("\n".join(sql_lines))
        
        return "\n\n".join(sql_statements)
    
    def _convert_to_sqlite(self, tables: List[Dict[str, Any]]) -> str:
        """Convierte a SQLite SQL"""
        sql_statements = []
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            primary_keys = table.get('primaryKeys', [])
            
            sql_lines = [f"CREATE TABLE {table_name} ("]
            
            # Columnas
            for i, col in enumerate(columns):
                col_name = col['name']
                col_type = self._map_type_to_sqlite(col['type'])
                nullable = "NOT NULL" if not col.get('nullable', True) else "NULL"
                
                # SQLite AUTO_INCREMENT
                if col.get('autoIncrement', False) and col_name in primary_keys:
                    col_type = "INTEGER PRIMARY KEY AUTOINCREMENT"
                    nullable = ""
                
                col_def = f"    {col_name} {col_type} {nullable}"
                if i < len(columns) - 1:
                    col_def += ","
                
                sql_lines.append(col_def)
            
            # Primary Key (si no se definió como AUTOINCREMENT)
            if primary_keys and not any(col.get('autoIncrement', False) for col in columns if col['name'] in primary_keys):
                pk_cols = ", ".join(primary_keys)
                sql_lines.append(f",    PRIMARY KEY ({pk_cols})")
            
            sql_lines.append(");")
            sql_statements.append("\n".join(sql_lines))
        
        return "\n\n".join(sql_statements)
    
    def _convert_to_mongodb(self, tables: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Convierte a MongoDB schema"""
        mongodb_schema = {}
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            
            # Crear schema Mongoose-style
            schema_def = {}
            indexes = []
            
            for col in columns:
                col_name = col['name']
                col_type = self._map_type_to_mongodb(col['type'])
                required = not col.get('nullable', True)
                
                field_def = {'type': col_type}
                if required:
                    field_def['required'] = True
                
                # Special cases
                if col.get('primaryKey', False):
                    field_def['unique'] = True
                    indexes.append({'field': col_name, 'unique': True})
                
                schema_def[col_name] = field_def
            
            mongodb_schema[table_name] = {
                'schema': schema_def,
                'indexes': indexes,
                'collection': table_name
            }
        
        return mongodb_schema
    
    def _convert_to_json_schema(self, tables: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Convierte a JSON Schema"""
        json_schema = {
            '$schema': 'http://json-schema.org/draft-07/schema#',
            'type': 'object',
            'properties': {},
            'definitions': {}
        }
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            
            # Definir tabla como definición
            table_schema = {
                'type': 'object',
                'properties': {},
                'required': []
            }
            
            for col in columns:
                col_name = col['name']
                col_type = self._map_type_to_json_schema(col['type'])
                required = not col.get('nullable', True)
                
                table_schema['properties'][col_name] = col_type
                if required:
                    table_schema['required'].append(col_name)
            
            json_schema['definitions'][table_name] = table_schema
            
            # Agregar referencia en properties principal para cada tabla
            json_schema['properties'][table_name] = {
                '$ref': f'#/definitions/{table_name}'
            }
        
        return json_schema
    
    def _convert_to_prisma(self, tables: List[Dict[str, Any]]) -> str:
        """Convierte a Prisma schema"""
        prisma_lines = []
        
        # Agregar datasource (genérico)
        prisma_lines.extend([
            "datasource db {",
            "  provider = \"postgresql\"",
            "  url      = env(\"DATABASE_URL\")",
            "}",
            ""
        ])
        
        # Generar modelos
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            primary_keys = table.get('primaryKeys', [])
            
            prisma_lines.append(f"model {table_name} {{")
            
            for col in columns:
                col_name = col['name']
                col_type = self._map_type_to_prisma(col['type'])
                
                # Modificadores Prisma
                modifiers = []
                if not col.get('nullable', True):
                    modifiers.append("@default(now())" if col_type == "DateTime" else "")
                
                if col.get('primaryKey', False) or col_name in primary_keys:
                    modifiers.append("@id")
                
                if col.get('autoIncrement', False):
                    modifiers.append("@default(autoincrement())")
                
                # Limpiar modificadores vacíos
                modifiers = [m for m in modifiers if m]
                modifier_str = " ".join(modifiers)
                modifier_str = f" {modifier_str}" if modifier_str else ""
                
                nullable_str = "" if not col.get('nullable', True) else "?"
                
                prisma_lines.append(f"  {col_name} {col_type}{nullable_str}{modifier_str}")
            
            prisma_lines.append("}")
            prisma_lines.append("")
        
        return "\n".join(prisma_lines)
    
    def _convert_to_graphql(self, tables: List[Dict[str, Any]]) -> str:
        """Convierte a GraphQL SDL"""
        graphql_lines = []
        
        # Generar tipos para cada tabla
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            primary_keys = table.get('primaryKeys', [])
            
            # Capitalizar nombre del tipo
            type_name = table_name.capitalize() + "Type"
            
            graphql_lines.append(f"type {type_name} {{")
            
            for col in columns:
                col_name = col['name']
                col_type = self._map_type_to_graphql(col['type'])
                
                # Non-null si no es nullable
                non_null = "!" if not col.get('nullable', True) else ""
                
                graphql_lines.append(f"  {col_name}: {col_type}{non_null}")
            
            graphql_lines.append("}")
            graphql_lines.append("")
        
        # Generar Query type
        graphql_lines.extend([
            "type Query {",
            "  # Add your queries here",
            "}"
        ])
        
        # Generar Mutation type
        graphql_lines.extend([
            "",
            "type Mutation {",
            "  # Add your mutations here",
            "}"
        ])
        
        return "\n".join(graphql_lines)
    
    def _convert_to_csv(self, tables: List[Dict[str, Any]]) -> Dict[str, str]:
        """Convierte a formato CSV (solo estructura)"""
        csv_data = {}
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            
            # Crear CSV con nombres de columnas y tipos
            csv_lines = ["column_name,type,nullable,primary_key"]
            
            for col in columns:
                col_name = col['name']
                col_type = col['type']
                nullable = str(col.get('nullable', True)).lower()
                primary_key = str(col.get('primaryKey', False)).lower()
                
                csv_lines.append(f"{col_name},{col_type},{nullable},{primary_key}")
            
            csv_data[table_name] = "\n".join(csv_lines)
        
        return csv_data
    
    def _convert_to_yaml(self, tables: List[Dict[str, Any]]) -> str:
        """Convierte a YAML"""
        yaml_data = {'tables': {}}
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            
            table_def = {
                'columns': [],
                'primaryKeys': table.get('primaryKeys', []),
                'foreignKeys': table.get('foreignKeys', [])
            }
            
            for col in columns:
                table_def['columns'].append({
                    'name': col['name'],
                    'type': col['type'],
                    'nullable': col.get('nullable', True),
                    'primaryKey': col.get('primaryKey', False),
                    'autoIncrement': col.get('autoIncrement', False)
                })
            
            yaml_data['tables'][table_name] = table_def
        
        return yaml.dump(yaml_data, default_flow_style=False, sort_keys=False)

    def _convert_to_json_crack(self, tables: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Convierte a un formato optimizado para JSON Crack (JSON con estructura clara)
        A menudo los usuarios lo llaman JSONC por su legibilidad.
        """
        crack_data = {}
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            
            # Formatear columnas como un objeto para que JSON Crack las muestre mejor
            cols_def = {}
            for col in columns:
                props = [col['type']]
                if col.get('primaryKey'): props.append('PK')
                if not col.get('nullable'): props.append('NOT NULL')
                if col.get('autoIncrement'): props.append('AUTO')
                
                cols_def[col['name']] = " | ".join(props)
            
            crack_data[table_name] = {
                "FIELDS": cols_def,
                "METADATA": {
                    "primary_keys": table.get('primaryKeys', []),
                    "foreign_keys": [
                        f"{fk['column']} -> {fk['references']['table']}({fk['references']['column']})"
                        for fk in table.get('foreignKeys', [])
                        if isinstance(fk, dict) and 'references' in fk
                    ]
                }
            }
            
        return crack_data
    
    # Mapeos de tipos
    def _map_type_to_mysql(self, type_str: str) -> str:
        """Mapea tipo genérico a MySQL"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': 'INT',
            'BIGINT': 'BIGINT',
            'SMALLINT': 'SMALLINT',
            'FLOAT': 'FLOAT',
            'DOUBLE': 'DOUBLE',
            'DECIMAL': 'DECIMAL',
            'BOOLEAN': 'BOOLEAN',
            'STRING': 'VARCHAR(255)',
            'TEXT': 'TEXT',
            'DATETIME': 'DATETIME',
            'DATE': 'DATE',
            'TIME': 'TIME',
            'JSON': 'JSON'
        }
        
        return mapping.get(type_str, 'VARCHAR(255)')
    
    def _map_type_to_postgres(self, type_str: str) -> str:
        """Mapea tipo genérico a PostgreSQL"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': 'INTEGER',
            'BIGINT': 'BIGINT',
            'SMALLINT': 'SMALLINT',
            'FLOAT': 'FLOAT',
            'DOUBLE': 'DOUBLE PRECISION',
            'DECIMAL': 'DECIMAL',
            'BOOLEAN': 'BOOLEAN',
            'STRING': 'VARCHAR(255)',
            'TEXT': 'TEXT',
            'DATETIME': 'TIMESTAMP',
            'DATE': 'DATE',
            'TIME': 'TIME',
            'JSON': 'JSONB'
        }
        
        return mapping.get(type_str, 'VARCHAR(255)')
    
    def _map_type_to_sqlite(self, type_str: str) -> str:
        """Mapea tipo genérico a SQLite"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': 'INTEGER',
            'BIGINT': 'INTEGER',
            'SMALLINT': 'INTEGER',
            'FLOAT': 'REAL',
            'DOUBLE': 'REAL',
            'DECIMAL': 'REAL',
            'BOOLEAN': 'INTEGER',
            'STRING': 'TEXT',
            'TEXT': 'TEXT',
            'DATETIME': 'DATETIME',
            'DATE': 'DATE',
            'TIME': 'TIME',
            'JSON': 'TEXT'
        }
        
        return mapping.get(type_str, 'TEXT')
    
    def _map_type_to_mongodb(self, type_str: str) -> str:
        """Mapea tipo genérico a MongoDB/Mongoose"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': 'Number',
            'BIGINT': 'Number',
            'SMALLINT': 'Number',
            'FLOAT': 'Number',
            'DOUBLE': 'Number',
            'DECIMAL': 'Number',
            'BOOLEAN': 'Boolean',
            'STRING': 'String',
            'TEXT': 'String',
            'DATETIME': 'Date',
            'DATE': 'Date',
            'TIME': 'Date',
            'JSON': 'Mixed'
        }
        
        return mapping.get(type_str, 'String')
    
    def _map_type_to_json_schema(self, type_str: str) -> Dict[str, str]:
        """Mapea tipo genérico a JSON Schema"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': {'type': 'integer'},
            'BIGINT': {'type': 'integer'},
            'SMALLINT': {'type': 'integer'},
            'FLOAT': {'type': 'number'},
            'DOUBLE': {'type': 'number'},
            'DECIMAL': {'type': 'number'},
            'BOOLEAN': {'type': 'boolean'},
            'STRING': {'type': 'string'},
            'TEXT': {'type': 'string'},
            'DATETIME': {'type': 'string', 'format': 'date-time'},
            'DATE': {'type': 'string', 'format': 'date'},
            'TIME': {'type': 'string', 'format': 'time'},
            'JSON': {'type': 'object'}
        }
        
        return mapping.get(type_str, {'type': 'string'})
    
    def _map_type_to_prisma(self, type_str: str) -> str:
        """Mapea tipo genérico a Prisma"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': 'Int',
            'BIGINT': 'BigInt',
            'SMALLINT': 'Int',
            'FLOAT': 'Float',
            'DOUBLE': 'Float',
            'DECIMAL': 'Decimal',
            'BOOLEAN': 'Boolean',
            'STRING': 'String',
            'TEXT': 'String',
            'DATETIME': 'DateTime',
            'DATE': 'DateTime',
            'TIME': 'DateTime',
            'JSON': 'Json'
        }
        
        return mapping.get(type_str, 'String')
    
    def _map_type_to_graphql(self, type_str: str) -> str:
        """Mapea tipo genérico a GraphQL"""
        type_str = type_str.upper()
        
        mapping = {
            'INTEGER': 'Int',
            'BIGINT': 'Int',
            'SMALLINT': 'Int',
            'FLOAT': 'Float',
            'DOUBLE': 'Float',
            'DECIMAL': 'Float',
            'BOOLEAN': 'Boolean',
            'STRING': 'String',
            'TEXT': 'String',
            'DATETIME': 'String',
            'DATE': 'String',
            'TIME': 'String',
            'JSON': 'String'
        }
        
        return mapping.get(type_str, 'String')
