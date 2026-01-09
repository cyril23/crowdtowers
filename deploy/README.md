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

Create A records pointing to your server IP:
- `crowdtowers.wochenentwicklung.com` → `YOUR_SERVER_IP` (production)
- `staging.crowdtowers.wochenentwicklung.com` → `YOUR_SERVER_IP` (staging)

Wait for propagation: `dig crowdtowers.wochenentwicklung.com`

### 3. Create Ansible Vault

```bash
cd deploy/ansible
ansible-vault create inventory/group_vars/all/vault.yml
```

See [vault.yml.example](ansible/inventory/group_vars/all/vault.yml.example) for required secrets.

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

# Test the apps
curl https://crowdtowers.wochenentwicklung.com/api/health           # Production
curl https://staging.crowdtowers.wochenentwicklung.com/api/health   # Staging
```

### 6. Configure GitHub Actions

1. Go to: https://github.com/cyril23/crowdtowers/settings/secrets/actions
2. Add secret `DEPLOY_SSH_KEY` with contents of `~/.ssh/crowdtowers_deploy`

## Ongoing Deployments

**Staging:** Auto-deploys on push to `main` via GitHub Actions.
**Production:** Manual trigger only (workflow_dispatch) from GitHub Actions.

### When to Use What

| Change Type | Deployment Method |
|-------------|-------------------|
| Code changes (client, server, shared) | GitHub Actions (or local scripts) |
| `.env.prod.j2` template changes | Ansible with `ansible_user=root` |
| New vault secrets | `ansible-vault edit` first, then Ansible |
| Nginx config, packages, security | Ansible with `ansible_user=root` |

**Why?** GitHub Actions only does `git pull` + `npm install` + `pm2 restart`. It doesn't run Ansible templates or have access to vault secrets. So if you add a new environment variable to `.env.prod.j2`, you must run Ansible to render the template to the actual `.env.prod` file on the server.

### Local Ansible Deploy

For deploying uncommitted changes (e.g., mobile testing) or updating vault secrets:

```bash
cd deploy/ansible
ansible-playbook playbooks/site.yml --extra-vars "ansible_user=root" --ask-vault-pass
```

This deploys to both staging and production. The playbook is idempotent - unchanged tasks complete quickly.

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

### "Missing sudo password"

The `deploy` user has limited sudo. Use root for Ansible deployments:
```bash
ansible-playbook playbooks/site.yml --extra-vars "ansible_user=root" --ask-vault-pass
```

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
Internet → Nginx (SSL/443) → Node.js Production (:3000)  → MongoDB (crowdtowers)
                           → Node.js Staging    (:3001)  → MongoDB (crowdtowers-staging)
                                                                   ↓
                                                           :27017 localhost
                ↓
         Let's Encrypt
```

## Monitoring

**Uptime Monitoring:** New Relic Synthetic Monitor
- URL: `https://crowdtowers.wochenentwicklung.com/api/health`
- Interval: 15 minutes
- Text validation: `"status":"ok"`

**Alternatives:** UptimeRobot (free), Betterstack, Pingdom

## Backups

**Server Backups:** Hetzner automatic daily backups
- Retention: 7 daily backups (rolling)
- Cost: 20% of server cost/month
- Restore: Via Hetzner Cloud Console

**Snapshots:** Manual snapshots for major milestones
- Cost: €0.011/GB/month
- Not auto-deleted

**MongoDB:** No separate backup needed with current localhost setup (included in server backups). If migrating to MongoDB Atlas, use Atlas's built-in backup features instead.

**Alternatives:**
- Backblaze B2 + rclone (offsite backups)
- rsync.net (SSH-based backup storage)

## Security

- UFW firewall: only 22, 80, 443 open
- Fail2ban: SSH brute-force protection (3 attempts = 24h ban)
- SSH: key-only auth, no root login, no password auth
- MongoDB: localhost only, authentication enabled
- Automatic security updates with 02:00 reboot

**Rate Limiting:** Currently handled by fail2ban at the IP level. For application-level rate limiting (per-endpoint, per-user), consider `express-rate-limit`. Not needed for low-traffic games.

## Future Considerations

**CDN:** Not currently needed. When scaling:
- Cloudflare (free tier): CDN + DDoS protection + caching
- Point DNS through Cloudflare, minimal config changes
- Benefits: faster static asset delivery, reduced server load

See [FUTURE.md](../FUTURE.md) for more planned improvements.
