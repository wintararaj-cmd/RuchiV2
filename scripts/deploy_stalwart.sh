#!/bin/bash

# Usage: ./deploy_stalwart.sh yourdomain.com

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Error: Domain name required."
    echo "Usage: ./deploy_stalwart.sh <your-domain>"
    echo "Example: ./deploy_stalwart.sh example.com"
    exit 1
fi

echo "=== Setting up Stalwart Mail Server for $DOMAIN ==="

# 1. Create installation directory
INSTALL_DIR="/opt/stalwart"
echo "[1/4] Creating installation directory at $INSTALL_DIR..."
if [ ! -d "$INSTALL_DIR" ]; then
    sudo mkdir -p $INSTALL_DIR
    # Adjust permissions so the current user can write to it if needed, 
    # or rely on sudo for the internal commands. 
    # For simplicity in this script, we'll try to execute subsequent writes with user permissions 
    # assuming the user has sudo rights.
fi

# We'll use a temporary file to write the docker content then move it, 
# or just use tee which is safer with sudo.

# 2. Create docker-compose.yml
echo "[2/4] Creating docker-compose.yml..."
cat << EOF | sudo tee $INSTALL_DIR/docker-compose.yml > /dev/null
services:
  stalwart:
    image: stalwartlabs/stalwart:latest
    container_name: stalwart-mail
    hostname: mail.$DOMAIN
    ports:
      - "25:25"     # SMTP
      - "587:587"   # Submission
      - "465:465"   # SMTPS
      - "143:143"   # IMAP
      - "993:993"   # IMAPS
      - "4190:4190" # ManageSieve
      - "8081:8080" # Web Admin (Changed to 8081 to avoid conflict)
    volumes:
      - ./data:/opt/stalwart-mail
    environment:
      - STALWART_DOMAIN=$DOMAIN
    restart: unless-stopped
EOF

# 3. Display DNS Instructions
echo "[3/4] DNS Configuration Required"
echo "----------------------------------------------------------------"
echo "Before starting the server, ensure these DNS records exist:"
echo ""
echo "Type  Name              Value"
echo "----  ----              -----"
echo "A     mail.$DOMAIN      <YOUR_VPS_IP>"
echo "MX    $DOMAIN           mail.$DOMAIN (Priority 10)"
echo "TXT   $DOMAIN           \"v=spf1 mx ~all\""
echo "TXT   _dmarc.$DOMAIN    \"v=DMARC1; p=none; rua=mailto:dmarc@$DOMAIN\""
echo "----------------------------------------------------------------"

# 4. Prompt to start
echo "[4/4] Ready to start."
read -p "Do you want to start the Stalwart container now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting Stalwart..."
    cd $INSTALL_DIR
    
    # Try docker compose (v2) first, then docker-compose (v1)
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        sudo docker compose up -d
    elif command -v docker-compose >/dev/null 2>&1; then
        sudo docker-compose up -d
    else
        echo "❌ neither 'docker compose' nor 'docker-compose' found. Please install Docker Compose."
        exit 1
    fi
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Stalwart Mail Server started successfully!"
        echo "   Access Admin Panel: http://<YOUR_VPS_IP>:8080"
        echo "   Default Login:      admin / changeme"
        echo "   ⚠️  Change the password immediately!"
    else
        echo "❌ Failed to start Docker container."
    fi
else
    echo "Skipping start. You can start it later with:"
    echo "  cd $INSTALL_DIR && sudo docker compose up -d"
fi
