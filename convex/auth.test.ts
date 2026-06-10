import { afterEach, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import { exportPKCS8, generateKeyPair } from "jose";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { SIGNUP_ENABLED } from "./auth";
import { DEV_EMAIL, DEV_PASSWORD } from "./seed";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

afterEach(() => {
  vi.unstubAllEnvs();
});

// Аккаунт для auth-тестов: seedLocal создаёт реальный Password-аккаунт
// (dev@example.com / 12345678q, scrypt-хеш) — тот же путь, что в проде.
async function seedAccount(t: ReturnType<typeof convexTest>) {
  vi.stubEnv("ALLOW_DEV_SEED", "1");
  await t.action(internal.seed.seedLocal, {});
}

// Полный успешный signIn доходит до выпуска JWT — ему нужны env прод-деплоя.
// Генерим одноразовый RS256-ключ (WebCrypto доступен в edge-runtime).
async function stubJwtEnv() {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("JWT_PRIVATE_KEY", await exportPKCS8(privateKey));
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("SITE_URL", "http://localhost:5173");
}

function signInWith(t: ReturnType<typeof convexTest>, email: string, password: string) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
}

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

describe("нормализация email в profile()", () => {
  // Password.authorize ищет аккаунт по email ИЗ РЕЗУЛЬТАТА profile() — после
  // нормализации «  DEV@Example.COM » обязан попадать в аккаунт dev@example.com.
  it("вход с email в другом регистре/с пробелами находит аккаунт и проходит", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t);
    await stubJwtEnv();

    const res = await signInWith(t, "  DEV@Example.COM ", DEV_PASSWORD);
    // Полный успех — выпущены токены сессии.
    expect(res.tokens?.token).toBeTruthy();
  });

  it("ненормализованный регистр различает «аккаунт найден» и «не найден»", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t);
    // Неверный пароль при найденном аккаунте → InvalidSecret. Если бы lookup
    // шёл по сырому email, было бы InvalidAccountId («не найден») — значит,
    // нормализация реально применяется к поиску.
    await expect(signInWith(t, "DEV@EXAMPLE.COM", "wrong-password-1")).rejects.toThrow(
      /InvalidSecret/,
    );
    // Контроль: действительно незнакомый email → InvalidAccountId.
    await expect(signInWith(t, "stranger@example.com", "wrong-password-1")).rejects.toThrow(
      /InvalidAccountId/,
    );
  });
});

describe("adminResetPassword", () => {
  it("меняет пароль: старый перестаёт работать, новый работает", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t);
    await stubJwtEnv();

    const before = await t.run(async (ctx) => (await ctx.db.query("authAccounts").collect())[0]);

    const res = await t.action(internal.auth.adminResetPassword, {
      email: DEV_EMAIL,
      newPassword: "novaSenha9",
    });
    expect(res.email).toBe(DEV_EMAIL);

    // Хеш секрета сменился и не равен plaintext.
    const after = await t.run(async (ctx) => (await ctx.db.query("authAccounts").collect())[0]);
    expect(after.secret).toBeTruthy();
    expect(after.secret).not.toBe(before.secret);
    expect(after.secret).not.toBe("novaSenha9");

    // Старый пароль больше не подходит, новый — полноценный вход.
    await expect(signInWith(t, DEV_EMAIL, DEV_PASSWORD)).rejects.toThrow(/InvalidSecret/);
    const ok = await signInWith(t, DEV_EMAIL, "novaSenha9");
    expect(ok.tokens?.token).toBeTruthy();
  });

  it("нормализует email на входе (регистр/пробелы)", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t);
    await stubJwtEnv();
    // Ненормализованный ввод попадает в тот же аккаунт: без нормализации
    // modifyAccountCredentials упал бы с «does not exist».
    const res = await t.action(internal.auth.adminResetPassword, {
      email: "  DEV@Example.COM ",
      newPassword: "novaSenha9",
    });
    expect(res.email).toBe(DEV_EMAIL);
    const ok = await signInWith(t, DEV_EMAIL, "novaSenha9");
    expect(ok.tokens?.token).toBeTruthy();
  });

  it("отказывает на пароле короче 8 символов, секрет не тронут", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t);
    const before = await t.run(async (ctx) => (await ctx.db.query("authAccounts").collect())[0]);

    await expect(
      t.action(internal.auth.adminResetPassword, { email: DEV_EMAIL, newPassword: "short7!" }),
    ).rejects.toThrow(/password too short/);

    const after = await t.run(async (ctx) => (await ctx.db.query("authAccounts").collect())[0]);
    expect(after.secret).toBe(before.secret);
  });

  it("падает на несуществующем аккаунте", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t);
    await expect(
      t.action(internal.auth.adminResetPassword, {
        email: "nobody@example.com",
        newPassword: "novaSenha9",
      }),
    ).rejects.toThrow(/does not exist/);
  });
});
