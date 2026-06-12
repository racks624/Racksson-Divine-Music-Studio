import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            chakra_frequency TEXT,
            filename TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_recording(metadata, filename):
    conn = get_db()
    conn.execute(
        'INSERT INTO recordings (title, chakra_frequency, filename) VALUES (?, ?, ?)',
        (metadata.get('title', ''), metadata.get('chakra_frequency', ''), filename)
    )
    conn.commit()
    conn.close()

def save_project(name, data):
    conn = get_db()
    cur = conn.execute(
        'INSERT INTO projects (name, data) VALUES (?, ?)',
        (name, data)
    )
    conn.commit()
    last_id = cur.lastrowid
    conn.close()
    return last_id

def list_projects():
    conn = get_db()
    rows = conn.execute('SELECT id, name, created_at FROM projects ORDER BY created_at DESC').fetchall()
    conn.close()
    return [dict(row) for row in rows]
