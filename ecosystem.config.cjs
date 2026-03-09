module.exports = {
  apps: [
    {
      name: "ceremony",
      cwd: "./web",
      script: "npm",
      args: "start",
      env: {
        PORT: 3004,
        KEEPER_URL: "http://localhost:3005",
        CEREMONY_TOKEN_SECRET: process.env.CEREMONY_TOKEN_SECRET || "",
        MC_SECRET: process.env.MC_SECRET || "",
        KEEPER_SHARED_SECRET: process.env.KEEPER_SHARED_SECRET || "",
      },
    },
    {
      name: "keeper",
      cwd: "./keeper-service",
      script: "npx",
      args: "tsx server.ts",
      env: {
        KEEPER_PORT: 3005,
        KEEPER_SHARED_SECRET: process.env.KEEPER_SHARED_SECRET || "",
      },
    },
    {
      name: "rigging",
      cwd: "./rigging",
      script: "node",
      args: "server.js",
      env: {
        RIGGING_PORT: 3006,
      },
    },
  ],
};
