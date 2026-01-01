# CrowdTowers Deployment Guide

Production deployment for Hetzner Cloud VPS (CPX32, Ubuntu 24).

## Prerequisites

### On Your Mac

1. **Install Ansible** (add to PATH if needed):
   ```bash
   pip3 install ansible passlib
   echo 'export PATH="/Users/nikafellner/Library/Python/3.9/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

2. **Generate SSH keys**:
   ```bash
   chmod +x deploy/scripts/generate-ssh-keys.sh
   ./deploy/scripts/generate-ssh-keys.sh
   ```
   Creates `~/.ssh/crowdtowers_deploy` (private) and `~/.ssh/crowdtowers_deploy.pub` (public).

## Initial Server Setup (One-Time)

### 1. Create Hetzner VPS

- Create CPX32 with Ubuntu 24.04
- Add your public SSH key (`~/.ssh/crowdtowers_deploy.pub`) during VPS creation
- Note the server IP

### 2. Configure DNS

Create an A record: `crowdtowers.wochenentwicklung.com` → `YOUR_SERVER_IP`

Wait for propagation: `dig crowdtowers.wochenentwicklung.com`

### 3. Create Ansible Vault

```bash
cd deploy/ansible
ansible-vault create inventory/group_vars/all/vault.yml
```

Add these secrets (use plain ASCII quotes, no special characters):

```yaml
vault_mongo_admin_password: "your-secure-admin-password"
vault_mongo_app_password: "your-secure-app-password"
vault_session_secret: "your-secure-session-secret"
vault_certbot_email: "your-email@example.com"
vault_deploy_user_password: "your-deploy-user-password"
```

**Important**: Use plain ASCII quotes `"` not German quotes `„"`.

To edit later: `ansible-vault edit inventory/group_vars/all/vault.yml`

### 4. Run Ansible Provisioning

```bash
cd /Users/nikafellner/Desktop/source/towerdefence/deploy/ansible

# Test connectivity (as root for initial setup)
ansible crowdtowers -m ping --extra-vars "ansible_user=root" --ask-vault-pass

# Run full provisioning
ansible-playbook playbooks/site.yml --extra-vars "ansible_user=root" --ask-vault-pass
```

**Note**: Use `--extra-vars "ansible_user=root"` for initial setup because the `deploy` user doesn't exist yet. The inventory file sets `ansible_user: deploy` which overrides `-u root`.

### 5. Verify Installation

```bash
# SSH as deploy user
ssh -i ~/.ssh/crowdtowers_deploy deploy@crowdtowers.wochenentwicklung.com

# Check services on server
pm2 status
sudo systemctl status mongod nginx

# Test the app
curl https://crowdtowers.wochenentwicklung.com/api/health
```

### 6. Configure GitHub Actions

1. Go to: https://github.com/cyril23/crowdtowers/settings/secrets/actions
2. Add secret `DEPLOY_SSH_KEY` with contents of `~/.ssh/crowdtowers_deploy`

## Ongoing Deployments

After initial setup, deployments are automatic on push to `main`.

### Manual Deployment via Ansible

```bash
cd deploy/ansible
ansible-playbook playbooks/site.yml --ask-vault-pass --tags deploy
```

### SSH to Server

```bash
ssh -i ~/.ssh/crowdtowers_deploy deploy@crowdtowers.wochenentwicklung.com
```

## Troubleshooting

### "command not found: ansible"

Add Python bin to PATH:
```bash
export PATH="/Users/nikafellner/Library/Python/3.9/bin:$PATH"
```

### "Attempting to decrypt but no vault secrets found"

Add `--ask-vault-pass` to the command.

### "Permission denied" when connecting

Use `--extra-vars "ansible_user=root"` for initial setup (before deploy user exists).

### Python/pip issues on Ubuntu 24

Use apt packages instead of pip:
```yaml
# Wrong (fails on Ubuntu 24)
pip:
  name: pymongo

# Correct
apt:
  name: python3-pymongo
```

## Architecture

```
Internet → Nginx (SSL/443) → Node.js (:3000) → MongoDB (:27017 localhost)
                ↓
         Let's Encrypt
```

## Security

- UFW firewall: only 22, 80, 443 open
- Fail2ban: SSH brute-force protection (3 attempts = 24h ban)
- SSH: key-only auth, no root login, no password auth
- MongoDB: localhost only, authentication enabled
- Automatic security updates with 02:00 reboot
