#!/bin/bash
# Deploy to staging environment
# Usage: ./deploy/scripts/deploy-staging.sh [additional ansible args]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Building client bundle ==="
cd "$PROJECT_ROOT"
npm run build

echo ""
echo "=== Deploying to staging ==="
cd "$PROJECT_ROOT/deploy/ansible"
ansible-playbook playbooks/site.yml \
    --ask-vault-pass \
    --tags deploy \
    -l crowdtowers-staging \
    --extra-vars "ansible_user=root" \
    "$@"

echo ""
echo "=== Staging deployment complete ==="
echo "URL: https://staging.crowdtowers.wochenentwicklung.com"
