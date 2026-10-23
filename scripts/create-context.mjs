// One-time setup: creates a Browserbase Context, opens Instagram in a live
// browser so you can log in by hand, then saves the logged-in state.
// Run: node --env-file=.env.local scripts/create-context.mjs
import Browserbase from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import readline from "node:readline/promises";

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;
if (!apiKey || !projectId) {
  console.error("Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in .env.local");
  process.exit(1);
}

const bb = new Browserbase({ apiKey });

const context = await bb.contexts.create({ projectId });

const browser = await browserbase.launch({
  apiKey,
  projectId,
  keepAlive: true,
  browserSettings: { context: { id: context.id, persist: true } },
});
const sessionId = browser.sessionId;
// Attaches the browser so its pages can be driven (no model needed).
const stagehand = await Stagehand.create({ browser });

const [page] = await browser.context.pages();
await page.goto("https://www.instagram.com/accounts/login/");

const { debuggerFullscreenUrl } = await bb.sessions.debug(sessionId);
console.log("\n1. Open this live view and log in to Instagram:\n");
console.log(`   ${debuggerFullscreenUrl}\n`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question("2. Press Enter here once you see your Instagram feed... ");
rl.close();

await stagehand.close();
await browser.close();
// Ending the session is what writes cookies back into the persisted context.
await bb.sessions.update(sessionId, { projectId, status: "REQUEST_RELEASE" }).catch(() => {});

console.log("\n3. Done. Add this line to .env.local:\n");
console.log(`   BROWSERBASE_CONTEXT_ID=${context.id}\n`);
