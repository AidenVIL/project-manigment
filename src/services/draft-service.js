import { STORAGE_KEYS, storageService } from "./storage-service.js";

function sortDrafts(drafts) {
  return [...drafts].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export const draftService = {
  loadDrafts() {
    return sortDrafts(storageService.read(STORAGE_KEYS.drafts, []));
  },
  saveDraft(draft) {
    const currentDrafts = this.loadDrafts();
    const exists = currentDrafts.some((item) => item.id === draft.id);
    const nextDrafts = sortDrafts(
      exists
        ? currentDrafts.map((item) => (item.id === draft.id ? draft : item))
        : [...currentDrafts, draft]
    );
    storageService.write(STORAGE_KEYS.drafts, nextDrafts);
    return draft;
  },
  deleteDraft(id) {
    const nextDrafts = this.loadDrafts().filter((draft) => draft.id !== id);
    storageService.write(STORAGE_KEYS.drafts, nextDrafts);
    return nextDrafts;
  },
  findDraft(id) {
    return this.loadDrafts().find((draft) => draft.id === id) || null;
  }
};
