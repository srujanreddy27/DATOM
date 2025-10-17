#!/usr/bin/env python3
"""
Test if environment variables are being loaded from .env file
"""
import os
from pathlib import Path
from dotenv import load_dotenv

print("=== ENVIRONMENT VARIABLE TEST ===")
print()

# Show current working directory
print(f"Current directory: {os.getcwd()}")
print()

# Check if .env file exists
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
print(f"Looking for .env at: {env_path}")
print(f".env file exists: {env_path.exists()}")
print()

if env_path.exists():
    # Read and show .env file content (first few lines)
    try:
        with open(env_path, 'r') as f:
            content = f.read()
            lines = content.split('\n')[:10]  # First 10 lines
            print("=== .env FILE CONTENT (first 10 lines) ===")
            for i, line in enumerate(lines, 1):
                if line.strip():
                    # Hide password values for security
                    if 'PASSWORD' in line:
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            print(f"{i}: {parts[0]}=***HIDDEN***")
                        else:
                            print(f"{i}: {line}")
                    else:
                        print(f"{i}: {line}")
            print()
    except Exception as e:
        print(f"Error reading .env file: {e}")
        print()

# Load environment variables
print("=== LOADING ENVIRONMENT VARIABLES ===")
result = load_dotenv(env_path)
print(f"load_dotenv result: {result}")
print()

# Check specific variables
print("=== CHECKING EMAIL VARIABLES ===")
smtp_username = os.environ.get('SMTP_USERNAME', 'NOT_FOUND')
smtp_password = os.environ.get('SMTP_PASSWORD', 'NOT_FOUND')
smtp_server = os.environ.get('SMTP_SERVER', 'NOT_FOUND')
smtp_port = os.environ.get('SMTP_PORT', 'NOT_FOUND')
from_email = os.environ.get('FROM_EMAIL', 'NOT_FOUND')

print(f"SMTP_USERNAME: {smtp_username}")
print(f"SMTP_PASSWORD: {'***HIDDEN***' if smtp_password != 'NOT_FOUND' else 'NOT_FOUND'}")
print(f"SMTP_SERVER: {smtp_server}")
print(f"SMTP_PORT: {smtp_port}")
print(f"FROM_EMAIL: {from_email}")
print()

# Check if email service would be configured
is_configured = bool(smtp_username and smtp_password and smtp_username != 'NOT_FOUND' and smtp_password != 'NOT_FOUND')
print(f"Email service would be configured: {is_configured}")
print()

if is_configured:
    print("✅ Environment variables are loaded correctly!")
    print("The email service should work.")
else:
    print("❌ Environment variables are missing or not loaded!")
    print("Check your .env file format and location.")
