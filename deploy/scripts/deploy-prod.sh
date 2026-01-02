#!/bin/bash
# Deploy to production environment
# Usage: ./deploy/scripts/deploy-prod.sh [additional ansible args]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Building client bundle ==="
cd "$PROJECT_ROOT"
npm run build

echo ""
echo "=== Deploying to production ==="
cd "$PROJECT_ROOT/deploy/ansible"
ansible-playbook playbooks/site.yml \
    --ask-vault-pass \
    --tags deploy \
    -l crowdtowers-prod \
    --extra-vars "ansible_user=root" \
    "$@"

echo ""
echo "=== Production deployment complete ==="
echo "URL: https://crowdtowers.wochenentwicklung.com"
