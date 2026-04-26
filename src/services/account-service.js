import { STORAGE_KEYS, storageService } from "./storage-service.js";
import { supabaseService } from "./supabase-service.js";

function normalizeUsername(username = "") {
  return String(username || "").trim().toLowerCase();
}

function readFallbackUsers() {
  return storageService.read(STORAGE_KEYS.accounts, []);
}

function writeFallbackUsers(users = []) {
  storageService.write(STORAGE_KEYS.accounts, users);
}

function toUserRecord(raw = {}) {
  return {
    username: raw.username || "",
    role: raw.role || "member",
    mustSetPassword: Boolean(raw.must_set_password ?? raw.mustSetPassword ?? true),
    isActive: Boolean(raw.is_active ?? raw.isActive ?? true),
    createdAt: raw.created_at || raw.createdAt || "",
    updatedAt: raw.updated_at || raw.updatedAt || ""
  };
}

async function listUsersFromSupabase() {
  const rows = await supabaseService.list(
    "workspace_users",
    "select=username,role,must_set_password,is_active,created_at,updated_at&order=username.asc"
  );
  return rows.map(toUserRecord);
}

export const accountService = {
  async listUsers() {
    if (supabaseService.isReady()) {
      return listUsersFromSupabase();
    }

    return readFallbackUsers();
  },
  async createUser(username, role = "member") {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error("Enter a username first.");
    }

    if (supabaseService.isReady()) {
      await supabaseService.rpc("workspace_create_user", {
        p_username: normalized,
        p_role: role
      });
      const users = await listUsersFromSupabase();
      return users.find((entry) => entry.username === normalized) || null;
    }

    const users = readFallbackUsers();
    const existing = users.find((entry) => normalizeUsername(entry.username) === normalized);
    const now = new Date().toISOString();
    const nextRecord = existing
      ? {
          ...existing,
          username: normalized,
          role,
          mustSetPassword: true,
          isActive: true,
          updatedAt: now
        }
      : {
          username: normalized,
          role,
          mustSetPassword: true,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

    const nextUsers = existing
      ? users.map((entry) =>
          normalizeUsername(entry.username) === normalized ? nextRecord : entry
        )
      : [...users, nextRecord];
    writeFallbackUsers(nextUsers);
    return nextRecord;
  },
  async resetPassword(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error("Missing username for password reset.");
    }

    if (supabaseService.isReady()) {
      await supabaseService.rpc("workspace_reset_user_password", {
        p_username: normalized
      });
      return true;
    }

    const users = readFallbackUsers();
    const nextUsers = users.map((entry) =>
      normalizeUsername(entry.username) === normalized
        ? { ...entry, mustSetPassword: true, password: "", updatedAt: new Date().toISOString() }
        : entry
    );
    writeFallbackUsers(nextUsers);
    return true;
  },
  async login(username, password = "") {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error("Enter your username to continue.");
    }

    if (supabaseService.isReady()) {
      const response = await supabaseService.rpc("workspace_login", {
        p_username: normalized,
        p_password: String(password || "")
      });
      if (!response || response.status === "invalid") {
        throw new Error("Username or password is not correct.");
      }

      return {
        status: response.status,
        user: {
          username: response.username || normalized,
          role: response.role || "member"
        }
      };
    }

    const users = readFallbackUsers();
    const entry = users.find((item) => normalizeUsername(item.username) === normalized);
    if (!entry || entry.isActive === false) {
      throw new Error("Username or password is not correct.");
    }

    if (entry.mustSetPassword || !entry.password) {
      return {
        status: "setup_required",
        user: {
          username: entry.username,
          role: entry.role || "member"
        }
      };
    }

    if (String(entry.password) !== String(password || "")) {
      throw new Error("Username or password is not correct.");
    }

    return {
      status: "ok",
      user: {
        username: entry.username,
        role: entry.role || "member"
      }
    };
  },
  async setPassword(username, newPassword) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error("Missing username for password setup.");
    }

    if (!String(newPassword || "").trim()) {
      throw new Error("Enter a password first.");
    }

    if (supabaseService.isReady()) {
      const response = await supabaseService.rpc("workspace_set_password", {
        p_username: normalized,
        p_new_password: String(newPassword)
      });

      if (!response || response.status !== "ok") {
        throw new Error("Could not set password for this account.");
      }

      return true;
    }

    const users = readFallbackUsers();
    const nextUsers = users.map((entry) =>
      normalizeUsername(entry.username) === normalized
        ? {
            ...entry,
            password: String(newPassword),
            mustSetPassword: false,
            updatedAt: new Date().toISOString()
          }
        : entry
    );
    writeFallbackUsers(nextUsers);
    return true;
  }
};
