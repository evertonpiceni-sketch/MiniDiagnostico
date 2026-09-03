const Stripe = require('stripe');
const stripe = new Stripe('sk_test_123'); // Just to see if method exists
console.log(typeof stripe.checkout.sessions.list);
