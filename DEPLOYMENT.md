# AI Agent Platform - EC2 Deployment Guide

## Prerequisites

1. **EC2 Instance Setup**
   - Ubuntu 20.04 LTS or newer
   - Minimum t3.medium (2 vCPU, 4 GB RAM)
   - 20 GB storage
   - Security groups allowing ports: 22, 80, 443, 3000, 3001

2. **Required Software**
   - Node.js 18+ 
   - Docker & Docker Compose
   - Git
   - PM2 (for process management)

## Installation Steps

### 1. Update System and Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
sudo apt-get install -y docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install PM2 globally
sudo npm install -g pm2

# Install pnpm
sudo npm install -g pnpm

# Logout and login to apply docker group changes
```

### 2. Clone and Setup Project

```bash
# Clone the repository
git clone <your-repo-url> ai_agent
cd ai_agent

# Copy and configure environment variables
cp .env.production .env
nano .env  # Edit with your production values

# Install dependencies
pnpm install --frozen-lockfile

# Make scripts executable (if not already)
chmod +x start.sh stop.sh status.sh
```

### 3. Configure Environment Variables

Edit `.env` file with your production values:

```bash
# Update these essential variables:
DATABASE_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_password
JWT_SECRET=your_32_char_secret_key
NEXT_PUBLIC_API_URL=http://your-ec2-public-ip:3001
FRONTEND_ORIGIN=http://your-ec2-public-ip:3000

# Add your API keys:
ELEVENLABS_API_KEY=your_key
OPENAI_API_KEY=your_key
PINECONE_API_KEY=your_key
```

### 4. Security Configuration

```bash
# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw enable

# Secure Docker
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock
```

### 5. Deploy the Application

```bash
# Start the application
./start.sh

# Check status
./status.sh

# View logs
tail -f logs/api.log
tail -f logs/worker.log
tail -f logs/web.log
```

## Production Management

### Using PM2 for Process Management

Create PM2 ecosystem file:

```bash
# Create ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'ai-agent-api',
      cwd: './apps/api',
      script: 'dist/server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      log_file: '../../logs/pm2-api.log',
      error_file: '../../logs/pm2-api-error.log',
      out_file: '../../logs/pm2-api-out.log'
    },
    {
      name: 'ai-agent-worker',
      cwd: './apps/worker',
      script: 'dist/worker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      log_file: '../../logs/pm2-worker.log',
      error_file: '../../logs/pm2-worker-error.log',
      out_file: '../../logs/pm2-worker-out.log'
    },
    {
      name: 'ai-agent-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      log_file: '../../logs/pm2-web.log',
      error_file: '../../logs/pm2-web-error.log',
      out_file: '../../logs/pm2-web-out.log'
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### SSL/HTTPS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot

# Get SSL certificate (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Create nginx config for SSL termination
sudo apt install -y nginx
```

### Monitoring and Maintenance

```bash
# Check service status
./status.sh

# View PM2 processes
pm2 list
pm2 logs
pm2 monit

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Update application
git pull
pnpm run build
pm2 restart all
```

### Database Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p $BACKUP_DIR
docker exec ai-agent-postgres pg_dump -U postgres ai_agent_prod > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql
EOF

chmod +x backup.sh

# Setup daily backup cron
echo "0 2 * * * /home/ubuntu/ai_agent/backup.sh" | crontab -
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Check if ports 3000/3001 are in use
2. **Docker permission**: Ensure user is in docker group
3. **Database connection**: Verify PostgreSQL is running
4. **Redis connection**: Verify Redis is accessible
5. **API keys**: Ensure all required API keys are set

### Log Locations

- Application logs: `logs/`
- PM2 logs: `~/.pm2/logs/`
- Docker logs: `docker-compose logs`
- System logs: `journalctl -u docker`

### Health Checks

```bash
# API health check
curl http://localhost:3001/health

# Web frontend check
curl http://localhost:3000

# Database check
docker exec ai-agent-postgres pg_isready

# Redis check
docker exec ai-agent-redis redis-cli ping
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` to git
2. **Database**: Use strong passwords, enable SSL
3. **API Keys**: Rotate regularly, use least privilege
4. **Updates**: Keep dependencies updated
5. **Monitoring**: Setup log monitoring and alerts
6. **Backups**: Regular automated backups
7. **Firewall**: Only open required ports

## Scaling Considerations

1. **Load Balancer**: Use ALB for multiple instances
2. **Database**: Consider RDS for managed PostgreSQL
3. **Redis**: Consider ElastiCache for managed Redis
4. **CDN**: Use CloudFront for static assets
5. **Monitoring**: Setup CloudWatch or similar