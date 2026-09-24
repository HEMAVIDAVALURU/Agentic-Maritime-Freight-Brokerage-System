from datetime import datetime, timedelta
import random

from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.db_models import User, Admin, EmailOTP
from app.services.email_service import EmailService
from app.services.jwt_service import JWTService


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


class AuthService:

    # =========================================================
    # PASSWORD
    # =========================================================

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(
        plain_password: str,
        hashed_password: str
    ) -> bool:
        return pwd_context.verify(
            plain_password,
            hashed_password
        )

    # =========================================================
    # OTP
    # =========================================================

    @staticmethod
    def generate_otp() -> str:
        return str(random.randint(100000, 999999))

    @staticmethod
    def get_otp_expiry():
        return datetime.utcnow() + timedelta(minutes=5)

    # =========================================================
    # CUSTOMER REGISTRATION
    # =========================================================

    @staticmethod
    def register_customer(
        db: Session,
        name: str,
        email: str,
        password: str
    ):

        existing_user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if existing_user:
            return {
                "status": "error",
                "message": "Email already registered."
            }

        hashed_password = AuthService.hash_password(password)

        user = User(
            name=name,
            email=email,
            password=hashed_password,
            is_verified=False
        )

        try:
            db.add(user)
            db.flush()

            # Generate OTP
            otp = AuthService.generate_otp()
            expiry = AuthService.get_otp_expiry()

            otp_record = EmailOTP(
                user_id=user.id,
                otp=otp,
                expires_at=expiry,
                is_used=False
            )

            db.add(otp_record)
            db.commit()

            db.refresh(user)

        except Exception:
            db.rollback()
            raise

        # Send OTP email after successful database transaction
        email_result = EmailService.send_otp_email(
            recipient_email=email,
            otp=otp
        )

        if not email_result["success"]:
            print(
                "OTP email failed:",
                email_result["message"]
            )

        return {
            "status": "success",
            "message": "Registration successful. OTP sent to your email.",
            "email": email
        }

    # =========================================================
    # RESEND OTP
    # =========================================================

    @staticmethod
    def resend_otp(
        db: Session,
        email: str
    ):

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not user:
            return {
                "status": "error",
                "message": "User not found."
            }

        if user.is_verified:
            return {
                "status": "error",
                "message": "Email is already verified."
            }

        # Invalidate previous unused OTPs
        previous_otps = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.user_id == user.id,
                EmailOTP.is_used == False
            )
            .all()
        )

        for previous_otp in previous_otps:
            previous_otp.is_used = True

        # Generate new OTP
        otp = AuthService.generate_otp()
        expiry = AuthService.get_otp_expiry()

        new_otp = EmailOTP(
            user_id=user.id,
            otp=otp,
            expires_at=expiry,
            is_used=False
        )

        try:
            db.add(new_otp)
            db.commit()

        except Exception:
            db.rollback()
            raise

        # Send new OTP
        email_result = EmailService.send_otp_email(
            recipient_email=email,
            otp=otp
        )

        if not email_result["success"]:
            print(
                "Resend OTP email failed:",
                email_result["message"]
            )

        return {
            "status": "success",
            "message": "A new OTP has been sent to your email.",
            "email": email
        }

    # =========================================================
    # VERIFY OTP
    # =========================================================

    @staticmethod
    def verify_otp(
        db: Session,
        email: str,
        otp: str
    ):

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not user:
            return {
                "status": "error",
                "message": "User not found."
            }

        if user.is_verified:
            return {
                "status": "error",
                "message": "Email is already verified."
            }

        otp_record = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.user_id == user.id,
                EmailOTP.otp == otp,
                EmailOTP.is_used == False
            )
            .order_by(EmailOTP.id.desc())
            .first()
        )

        if not otp_record:
            return {
                "status": "error",
                "message": "Invalid OTP."
            }

        # Check expiry
        if otp_record.expires_at < datetime.utcnow():

            otp_record.is_used = True
            db.commit()

            return {
                "status": "error",
                "message": "OTP has expired. Please request a new OTP."
            }

        # Mark OTP as used
        otp_record.is_used = True

        # Verify customer
        user.is_verified = True

        try:
            db.commit()

        except Exception:
            db.rollback()
            raise

        # Send registration success email
        registration_email_result = (
            EmailService.send_registration_success_email(
                recipient_email=user.email,
                name=user.name
            )
        )

        if not registration_email_result["success"]:
            print(
                "Registration success email failed:",
                registration_email_result["message"]
            )

        return {
            "status": "success",
            "message": "Email verified successfully. Registration completed."
        }

    # =========================================================
    # CUSTOMER LOGIN
    # =========================================================

    @staticmethod
    def login_customer(
        db: Session,
        email: str,
        password: str
    ):

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not user:
            return {
                "status": "error",
                "message": "Invalid email or password."
            }

        if not AuthService.verify_password(
            password,
            user.password
        ):
            return {
                "status": "error",
                "message": "Invalid email or password."
            }

        if not user.is_verified:
            return {
                "status": "error",
                "message": "Please verify your email before logging in."
            }

        # =====================================================
        # CREATE CUSTOMER JWT
        # =====================================================

        token = JWTService.create_access_token(
            user_id=user.id,
            role="customer"
        )

        # =====================================================
        # CUSTOMER LOGIN SUCCESS EMAIL
        # =====================================================

        login_email_result = (
            EmailService.send_login_success_email(
                recipient_email=user.email,
                name=user.name
            )
        )

        # Email failure should NOT block customer login
        if not login_email_result["success"]:
            print(
                "Customer login success email failed:",
                login_email_result["message"]
            )

        return {
            "status": "success",
            "message": "Login successful.",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        }

    # =========================================================
    # ADMIN LOGIN
    # =========================================================

    @staticmethod
    def login_admin(
        db: Session,
        email: str,
        password: str
    ):

        admin = (
            db.query(Admin)
            .filter(Admin.email == email)
            .first()
        )

        if not admin:
            return {
                "status": "error",
                "message": "Invalid admin email or password."
            }

        if not AuthService.verify_password(
            password,
            admin.password
        ):
            return {
                "status": "error",
                "message": "Invalid admin email or password."
            }

        # =====================================================
        # CREATE ADMIN JWT
        # =====================================================

        token = JWTService.create_access_token(
            user_id=admin.id,
            role="admin"
        )

        # =====================================================
        # ADMIN LOGIN SUCCESS EMAIL
        # =====================================================

        admin_login_email_result = (
            EmailService.send_admin_login_success_email(
                recipient_email=admin.email,
                name=admin.name
            )
        )

        # Email failure should NOT block admin login
        if not admin_login_email_result["success"]:
            print(
                "Admin login success email failed:",
                admin_login_email_result["message"]
            )

        return {
            "status": "success",
            "message": "Admin login successful.",
            "access_token": token,
            "token_type": "bearer",
            "admin": {
                "id": admin.id,
                "name": admin.name,
                "email": admin.email
            }
        }