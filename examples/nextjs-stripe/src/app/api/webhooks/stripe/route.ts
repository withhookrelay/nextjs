import { withHookRelay } from '@hookrelay/next';

/**
 * Stripe webhook handler wrapped with Hook Relay.
 *
 * This handler:
 * - Automatically verifies the Hook Relay signature
 * - Provides typed access to the Stripe event payload
 * - Reports success/failure back to Hook Relay
 * - Enables automatic retries on failure
 */
export const POST = withHookRelay(
  (event) => {
    const stripeEvent = event.payload;

    console.log(`Processing Stripe event: ${stripeEvent.type}`);
    console.log(`Event ID: ${event.id}`);
    console.log(`Provider Event ID: ${event.providerEventId}`);
    console.log(`Attempt: ${String(event.attempt)}`);
    console.log(`Replayed: ${String(event.replayed)}`);

    // Handle specific event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        console.log('Checkout completed:', session);
        // TODO: Fulfill the order
        // await fulfillOrder(session);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription created:', subscription);
        // TODO: Activate subscription
        // await activateSubscription(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription updated:', subscription);
        // TODO: Update subscription status
        // await updateSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        console.log('Subscription canceled:', subscription);
        // TODO: Cancel subscription
        // await cancelSubscription(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = stripeEvent.data.object;
        console.log('Invoice paid:', invoice);
        // TODO: Record payment
        // await recordPayment(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        console.log('Invoice payment failed:', invoice);
        // TODO: Handle failed payment
        // await handleFailedPayment(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
  },
  { provider: 'stripe' },
);
