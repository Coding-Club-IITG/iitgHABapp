module.exports = {
  apps: [
    {
      name: "hab-gateway",
      script: "./index.js",
      cwd: __dirname,
      max_memory_restart: "512M",
    },
    {
      name: "hab-api-v1",
      cwd: "./v1",
      script: "./index.js",
      watch: false,

      // Performance
      instances: "1",
      exec_mode: "cluster",

      // Stability
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",

      // Graceful Reload
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,

      // Logging
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
    {
      name: "hab-worker-logger-v1",
      cwd: "./v1",
      script: "./workers/loggerWorker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      out_file: "./logs/logger-out.log",
      error_file: "./logs/logger-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      name: "hab-worker-agenda-v1",
      cwd: "./v1",
      script: "./workers/agendaWorker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      out_file: "./logs/agenda-out.log",
      error_file: "./logs/agenda-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      name: "hab-api-v2",
      cwd: "./v2",
      script: "./index.js",
      watch: false,
      instance_var: "NODE_APP_INSTANCE",

      // Performance
      instances: "1",
      exec_mode: "cluster",

      // Stability
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",

      // Graceful Reload
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
