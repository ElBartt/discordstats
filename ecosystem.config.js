module.exports = {
  apps : [{
    name: 'bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: true,
    max_memory_restart: '2G',
    ignore_watch : ["node_modules", "stats/stats.json"],
  }],
};
