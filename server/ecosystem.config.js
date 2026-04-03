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
      script: "./index.js", // Relative to cwd
      cwd: "./v1", // Sets the "Current Working Directory" so imports work
      instances: "max", // Uses all available CPU cores
      exec_mode: "cluster", // Enables multi-threading
      watch: false,
      env: { PORT: 3001 },
      max_memory_restart: "1G", // Restart if a worker exceeds 1GB (helps recover from memory leaks)
    },
    {
      name: "api-v2",
      script: "./index.js", // Relative to cwd
      cwd: "./v2",
      env: { PORT: 3002 },
      max_memory_restart: "512M",
    },
  ],
};
