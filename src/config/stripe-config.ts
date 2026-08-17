export default () => ({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

    successUrl: process.env.STRIPE_SUCCESS_URL,
    failureUrl: process.env.STRIPE_CANCEL_URL,

    frontendSuccessUrl: process.env.PAYNENT_FRONTEND_SUCCESS_URL,
    frontendFailureUrl: process.env.PAYNENT_FRONTEND_FAILURE_URL,
  },
});
