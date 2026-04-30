#!/bin/bash
# Cloudflare Tunnel Setup for School Network Access
# Run this on your Raspberry Pi to set up secure access that works with Proton VPN
# Usage: ssh into Pi with PowerShell, then run this script

echo "🔧 Setting up Cloudflare Tunnel for school network access..."
echo "   This will allow access from school networks + Proton VPN"
echo ""

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi."
    echo "    This script is designed for Raspberry Pi OS."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install cloudflared
echo "⬇️  Downloading and installing cloudflared..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# Check if domain is configured
read -p "Enter your domain (e.g., pi.morrisprints.co.uk): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "❌ No domain provided. Exiting."
    exit 1
fi

echo "🔐 Next step: Cloudflare login"
echo "   This will open a browser window for authentication."
echo "   If you're SSH'd in, you'll need to complete this on another device."
echo ""
read -p "Press Enter when ready to continue..."

cloudflared tunnel login

echo "🌐 Creating tunnel..."
TUNNEL_NAME="school-access-$(date +%s)"
cloudflared tunnel create $TUNNEL_NAME

echo "⚙️  Creating configuration..."
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/${TUNNEL_NAME}.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOF

echo "📡 Setting up DNS route..."
cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN

echo "🚀 Installing and starting service..."
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌍 Access your Pi at: https://$DOMAIN"
echo "   This will work from school networks and with Proton VPN!"
echo ""
echo "🔍 Check status: sudo systemctl status cloudflared"
echo "📝 View logs: sudo journalctl -u cloudflared -f"
echo ""
echo "⚠️  Note: Make sure $DOMAIN points to Cloudflare in your DNS settings"
echo ""
echo "💡 PowerShell SSH tip: Use 'ssh ubuntu@<pi-ip>' to connect"