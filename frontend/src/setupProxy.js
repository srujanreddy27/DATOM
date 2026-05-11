const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/__/auth',
    createProxyMiddleware({
      target: 'https://datom-19e9a.firebaseapp.com',
      changeOrigin: true,
    })
  );
};
