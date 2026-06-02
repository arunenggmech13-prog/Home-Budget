/* ===================================================
   BudgetWise — Home Budget App — app.js
   =================================================== */

// ───────────────────────────────────────────────────
//  DATA STORE (persisted to localStorage)
// ───────────────────────────────────────────────────
const STORAGE_KEY = 'budgetwise_v3';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return getDefaultData();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDefaultData() {
  return {
    transactions: [],
    categories: {
      income: [
        { id: 'i1', name: 'Salary', emoji: '💼' },
        { id: 'i2', name: 'Freelance', emoji: '💻' },
        { id: 'i3', name: 'Investment', emoji: '📈' },
        { id: 'i4', name: 'Rental', emoji: '🏠' },
        { id: 'i5', name: 'Other Income', emoji: '💰' },
      ],
      expense: [
        { id: 'e1', name: 'Food & Dining', emoji: '🍔' },
        { id: 'e2', name: 'Groceries', emoji: '🛒' },
        { id: 'e3', name: 'Transport', emoji: '🚗' },
        { id: 'e4', name: 'Rent', emoji: '🏡' },
        { id: 'e5', name: 'Utilities', emoji: '💡' },
        { id: 'e6', name: 'Health', emoji: '🏥' },
        { id: 'e7', name: 'Shopping', emoji: '🛍️' },
        { id: 'e8', name: 'Entertainment', emoji: '🎬' },
        { id: 'e9', name: 'Education', emoji: '📚' },
        { id: 'e10', name: 'Other', emoji: '📦' },
      ]
    }
  };
}

let state = loadData();

// ───────────────────────────────────────────────────
//  CURRENT VIEW STATE
// ───────────────────────────────────────────────────
let currentTab = 'dashboard';
let currentFilter = 'all';
let currentType = 'expense';
let currentCatType = 'expense';
let selectedEmoji = '📦';
let editingTxId = null;
let addingCatType = 'expense';

let viewDate = new Date();
viewDate.setDate(1);

// Chart instances
let dashExpChartInst = null;
let dashIncChartInst = null;
let dashTrendChartInst = null;
let expPieInst = null;
let incPieInst = null;
let barCompareInst = null;

// ───────────────────────────────────────────────────
//  HELPERS
// ───────────────────────────────────────────────────
function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '₹0';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtCompact(n) {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(1) + 'Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateGroup(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const txDay = new Date(d); txDay.setHours(0,0,0,0);
  if (txDay.getTime() === today.getTime()) return 'Today';
  if (txDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' });
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthTransactions() {
  const mk = monthKey(viewDate);
  return state.transactions.filter(tx => tx.date.startsWith(mk));
}

function getCategoryById(id) {
  const all = [...state.categories.income, ...state.categories.expense];
  return all.find(c => c.id === id);
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function monthName(d) {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Palette for charts
const PALETTE_EXP = [
  '#ff4f7b','#ff8c69','#fbbf24','#f97316','#ef4444',
  '#ec4899','#a855f7','#8b5cf6','#6366f1','#f43f5e'
];
const PALETTE_INC = [
  '#00e87b','#00bfa5','#22d3ee','#34d399','#10b981',
  '#6ee7b7','#a3e635','#4ade80','#2dd4bf','#38bdf8'
];

// ───────────────────────────────────────────────────
//  MONTH NAVIGATION
// ───────────────────────────────────────────────────
function updateMonthLabel() {
  const label = monthName(viewDate);
  document.getElementById('currentMonthLabel').textContent = label;
  document.getElementById('dashboardMonth').textContent = label;
  document.getElementById('txMonthLabel').textContent = label;
  document.getElementById('chartMonthLabel').textContent = label;
}

document.getElementById('prevMonth').addEventListener('click', () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  updateMonthLabel();
  refresh();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  updateMonthLabel();
  refresh();
});

// ───────────────────────────────────────────────────
//  BOTTOM NAV
// ───────────────────────────────────────────────────
document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

document.getElementById('navAdd').addEventListener('click', openAddModal);
document.getElementById('seeAllBtn').addEventListener('click', () => switchTab('transactions'));

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  refresh();
}

// ───────────────────────────────────────────────────
//  SUMMARY CARDS
// ───────────────────────────────────────────────────
function updateSummaryCards() {
  const txs = getMonthTransactions();
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  document.getElementById('totalIncome').textContent = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);
  const balEl = document.getElementById('totalBalance');
  balEl.textContent = fmt(Math.abs(balance));
  balEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
}

// ───────────────────────────────────────────────────
//  TRANSACTION LIST
// ───────────────────────────────────────────────────
function renderTransactionList(containerId, emptyId, txs) {
  const container = document.getElementById(containerId);
  const emptyEl = document.getElementById(emptyId);
  container.innerHTML = '';

  if (!txs.length) {
    emptyEl.classList.add('visible');
    return;
  }
  emptyEl.classList.remove('visible');

  // Group by date
  const groups = {};
  txs.forEach(tx => {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  sortedDates.forEach(date => {
    const header = document.createElement('div');
    header.className = 'date-group-header';
    header.textContent = formatDateGroup(date);
    container.appendChild(header);

    groups[date].forEach(tx => {
      const cat = getCategoryById(tx.categoryId);
      const item = document.createElement('div');
      item.className = `tx-item ${tx.type}`;
      item.dataset.id = tx.id;
      item.innerHTML = `
        <div class="tx-emoji">${cat ? cat.emoji : '📦'}</div>
        <div class="tx-info">
          <div class="tx-category">${cat ? cat.name : 'Unknown'}</div>
          <div class="tx-meta">${tx.type === 'income' ? 'Income' : 'Expense'}</div>
          ${tx.note ? `<div class="tx-note-pill"><span class="note-icon">📝</span>${tx.note}</div>` : ''}
        </div>
        <div class="tx-right">
          <div class="tx-amount">${tx.type === 'expense' ? '-' : '+'}${fmt(tx.amount)}</div>
          <div class="tx-date-badge">${formatDate(tx.date)}</div>
        </div>
        <button class="tx-delete" data-id="${tx.id}" aria-label="Delete transaction">✕</button>
      `;
      container.appendChild(item);
    });
  });

  // Delete handlers
  container.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      state.transactions = state.transactions.filter(t => t.id !== id);
      saveData();
      refresh();
      showToast('Transaction deleted');
    });
  });
}

function renderRecentTransactions() {
  const txs = getMonthTransactions()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  renderTransactionList('recentList', 'recentEmpty', txs);
}

function renderAllTransactions() {
  let txs = getMonthTransactions().sort((a, b) => b.date.localeCompare(a.date));
  if (currentFilter !== 'all') {
    txs = txs.filter(t => t.type === currentFilter);
  }
  renderTransactionList('transactionList', 'transactionEmpty', txs);
}

// Filter chips
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderAllTransactions();
  });
});

// ───────────────────────────────────────────────────
//  CATEGORIES
// ───────────────────────────────────────────────────
function renderCategories() {
  renderCatList('income');
  renderCatList('expense');
}

function renderCatList(type) {
  const container = document.getElementById(type === 'income' ? 'incomeCatList' : 'expenseCatList');
  container.innerHTML = '';
  const cats = state.categories[type];
  const txs = state.transactions;

  cats.forEach(cat => {
    const count = txs.filter(t => t.categoryId === cat.id).length;
    const item = document.createElement('div');
    item.className = 'cat-item';
    item.innerHTML = `
      <span class="cat-emoji">${cat.emoji}</span>
      <span class="cat-name">${cat.name}</span>
      <span class="cat-count">${count} tx</span>
      <button class="cat-delete" data-id="${cat.id}" data-type="${type}" aria-label="Delete category">✕</button>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('.cat-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const t = btn.dataset.type;
      const inUse = state.transactions.some(tx => tx.categoryId === id);
      if (inUse) {
        showToast('Cannot delete — category in use');
        return;
      }
      state.categories[t] = state.categories[t].filter(c => c.id !== id);
      saveData();
      renderCategories();
      showToast('Category removed');
    });
  });
}

// ───────────────────────────────────────────────────
//  CHARTS
// ───────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(26,26,62,0.97)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#f0f0ff',
      bodyColor: '#a0a0cc',
      padding: 10,
      cornerRadius: 10,
      callbacks: {
        label: ctx => ` ${fmt(ctx.raw)}`
      }
    }
  }
};

function buildDonut(canvasId, labels, data, palette, centerEl, legendEl) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const total = data.reduce((s, v) => s + v, 0);
  if (centerEl) document.getElementById(centerEl).textContent = fmtCompact(total);

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, data.length),
        borderColor: 'transparent',
        borderWidth: 0,
        hoverBorderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '68%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}`
          }
        }
      }
    }
  });

  if (legendEl) {
    const legendContainer = document.getElementById(legendEl);
    legendContainer.innerHTML = '';
    labels.forEach((label, i) => {
      if (total === 0) return;
      const pct = ((data[i] / total) * 100).toFixed(0);
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-dot" style="background:${palette[i]}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-pct">${pct}%</span>
      `;
      legendContainer.appendChild(item);
    });
    if (total === 0) {
      legendContainer.innerHTML = '<div class="legend-item"><span style="color:var(--text3);font-size:11px">No data</span></div>';
    }
  }

  return chart;
}

function buildFullDonut(canvasId, labels, data, amounts, palette, legendEl) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const total = data.reduce((s, v) => s + v, 0);

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, data.length),
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '60%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}`
          }
        }
      }
    }
  });

  if (legendEl) {
    const legendContainer = document.getElementById(legendEl);
    legendContainer.innerHTML = '';
    if (total === 0) {
      legendContainer.innerHTML = '<div class="legend-item"><span style="color:var(--text3);font-size:12px">No data for this month</span></div>';
    } else {
      labels.forEach((label, i) => {
        const pct = ((data[i] / total) * 100).toFixed(1);
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <span class="legend-dot" style="background:${palette[i]};width:10px;height:10px"></span>
          <span class="legend-label">${label}</span>
          <span class="legend-pct">${pct}%</span>
          <span class="legend-amount">${fmt(amounts[i])}</span>
        `;
        legendContainer.appendChild(item);
      });
    }
  }
  return chart;
}

function getCategoryTotals(type) {
  const txs = getMonthTransactions().filter(t => t.type === type);
  const map = {};
  txs.forEach(tx => {
    const cat = getCategoryById(tx.categoryId);
    const name = cat ? cat.name : 'Other';
    map[name] = (map[name] || 0) + tx.amount;
  });
  const labels = Object.keys(map);
  const amounts = Object.values(map);
  const total = amounts.reduce((s, v) => s + v, 0);
  const pcts = amounts.map(v => total > 0 ? parseFloat(((v / total) * 100).toFixed(2)) : 0);
  return { labels, amounts, pcts };
}

function buildTrendChart(canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  // Last 6 months
  const months = [];
  const incomes = [];
  const expenses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(viewDate);
    d.setMonth(viewDate.getMonth() - i);
    months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
    const mk = monthKey(d);
    const txs = state.transactions.filter(tx => tx.date.startsWith(mk));
    incomes.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expenses.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          backgroundColor: 'rgba(0,232,123,0.7)',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.4,
        },
        {
          label: 'Expense',
          data: expenses,
          backgroundColor: 'rgba(255,79,123,0.7)',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.4,
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(240,240,255,0.5)', font: { size: 11, family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: 'rgba(240,240,255,0.5)', font: { size: 10, family: 'Inter' },
            callback: v => fmtCompact(v)
          },
          beginAtZero: true
        }
      },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(240,240,255,0.7)',
            font: { size: 11, family: 'Inter' },
            usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8
          }
        },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` }
        }
      }
    }
  });
}

function buildBarCompare(canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const months = [];
  const incomes = [];
  const expenses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(viewDate);
    d.setMonth(viewDate.getMonth() - i);
    months.push(d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
    const mk = monthKey(d);
    const txs = state.transactions.filter(tx => tx.date.startsWith(mk));
    incomes.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expenses.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          backgroundColor: 'rgba(0,232,123,0.75)',
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.45,
        },
        {
          label: 'Expense',
          data: expenses,
          backgroundColor: 'rgba(255,79,123,0.75)',
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.45,
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(240,240,255,0.5)', font: { size: 10, family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: 'rgba(240,240,255,0.5)', font: { size: 10, family: 'Inter' },
            callback: v => fmtCompact(v)
          },
          beginAtZero: true
        }
      },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(240,240,255,0.7)',
            font: { size: 11, family: 'Inter' },
            usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8
          }
        },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` }
        }
      }
    }
  });
}

function destroyChart(inst) {
  if (inst) { try { inst.destroy(); } catch(e) {} }
  return null;
}

function renderDashboardCharts() {
  const expData = getCategoryTotals('expense');
  const incData = getCategoryTotals('income');

  dashExpChartInst = destroyChart(dashExpChartInst);
  dashIncChartInst = destroyChart(dashIncChartInst);
  dashTrendChartInst = destroyChart(dashTrendChartInst);

  const expLabels = expData.labels.length ? expData.labels : ['No data'];
  const expAmts   = expData.amounts.length ? expData.amounts : [1];
  const expPalette = expData.amounts.length ? PALETTE_EXP : ['rgba(255,255,255,0.08)'];

  const incLabels = incData.labels.length ? incData.labels : ['No data'];
  const incAmts   = incData.amounts.length ? incData.amounts : [1];
  const incPalette = incData.amounts.length ? PALETTE_INC : ['rgba(255,255,255,0.08)'];

  dashExpChartInst = buildDonut('dashExpenseChart', expLabels, expAmts, expPalette,
    'dashExpenseCenter', 'dashExpenseLegend');
  if (!expData.amounts.length) document.getElementById('dashExpenseCenter').textContent = '₹0';

  dashIncChartInst = buildDonut('dashIncomeChart', incLabels, incAmts, incPalette,
    'dashIncomeCenter', 'dashIncomeLegend');
  if (!incData.amounts.length) document.getElementById('dashIncomeCenter').textContent = '₹0';

  dashTrendChartInst = buildTrendChart('dashTrendChart');
}

function renderChartTab() {
  const expData = getCategoryTotals('expense');
  const incData = getCategoryTotals('income');

  expPieInst = destroyChart(expPieInst);
  incPieInst = destroyChart(incPieInst);
  barCompareInst = destroyChart(barCompareInst);

  const expLabels = expData.labels.length ? expData.labels : ['No data'];
  const expAmts   = expData.amounts.length ? expData.amounts : [1];
  const expPalette = expData.amounts.length ? PALETTE_EXP : ['rgba(255,255,255,0.08)'];

  const incLabels = incData.labels.length ? incData.labels : ['No data'];
  const incAmts   = incData.amounts.length ? incData.amounts : [1];
  const incPalette = incData.amounts.length ? PALETTE_INC : ['rgba(255,255,255,0.08)'];

  expPieInst = buildFullDonut('expensePieChart', expLabels, expAmts, expData.amounts, expPalette, 'expensePieLegend');
  incPieInst = buildFullDonut('incomePieChart', incLabels, incAmts, incData.amounts, incPalette, 'incomePieLegend');
  barCompareInst = buildBarCompare('barCompareChart');
}

// ───────────────────────────────────────────────────
//  MAIN REFRESH
// ───────────────────────────────────────────────────
function refresh() {
  updateSummaryCards();
  if (currentTab === 'dashboard') {
    renderRecentTransactions();
    renderDashboardCharts();
  } else if (currentTab === 'transactions') {
    renderAllTransactions();
  } else if (currentTab === 'categories') {
    renderCategories();
  } else if (currentTab === 'charts') {
    renderChartTab();
  }
}

// ───────────────────────────────────────────────────
//  ADD TRANSACTION MODAL
// ───────────────────────────────────────────────────
function openAddModal() {
  currentType = 'expense';
  document.getElementById('typeExpense').classList.add('active');
  document.getElementById('typeIncome').classList.remove('active');
  document.getElementById('txAmount').value = '';
  document.getElementById('txDate').value = new Date().toISOString().slice(0, 10);
  const noteEl = document.getElementById('txNote');
  noteEl.value = '';
  updateNoteCounter();
  populateCategorySelect('expense');
  document.getElementById('addModal').classList.add('open');
  document.getElementById('txAmount').focus();
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

// ── Note char counter ──────────────────────────────
function updateNoteCounter() {
  const noteEl = document.getElementById('txNote');
  const counter = document.getElementById('noteCounter');
  const len = noteEl.value.length;
  counter.textContent = `${len}/200`;
  counter.classList.remove('warn', 'over');
  if (len >= 200) counter.classList.add('over');
  else if (len >= 160) counter.classList.add('warn');
}
document.getElementById('txNote').addEventListener('input', updateNoteCounter);

document.getElementById('cancelModal').addEventListener('click', closeAddModal);
document.getElementById('addModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeAddModal();
});

document.getElementById('typeExpense').addEventListener('click', () => {
  currentType = 'expense';
  document.getElementById('typeExpense').classList.add('active');
  document.getElementById('typeIncome').classList.remove('active');
  populateCategorySelect('expense');
});
document.getElementById('typeIncome').addEventListener('click', () => {
  currentType = 'income';
  document.getElementById('typeIncome').classList.add('active');
  document.getElementById('typeExpense').classList.remove('active');
  populateCategorySelect('income');
});

function populateCategorySelect(type) {
  const sel = document.getElementById('txCategory');
  sel.innerHTML = '<option value="">Select category...</option>';
  state.categories[type].forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    sel.appendChild(opt);
  });
}

document.getElementById('saveTransaction').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const categoryId = document.getElementById('txCategory').value;
  const note = document.getElementById('txNote').value.trim();

  if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }
  if (!date) { showToast('Select a date'); return; }
  if (!categoryId) { showToast('Select a category'); return; }

  const tx = { id: uid(), type: currentType, amount, date, categoryId, note };
  state.transactions.push(tx);
  saveData();
  closeAddModal();
  refresh();
  showToast(`${currentType === 'income' ? 'Income' : 'Expense'} of ${fmt(amount)} added!`);
});

// ───────────────────────────────────────────────────
//  ADD CATEGORY MODAL
// ───────────────────────────────────────────────────
const EMOJIS = [
  '🍔','🍕','🍣','☕','🛒','🏠','🚗','🛵','🚌','✈️','💡','💧','📱','💻',
  '👕','👟','🛍️','🎬','🎮','🎵','📚','🏥','💊','🏋️','🏦','💰','💼','📈',
  '🏡','🌿','🎁','🍼','🐶','🐱','🌟','⚡','🔧','🎯','🏆','❤️','🙏','💸',
  '📦','🎓','🛁','🍷','🎂','🚀','📦','🌍','🍀','🦷'
];

function openCatModal(type) {
  addingCatType = type;
  document.getElementById('catModalTitle').textContent = `Add ${type === 'income' ? 'Income' : 'Expense'} Category`;
  document.getElementById('catName').value = '';
  selectedEmoji = type === 'income' ? '💰' : '📦';
  buildEmojiPicker();
  document.getElementById('catModal').classList.add('open');
  document.getElementById('catName').focus();
}

function closeCatModal() {
  document.getElementById('catModal').classList.remove('open');
}

function buildEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.innerHTML = '';
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn' + (em === selectedEmoji ? ' selected' : '');
    btn.textContent = em;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedEmoji = em;
      picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    picker.appendChild(btn);
  });
}

document.getElementById('addIncomeCategory').addEventListener('click', () => openCatModal('income'));
document.getElementById('addExpenseCategory').addEventListener('click', () => openCatModal('expense'));
document.getElementById('cancelCatModal').addEventListener('click', closeCatModal);
document.getElementById('catModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCatModal();
});

document.getElementById('saveCatModal').addEventListener('click', () => {
  const name = document.getElementById('catName').value.trim();
  if (!name) { showToast('Enter a category name'); return; }
  const exists = state.categories[addingCatType].some(c => c.name.toLowerCase() === name.toLowerCase());
  if (exists) { showToast('Category already exists'); return; }

  state.categories[addingCatType].push({ id: uid(), name, emoji: selectedEmoji });
  saveData();
  closeCatModal();
  renderCategories();
  showToast(`Category "${name}" added!`);
});

// ───────────────────────────────────────────────────
//  EXCEL EXPORT
// ───────────────────────────────────────────────────
function exportToExcel() {
  const txs = getMonthTransactions().sort((a, b) => a.date.localeCompare(b.date));
  const label = monthName(viewDate);  // e.g. "June 2026"

  if (!txs.length) {
    showToast('No transactions to export for this month');
    return;
  }

  // ── Build rows ──────────────────────────────────
  const header = ['Date', 'Day', 'Type', 'Category', 'Amount (₹)', 'Note'];

  const rows = txs.map(tx => {
    const cat = getCategoryById(tx.categoryId);
    const d = new Date(tx.date + 'T00:00:00');
    return [
      tx.date,
      d.toLocaleDateString('en-IN', { weekday: 'long' }),
      tx.type === 'income' ? 'Income' : 'Expense',
      cat ? `${cat.emoji} ${cat.name}` : 'Unknown',
      tx.type === 'expense' ? -tx.amount : tx.amount,
      tx.note || ''
    ];
  });

  // ── Summary block ───────────────────────────────
  const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const summaryRows = [
    [],
    ['SUMMARY', '', '', '', '', ''],
    ['Total Income',  '', '', '', income,   ''],
    ['Total Expense', '', '', '', -expense, ''],
    ['Balance',       '', '', '', balance,  ''],
  ];

  // ── Assemble worksheet data ─────────────────────
  const wsData = [header, ...rows, ...summaryRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 12 }, // Day
    { wch: 10 }, // Type
    { wch: 22 }, // Category
    { wch: 14 }, // Amount
    { wch: 36 }, // Note
  ];

  // Style header row bold (SheetJS CE supports cell metadata)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }

  // ── Build workbook & download ───────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label.replace(/[/\\?*\[\]]/g, '_'));

  const safeLabel = label.replace(/\s+/g, '_'); // e.g. June_2026
  XLSX.writeFile(wb, `HomeBudget_${safeLabel}.xlsx`);
  showToast(`Exported ${txs.length} transactions ✓`);
}

document.getElementById('exportExcel').addEventListener('click', exportToExcel);

// ───────────────────────────────────────────────────
//  BOOT
// ───────────────────────────────────────────────────
updateMonthLabel();
refresh();
