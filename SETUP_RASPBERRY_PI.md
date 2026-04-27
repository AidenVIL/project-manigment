# Host on Raspberry Pi for Always-On 24/7 Uptime

Your desktop PC can't serve while sleeping. A Raspberry Pi is the perfect alternative:
- **One-time cost:** $35-50 (Pi 4 or Pi 5 with 8GB RAM)
- **Annual electricity:** ~$3-5 (uses ~5W continuous)
- **Uptime:** 24/7/365
- **Speed:** Good enough for small team use

## Hardware Needed
- Raspberry Pi 4 (8GB) or Pi 5 ($35-50)
- SD Card (128GB recommended, $15)
- Power supply (5V/3A, $10)
- Ethernet cable or WiFi
- Total: ~$70-80 one-time investment

## Installation Steps

### 1. Install Operating System
- Download Raspberry Pi Imager: https://www.raspberrypi.com/software/
- Write Ubuntu Server 22.04 LTS (ARM64) to SD card
- Insert SD card into Pi, power on

### 2. Initial Setup (via SSH)
```bash
# Find your Pi's IP address (check your router)
# SSH in:
ssh ubuntu@<pi-ip-address>

# Update system
sudo apt update && sudo apt upgrade -y
```

### 3. Install Ollama
```bash
curl https://ollama.ai/install.sh | sh

# Start Ollama service
sudo systemctl enable ollama
sudo systemctl start ollama

# Pull Mistral (might take 10-15 min on Pi)
ollama pull mistral
```

### 4. Install Node.js & Clone Your App
```bash
sudo apt install -y nodejs npm git

# Clone your repository
git clone https://github.com/AidenVIL/project-manigment.git
cd project-manigment

# Install dependencies
npm install

# Build (if needed)
npm run build
```

### 5. Create a Service File (Auto-start on boot)
```bash
sudo nano /etc/systemd/system/sponsor-crm.service
```

Paste this:
```ini
[Unit]
Description=Sponsor CRM Application
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/project-manigment
Environment="USE_OLLAMA=true"
Environment="OLLAMA_ENDPOINT=http://localhost:11434"
Environment="OLLAMA_MODEL=mistral"
Environment="PORT=3000"
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sponsor-crm
sudo systemctl start sponsor-crm

# Check status
sudo systemctl status sponsor-crm
```

### 6. Set Up nginx Reverse Proxy
```bash
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/default
```

Replace with:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Then:
```bash
sudo systemctl restart nginx
```

### 7. Access Your App
**Local network:** `http://<pi-ip-address>`
**From anywhere:** Use ngrok (see below)

---

## Access from Outside Your Home Network

### Option A: ngrok (Easiest, Free)
```bash
# Download ngrok on Pi
wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-arm64.zip
unzip ngrok-stable-linux-arm64.zip
sudo mv ngrok /usr/local/bin/

# Create ngrok config
nano ~/.ngrok2/ngrok.yml
```

Add:
```yaml
tunnels:
  sponsor-crm:
    proto: http
    addr: 3000
```

Then in a terminal:
```bash
ngrok start sponsor-crm
```

This gives you a public URL like: `https://abc123.ngrok.io`

### Option B: Router Port Forwarding
1. Log into your home router (usually 192.168.1.1)
2. Port Forward: External 80 → Internal `<pi-ip>:80`
3. Access via your home public IP
4. Get a free domain: https://duckdns.org

---

## Monitoring & Maintenance

### Check logs:
```bash
sudo systemctl status sponsor-crm
sudo journalctl -u sponsor-crm -f
```

### Reboot (if needed):
```bash
sudo reboot
```
Apps auto-start after reboot.

### Update app:
```bash
cd /home/ubuntu/project-manigment
git pull
npm install
sudo systemctl restart sponsor-crm
```

---

## Power & Reliability

- **Power consumption:** ~5W (Pi 4 with Ethernet)
- **Annual electricity cost:** ~$4 (at $0.12/kWh)
- **Uptime SLA:** Your home internet reliability
- **Backup:** Consider keeping Render as failover for critical days

---

## Comparison: PC vs Pi vs Cloud

| Metric | PC Always-On | Raspberry Pi | Render | Oracle Cloud |
|--------|-------------|--------------|--------|-------------|
| Uptime | 99% (depends on you) | 99.9% | 99.9% | 99.9% |
| Cost/month | $5-10 | $0.30 | $7 | $0 |
| Cost/year | $60-120 | $3-5 | $84 | $0 |
| Setup time | 5 min | 2 hours | 10 min | 1 hour |
| One-time cost | $0 | $70 | $0 | $0 |
| Speed | Fast | Slower | Fast | Medium |
| **Total 3-year** | **$180-360** | **$210** | **$252** | **$0** |

---

## Recommendation

**Go with Raspberry Pi** if:
- You want to keep your desktop for other work
- You want guaranteed 24/7 uptime
- You want to avoid paying monthly hosting fees
- Your home internet is stable

**Keep PC always-on** if:
- You already have a spare machine
- Your electricity cost is cheap ($3/month or less)
- You prefer simplicity

**Hybrid (Pi + Render)** if:
- You want Pi as primary
- Keep Render as emergency backup
