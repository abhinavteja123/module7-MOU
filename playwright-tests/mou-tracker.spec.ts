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
    page.getByRole("heading", { name: "Agreement control center" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "MOU portfolio" }),
  ).toBeVisible();
  await expect(page.getByText("Synced just now")).toBeVisible({
    timeout: 15_000,
  });
  for (const status of ["Active", "Expected renewal", "Approved"]) {
    await expect(
      page.getByRole("button", { name: `Show ${status} MOUs` }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Show MOUs expiring in 30 days" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show Active MOUs" }).click();
  await expect(
    page.getByRole("heading", { name: "All companies" }),
  ).toBeVisible();
  await expect(page.locator(".filter-row select")).toHaveValue("Active");

  await page.getByRole("button", { name: "User management" }).click();
  await expect(
    page.getByRole("heading", { name: "User management" }),
  ).toBeVisible();
  await expect(page.getByText("Super admin").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0);
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
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-mou.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% playwright smoke test\n"),
  });
  await page.getByRole("button", { name: "Create company" }).click();

  await expect(page.getByRole("heading", { name: companyName })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Document actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Download" })).toBeVisible();
  await expect(page.getByText("Add document", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Replace document", { exact: true }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "PDF preview" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close PDF preview" }).click();
  await page.getByRole("button", { name: "Document actions" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("playwright-mou.pdf");
  await page.getByRole("button", { name: /Status history/ }).click();
  await expect(page.getByRole("button", { name: "Proposed" })).toBeVisible();
  await page.getByRole("button", { name: "Proposed" }).click();
  await page.locator(".drawer-status select").selectOption({ label: "Active" });
  await page.getByLabel("Status date *").fill("2026-09-05");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Active", exact: true }),
  ).toBeVisible();

  await page.locator(".drawer-status .status").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Choose a different status before saving."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

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
  await expect(
    page.getByText("Effective / signed date (locked)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Effective / signed date *")).toHaveCount(0);
  await page.getByLabel("City *").fill("Mysuru");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: /Audit log/ }).click();
  await expect(page.getByText("City updated").last()).toBeVisible();
  await expect(page.getByText("Status changed").last()).toBeVisible();
  await expect(page.getByText("Abhinav Teja").last()).toBeVisible();
});
