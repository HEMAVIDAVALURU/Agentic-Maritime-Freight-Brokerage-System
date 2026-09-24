import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# Load environment variables
load_dotenv()


# =========================================================
# DATABASE CONFIGURATION
# =========================================================

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv(
    "DB_NAME",
    "maritime_freight_db"
)


# =========================================================
# MYSQL DATABASE URL
# =========================================================

DATABASE_URL = (
    f"mysql+pymysql://"
    f"{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}"
    f"/{DB_NAME}"
)


# =========================================================
# SQLALCHEMY ENGINE
# =========================================================

engine = create_engine(
    DATABASE_URL,
    echo=True
)


# =========================================================
# DATABASE SESSION
# =========================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# =========================================================
# BASE MODEL
# =========================================================

Base = declarative_base()


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()