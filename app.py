import os
import time
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from utils import database, chakra_utils

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config.from_pyfile('config.py', silent=True)

# Ensure directories exist
database.init_db()
UPLOAD_DIR = os.path.join(app.static_folder, 'audio', 'uploads')
PROJECTS_DIR = os.path.join(app.static_folder, 'projects')
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)

# ---------- Page Routes ----------
@app.route('/')
def index():
    return render_template('index.html', title="Racksson — Music of the Universe")

@app.route('/studio_pro')
def studio_pro():
    return render_template('studio_pro.html', title="Studio Pro")

@app.route('/dashboard')
def dashboard():
    return render_template('studio_pro.html', title="Dashboard")

@app.route('/recorder')
def recorder():
    return render_template('recorder.html', title="Recorder")

@app.route('/mixer')
def mixer():
    return render_template('mixer.html', title="Mixer")

@app.route('/harmonizer')
def harmonizer():
    return render_template('harmonizer.html', title="Harmonizer")

@app.route('/harmonizer-fx')
def harmonizer_fx():
    return render_template('harmonizer-fx.html', title="Harmonizer FX")

@app.route('/instrumentals')
def instrumentals():
    return render_template('instrumentals.html', title="Instrumentals")

# ---------- API Routes ----------
@app.route('/api/save-recording', methods=['POST'])
def api_save_recording():
    if 'audio_data' not in request.files:
        return jsonify({'error': 'no file provided'}), 400
    f = request.files['audio_data']
    filename = f"recording_{int(time.time())}_{secure_filename(f.filename)}"
    path = os.path.join(UPLOAD_DIR, filename)
    f.save(path)
    metadata = {
        'title': request.form.get('title', ''),
        'chakra_frequency': request.form.get('chakra_frequency', '')
    }
    database.save_recording(metadata, filename)
    return jsonify({'status': 'ok', 'filename': filename})

@app.route('/api/save-project', methods=['POST'])
def api_save_project():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'error': 'no data'}), 400
        name = secure_filename(data.get('name', 'project'))
        ts = int(time.time())
        filename = f"{name}_{ts}.json"
        filepath = os.path.join(PROJECTS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        pid = database.save_project(name, json.dumps(data))
        return jsonify({'status': 'ok', 'filename': filename, 'id': pid})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects', methods=['GET'])
def api_projects():
    files = []
    for fn in sorted(os.listdir(PROJECTS_DIR), reverse=True):
        if fn.endswith('.json'):
            files.append({'filename': fn, 'path': f'/static/projects/{fn}'})
    db_projects = database.list_projects()
    return jsonify({'files': files, 'db': db_projects})

@app.route('/api/chakra-frequency', methods=['GET'])
def api_chakra_frequency():
    chakra = request.args.get('chakra', 'heart')
    freq = chakra_utils.get_chakra_frequency(chakra)
    return jsonify({'chakra': chakra, 'frequency': freq})

# ---------- PWA & Static Assets ----------
@app.route('/manifest.webmanifest')
def manifest():
    return send_from_directory(app.static_folder, 'manifest.webmanifest')

@app.route('/sw.js')
def service_worker():
    return send_from_directory(app.static_folder, 'sw.js')

# ---------- Run Server ----------
if __name__ == '__main__':
    app.run(
        host=app.config.get('HOST', '0.0.0.0'),
        port=int(app.config.get('PORT', 5000)),
        debug=app.config.get('DEBUG', True)
    )

# Sample upload and listing
@app.route('/api/upload-sample', methods=['POST'])
def upload_sample():
    if 'sample' not in request.files:
        return jsonify({'error': 'No file'}), 400
    f = request.files['sample']
    filename = secure_filename(f.filename)
    upload_dir = os.path.join(app.static_folder, 'audio', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, filename)
    f.save(path)
    return jsonify({'filename': filename})

@app.route('/api/samples', methods=['GET'])
def list_samples():
    upload_dir = os.path.join(app.static_folder, 'audio', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    files = [f for f in os.listdir(upload_dir) if f.endswith(('.wav','.mp3','.ogg','.webm'))]
    return jsonify({'samples': files})
