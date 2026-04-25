module.exports = {
  apps: [
    {
      name: "hab-gateway",
      script: "./index.js",
      cwd: __dirname,
      env: { PORT: 3000 },
      max_memory_restart: "512M",
    },
    {
      name: "hab-api-v1",
      cwd: "./v1",
      script: "./index.js",
      watch: false,
      env: { PORT: 3001 },
      instance_var: "NODE_APP_INSTANCE",

      // Performance
      instances: "18",
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
      env: { NODE_ENV: "production" },
    },
    {
      name: "hab-worker-agenda-v1",
      cwd: "./v1",
      script: "./workers/agendaWorker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: { NODE_ENV: "production" },
    },
    {
      name: "hab-api-v2",
      cwd: "./v2",
      script: "./index.js",
      watch: false,
      env: { PORT: 3002 },
      instance_var: "NODE_APP_INSTANCE",

      // Performance
      instances: "6",
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
