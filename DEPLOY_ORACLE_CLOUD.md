# Deploy to Oracle Cloud Free Tier (Always Free)

## Why Oracle Cloud?
- 2 ARM VMs (4GB RAM each) - **always free**, no time limit
- Ollama fits easily
- Full Node.js support
- Better than Render for AI workloads

## Step-by-Step Setup

### 1. Create Oracle Cloud Account
- Go to https://www.oracle.com/cloud/free/
- Sign up (no credit card required initially)
- Activate your always-free resources

### 2. Create a Compute VM
- In Oracle Cloud Console → Compute → Instances
- Click "Create Instance"
- Image: Ubuntu 22.04 (free tier eligible)
- Shape: Ampere (ARM) - free tier
- Network: Create new VCN or use default
- SSH Key: Generate and download your keypair
- Click "Create"

### 3. Connect via SSH
```bash
ssh ubuntu@<your-oracle-instance-ip> -i your-key.pem
```

### 4. Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nodejs npm

# Install Ollama
curl https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve &

# Pull a model (in background)
ollama pull mistral &
```

### 5. Deploy Your App
```bash
cd /home/ubuntu
git clone https://github.com/AidenVIL/project-manigment.git
cd project-manigment

# Install dependencies
npm install

# Build (if needed)
npm run build

# Set environment variables
export USE_OLLAMA=true
export OLLAMA_ENDPOINT=http://localhost:11434
export OLLAMA_MODEL=mistral
export PORT=3000

# Start server
node server.mjs &
```

### 6. Set Up Reverse Proxy (nginx)
```bash
sudo apt install -y nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/default
```

Paste this config:
```nginx
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then:
```bash
sudo systemctl restart nginx
```

### 7. Enable Port 80 in Firewall
- Oracle Cloud Console → Networking → Virtual Cloud Networks
- Find your subnet's Security List
- Add Ingress Rule: Source CIDR 0.0.0.0/0, Protocol TCP, Port 80 and 443

### 8. Keep Services Running (Optional: use PM2)
```bash
sudo npm install -g pm2

pm2 start "node server.mjs" --name "sponsor-crm"
pm2 start "ollama serve" --name "ollama"
pm2 startup
pm2 save
```

### 9. Access Your App
```
http://<your-oracle-instance-public-ip>
```

## Cost: **$0/month** (always free tier)

## Notes
- Ollama model download (~4GB for Mistral) takes time initially
- ARM-based VMs are slower than x86 but sufficient for this use case
- First response after server sleep may be slow (up to 30s)
- No auto-scaling on free tier, but sufficient for small teams

## Moving Data from Render
```bash
# On Render: export database
supabase export

# Upload to Oracle VM
scp your-backup.sql ubuntu@<oracle-ip>:/home/ubuntu/

# Restore on Oracle instance
psql < your-backup.sql
```
