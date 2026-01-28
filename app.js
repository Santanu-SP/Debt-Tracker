// State Management
const STATE = {
    currentUser: null,
    transactions: [],
    friends: [],
    settings: {
        salaryAmount: 0,
        salaryDate: 1, // Day of month (1-31)
        lastSalaryMonth: null // 'YYYY-MM' format
    },
    balance: 0,
    bankBalance: 0
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// --- AUTH & SESSION ---
function checkSession() {
    let session = null;
    try { session = JSON.parse(localStorage.getItem('debtTracker_session')); } catch (e) { }
    try { if (!session) session = JSON.parse(sessionStorage.getItem('debtTracker_session')); } catch (e) { }

    if (session && session.username) {
        // Verify user exists
        const users = JSON.parse(localStorage.getItem('debtTracker_users') || '[]');
        const user = users.find(u => u.username === session.username);

        if (user) {
            loginUser(user.username);
            return;
        }
    }
    // No session or invalid
    showAuthView();
}

function showAuthView() {
    document.getElementById('auth-view').style.display = 'block';
    document.getElementById('app-view').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showAppView() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    initUI(); // Re-bind listeners just in case
    renderAll();
}

function toggleAuthMode(mode) {
    if (mode === 'register') {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    } else {
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    }
}

function handleLogin() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const rememberMe = document.getElementById('login-remember').checked;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        alert("Please enter username and password");
        return;
    }

    const users = JSON.parse(localStorage.getItem('debtTracker_users') || '[]');
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        if (rememberMe) {
            localStorage.setItem('debtTracker_session', JSON.stringify({ username }));
        } else {
            // For session-only, we can use sessionStorage or just memory. 
            // But requested feature is "permanently logged in". 
            // If they don't check it, we still need to know who they are for this reload.
            // We'll use sessionStorage for non-permanent.
            sessionStorage.setItem('debtTracker_session', JSON.stringify({ username }));
            localStorage.removeItem('debtTracker_session'); // Clear permanent if exists
        }
        loginUser(username);
        // Clear forms
        usernameInput.value = '';
        passwordInput.value = '';
    } else {
        alert("Invalid username or password");
    }
}

function handleRegister() {
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!username || !password) {
        alert("Please enter all fields");
        return;
    }

    if (password !== confirm) {
        alert("Passwords do not match");
        return;
    }

    const users = JSON.parse(localStorage.getItem('debtTracker_users') || '[]');
    if (users.find(u => u.username === username)) {
        alert("Username already exists");
        return;
    }

    // Create User
    users.push({ username, password });
    localStorage.setItem('debtTracker_users', JSON.stringify(users));

    // Optional: Migrate legacy data to this first user
    // if (users.length === 1 && localStorage.getItem('debtTrackerData')) {
    //     localStorage.setItem(`debtTrackerData_${username}`, localStorage.getItem('debtTrackerData'));
    // }

    alert("Account created! You can now login.");
    toggleAuthMode('login');
}

// --- REPORTS ---
function renderReports() {
    const filter = document.getElementById('reports-filter').value;
    const now = new Date();
    let startDate, endDate;

    if (filter === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        document.getElementById('reports-date-display').textContent = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else if (filter === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        document.getElementById('reports-date-display').textContent = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else {
        startDate = new Date(0); // Beginning of time
        endDate = new Date(8640000000000000); // End of time
        document.getElementById('reports-date-display').textContent = 'All Time';
    }

    let income = 0;
    let expense = 0;
    let categoryExpenses = {};

    STATE.transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate >= startDate && tDate <= endDate) {
            if (t.type === 'income' || t.type === 'salary') {
                income += t.amount;
            } else if (t.type === 'expense') {
                expense += t.amount;
                // Category Calculation
                // Assuming desc might be used as category or we default to 'Uncategorized' if we don't have cat field
                // Current app doesn't seem to have strict category field? Let's use 'desc' or generic.
                // Looking at addTransaction, we don't have explicit category yet. 
                // Let's fallback to grouping by distinct description words or just "General" if missing.
                // WAIT: User mock showed categories like "Food", "Transport". 
                // Since we don't have that field yet, let's auto-categorize by descriptions containing keywords
                // or just show "General" for now to avoid breaking.
                // *Self-correction*: For now, group by Description (Top 5) or just show Total.
                // Better: Let's assume description is the category for now.
                const cat = t.desc || 'Other';
                categoryExpenses[cat] = (categoryExpenses[cat] || 0) + t.amount;
            } else if (t.type === 'lend') {
                // Lend counts as expense flow but asset. For report, maybe treat as expense or separate?
                // User mock shows Income vs Expense. Let's count lend as expense for cash visuals.
                expense += t.amount;
                const cat = 'Lending';
                categoryExpenses[cat] = (categoryExpenses[cat] || 0) + t.amount;
            } else if (t.type === 'repayment') {
                income += t.amount; // Repayment is cash in
            }
        }
    });

    // Update Stats
    document.getElementById('report-income').textContent = formatCurrency(income);
    document.getElementById('report-expense').textContent = formatCurrency(expense);
    document.getElementById('report-savings').textContent = formatCurrency(income - expense);

    // Update Bar Chart
    const barContainer = document.getElementById('bar-chart-container');
    const maxVal = Math.max(income, expense, 100); // Avoid div by zero
    const incomeHeight = (income / maxVal) * 100;
    const expenseHeight = (expense / maxVal) * 100;

    // Animate bars (simple width/height set)
    barContainer.innerHTML = `
        <div class="bar-group">
            <div class="bar" style="height:${incomeHeight}%; background:var(--success);"></div>
            <div class="bar-label">Income</div>
        </div>
        <div class="bar-group">
            <div class="bar" style="height:${expenseHeight}%; background:var(--danger);"></div>
            <div class="bar-label">Expense</div>
        </div>
    `;

    // Update Donut Chart
    const donut = document.getElementById('category-donut');
    const legend = document.getElementById('category-legend');

    // Sort expenses
    const sortedCats = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5
    let conicStr = '';
    let currentDeg = 0;
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']; // Amber, Blue, Emerald, Red, Violet
    let legendHtml = '';

    sortedCats.forEach((item, index) => {
        const [cat, amt] = item;
        const percent = (amt / expense) * 100;
        const deg = (percent / 100) * 360;
        const color = colors[index % colors.length];

        conicStr += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `;
        currentDeg += deg;

        legendHtml += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <div style="width:10px; height:10px; background:${color}; border-radius:50%;"></div>
            <div>${cat} <span style="color:var(--text-secondary);">(${Math.round(percent)}%)</span></div>
        </div>`;
    });

    // If no expense, gray ring
    if (expense === 0) conicStr = 'var(--border-color) 0deg 360deg';
    else conicStr = conicStr.slice(0, -2); // remove last comma

    donut.style.background = `conic-gradient(${conicStr})`;
    legend.innerHTML = legendHtml || '<div style="color:var(--text-secondary)">No expenses</div>';
}

// Ensure reports update when view switches
const originalSwitchView = window.switchView;
window.switchView = function (viewId, navEl) {
    originalSwitchView(viewId, navEl);
    if (viewId === 'view-reports') {
        renderReports();
    }
}

function loadDemoData() {
    if (!confirm("This will replace current data with demo data. Continue?")) return;

    const now = new Date();
    const transactions = [
        { id: 1, type: 'salary', amount: 50000, desc: 'Salary', date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() },
        { id: 2, type: 'expense', amount: 12000, desc: 'Rent', date: new Date(now.getFullYear(), now.getMonth(), 3).toISOString() },
        { id: 3, type: 'expense', amount: 2500, desc: 'Groceries', date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString() },
        { id: 4, type: 'expense', amount: 1500, desc: 'Dining Out', date: new Date(now.getFullYear(), now.getMonth(), 7).toISOString() },
        { id: 5, type: 'expense', amount: 800, desc: 'Transport', date: new Date(now.getFullYear(), now.getMonth(), 8).toISOString() },
        { id: 6, type: 'expense', amount: 3000, desc: 'Shopping', date: new Date(now.getFullYear(), now.getMonth(), 10).toISOString() },
        { id: 7, type: 'lend', amount: 2000, desc: 'Lend to Rahul', date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(), friendId: 1 },
        { id: 8, type: 'repayment', amount: 1000, desc: 'Rahul Returned', date: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(), friendId: 1 },
        { id: 9, type: 'expense', amount: 450, desc: 'Coffee', date: new Date(now.getFullYear(), now.getMonth(), 18).toISOString() },
        { id: 10, type: 'expense', amount: 1200, desc: 'Groceries', date: new Date(now.getFullYear(), now.getMonth(), 20).toISOString() }
    ];

    STATE.transactions = transactions;
    STATE.balance = 50000 - 12000 - 2500 - 1500 - 800 - 3000 - 2000 + 1000 - 450 - 1200; // Approx calc
    STATE.friends = [{ id: 1, name: 'Rahul', balance: 1000 }];

    saveData();
    recalculateBalance(); // To be precise
    renderDashboard();
    renderReports();
    alert("Demo data loaded!");
}

function handleLogout() {
    STATE.currentUser = null;
    localStorage.removeItem('debtTracker_session');
    sessionStorage.removeItem('debtTracker_session');
    location.reload();
}

function loginUser(username) {
    STATE.currentUser = username;
    loadData();
    checkSalaryAutoAdd();
    showAppView();
}

// --- DATA PERSISTENCE ---
function loadData() {
    if (!STATE.currentUser) return;

    const key = `debtTrackerData_${STATE.currentUser}`;
    const data = localStorage.getItem(key);

    // Default Empty State
    STATE.transactions = [];
    STATE.friends = [];
    STATE.settings = { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null };
    STATE.balance = 0;

    if (data) {
        const parsed = JSON.parse(data);
        STATE.transactions = parsed.transactions || [];
        STATE.friends = parsed.friends || [];
        STATE.settings = parsed.settings || STATE.settings;
    }
    recalculateBalance();
}

function saveData() {
    if (!STATE.currentUser) return;

    const key = `debtTrackerData_${STATE.currentUser}`;
    localStorage.setItem(key, JSON.stringify({
        transactions: STATE.transactions,
        friends: STATE.friends,
        settings: STATE.settings
    }));
    renderAll();
}

function recalculateBalance() {
    let balance = 0;
    // We assume 'bankBalance' is partially derived or manually adjusted, 
    // but for this simple app, we'll calculate 'Balance' as sum of all income - expenses
    // 'Lend' counts as expense from wallet, but adds to debt asset.

    STATE.transactions.forEach(t => {
        if (t.type === 'income' || t.type === 'salary' || t.type === 'repayment') {
            balance += t.amount;
        } else if (t.type === 'expense' || t.type === 'lend') {
            balance -= t.amount;
        }
    });

    STATE.balance = balance;
    // For simplicity in this version, Bank Balance tracks Salary additions less any explicit transfers (not implemented), 
    // so we will just show Total Balance for now in the main view.
}

function clearAllData() {
    if (confirm("Are you sure you want to delete all data? This cannot be undone.")) {
        localStorage.removeItem('debtTrackerData');
        location.reload();
    }
}

// --- CORE LOGIC ---

function addTransaction(keepOpen = false) {
    const descInput = document.getElementById('t-desc');
    const amountInput = document.getElementById('t-amount');
    const typeInput = document.getElementById('t-type');
    const friendInput = document.getElementById('t-friend-select');

    const desc = descInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const type = typeInput.value;

    if (!desc || isNaN(amount) || amount <= 0) {
        alert("Please enter valid description and amount");
        return;
    }

    const transaction = {
        id: Date.now(),
        date: new Date().toISOString(),
        desc,
        amount,
        type
    };

    if (type === 'lend') {
        const friendId = parseInt(friendInput.value);
        if (!friendId) {
            alert("Please select a friend to lend to");
            return;
        }
        transaction.friendId = friendId;
        updateFriendDebt(friendId, amount);
    } else if (type === 'repayment') {
        const friendId = parseInt(friendInput.value);
        if (!friendId) {
            alert("Please select the friend who is paying back");
            return;
        }
        transaction.friendId = friendId;
        // Reducing debt means adding a negative amount to their balance (since positive balance = they owe me)
        updateFriendDebt(friendId, -amount);
    } else if (type === 'split') {
        // Handle Split
        const includeMe = document.getElementById('split-include-me').checked;
        const checkboxes = document.querySelectorAll('#split-friends-list input[type="checkbox"]:checked');
        const selectedFriendIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        const totalParticipants = selectedFriendIds.length + (includeMe ? 1 : 0);

        if (totalParticipants === 0) {
            alert("Please select at least one person to split with.");
            return;
        }

        const splitAmount = amount / totalParticipants;

        // Metadata for the transaction
        transaction.splitDetails = {
            totalParticipants,
            amountPerPerson: splitAmount,
            involvedFriendIds: selectedFriendIds,
            includedMe: includeMe
        };

        // Update Debts: Each friend owes me 'splitAmount'
        // (Assuming I paid the full 'amount')
        selectedFriendIds.forEach(fid => {
            updateFriendDebt(fid, splitAmount);
        });
    }

    STATE.transactions.unshift(transaction); // Add to top
    recalculateBalance();
    saveData();

    if (keepOpen) {
        // Reset specific fields but keep type/friend context
        descInput.value = '';
        amountInput.value = '';
        descInput.focus();
        // Optional: Provide subtle feedback or just trust the clear + focus
        // Making it clear:
        // alert("Added! You can add another."); // A bit intrusive
        // Let's stick to non-intrusive flow:
    } else {
        // Reset and Close
        descInput.value = '';
        amountInput.value = '';
        closeModals();
    }
}

// Make this global so index.html can call it
window.refreshSplitList = renderSplitFriendList;

function renderSplitFriendList() {
    const container = document.getElementById('split-friends-list');
    if (!container) return;

    container.innerHTML = '';
    STATE.friends.forEach(f => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.marginBottom = '8px';

        div.innerHTML = `
            <input type="checkbox" id="split-friend-${f.id}" value="${f.id}" style="width:20px; margin-right:8px;">
            <label for="split-friend-${f.id}" style="margin:0;">${f.name}</label>
        `;
        container.appendChild(div);
    });
}

function addFriend() {
    const nameInput = document.getElementById('f-name');
    const name = nameInput.value.trim();

    if (!name) return;

    const newFriend = {
        id: Date.now(),
        name: name,
        balance: 0 // Positive means they owe me
    };

    STATE.friends.push(newFriend);
    saveData(); // Will trigger render which populates dropdown

    nameInput.value = '';
    closeModals();
}

function updateFriendDebt(friendId, amountAdded) {
    const friend = STATE.friends.find(f => f.id === friendId);
    if (friend) {
        friend.balance += amountAdded;
    }
}

function settleFriendDebt(friendId, friendName, amount) {
    if (!confirm(`Mark ${friendName}'s debt of ${formatCurrency(amount)} as fully paid?`)) return;

    // Create Repayment Transaction
    STATE.transactions.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        desc: `Full Settlement from ${friendName}`,
        amount: amount,
        type: 'repayment',
        friendId: friendId
    });

    // Update Friend Logic
    updateFriendDebt(friendId, -amount);

    // Update Balance
    recalculateBalance();
    saveData();

    // Feedback (Optional since UI updates immediately)
    // alert("Settled!"); 
}

// --- SALARY AUTOMATION ---
function saveSalaryConfig() {
    const amount = parseFloat(document.getElementById('salary-input').value);
    const date = parseInt(document.getElementById('salary-date').value);

    if (isNaN(amount) || isNaN(date)) return;

    STATE.settings.salaryAmount = amount;
    STATE.settings.salaryDate = date;

    alert("Salary settings saved!");
    saveData();
    checkSalaryAutoAdd(); // Check immediately in case today is the day
}

function checkSalaryAutoAdd() {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${today.getMonth() + 1}`; // "2023-10"

    // If we haven't added salary for this month yet
    if (STATE.settings.lastSalaryMonth !== currentMonthStr && STATE.settings.salaryAmount > 0) {
        // If today is past or equal to the salary date
        if (today.getDate() >= STATE.settings.salaryDate) {

            // Add Salary Transaction
            STATE.transactions.unshift({
                id: Date.now(),
                date: new Date().toISOString(),
                desc: 'Monthly Salary (Auto)',
                amount: STATE.settings.salaryAmount,
                type: 'salary'
            });

            // Update State
            STATE.settings.lastSalaryMonth = currentMonthStr;
            recalculateBalance();
            saveData();

            alert(`Salary of $${STATE.settings.salaryAmount} added automatically for this month!`);
        }
    }
}


// --- UI RENDERING ---

function initUI() {
    // Populate Date Select
    const dateSelect = document.getElementById('salary-date');
    if (dateSelect.options.length > 0) return; // Already initialized

    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = i;
        dateSelect.appendChild(opt);
    }

    // Attach Listeners not handled by inline onclicks
    const saveBtn = document.getElementById('save-salary-btn');
    // distinct from other listeners, let's just make sure we don't double bind if we use cloneNode or named function
    // simpler: just remove old listener if possible, but here we can just rely on the 'Already initialized' check above.
    saveBtn.addEventListener('click', saveSalaryConfig);
}

function renderAll() {
    renderDashboard();
    renderFriends();
    renderSettings();
    renderFriendDropdown();
    renderSplitFriendList();
}

function renderDashboard() {
    document.getElementById('total-balance').textContent = formatCurrency(STATE.balance);

    // Calculate total owed by friends
    let friendsOwed = 0;
    STATE.friends.forEach(f => {
        if (f.balance > 0) friendsOwed += f.balance;
    });
    const owedEl = document.getElementById('dashboard-owed');
    if (owedEl) owedEl.textContent = formatCurrency(friendsOwed);

    // document.getElementById('bank-balance').textContent = formatCurrency(STATE.balance); // Simplified

    const list = document.getElementById('recent-transactions');
    list.innerHTML = '';

    if (STATE.transactions.length === 0) {
        list.innerHTML = '<li class="list-item" style="color:var(--text-secondary);justify-content:center;">No transactions yet</li>';
        return;
    }

    STATE.transactions.slice(0, 20).forEach(t => {
        const li = document.createElement('li');
        li.className = 'list-item';

        let colorClass = 'amount-positive';
        let prefix = '+';
        if (t.type === 'expense' || t.type === 'lend') {
            colorClass = 'amount-negative';
            prefix = '-';
        }

        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

        li.innerHTML = `
            <div>
                <div style="font-weight:600;">${t.desc}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">${dateStr} • ${t.type.toUpperCase()}</div>
            </div>
            <div class="${colorClass}">${prefix}${formatCurrency(t.amount)}</div>
        `;
        list.appendChild(li);
    });
}

function renderFriends() {
    const list = document.getElementById('friends-list');
    list.innerHTML = '';

    let totalOwed = 0;

    STATE.friends.forEach(f => {
        totalOwed += f.balance;

        const li = document.createElement('li');
        li.className = 'list-item';

        let actionHtml = '';
        if (f.balance > 0) {
            actionHtml = `<button onclick="settleFriendDebt(${f.id}, '${f.name.replace(/'/g, "\\'")}', ${f.balance})" style="padding:4px 8px; font-size:0.75rem; background:var(--bg-color); color:var(--success); border:1px solid var(--success); border-radius:6px; margin-left:8px; cursor:pointer;">Settle</button>`;
        }

        li.innerHTML = `
            <div style="flex:1;">
                <div style="font-weight:600;">${f.name}</div>
                <div style="color: ${f.balance > 0 ? 'var(--success)' : 'var(--text-secondary)'}">
                    ${f.balance > 0 ? 'Owes you: ' : 'Settled'} ${formatCurrency(f.balance)}
                </div>
            </div>
            ${actionHtml}
        `;
        list.appendChild(li);
    });

    document.getElementById('total-owed').textContent = formatCurrency(totalOwed);
}

function renderSettings() {
    document.getElementById('salary-input').value = STATE.settings.salaryAmount || '';
    document.getElementById('salary-date').value = STATE.settings.salaryDate || 1;
}


function showHistoryView() {
    // Switch view manually here as it's a sub-view of sorts, or just use switchView if we add it to navigation?
    // The HTML has a back button that calls switchView('view-dashboard', ...). 
    // So we can just show the div. But let's use the standard class switching.
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-history').classList.add('active');

    // Update nav to deselect all valid nav items since we are in a sub-view
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    renderHistoryView();
}

function renderHistoryView() {
    const list = document.getElementById('history-list');
    const filterVal = document.getElementById('history-filter').value;
    list.innerHTML = '';

    const now = new Date();
    let cutoffDate = new Date(0); // Default all time

    if (filterVal === '1year') {
        cutoffDate.setFullYear(now.getFullYear() - 1);
    } else if (filterVal === '30days') {
        cutoffDate.setDate(now.getDate() - 30);
    }
    // 'all' leaves cutoffDate as epoch

    const filtered = STATE.transactions.filter(t => new Date(t.date) >= cutoffDate);

    if (filtered.length === 0) {
        list.innerHTML = '<li class="list-item" style="color:var(--text-secondary);justify-content:center;">No matching transactions</li>';
        return;
    }

    filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = 'list-item';

        let colorClass = 'amount-positive';
        let prefix = '+';
        if (t.type === 'expense' || t.type === 'lend') {
            colorClass = 'amount-negative';
            prefix = '-';
        }

        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

        li.innerHTML = `
            <div>
                <div style="font-weight:600;">${t.desc}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">${dateStr} • ${t.type.toUpperCase()}</div>
            </div>
            <div class="${colorClass}">${prefix}${formatCurrency(t.amount)}</div>
        `;
        list.appendChild(li);
    });
}

function exportHistoryToCSV() {
    const filterVal = document.getElementById('history-filter').value;

    const now = new Date();
    let cutoffDate = new Date(0);

    if (filterVal === '1year') {
        cutoffDate.setFullYear(now.getFullYear() - 1);
    } else if (filterVal === '30days') {
        cutoffDate.setDate(now.getDate() - 30);
    }

    const filtered = STATE.transactions.filter(t => new Date(t.date) >= cutoffDate);

    if (filtered.length === 0) {
        alert("No transactions to export for this period.");
        return;
    }

    // CSV Header
    let csvContent = "Date,Description,Type,Amount,Friend\n";

    filtered.forEach(t => {
        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

        // Escape quotes in description
        const desc = `"${t.desc.replace(/"/g, '""')}"`;

        let friendName = "";
        if (t.friendId) {
            const friend = STATE.friends.find(f => f.id === t.friendId);
            if (friend) friendName = friend.name;
        } else if (t.splitDetails) {
            friendName = "Split Group";
        }

        const row = [
            dateStr,
            desc,
            t.type,
            t.amount,
            `"${friendName}"`
        ].join(",");

        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_${filterVal}_${now.toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- THEME LOGIC ---
function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (saved === 'dark' || (!saved && prefersDark)) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
    } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
    }
    updateThemeIcon();
}

function toggleTheme() {
    if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark-mode');
    const sun = document.getElementById('icon-sun');
    const moon = document.getElementById('icon-moon');

    // In dark mode, show sun (to switch to light)
    if (isDark) {
        if (sun) sun.style.display = 'block';
        if (moon) moon.style.display = 'none';
    } else {
        if (sun) sun.style.display = 'none';
        if (moon) moon.style.display = 'block';
    }
}

// Call on load
initTheme();


function renderFriendDropdown() {
    const select = document.getElementById('t-friend-select');
    select.innerHTML = '<option value="">-- Select Friend --</option>';
    STATE.friends.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.text = f.name;
        select.appendChild(opt);
    });
}

function formatCurrency(num) {
    return '₹' + num.toFixed(2);
}
