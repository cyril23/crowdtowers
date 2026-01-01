module.exports = {
  apps: [{
    name: 'crowdtowers',
    script: 'server/index.js',
    cwd: '/var/www/crowdtowers',
    instances: 1,  // Single instance for Socket.IO state
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env_file: '/var/www/crowdtowers/.env.prod',
    error_file: '/var/log/pm2/crowdtowers-error.log',
    out_file: '/var/log/pm2/crowdtowers-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Graceful restart
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
