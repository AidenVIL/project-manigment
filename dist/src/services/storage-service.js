export const STORAGE_KEYS = {
  companies: "sponsor-command-centre.companies",
  templates: "sponsor-command-centre.templates",
  drafts: "sponsor-command-centre.drafts",
  projectPlan: "sponsor-command-centre.project-plan",
  session: "sponsor-command-centre.session",
  accounts: "sponsor-command-centre.accounts"
};

const memoryStore = new Map();

function getStorage() {
  try {
    if (window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn("Local storage unavailable, using in-memory fallback.", error);
  }

  return {
    getItem(key) {
      return memoryStore.get(key) || null;
    },
    setItem(key, value) {
      memoryStore.set(key, value);
    },
    removeItem(key) {
      memoryStore.delete(key);
    }
  };
}

export const storageService = {
  read(key, fallback = null) {
    const storage = getStorage();
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Could not parse stored value for ${key}.`, error);
      return fallback;
    }
  },
  write(key, value) {
    const storage = getStorage();
    storage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    const storage = getStorage();
    storage.removeItem(key);
  }
};
