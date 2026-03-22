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
    },
    {
      name: 'discovery-radar',
      script: 'discovery_radar.js',
      watch: false,
      restart_delay: 3600000, // Run occasionally as it's a batch scanner
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
