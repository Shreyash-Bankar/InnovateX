// --- PATCHED app.js – Fix sample CSV, nav active highlighting, upload nav bug ---

(() => {
  /* global bootstrap, Chart, jQuery */
  // ======= CONSTANTS & UTILITIES =======
  const COEFS = [0.18878545448393916, -0.11723346077844292, -0.0698295127519236, -0.6985640292828021, -0.41543356245300883];
  const INTERCEPT = -1.1968958699958336;

  const DEVICE_MAP = { firewall: 0, ids: 1, router: 2, switch: 3 };
  const ALERT_MAP = { BruteForce: 0, DoS: 1, Malware: 2, PingSweep: 3, PortScan: 4 };

  // Sample CSV embedded with REAL newlines (not escaped) 15 rows
  const SAMPLE_CSV = `timestamp,device,alert_type,src_ip,dst_ip,signature_id,severity,context,disposition
2025-07-24T09:15:00Z,firewall,BruteForce,10.12.5.14,192.0.2.25,3501,4,WORK_HOURS,true_positive
2025-07-24T11:02:13Z,ids,Malware,192.168.3.7,203.0.113.7,9123,5,WORK_HOURS,true_positive
2025-07-24T12:44:59Z,switch,PingSweep,172.16.4.9,198.51.100.4,4550,2,WORK_HOURS,false_positive
2025-07-24T18:05:10Z,router,PortScan,203.0.113.8,10.1.1.10,8452,3,AFTER_HOURS,true_positive
2025-07-24T02:13:38Z,firewall,DoS,192.0.2.11,192.168.1.12,1122,4,AFTER_HOURS,false_positive
2025-07-24T07:45:27Z,ids,Malware,8.8.8.8,172.16.9.4,9321,5,WORK_HOURS,true_positive
2025-07-24T21:22:01Z,router,PortScan,198.51.100.77,203.0.113.55,7455,3,AFTER_HOURS,false_positive
2025-07-24T09:50:18Z,switch,PingSweep,172.20.3.5,172.16.2.2,4500,2,WORK_HOURS,false_positive
2025-07-24T10:05:50Z,firewall,BruteForce,192.168.100.20,198.51.100.99,3502,4,WORK_HOURS,true_positive
2025-07-24T16:15:32Z,ids,Malware,10.0.0.45,192.0.2.200,9124,5,WORK_HOURS,true_positive
2025-07-24T23:12:45Z,router,DoS,203.0.113.45,172.16.4.15,1123,4,AFTER_HOURS,true_positive
2025-07-24T04:54:10Z,switch,PingSweep,198.51.100.10,203.0.113.10,4551,2,AFTER_HOURS,false_positive
2025-07-24T05:07:55Z,router,PortScan,198.51.100.1,10.4.5.6,8455,3,AFTER_HOURS,false_positive
2025-07-24T14:11:41Z,firewall,BruteForce,10.0.0.12,192.0.2.12,3503,4,WORK_HOURS,true_positive
2025-07-24T17:55:25Z,ids,Malware,192.168.56.2,198.51.100.6,9323,5,WORK_HOURS,true_positive`;

  const html = document.documentElement;
  const qs = (sel) => document.querySelector(sel);

  const state = { rows: [] };

  // ======= CSV PARSER (robust to quoted commas & CRLF) =======
  function simpleCSVParse(str) {
    const rows = [];
    const lines = str.trim().split(/\r?\n/);
    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < headers.length) continue; // skip malformed
      const obj = {};
      headers.forEach((h, idx) => (obj[h.trim()] = cols[idx] !== undefined ? cols[idx].trim() : ''));
      rows.push(obj);
    }
    return rows;
  }

  // ======= FEATURE ENGINEERING & INFERENCE =======
  function isPrivateIp(ip) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
    const [a, b] = parts;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  function addFeatures(row) {
    const severity = Number(row.severity);
    const device_enc = DEVICE_MAP[row.device] ?? -1;
    const alert_enc = ALERT_MAP[row.alert_type] ?? -1;
    const context_flag = row.context === 'WORK_HOURS' ? 1 : 0;
    const src_internal = isPrivateIp(row.src_ip) ? 1 : 0;
    const feats = [severity, device_enc, alert_enc, context_flag, src_internal];
    const z = INTERCEPT + COEFS.reduce((sum, c, idx) => sum + c * feats[idx], 0);
    const probability = 1 / (1 + Math.exp(-z));
    return {
      ...row,
      severity,
      device_enc,
      alert_enc,
      context_flag,
      src_internal,
      probability: Number(probability.toFixed(4)),
      predicted_label: probability >= 0.5 ? 'true_positive' : 'false_positive',
      suppressed: false,
    };
  }

  const activeRows = () => state.rows.filter((r) => !r.suppressed);
  function kpiStats() {
    const active = activeRows();
    const total = active.length;
    const tp = active.filter((r) => r.predicted_label === 'true_positive').length;
    const fp = active.filter((r) => r.predicted_label === 'false_positive').length;
    const avgProb = total ? active.reduce((s, r) => s + r.probability, 0) / total : 0;
    return { total, tp, fp, avgProb };
  }

  // ======= NAVIGATION HELPERS =======
  function setActiveNav(hash) {
    document.querySelectorAll('.nav__link').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  }

  // ======= ROUTING =======
  window.addEventListener('hashchange', renderRoute);
  function renderRoute() {
    const hash = window.location.hash || '#/dashboard';
    if (hash.startsWith('#/table')) renderTableView();
    else if (hash.startsWith('#/metrics')) renderMetricsView();
    else renderDashboardView();
    setActiveNav(hash);
  }

  // ======= DASHBOARD VIEW =======
  let chartInstance;
  function renderDashboardView() {
    const app = qs('#app');
    app.innerHTML = '';
    if (!state.rows.length) {
  app.innerHTML = `
    <div style="
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f4;
      color: #333;
      text-align: center;
    ">
      <p style="font-size: 1.2rem; margin-bottom: 20px;">
        No data loaded. Use "Load Sample" or "Upload CSV".
      </p>
      <div>
        <button style="
          padding: 10px 20px;
          margin: 0 10px;
          font-size: 1rem;
          border: none;
          border-radius: 5px;
          background-color: #007BFF;
          color: white;
          cursor: pointer;
          transition: background-color 0.3s ease;
        " 
        id="inlineSampleBtn">Load Sample Data</button>
        
        <button style="
          padding: 10px 20px;
          margin: 0 10px;
          font-size: 1rem;
          border: none;
          border-radius: 5px;
          background-color: #28A745;
          color: white;
          cursor: pointer;
          transition: background-color 0.3s ease;
        " 
        id="inlineUploadBtn">Upload CSV</button>
      </div>
    </div>
  `;

  // Attach events AFTER innerHTML
  document.getElementById('inlineSampleBtn').addEventListener('click', () => {
    loadRows(simpleCSVParse(SAMPLE_CSV));
  });
  document.getElementById('inlineUploadBtn').addEventListener('click', () => {
    qs('#fileInput').click();
  });

  return;
}


    const stats = kpiStats();
    const grid = document.createElement('div');
    grid.className = 'kpi-grid';
    app.appendChild(grid);
    const kpis = [
      { label: 'Total Alerts', val: stats.total, tip: 'Count of non-suppressed alerts' },
      { label: 'True Positives', val: stats.tp, tip: 'Predicted positives (prob ≥ 0.5)' },
      { label: 'False Positives', val: stats.fp, tip: 'Predicted negatives (prob < 0.5)' },
      { label: 'Avg Probability', val: stats.avgProb.toFixed(2), tip: 'Mean probability of active alerts' },
    ];
    kpis.forEach((k) => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.setAttribute('data-bs-toggle', 'tooltip');
      card.setAttribute('title', k.tip);
      card.innerHTML = `<div class="kpi-label">${k.label}</div><div class="kpi-value">${k.val}</div>`;
      grid.appendChild(card);
    });
    enableTooltips();

    // Chart
    const chartWrap = document.createElement('div');
    chartWrap.className = 'chart-container';
    chartWrap.innerHTML = '<canvas></canvas>';
    app.appendChild(chartWrap);
    const ctx = chartWrap.querySelector('canvas').getContext('2d');
    const dataCounts = [stats.tp, stats.fp];
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['true_positive', 'false_positive'], datasets: [{ data: dataCounts, backgroundColor: ['#1FB8CD', '#DB4545'] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }

  // ======= TABLE VIEW =======
  let dtInstance;
  function renderTableView() {
    const app = qs('#app');
    app.innerHTML = '';
    if (!state.rows.length) {
      app.innerHTML = '<p>No data loaded.</p>';
      return;
    }
    const table = document.createElement('table');
    table.id = 'alertsTable';
    table.className = 'display';
    app.appendChild(table);
    const headers = ['timestamp', 'device', 'alert_type', 'src_ip', 'dst_ip', 'severity', 'probability', 'predicted_label', 'suppressed', 'actions'];
    table.innerHTML = '<thead><tr>' + headers.map((h) => `<th>${h.replace('_', ' ')}</th>`).join('') + '</tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');
    state.rows.forEach((r, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${r.timestamp}</td>
        <td>${r.device}</td>
        <td>${r.alert_type}</td>
        <td>${r.src_ip}</td>
        <td>${r.dst_ip}</td>
        <td>${r.severity}</td>
        <td>${r.probability}</td>
        <td>${r.predicted_label}</td>
        <td>${r.suppressed ? '<span class="badge-suppressed">Suppressed</span>' : '<span class="badge-active">Active</span>'}</td>
        <td>
          <button class="btn btn--outline btn--sm me-2" data-act="toggle" data-idx="${idx}">${r.suppressed ? 'Unsuppress' : 'Suppress'}</button>
          <button class="btn btn--secondary btn--sm" data-act="details" data-idx="${idx}">Details</button>
        </td>`;
      tbody.appendChild(row);
    });
    // Initialise/Reset DataTable
    if (dtInstance) dtInstance.destroy();
    dtInstance = jQuery(table).DataTable({ order: [[0, 'desc']], pageLength: 10 });
    // Delegated events
    table.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      const action = btn.dataset.act;
      const row = state.rows[idx];
      if (action === 'toggle') {
        row.suppressed = !row.suppressed;
        renderTableView();
        renderDashboardView();
      } else if (action === 'details') {
        openModal(row);
      }
    });
  }

  // ======= METRICS VIEW =======
  function renderMetricsView() {
    const app = qs('#app');
    app.innerHTML = '';
    if (!state.rows.length) {
      app.innerHTML = '<p>No data loaded.</p>';
      return;
    }
    if (!('disposition' in state.rows[0])) {
      app.innerHTML = '<p>Ground truth disposition column is missing in data. Model metrics unavailable.</p>';
      return;
    }
    const metrics = computeMetrics();
    const list = document.createElement('div');
    list.className = 'metrics-container';
    const rowHTML = (l, v) => `<div class="metric-row"><span>${l}</span><span>${v}</span></div>`;
    list.innerHTML =
      rowHTML('True Positives', metrics.TP) +
      rowHTML('False Positives', metrics.FP) +
      rowHTML('True Negatives', metrics.TN) +
      rowHTML('False Negatives', metrics.FN) +
      rowHTML('Precision', metrics.precision.toFixed(2)) +
      rowHTML('Recall', metrics.recall.toFixed(2)) +
      rowHTML('F1 Score', metrics.f1.toFixed(2));
    app.appendChild(list);
  }
  function computeMetrics() {
    const active = activeRows();
    let TP = 0,
      FP = 0,
      TN = 0,
      FN = 0;
    active.forEach((r) => {
      const pred = r.predicted_label;
      const gt = r.disposition;
      if (gt === 'true_positive' && pred === 'true_positive') TP++;
      else if (gt === 'false_positive' && pred === 'true_positive') FP++;
      else if (gt === 'false_positive' && pred === 'false_positive') TN++;
      else if (gt === 'true_positive' && pred === 'false_positive') FN++;
    });
    const precision = TP + FP ? TP / (TP + FP) : 0;
    const recall = TP + FN ? TP / (TP + FN) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { TP, FP, TN, FN, precision, recall, f1 };
  }

  // ======= MODAL =======
  const modalOverlay = qs('#detailsModal');
  function openModal(data) {
    qs('#modalBody').textContent = JSON.stringify(data, null, 2);
    modalOverlay.classList.remove('hidden');
    modalOverlay.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modalOverlay.classList.add('hidden');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }
  qs('#modalClose').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeModal());
  window.addEventListener('keydown', (e) => e.key === 'Escape' && !modalOverlay.classList.contains('hidden') && closeModal());

  // ======= TOOLTIP ENABLE =======
  function enableTooltips() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => new bootstrap.Tooltip(el));
  }

  // ======= DATA LOADERS =======
  function loadRows(raw) {
    state.rows = raw.slice(0, 10000).map(addFeatures);
    renderRoute();
  }

  // Buttons
  qs('#sampleBtn').addEventListener('click', () => loadRows(simpleCSVParse(SAMPLE_CSV)));
  qs('#uploadBtn').addEventListener('click', () => qs('#fileInput').click());
  qs('#fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadRows(simpleCSVParse(ev.target.result));
      qs('#fileInput').value = '';
    };
    reader.readAsText(file);
  });

  // Theme toggle
  qs('#modeToggle').addEventListener('click', () => {
    const next = (html.getAttribute('data-color-scheme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-color-scheme', next);
  });

  // ======= INIT =======
  renderRoute();
})();
