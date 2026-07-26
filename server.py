import os
import sqlite3
import datetime
import re
import uuid
from io import BytesIO
from flask import Flask, request, jsonify, session, send_from_directory, abort, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from bad_words import contains_bad_words

PORT = 5000
DATABASE = 'dynamix.db'
UPLOAD_FOLDER = 'docs/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

app = Flask(__name__, static_folder='docs', static_url_path='')
app.secret_key = os.environ.get('SESSION_SECRET', 'dev-secret-key')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            image_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    ''')
    conn.commit()
    conn.close()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/')
def index():
    return send_from_directory('docs', 'index.html')


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(username) < 3 or len(username) > 20:
        return jsonify({'error': 'Username must be 3-20 characters'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400

    password_hash = generate_password_hash(password)
    conn = get_db()
    try:
        cur = conn.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            (username, password_hash)
        )
        conn.commit()
        user_id = cur.lastrowid
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'success': True, 'user': {'id': user_id, 'username': username}})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already taken'}), 409
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    conn = get_db()
    user = conn.execute(
        'SELECT id, username, password_hash FROM users WHERE username = ?',
        (username,)
    ).fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'user': {'id': user['id'], 'username': user['username']}})
    return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({'user': {'id': session['user_id'], 'username': session['username']}})
    return jsonify({'user': None})


@app.route('/api/posts', methods=['GET'])
def get_posts():
    conn = get_db()
    posts = conn.execute('''
        SELECT posts.id, posts.text, posts.image_path, posts.created_at, users.username, users.id as user_id
        FROM posts
        JOIN users ON posts.user_id = users.id
        ORDER BY posts.created_at DESC
    ''').fetchall()
    conn.close()
    return jsonify({
        'posts': [
            {
                'id': row['id'],
                'text': row['text'],
                'image_url': f'/uploads/{os.path.basename(row["image_path"])}' if row['image_path'] else None,
                'created_at': row['created_at'],
                'username': row['username'],
                'user_id': row['user_id']
            }
            for row in posts
        ]
    })


@app.route('/api/posts', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({'error': 'You must be logged in to post'}), 401

    text = (request.form.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Post text is required'}), 400
    if len(text) > 500:
        return jsonify({'error': 'Post must be 500 characters or less'}), 400
    if contains_bad_words(text):
        return jsonify({'error': 'Your post contains words that are not allowed on Dynamix Connect.'}), 400

    image_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename and allowed_file(file.filename):
            ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
            filename = f'{uuid.uuid4().hex}.{ext}'
            safe_filename = secure_filename(filename)
            file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
            file.save(file_path)
            image_path = file_path

    conn = get_db()
    cur = conn.execute(
        'INSERT INTO posts (user_id, text, image_path) VALUES (?, ?, ?)',
        (session['user_id'], text, image_path)
    )
    conn.commit()
    post_id = cur.lastrowid
    conn.close()

    return jsonify({'success': True, 'post_id': post_id})


@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'You must be logged in'}), 401

    conn = get_db()
    post = conn.execute('SELECT user_id, image_path FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        conn.close()
        return jsonify({'error': 'Post not found'}), 404
    if post['user_id'] != session['user_id']:
        conn.close()
        return jsonify({'error': 'You can only delete your own posts'}), 403

    conn.execute('DELETE FROM posts WHERE id = ?', (post_id,))
    conn.commit()
    conn.close()

    if post['image_path'] and os.path.exists(post['image_path']):
        os.remove(post['image_path'])

    return jsonify({'success': True})


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=PORT, debug=True)
