export default () => ({
  esewa: {
    // eSewa's official RC (test/UAT) merchant sandbox — this is the "dummy" eSewa
    // payment page. Product code EPAYTEST + this secret key are eSewa's published
    // test credentials and only work against the rc- (test) endpoints below.
    productCode: process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST',
    secretKey: process.env.ESEWA_SECRET_KEY,
    paymentUrl: process.env.ESEWA_PAYMENT_URL, // form-post destination (the eSewa page itself)
    statusUrl: process.env.ESEWA_STATUS_URL, // GET status-check endpoint

    // eSewa redirects the user's browser (GET, with a base64 `data` query param) here
    // once payment completes or is cancelled/fails.
    successUrl: process.env.ESEWA_SUCCESS_URL,
    failureUrl: process.env.ESEWA_FAILURE_URL,

    // Where we then forward the user to in the actual app UI.
    frontendSuccessUrl: process.env.ESEWA_FRONTEND_SUCCESS_URL,
    frontendFailureUrl: process.env.ESEWA_FRONTEND_FAILURE_URL,
  },
});
