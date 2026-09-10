import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const runE2E = process.env.VIDI_RUN_E2E === "true";
const GROUP_SIZES = [3, 4, 5] as const;
const INVITE_CODE_PATTERN = /\/join\/[A-HJ-NP-Z2-9]{6}$/;
const QUICK_DECK_SIZE = 30;

interface GroupPlayer {
  context: BrowserContext;
  name: string;
  page: Page;
}

async function createPlayer(
  browser: Browser,
  baseURL: string,
  name: string,
): Promise<GroupPlayer> {
  const context = await browser.newContext({ baseURL });
  return { context, name, page: await context.newPage() };
}

async function answerRounds(players: GroupPlayer[], rounds: number) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.all(
      players.map((player) =>
        player.page.getByRole("button", { name: "Haven't seen" }).click(),
      ),
    );
  }
}

test.describe("group Quick games", () => {
  test.skip(
    !runE2E,
    "Set VIDI_RUN_E2E=true and point VIDI_E2E_BASE_URL at an isolated test deployment.",
  );

  for (const playerCount of GROUP_SIZES) {
    test(`${playerCount} players finish and receive complete group results`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(240_000);

      const baseURL = String(testInfo.project.use.baseURL);
      const players: GroupPlayer[] = [];

      try {
        for (let index = 0; index < playerCount; index += 1) {
          players.push(
            await createPlayer(browser, baseURL, `Group Player ${index + 1}`),
          );
        }

        const [host, ...friends] = players;
        await host.page.goto("/");
        await host.page.getByRole("link", { name: "Create game" }).click();
        await host.page.getByLabel("Your name").fill(host.name);
        await host.page
          .getByRole("button", { name: /Quick, 30 movies/i })
          .click();
        await host.page
          .getByRole("button", { name: String(playerCount), exact: true })
          .click();
        await host.page
          .getByRole("button", { name: "Create game", exact: true })
          .click();
        // Match the other hosted multiplayer transitions' network allowance.
        await expect(host.page).toHaveURL(INVITE_CODE_PATTERN, {
          timeout: 30_000,
        });

        const inviteCode = host.page.url().split("/").at(-1)!;
        await Promise.all(
          friends.map(async (friend) => {
            await friend.page.goto(`/join/${inviteCode}`);
            await friend.page.getByLabel("Your name").fill(friend.name);
            await friend.page
              .getByRole("button", { name: "Join game" })
              .click();
          }),
        );

        for (const friend of friends) {
          await expect(
            host.page.getByText(friend.name, { exact: true }),
          ).toBeVisible({
            timeout: 30_000,
          });
        }

        await host.page.getByRole("button", { name: "Start game" }).click();
        await Promise.all(
          players.map((player) =>
            expect(player.page).toHaveURL(new RegExp(`/play/${inviteCode}$`), {
              timeout: 30_000,
            }),
          ),
        );

        await answerRounds(players, QUICK_DECK_SIZE - 1);

        await Promise.all(
          players
            .slice(0, -1)
            .map((player) =>
              player.page.getByRole("button", { name: "Haven't seen" }).click(),
            ),
        );
        await expect(
          host.page.getByText(
            "Your answers are saved. Waiting for everyone else to finish.",
          ),
        ).toBeVisible({ timeout: 30_000 });
        await expect(
          host.page.getByRole("button", { name: "Show results" }),
        ).toBeHidden();

        await players
          .at(-1)!
          .page.getByRole("button", { name: "Haven't seen" })
          .click();

        await Promise.all(
          players.map(async (player) => {
            const showResults = player.page.getByRole("button", {
              name: "Show results",
            });
            await expect(showResults).toBeVisible({ timeout: 90_000 });
            await showResults.click();
            await expect(player.page).toHaveURL(
              new RegExp(`/results/${inviteCode}$`),
            );
          }),
        );

        for (const player of players) {
          await expect(player.page.getByText("Movie match")).toBeVisible();
          await expect(
            player.page.getByText("Your movie personality"),
          ).toBeVisible();
          await expect(
            player.page.getByRole("heading", { name: "Shared favourites" }),
          ).toBeVisible();
          await expect(
            player.page.getByRole("heading", { name: "My watchlist" }),
          ).toBeVisible();
          await expect(
            player.page.getByRole("heading", { name: "Our watchlist" }),
          ).toBeVisible();
          for (const expectedPlayer of players) {
            await expect(
              player.page.getByText(expectedPlayer.name),
            ).toBeVisible();
          }
        }

        if (playerCount === 5) {
          const share = await host.context.request.get(
            `/api/results/${inviteCode}/share?format=story`,
          );
          expect(share.ok()).toBe(true);
          expect(share.headers()["content-type"]).toContain("image/png");
        }
      } finally {
        await Promise.all(
          players.map((player) =>
            player.context.close().catch(() => undefined),
          ),
        );
      }
    });
  }
});
