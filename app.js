const CATEGORY_PRESETS = [
  { id: 'fuel', label: 'Fuel', color: '#f79009' },
  { id: 'food', label: 'Food', color: '#16a34a' },
  { id: 'travel', label: 'Travel', color: '#2563eb' },
  { id: 'shopping', label: 'Shopping', color: '#7c3aed' },
  { id: 'other', label: 'Other', color: '#0f172a' },
];

const STORAGE_KEY = 'expense-tracker-entries';

const form = document.getElementById('expense-form');
const tableBody = document.getElementById('expense-table-body');
const tableSummary = document.getElementById('table-summary');
const formFeedback = document.getElementById('form-feedback');
const weeklyTotalEl = document.getElementById('weekly-total');
const monthlyTotalEl = document.getElementById('monthly-total');
const monthFilterInput = document.getElementById('month-filter');
const resetButton = document.getElementById('reset-data');
const chipGroup = document.getElementById('filter-chip-group');

let expenses = [];
let activeCategoryFilter = 'all';
let weeklyChart;
let monthlyChart;

function generateId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  expenses = loadExpenses();
  if (!expenses.length) {
    expenses = seedDemoExpenses();
    saveExpenses(expenses);
  }
  monthFilterInput.value = new Date().toISOString().slice(0, 7);
  renderAll();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const entry = {
    id: generateId(),
    date: formData.get('date'),
    category: formData.get('category'),
    amount: Number(formData.get('amount')),
    notes: formData.get('notes').trim(),
  };

  if (!entry.date || isNaN(entry.amount) || entry.amount <= 0) {
    formFeedback.textContent = 'Please provide a valid date and positive amount.';
    return;
  }

  expenses.push(entry);
  saveExpenses(expenses);
  form.reset();
  formFeedback.textContent = 'Expense saved.';
  setTimeout(() => (formFeedback.textContent = ''), 2000);
  renderAll();
});

resetButton.addEventListener('click', () => {
  if (confirm('This will remove all saved expenses. Continue?')) {
    expenses = seedDemoExpenses();
    saveExpenses(expenses);
    renderAll();
  }
});

chipGroup.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-filter]');
  if (!button) return;
  activeCategoryFilter = button.dataset.filter;
  document.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active'));
  button.classList.add('active');
  renderTable();
  renderAnalytics();
});

monthFilterInput.addEventListener('change', renderTable);

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Failed to parse expenses', error);
    return [];
  }
}

function saveExpenses(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function seedDemoExpenses() {
  const today = new Date();
  const sample = [
    { daysAgo: 1, category: 'food', amount: 12.5, notes: 'Lunch' },
    { daysAgo: 2, category: 'fuel', amount: 40, notes: 'Gas refill' },
    { daysAgo: 4, category: 'travel', amount: 18, notes: 'Metro card' },
    { daysAgo: 6, category: 'shopping', amount: 55, notes: 'Groceries' },
    { daysAgo: 8, category: 'other', amount: 20, notes: 'Gym' },
  ];
  return sample.map((item) => ({
    id: generateId(),
    date: formatDate(subtractDays(today, item.daysAgo)),
    category: item.category,
    amount: item.amount,
    notes: item.notes,
  }));
}

function subtractDays(date, days) {
  const copy = new Date(date);
  copy.setDate(date.getDate() - days);
  return copy;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function renderAll() {
  renderTable();
  renderAnalytics();
}

function renderTable() {
  const monthFilter = monthFilterInput.value;

  const filtered = expenses.filter((expense) => {
    const matchesCategory = activeCategoryFilter === 'all' || expense.category === activeCategoryFilter;
    const matchesMonth = monthFilter ? expense.date.startsWith(monthFilter) : true;
    return matchesCategory && matchesMonth;
  });

  tableSummary.textContent = `${filtered.length} expense${filtered.length === 1 ? '' : 's'} recorded`;

  if (!filtered.length) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No expenses match the current filters.</td></tr>';
    return;
  }

  const rows = filtered
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((expense) => {
      const category = CATEGORY_PRESETS.find((c) => c.id === expense.category);
      const badge = `<span class="badge" style="background-color:${category?.color}1a;color:${category?.color}">${category?.label}</span>`;
      return `
        <tr>
          <td>${formatDisplayDate(expense.date)}</td>
          <td>${badge}</td>
          <td>${expense.notes || '—'}</td>
          <td class="amount-col">₹${expense.amount.toFixed(2)}</td>
          <td>
            <button aria-label="Delete" data-id="${expense.id}">✕</button>
          </td>
        </tr>`;
    })
    .join('');

  tableBody.innerHTML = rows;
  tableBody.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', () => deleteExpense(button.dataset.id));
  });

}

function formatDisplayDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function deleteExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses(expenses);
  renderAll();
}

function renderAnalytics() {
  const weeklyData = groupByWeek(expenses);
  const monthlyData = groupCurrentMonthByCategory(expenses);

  renderWeeklyChart(weeklyData);
  renderMonthlyChart(monthlyData);

  const weeklySum = weeklyData.reduce((sum, item) => sum + item.total, 0);
  const monthlySum = monthlyData.reduce((sum, item) => sum + item.total, 0);
  updateTotals(weeklySum, monthlySum);
}

function groupByWeek(data) {
  const buckets = {};
  data.forEach((item) => {
    const weekKey = getWeekKey(item.date);
    buckets[weekKey] = (buckets[weekKey] || 0) + item.amount;
  });
  return Object.entries(buckets)
    .map(([week, total]) => ({ week, total }))
    .sort((a, b) => (a.week > b.week ? 1 : -1));
}

function getWeekKey(dateStr) {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays = (date - firstDayOfYear) / 86400000;
  const weekNumber = Math.floor((pastDays + firstDayOfYear.getDay() + 1) / 7);
  return `Week ${weekNumber}`;
}

function groupCurrentMonthByCategory(data) {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const buckets = {};
  data.forEach((item) => {
    if (item.date.startsWith(currentMonth)) {
      buckets[item.category] = (buckets[item.category] || 0) + item.amount;
    }
  });
  return Object.entries(buckets).map(([category, total]) => ({
    category,
    total,
  }));
}

function renderWeeklyChart(data) {
  const ctx = document.getElementById('weekly-chart');
  const labels = data.map((item) => item.week);
  const values = data.map((item) => Number(item.total.toFixed(2)));

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Weekly spend',
          data: values,
          backgroundColor: '#2563eb',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `₹${value}`,
          },
        },
      },
    },
  });
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById('monthly-chart');
  const labels = data.map((item) => getCategoryLabel(item.category));
  const values = data.map((item) => Number(item.total.toFixed(2)));
  const colors = data.map((item) => getCategoryColor(item.category));

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  });
}

function getCategoryLabel(id) {
  return CATEGORY_PRESETS.find((c) => c.id === id)?.label ?? id;
}

function getCategoryColor(id) {
  return CATEGORY_PRESETS.find((c) => c.id === id)?.color ?? '#cbd5f5';
}

function updateTotals(week, month) {
  weeklyTotalEl.textContent = `₹${Number(week).toFixed(2)}`;
  monthlyTotalEl.textContent = `₹${Number(month).toFixed(2)}`;
}

