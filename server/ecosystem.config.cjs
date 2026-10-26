module.exports = {
  apps: [
    {
      name: "grip-analysis",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/server.ts",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: 3847,
        HIL_BASE_URL: "http://221.162.67.121:91",
        HIL_MODE: "live",
      },
    },
  ],
};
