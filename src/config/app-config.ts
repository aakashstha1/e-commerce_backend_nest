export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '5000', 10),
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
});
