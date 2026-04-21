import { STORAGE_KEYS, storageService } from "./storage-service.js";

export const authService = {
  loadSession() {
    return storageService.read(STORAGE_KEYS.session, null);
  },
  getAccessToken() {
    return "";
  },
  getUser() {
    return this.isSignedIn() ? { email: "Shared Team Access" } : null;
  },
  isSignedIn() {
    return Boolean(this.loadSession()?.unlocked);
  },
  async signIn(password, expectedPassword) {
    if (!expectedPassword) {
      storageService.write(STORAGE_KEYS.session, { unlocked: true });
      return { unlocked: true };
    }

    if (password !== expectedPassword) {
      throw new Error("That password is not correct.");
    }

    const session = {
      unlocked: true,
      unlockedAt: new Date().toISOString()
    };
    storageService.write(STORAGE_KEYS.session, session);
    return session;
  },
  async signOut() {
    storageService.remove(STORAGE_KEYS.session);
  }
};
