#!/bin/bash
# SSH Key Generation for CrowdTowers Deployment
# Run this locally - NEVER commit the private key!

set -e

KEY_NAME="crowdtowers_deploy"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

echo "=== SSH Key Generation for CrowdTowers Deployment ==="
echo ""

if [ -f "$KEY_PATH" ]; then
    echo "WARNING: Key already exists at $KEY_PATH"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Generate ED25519 key (more secure, smaller)
ssh-keygen -t ed25519 -f "$KEY_PATH" -C "deploy@crowdtowers" -N ""

echo ""
echo "=== Keys generated successfully ==="
echo ""
echo "Private key: $KEY_PATH"
echo "Public key:  $KEY_PATH.pub"
echo ""
echo "=== NEXT STEPS ==="
echo ""
echo "1. Copy PUBLIC key to server (after initial setup):"
echo "   ssh-copy-id -i $KEY_PATH.pub root@YOUR_SERVER_IP"
echo ""
echo "2. Display PUBLIC key (for manual copy):"
echo "   cat $KEY_PATH.pub"
echo ""
echo "3. Add PRIVATE key to GitHub Secrets:"
echo "   - Go to: Repository -> Settings -> Secrets and variables -> Actions"
echo "   - Click 'New repository secret'"
echo "   - Name: DEPLOY_SSH_KEY"
echo "   - Value: (paste output of command below)"
echo "   cat $KEY_PATH"
echo ""
echo "4. Test SSH connection (after server setup):"
echo "   ssh -i $KEY_PATH deploy@crowdtowers.wochenentwicklung.com"
echo ""
echo "=== SECURITY REMINDERS ==="
echo "- NEVER commit the private key to git"
echo "- NEVER share the private key"
echo "- Keep local backups secure"
