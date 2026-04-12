module.exports = {
  apps: [
    {
      name: "gateway",
      script: "./index.js",
      cwd: __dirname,
      env: { PORT: 3000 },
      max_memory_restart: "512M",
    },
    {
      name: "api-v1",
      cwd: "./v1",
      script: "./index.js",
      watch: false,
      env: { PORT: 3001 },

      // Performance
      instances: "max",
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
      name: "api-v2",
      script: "./index.js",
      cwd: "./v2",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      env: { PORT: 3002 },
      max_memory_restart: "1G",
    },
  ],
};
