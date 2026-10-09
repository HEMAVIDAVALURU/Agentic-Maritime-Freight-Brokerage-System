import os
import smtplib
from html import escape

from email.message import EmailMessage
from dotenv import load_dotenv


load_dotenv()


class EmailService:

    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_EMAIL = os.getenv("SMTP_EMAIL")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

    # =========================================================
    # COMMON GMAIL SMTP EMAIL SENDER
    # =========================================================

    @staticmethod
    def send_email(
        recipient_email: str,
        subject: str,
        html_content: str
    ):
        sender_email = os.getenv("SMTP_EMAIL")
        sender_password = os.getenv("SMTP_PASSWORD")

        if not sender_email:
            return {
                "success": False,
                "message": "Gmail SMTP email is not configured"
            }

        if not sender_password:
            return {
                "success": False,
                "message": "Gmail SMTP app password is not configured"
            }

        message = EmailMessage()

        message["From"] = f"Maritime Freight <{sender_email}>"
        message["To"] = recipient_email
        message["Subject"] = subject

        # Plain-text fallback
        message.set_content(
            "This email contains HTML content. "
            "Please open it in an email client that supports HTML."
        )

        # HTML email
        message.add_alternative(
            html_content,
            subtype="html"
        )

        try:
            with smtplib.SMTP(
                EmailService.SMTP_HOST,
                EmailService.SMTP_PORT,
                timeout=15
            ) as smtp:

                smtp.ehlo()

                # Start encrypted connection
                smtp.starttls()

                smtp.ehlo()

                # Login using Gmail App Password
                smtp.login(
                    sender_email,
                    sender_password
                )

                # Send email
                smtp.send_message(message)

            return {
                "success": True,
                "message": "Email sent successfully"
            }

        except smtplib.SMTPAuthenticationError as error:
            print(
                "Gmail SMTP authentication error:",
                error
            )

            return {
                "success": False,
                "message": "Gmail SMTP authentication failed"
            }

        except smtplib.SMTPException as error:
            print(
                "Gmail SMTP error:",
                error
            )

            return {
                "success": False,
                "message": "Failed to send email"
            }

        except Exception as error:
            print(
                "Email sending error:",
                error
            )

            return {
                "success": False,
                "message": "Unable to send email"
            }

    # =========================================================
    # REGISTRATION OTP EMAIL
    # =========================================================

    @staticmethod
    def send_otp_email(
        recipient_email: str,
        otp: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Maritime Freight Email Verification</h2>

                    <p>Hello,</p>

                    <p>
                        Your OTP for email verification is:
                    </p>

                    <h1>{escape(str(otp))}</h1>

                    <p>
                        This OTP is valid for
                        <strong>5 minutes</strong>.
                    </p>

                    <p>
                        If you requested a new OTP, only the latest
                        OTP can be used.
                    </p>

                    <p>
                        Please do not share this OTP with anyone.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Your Maritime Freight OTP",
            html_content=html_content
        )

    # =========================================================
    # PASSWORD RESET OTP EMAIL
    # =========================================================

    @staticmethod
    def send_password_reset_otp_email(
        recipient_email: str,
        otp: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Maritime Freight Password Reset</h2>

                    <p>Hello,</p>

                    <p>
                        We received a request to reset the password
                        for your Maritime Freight account.
                    </p>

                    <p>
                        Your OTP for password reset is:
                    </p>

                    <h1>{escape(str(otp))}</h1>

                    <p>
                        This OTP is valid for
                        <strong>5 minutes</strong>.
                    </p>

                    <p>
                        If you requested a new OTP, only the latest
                        OTP can be used.
                    </p>

                    <p>
                        Please do not share this OTP with anyone.
                    </p>

                    <p>
                        If you did not request a password reset,
                        you can safely ignore this email.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Password Reset OTP - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # REGISTRATION SUCCESS EMAIL
    # =========================================================

    @staticmethod
    def send_registration_success_email(
        recipient_email: str,
        name: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Registration Successful</h2>

                    <p>
                        Hello <strong>{escape(name)}</strong>,
                    </p>

                    <p>
                        Your Maritime Freight customer account
                        has been successfully registered and your
                        email address has been verified.
                    </p>

                    <p>
                        <strong>Registered Email:</strong>
                        {escape(recipient_email)}
                    </p>

                    <p>
                        You can now log in to your Maritime Freight
                        customer account using the password you created
                        during registration.
                    </p>

                    <p>
                        For security reasons, your password is not
                        included in this email.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Maritime Freight Registration Successful",
            html_content=html_content
        )

    # =========================================================
    # PASSWORD RESET SUCCESS EMAIL
    # =========================================================

    @staticmethod
    def send_password_reset_success_email(
        recipient_email: str,
        name: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Password Updated Successfully</h2>

                    <p>
                        Hello <strong>{escape(name)}</strong>,
                    </p>

                    <p>
                        Your Maritime Freight account password
                        has been successfully updated.
                    </p>

                    <p>
                        You can now log in to your account using
                        your new password.
                    </p>

                    <p>
                        For security reasons, your password is never
                        included in email messages.
                    </p>

                    <p>
                        If you did not make this change, please
                        contact the administrator immediately.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Password Updated Successfully - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # CUSTOMER LOGIN SUCCESS EMAIL
    # =========================================================

    @staticmethod
    def send_login_success_email(
        recipient_email: str,
        name: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Successful Login</h2>

                    <p>
                        Hello <strong>{escape(name)}</strong>,
                    </p>

                    <p>
                        You have successfully logged in to your
                        Maritime Freight customer account.
                    </p>

                    <p>
                        <strong>Login Email:</strong>
                        {escape(recipient_email)}
                    </p>

                    <p>
                        If you did not perform this login, please
                        secure your account immediately.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Maritime Freight Login Successful",
            html_content=html_content
        )

    # =========================================================
    # ADMIN LOGIN SUCCESS EMAIL
    # =========================================================

    @staticmethod
    def send_admin_login_success_email(
        recipient_email: str,
        name: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Admin Login Successful</h2>

                    <p>
                        Hello <strong>{escape(name)}</strong>,
                    </p>

                    <p>
                        You have successfully logged in to the
                        Maritime Freight Admin Dashboard.
                    </p>

                    <p>
                        <strong>Admin Email:</strong>
                        {escape(recipient_email)}
                    </p>

                    <p>
                        Your admin session has been successfully
                        authenticated.
                    </p>

                    <p>
                        If you did not perform this login, please
                        secure your admin account immediately.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Maritime Freight Admin Login Successful",
            html_content=html_content
        )

    # =========================================================
    # NEW QUOTATION APPROVAL REQUEST EMAIL - ADMIN
    # =========================================================

    @staticmethod
    def send_approval_request_email(
        admin_email: str,
        customer_name: str,
        customer_email: str,
        origin: str,
        destination: str,
        cargo_type: str,
        containers: int
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>New Quotation Approval Request</h2>

                    <p>
                        A customer has submitted a quotation
                        for approval.
                    </p>

                    <h3>Customer Details</h3>

                    <p>
                        <strong>Name:</strong>
                        {escape(customer_name)}<br>

                        <strong>Email:</strong>
                        {escape(customer_email)}
                    </p>

                    <h3>Quotation Details</h3>

                    <p>
                        <strong>Origin:</strong>
                        {escape(origin)}<br>

                        <strong>Destination:</strong>
                        {escape(destination)}<br>

                        <strong>Cargo Type:</strong>
                        {escape(cargo_type)}<br>

                        <strong>Containers:</strong>
                        {containers}
                    </p>

                    <p>
                        Please log in to the Maritime Freight
                        Admin Dashboard to review this quotation
                        and approve or reject the request.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=admin_email,
            subject="New Quotation Approval Request - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # QUOTATION SENT FOR APPROVAL EMAIL - USER
    # =========================================================

    @staticmethod
    def send_quotation_sent_email(
        recipient_email: str,
        customer_name: str,
        origin: str,
        destination: str,
        cargo_type: str,
        containers: int
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Quotation Sent for Approval</h2>

                    <p>
                        Hello <strong>{escape(customer_name)}</strong>,
                    </p>

                    <p>
                        Your quotation has been successfully
                        submitted to the Maritime Freight Admin
                        for approval.
                    </p>

                    <h3>Quotation Details</h3>

                    <p>
                        <strong>Origin:</strong>
                        {escape(origin)}<br>

                        <strong>Destination:</strong>
                        {escape(destination)}<br>

                        <strong>Cargo Type:</strong>
                        {escape(cargo_type)}<br>

                        <strong>Containers:</strong>
                        {containers}
                    </p>

                    <p>
                        You will receive another email once the
                        admin reviews your quotation.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Quotation Sent for Approval - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # QUOTATION APPROVED EMAIL - USER
    # =========================================================

    @staticmethod
    def send_quotation_approved_email(
        recipient_email: str,
        customer_name: str,
        origin: str,
        destination: str,
        cargo_type: str,
        containers: int
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Quotation Approved</h2>

                    <p>
                        Hello <strong>{escape(customer_name)}</strong>,
                    </p>

                    <p>
                        Your quotation has been
                        <strong>approved</strong> by the
                        Maritime Freight Admin.
                    </p>

                    <h3>Quotation Details</h3>

                    <p>
                        <strong>Origin:</strong>
                        {escape(origin)}<br>

                        <strong>Destination:</strong>
                        {escape(destination)}<br>

                        <strong>Cargo Type:</strong>
                        {escape(cargo_type)}<br>

                        <strong>Containers:</strong>
                        {containers}
                    </p>

                    <p>
                        Please log in to your Maritime Freight
                        account to view the approved quotation.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Quotation Approved - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # QUOTATION REJECTED EMAIL - USER
    # =========================================================

    @staticmethod
    def send_quotation_rejected_email(
        recipient_email: str,
        customer_name: str,
        origin: str,
        destination: str,
        cargo_type: str,
        containers: int,
        rejection_reason: str | None = None
    ):
        reason_html = ""

        if rejection_reason:
            reason_html = f"""
                <p>
                    <strong>Reason:</strong>
                    {escape(rejection_reason)}
                </p>
            """

        html_content = f"""
            <html>
                <body>
                    <h2>Quotation Rejected</h2>

                    <p>
                        Hello <strong>{escape(customer_name)}</strong>,
                    </p>

                    <p>
                        Your quotation has been
                        <strong>rejected</strong> by the
                        Maritime Freight Admin.
                    </p>

                    <h3>Quotation Details</h3>

                    <p>
                        <strong>Origin:</strong>
                        {escape(origin)}<br>

                        <strong>Destination:</strong>
                        {escape(destination)}<br>

                        <strong>Cargo Type:</strong>
                        {escape(cargo_type)}<br>

                        <strong>Containers:</strong>
                        {containers}
                    </p>

                    {reason_html}

                    <p>
                        Please log in to your Maritime Freight
                        account for more information.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Quotation Rejected - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # SECURITY EMAIL NOTIFICATIONS
    # =========================================================

    @staticmethod
    def send_email_changed_email(
        recipient_email: str,
        new_email: str
    ):
        html_content = f"""
            <html>
                <body>
                    <h2>Maritime Freight Email Address Changed</h2>

                    <p>
                        Your Maritime Freight account email address
                        was changed successfully.
                    </p>

                    <p>
                        <strong>New email:</strong>
                        {escape(str(new_email))}
                    </p>

                    <p>
                        If you did not make this change, please
                        contact the administrator immediately.
                    </p>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Maritime Freight Email Address Changed",
            html_content=html_content
        )

    # =========================================================
    # PASSWORD CHANGED EMAIL
    # =========================================================

    @staticmethod
    def send_password_changed_email(
        recipient_email: str
    ):
        html_content = """
            <html>
                <body>
                    <h2>Maritime Freight Password Changed</h2>

                    <p>
                        Your Maritime Freight account password
                        was changed successfully.
                    </p>

                    <p>
                        For security, your password is never
                        included in email messages.
                    </p>

                    <p>
                        If you did not make this change, please
                        contact the administrator immediately.
                    </p>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=recipient_email,
            subject="Maritime Freight Password Changed",
            html_content=html_content
        )

    # =========================================================
    # FEEDBACK RECEIVED EMAIL - ADMIN
    # =========================================================

    @staticmethod
    def send_feedback_received_email(
        admin_email: str,
        customer_name: str,
        customer_email: str,
        rating: int,
        feedback_text: str,
        quotation_id: int | None = None
    ):
        quotation_html = ""

        if quotation_id is not None:
            quotation_html = f"""
                <p>
                    <strong>Quotation ID:</strong>
                    #{quotation_id}
                </p>
            """

        safe_feedback = escape(
            feedback_text or "No written feedback provided."
        )

        html_content = f"""
            <html>
                <body>

                    <h2>New Customer Feedback Received</h2>

                    <p>
                        A customer has submitted new feedback
                        through the Maritime Freight system.
                    </p>

                    <h3>Customer Details</h3>

                    <p>
                        <strong>Name:</strong>
                        {escape(customer_name)}<br>

                        <strong>Email:</strong>
                        {escape(customer_email)}
                    </p>

                    <h3>Feedback Details</h3>

                    <p>
                        <strong>Rating:</strong>
                        {rating}/5
                    </p>

                    {quotation_html}

                    <p>
                        <strong>Feedback:</strong>
                    </p>

                    <div
                        style="
                            background:#f7f1e8;
                            border-left:4px solid #795235;
                            padding:12px;
                            margin:10px 0;
                        "
                    >
                        {safe_feedback}
                    </div>

                    <p>
                        Please log in to the Maritime Freight
                        Admin Dashboard to view the feedback
                        and respond to the customer.
                    </p>

                    <br>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>

                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=admin_email,
            subject="New Customer Feedback - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # FEEDBACK SUBMISSION CONFIRMATION EMAIL - USER
    # =========================================================

    @staticmethod
    def send_feedback_submission_confirmation_email(
        customer_email: str,
        customer_name: str,
        rating: int,
        feedback_text: str,
        quotation_id: int | None = None
    ):
        quotation_html = ""

        if quotation_id is not None:
            quotation_html = f"""
                <p>
                    <strong>Quotation ID:</strong>
                    #{quotation_id}
                </p>
            """

        safe_feedback = escape(
            feedback_text or "No written feedback provided."
        )

        html_content = f"""
            <html>
                <body>
                    <h2>Feedback Submitted Successfully</h2>

                    <p>Hello {escape(customer_name)},</p>

                    <p>
                        Your feedback has been successfully submitted
                        to the Maritime Freight Admin team.
                    </p>

                    <h3>Feedback Details</h3>

                    <p><strong>Rating:</strong> {rating}/5</p>

                    {quotation_html}

                    <p><strong>Your Feedback:</strong></p>

                    <div
                        style="
                            background:#f7f1e8;
                            border-left:4px solid #795235;
                            padding:12px;
                            margin:10px 0;
                        "
                    >
                        {safe_feedback}
                    </div>

                    <p>
                        Thank you for helping us improve our
                        Maritime Freight service.
                    </p>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=customer_email,
            subject="Feedback Submitted Successfully - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # FEEDBACK REPLY EMAIL - USER
    # =========================================================

    @staticmethod
    def send_feedback_reply_email(
        customer_email: str,
        customer_name: str,
        rating: int,
        feedback_text: str,
        admin_response: str,
        quotation_id: int | None = None
    ):
        quotation_html = ""

        if quotation_id is not None:
            quotation_html = f"""
                <p>
                    <strong>Quotation ID:</strong>
                    #{quotation_id}
                </p>
            """

        safe_feedback = escape(
            feedback_text or "No written feedback provided."
        )

        safe_response = escape(
            admin_response or ""
        )

        html_content = f"""
            <html>
                <body>
                    <h2>Admin Has Responded to Your Feedback</h2>

                    <p>Hello {escape(customer_name)},</p>

                    <p>
                        The Maritime Freight Admin team has responded
                        to your feedback.
                    </p>

                    <h3>Your Feedback</h3>

                    <p>
                        <strong>Rating:</strong>
                        {rating}/5
                    </p>

                    {quotation_html}

                    <div
                        style="
                            background:#f7f1e8;
                            border-left:4px solid #795235;
                            padding:12px;
                            margin:10px 0;
                        "
                    >
                        {safe_feedback}
                    </div>

                    <h3>Admin Response</h3>

                    <div
                        style="
                            background:#f7f1e8;
                            border-left:4px solid #795235;
                            padding:12px;
                            margin:10px 0;
                        "
                    >
                        {safe_response}
                    </div>

                    <p>
                        You can also view this response from your
                        Feedback page in the Maritime Freight system.
                    </p>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=customer_email,
            subject="Admin Response to Your Feedback - Maritime Freight",
            html_content=html_content
        )

    # =========================================================
    # FEEDBACK REPLY CONFIRMATION EMAIL - ADMIN
    # =========================================================

    @staticmethod
    def send_feedback_reply_confirmation_email(
        admin_email: str,
        admin_name: str,
        customer_name: str,
        customer_email: str,
        rating: int,
        admin_response: str,
        quotation_id: int | None = None
    ):
        quotation_html = ""

        if quotation_id is not None:
            quotation_html = f"""
                <p>
                    <strong>Quotation ID:</strong>
                    #{quotation_id}
                </p>
            """

        safe_response = escape(
            admin_response or ""
        )

        html_content = f"""
            <html>
                <body>
                    <h2>Feedback Response Sent Successfully</h2>

                    <p>Hello {escape(admin_name)},</p>

                    <p>
                        Your response to the customer's feedback
                        was successfully saved and sent.
                    </p>

                    <h3>Customer Details</h3>

                    <p>
                        <strong>Name:</strong>
                        {escape(customer_name)}<br>

                        <strong>Email:</strong>
                        {escape(customer_email)}
                    </p>

                    <h3>Response Details</h3>

                    <p>
                        <strong>Original Rating:</strong>
                        {rating}/5
                    </p>

                    {quotation_html}

                    <p>
                        <strong>Your Response:</strong>
                    </p>

                    <div
                        style="
                            background:#f7f1e8;
                            border-left:4px solid #795235;
                            padding:12px;
                            margin:10px 0;
                        "
                    >
                        {safe_response}
                    </div>

                    <p>
                        Regards,<br>
                        Maritime Freight Team
                    </p>
                </body>
            </html>
        """

        return EmailService.send_email(
            recipient_email=admin_email,
            subject="Feedback Response Sent - Maritime Freight",
            html_content=html_content
        )