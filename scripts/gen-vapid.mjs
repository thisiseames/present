// One-time: generate the VAPID keypair for Web Push.
//   npm run vapid
// Put the public key in config.js, the private key in the GitHub Actions secret.

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\nVAPID keypair — generate once, keep forever.\n");
console.log("config.js  →  VAPID_PUBLIC_KEY =");
console.log(`  ${publicKey}\n`);
console.log("GitHub repo → Settings → Secrets and variables → Actions:");
console.log(`  VAPID_PUBLIC_KEY   ${publicKey}`);
console.log(`  VAPID_PRIVATE_KEY  ${privateKey}`);
console.log(`  VAPID_SUBJECT      mailto:you@example.com\n`);
