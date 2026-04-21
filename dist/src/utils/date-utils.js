export function toDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toInputDate(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function addDaysToInputDate(value, days) {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

export function daysUntil(value) {
  const target = toDate(value);
  if (!target) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function sortByDate(items, key = "date") {
  return [...items].sort((left, right) => {
    const leftDate = toDate(left[key])?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDate = toDate(right[key])?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate;
  });
}
