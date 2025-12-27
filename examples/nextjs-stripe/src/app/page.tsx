export default function HomePage() {
  return (
    <main>
      <h1>Hook Relay + Stripe Example</h1>
      <p>
        This is an example Next.js app demonstrating how to use <code>@hookrelay/next</code> for
        reliable Stripe webhook handling.
      </p>

      <h2>Setup</h2>
      <ol>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code>
        </li>
        <li>Add your Hook Relay secret from the dashboard</li>
        <li>
          Configure your Hook Relay endpoint to forward to{' '}
          <code>https://your-app.vercel.app/api/webhooks/stripe</code>
        </li>
      </ol>

      <h2>Webhook Endpoint</h2>
      <p>
        The webhook handler is at <code>/api/webhooks/stripe</code>
      </p>

      <h2>How it works</h2>
      <ul>
        <li>Stripe sends webhooks to Hook Relay</li>
        <li>Hook Relay verifies the Stripe signature</li>
        <li>Hook Relay forwards to your Next.js app with its own signature</li>
        <li>The SDK verifies the Hook Relay signature</li>
        <li>Your handler processes the event</li>
        <li>The SDK reports success/failure back to Hook Relay</li>
        <li>If the handler fails, Hook Relay retries automatically</li>
      </ul>
    </main>
  );
}
