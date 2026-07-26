import os
import datetime
import re
import uuid
import mimetypes
from io import BytesIO
from flask import Flask, request, jsonify, session, send_from_directory, abort, Response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import create_engine, Column, String, Integer, DateTime, LargeBinary, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session, relationship
from bad_words import contains_bad_words

PORT = int(os.environ.get('PORT', 5000))
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///dynamix.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

UPLOAD_FOLDER = 'docs/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

app = Flask(__name__, static_folder='docs', static_url_path='')
app.secret_key = os.environ.get('SESSION_SECRET', 'dev-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MB max upload

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Base = declarative_base()
DBSession = scoped_session(sessionmaker(bind=engine))


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    posts = relationship('Post', back_populates='user', cascade='all, delete-orphan')


class Post(Base):
    __tablename__ = 'posts'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    text = Column(Text, nullable=False)
    image_filename = Column(String(255))
    image_data = Column(LargeBinary)
    image_mimetype = Column(String(50))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship('User', back_populates='posts')


Base.metadata.create_all(engine)


os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.teardown_appcontext
def remove_session(exception=None):
    DBSession.remove()


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
    db = DBSession()
    try:
        user = User(username=username, password_hash=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)
        session['user_id'] = user.id
        session['username'] = user.username
        return jsonify({'success': True, 'user': {'id': user.id, 'username': user.username}})
    except Exception as e:
        db.rollback()
        if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
            return jsonify({'error': 'Username already taken'}), 409
        return jsonify({'error': 'Could not create account'}), 500
    finally:
        db.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    db = DBSession()
    user = db.query(User).filter_by(username=username).first()
    db.close()

    if user and check_password_hash(user.password_hash, password):
        session['user_id'] = user.id
        session['username'] = user.username
        return jsonify({'success': True, 'user': {'id': user.id, 'username': user.username}})
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
    db = DBSession()
    posts = db.query(Post, User).join(User, Post.user_id == User.id).order_by(Post.created_at.desc()).all()
    db.close()

    return jsonify({
        'posts': [
            {
                'id': post.id,
                'text': post.text,
                'image_url': f'/uploads/{post.image_filename}' if post.image_filename else None,
                'created_at': post.created_at.strftime('%Y-%m-%d %H:%M:%S') if post.created_at else None,
                'username': user.username,
                'user_id': user.id
            }
            for post, user in posts
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

    image_filename = None
    image_data = None
    image_mimetype = None

    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename and allowed_file(file.filename):
            ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
            filename = f'{uuid.uuid4().hex}.{ext}'
            image_filename = secure_filename(filename)
            image_data = file.read()
            image_mimetype = mimetypes.guess_type(image_filename)[0] or 'application/octet-stream'

    db = DBSession()
    try:
        post = Post(
            user_id=session['user_id'],
            text=text,
            image_filename=image_filename,
            image_data=image_data,
            image_mimetype=image_mimetype
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        return jsonify({'success': True, 'post_id': post.id})
    except Exception as e:
        db.rollback()
        return jsonify({'error': 'Could not create post'}), 500
    finally:
        db.close()


@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'You must be logged in'}), 401

    db = DBSession()
    post = db.query(Post).filter_by(id=post_id).first()
    if not post:
        db.close()
        return jsonify({'error': 'Post not found'}), 404
    if post.user_id != session['user_id']:
        db.close()
        return jsonify({'error': 'You can only delete your own posts'}), 403

    db.delete(post)
    db.commit()
    db.close()

    return jsonify({'success': True})


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    db = DBSession()
    post = db.query(Post).filter_by(image_filename=filename).first()
    db.close()
    if post and post.image_data:
        return Response(
            post.image_data,
            mimetype=post.image_mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        )
    abort(404)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=False)
