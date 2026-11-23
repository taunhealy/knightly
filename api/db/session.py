import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_DEFAULT_SQLITE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "homeseek.db")


def get_database_url() -> str:
    raw = (os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        os.makedirs(os.path.dirname(_DEFAULT_SQLITE), exist_ok=True)
        return f"sqlite:///{_DEFAULT_SQLITE}"

    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg://" + raw[len("postgres://"):]
    elif raw.startswith("postgresql://") and "+psycopg" not in raw:
        raw = "postgresql+psycopg://" + raw[len("postgresql://"):]

    if "supabase." in raw and "sslmode=" not in raw:
        sep = "&" if "?" in raw else "?"
        raw = f"{raw}{sep}sslmode=require"
    return raw


DATABASE_URL = get_database_url()


def is_postgres() -> bool:
    return DATABASE_URL.startswith("postgresql")


_engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
elif ":6543" in DATABASE_URL or "pooler.supabase.com" in DATABASE_URL:
    _engine_kwargs["connect_args"] = {"prepare_threshold": None}

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    import db.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
