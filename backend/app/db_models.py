from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text
)
from sqlalchemy.sql import func
from datetime import datetime

from app.database import Base


# ---------------------------------------------------------
# USERS TABLE
# ---------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    company_name = Column(String(150), nullable=True)
    role = Column(String(20), default="customer", nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------
# ADMINS TABLE
# ---------------------------------------------------------

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    password = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        default="admin",
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ---------------------------------------------------------
# EMAIL OTPS TABLE
# ---------------------------------------------------------

class EmailOTP(Base):
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    otp = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------
# ROUTES TABLE
# ---------------------------------------------------------

class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(50), unique=True, nullable=False)
    origin = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    distance_nm = Column(Float, nullable=False)
    transit_days = Column(Integer, nullable=False)
    transshipments = Column(Integer, nullable=False)
    route_type = Column(String(50), nullable=False)
    base_freight_usd = Column(Float, nullable=False)
    cargo_type = Column(String(100), nullable=False)


# ---------------------------------------------------------
# PRICING TABLE
# ---------------------------------------------------------

class Pricing(Base):
    __tablename__ = "pricing"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(50), nullable=False)
    fuel_surcharge = Column(Float, default=0)
    port_charge = Column(Float, default=0)
    risk_surcharge = Column(Float, default=0)
    operating_cost = Column(Float, default=0)
    demand_factor = Column(Float, default=1.0)
    demand_adjusted_cost = Column(Float, default=0)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------
# QUOTATION REQUESTS TABLE
# ---------------------------------------------------------

class QuotationRequestDB(Base):
    __tablename__ = "quotation_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    origin = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    cargo_type = Column(String(100), nullable=False)
    container_type = Column(String(50), nullable=False)
    container_count = Column(Integer, nullable=False)
    selected_route_id = Column(String(50), nullable=False)
    target_margin = Column(Float, default=0.10)
    selling_price = Column(Float, default=0)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------
# QUOTATION ROUTES TABLE
# ---------------------------------------------------------

class QuotationRoute(Base):
    __tablename__ = "quotation_routes"

    id = Column(Integer, primary_key=True, index=True)

    quotation_id = Column(
        Integer,
        ForeignKey("quotation_requests.id"),
        nullable=False
    )

    route_id = Column(String(50), nullable=False)
    rank = Column(Integer, nullable=False)
    route_score = Column(Float, nullable=False)
    base_freight_usd = Column(Float, nullable=False)


# ---------------------------------------------------------
# SAVED QUOTATIONS TABLE
# ---------------------------------------------------------

class SavedQuotation(Base):
    __tablename__ = "saved_quotations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    quotation_id = Column(
        Integer,
        ForeignKey("quotation_requests.id"),
        nullable=False
    )

    saved_at = Column(
        DateTime,
        server_default=func.now()
    )


# ---------------------------------------------------------
# ACTIVITIES TABLE
# ---------------------------------------------------------

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

# ---------------------------------------------------------
# FEEDBACK TABLE
# ---------------------------------------------------------

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    quotation_id = Column(
        Integer,
        ForeignKey("quotation_requests.id"),
        nullable=True
    )

    rating = Column(Integer, nullable=False)

    comments = Column(Text, nullable=True)

    # Admin's response to the user's feedback
    admin_response = Column(Text, nullable=True)

    # Date and time when admin responded
    admin_response_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )
