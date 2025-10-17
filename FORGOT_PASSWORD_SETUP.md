# Forgot Password Setup Guide

## Overview
The forgot password feature has been implemented with actual OTP (One-Time Password) email sending and verification. This replaces the previous Firebase-only password reset with a more robust system.

## Features Implemented
✅ **Email Service Integration** - Uses SMTP to send actual emails  
✅ **OTP Generation & Storage** - 6-digit codes stored in Firebase with expiration  
✅ **Beautiful Email Templates** - Professional HTML emails with OTP codes  
✅ **Frontend OTP Modal** - Interactive modal for OTP entry and password reset  
✅ **Security Features** - OTP expiration (10 minutes), one-time use, email validation  
✅ **Development Mode** - Shows OTP in response when email service not configured  

## Setup Instructions

### 1. Install Dependencies
The required dependencies are already added to `requirements.txt`:
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Email Service
Add these environment variables to your `.env` file:

```env
# Email Service Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=DecentraTask
```

### 3. Gmail Setup (Recommended)
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `SMTP_PASSWORD`

### 4. Alternative Email Providers
You can use other SMTP providers by changing the settings:

**Outlook/Hotmail:**
```env
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
```

**Yahoo:**
```env
SMTP_SERVER=smtp.mail.yahoo.com
SMTP_PORT=587
```

## API Endpoints

### 1. Request Password Reset
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account with this email exists, you will receive a password reset code."
}
```

**Development Mode Response (when email not configured):**
```json
{
  "message": "Email service not configured. Your OTP is: 123456",
  "otp": "123456",
  "expires_in_minutes": 10
}
```

### 2. Verify OTP and Reset Password
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "new_password": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successful. You can now log in with your new password."
}
```

### 3. Resend OTP
```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

## Testing the Flow

### 1. Without Email Configuration (Development)
1. Start the backend server
2. Go to login page (`/login.html`)
3. Click "Forgot password?"
4. Enter any registered email
5. The OTP will be shown in the response/console
6. Use the OTP in the modal to reset password

### 2. With Email Configuration (Production)
1. Configure email settings in `.env`
2. Start the backend server
3. Go to login page
4. Click "Forgot password?"
5. Enter a registered email
6. Check your email for the OTP
7. Enter OTP and new password in the modal

## Security Features

- **Email Validation**: Only sends OTP to registered email addresses
- **OTP Expiration**: Codes expire after 10 minutes
- **One-Time Use**: Each OTP can only be used once
- **Rate Limiting**: Built-in protection against spam
- **Secure Storage**: OTPs are stored securely in Firebase
- **Password Validation**: New passwords must be at least 6 characters

## Troubleshooting

### Email Not Sending
1. Check SMTP credentials in `.env`
2. Verify Gmail App Password is correct
3. Check server logs for email errors
4. Test with development mode first

### OTP Not Working
1. Check if OTP has expired (10 minutes)
2. Verify email address is registered
3. Check Firebase connection
4. Look for errors in browser console

### Frontend Issues
1. Check browser console for JavaScript errors
2. Verify backend URL is correct
3. Check network requests in browser dev tools

## File Structure

```
backend/
├── email_service.py          # Email sending functionality
├── firebase_db.py            # OTP storage methods
├── server.py                 # Forgot password endpoints
└── requirements.txt          # Updated dependencies

frontend/public/
└── login.html                # Updated with OTP modal
```

## Email Template Preview

The system sends beautiful HTML emails with:
- Professional DecentraTask branding
- Large, easy-to-read OTP display
- Security warnings and expiration info
- Responsive design for all devices

## Next Steps

1. **Configure Email Service**: Set up SMTP credentials
2. **Test Flow**: Try the complete forgot password process
3. **Customize Templates**: Modify email templates if needed
4. **Monitor Usage**: Check logs for any issues
5. **Production Deploy**: Ensure email service works in production

## Support

If you encounter any issues:
1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with development mode first
4. Check Firebase connection and permissions
