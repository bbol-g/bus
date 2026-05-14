const KEY = 'shuttle_dashboard_v1';

export function loadData() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function resetData() {
  localStorage.removeItem(KEY);
}

export function exportData() {
  return loadData();
}
