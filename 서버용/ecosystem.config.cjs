module.exports = {
  apps: [
    {
      name: "grip-analysis",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3847",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3847,
        HIL_BASE_URL: "http://221.162.67.121:91",
        HIL_MODE: "auto",
        // 배포 후 실제 공개 도메인으로 바꾸세요
        // PUBLIC_BASE_URL: "https://your-domain.com",
      },
    },
  ],
};
