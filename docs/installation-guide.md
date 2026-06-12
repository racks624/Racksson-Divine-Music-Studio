# Installation Guide (Quick)

1. Requirements:
   - Python 3.9+
   - pip
   - node/npm (for Capacitor)
   - ffmpeg (for server-side processing, optional)

2. Setup (local dev):
   ```bash
   git clone <repo>
   cd racksson-divine-music-studio
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python -c "from utils.database import init_db; init_db()"
   python app.py