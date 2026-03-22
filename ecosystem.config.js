module.exports = {
  apps: [
    {
      name: 'pumpfun-scanner',
      script: 'index.js',
      watch: false,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'wallet-watcher',
      script: 'watcher.js',
      watch: false,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
