import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { expect, test } from "@playwright/test";

test("auth feedback blocks repeated requests and recovers after email failure", async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.VIDI_RUN_FEEDBACK_E2E !== "true",
    "Opt in to feedback checks.",
  );
  if (
    !baseURL ||
    !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
  )
    throw new Error("Use a local test server.");
  let sends = 0;
  await page.route("**/auth/v1/**", async (route) => {
    // Every Auth request is intercepted: this test must never send an email.
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/otp")) {
      sends++;
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        status: sends === 1 ? 400 : 200,
        contentType: "application/json",
        body:
          sends === 1
            ? JSON.stringify({ msg: "Please try sending again." })
            : "{}",
      });
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ msg: "This code has expired." }),
    });
  });
  await page.goto("/auth");
  await page.getByLabel("Email address").fill("feedback@example.com");
  await page.locator("form").evaluate((node) => {
    (node as HTMLFormElement).requestSubmit();
    (node as HTMLFormElement).requestSubmit();
  });
  await expect(
    page.getByRole("button", { name: "Sending email…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Please try sending again.", { exact: true }),
  ).toBeVisible();
  expect(sends).toBe(1);
  await page
    .getByRole("button", { name: "Email me a sign-in link", exact: true })
    .click();
  await expect(
    page.getByText(
      "Email sent. Check your inbox for the sign-in link or code.",
    ),
  ).toBeVisible();
  await page.getByLabel("One-time code").fill("12345678");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("This code has expired.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify code", exact: true }),
  ).toBeEnabled();
});

test("profile save shows pending, success and recoverable failure without duplicate writes", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    process.env.VIDI_RUN_FEEDBACK_E2E !== "true",
    "Opt in against the isolated E2E environment.",
  );
  test.setTimeout(180_000);
  if (
    !baseURL ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
  )
    throw new Error("Feedback test requires a local server.");
  // Match the local server's environment; still refuse every non-E2E host.
  const source = await readFile(".env.local", "utf8");
  const env = Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [
          line.slice(0, i).trim(),
          line
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (new URL(url).hostname !== "gugfrvtsjnflttgyreat.supabase.co")
    throw new Error("Refusing feedback test outside vidi-e2e.");
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const marker = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = `Vidi-${randomUUID()}!`;
  const email = `feedback-${marker}@example.com`;
  const ids: string[] = [];
  try {
    for (const address of [email, `feedback-other-${marker}@example.com`]) {
      const { data, error } = await admin.auth.admin.createUser({
        email: address,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        throw new Error("Could not create isolated feedback fixture.");
      ids.push(data.user.id);
    }
    const taken = `taken_${marker}`;
    const reserved = await admin
      .from("profiles")
      .update({ username: taken })
      .eq("id", ids[1]);
    if (reserved.error) throw new Error("Could not prepare username fixture.");
    const cookies: { name: string; value: string }[] = [];
    const auth = createServerClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => cookies,
        setAll: (values) => {
          for (const value of values)
            cookies.push({ name: value.name, value: value.value });
        },
      },
    });
    const login = await auth.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error("Could not sign into feedback fixture.");
    await context.addCookies(
      cookies.map((cookie) => ({
        ...cookie,
        domain: new URL(baseURL).hostname,
        path: "/",
        sameSite: "Lax" as const,
      })),
    );
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/profile");
    await page
      .getByLabel("Display name", { exact: true })
      .fill("Feedback Viewer");
    await page.getByLabel("Username", { exact: true }).fill(`viewer_${marker}`);
    let posts = 0;
    await page.route("**/profile", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.continue();
    });
    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save profile", exact: true }),
    });
    await form.evaluate((node) => {
      (node as HTMLFormElement).requestSubmit();
      (node as HTMLFormElement).requestSubmit();
    });
    await expect(
      page.getByRole("button", { name: "Saving profile…", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Profile saved. Your changes are ready."),
    ).toBeVisible({ timeout: 30_000 });
    expect(posts).toBe(1);
    await expect(
      page.getByRole("heading", { name: "Feedback Viewer", exact: true }),
    ).toBeVisible();

    await page.getByLabel("Username", { exact: true }).fill(taken);
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByText("That username is already taken. Choose another one."),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
      taken,
    );
    await expect(page.getByLabel("Username", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await page.getByLabel("Username", { exact: true }).fill(`viewer_${marker}`);
    await page
      .getByLabel("Avatar URL (optional)")
      .fill("http://example.com/avatar.png");
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.getByText("Use an HTTPS image URL.")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel("Avatar URL (optional)").fill("");
    await page.unroute("**/profile");
    await page.route("**/profile", (route) =>
      route.request().method() === "POST"
        ? route.abort("failed")
        : route.continue(),
    );
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByText(
        "Your profile couldn't be saved. Check your connection and try again.",
      ),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
      "Feedback Viewer",
    );
    await page.screenshot({
      path: "test-results/profile-feedback-mobile.png",
      fullPage: true,
    });
    await page.unroute("**/profile");
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByText("Profile saved. Your changes are ready."),
    ).toBeVisible({ timeout: 30_000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const { data: movie, error: movieError } = await admin
      .from("movies")
      .select("id,title")
      .limit(1)
      .single();
    if (movieError || !movie)
      throw new Error("Feedback fixture needs a cached movie.");
    await page.goto(`/watchlist?q=${encodeURIComponent(movie.title)}`);
    const addForm = page.locator("form").filter({
      has: page.locator(`input[name="movieId"][value="${movie.id}"]`),
    });
    await page.route("**/watchlist**", async (route) => {
      if (route.request().method() === "POST")
        await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await addForm.getByRole("button", { name: "+ Add", exact: true }).click();
    await expect(
      addForm.getByRole("button", { name: "Adding…", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Added to your watchlist.", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      addForm.getByRole("button", { name: "Added", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: `Mark ${movie.title} as watched`,
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Marked as watched.", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("button", {
        name: `Remove ${movie.title} from watchlist`,
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Removed from your watchlist.", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      addForm.getByRole("button", { name: "+ Add", exact: true }),
    ).toBeEnabled();
  } finally {
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("Feedback fixture cleanup failed.");
    }
  }
});
