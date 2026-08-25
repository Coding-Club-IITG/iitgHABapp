const path = require("path");
module.exports = {
  apps: [
    {
      name: "gateway",
      script: path.join(__dirname, "../index.js"),
      cwd: path.join(__dirname, "../"),
      max_memory_restart: "512M",
    },
    {
      name: "api",
      cwd: path.join(__dirname, "../v1"),
      script: "./index.js",
      watch: false,
      instances: 2,
      exec_mode: "cluster",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
      out_file: "../logs/out.test.log",
      error_file: "../logs/error.test.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
    {
      name: "worker-agenda",
      cwd: path.join(__dirname, "../v1"),
      script: "./workers/agendaWorker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
    },
  ],
};
