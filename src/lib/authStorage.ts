import { Preferences } from "@capacitor/preferences";
import type { TokenStorage } from "@convex-dev/auth/react";
import { isNative } from "./native";

// Токены Convex Auth в iOS-оболочке — в @capacitor/preferences (UserDefaults),
// а не в localStorage WKWebView: WebKit вправе чистить script-writable storage
// (политика на неактивность), и пользователь молча вылетал бы из аккаунта.
// UserDefaults живут до удаления приложения. Контракт TokenStorage допускает
// промисы; отсутствующий ключ — null.
export const nativeTokenStorage: TokenStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  },
  async setItem(key, value) {
    await Preferences.set({ key, value });
  },
  async removeItem(key) {
    await Preferences.remove({ key });
  },
};

// Проп `storage` для ConvexAuthProvider: в нативной оболочке — адаптер выше, в
// вебе — undefined (провайдер остаётся на своём localStorage, как раньше).
export function pickTokenStorage(): TokenStorage | undefined {
  return isNative() ? nativeTokenStorage : undefined;
}
