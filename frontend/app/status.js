const API_BASE = 'http://localhost:8080';

async function checkStatus() {
  const apiEl = document.getElementById('api-status');
  const dbEl = document.getElementById('db-status');
  const latencyEl = document.getElementById('db-latency');
  const metaEl = document.getElementById('meta-status');
  if (!apiEl || !dbEl) return;

  apiEl.textContent = 'Checking…';
  apiEl.className = 'badge pending';

  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();

    apiEl.textContent = response.ok ? 'OK' : 'Error';
    apiEl.className = response.ok ? 'badge ok' : 'badge error';

    dbEl.textContent = data.database ?? 'unknown';
    dbEl.className = data.database === 'connected' ? 'badge ok' : 'badge error';

    if (latencyEl) latencyEl.textContent = data.latencyMs != null ? `${data.latencyMs} ms` : '-';
    if (metaEl) metaEl.textContent = [data.uptime ?? null, data.version ?? null, data.timestamp ?? null].filter(Boolean).join(' • ');
  } catch (err) {
    apiEl.textContent = 'Error';
    apiEl.className = 'badge error';
    dbEl.textContent = 'unreachable';
    dbEl.className = 'badge error';
    if (latencyEl) latencyEl.textContent = '-';
    if (metaEl) metaEl.textContent = err instanceof Error ? err.message : 'fetch failed';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void checkStatus();
  setInterval(() => void checkStatus(), 30_000);
  document.getElementById('retry-btn')?.addEventListener('click', () => void checkStatus());
});
