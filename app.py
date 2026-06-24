#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Racksson Divine Music Studio – Industrial‑Grade Flask Backend
Version: 2.0.0
"""

import os
import time
import json
import logging
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from utils import database, chakra_utils

# ------------------------------
# App Initialisation
# ------------------------------
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config.from_pyfile('config.py', silent=True)

# Set default config if missing
app.config.setdefault('HOST', '0.0.0.0')
app.config.setdefault('PORT', 5000)
app.config.setdefault('DEBUG', True)
app.config.setdefault('MAX_CONTENT_LENGTH', 100 * 1024 * 1024)  # 100 MB upload limit

# Ensure upload directories exist
UPLOAD_DIR = os.path.join(app.static_folder, 'audio', 'uploads')
PROJECTS_DIR = os.path.join(app.static_folder, 'projects')
SAMPLE_DIR = os.path.join(app.static_folder, 'audio', 'uploads')  # same as upload for samples

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(SAMPLE_DIR, exist_ok=True)

# Initialise database
database.init_db()

# ------------------------------
# Logging
# ------------------------------
if not app.debug:
    handler = logging.FileHandler('racksson.log')
    handler.setLevel(logging.ERROR)
    app.logger.addHandler(handler)

# ------------------------------
# Page Routes
# ------------------------------
@app.route('/')
def index():
    return render_template('index.html', title="Racksson — Music of the Universe")

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html', title="Dashboard")

@app.route('/studio_pro')
def studio_pro():
    return render_template('studio_pro.html', title="Studio Pro")

@app.route('/mixer')
def mixer():
    return render_template('mixer.html', title="Mixer")

@app.route('/harmonizer')
def harmonizer():
    return render_template('harmonizer.html', title="Harmonizer")

@app.route('/instrumentals')
def instrumentals():
    return render_template('instrumentals.html', title="Instrumentals")

@app.route('/recorder')
def recorder():
    return render_template('recorder.html', title="Recorder")

# Additional legacy/extra routes (if templates exist)
@app.route('/harmonizer-fx')
def harmonizer_fx():
    return render_template('harmonizer-fx.html', title="Harmonizer FX")

# ------------------------------
# API Routes
# ------------------------------

# ---- Save Recording (multipart) ----
@app.route('/api/save-recording', methods=['POST'])
def api_save_recording():
    if 'audio_data' not in request.files:
        return jsonify({'error': 'no file provided'}), 400
    f = request.files['audio_data']
    if f.filename == '':
        return jsonify({'error': 'empty filename'}), 400
    filename = f"recording_{int(time.time())}_{secure_filename(f.filename)}"
    path = os.path.join(UPLOAD_DIR, filename)
    f.save(path)
    metadata = {
        'title': request.form.get('title', ''),
        'chakra_frequency': request.form.get('chakra_frequency', '')
    }
    database.save_recording(metadata, filename)
    return jsonify({'status': 'ok', 'filename': filename})

# ---- Save Project (JSON) ----
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
        # Also store in DB
        pid = database.save_project(name, json.dumps(data))
        return jsonify({'status': 'ok', 'filename': filename, 'id': pid})
    except Exception as e:
        app.logger.exception('Save project error')
        return jsonify({'error': str(e)}), 500

# ---- List Projects ----
@app.route('/api/projects', methods=['GET'])
def api_projects():
    try:
        files = []
        for fn in sorted(os.listdir(PROJECTS_DIR), reverse=True):
            if fn.endswith('.json'):
                files.append({'filename': fn, 'path': f'/static/projects/{fn}'})
        db_projects = database.list_projects()
        return jsonify({'files': files, 'db': db_projects})
    except Exception as e:
        app.logger.exception('List projects error')
        return jsonify({'error': str(e)}), 500

# ---- Chakra Frequency Lookup ----
@app.route('/api/chakra-frequency', methods=['GET'])
def api_chakra_frequency():
    chakra = request.args.get('chakra', 'heart')
    freq = chakra_utils.get_chakra_frequency(chakra)
    return jsonify({'chakra': chakra, 'frequency': freq})

# ---- Upload Sample (for instrumentals) ----
@app.route('/api/upload-sample', methods=['POST'])
def api_upload_sample():
    if 'sample' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    f = request.files['sample']
    if f.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(f.filename)
    # Keep original extension
    path = os.path.join(SAMPLE_DIR, filename)
    f.save(path)
    return jsonify({'filename': filename, 'message': 'Upload successful'})

# ---- List Samples ----
@app.route('/api/samples', methods=['GET'])
def api_list_samples():
    try:
        files = [f for f in os.listdir(SAMPLE_DIR) if f.endswith(('.wav', '.mp3', '.ogg', '.webm', '.flac'))]
        return jsonify({'samples': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---- Optional: Export mix (server-side rendering not implemented; client does it) ----
# We keep a placeholder for future expansion

# ---- PWA & Static Assets ----
@app.route('/manifest.webmanifest')
def manifest():
    return send_from_directory(app.static_folder, 'manifest.webmanifest')

@app.route('/sw.js')
def service_worker():
    return send_from_directory(app.static_folder, 'sw.js')

# ---- Error Handlers ----
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404 if os.path.exists('templates/404.html') else ('Not Found', 404)

@app.errorhandler(500)
def internal_error(e):
    app.logger.error(f'Server error: {e}')
    return jsonify({'error': 'Internal server error'}), 500

# ------------------------------
# Run Server
# ------------------------------
if __name__ == '__main__':
    app.run(
        host=app.config['HOST'],
        port=int(app.config['PORT']),
        debug=app.config['DEBUG']
    )

# ---- List Recordings ----
@app.route('/api/recordings', methods=['GET'])
def api_list_recordings():
    try:
        upload_dir = os.path.join(app.static_folder, 'audio', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        files = [f for f in os.listdir(upload_dir) if f.startswith('recording_') and f.endswith(('.webm', '.wav'))]
        return jsonify({'recordings': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
