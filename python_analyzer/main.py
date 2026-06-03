#!/usr/bin/env python3
import os
import sys
import io
import warnings

# Asegurar que el directorio de este script esté en el sys.path para importaciones correctas
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# Forzar salida en UTF-8 para evitar problemas de caracteres () en Windows Node.js
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Suprimir TODAS las advertencias y logs ruidosos antes de importar nada más
warnings.filterwarnings("ignore")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['QT_LOGGING_RULES'] = '*.debug=false;*.warning=false'

# Configurar backend de Matplotlib para que no intente abrir ventanas (entorno servidor)
import matplotlib
matplotlib.use('Agg')

import argparse
import json
from pathlib import Path

# Importar analizadores
try:
    from analyzers.sql_analyzer import SQLAnalyzer
    from analyzers.nosql_analyzer import NoSQLAnalyzer
    from analyzers.diagram_generator import DiagramGenerator
    from analyzers.schema_converter import SchemaConverter
    from analyzers.data_generator import generate_test_data
except ImportError as e:
    print(json.dumps({
        'success': False, 
        'error': f"Faltan dependencias de Python: {str(e)}. Por favor ejecuta: pip install sqlglot pandas matplotlib networkx pyyaml jsonschema"
    }))
    sys.exit(0) # Salida limpia para que el server capture el JSON

class DatabaseAnalyzer:
    def __init__(self):
        self.sql_analyzer = SQLAnalyzer()
        self.nosql_analyzer = NoSQLAnalyzer()
        self.diagram_generator = DiagramGenerator()
        self.schema_converter = SchemaConverter()
    
    def analyze_file(self, file_path: str) -> dict:
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"Archivo no encontrado: {file_path}")
            
            file_extension = file_path.suffix.lower()
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            result = {
                'fileName': file_path.name,
                'fileType': file_extension,
                'success': True,
                'analysis': {}
            }
            
            if file_extension in ['.sql', '.txt']:
                result['analysis'] = self._analyze_sql(content)
            elif file_extension == '.dbml':
                result['analysis'] = self._analyze_dbml(content)
            elif file_extension == '.json':
                result['analysis'] = self._analyze_json(content)
            elif file_extension in ['.yaml', '.yml']:
                result['analysis'] = self._analyze_yaml(content)
            elif file_extension == '.csv':
                result['analysis'] = self._analyze_csv(file_path)
            elif file_extension in ['.xlsx', '.xls']:
                result['analysis'] = self._analyze_excel(file_path)
            else:
                raise ValueError(f"Tipo de archivo no soportado: {file_extension}")
            
            # Generar diagrama ER
            result['analysis']['diagram'] = self.diagram_generator.generate_er_diagram(
                result['analysis']['schema']
            )
            
            # Generar conversiones básicas
            result['analysis']['conversions'] = self.schema_converter.generate_conversions(
                result['analysis']['schema']
            )
            
            # Generar la Opinión del sistema (Heurísticas, sin IA)
            result['analysis']['opinion'] = self._generate_opinion(
                result['analysis'].get('metrics', {}),
                result['analysis'].get('anomalies', []),
                file_extension
            )
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'fileName': file_path.name if 'file_path' in locals() else 'unknown'
            }
    
    def _analyze_sql(self, content: str) -> dict:
        schema = self.sql_analyzer.parse_sql(content)
        return {
            'schema': schema,
            'type': 'sql',
            'validation': self.sql_analyzer.validate_schema(schema),
            'metrics': self.sql_analyzer.calculate_metrics(schema),
            'anomalies': self.sql_analyzer.detect_anomalies(schema)
        }
    def _analyze_dbml(self, content: str) -> dict:
        schema = self.sql_analyzer.parse_dbml(content)
        return {
            'schema': schema,
            'type': 'sql',
            'validation': self.sql_analyzer.validate_schema(schema),
            'metrics': self.sql_analyzer.calculate_metrics(schema),
            'anomalies': self.sql_analyzer.detect_anomalies(schema)
        }

    def _analyze_csv(self, file_path: Path) -> dict:
        schema = self.nosql_analyzer.parse_csv(file_path)
        return {
            'schema': schema,
            'type': 'nosql',
            'validation': self.nosql_analyzer.validate_schema(schema),
            'metrics': self.nosql_analyzer.calculate_metrics(schema),
            'anomalies': self.nosql_analyzer.detect_anomalies(schema)
        }
    
    def _analyze_json(self, content: str) -> dict:
        schema = self.nosql_analyzer.parse_json(content)
        return {
            'schema': schema,
            'type': 'nosql',
            'validation': self.nosql_analyzer.validate_schema(schema),
            'metrics': self.nosql_analyzer.calculate_metrics(schema),
            'anomalies': self.nosql_analyzer.detect_anomalies(schema)
        }
    
    def _analyze_yaml(self, content: str) -> dict:
        schema = self.nosql_analyzer.parse_yaml(content)
        return {
            'schema': schema,
            'type': 'nosql',
            'validation': self.nosql_analyzer.validate_schema(schema),
            'metrics': self.nosql_analyzer.calculate_metrics(schema),
            'anomalies': self.nosql_analyzer.detect_anomalies(schema)
        }
    
    def _analyze_excel(self, file_path: Path) -> dict:
        schema = self.nosql_analyzer.parse_excel(file_path)
        return {
            'schema': schema,
            'type': 'excel',
            'validation': self.nosql_analyzer.validate_schema(schema),
            'metrics': self.nosql_analyzer.calculate_metrics(schema),
            'anomalies': self.nosql_analyzer.detect_anomalies(schema)
        }

    def _generate_opinion(self, metrics: dict, anomalies: list, format_type: str) -> str:
        """
        Genera un párrafo de opinión estilo IA basado en las métricas y anomalías.
        """
        total_tables = metrics.get('totalTables', 0)
        
        opinion = f"He completado el análisis de la base de datos ({format_type.upper()}). "
        
        if total_tables == 0:
            return opinion + "Sin embargo, no pude detectar ninguna tabla o colección válida en la estructura."
            
        opinion += f"El esquema contiene un total de {total_tables} entidades (tablas/colecciones). "
        
        # Analizar salud general
        if not anomalies:
            opinion += "El esquema parece estar perfectamente normalizado y no he detectado anomalías estructurales ni problemas de integridad. ¡Excelente trabajo! "
        else:
            high_sev = [a for a in anomalies if a.get('severity') == 'high']
            med_sev = [a for a in anomalies if a.get('severity') == 'medium']
            
            if high_sev:
                opinion += f"Se han detectado {len(high_sev)} problemas críticos de alta severidad que deberían solucionarse inmediatamente para garantizar la integridad referencial y de datos. "
            if med_sev:
                opinion += f"Además, hay {len(med_sev)} oportunidades de optimización y normalización que sugiero revisar. "
                
        # Detalle específico si hay anomalías
        if anomalies:
            opinion += "Entre los hallazgos principales destacan: "
            # Tomar hasta 3 anomalías representativas
            for i, anomaly in enumerate(anomalies[:3]):
                opinion += f" {i+1}) En '{anomaly.get('table', 'unknown')}': {anomaly.get('message', '')}."
                
        opinion += " Te recomiendo revisar el listado completo de anomalías abajo para mejorar la salud general de la estructura de datos."
        return opinion

def main():
    parser = argparse.ArgumentParser(description='Analizador de Bases de Datos con Python')
    parser.add_argument('--file', help='Ruta del archivo a analizar')
    parser.add_argument('--generate-data', action='store_true', help='Modo generador de datos de prueba')
    args = parser.parse_args()
    
    # Modo generador de datos de prueba
    if args.generate_data:
        try:
            input_data = sys.stdin.read()
            payload = json.loads(input_data)
            schema = payload.get('schema', {})
            config = payload.get('config', {})
            result = generate_test_data(schema, config)
            print(json.dumps({
                'success': True,
                'data': result
            }, indent=2, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': str(e)
            }, indent=2, ensure_ascii=False))
        return
    
    if not args.file:
        parser.print_help()
        sys.exit(1)
    
    analyzer = DatabaseAnalyzer()
    result = analyzer.analyze_file(args.file)
    
    # Salida JSON ÚNICA Y LIMPIA
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
