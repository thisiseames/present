// One-shot deploy: create the GitHub repo, push, set the push-notification
// secrets, and turn on GitHub Pages.
//
//   GITHUB_TOKEN=ghp_xxx  node scripts/deploy.mjs
//   (or drop the token in ./.github-token.local)
//
// Token needs: repo (create + push), and Pages write. A classic token with
// "repo" + "workflow" scope covers it; a fine-grained token needs
// Administration, Contents, Secrets, Pages = read/write on the new repo.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import sodium from "libsodium-wrappers";

const REPO = process.env.REPO_NAME || "present";
const PRIVATE = false; // GitHub Pages is free only for public repos

const tokenFiles = ["./.github-token.local", "../eames-ig-queue/.github-token.local"];
const token =
  process.env.GITHUB_TOKEN ||
  tokenFiles.map((f) => existsSync(f) && readFileSync(f, "utf8").trim()).find(Boolean);
if (!token) {
  console.error(`No token. Set GITHUB_TOKEN or create ${tokenFiles[0]}`);
  process.exit(1);
}

const vapid = JSON.parse(readFileSync("./.vapid.local.json", "utf8"));

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} → ${res.status} ${data.message || text}`);
  }
  return data;
}

await sodium.ready;

// preflight: classic tokens report their scopes in a header; fine-grained don't
const probe = await fetch("https://api.github.com/user", {
  headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
});
const scopes = probe.headers.get("x-oauth-scopes");
if (scopes !== null && !/\bworkflow\b/.test(scopes)) {
  console.error(
    `\nThis token can't push the notification workflow. It has: [${scopes || "none"}].\n` +
      `Make a classic token at https://github.com/settings/tokens/new with 'repo' + 'workflow',\n` +
      `then: GITHUB_TOKEN=<token> npm run deploy\n`
  );
  process.exit(1);
}

const me = await gh("/user");
const owner = me.login;
console.log(`authenticated as ${owner}`);

// 1. repo
let repo;
try {
  repo = await gh(`/repos/${owner}/${REPO}`);
  console.log(`repo ${owner}/${REPO} already exists — using it`);
} catch {
  repo = await gh("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: REPO,
      private: PRIVATE,
      description: "Now is the only place you've ever been.",
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    }),
  });
  console.log(`created ${repo.full_name}`);
}

// 2. secrets
const pk = await gh(`/repos/${owner}/${REPO}/actions/secrets/public-key`);
function seal(value) {
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL)
  );
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}
for (const [name, value] of [
  ["VAPID_PUBLIC_KEY", vapid.publicKey],
  ["VAPID_PRIVATE_KEY", vapid.privateKey],
  ["VAPID_SUBJECT", vapid.subject],
]) {
  await gh(`/repos/${owner}/${REPO}/actions/secrets/${name}`, {
    method: "PUT",
    body: JSON.stringify({ encrypted_value: seal(value), key_id: pk.key_id }),
  });
  console.log(`secret ${name} set`);
}

// let the notify Action commit state.json back
await gh(`/repos/${owner}/${REPO}/actions/permissions/workflow`, {
  method: "PUT",
  body: JSON.stringify({ default_workflow_permissions: "write", can_approve_pull_request_reviews: false }),
}).catch((e) => console.log(`(workflow perms: ${e.message})`));

// 3. push
const remote = `https://${owner}:${token}@github.com/${owner}/${REPO}.git`;
execSync(`git remote remove origin 2>/dev/null || true`, { stdio: "ignore", shell: "/bin/bash" });
execSync(`git remote add origin ${remote}`, { shell: "/bin/bash" });
execSync(`git branch -M main`, { shell: "/bin/bash" });
execSync(`git push -u origin main`, { stdio: "inherit", shell: "/bin/bash" });
execSync(`git remote set-url origin https://github.com/${owner}/${REPO}.git`, { shell: "/bin/bash" });
console.log("pushed");

// 4. pages
try {
  await gh(`/repos/${owner}/${REPO}/pages`, {
    method: "POST",
    body: JSON.stringify({ build_type: "legacy", source: { branch: "main", path: "/" } }),
  });
} catch (e) {
  if (!String(e).includes("409")) throw e;
  console.log("pages already enabled");
}
let url = "";
for (let i = 0; i < 20; i++) {
  const p = await gh(`/repos/${owner}/${REPO}/pages`).catch(() => null);
  if (p?.html_url) {
    url = p.html_url;
    if (p.status === "built") break;
  }
  await new Promise((r) => setTimeout(r, 6000));
}

console.log("\n────────────────────────────────");
console.log(`live (allow ~1 min for first build): ${url || `https://${owner}.github.io/${REPO}/`}`);
console.log("the hourly notify Action is scheduled and will run on its own");
console.log("────────────────────────────────");
