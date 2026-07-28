import os
import datetime
import re
import uuid
import random
import mimetypes
from io import BytesIO
from flask import Flask, request, jsonify, session, send_from_directory, abort, Response, g
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
    purchased_games  = Column(Text, nullable=True, default='[]')
    trading_cards    = Column(Text, nullable=True, default='[]')
    media_unlocked = Column(Boolean, default=False)
    first_login_bonus_claimed = Column(Boolean, default=False)
    is_verified    = Column(Boolean, default=False, nullable=False)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)
    posts          = relationship('Post', back_populates='user', cascade='all, delete-orphan')


class DeviceBonusClaim(Base):
    __tablename__ = 'device_bonus_claims'
    device_id    = Column(String(64), primary_key=True)
    claimed_at   = Column(DateTime, default=datetime.datetime.utcnow)


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
    comments       = relationship('Comment', back_populates='post', cascade='all, delete-orphan')


class CallSession(Base):
    __tablename__ = 'call_sessions'
    id          = Column(String(36), primary_key=True)
    caller_id   = Column(Integer, ForeignKey('users.id'), nullable=False)
    recipient_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status      = Column(String(20), nullable=False, default='ringing')
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at    = Column(DateTime, nullable=True)


class CallSignal(Base):
    __tablename__ = 'call_signals'
    id          = Column(Integer, primary_key=True, autoincrement=True)
    call_id     = Column(String(36), ForeignKey('call_sessions.id'), nullable=False)
    sender_id   = Column(Integer, ForeignKey('users.id'), nullable=False)
    signal_type = Column(String(20), nullable=False)
    payload     = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)


class Comment(Base):
    __tablename__ = 'comments'
    id         = Column(Integer, primary_key=True, autoincrement=True)
    post_id    = Column(Integer, ForeignKey('posts.id'), nullable=False)
    user_id    = Column(Integer, ForeignKey('users.id'), nullable=False)
    text       = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    post       = relationship('Post', back_populates='comments')
    user       = relationship('User')


class Friendship(Base):
    __tablename__ = 'friendships'
    id           = Column(Integer, primary_key=True, autoincrement=True)
    requester_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    addressee_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status       = Column(String(20), nullable=False, default='pending')
    created_at   = Column(DateTime, default=datetime.datetime.utcnow)


class DirectMessage(Base):
    __tablename__ = 'direct_messages'
    id           = Column(Integer, primary_key=True, autoincrement=True)
    sender_id    = Column(Integer, ForeignKey('users.id'), nullable=False)
    recipient_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    text         = Column(Text, nullable=False)
    created_at   = Column(DateTime, default=datetime.datetime.utcnow)
    is_read      = Column(Boolean, default=False)


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
    ('purchased_games',  'TEXT DEFAULT \'[]\''),
    ('trading_cards',    'TEXT DEFAULT \'[]\''),
    ('media_unlocked', 'BOOLEAN DEFAULT FALSE'             if _is_pg else 'INTEGER DEFAULT 0'),
    ('first_login_bonus_claimed', 'BOOLEAN DEFAULT FALSE' if _is_pg else 'INTEGER DEFAULT 0'),
    ('is_verified', 'BOOLEAN DEFAULT FALSE' if _is_pg else 'INTEGER DEFAULT 0'),
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
        'is_verified':      bool(user.is_verified),
        'bio':              user.bio or '',
        'pfp_url':          f'/api/pfp/{user.id}' if user.pfp_data else None,
        'pfp_offset_x':     user.pfp_offset_x if user.pfp_offset_x is not None else 50.0,
        'pfp_offset_y':     user.pfp_offset_y if user.pfp_offset_y is not None else 50.0,
        'disc_balance':     user.disc_balance or 0,
        'media_unlocked': bool(user.media_unlocked),
        'purchased_themes': json.loads(user.purchased_themes or '[]') if user.purchased_themes else [],
        'purchased_games':  json.loads(user.purchased_games  or '[]') if user.purchased_games  else [],
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


def _device_has_claimed_bonus(device_id, db=None):
    close_db = db is None
    if close_db:
        db = DBSession()
    try:
        claim = db.query(DeviceBonusClaim).filter_by(device_id=device_id).first()
        return claim is not None
    finally:
        if close_db:
            db.close()


def _mark_device_bonus_claimed(device_id, db=None):
    close_db = db is None
    if close_db:
        db = DBSession()
    try:
        db.add(DeviceBonusClaim(device_id=device_id))
        db.commit()
    except Exception:
        if close_db:
            db.rollback()
    finally:
        if close_db:
            db.close()


# ── Anonymous Dynamix Discs helpers (stored in Flask session) ───────────────────

def _get_session_discs():
    return int(session.get('disc_balance', 0) or 0)


def _set_session_discs(amount):
    session['disc_balance'] = max(0, int(amount))


def _get_session_last_daily():
    last = session.get('last_daily_login')
    if last:
        try:
            return datetime.datetime.fromisoformat(last)
        except ValueError:
            return None
    return None


def _set_session_last_daily(dt):
    session['last_daily_login'] = dt.isoformat()


TRADING_CARD_PACK_COST = 100
RUN3_CARD_POOL = [
    {'name': 'The Runner', 'rarity': 'Common', 'accent': '#65c7ff', 'number': '001'},
    {'name': 'Tunnel Vision', 'rarity': 'Common', 'accent': '#65c7ff', 'number': '002'},
    {'name': 'Jetpack Escape', 'rarity': 'Uncommon', 'accent': '#7ee7b1', 'number': '003'},
    {'name': 'Infinite Leap', 'rarity': 'Rare', 'accent': '#c59cff', 'number': '004'},
    {'name': 'Galaxy Runner', 'rarity': 'Epic', 'accent': '#ffca6b', 'number': '005'},
]


def _get_session_trading_cards():
    return session.get('trading_cards', [])


def _set_session_trading_cards(cards):
    session['trading_cards'] = cards


def _get_session_purchased_themes():
    try:
        return json.loads(session.get('purchased_themes', '[]') or '[]')
    except Exception:
        return []


def _set_session_purchased_themes(themes):
    session['purchased_themes'] = json.dumps(list(themes))


def _is_session_media_unlocked():
    return bool(session.get('media_unlocked', False))


def _set_session_media_unlocked():
    session['media_unlocked'] = True


def _get_session_purchased_games():
    try:
        return json.loads(session.get('purchased_games', '[]') or '[]')
    except Exception:
        return []


def _set_session_purchased_games(games):
    session['purchased_games'] = json.dumps(list(games))


def _anonymous_discs_dict():
    last = _get_session_last_daily()
    return {
        'id':               None,
        'username':         None,
        'bio':              '',
        'pfp_url':          None,
        'pfp_offset_x':     50.0,
        'pfp_offset_y':     50.0,
        'disc_balance':     _get_session_discs(),
        'media_unlocked': _is_session_media_unlocked(),
        'purchased_themes': _get_session_purchased_themes(),
        'daily_available':  last is None or (datetime.datetime.utcnow() - last).days >= 1,
    }


def _maybe_award_first_login_bonus(user, db):
    """Give one-time 200-disc bonus when an account is first used on a device."""
    if user.first_login_bonus_claimed:
        return False
    device_id = getattr(g, 'device_id', None)
    if not device_id or _device_has_claimed_bonus(device_id, db):
        return False
    user.disc_balance = (user.disc_balance or 0) + 200
    user.first_login_bonus_claimed = True
    db.add(user)
    db.commit()
    db.refresh(user)
    _mark_device_bonus_claimed(device_id, db)
    return True


@app.teardown_appcontext
def remove_session(exception=None):
    DBSession.remove()


@app.before_request
def ensure_device_id():
    g.device_id = request.cookies.get('aerodynamix_device_id')
    if not g.device_id:
        g.device_id = uuid.uuid4().hex


@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma']  = 'no-cache'
    response.headers['Expires'] = '0'
    if not request.cookies.get('aerodynamix_device_id'):
        response.set_cookie(
            'aerodynamix_device_id',
            g.device_id,
            max_age=365 * 24 * 60 * 60,
            httponly=True,
            samesite='Lax'
        )
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
        _maybe_award_first_login_bonus(user, db)
        session['user_id']  = user.id
        session['username'] = user.username
        return jsonify({'success': True, 'user': user_to_dict(user)})
    except Exception as e:
        db.rollback()
        app.logger.error('Registration error: %s', e)
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
        _maybe_award_first_login_bonus(user, db)
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

    viewer_id = session.get('user_id')
    friend_status = 'none'
    friendship_id = None
    if viewer_id and viewer_id != user.id:
        f = db.query(Friendship).filter(
            ((Friendship.requester_id == viewer_id) & (Friendship.addressee_id == user.id)) |
            ((Friendship.requester_id == user.id) & (Friendship.addressee_id == viewer_id))
        ).first()
        if f:
            friendship_id = f.id
            if f.status == 'accepted':
                friend_status = 'friends'
            elif f.requester_id == viewer_id:
                friend_status = 'pending_sent'
            else:
                friend_status = 'pending_received'
    db.close()

    return jsonify({
        'user':          {
            **user_to_dict(user),
            'created_at': user.created_at.strftime('%b %Y') if user.created_at else None,
        },
        'posts':         posts_data,
        'friend_status': friend_status,
        'friendship_id': friendship_id,
    })


# ── Dynamix Discs ─────────────────────────────────────────────────────────────

@app.route('/api/discs', methods=['GET'])
def get_discs():
    if 'user_id' in session:
        user = _user_disc_row(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'discs': user_to_dict(user)})
    return jsonify({'discs': _anonymous_discs_dict()})


@app.route('/api/trading-cards', methods=['GET'])
def get_trading_cards():
    if 'user_id' in session:
        user = _user_disc_row(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'cards': json.loads(user.trading_cards or '[]') if user.trading_cards else []})
    return jsonify({'cards': _get_session_trading_cards()})


@app.route('/api/trading-cards/purchase-pack', methods=['POST'])
def purchase_trading_card_pack():
    data = request.get_json(silent=True) or {}
    # The full-version entitlement is currently a client-side access-key gate.
    # Keep the temporary testing override scoped to this pack endpoint; trial
    # requests continue to use the normal 100-disc price.
    full_version = bool(data.get('full_version'))
    pack_cost = 0 if full_version else TRADING_CARD_PACK_COST
    cards = random.choices(
        RUN3_CARD_POOL,
        weights=[46, 29, 16, 7, 2],
        k=3
    )
    awarded = [
        {**card, 'id': str(uuid.uuid4()), 'game': 'Run 3',
         'obtained_at': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}
        for card in cards
    ]

    if 'user_id' in session:
        db = DBSession()
        user = db.query(User).filter_by(id=session['user_id']).first()
        if not user:
            db.close()
            return jsonify({'error': 'User not found'}), 404
        if (user.disc_balance or 0) < pack_cost:
            db.close()
            return jsonify({'error': 'Not enough Dynamix Discs',
                            'disc_balance': user.disc_balance or 0}), 402
        owned = json.loads(user.trading_cards or '[]') if user.trading_cards else []
        owned.extend(awarded)
        user.disc_balance = (user.disc_balance or 0) - pack_cost
        user.trading_cards = json.dumps(owned)
        db.commit()
        db.refresh(user)
        result = {'success': True, 'cards': awarded,
                  'disc_balance': user.disc_balance}
        db.close()
        return jsonify(result)

    balance = _get_session_discs()
    if balance < pack_cost:
        return jsonify({'error': 'Not enough Dynamix Discs',
                        'disc_balance': balance}), 402
    owned = _get_session_trading_cards()
    owned.extend(awarded)
    _set_session_trading_cards(owned)
    _set_session_discs(balance - pack_cost)
    return jsonify({'success': True, 'cards': awarded,
                    'disc_balance': _get_session_discs()})


@app.route('/api/discs/claim', methods=['POST'])
def claim_daily_discs():
    now = datetime.datetime.utcnow()

    if 'user_id' in session:
        db = DBSession()
        user = db.query(User).filter_by(id=session['user_id']).first()
        if not user:
            db.close()
            return jsonify({'error': 'User not found'}), 404

        if user.last_daily_login and (now - user.last_daily_login).days < 1:
            db.close()
            return jsonify({'error': 'Daily bonus already claimed'}), 429

        user.disc_balance = (user.disc_balance or 0) + 100
        user.last_daily_login = now
        db.commit()
        db.refresh(user)
        db.close()
        return jsonify({'success': True, 'disc_balance': user.disc_balance, 'claimed': 100})

    # Anonymous users use session-based balance
    last = _get_session_last_daily()
    if last and (now - last).days < 1:
        return jsonify({'error': 'Daily bonus already claimed'}), 429

    new_balance = _get_session_discs() + 100
    _set_session_discs(new_balance)
    _set_session_last_daily(now)
    return jsonify({'success': True, 'disc_balance': new_balance, 'claimed': 100})


@app.route('/api/discs/spend', methods=['POST'])
def spend_discs():
    data = request.get_json() or {}
    amount = int(data.get('amount', 0))
    feature = (data.get('feature') or '').strip()

    if amount <= 0:
        return jsonify({'error': 'Invalid amount'}), 400

    if 'user_id' in session:
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

    balance = _get_session_discs()
    if balance < amount:
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': balance}), 402
    new_balance = balance - amount
    _set_session_discs(new_balance)
    return jsonify({'success': True, 'disc_balance': new_balance, 'feature': feature, 'spent': amount})


@app.route('/api/discs/purchase-theme', methods=['POST'])
def purchase_theme():
    data  = request.get_json() or {}
    theme = (data.get('theme') or '').strip()
    cost  = 200

    if not theme:
        return jsonify({'error': 'Theme name required'}), 400

    if 'user_id' in session:
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

    purchased = _get_session_purchased_themes()
    if theme in purchased:
        return jsonify({'success': True, 'purchased': True, 'disc_balance': _get_session_discs()})
    balance = _get_session_discs()
    if balance < cost:
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': balance}), 402
    purchased.append(theme)
    _set_session_purchased_themes(purchased)
    _set_session_discs(balance - cost)
    return jsonify({'success': True, 'purchased': True, 'disc_balance': _get_session_discs()})


@app.route('/api/discs/unlock-media', methods=['POST'])
def unlock_media_player():
    cost = 1000

    if 'user_id' in session:
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

    if _is_session_media_unlocked():
        return jsonify({'success': True, 'unlocked': True, 'disc_balance': _get_session_discs()})

    balance = _get_session_discs()
    if balance < cost:
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': balance}), 402
    _set_session_discs(balance - cost)
    _set_session_media_unlocked()
    return jsonify({'success': True, 'unlocked': True, 'disc_balance': _get_session_discs()})


@app.route('/api/discs/purchased-games', methods=['GET'])
def get_purchased_games():
    if 'user_id' in session:
        user = _user_disc_row(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'games': json.loads(user.purchased_games or '[]') if user.purchased_games else []})
    return jsonify({'games': _get_session_purchased_games()})


@app.route('/api/discs/purchase-game', methods=['POST'])
def purchase_game():
    data = request.get_json() or {}
    game = (data.get('game') or '').strip()
    cost = 100

    if not game:
        return jsonify({'error': 'Game name required'}), 400

    if 'user_id' in session:
        db = DBSession()
        user = db.query(User).filter_by(id=session['user_id']).first()
        if not user:
            db.close()
            return jsonify({'error': 'User not found'}), 404

        purchased = json.loads(user.purchased_games or '[]') if user.purchased_games else []
        if game in purchased:
            db.close()
            return jsonify({'success': True, 'purchased': True, 'disc_balance': user.disc_balance or 0})

        if (user.disc_balance or 0) < cost:
            db.close()
            return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': user.disc_balance or 0}), 402

        user.disc_balance = (user.disc_balance or 0) - cost
        purchased.append(game)
        user.purchased_games = json.dumps(purchased)
        db.commit()
        db.refresh(user)
        db.close()
        return jsonify({'success': True, 'purchased': True, 'disc_balance': user.disc_balance})

    purchased = _get_session_purchased_games()
    if game in purchased:
        return jsonify({'success': True, 'purchased': True, 'disc_balance': _get_session_discs()})
    balance = _get_session_discs()
    if balance < cost:
        return jsonify({'error': 'Not enough Dynamix Discs', 'disc_balance': balance}), 402
    purchased.append(game)
    _set_session_purchased_games(purchased)
    _set_session_discs(balance - cost)
    return jsonify({'success': True, 'purchased': True, 'disc_balance': _get_session_discs()})


# ── One-to-one WebRTC call signaling ──────────────────────────────────────────

def _require_call_user(db):
    user_id = session.get('user_id')
    if not user_id:
        return None, (jsonify({'error': 'Log in to use video calling'}), 401)
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        return None, (jsonify({'error': 'User not found'}), 404)
    return user, None


def _call_to_dict(call, db):
    caller = db.query(User).filter_by(id=call.caller_id).first()
    recipient = db.query(User).filter_by(id=call.recipient_id).first()
    return {
        'id': call.id,
        'caller_id': call.caller_id,
        'caller_username': caller.username if caller else 'Unknown',
        'caller_is_verified': bool(caller.is_verified) if caller else False,
        'recipient_id': call.recipient_id,
        'recipient_username': recipient.username if recipient else 'Unknown',
        'recipient_is_verified': bool(recipient.is_verified) if recipient else False,
        'status': call.status,
        'created_at': call.created_at.strftime('%Y-%m-%d %H:%M:%S') if call.created_at else None,
    }


@app.route('/api/calls', methods=['POST'])
def create_call():
    db = DBSession()
    try:
        user, error = _require_call_user(db)
        if error:
            return error
        data = request.get_json() or {}
        recipient_username = (data.get('username') or '').strip()
        recipient = db.query(User).filter_by(username=recipient_username).first()
        if not recipient:
            return jsonify({'error': 'User not found'}), 404
        if recipient.id == user.id:
            return jsonify({'error': 'You cannot call yourself'}), 400

        active = db.query(CallSession).filter(
            CallSession.status.in_(['ringing', 'active']),
            ((CallSession.caller_id == user.id) | (CallSession.recipient_id == user.id))
        ).first()
        if active:
            return jsonify({'error': 'You already have an active call'}), 409

        call = CallSession(id=str(uuid.uuid4()), caller_id=user.id, recipient_id=recipient.id)
        db.add(call)
        db.commit()
        return jsonify({'success': True, 'call': _call_to_dict(call, db)})
    finally:
        db.close()


@app.route('/api/calls/incoming', methods=['GET'])
def incoming_calls():
    db = DBSession()
    try:
        user, error = _require_call_user(db)
        if error:
            return error
        calls = db.query(CallSession).filter_by(
            recipient_id=user.id, status='ringing'
        ).order_by(CallSession.created_at.desc()).all()
        return jsonify({'calls': [_call_to_dict(call, db) for call in calls]})
    finally:
        db.close()


@app.route('/api/calls/config', methods=['GET'])
def call_config():
    """Return browser-safe ICE configuration.

    STUN works for many networks. Optional TURN values can be supplied through
    TURN_SERVER, TURN_USERNAME, and TURN_CREDENTIAL for reliable NAT traversal.
    """
    db = DBSession()
    user, error = _require_call_user(db)
    db.close()
    if error:
        return error

    ice_servers = [{'urls': ['stun:stun.l.google.com:19302']}]
    turn_server = os.environ.get('TURN_SERVER', '').strip()
    turn_username = os.environ.get('TURN_USERNAME', '').strip()
    turn_credential = os.environ.get('TURN_CREDENTIAL', '').strip()
    if turn_server and turn_username and turn_credential:
        ice_servers.append({
            'urls': turn_server,
            'username': turn_username,
            'credential': turn_credential,
        })
    return jsonify({'iceServers': ice_servers})


@app.route('/api/calls/<call_id>', methods=['GET'])
def get_call(call_id):
    db = DBSession()
    try:
        user, error = _require_call_user(db)
        if error:
            return error
        call = db.query(CallSession).filter_by(id=call_id).first()
        if not call or user.id not in (call.caller_id, call.recipient_id):
            return jsonify({'error': 'Call not found'}), 404
        return jsonify({'call': _call_to_dict(call, db)})
    finally:
        db.close()


@app.route('/api/calls/<call_id>/accept', methods=['POST'])
def accept_call(call_id):
    db = DBSession()
    try:
        user, error = _require_call_user(db)
        if error:
            return error
        call = db.query(CallSession).filter_by(id=call_id).first()
        if not call or call.recipient_id != user.id:
            return jsonify({'error': 'Call not found'}), 404
        if call.status != 'ringing':
            return jsonify({'error': 'Call is no longer ringing'}), 409
        call.status = 'active'
        db.commit()
        return jsonify({'success': True, 'call': _call_to_dict(call, db)})
    finally:
        db.close()


@app.route('/api/calls/<call_id>/signals', methods=['GET', 'POST'])
def call_signals(call_id):
    db = DBSession()
    try:
        user, error = _require_call_user(db)
        if error:
            return error
        call = db.query(CallSession).filter_by(id=call_id).first()
        if not call or user.id not in (call.caller_id, call.recipient_id):
            return jsonify({'error': 'Call not found'}), 404

        if request.method == 'POST':
            if call.status not in ('ringing', 'active'):
                return jsonify({'error': 'Call is no longer active'}), 409
            data = request.get_json() or {}
            signal_type = (data.get('type') or '').strip()
            payload = data.get('payload')
            if signal_type not in ('offer', 'answer', 'candidate') or payload is None:
                return jsonify({'error': 'Invalid call signal'}), 400
            signal = CallSignal(
                call_id=call.id, sender_id=user.id, signal_type=signal_type,
                payload=json.dumps(payload)
            )
            db.add(signal)
            db.commit()
            return jsonify({'success': True})

        after_id = request.args.get('after', 0, type=int)
        signals = db.query(CallSignal).filter(
            CallSignal.call_id == call.id,
            CallSignal.sender_id != user.id,
            CallSignal.id > after_id
        ).order_by(CallSignal.id.asc()).limit(100).all()
        return jsonify({'signals': [
            {'id': signal.id, 'type': signal.signal_type, 'payload': json.loads(signal.payload)}
            for signal in signals
        ], 'status': call.status})
    finally:
        db.close()


@app.route('/api/calls/<call_id>/end', methods=['POST'])
def end_call(call_id):
    db = DBSession()
    try:
        user, error = _require_call_user(db)
        if error:
            return error
        call = db.query(CallSession).filter_by(id=call_id).first()
        if not call or user.id not in (call.caller_id, call.recipient_id):
            return jsonify({'error': 'Call not found'}), 404
        call.status = 'ended'
        call.ended_at = datetime.datetime.utcnow()
        db.query(CallSignal).filter_by(call_id=call.id).delete()
        db.commit()
        return jsonify({'success': True})
    finally:
        db.close()


# ── Posts ─────────────────────────────────────────────────────────────────────

@app.route('/api/posts', methods=['GET'])
def get_posts():
    db    = DBSession()
    rows  = db.query(Post, User).join(User, Post.user_id == User.id).order_by(Post.created_at.desc()).all()
    comment_counts = dict(
        db.query(Comment.post_id, func.count(Comment.id)).group_by(Comment.post_id).all()
    )
    db.close()

    return jsonify({
        'posts': [
            {
                'id':            post.id,
                'text':          post.text,
                'image_url':     f'/uploads/{post.image_filename}' if post.image_filename else None,
                'created_at':    post.created_at.strftime('%Y-%m-%d %H:%M:%S') if post.created_at else None,
                'username':      user.username,
                'is_verified':   bool(user.is_verified),
                'user_id':       user.id,
                'pfp_url':       f'/api/pfp/{user.id}' if user.pfp_data else None,
                'pfp_offset_x':  user.pfp_offset_x if user.pfp_offset_x is not None else 50.0,
                'pfp_offset_y':  user.pfp_offset_y if user.pfp_offset_y is not None else 50.0,
                'comment_count': comment_counts.get(post.id, 0),
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


# ── Comments ──────────────────────────────────────────────────────────────────

@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
def get_comments(post_id):
    db = DBSession()
    try:
        post = db.query(Post).filter_by(id=post_id).first()
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        rows = db.query(Comment, User).join(User, Comment.user_id == User.id).filter(
            Comment.post_id == post_id
        ).order_by(Comment.created_at.asc()).all()
        return jsonify({'comments': [
            {
                'id':           c.id,
                'text':         c.text,
                'created_at':   c.created_at.strftime('%Y-%m-%d %H:%M:%S') if c.created_at else None,
                'username':     u.username,
                'is_verified':  bool(u.is_verified),
                'user_id':      u.id,
                'pfp_url':      f'/api/pfp/{u.id}' if u.pfp_data else None,
                'pfp_offset_x': u.pfp_offset_x if u.pfp_offset_x is not None else 50.0,
                'pfp_offset_y': u.pfp_offset_y if u.pfp_offset_y is not None else 50.0,
            }
            for c, u in rows
        ]})
    finally:
        db.close()


@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
def create_comment(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'You must be logged in to comment'}), 401
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Comment text is required'}), 400
    if len(text) > 300:
        return jsonify({'error': 'Comment must be 300 characters or less'}), 400
    if contains_bad_words(text):
        return jsonify({'error': 'Your comment contains words that are not allowed.'}), 400
    db = DBSession()
    try:
        post = db.query(Post).filter_by(id=post_id).first()
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        comment = Comment(post_id=post_id, user_id=session['user_id'], text=text)
        db.add(comment)
        db.commit()
        db.refresh(comment)
        user = db.query(User).filter_by(id=session['user_id']).first()
        return jsonify({'success': True, 'comment': {
            'id':           comment.id,
            'text':         comment.text,
            'created_at':   comment.created_at.strftime('%Y-%m-%d %H:%M:%S') if comment.created_at else None,
            'username':     user.username,
            'is_verified':  bool(user.is_verified),
            'user_id':      user.id,
            'pfp_url':      f'/api/pfp/{user.id}' if user.pfp_data else None,
            'pfp_offset_x': user.pfp_offset_x if user.pfp_offset_x is not None else 50.0,
            'pfp_offset_y': user.pfp_offset_y if user.pfp_offset_y is not None else 50.0,
        }})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not post comment'}), 500
    finally:
        db.close()


@app.route('/api/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'You must be logged in'}), 401
    db = DBSession()
    try:
        comment = db.query(Comment).filter_by(id=comment_id).first()
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        if comment.user_id != session['user_id']:
            return jsonify({'error': 'You can only delete your own comments'}), 403
        db.delete(comment)
        db.commit()
        return jsonify({'success': True})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not delete comment'}), 500
    finally:
        db.close()


# ── Friends ───────────────────────────────────────────────────────────────────

def _friendship_between(db, uid, other_id):
    return db.query(Friendship).filter(
        ((Friendship.requester_id == uid) & (Friendship.addressee_id == other_id)) |
        ((Friendship.requester_id == other_id) & (Friendship.addressee_id == uid))
    ).first()


def _user_mini(u):
    return {
        'id':           u.id,
        'username':     u.username,
        'is_verified':  bool(u.is_verified),
        'pfp_url':      f'/api/pfp/{u.id}' if u.pfp_data else None,
        'pfp_offset_x': u.pfp_offset_x if u.pfp_offset_x is not None else 50.0,
        'pfp_offset_y': u.pfp_offset_y if u.pfp_offset_y is not None else 50.0,
        'bio':          u.bio or '',
    }


@app.route('/api/friends/request', methods=['POST'])
def send_friend_request():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    db = DBSession()
    try:
        uid = session['user_id']
        other = db.query(User).filter_by(username=username).first()
        if not other:
            return jsonify({'error': 'User not found'}), 404
        if other.id == uid:
            return jsonify({'error': 'You cannot add yourself'}), 400
        existing = _friendship_between(db, uid, other.id)
        if existing:
            return jsonify({'error': 'Friend relationship already exists'}), 409
        f = Friendship(requester_id=uid, addressee_id=other.id)
        db.add(f)
        db.commit()
        db.refresh(f)
        return jsonify({'success': True, 'status': 'pending_sent', 'friendship_id': f.id})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not send friend request'}), 500
    finally:
        db.close()


@app.route('/api/friends/<int:friendship_id>/accept', methods=['POST'])
def accept_friend_request(friendship_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = DBSession()
    try:
        f = db.query(Friendship).filter_by(id=friendship_id, addressee_id=session['user_id'], status='pending').first()
        if not f:
            return jsonify({'error': 'Friend request not found'}), 404
        f.status = 'accepted'
        db.commit()
        return jsonify({'success': True})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not accept request'}), 500
    finally:
        db.close()


@app.route('/api/friends/<int:friendship_id>/decline', methods=['POST'])
def decline_friend_request(friendship_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = DBSession()
    try:
        f = db.query(Friendship).filter_by(id=friendship_id, addressee_id=session['user_id'], status='pending').first()
        if not f:
            return jsonify({'error': 'Friend request not found'}), 404
        db.delete(f)
        db.commit()
        return jsonify({'success': True})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not decline request'}), 500
    finally:
        db.close()


@app.route('/api/friends/<int:friendship_id>', methods=['DELETE'])
def remove_friend(friendship_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = DBSession()
    try:
        uid = session['user_id']
        f = db.query(Friendship).filter(
            Friendship.id == friendship_id,
            (Friendship.requester_id == uid) | (Friendship.addressee_id == uid)
        ).first()
        if not f:
            return jsonify({'error': 'Friendship not found'}), 404
        db.delete(f)
        db.commit()
        return jsonify({'success': True})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not remove friend'}), 500
    finally:
        db.close()


@app.route('/api/friends', methods=['GET'])
def get_friends():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = DBSession()
    try:
        uid = session['user_id']
        accepted = db.query(Friendship).filter(
            Friendship.status == 'accepted',
            (Friendship.requester_id == uid) | (Friendship.addressee_id == uid)
        ).all()
        friends = []
        for f in accepted:
            other_id = f.addressee_id if f.requester_id == uid else f.requester_id
            other = db.query(User).filter_by(id=other_id).first()
            if other:
                friends.append({'friendship_id': f.id, 'user': _user_mini(other)})

        received = db.query(Friendship).filter_by(addressee_id=uid, status='pending').all()
        requests_in = []
        for f in received:
            other = db.query(User).filter_by(id=f.requester_id).first()
            if other:
                requests_in.append({'friendship_id': f.id, 'user': _user_mini(other)})

        return jsonify({'friends': friends, 'requests': requests_in})
    finally:
        db.close()


# ── Direct Messages ───────────────────────────────────────────────────────────

@app.route('/api/dms', methods=['GET'])
def list_dm_conversations():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = DBSession()
    try:
        uid = session['user_id']
        messages = db.query(DirectMessage).filter(
            (DirectMessage.sender_id == uid) | (DirectMessage.recipient_id == uid)
        ).order_by(DirectMessage.created_at.desc()).all()
        seen = {}
        for m in messages:
            other_id = m.recipient_id if m.sender_id == uid else m.sender_id
            if other_id not in seen:
                seen[other_id] = m
        convos = []
        for other_id, last_msg in seen.items():
            other = db.query(User).filter_by(id=other_id).first()
            if not other:
                continue
            unread = db.query(DirectMessage).filter_by(
                sender_id=other_id, recipient_id=uid, is_read=False
            ).count()
            convos.append({
                'user':         _user_mini(other),
                'last_message': {
                    'text':       last_msg.text,
                    'sender_id':  last_msg.sender_id,
                    'created_at': last_msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if last_msg.created_at else None,
                },
                'unread': unread,
            })
        return jsonify({'conversations': convos})
    finally:
        db.close()


@app.route('/api/dms/unread', methods=['GET'])
def unread_dm_count():
    if 'user_id' not in session:
        return jsonify({'count': 0})
    db = DBSession()
    try:
        count = db.query(DirectMessage).filter_by(recipient_id=session['user_id'], is_read=False).count()
        return jsonify({'count': count})
    finally:
        db.close()


@app.route('/api/dms/<username>', methods=['GET'])
def get_dm_thread(username):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    db = DBSession()
    try:
        uid = session['user_id']
        other = db.query(User).filter_by(username=username).first()
        if not other:
            return jsonify({'error': 'User not found'}), 404
        db.query(DirectMessage).filter_by(
            sender_id=other.id, recipient_id=uid, is_read=False
        ).update({'is_read': True})
        db.commit()
        msgs = db.query(DirectMessage).filter(
            ((DirectMessage.sender_id == uid) & (DirectMessage.recipient_id == other.id)) |
            ((DirectMessage.sender_id == other.id) & (DirectMessage.recipient_id == uid))
        ).order_by(DirectMessage.created_at.asc()).all()
        return jsonify({
            'other_user': _user_mini(other),
            'messages': [
                {
                    'id':         m.id,
                    'text':       m.text,
                    'sender_id':  m.sender_id,
                    'created_at': m.created_at.strftime('%Y-%m-%d %H:%M:%S') if m.created_at else None,
                }
                for m in msgs
            ]
        })
    finally:
        db.close()


@app.route('/api/dms/<username>', methods=['POST'])
def send_dm(username):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Message text is required'}), 400
    if len(text) > 1000:
        return jsonify({'error': 'Message must be 1000 characters or less'}), 400
    db = DBSession()
    try:
        uid = session['user_id']
        other = db.query(User).filter_by(username=username).first()
        if not other:
            return jsonify({'error': 'User not found'}), 404
        if other.id == uid:
            return jsonify({'error': 'You cannot message yourself'}), 400
        msg = DirectMessage(sender_id=uid, recipient_id=other.id, text=text)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return jsonify({'success': True, 'message': {
            'id':         msg.id,
            'text':       msg.text,
            'sender_id':  msg.sender_id,
            'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else None,
        }})
    except Exception:
        db.rollback()
        return jsonify({'error': 'Could not send message'}), 500
    finally:
        db.close()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=False)
