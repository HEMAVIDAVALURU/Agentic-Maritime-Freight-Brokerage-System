from app.database import SessionLocal
from app.db_models import Admin
from app.services.auth_service import AuthService


# =========================================================
# ADMIN DETAILS
# =========================================================

ADMIN_NAME = "Admin"
ADMIN_EMAIL = "vidavaluruhema569@gmail.com"
ADMIN_PASSWORD = "Admin@12345"


# =========================================================
# CREATE ADMIN
# =========================================================

def create_admin():

    db = SessionLocal()

    try:

        # -----------------------------------------------------
        # Check whether admin already exists
        # -----------------------------------------------------

        existing_admin = (
            db.query(Admin)
            .filter(Admin.email == ADMIN_EMAIL)
            .first()
        )

        if existing_admin:
            print("Admin account already exists.")
            print(f"Email: {existing_admin.email}")
            print("Role: admin")
            return

        # -----------------------------------------------------
        # Hash admin password
        # -----------------------------------------------------

        hashed_password = AuthService.hash_password(
            ADMIN_PASSWORD
        )

        # -----------------------------------------------------
        # Create admin in ADMINS table
        # -----------------------------------------------------

        admin = Admin(
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            password=hashed_password,
            is_active=True
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        # -----------------------------------------------------
        # Success message
        # -----------------------------------------------------

        print("====================================")
        print("ADMIN ACCOUNT CREATED SUCCESSFULLY")
        print("====================================")
        print(f"Email : {admin.email}")
        print("Role  : admin")
        print("Status: Active")
        print("====================================")

    except Exception as e:

        db.rollback()

        print("Error creating admin:")
        print(e)

    finally:

        db.close()


# =========================================================
# RUN SCRIPT
# =========================================================

if __name__ == "__main__":
    create_admin()