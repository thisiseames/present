// Public configuration. Safe to commit — none of this is secret.

// The VAPID public key the browser uses to register for push. Public keys are
// meant to ship in client code — this is not a secret.
// Get yours in one command:  npm run vapid  (paste the public key here; the
// private key goes in the GitHub Actions secret).
export const VAPID_PUBLIC_KEY = "BDBk6nf0Q1YJNqHlLH87MIdirjhSMyOZylp9dBr6rJo6K9-4EQVoMTnrRQVoTLxvTXuW4u9BGPVL502qyHGAuto";

// Where to send someone after they tap a notification (relative to the site root).
export const OPEN_PATH = "./";
