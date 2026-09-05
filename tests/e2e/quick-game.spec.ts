import { expect, test } from "@playwright/test";

const runE2E = process.env.VIDI_RUN_E2E === "true";

test.describe("two-player Quick game", () => {
  test.skip(
    !runE2E,
    "Set VIDI_RUN_E2E=true and point VIDI_E2E_BASE_URL at an isolated test deployment.",
  );

  test("create, join, finish, unlock results and render a share card", async ({
    browser,
    context: hostContext,
    page: host,
  }, testInfo) => {
    const friendContext = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
    });
    const friend = await friendContext.newPage();

    await host.goto("/");
    await host.getByRole("link", { name: "Create game" }).click();
    await host.getByLabel("Your name").fill("Player A");
    await host.getByRole("button", { name: /Quick, 30 movies/i }).click();
    await host
      .getByRole("button", { name: "Create game", exact: true })
      .click();
    await expect(host).toHaveURL(/\/join\/[A-HJ-NP-Z2-9]{6}$/);

    const inviteCode = host.url().split("/").at(-1)!;
    await friend.goto(`/join/${inviteCode}`);
    await friend.getByLabel("Your name").fill("Player B");
    await friend.getByRole("button", { name: "Join game" }).click();

    await expect(host.getByText("Player B")).toBeVisible({ timeout: 20_000 });
    await host.getByRole("button", { name: "Start game" }).click();
    await expect(host).toHaveURL(new RegExp(`/play/${inviteCode}$`));
    await expect(friend).toHaveURL(new RegExp(`/play/${inviteCode}$`), {
      timeout: 20_000,
    });

    for (let index = 0; index < 30; index += 1) {
      await Promise.all([
        host.getByRole("button", { name: "Haven't seen" }).click(),
        friend.getByRole("button", { name: "Haven't seen" }).click(),
      ]);
    }

    await host.getByRole("button", { name: "Show results" }).click();
    await friend.getByRole("button", { name: "Show results" }).click();
    await expect(host.getByText("Movie match")).toBeVisible();
    await expect(friend.getByText("Movie match")).toBeVisible();

    const share = await hostContext.request.get(
      `/api/results/${inviteCode}/share?format=story`,
    );
    expect(share.ok()).toBe(true);
    expect(share.headers()["content-type"]).toContain("image/png");

    await friendContext.close();
  });
});
