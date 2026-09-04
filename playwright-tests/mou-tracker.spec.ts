import { expect, test } from "@playwright/test";

test("live JWT workflow: login, create MOU, change status, and log activity", async ({
  page,
}) => {
  const companyName = `Playwright Smoke ${Date.now()}`;

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("abhinav.teja@vextra.ai");
  await page.getByLabel("Password").fill("XynpMCrlsZ87aJf7fyALZZKqCdo");
  await page.getByRole("button", { name: /Sign in/ }).click();

  await expect(
    page.getByRole("heading", { name: /Good morning, Abhinav/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "MOU portfolio" }),
  ).toBeVisible();
  await expect(page.getByText("Synced just now")).toBeVisible();

  await page.getByRole("button", { name: "Admin access" }).click();
  await expect(
    page.getByRole("heading", { name: "Admin access" }),
  ).toBeVisible();
  await expect(page.getByText("Workspace admin").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Supabase PostgreSQL")).toBeVisible();
  await page.getByRole("button", { name: /Companies/ }).click();

  await page.getByRole("button", { name: "Add company" }).click();
  await expect(
    page.getByRole("heading", { name: "Add a company" }),
  ).toBeVisible();
  await page.getByLabel("Company name *").fill(companyName);
  await page.getByLabel("City *").fill("Bengaluru");
  await page
    .getByLabel("MOU scope *")
    .fill("End-to-end Playwright verification");
  await page
    .getByLabel("Scope deliverables *")
    .fill("Browser test deliverables");
  await page.getByLabel("Effective / signed date *").fill("2026-09-01");
  await page.getByLabel("Expiry date *").fill("2027-12-31");
  await page.getByLabel("SPOC name *").fill("Test Internal SPOC");
  await page.getByLabel("SPOC email ID *").fill("test.spoc@vextra.ai");
  await page.getByLabel("SPOC phone number *").fill("+91 90000 00000");
  await page.getByLabel("Client contact name *").fill("Test Client Contact");
  await page.getByLabel("Client email ID *").fill("client@example.com");
  await page.getByLabel("Client phone number *").fill("+91 91111 11111");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "playwright-mou.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% playwright smoke test\n"),
    });
  await page.getByRole("button", { name: "Create company" }).click();

  await expect(page.getByRole("heading", { name: companyName })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: /Status history/ }).click();
  await expect(page.getByRole("button", { name: "Proposed" })).toBeVisible();
  await page.getByRole("button", { name: "Proposed" }).click();
  await page.getByRole("combobox").selectOption({ label: "Active" });
  await page.getByLabel("Status date *").fill("2026-09-05");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Active").last()).toBeVisible();

  await page.getByRole("button", { name: /Activities 0/ }).click();
  await page
    .getByLabel("Primary activity as per MOU *")
    .fill("Playwright smoke activity");
  await page
    .getByLabel("Activity details")
    .fill("Verified the activity endpoint and attributed user flow.");
  await page.getByLabel("Activity date *").fill("2026-09-04");
  await page.getByRole("button", { name: "Add activity" }).click();
  await expect(page.getByText("Playwright smoke activity")).toBeVisible();

  await page.getByRole("button", { name: /Edit all details/ }).click();
  await page.getByLabel("City *").fill("Mysuru");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: /Audit log/ }).click();
  await expect(page.getByText("City").last()).toBeVisible();
  await expect(page.getByText("Abhinav Teja").last()).toBeVisible();
});
