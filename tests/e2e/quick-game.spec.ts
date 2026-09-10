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
    // Building the deck reads the hosted catalog before creating the lobby.
    await expect(host).toHaveURL(/\/join\/[A-HJ-NP-Z2-9]{6}$/, {
      timeout: 30_000,
    });

    const inviteCode = host.url().split("/").at(-1)!;
    await host.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () =>
            new Promise<void>((_resolve, reject) => {
              (
                window as Window & { rejectVidiClipboard?: () => void }
              ).rejectVidiClipboard = () =>
                reject(new Error("Clipboard unavailable"));
            }),
        },
      });
    });
    await host.getByRole("button", { name: "Share", exact: true }).click();
    await expect(
      host.getByRole("button", { name: "Opening share…", exact: true }),
    ).toBeDisabled();
    await host.evaluate(() => {
      (
        window as Window & { rejectVidiClipboard?: () => void }
      ).rejectVidiClipboard?.();
    });
    await expect(
      host.getByText("Couldn't share the invite. Please try again.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      host.getByText("Invite link copied.", { exact: true }),
    ).toHaveCount(0);
    await host.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => {} },
      });
    });
    await host.getByRole("button", { name: "Copy link", exact: true }).click();
    await expect(
      host.getByText("Invite link copied.", { exact: true }),
    ).toBeVisible();
    await friend.goto(`/join/${inviteCode}`);
    await friend.getByLabel("Your name").fill("Player B");
    await friend.getByRole("button", { name: "Join game" }).click();

    await expect(host.getByText("Player B")).toBeVisible({ timeout: 20_000 });
    await host.getByRole("button", { name: "Start game" }).click();
    await expect(host).toHaveURL(new RegExp(`/play/${inviteCode}$`), {
      timeout: 30_000,
    });
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
