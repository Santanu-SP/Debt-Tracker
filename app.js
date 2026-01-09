// State Management
const STATE = {
    transactions: [],
    friends: [],
    settings: {
        salaryAmount: 0,
        salaryDate: 1, // Day of month (1-31)
        lastSalaryMonth: null // 'YYYY-MM' format to track when salary was last added
    },
    balance: 0,
    bankBalance: 0
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initUI();
    checkSalaryAutoAdd();
    renderAll();
});

// --- DATA PERSISTENCE ---
function loadData() {
    const data = localStorage.getItem('debtTrackerData');
    if (data) {
        const parsed = JSON.parse(data);
        STATE.transactions = parsed.transactions || [];
        STATE.friends = parsed.friends || [];
        STATE.settings = parsed.settings || { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null };
        recalculateBalance();
    }
}

function saveData() {
    localStorage.setItem('debtTrackerData', JSON.stringify({
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
        if (t.type === 'income' || t.type === 'salary') {
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

function addTransaction() {
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

    // Reset and Close
    descInput.value = '';
    amountInput.value = '';
    closeModals();
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
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = i;
        dateSelect.appendChild(opt);
    }

    // Attach Listeners not handled by inline onclicks
    document.getElementById('save-salary-btn').addEventListener('click', saveSalaryConfig);
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
        li.innerHTML = `
            <div style="font-weight:600;">${f.name}</div>
            <div style="color: ${f.balance > 0 ? 'var(--success)' : 'var(--text-secondary)'}">
                ${f.balance > 0 ? 'Owes you: ' : 'Settled'} ${formatCurrency(f.balance)}
            </div>
        `;
        list.appendChild(li);
    });

    document.getElementById('total-owed').textContent = formatCurrency(totalOwed);
}

function renderSettings() {
    document.getElementById('salary-input').value = STATE.settings.salaryAmount || '';
    document.getElementById('salary-date').value = STATE.settings.salaryDate || 1;
}

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
