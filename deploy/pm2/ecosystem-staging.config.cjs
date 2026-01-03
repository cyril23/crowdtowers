module.exports = {
  apps: [{
    name: 'crowdtowers-staging',
    script: 'server/index.js',
    cwd: '/var/www/crowdtowers-staging',
    instances: 1,  // Single instance for Socket.IO state
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    // Environment loaded from .env.prod via dotenv
    error_file: '/var/log/pm2/crowdtowers-staging-error.log',
    out_file: '/var/log/pm2/crowdtowers-staging-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Graceful restart
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
