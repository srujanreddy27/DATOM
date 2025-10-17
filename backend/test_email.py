#!/usr/bin/env python3
"""
Simple email test script to verify SMTP configuration works
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
load_dotenv(env_path)

def test_email_sending():
    """Test if email sending works with current configuration"""
    
    # Get email configuration
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_username = os.environ.get('SMTP_USERNAME', '')
    smtp_password = os.environ.get('SMTP_PASSWORD', '')
    from_email = os.environ.get('FROM_EMAIL', smtp_username)
    from_name = os.environ.get('FROM_NAME', 'DecentraTask')
    
    print("=== EMAIL CONFIGURATION TEST ===")
    print(f"SMTP Server: {smtp_server}")
    print(f"SMTP Port: {smtp_port}")
    print(f"Username: {smtp_username}")
    print(f"Password: {'*' * len(smtp_password) if smtp_password else 'NOT SET'}")
    print(f"From Email: {from_email}")
    print(f"From Name: {from_name}")
    print()
    
    if not smtp_username or not smtp_password:
        print("❌ ERROR: SMTP_USERNAME or SMTP_PASSWORD not set!")
        return False
    
    # Test email content
    test_otp = "123456"
    to_email = smtp_username  # Send test email to yourself
    
    try:
        print("🔄 Creating email message...")
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = to_email
        msg['Subject'] = "🧪 EMAIL TEST - DecentraTask OTP"
        
        # Simple HTML body
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px;">🧪 EMAIL TEST</h1>
                <p style="margin: 10px 0; font-size: 16px;">DecentraTask Email Service Test</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                <h2 style="color: #333; margin-bottom: 20px;">Test OTP Code</h2>
                <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; border: 2px dashed #667eea;">
                    <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px;">{test_otp}</div>
                </div>
                <p style="color: #666; margin-top: 15px; font-size: 14px;">
                    If you received this email, your SMTP configuration is working correctly! 🎉
                </p>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 12px;">
                <p>This is a test email from DecentraTask</p>
                <p>Time: {os.environ.get('COMPUTERNAME', 'Unknown')} - Test Mode</p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        print("📧 Connecting to SMTP server...")
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            print("🔐 Starting TLS...")
            server.starttls()
            
            print("🔑 Logging in...")
            server.login(smtp_username, smtp_password)
            
            print("📤 Sending email...")
            server.send_message(msg)
        
        print("✅ SUCCESS! Test email sent successfully!")
        print(f"📬 Check your inbox: {to_email}")
        print()
        print("🎉 Your email configuration is working!")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print("❌ AUTHENTICATION ERROR!")
        print("   - Check your Gmail app password")
        print("   - Make sure 2-factor authentication is enabled")
        print("   - Verify the app password is correct (no spaces)")
        print(f"   Error: {e}")
        return False
        
    except smtplib.SMTPRecipientsRefused as e:
        print("❌ RECIPIENT ERROR!")
        print("   - Check the email address is valid")
        print(f"   Error: {e}")
        return False
        
    except smtplib.SMTPServerDisconnected as e:
        print("❌ CONNECTION ERROR!")
        print("   - Check your internet connection")
        print("   - Verify SMTP server and port")
        print(f"   Error: {e}")
        return False
        
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
        print("   - Check all your email settings")
        print("   - Try using a different email provider")
        return False

if __name__ == "__main__":
    print("🚀 Starting email configuration test...\n")
    
    success = test_email_sending()
    
    if success:
        print("\n🎯 NEXT STEPS:")
        print("1. Check your email inbox for the test message")
        print("2. If received, your forgot password feature should work!")
        print("3. Restart your server and test the forgot password flow")
    else:
        print("\n🔧 TROUBLESHOOTING:")
        print("1. Double-check your Gmail app password")
        print("2. Ensure 2-factor authentication is enabled")
        print("3. Try generating a new app password")
        print("4. Check your .env file format")
