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
        password: str,
        company_name: str | None = None
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
            company_name=(
                company_name.strip()
                if company_name
                else None
            ),
            is_verified=False
        )

        try:
            db.add(user)
            db.flush()

            otp = AuthService.generate_otp()
            expiry = AuthService.get_otp_expiry()

            otp_record = EmailOTP(
                user_id=user.id,
                otp=otp,
                purpose="registration",
                expires_at=expiry,
                is_used=False
            )

            db.add(otp_record)
            db.commit()

            db.refresh(user)

        except Exception:
            db.rollback()
            raise

        # =====================================================
        # REGISTRATION OTP EMAIL
        # =====================================================

        if user.email_notifications:

            email_result = EmailService.send_otp_email(
                recipient_email=email,
                otp=otp
            )

            if not email_result["success"]:
                print(
                    "OTP email failed:",
                    email_result["message"]
                )

        else:

            print(
                "OTP email skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": (
                "Registration successful. "
                "OTP sent to your email."
            ),
            "email": email
        }

    # =========================================================
    # RESEND REGISTRATION OTP
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

        previous_otps = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.user_id == user.id,
                EmailOTP.purpose == "registration",
                EmailOTP.is_used == False
            )
            .all()
        )

        for previous_otp in previous_otps:
            previous_otp.is_used = True

        otp = AuthService.generate_otp()
        expiry = AuthService.get_otp_expiry()

        new_otp = EmailOTP(
            user_id=user.id,
            otp=otp,
            purpose="registration",
            expires_at=expiry,
            is_used=False
        )

        try:
            db.add(new_otp)
            db.commit()

        except Exception:
            db.rollback()
            raise

        # =====================================================
        # RESEND REGISTRATION OTP EMAIL
        # =====================================================

        if user.email_notifications:

            email_result = EmailService.send_otp_email(
                recipient_email=email,
                otp=otp
            )

            if not email_result["success"]:
                print(
                    "Resend OTP email failed:",
                    email_result["message"]
                )

        else:

            print(
                "Resend OTP email skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": "A new OTP has been sent to your email.",
            "email": email
        }

    # =========================================================
    # VERIFY REGISTRATION OTP
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
                EmailOTP.purpose == "registration",
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

        if otp_record.expires_at < datetime.utcnow():

            otp_record.is_used = True
            db.commit()

            return {
                "status": "error",
                "message": (
                    "OTP has expired. "
                    "Please request a new OTP."
                )
            }

        otp_record.is_used = True
        user.is_verified = True

        try:
            db.commit()

        except Exception:
            db.rollback()
            raise

        # =====================================================
        # REGISTRATION SUCCESS EMAIL
        # =====================================================

        if user.email_notifications:

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

        else:

            print(
                "Registration success email skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": (
                "Email verified successfully. "
                "Registration completed."
            )
        }

    # =========================================================
    # FORGOT PASSWORD - REQUEST OTP
    # =========================================================

    @staticmethod
    def request_password_reset(
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
                "message": "No account found with this email address."
            }

        if not user.is_active:
            return {
                "status": "error",
                "message": "This account is inactive."
            }

        # -----------------------------------------------------
        # Invalidate previous password-reset OTPs
        # -----------------------------------------------------

        previous_otps = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.user_id == user.id,
                EmailOTP.purpose == "password_reset",
                EmailOTP.is_used == False
            )
            .all()
        )

        for previous_otp in previous_otps:
            previous_otp.is_used = True

        # -----------------------------------------------------
        # Generate new password-reset OTP
        # -----------------------------------------------------

        otp = AuthService.generate_otp()
        expiry = AuthService.get_otp_expiry()

        otp_record = EmailOTP(
            user_id=user.id,
            otp=otp,
            purpose="password_reset",
            expires_at=expiry,
            is_used=False
        )

        try:
            db.add(otp_record)
            db.commit()

        except Exception:
            db.rollback()
            raise

        # =====================================================
        # PASSWORD RESET OTP EMAIL
        # =====================================================

        if user.email_notifications:

            email_result = EmailService.send_password_reset_otp_email(
                recipient_email=user.email,
                otp=otp
            )

            if not email_result["success"]:
                print(
                    "Password reset OTP email failed:",
                    email_result["message"]
                )

        else:

            print(
                "Password reset OTP email skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": (
                "If the email is registered and Email Notifications "
                "are enabled, a password reset OTP has been sent."
            ),
            "email": user.email
        }

    # =========================================================
    # FORGOT PASSWORD - VERIFY RESET OTP
    # =========================================================

    @staticmethod
    def verify_password_reset_otp(
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
                "message": "Invalid OTP."
            }

        otp_record = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.user_id == user.id,
                EmailOTP.otp == otp,
                EmailOTP.purpose == "password_reset",
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

        if otp_record.expires_at < datetime.utcnow():

            otp_record.is_used = True

            try:
                db.commit()
            except Exception:
                db.rollback()
                raise

            return {
                "status": "error",
                "message": (
                    "OTP has expired. "
                    "Please request a new password reset OTP."
                )
            }

        return {
            "status": "success",
            "message": "OTP verified successfully.",
            "email": user.email
        }

    # =========================================================
    # FORGOT PASSWORD - RESET PASSWORD
    # =========================================================

    @staticmethod
    def reset_password(
        db: Session,
        email: str,
        otp: str,
        new_password: str
    ):

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not user:
            return {
                "status": "error",
                "message": "Invalid password reset request."
            }

        # -----------------------------------------------------
        # Password validation
        # -----------------------------------------------------

        if len(new_password) < 8:
            return {
                "status": "error",
                "message": (
                    "New password must contain "
                    "at least 8 characters."
                )
            }

        # -----------------------------------------------------
        # Find verified password-reset OTP
        # -----------------------------------------------------

        otp_record = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.user_id == user.id,
                EmailOTP.otp == otp,
                EmailOTP.purpose == "password_reset",
                EmailOTP.is_used == False
            )
            .order_by(EmailOTP.id.desc())
            .first()
        )

        if not otp_record:
            return {
                "status": "error",
                "message": (
                    "Invalid or already used password "
                    "reset OTP."
                )
            }

        # -----------------------------------------------------
        # Check expiry again
        # -----------------------------------------------------

        if otp_record.expires_at < datetime.utcnow():

            otp_record.is_used = True

            try:
                db.commit()
            except Exception:
                db.rollback()
                raise

            return {
                "status": "error",
                "message": (
                    "Password reset OTP has expired. "
                    "Please request a new OTP."
                )
            }

        # -----------------------------------------------------
        # Prevent using the same password
        # -----------------------------------------------------

        if AuthService.verify_password(
            new_password,
            user.password
        ):
            return {
                "status": "error",
                "message": (
                    "New password must be different "
                    "from the current password."
                )
            }

        # -----------------------------------------------------
        # Hash new password
        # -----------------------------------------------------

        user.password = AuthService.hash_password(
            new_password
        )

        # -----------------------------------------------------
        # Consume OTP
        # -----------------------------------------------------

        otp_record.is_used = True

        try:
            db.commit()
            db.refresh(user)

        except Exception:
            db.rollback()
            raise

        # =====================================================
        # PASSWORD RESET SUCCESS EMAIL
        # =====================================================

        if user.email_notifications:

            email_result = (
                EmailService.send_password_reset_success_email(
                    recipient_email=user.email,
                    name=user.name
                )
            )

            if not email_result["success"]:
                print(
                    "Password reset success email failed:",
                    email_result["message"]
                )

        else:

            print(
                "Password reset success email skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": (
                "Password reset successfully. "
                "You can now log in with your new password."
            )
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
                "message": (
                    "Please verify your email "
                    "before logging in."
                )
            }

        token = JWTService.create_access_token(
            user_id=user.id,
            role="customer"
        )

        # =====================================================
        # CUSTOMER LOGIN SUCCESS EMAIL
        # =====================================================

        if user.email_notifications:

            login_email_result = (
                EmailService.send_login_success_email(
                    recipient_email=user.email,
                    name=user.name
                )
            )

            if not login_email_result["success"]:
                print(
                    "Customer login success email failed:",
                    login_email_result["message"]
                )

        else:

            print(
                "Customer login success email skipped because "
                "Email Notifications are OFF."
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

        token = JWTService.create_access_token(
            user_id=admin.id,
            role="admin"
        )

        # =====================================================
        # ADMIN LOGIN SUCCESS EMAIL
        # =====================================================

        if admin.email_notifications:

            admin_login_email_result = (
                EmailService.send_admin_login_success_email(
                    recipient_email=admin.email,
                    name=admin.name
                )
            )

            if not admin_login_email_result["success"]:
                print(
                    "Admin login success email failed:",
                    admin_login_email_result["message"]
                )

        else:

            print(
                "Admin login notification email skipped "
                "because Email Notifications are OFF."
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

    # =========================================================
    # CUSTOMER CHANGE EMAIL
    # =========================================================

    @staticmethod
    def change_customer_email(
        db: Session,
        user_id: int,
        current_email: str,
        current_password: str,
        new_email: str
    ):

        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if not user:
            return {
                "status": "error",
                "message": "Customer account not found."
            }

        if user.email.lower() != current_email.lower():
            return {
                "status": "error",
                "message": "Current email address is incorrect."
            }

        if not AuthService.verify_password(
            current_password,
            user.password
        ):
            return {
                "status": "error",
                "message": "Current password is incorrect."
            }

        if user.email.lower() == new_email.lower():
            return {
                "status": "error",
                "message": (
                    "New email must be different "
                    "from the current email."
                )
            }

        existing_user = (
            db.query(User)
            .filter(
                User.email == new_email,
                User.id != user_id
            )
            .first()
        )

        if existing_user:
            return {
                "status": "error",
                "message": "This email is already registered."
            }

        user.email = new_email

        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            return {
                "status": "error",
                "message": "Unable to update email address."
            }

        # =====================================================
        # EMAIL CHANGE NOTIFICATION
        # =====================================================

        if user.email_notifications:

            email_result = EmailService.send_email_changed_email(
                recipient_email=user.email,
                new_email=user.email
            )

            if not email_result.get("success"):
                print(
                    "Email-change notification failed:",
                    email_result.get("message")
                )

        else:

            print(
                "Email-change notification skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": "Email address updated successfully.",
            "email": user.email
        }

    # =========================================================
    # CUSTOMER CHANGE PASSWORD
    # =========================================================

    @staticmethod
    def change_customer_password(
        db: Session,
        user_id: int,
        current_password: str,
        new_password: str
    ):

        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if not user:
            return {
                "status": "error",
                "message": "Customer account not found."
            }

        if not AuthService.verify_password(
            current_password,
            user.password
        ):
            return {
                "status": "error",
                "message": "Current password is incorrect."
            }

        if len(new_password) < 8:
            return {
                "status": "error",
                "message": (
                    "New password must contain "
                    "at least 8 characters."
                )
            }

        if AuthService.verify_password(
            new_password,
            user.password
        ):
            return {
                "status": "error",
                "message": (
                    "New password must be different "
                    "from the current password."
                )
            }

        user.password = AuthService.hash_password(
            new_password
        )

        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            return {
                "status": "error",
                "message": "Unable to update password."
            }

        # =====================================================
        # PASSWORD CHANGE NOTIFICATION
        # =====================================================

        if user.email_notifications:

            email_result = EmailService.send_password_changed_email(
                recipient_email=user.email
            )

            if not email_result.get("success"):
                print(
                    "Password-change notification failed:",
                    email_result.get("message")
                )

        else:

            print(
                "Password-change notification skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": "Password updated successfully."
        }

    # =========================================================
    # CHANGE ADMIN EMAIL
    # =========================================================

    @staticmethod
    def change_admin_email(
        db: Session,
        admin_id: int,
        current_email: str,
        new_email: str
    ):

        admin = (
            db.query(Admin)
            .filter(Admin.id == admin_id)
            .first()
        )

        if not admin:
            return {
                "status": "error",
                "message": "Admin account not found."
            }

        if admin.email.lower() != current_email.lower():
            return {
                "status": "error",
                "message": "Current email address is incorrect."
            }

        if admin.email.lower() == new_email.lower():
            return {
                "status": "error",
                "message": (
                    "New email must be different "
                    "from the current email."
                )
            }

        existing_admin = (
            db.query(Admin)
            .filter(
                Admin.email == new_email,
                Admin.id != admin_id
            )
            .first()
        )

        if existing_admin:
            return {
                "status": "error",
                "message": "This email is already in use."
            }

        admin.email = new_email

        try:
            db.commit()
            db.refresh(admin)
        except Exception:
            db.rollback()
            return {
                "status": "error",
                "message": "Unable to update email address."
            }

        # =====================================================
        # ADMIN EMAIL CHANGE NOTIFICATION
        # =====================================================

        if admin.email_notifications:

            email_result = EmailService.send_email_changed_email(
                recipient_email=admin.email,
                new_email=admin.email
            )

            if not email_result.get("success"):
                print(
                    "Admin email-change notification failed:",
                    email_result.get("message")
                )

        else:

            print(
                "Admin email-change notification skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": "Admin email updated successfully.",
            "email": admin.email
        }

    # =========================================================
    # CHANGE ADMIN PASSWORD
    # =========================================================

    @staticmethod
    def change_admin_password(
        db: Session,
        admin_id: int,
        current_password: str,
        new_password: str
    ):

        admin = (
            db.query(Admin)
            .filter(Admin.id == admin_id)
            .first()
        )

        if not admin:
            return {
                "status": "error",
                "message": "Admin account not found."
            }

        if not AuthService.verify_password(
            current_password,
            admin.password
        ):
            return {
                "status": "error",
                "message": "Current password is incorrect."
            }

        if AuthService.verify_password(
            new_password,
            admin.password
        ):
            return {
                "status": "error",
                "message": (
                    "New password must be different "
                    "from the current password."
                )
            }

        admin.password = AuthService.hash_password(
            new_password
        )

        try:
            db.commit()
            db.refresh(admin)
        except Exception:
            db.rollback()
            raise

        # =====================================================
        # ADMIN PASSWORD CHANGE NOTIFICATION
        # =====================================================

        if admin.email_notifications:

            email_result = EmailService.send_password_changed_email(
                recipient_email=admin.email
            )

            if not email_result.get("success"):
                print(
                    "Admin password-change notification failed:",
                    email_result.get("message")
                )

        else:

            print(
                "Admin password-change notification skipped because "
                "Email Notifications are OFF."
            )

        return {
            "status": "success",
            "message": "Admin password updated successfully."
        }