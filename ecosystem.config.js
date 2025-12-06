module.exports = {
  apps: [
    {
      name: 'nextjs-crm',
      script: 'server.js',
      cwd: '/var/www/adlercapitalcrm.com',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ELASTICSEARCH_URL: 'http://localhost:9200'
      },
      error_file: '/var/www/adlercapitalcrm.com/logs/pm2-error.log',
      out_file: '/var/www/adlercapitalcrm.com/logs/pm2-out.log',
      log_file: '/var/www/adlercapitalcrm.com/logs/pm2-combined.log',
      time: true
    },
    {
      name: 'email-sync-worker',
      script: 'npx',
      args: 'tsx workers/email-sync-worker.ts',
      cwd: '/var/www/adlercapitalcrm.com',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/www/adlercapitalcrm.com/logs/email-worker-error.log',
      out_file: '/var/www/adlercapitalcrm.com/logs/email-worker-out.log',
      log_file: '/var/www/adlercapitalcrm.com/logs/email-worker-combined.log',
      time: true
    },
    {
      name: 'email-idle-worker',
      script: 'npx',
      args: 'tsx workers/email-idle-worker.ts',
      cwd: '/var/www/adlercapitalcrm.com',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/www/adlercapitalcrm.com/logs/email-idle-error.log',
      out_file: '/var/www/adlercapitalcrm.com/logs/email-idle-out.log',
      log_file: '/var/www/adlercapitalcrm.com/logs/email-idle-combined.log',
      time: true
    },
    {
      name: 'sequence-worker',
      script: 'npx',
      args: 'tsx workers/sequence-worker.ts',
      cwd: '/var/www/adlercapitalcrm.com',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
        SEQUENCE_PROCESS_INTERVAL_MS: '60000',
        APP_URL: 'http://localhost:3000',
      },
      error_file: '/var/www/adlercapitalcrm.com/logs/sequence-worker-error.log',
      out_file: '/var/www/adlercapitalcrm.com/logs/sequence-worker-out.log',
      log_file: '/var/www/adlercapitalcrm.com/logs/sequence-worker-combined.log',
      time: true
    }
  ]
}
