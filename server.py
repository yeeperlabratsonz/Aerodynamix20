import os
import datetime
import re
import uuid
import mimetypes
from io import BytesIO
from flask import Flask, request, jsonify, session, send_from_directory, abort, Response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import create_engine, Column, String, Integer, DateTime, LargeBinary, Text, Float, Boolean, ForeignKey, text
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session, relationship
from sqlalchemy.sql import func
from bad_words import contains_bad_words
import json

PORT = int(os.environ.get('PORT', 5000))
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///dynamix.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

UPLOAD_FOLDER = 'docs/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

app = Flask(__name__, static_folder='docs', static_url_path='')
app.secret_key = os.environ.get('SESSION_SECRET', 'dev-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB max upload

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Base = declarative_base()
DBSession = scoped_session(sessionmaker(bind=engine))


class User(Base):
    __tablename__ = 'users'
    id             = Column(Integer, primary_key=True, autoincrement=True)
    username       = Column(String(20), unique=True, nullable=False)
    password_hash  = Column(String(255), nullable=False)
    bio            = Column(Text, nullable=True)
    pfp_data       = Column(LargeBinary, nullable=True)
    pfp_mimetype   = Column(String(50), nullable=True)
    pfp_offset_x   = Column(Float, default=50.0)
    pfp_offset_y   = Column(Float, default=50.0)
    disc_balance   = Column(Integer, default=0)
    last_daily_login = Column(DateTime, nullable=True)
    purchased_themes = Column(Text, nullable=True, default='[]')
    media_unlocked = Column(Boolean, default=False)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)
    posts          = relationship('Post', back_populates='user', cascade='all, delete-orphan')


class Post(Base):
    __tablename__ = 'posts'
    id             = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(Integer, ForeignKey('users.id'), nullable=False)
    text           = Column(Text, nullable=False)
    image_filename = Column(String(255))
    image_data     = Column(LargeBinary)
    image_mimetype = Column(String(50))
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)
    user           = relationship('User', back_populates='posts')


Base.metadata.create_all(engine)

# Migrate existing DB to add new User columns if they don't exist yet
_is_pg = engine.dialect.name == 'postgresql'
_new_user_cols = [
    ('bio',            'TEXT'),
    ('pfp_data',       'BYTEA'                            if _is_pg else 'BLOB'),
    ('pfp_mimetype',   'VARCHAR(50)'),
    ('pfp_offset_x',   'DOUBLE PRECISION DEFAULT 50.0'    if _is_pg else 'FLOAT DEFAULT 50.0'),
    ('pfp_offset_y',   'DOUBLE PRECISION DEFAULT 50.0'    if _is_pg else 'FLOAT DEFAULT 50.0'),
    ('disc_balance',   'INTEGER DEFAULT 0'),
    ('last_daily_login', 'TIMESTAMP'                       if _is_pg else 'DATETIME'),
    ('purchased_themes', 'TEXT DEFAULT \'[]\''),
    ('media_unlocked', 'BOOLEAN DEFAULT FALSE'             if _is_pg else 'INTEGER DEFAULT 0'),
]
_if_not_exists = 'IF NOT EXISTS' if _is_pg else ''
for _col, _typedef in _new_user_cols:
    try:
        with engine.connect() as _conn:
            _conn.execute(text(f'ALTER TABLE users ADD COLUMN {_if_not_exists} {_col} {_typedef}'))
            _conn.commit()
    except Exception:
        pass

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def user_to_dict(user):
    return {
        'id':               user.id,
        'username':         user.username,
        'bio':              user.bio or '',
        'pfp_url':          f'/api/pfp/{user.id}' if user.pfp_data else None,
        'pfp_offset_x':     user.pfp_offset_x if user.pfp_offset_x is not None else 50.0,
        'pfp_offset_y':     user.pfp_offset_y if user.pfp_offset_y is not None else 50.0,
        'disc_balance':     user.disc_balance or 0,
        'media_unlocked': bool(user.media_unlocked),
        'purchased_themes': json.loads(user.purchased_themes or '[]') if user.purchased_themes else [],
        'daily_available': user.last_daily_login is None or (datetime.datetime.utcnow() - user.last_daily_login).days >= 1,
    }


def _user_disc_row(user_id):
    db   = DBSession()
    user = db.query(User).filter_by(id=user_id).first()
    db.close()
    if not user:
        return None
    return user


def _save_user_discs(user, db=None):
    owns = db is not None
    if not owns:
        db = DBSession()
    try:
        db.add(user)
        db.commit()
    finally:
        if not owns:
            db.close()


@app.teardown_appcontext
def remove_session(exception=None):
    DBSession.remove()


@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma']  = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/')
def index():
    return send_from_directory('docs', 'index.html')


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route('/api/register', methods=['POST'])
def register():
    data     = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(username) < 3 or len(username) > 20:
        return jsonify({'error': 'Username must be 3–20 characters'}), 400
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
        session['user_id']  = user.id
        session['username'] = user.username
        return jsonify({'success': True, 'user': user_to_dict(user)})
    except Exception as e:
        db.rollback()
        if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
            return jsonify({'error': 'Username already taken'}), 409
        return jsonify({'error': 'Could not create account'}), 500
    finally:
        db.close()


@app.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    db   = DBSession()
    user = db.query(User).filter_by(username=username).first()
    db.close()

    if user and check_password_hash(user.password_hash, password):
        session['user_id']  = user.id
        session['username'] = user.username
        return jsonify({'success': True, 'user': user_to_dict(user)})
    return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'user': None})
    db   = DBSession()
    user = db.query(User).filter_by(id=session['user_id']).first()
    db.close()
    if user:
        return jsonify({'user': user_to_dict(user)})
    return jsonify({'user': None})


# ── Profile ───────────────────────────────────────────────────────────────────

@app.route('/api/pfp/<int:user_id>', methods=['GET'])
def get_pfp(user_id):
    db   = DBSession()
    user = db.query(User).filter_by(id=user_id).first()
    db.close()
    if user and user.pfp_data:
        return Response(user.pfp_data, mimetype=user.pfp_mimetype or 'image/jpeg')
    abort(404)


@app.route('/api/profile/pfp', methods=['POST'])
def update_pfp():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    if 'pfp' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['pfp']
    if not file or not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    try:
        offset_x = float(request.form.get('offset_x', 50))
        offset_y = float(request.form.get('offset_y', 50))
    except (TypeError, ValueError):
        offset_x, offset_y = 50.0, 50.0

    offset_x = max(0.0, min(100.0, offset_x))
    offset_y = max(0.0, min(100.0, offset_y))

    data     = file.read()
    mimetype = mimetypes.guess_type(file.filename)[0] or 'image/jpeg'

    db = DBSession()
    try:
        user              = db.query(User).filter_by(id=session['user_id']).first()
        user.pfp_data     = data
        user.pfp_mimetype = mimetype
        user.pfp_offset_x = offset_x
        user.pfp_offset_y = offset_y
        db.commit()
        return jsonify({
            'success':  True,
            'pfp_url':  f'/api/pfp/{user.id}',
            'offset_x': offset_x,
            'offset_y': offset_y,
        })
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not update profile picture'}), 500
    finally:
        db.close()


@app.route('/api/profile/pfp-position', methods=['POST'])
def update_pfp_position():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json() or {}
    try:
        offset_x = float(data.get('offset_x', 50))
        offset_y = float(data.get('offset_y', 50))
    except (TypeError, ValueError):
        offset_x, offset_y = 50.0, 50.0

    offset_x = max(0.0, min(100.0, offset_x))
    offset_y = max(0.0, min(100.0, offset_y))

    db = DBSession()
    try:
        user              = db.query(User).filter_by(id=session['user_id']).first()
        user.pfp_offset_x = offset_x
        user.pfp_offset_y = offset_y
        db.commit()
        return jsonify({'success': True, 'offset_x': offset_x, 'offset_y': offset_y})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not update position'}), 500
    finally:
        db.close()


@app.route('/api/profile/bio', methods=['POST'])
def update_bio():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json() or {}
    bio  = (data.get('bio') or '').strip()[:200]

    db = DBSession()
    try:
        user     = db.query(User).filter_by(id=session['user_id']).first()
        user.bio = bio
        db.commit()
        return jsonify({'success': True})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not update bio'}), 500
    finally:
        db.close()


@app.route('/api/users/<username>', methods=['GET'])
def get_user_profile(username):
    db   = DBSession()
    user = db.query(User).filter_by(username=username).first()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    posts = db.query(Post).filter_by(user_id=user.id).order_by(Post.created_at.desc()).all()
    posts_data = [
        {
            'id':         p.id,
            'text':       p.text,
            'image_url':  f'/uploads/{p.image_filename}' if p.image_filename else None,
            'created_at': p.created_at.strftime('%Y-%m-%d %H:%M:%S') if p.created_at else None,
        }
        for p in posts
    ]
    db.close()

    return jsonify({
        'user':  {
            **user_to_dict(user),
            'created_at': user.created_at.strftime('%b %Y') if user.created_at else None,
        },
        'posts': posts_data,
    })


# ── Dynamix Discs ─────────────────────────────────────────────────────────────

@app.route('/api/discs', methods=['GET'])
def get_discs():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = _user_disc_row(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'discs': user_to_dict(user)})


@app.route('/api/discs/claim', methods=['POST'])
def claim_daily_discs():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    db = DBSession()
    user = db.query(User).filter_by(id=session['user_id']).first()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    now = datetime.datetime.utcnow()
    if user.last_daily_login and (now - user.last_daily_login).days < 1:
        db.close()
        return jsonify({'error': 'Daily bonus already claimed'}), 429

    user.disc_balance = (user.disc_balance or 0) + 100
    user.last_daily_login = now
    db.commit()
    db.refresh(user)
    db.close()
    return jsonify({'success': True, 'disc_balance': user.disc_balance, 'claimed': 100})


@app.route('/api/discs/spend', methods=['POST'])
def spend_discs():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json() or {}
    amount = int(data.get('amount', 0))
    feature = (data.get('feature') or '').strip()

    if amount <= 0:
        return jsonify({'error': 'Invalid amount'}), 400

    db = DBSession()
    user = db.query(User).filter_by(id=session['user_id']).first()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    if (user.disc_balance or 0) < amount:
        db.close()
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': user.disc_balance or 0}), 402

    user.disc_balance = (user.disc_balance or 0) - amount
    db.commit()
    db.refresh(user)
    db.close()
    return jsonify({'success': True, 'disc_balance': user.disc_balance, 'feature': feature, 'spent': amount})


@app.route('/api/discs/purchase-theme', methods=['POST'])
def purchase_theme():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data  = request.get_json() or {}
    theme = (data.get('theme') or '').strip()
    cost  = 200

    if not theme:
        return jsonify({'error': 'Theme name required'}), 400

    db = DBSession()
    user = db.query(User).filter_by(id=session['user_id']).first()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    purchased = json.loads(user.purchased_themes or '[]') if user.purchased_themes else []
    if theme in purchased:
        db.close()
        return jsonify({'success': True, 'purchased': True, 'disc_balance': user.disc_balance or 0})

    if (user.disc_balance or 0) < cost:
        db.close()
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': user.disc_balance or 0}), 402

    user.disc_balance = (user.disc_balance or 0) - cost
    purchased.append(theme)
    user.purchased_themes = json.dumps(purchased)
    db.commit()
    db.refresh(user)
    db.close()
    return jsonify({'success': True, 'purchased': True, 'disc_balance': user.disc_balance})


@app.route('/api/discs/unlock-media', methods=['POST'])
def unlock_media_player():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    cost = 1000
    db = DBSession()
    user = db.query(User).filter_by(id=session['user_id']).first()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    if user.media_unlocked:
        db.close()
        return jsonify({'success': True, 'unlocked': True, 'disc_balance': user.disc_balance or 0})

    if (user.disc_balance or 0) < cost:
        db.close()
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': user.disc_balance or 0}), 402

    user.disc_balance = (user.disc_balance or 0) - cost
    user.media_unlocked = True
    db.commit()
    db.refresh(user)
    db.close()
    return jsonify({'success': True, 'unlocked': True, 'disc_balance': user.disc_balance})


# ── Posts ─────────────────────────────────────────────────────────────────────

@app.route('/api/posts', methods=['GET'])
def get_posts():
    db    = DBSession()
    rows  = db.query(Post, User).join(User, Post.user_id == User.id).order_by(Post.created_at.desc()).all()
    db.close()

    return jsonify({
        'posts': [
            {
                'id':           post.id,
                'text':         post.text,
                'image_url':    f'/uploads/{post.image_filename}' if post.image_filename else None,
                'created_at':   post.created_at.strftime('%Y-%m-%d %H:%M:%S') if post.created_at else None,
                'username':     user.username,
                'user_id':      user.id,
                'pfp_url':      f'/api/pfp/{user.id}' if user.pfp_data else None,
                'pfp_offset_x': user.pfp_offset_x if user.pfp_offset_x is not None else 50.0,
                'pfp_offset_y': user.pfp_offset_y if user.pfp_offset_y is not None else 50.0,
            }
            for post, user in rows
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
    image_data     = None
    image_mimetype = None

    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename and allowed_file(file.filename):
            ext            = secure_filename(file.filename).rsplit('.', 1)[1].lower()
            filename       = f'{uuid.uuid4().hex}.{ext}'
            image_filename = secure_filename(filename)
            image_data     = file.read()
            image_mimetype = mimetypes.guess_type(image_filename)[0] or 'application/octet-stream'

    db = DBSession()
    try:
        post = Post(
            user_id        = session['user_id'],
            text           = text,
            image_filename = image_filename,
            image_data     = image_data,
            image_mimetype = image_mimetype,
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        return jsonify({'success': True, 'post_id': post.id})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not create post'}), 500
    finally:
        db.close()


@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'You must be logged in'}), 401

    db   = DBSession()
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
    db   = DBSession()
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
