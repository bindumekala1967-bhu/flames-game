
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session


# ---------------- APP SETUP ----------------

app = FastAPI(title="FLAMES Game API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- DATABASE SETUP ----------------

DATABASE_URL = "sqlite:///./flames.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(30), unique=True, nullable=False, index=True)
    email = Column(String(254), unique=True, nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LoginSession(Base):
    __tablename__ = "login_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- PASSWORD SECURITY ----------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        600_000,
    )

    return salt.hex() + ":" + password_hash.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, expected_hash = stored_hash.split(":", 1)

        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            600_000,
        )

        return hmac.compare_digest(
            actual_hash.hex(),
            expected_hash,
        )
    except (ValueError, TypeError):
        return False


# ---------------- REQUEST MODELS ----------------

class FlamesRequest(BaseModel):
    your_name: str
    their_name: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


# ---------------- FLAMES CALCULATOR ----------------

def calculate_flames(name1, name2):
    name1 = "".join(c.lower() for c in name1 if c.isalnum())
    name2 = "".join(c.lower() for c in name2 if c.isalnum())

    if not name1 or not name2:
        raise ValueError("Please enter valid names")

    if name1 == name2:
        return "Same Names"

    list1 = list(name1)
    list2 = list(name2)

    for char in list1[:]:
        if char in list2:
            list1.remove(char)
            list2.remove(char)

    count = len(list1) + len(list2)

    if count == 0:
        return "Same Names"

    flames = [
        "Friends",
        "Love",
        "Affection",
        "Marriage",
        "Enemies",
        "Siblings",
    ]

    index = 0

    while len(flames) > 1:
        index = (index + count - 1) % len(flames)
        flames.pop(index)

    return flames[0]


# ---------------- HOME ----------------

@app.get("/")
def home():
    return {"message": "FLAMES Backend is Running!"}


# ---------------- FLAMES API ----------------

@app.post("/api/flames")
def get_flames(data: FlamesRequest):
    try:
        result = calculate_flames(
            data.your_name,
            data.their_name,
        )

        return {
            "your_name": data.your_name,
            "their_name": data.their_name,
            "result": result,
            "success": True,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# ---------------- REGISTER ----------------

@app.post("/api/register", status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    username = data.username.strip()
    email = data.email.strip().lower()

    if not username.replace("_", "").isalnum():
        raise HTTPException(
            status_code=400,
            detail="Username can contain letters, numbers, and underscores only.",
        )

    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid email address.",
        )

    existing_user = db.query(User).filter(
        (User.username.ilike(username))
        | (User.email == email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="That username or email is already registered.",
        )

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(data.password),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not create account. Try another username or email.",
        )

    return {
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }


# ---------------- LOGIN ----------------

@app.post("/api/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    identifier = data.identifier.strip()

    user = db.query(User).filter(
        (User.username.ilike(identifier))
        | (User.email == identifier.lower())
    ).first()

    if not user or not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username/email or password.",
        )

    token = secrets.token_urlsafe(32)

    login_session = LoginSession(
        user_id=user.id,
        token_hash=hashlib.sha256(
            token.encode("utf-8")
        ).hexdigest(),
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )

    db.add(login_session)
    db.commit()

    return {
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 86400,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }


# ---------------- AUTHENTICATED USER ----------------

security = HTTPBearer()


@app.get("/api/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(
        credentials.credentials.encode("utf-8")
    ).hexdigest()

    login_session = db.query(LoginSession).filter(
        LoginSession.token_hash == token_hash
    ).first()

    if not login_session or login_session.expires_at <= datetime.utcnow():
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid. Please log in again.",
        )

    user = db.query(User).filter(
        User.id == login_session.user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User account not found.",
        )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }
