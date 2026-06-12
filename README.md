# 🎵 Racksson — Divine Music Studio

**Industrial‑Grade Music Production Suite**  
*Awaken the Divine Harmonics Within*

Racksson is a full‑stack, PWA‑ready digital audio workstation (DAW) with chakra‑aligned frequencies, multi‑track sequencing, real‑time recording, and cloud/local project management.

![Version](https://img.shields.io/badge/version-2.0-gold)
![Flask](https://img.shields.io/badge/Flask-3.0-blue)
![PWA](https://img.shields.io/badge/PWA-Enabled-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Multi‑Track Sequencer** — 4 tracks (Drums, Bass, Lead, Chords) with 16‑step pattern editor
- **Chakra Frequency Tuner** — 7 healing frequencies (139Hz – 963Hz) as playable oscillators
- **Master Recorder** — Capture your mix directly from the master bus (WebM/audio format)
- **Project Save/Load** — Save to server (JSON) or local IndexedDB
- **PWA Ready** — Installable on mobile/desktop, works offline with service worker
- **Theme Switcher** — Golden, Indigo, Violet visual modes
- **REST API** — Endpoints for recordings, projects, and chakra frequencies
- **SQLite + File Storage** — Hybrid persistence

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- pip & virtualenv (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/racks624/Racksson-Divine-Music-Studio.git
cd Racksson-Divine-Music-Studio

# Create virtual environment
python3 -m venv py3env
source py3env/bin/activate  # On Windows: py3env\Scripts\activate

# Install dependencies
pip install -r requirements.txt
python app.py
Method Endpoint Description
POST /api/save-recording Upload audio recording (multipart)
POST /api/save-project Save project JSON
GET /api/projects List all projects (file + DB)
GET /api/chakra-frequency Get frequency by chakra name
Racksson-Divine-Music-Studio/
├── app.py                 # Flask main entry
├── utils/                 # Database & chakra helpers
├── templates/             # Jinja2 HTML templates
│   ├── base.html
│   ├── dashboard.html
│   ├── studio_pro.html    # Industrial‑grade studio
│   └── ...
├── static/
│   ├── css/               # Styles (themes, animations)
│   ├── js/                # Client‑side logic
│   │   ├── studio.js      # Core AudioEngine
│   │   ├── studio_pro.js  # Advanced sequencer UI
│   │   └── ...
│   ├── audio/
│   │   ├── samples/       # Place your .ogg files here
│   │   └── uploads/       # User recordings (gitignored)
│   └── projects/          # JSON project files (gitignored)
├── database.db            # SQLite (gitignored)
└── requirements.txt

Chakra Frequency (Hz)
Root 139
Sacral 417
Solar Plexus 528
Heart 639
Throat 741
Third Eye 852
Crown 963
HOST = '0.0.0.0'
PORT = 5000
DEBUG = True
