from flask import Flask, request, jsonify
import sys
import os
import tempfile
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from python_analyzer.main import DatabaseAnalyzer
except ImportError:
    # Fallback to absolute or relative imports if needed
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from python_analyzer.main import DatabaseAnalyzer

app = Flask(__name__)

@app.route('/api/analyze_python', methods=['POST'])
def analyze():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No se ha subido ningún archivo'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Archivo sin nombre'}), 400
            
        # Save uploaded file to a temporary location
        suffix = Path(file.filename).suffix.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
            
        # Run database analyzer
        analyzer = DatabaseAnalyzer()
        result = analyzer.analyze_file(temp_path)
        
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
