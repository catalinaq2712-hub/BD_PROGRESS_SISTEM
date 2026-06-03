"""
Generador de Diagramas ER con GraphViz y NetworkX
Crea diagramas Entidad-Relación automáticamente desde esquema
"""

import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch
import io
import base64
from typing import Dict, List, Any

class DiagramGenerator:
    def __init__(self):
        self.colors = {
            'table': '#E3F2FD',
            'primary_key': '#FFCDD2',
            'foreign_key': '#C8E6C9',
            'normal_field': '#FFFFFF',
            'relation': '#FFE0B2',
            'text': '#212121'
        }
    
    def generate_er_diagram(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Genera diagrama ER completo desde esquema"""
        try:
            # Crear grafo NetworkX
            G = nx.Graph()
            
            # Procesar tablas
            tables = schema.get('tables', [])
            table_positions = {}
            
            # Agregar nodos de tablas
            for i, table in enumerate(tables):
                table_name = table['name']
                G.add_node(table_name, 
                          type='table',
                          **table)
                
                # Posicionar en grid
                row = i // 3
                col = i % 3
                table_positions[table_name] = (col * 4, -row * 3)
            
            # Agregar relaciones
            relations = schema.get('relations', [])
            for relation in relations:
                # Soportar tanto 'from'/'to' como 'source'/'target'
                src = relation.get('from') or relation.get('source')
                tgt = relation.get('to') or relation.get('target')
                
                if src and tgt:
                    G.add_edge(src, 
                             tgt,
                             type='relation',
                             **relation)
            
            # Detectar relaciones implícitas (foreign keys)
            self._detect_implicit_relations(G, tables)
            
            # Generar visualización
            diagram_image = self._create_diagram_image(G, table_positions)
            mermaid_code = self._generate_mermaid_code(G, tables)
            
            return {
                'success': True,
                'image': diagram_image,
                'mermaid': mermaid_code,
                'stats': {
                    'totalTables': len(tables),
                    'totalRelations': G.number_of_edges(),
                    'connectedComponents': nx.number_connected_components(G)
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'fallback': self._generate_simple_diagram(schema)
            }
    
    def _detect_implicit_relations(self, G: nx.Graph, tables: List[Dict[str, Any]]):
        """Detecta relaciones implícitas desde foreign keys"""
        table_dict = {table['name']: table for table in tables}
        
        for table in tables:
            table_name = table['name']
            foreign_keys = table.get('foreignKeys', [])
            
            for fk in foreign_keys:
                if isinstance(fk, dict):
                    referenced_table = fk.get('references', {}).get('table')
                    if referenced_table and referenced_table in table_dict:
                        # Agregar relación si no existe
                        if not G.has_edge(table_name, referenced_table):
                            G.add_edge(table_name, 
                                     referenced_table,
                                     type='foreign_key',
                                     column=fk.get('column'),
                                     references=fk.get('references'))
    
    def _create_diagram_image(self, G: nx.Graph, positions: Dict[str, tuple]) -> str:
        """Crea imagen del diagrama y retorna base64"""
        plt.figure(figsize=(12, 8))
        plt.axis('off')
        
        # Dibujar grafo
        pos = positions if positions else nx.spring_layout(G, k=3, iterations=50)
        
        # Dibujar nodos (tablas)
        for node in G.nodes():
            node_data = G.nodes[node]
            if node_data.get('type') == 'table':
                self._draw_table_node(plt, node, node_data, pos[node])
        
        # Dibujar edges (relaciones)
        for edge in G.edges():
            edge_data = G.edges[edge]
            self._draw_relation_edge(plt, edge, edge_data, pos)
        
        # Guardar imagen en base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()
        
        return f"data:image/png;base64,{image_base64}"
    
    def _draw_table_node(self, plt, table_name: str, table_data: Dict, position: tuple):
        """Dibuja una tabla en el diagrama"""
        x, y = position
        
        # Obtener columnas
        columns = table_data.get('columns', [])
        primary_keys = table_data.get('primaryKeys', [])
        
        # Calcular dimensiones
        max_col_length = max([len(col.get('name', '')) for col in columns] + [len(table_name)])
        width = max(max_col_length * 0.1, 2.0)
        height = 0.5 + len(columns) * 0.3
        
        # Dibujar rectángulo de la tabla
        rect = FancyBboxPatch((x - width/2, y - height/2), 
                             width, height,
                             boxstyle="round,pad=0.05",
                             facecolor=self.colors['table'],
                             edgecolor='black',
                             linewidth=1)
        plt.gca().add_patch(rect)
        
        # Dibujar nombre de tabla (negrita)
        plt.text(x, y + height/2 - 0.2, table_name,
                ha='center', va='top', fontweight='bold', fontsize=10)
        
        # Dibujar línea separadora
        plt.plot([x - width/2 + 0.1, x + width/2 - 0.1], 
                [y + height/2 - 0.4, y + height/2 - 0.4], 
                'k-', linewidth=1)
        
        # Dibujar columnas
        for i, col in enumerate(columns):
            col_y = y + height/2 - 0.6 - i * 0.3
            col_name = col.get('name', '')
            
            # Color según tipo
            if col.get('primaryKey') or col_name in primary_keys:
                color = self.colors['primary_key']
                symbol = '🔑'
            elif col.get('foreignKey'):
                color = self.colors['foreign_key']
                symbol = '🔗'
            else:
                color = self.colors['normal_field']
                symbol = ''
            
            # Dibujar fondo de columna
            col_rect = patches.Rectangle((x - width/2 + 0.05, col_y - 0.1), 
                                     width - 0.1, 0.2,
                                     facecolor=color, alpha=0.3)
            plt.gca().add_patch(col_rect)
            
            # Dibujar texto de columna
            plt.text(x - width/2 + 0.15, col_y, f"{symbol} {col_name}",
                    ha='left', va='center', fontsize=8)
    
    def _draw_relation_edge(self, plt, edge: tuple, edge_data: Dict, positions: Dict):
        """Dibuja una relación entre tablas"""
        source, target = edge
        x1, y1 = positions[source]
        x2, y2 = positions[target]
        
        # Dibujar línea
        plt.plot([x1, x2], [y1, y2], 'b-', linewidth=2, alpha=0.7)
        
        # Dibujar etiqueta de relación
        if edge_data.get('type') == 'foreign_key':
            mid_x, mid_y = (x1 + x2) / 2, (y1 + y2) / 2
            plt.text(mid_x, mid_y, edge_data.get('column', ''),
                    ha='center', va='bottom', fontsize=7, 
                    bbox=dict(boxstyle="round,pad=0.2", facecolor='white', alpha=0.8))
    
    def _generate_mermaid_code(self, G: nx.Graph, tables: List[Dict[str, Any]]) -> str:
        """Genera código Mermaid para el diagrama"""
        mermaid_lines = ["erDiagram"]
        
        # Generar definiciones de tablas
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            primary_keys = table.get('primaryKeys', [])
            
            # Construir línea de tabla
            col_lines = []
            for col in columns:
                col_name = col.get('name', '')
                col_type = col.get('type', 'VARCHAR')
                
                # Símbolos de clave
                if col.get('primaryKey') or col_name in primary_keys:
                    col_name = f"PK {col_name}"
                elif col.get('foreignKey'):
                    col_name = f"FK {col_name}"
                
                col_lines.append(f"    {col_name} {col_type}")
            
            if col_lines:
                mermaid_lines.append(f"    {table_name} {{")
                mermaid_lines.extend(col_lines)
                mermaid_lines.append("    }")
        
        # Generar relaciones
        for edge in G.edges():
            source, target = edge
            edge_data = G.edges[edge]
            
            if edge_data.get('type') in ['relation', 'foreign_key']:
                relation_type = edge_data.get('type', 'relates to')
                mermaid_lines.append(f"    {source} ||--o| {target} : {relation_type}")
        
        return "\n".join(mermaid_lines)
    
    def _generate_simple_diagram(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Genera diagrama simple como fallback"""
        tables = schema.get('tables', [])
        
        # Generar Mermaid básico
        mermaid_lines = ["erDiagram"]
        
        for table in tables:
            table_name = table['name']
            columns = table.get('columns', [])
            
            if columns:
                mermaid_lines.append(f"    {table_name} {{")
                for col in columns[:5]:  # Limitar a 5 columnas
                    col_name = col.get('name', 'unknown')
                    col_type = col.get('type', 'VARCHAR')
                    mermaid_lines.append(f"        {col_name} {col_type}")
                if len(columns) > 5:
                    mermaid_lines.append(f"        ... ({len(columns) - 5} more columns)")
                mermaid_lines.append("    }")
        
        return {
            'success': True,
            'image': None,
            'mermaid': "\n".join(mermaid_lines),
            'stats': {
                'totalTables': len(tables),
                'totalRelations': 0,
                'connectedComponents': len(tables)
            }
        }
    
    def generate_relationship_matrix(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Genera matriz de relaciones entre tablas"""
        tables = schema.get('tables', [])
        table_names = [table['name'] for table in tables]
        
        # Crear matriz vacía
        matrix = {}
        for table1 in table_names:
            matrix[table1] = {}
            for table2 in table_names:
                matrix[table1][table2] = 0
        
        # Llenar matriz con relaciones
        relations = schema.get('relations', [])
        for relation in relations:
            source = relation.get('source')
            target = relation.get('target')
            if source and target and source in matrix and target in matrix[source]:
                matrix[source][target] = 1
                matrix[target][source] = 1  # Relación bidireccional
        
        return {
            'matrix': matrix,
            'tableNames': table_names,
            'totalRelations': len(relations)
        }
