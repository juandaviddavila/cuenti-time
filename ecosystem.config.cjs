module.exports = {
  apps: [
    {
      name: 'cuenti-time',
      cwd: '/home/ubuntu/app/cuenti-time_compilado',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 7578',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: '7578',
        // Upstream interno del MCP (rewrites Next → :4101)
        MCP_UPSTREAM_URL: 'http://127.0.0.1:4101',
      },
    },
    {
      name: 'cuenti-time-marketing',
      cwd: '/home/ubuntu/app/cuenti-time_compilado/packages/marketing',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3008',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3008',
      },
    },
    {
      name: 'cuenti-time-mcp',
      cwd: '/home/ubuntu/app/cuenti-time_compilado/packages/hr-mcp-server',
      // Node ≥20: carga packages/hr-mcp-server/.env (DATABASE_URL, MCP_*)
      script: 'dist/packages/hr-mcp-server/src/http.js',
      interpreter: 'node',
      interpreter_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        MCP_HTTP_PORT: '4101',
        MCP_HTTP_HOST: '0.0.0.0',
      },
    },
  ],
};
