import { STORAGE_KEYS, storageService } from "./storage-service.js";
import { accountService } from "./account-service.js";
import { isSupabaseConfigured } from "../config/runtime-config.js";

export const authService = {
  loadSession() {
    return storageService.read(STORAGE_KEYS.session, null);
  },
  getAccessToken() {
    return "";
  },
  getUser() {
    const session = this.loadSession();
    if (!session?.unlocked) {
      return null;
    }

    return {
      username: session.username || "shared",
      role: session.role || "member"
    };
  },
  isSignedIn() {
    return Boolean(this.loadSession()?.unlocked);
  },
  async signIn(credentials = {}, expectedPassword) {
    const username = String(credentials.username || "").trim().toLowerCase();
    const password = String(credentials.password || "");

    if (isSupabaseConfigured()) {
      const login = await accountService.login(username, password);
      if (login.status === "setup_required") {
        return {
          status: "setup_required",
          user: login.user
        };
      }

      const session = {
        unlocked: true,
        username: login.user.username,
        role: login.user.role || "member",
        unlockedAt: new Date().toISOString()
      };
      storageService.write(STORAGE_KEYS.session, session);
      return { status: "ok", session };
    }

    if (!expectedPassword) {
      const session = {
        unlocked: true,
        username: username || "shared",
        role: "admin",
        unlockedAt: new Date().toISOString()
      };
      storageService.write(STORAGE_KEYS.session, session);
      return { status: "ok", session };
    }

    if (password !== expectedPassword) {
      throw new Error("That password is not correct.");
    }

    const session = {
      unlocked: true,
      username: username || "shared",
      role: "admin",
      unlockedAt: new Date().toISOString()
    };
    storageService.write(STORAGE_KEYS.session, session);
    return { status: "ok", session };
  },
  async completeFirstLogin(username, password) {
    await accountService.setPassword(username, password);
    return true;
  },
  async signOut() {
    storageService.remove(STORAGE_KEYS.session);
  }
};
