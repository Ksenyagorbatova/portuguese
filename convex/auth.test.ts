import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { SIGNUP_ENABLED } from "./auth";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

describe("registration disabled", () => {
  it("ships with the SIGNUP_ENABLED flag off", () => {
    expect(SIGNUP_ENABLED).toBe(false);
  });

  it("rejects the password signUp flow on the server", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "newcomer@example.com", password: "password123", flow: "signUp" },
      }),
    ).rejects.toThrow(/REGISTRATION_DISABLED/);

    // And no user/account row leaked through.
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  it("does not block the signIn flow with the registration error", async () => {
    const t = convexTest(schema, modules);
    // No such account → must fail, but NOT because registration is disabled.
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "nobody@example.com", password: "password123", flow: "signIn" },
      }),
    ).rejects.not.toThrow(/REGISTRATION_DISABLED/);
  });
});
