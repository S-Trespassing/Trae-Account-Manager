import { chromium } from "playwright";

const cdpUrl = process.env.CDP_URL || "http://127.0.0.1:9222";

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());

const findAppPage = () =>
  context.pages().find((p) => p.url().includes("localhost:1420"));

let page = findAppPage();
if (!page) {
  page = await context.newPage();
  await page.goto("http://localhost:1420/", { waitUntil: "domcontentloaded" });
} else if (!page.url().includes("localhost:1420")) {
  await page.goto("http://localhost:1420/", { waitUntil: "domcontentloaded" });
}

await page.waitForLoadState("domcontentloaded");

const sidebarItems = page.locator(".sidebar-item");
if (await sidebarItems.count()) {
  await sidebarItems.nth(1).click();
}

const loading = page.locator(".loading");
if (await loading.count()) {
  await loading.first().waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
}

const items = page.locator(".account-list-item, .account-card");
const totalBefore = await items.count();
if (totalBefore === 0) {
  const emptyState = await page.locator(".empty-state").count();
  console.error(`No accounts found to delete. emptyState=${emptyState}`);
  await browser.close();
  process.exit(1);
}

const firstItem = items.first();
const emailLocator = firstItem.locator(".list-item-email, .email-text");
const emailText = (await emailLocator.first().textContent())?.trim() || "unknown";

await firstItem.click({ button: "right" });
await page.locator(".context-menu").waitFor({ state: "visible", timeout: 5000 });

const deleteItem = page.locator(".context-menu-item.danger");
await deleteItem.click();

const confirmButton = page.locator(".confirm-btn.danger");
await confirmButton.waitFor({ state: "visible", timeout: 5000 });
await confirmButton.click();

await page.waitForFunction(
  (initial) => {
    const count = document.querySelectorAll(".account-list-item, .account-card").length;
    return count > 0 && count < initial;
  },
  totalBefore,
  { timeout: 15000 }
);

const totalAfter = await items.count();
const emptyStateAfter = await page.locator(".empty-state").count();
console.log(`Deleted account: ${emailText}. Count: ${totalBefore} -> ${totalAfter}. emptyState=${emptyStateAfter}`);

await browser.close();
