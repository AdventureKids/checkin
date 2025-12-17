# Adventure Kids Check-In - Deployment Guide

## Quick Deploy Steps

### 1. Build on your local machine

```bash
cd ~/Desktop/kidcheck
npm install
npm run build
```

### 2. Copy to server

You can use `scp`, `rsync`, or any file transfer method:

```bash
# Replace with your server details
SERVER=your-server-ip
USER=your-username

# Create a tarball of needed files
tar -czvf kidcheck-deploy.tar.gz \
    dist/ \
    print-server.cjs \
    package.json \
    package-lock.json \
    public/

# Copy to server
scp kidcheck-deploy.tar.gz $USER@$SERVER:/tmp/

# SSH into server
ssh $USER@$SERVER
```

### 3. Set up on server

```bash
# Create app directory
sudo mkdir -p /var/www/kidcheck
cd /var/www/kidcheck

# Extract files
sudo tar -xzvf /tmp/kidcheck-deploy.tar.gz

# Install Node.js if not present (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install native dependencies for canvas (required for label generation)
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Install production dependencies
sudo npm install --production

# Set ownership
sudo chown -R www-data:www-data /var/www/kidcheck
```

### 4. Run the server

**Option A: Direct run (for testing)**
```bash
NODE_ENV=production DISABLE_PRINTING=true PORT=3001 node print-server.cjs
```

**Option B: Using PM2 (recommended for production)**
```bash
# Install PM2
sudo npm install -g pm2

# Start the app
cd /var/www/kidcheck
pm2 start print-server.cjs --name kidcheck \
    --env production \
    -- --env DISABLE_PRINTING=true

# Save PM2 config to restart on reboot
pm2 save
pm2 startup
```

**Option C: Using systemd**
```bash
# Create service file
sudo tee /etc/systemd/system/kidcheck.service << 'EOF'
[Unit]
Description=Adventure Kids Check-In Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kidcheck
ExecStart=/usr/bin/node print-server.cjs
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DISABLE_PRINTING=true

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable kidcheck
sudo systemctl start kidcheck
sudo systemctl status kidcheck
```

### 5. Set up Nginx reverse proxy (recommended)

```bash
sudo apt install nginx

sudo tee /etc/nginx/sites-available/kidcheck << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Or use your IP

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/kidcheck /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. (Optional) Add HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Host to bind to |
| `NODE_ENV` | development | Set to `production` for deployment |
| `DISABLE_PRINTING` | false | Set to `true` for remote servers without printers |

---

## Firewall

If using UFW:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # if using HTTPS
# sudo ufw allow 3001/tcp  # only if not using nginx
```

---

## Access URLs

Once deployed:
- **Kiosk (Check-in)**: `http://your-server/`
- **Admin Dashboard**: `http://your-server/admin`
- **Registration**: `http://your-server/register`

---

## Troubleshooting

**Check logs:**
```bash
# PM2
pm2 logs kidcheck

# systemd
sudo journalctl -u kidcheck -f
```

**Check if server is running:**
```bash
curl http://localhost:3001/api/stats
```

**Canvas installation issues:**
If you get errors about `canvas`, make sure you have the build dependencies:
```bash
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm rebuild canvas
```



