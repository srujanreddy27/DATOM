import os
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
from datetime import datetime, timezone, timedelta
import asyncio

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        # Email configuration from environment variables
        self.smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        self.smtp_username = os.environ.get('SMTP_USERNAME', '')
        self.smtp_password = os.environ.get('SMTP_PASSWORD', '')
        self.from_email = os.environ.get('FROM_EMAIL', self.smtp_username)
        self.from_name = os.environ.get('FROM_NAME', 'DecentraTask')
        
        # Check if email service is configured
        self.is_configured = bool(self.smtp_username and self.smtp_password)
        
        if not self.is_configured:
            logger.warning("Email service not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.")
        else:
            logger.info(f"✅ Email service configured successfully for {self.smtp_username}")
    
    def generate_otp(self, length: int = 6) -> str:
        """Generate a random OTP"""
        return ''.join(random.choices(string.digits, k=length))
    
    async def send_otp_email(self, to_email: str, otp: str) -> bool:
        """Send OTP email to user"""
        if not self.is_configured:
            logger.error("Email service not configured")
            return False
        
        try:
            # Run email sending in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self._send_otp_email_sync, to_email, otp)
        except Exception as e:
            logger.error(f"Failed to send OTP email to {to_email}: {e}")
            return False
    
    def _send_otp_email_sync(self, to_email: str, otp: str) -> bool:
        """Synchronous email sending method"""
        try:
            logger.info(f"📧 Creating email message for {to_email}")
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = "Password Reset OTP - DecentraTask"
            
            logger.info(f"📧 Email details - From: {self.from_email}, To: {to_email}, Subject: Password Reset OTP")
            
            # Email body
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">DecentraTask Security</p>
                </div>
                
                <div style="background: #f8fafc; padding: 30px; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #1e293b; margin-top: 0;">Your Password Reset Code</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                        We received a request to reset your password. Use the following OTP to proceed:
                    </p>
                    
                    <div style="background: white; border: 2px solid #14b8a6; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #14b8a6; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            {otp}
                        </div>
                    </div>
                    
                    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            ⚠️ <strong>Important:</strong> This OTP will expire in 10 minutes. Don't share it with anyone.
                        </p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px; margin-top: 25px;">
                        If you didn't request this password reset, please ignore this email. Your account remains secure.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        This email was sent by DecentraTask - Decentralized Task Outsourcing Platform
                    </p>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"OTP email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send OTP email to {to_email}: {e}")
            return False
    
    async def send_password_reset_confirmation(self, to_email: str) -> bool:
        """Send password reset confirmation email"""
        if not self.is_configured:
            logger.error("Email service not configured")
            return False
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = "Password Reset Successful - DecentraTask"
            
            # Email body
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Password Reset Successful</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">DecentraTask Security</p>
                </div>
                
                <div style="background: #f8fafc; padding: 30px; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #1e293b; margin-top: 0;">Your password has been reset</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                        Your DecentraTask account password has been successfully reset. You can now log in with your new password.
                    </p>
                    
                    <div style="background: #dcfdf7; border: 1px solid #10b981; border-radius: 6px; padding: 15px; margin: 20px 0;">
                        <p style="color: #047857; margin: 0; font-size: 14px;">
                            🔒 <strong>Security Tip:</strong> Keep your password secure and don't share it with anyone.
                        </p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px; margin-top: 25px;">
                        If you didn't reset your password, please contact our support team immediately.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        This email was sent by DecentraTask - Decentralized Task Outsourcing Platform
                    </p>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Password reset confirmation email sent to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send confirmation email to {to_email}: {e}")
            return False

# Global email service instance
email_service = EmailService()
