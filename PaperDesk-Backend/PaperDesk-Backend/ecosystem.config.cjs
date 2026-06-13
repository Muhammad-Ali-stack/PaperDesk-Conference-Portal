module.exports = {
  apps: [
    {
      name: "PaperDesk-Backend",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "../logs/backend-error.log",
      out_file: "../logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
    },
    
  {
      name: "PaperDesk-Frontend",
      script: "/home/saadia/ICONICS-CMP/PaperDesk-Frontend/node_modules/serve/build/main.js",
      args: "-s build -l 4000",
      cwd: "/home/saadia/ICONICS-CMP/PaperDesk-Frontend/",
      watch: false,
      env: {
        PORT: "4000",
      },
      error_file: "../logs/frontend-error.log",
      out_file: "../logs/frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
