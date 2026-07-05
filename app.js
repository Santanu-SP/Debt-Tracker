// State Management
const STATE = {
    currentUser: null,
    transactions: [],
    friends: [],
    settings: {
        salaryAmount: 3000, // Monthly Allowance
        salaryDate: 1, // Day of month (1-31)
        lastSalaryMonth: null // 'YYYY-MM' format
    },
    savingsGoal: {
        title: "Set a savings goal! 🎯",
        target: 0,
        current: 0
    },
    balance: 0
};

// Global variables for session/runtime
let selectedRoommates = [];
let SERVER_MODE = false;
const SERVER_URL = 'http://localhost:3000';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// Check collaborative server availability
async function checkServerHealth() {
    try {
        const res = await fetch(`${SERVER_URL}/api/health`);
        const data = await res.json();
        if (data.status === 'OK') {
            SERVER_MODE = true;
            console.log("Connected to PocketSafe collaborative server! MongoDB: " + data.database);
            return true;
        }
    } catch (e) {
        console.warn("Collaborative server offline. Falling back to local storage mode.");
    }
    SERVER_MODE = false;
    return false;
}

// --- AUTH & SESSION ---
async function checkSession() {
    await checkServerHealth();
    await loadServerConfig();

    let session = null;
    try { session = JSON.parse(localStorage.getItem('debtTracker_session')); } catch (e) { }
    try { if (!session) session = JSON.parse(sessionStorage.getItem('debtTracker_session')); } catch (e) { }

    if (session && session.username) {
        if (SERVER_MODE) {
            loginUser(session.username);
        } else {
            const users = JSON.parse(localStorage.getItem('debtTracker_users') || '[]');
            const user = users.find(u => u.username === session.username);

            if (user) {
                loginUser(user.username);
                return;
            }
            showAuthView();
        }
    } else {
        showAuthView();
    }
}

// Fetch server-side dynamic configurations
async function loadServerConfig() {
    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/config`);
            if (res.ok) {
                const config = await res.json();
                if (config.googleClientId) {
                    initGoogleSignIn(config.googleClientId);
                }
            }
        } catch (e) {
            console.warn("Failed to fetch configurations from server.", e);
        }
    }
}

// Initialize Google Sign-in button rendering
function initGoogleSignIn(clientId) {
    const container = document.getElementById('google-signin-container');
    const btnNode = document.getElementById('google-signin-btn');
    if (!container || !btnNode) return;

    // Show button container
    container.style.display = 'block';

    // Initialize GIS Client SDK
    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse
    });

    // Render native Google Sign-in button
    google.accounts.id.renderButton(
        btnNode,
        { theme: "outline", size: "large", width: 280 }
    );
}

// Callback when Google auth popup completes
async function handleGoogleCredentialResponse(response) {
    const credentialToken = response.credential;
    if (!credentialToken) return;

    try {
        const res = await fetch(`${SERVER_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: credentialToken })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            // Keep user permanently logged in matching default checkbox behavior
            localStorage.setItem('debtTracker_session', JSON.stringify({ username: data.username }));
            loginUser(data.username);
        } else {
            alert(data.error || "Google login failed");
        }
    } catch (e) {
        alert("Server error verifying Google token.");
    }
}

function showAuthView() {
    document.getElementById('auth-view').style.display = 'block';
    document.getElementById('app-view').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showAppView() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';
    initUI(); 
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

async function handleLogin() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const rememberMe = document.getElementById('login-remember').checked;

    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!username || !password) {
        alert("Please enter username and password");
        return;
    }

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (rememberMe) {
                    localStorage.setItem('debtTracker_session', JSON.stringify({ username }));
                } else {
                    sessionStorage.setItem('debtTracker_session', JSON.stringify({ username }));
                    localStorage.removeItem('debtTracker_session'); 
                }
                loginUser(username);
                usernameInput.value = '';
                passwordInput.value = '';
            } else {
                alert(data.error || "Invalid login");
            }
        } catch (e) {
            alert("Error connecting to login server.");
        }
    } else {
        const users = JSON.parse(localStorage.getItem('debtTracker_users') || '[]');
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            if (rememberMe) {
                localStorage.setItem('debtTracker_session', JSON.stringify({ username }));
            } else {
                sessionStorage.setItem('debtTracker_session', JSON.stringify({ username }));
                localStorage.removeItem('debtTracker_session'); 
            }
            loginUser(username);
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            alert("Invalid username or password");
        }
    }
}

async function handleRegister() {
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');

    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!username || !password) {
        alert("Please enter all fields");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters");
        return;
    }

    if (password !== confirm) {
        alert("Passwords do not match");
        return;
    }

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Student profile created! You can now login.");
                toggleAuthMode('login');
            } else {
                alert(data.error || "Registration failed");
            }
        } catch (e) {
            alert("Error connecting to server.");
        }
    } else {
        const users = JSON.parse(localStorage.getItem('debtTracker_users') || '[]');
        if (users.find(u => u.username === username)) {
            alert("Username already exists");
            return;
        }

        users.push({ username, password });
        localStorage.setItem('debtTracker_users', JSON.stringify(users));

        alert("Account created! You can now login.");
        toggleAuthMode('login');
    }
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
}

// --- DATA PERSISTENCE ---
async function loadData() {
    if (!STATE.currentUser) return;

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/user/state?username=${STATE.currentUser}`);
            if (res.ok) {
                const data = await res.json();
                STATE.transactions = data.transactions || [];
                STATE.friends = data.friends || [];
                STATE.settings = data.settings || { salaryAmount: 3000, salaryDate: 1, lastSalaryMonth: null };
                STATE.savingsGoal = data.savingsGoal || { title: "Set a savings goal! 🎯", target: 0, current: 0 };
                STATE.balance = data.balance || 0;
                
                checkSalaryAutoAdd();
                renderAll();
                return;
            }
        } catch (e) {
            console.error("Server fetch failed, using local fallback...", e);
        }
    }

    // Local Storage Fallback
    const key = `debtTrackerData_${STATE.currentUser}`;
    const data = localStorage.getItem(key);

    STATE.transactions = [];
    STATE.friends = [];
    STATE.settings = { salaryAmount: 3000, salaryDate: 1, lastSalaryMonth: null };
    STATE.savingsGoal = { title: "Set a savings goal! 🎯", target: 0, current: 0 };
    STATE.balance = 0;

    if (data) {
        const parsed = JSON.parse(data);
        STATE.transactions = parsed.transactions || [];
        STATE.friends = parsed.friends || [];
        STATE.settings = parsed.settings || STATE.settings;
        STATE.savingsGoal = parsed.savingsGoal || STATE.savingsGoal;
    }
    recalculateBalance();
    checkSalaryAutoAdd();
    renderAll();
}

async function saveData() {
    if (!STATE.currentUser) return;

    if (!SERVER_MODE) {
        const key = `debtTrackerData_${STATE.currentUser}`;
        localStorage.setItem(key, JSON.stringify({
            transactions: STATE.transactions,
            friends: STATE.friends,
            settings: STATE.settings,
            savingsGoal: STATE.savingsGoal
        }));
        renderAll();
    } else {
        // Transactions endpoint handles edits, just re-load state package
        await loadData();
    }
}

function recalculateBalance() {
    let balance = 0;
    let savingsTotal = 0;

    STATE.transactions.forEach(t => {
        if (t.type === 'income' || t.type === 'salary' || t.type === 'repayment') {
            balance += t.amount;
        } else if (t.type === 'expense' || t.type === 'lend' || t.type === 'savings_deposit') {
            balance -= t.amount;
        }

        if (t.type === 'savings_deposit') {
            savingsTotal += t.amount;
        }
    });

    STATE.balance = balance;
    if (STATE.savingsGoal) {
        STATE.savingsGoal.current = savingsTotal;
    }
}

function clearAllData() {
    if (confirm("Are you sure you want to delete all user settings and transactions? This cannot be undone.")) {
        if (STATE.currentUser) {
            localStorage.removeItem(`debtTrackerData_${STATE.currentUser}`);
        }
        location.reload();
    }
}

// --- STUDENT SAVINGS ASSISTANT LOGIC ---

function updateDailyDial() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const currentDay = today.getDate();
    const remainingDays = totalDays - currentDay + 1;

    const target = STATE.savingsGoal ? STATE.savingsGoal.target || 0 : 0;
    const current = STATE.savingsGoal ? STATE.savingsGoal.current || 0 : 0;
    const savingsNeeded = Math.max(0, target - current);

    const walletBalance = STATE.balance;

    let safeToSpend = 0;
    if (remainingDays > 0) {
        safeToSpend = (walletBalance - savingsNeeded) / remainingDays;
    }
    
    if (safeToSpend < 0) {
        safeToSpend = 0;
    }

    const safeEl = document.getElementById('safe-to-spend');
    if (safeEl) {
        safeEl.textContent = formatCurrency(safeToSpend);
    }

    const dailyAverage = (STATE.settings.salaryAmount || 3000) / totalDays;
    const percent = Math.min(100, Math.max(0, (safeToSpend / dailyAverage) * 100));
    
    const dial = document.getElementById('budget-progress-dial');
    if (dial) {
        dial.style.background = `conic-gradient(var(--primary) 0% ${percent}%, var(--accent) ${percent}%, var(--border-color) ${percent}% 100%)`;
    }

    const warningAlert = document.getElementById('quick-settlement-alert');
    if (warningAlert) {
        if (walletBalance < savingsNeeded) {
            warningAlert.textContent = "⚠️ Wallet too low for goal!";
            warningAlert.style.color = "var(--danger)";
        } else {
            warningAlert.textContent = "";
        }
    }
}

function updateSavingsGoalUI() {
    const goalCard = document.getElementById('savings-goal-card');
    if (!goalCard) return;

    if (!STATE.savingsGoal) {
        STATE.savingsGoal = { title: "Set a savings goal! 🎯", target: 0, current: 0 };
    }

    const title = STATE.savingsGoal.title || "Set a savings goal! 🎯";
    const target = STATE.savingsGoal.target || 0;
    const current = STATE.savingsGoal.current || 0;

    document.getElementById('goal-title-display').textContent = title;
    document.getElementById('goal-progress-values').textContent = `${formatCurrency(current)} / ${formatCurrency(target)}`;

    const bar = document.getElementById('goal-progress-bar');
    if (bar) {
        const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        bar.style.width = `${percent}%`;
    }

    const status = document.getElementById('goal-days-status');
    if (status) {
        if (target === 0) {
            status.textContent = "Open setup tab to configure a savings goal!";
            status.style.color = "var(--text-secondary)";
        } else if (current >= target) {
            status.textContent = "🎉 Savings goal achieved! Awesome!";
            status.style.color = "var(--success)";
        } else {
            const left = target - current;
            status.textContent = `${formatCurrency(left)} left to reach your goal.`;
            status.style.color = "var(--text-secondary)";
        }
    }
}

async function saveSavingsGoal() {
    const titleInput = document.getElementById('goal-title-input');
    const targetInput = document.getElementById('goal-target-input');

    const title = titleInput.value.trim();
    const target = parseFloat(targetInput.value);

    if (!title || isNaN(target) || target < 0) {
        alert("Please enter valid goal details.");
        return;
    }

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/user/goal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: STATE.currentUser, title, target })
            });
            if (res.ok) {
                alert("Savings goal updated!");
                await loadData();
            } else {
                alert("Failed to update savings goal.");
            }
        } catch (e) {
            alert("Server connection error.");
        }
        return;
    }

    if (!STATE.savingsGoal) {
        STATE.savingsGoal = { title: "", target: 0, current: 0 };
    }
    STATE.savingsGoal.title = title;
    STATE.savingsGoal.target = target;
    
    alert("Savings goal updated!");
    saveData();
}

async function depositToSavings() {
    const amtInput = document.getElementById('goal-deposit-input');
    const amount = parseFloat(amtInput.value);

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid deposit amount.");
        return;
    }

    if (amount > STATE.balance) {
        alert("Insufficient wallet balance to deposit.");
        return;
    }

    if (SERVER_MODE) {
        try {
            const targetTitle = STATE.savingsGoal ? STATE.savingsGoal.title : "Savings Goal";
            const res = await fetch(`${SERVER_URL}/api/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: STATE.currentUser,
                    desc: `Deposit to: ${targetTitle}`,
                    amount: amount,
                    type: 'savings_deposit'
                })
            });
            if (res.ok) {
                amtInput.value = '';
                await loadData();
                alert(`Deposited ${formatCurrency(amount)} into savings goal!`);
            } else {
                alert("Failed to deposit to savings goal.");
            }
        } catch (e) {
            alert("Server connection error.");
        }
        return;
    }

    const targetTitle = STATE.savingsGoal ? STATE.savingsGoal.title : "Savings Goal";
    STATE.transactions.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        desc: `Deposit to: ${targetTitle}`,
        amount: amount,
        type: 'savings_deposit'
    });

    amtInput.value = '';
    recalculateBalance();
    saveData();
    alert(`Deposited ${formatCurrency(amount)} into savings goal!`);
}

// --- ROOMMATE SPLIT BUBBLES UI ---

function renderQuickSplitBubbles() {
    const container = document.getElementById('quick-split-bubbles');
    if (!container) return;
    container.innerHTML = '';

    if (STATE.friends.length === 0) {
        container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); padding:6px 0;">No roommates added yet. Go to Friends view to add.</div>';
        return;
    }

    STATE.friends.forEach(f => {
        const bubble = document.createElement('div');
        bubble.className = `roommate-bubble ${selectedRoommates.includes(f.id) ? 'selected' : ''}`;
        bubble.onclick = () => toggleRoommateBubble(f.id);

        const initials = f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

        bubble.innerHTML = `
            <div class="roommate-avatar">
                ${initials}
                <div class="roommate-avatar-check">✓</div>
            </div>
            <div class="roommate-name">${f.name}</div>
        `;
        container.appendChild(bubble);
    });
}

function toggleRoommateBubble(id) {
    const idx = selectedRoommates.indexOf(id);
    if (idx > -1) {
        selectedRoommates.splice(idx, 1);
    } else {
        selectedRoommates.push(id);
    }
    renderQuickSplitBubbles();
}

// --- 1-TAP QUICK SPENDING ACTIONS ---

async function quickLogTemplate(desc, amount) {
    if (isNaN(amount) || amount <= 0) return;

    if (SERVER_MODE) {
        const txData = {
            username: STATE.currentUser,
            desc: desc,
            amount: amount,
            type: selectedRoommates.length > 0 ? 'split' : 'expense'
        };

        if (selectedRoommates.length > 0) {
            const involvedUsernames = selectedRoommates.map(fid => {
                const f = STATE.friends.find(fr => fr.id === fid);
                return f ? f.name : null;
            }).filter(Boolean);

            const total = involvedUsernames.length + 1;
            txData.desc = `${desc} (Split)`;
            txData.splitDetails = {
                totalParticipants: total,
                amountPerPerson: amount / total,
                involvedUsernames,
                includedMe: true
            };
        }

        try {
            const res = await fetch(`${SERVER_URL}/api/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txData)
            });
            if (res.ok) {
                selectedRoommates = [];
                const quickAmtInput = document.getElementById('quick-amount');
                if (quickAmtInput) quickAmtInput.value = '';
                await loadData();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to split transaction");
            }
        } catch (e) {
            alert("Error communicating with server.");
        }
        return;
    }

    // Local Storage Fallback
    if (selectedRoommates.length > 0) {
        const participants = selectedRoommates.length + 1;
        const splitAmount = amount / participants;

        selectedRoommates.forEach(fid => {
            updateFriendDebt(fid, splitAmount);
        });

        STATE.transactions.unshift({
            id: Date.now(),
            date: new Date().toISOString(),
            desc: `${desc} (Split)`,
            amount: amount,
            type: 'split',
            splitDetails: {
                totalParticipants: participants,
                amountPerPerson: splitAmount,
                involvedFriendIds: [...selectedRoommates],
                includedMe: true
            }
        });
    } else {
        STATE.transactions.unshift({
            id: Date.now(),
            date: new Date().toISOString(),
            desc: desc,
            amount: amount,
            type: 'expense'
        });
    }

    selectedRoommates = [];
    const quickAmtInput = document.getElementById('quick-amount');
    if (quickAmtInput) quickAmtInput.value = '';

    recalculateBalance();
    saveData();
}

function handleQuickAdd() {
    const amtInput = document.getElementById('quick-amount');
    const amount = parseFloat(amtInput.value);

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    quickLogTemplate("Quick Spend", amount);
}

// --- DETAILED TRANSACTION SYSTEM ---

async function addTransaction() {
    const descInput = document.getElementById('t-desc');
    const amountInput = document.getElementById('t-amount');
    const typeInput = document.getElementById('t-type');
    const friendInput = document.getElementById('t-friend-select');

    const desc = descInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const type = typeInput.value;

    if (!desc || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid description and amount");
        return;
    }

    if (SERVER_MODE) {
        const selectedFriend = friendInput.options[friendInput.selectedIndex]?.text;
        const txData = {
            username: STATE.currentUser,
            desc,
            amount,
            type,
            friend: (type === 'lend' || type === 'repayment') ? selectedFriend : null
        };

        if (type === 'split') {
            const checkboxes = document.querySelectorAll('#split-friends-list input[type="checkbox"]:checked');
            const involvedUsernames = Array.from(checkboxes).map(cb => cb.value);
            const includeMe = document.getElementById('split-include-me').checked;
            const total = involvedUsernames.length + (includeMe ? 1 : 0);

            if (total === 0) {
                alert("Please select at least one roommate to split with.");
                return;
            }

            txData.splitDetails = {
                totalParticipants: total,
                amountPerPerson: amount / total,
                involvedUsernames,
                includedMe: includeMe
            };
        }

        try {
            const res = await fetch(`${SERVER_URL}/api/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txData)
            });
            if (res.ok) {
                descInput.value = '';
                amountInput.value = '';
                closeModals();
                await loadData();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to add transaction");
            }
        } catch (e) {
            alert("Error sending transaction to server.");
        }
        return;
    }

    // Local Fallback Mode
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
            alert("Select a friend to lend to");
            return;
        }
        transaction.friendId = friendId;
        updateFriendDebt(friendId, amount);
    } else if (type === 'repayment') {
        const friendId = parseInt(friendInput.value);
        if (!friendId) {
            alert("Select the friend paying back");
            return;
        }
        transaction.friendId = friendId;
        updateFriendDebt(friendId, -amount);
    } else if (type === 'split') {
        const includeMe = document.getElementById('split-include-me').checked;
        const checkboxes = document.querySelectorAll('#split-friends-list input[type="checkbox"]:checked');
        const selectedFriendIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        const totalParticipants = selectedFriendIds.length + (includeMe ? 1 : 0);

        if (totalParticipants === 0) {
            alert("Select at least one friend to split with.");
            return;
        }

        const splitAmount = amount / totalParticipants;

        transaction.splitDetails = {
            totalParticipants,
            amountPerPerson: splitAmount,
            involvedFriendIds: selectedFriendIds,
            includedMe: includeMe
        };

        selectedFriendIds.forEach(fid => {
            updateFriendDebt(fid, splitAmount);
        });
    }

    STATE.transactions.unshift(transaction);
    recalculateBalance();
    saveData();

    descInput.value = '';
    amountInput.value = '';
    closeModals();
}

async function addFriend() {
    const nameInput = document.getElementById('f-name');
    const name = nameInput.value.trim().toLowerCase();

    if (!name) return;

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/friends/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: STATE.currentUser, friendUsername: name })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                nameInput.value = '';
                closeModals();
                await loadData();
            } else {
                alert(data.error || "Could not link roommate");
            }
        } catch (e) {
            alert("Error linking roommate with server.");
        }
        return;
    }

    // Local storage mode friend addition
    const newFriend = {
        id: Date.now(),
        name: name,
        balance: 0 
    };

    STATE.friends.push(newFriend);
    saveData();

    nameInput.value = '';
    closeModals();
}

function updateFriendDebt(friendId, amountAdded) {
    const friend = STATE.friends.find(f => f.id === friendId);
    if (friend) {
        friend.balance += amountAdded;
    }
}

async function settleFriendDebt(friendId, friendName, amount) {
    if (!confirm(`Mark ${friendName}'s debt of ${formatCurrency(amount)} as fully settled?`)) return;

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: friendName, 
                    desc: `Settle with ${STATE.currentUser}`,
                    amount: amount,
                    type: 'repayment',
                    friend: STATE.currentUser 
                })
            });
            if (res.ok) {
                await loadData();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to settle debt on server");
            }
        } catch (e) {
            alert("Server connection error during settlement.");
        }
        return;
    }

    // Local storage settlement
    STATE.transactions.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        desc: `Settle with ${friendName}`,
        amount: amount,
        type: 'repayment',
        friendId: friendId
    });

    updateFriendDebt(friendId, -amount);
    recalculateBalance();
    saveData();
}

// --- STUDENT ALLOWANCE LOGIC ---

async function saveSalaryConfig() {
    const amount = parseFloat(document.getElementById('salary-input').value);
    const date = parseInt(document.getElementById('salary-date').value);

    if (isNaN(amount) || isNaN(date)) return;

    if (SERVER_MODE) {
        try {
            const res = await fetch(`${SERVER_URL}/api/user/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: STATE.currentUser,
                    salaryAmount: amount,
                    salaryDate: date
                })
            });
            if (res.ok) {
                alert("Allowance settings saved!");
                await loadData();
            } else {
                alert("Failed to save allowance settings.");
            }
        } catch (e) {
            alert("Server connection error.");
        }
        return;
    }

    STATE.settings.salaryAmount = amount;
    STATE.settings.salaryDate = date;

    alert("Allowance settings saved!");
    saveData();
}

async function checkSalaryAutoAdd() {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${today.getMonth() + 1}`; 

    if (STATE.settings.lastSalaryMonth !== currentMonthStr && STATE.settings.salaryAmount > 0) {
        if (today.getDate() >= STATE.settings.salaryDate) {
            if (SERVER_MODE) {
                try {
                    await fetch(`${SERVER_URL}/api/transactions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: STATE.currentUser,
                            desc: 'Monthly Allowance (Auto Received)',
                            amount: STATE.settings.salaryAmount,
                            type: 'salary'
                        })
                    });

                    await fetch(`${SERVER_URL}/api/user/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: STATE.currentUser,
                            lastSalaryMonth: currentMonthStr
                        })
                    });

                    await loadData();
                    alert(`Allowance of ${formatCurrency(STATE.settings.salaryAmount)} added automatically!`);
                } catch (e) {
                    console.error("Auto add allowance server sync failed", e);
                }
                return;
            }

            // Local mode
            STATE.transactions.unshift({
                id: Date.now(),
                date: new Date().toISOString(),
                desc: 'Monthly Allowance (Auto Received)',
                amount: STATE.settings.salaryAmount,
                type: 'salary'
            });

            STATE.settings.lastSalaryMonth = currentMonthStr;
            recalculateBalance();
            saveData();
            alert(`Allowance of ${formatCurrency(STATE.settings.salaryAmount)} added automatically!`);
        }
    }
}

// --- INTERACTIVE REPORT GRAPHICS ---

function getCategoryFromDesc(desc, type) {
    if (type === 'lend') return 'Lending 💸';
    if (type === 'savings_deposit') return 'Savings Goal 🎯';
    
    const d = desc.toLowerCase();
    if (d.includes('tea') || d.includes('coffee') || d.includes('chai')) return 'Chai & Cafe ☕';
    if (d.includes('maggi') || d.includes('canteen') || d.includes('lunch') || d.includes('dinner') || d.includes('food') || d.includes('eat')) return 'Food & Canteen 🍛';
    if (d.includes('auto') || d.includes('cab') || d.includes('metro') || d.includes('bus') || d.includes('rickshaw')) return 'Transit & Auto 🛺';
    if (d.includes('xerox') || d.includes('book') || d.includes('print') || d.includes('fee') || d.includes('pen') || d.includes('exam')) return 'Academics 📚';
    if (d.includes('room') || d.includes('rent') || d.includes('wifi') || d.includes('net') || d.includes('electricity')) return 'Hostel Bills 🏠';
    if (d.includes('split')) return 'Roomie Splits 👥';
    return 'Other Expense 🎁';
}

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
        startDate = new Date(0); 
        endDate = new Date(8640000000000000); 
        document.getElementById('reports-date-display').textContent = 'All Time';
    }

    let income = 0;
    let expense = 0;
    let categoryExpenses = {};

    STATE.transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate >= startDate && tDate <= endDate) {
            if (t.type === 'income' || t.type === 'salary' || (t.type === 'repayment' && t.friend === STATE.currentUser)) {
                income += t.amount;
            } else if (t.type === 'expense' || t.type === 'split' || t.type === 'savings_deposit' || t.type === 'lend' || (t.type === 'repayment' && t.payer === STATE.currentUser)) {
                let actualCost = t.amount;
                if (t.type === 'split' && t.splitDetails) {
                    actualCost = t.splitDetails.amountPerPerson;
                }
                expense += actualCost;

                const cat = getCategoryFromDesc(t.desc, t.type);
                categoryExpenses[cat] = (categoryExpenses[cat] || 0) + actualCost;
            }
        }
    });

    document.getElementById('report-income').textContent = formatCurrency(income);
    document.getElementById('report-expense').textContent = formatCurrency(expense);
    document.getElementById('report-savings').textContent = formatCurrency(income - expense);

    // Bar Chart
    const barContainer = document.getElementById('bar-chart-container');
    const maxVal = Math.max(income, expense, 100); 
    const incomeHeight = (income / maxVal) * 100;
    const expenseHeight = (expense / maxVal) * 100;

    barContainer.innerHTML = `
        <div class="bar-group">
            <div class="bar" style="height:${incomeHeight}%; background:var(--success);"></div>
            <div class="bar-label">Inflow</div>
        </div>
        <div class="bar-group">
            <div class="bar" style="height:${expenseHeight}%; background:var(--danger);"></div>
            <div class="bar-label">Outflow</div>
        </div>
    `;

    // Donut Chart
    const donut = document.getElementById('category-donut');
    const legend = document.getElementById('category-legend');

    const sortedCats = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]).slice(0, 5); 
    let conicStr = '';
    let currentDeg = 0;
    const colors = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#f43f5e']; 
    let legendHtml = '';

    sortedCats.forEach((item, index) => {
        const [cat, amt] = item;
        const percent = (expense > 0) ? (amt / expense) * 100 : 0;
        const deg = (percent / 100) * 360;
        const color = colors[index % colors.length];

        conicStr += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `;
        currentDeg += deg;

        legendHtml += `<div class="legend-item">
            <div class="legend-dot" style="background:${color};"></div>
            <div>${cat} <span style="color:var(--text-secondary); font-weight:600;">(${Math.round(percent)}%)</span></div>
        </div>`;
    });

    if (expense === 0) conicStr = 'var(--border-color) 0deg 360deg';
    else conicStr = conicStr.slice(0, -2); 

    donut.style.background = `conic-gradient(${conicStr})`;
    legend.innerHTML = legendHtml || '<div style="color:var(--text-secondary); font-weight:600;">No spending logged</div>';
}

// Hook router listener
const originalSwitchView = window.switchView;
window.switchView = function (viewId, navEl) {
    if (typeof originalSwitchView === 'function') {
        originalSwitchView(viewId, navEl);
    }
    if (viewId === 'view-reports') {
        renderReports();
    }
}

// --- STUDENT DEMO SETUP ---

async function loadDemoData() {
    if (!confirm("This will replace current data with student demo data. Continue?")) return;

    if (SERVER_MODE) {
        alert("Demo data is only supported in offline Local Storage mode. When connected to a server, you can link with actual roommates!");
        return;
    }

    const now = new Date();
    
    STATE.settings.salaryAmount = 8000; // Parents allowance
    STATE.settings.salaryDate = 1;
    STATE.settings.lastSalaryMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

    STATE.savingsGoal = {
        title: "Noise Earphones 🎧",
        target: 2500,
        current: 500
    };

    STATE.friends = [
        { id: 1, name: "rahul", balance: 180 },
        { id: 2, name: "amit", balance: 0 },
        { id: 3, name: "sneha", balance: -50 }
    ];

    STATE.transactions = [
        { id: 101, type: 'salary', amount: 8000, desc: 'Pocket Money from Dad', date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() },
        { id: 102, type: 'savings_deposit', amount: 500, desc: 'Deposit to: Noise Earphones 🎧', date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString() },
        { id: 103, type: 'expense', amount: 1500, desc: 'Hostel Wifi bill', date: new Date(now.getFullYear(), now.getMonth(), 3).toISOString() },
        { id: 104, type: 'split', amount: 360, desc: 'Canteen Lunch', date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(), splitDetails: { totalParticipants: 2, amountPerPerson: 180, involvedFriendIds: [1], includedMe: true } },
        { id: 105, type: 'expense', amount: 40, desc: 'Chai & Samosa', date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString() },
        { id: 106, type: 'lend', amount: 50, desc: 'Lent for Xerox Sneha', date: new Date(now.getFullYear(), now.getMonth(), 6).toISOString(), friendId: 3 },
        { id: 107, type: 'expense', amount: 60, desc: 'Auto auto charge', date: new Date(now.getFullYear(), now.getMonth(), 7).toISOString() }
    ];

    recalculateBalance();
    saveData();
    alert("Student demo profiles loaded! Allowance set to ₹8,000, goal set, and balances updated.");
}

// --- UI POPULATORS ---

function initUI() {
    const dateSelect = document.getElementById('salary-date');
    if (dateSelect.options.length > 0) return; 

    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = i;
        dateSelect.appendChild(opt);
    }

    const saveBtn = document.getElementById('save-salary-btn');
    saveBtn.addEventListener('click', saveSalaryConfig);
}

function renderAll() {
    renderDashboard();
    renderFriends();
    renderSettings();
    renderFriendDropdown();
    renderSplitFriendList();
    renderQuickSplitBubbles();
    updateDailyDial();
    updateSavingsGoalUI();
}

function renderDashboard() {
    document.getElementById('parent-allowance').textContent = formatCurrency(STATE.settings.salaryAmount || 0);
    document.getElementById('total-wallet').textContent = formatCurrency(STATE.balance);
    document.getElementById('saved-money').textContent = formatCurrency(STATE.savingsGoal ? STATE.savingsGoal.current || 0 : 0);

    let friendsOwed = 0;
    STATE.friends.forEach(f => {
        if (f.balance > 0) friendsOwed += f.balance;
    });

    const list = document.getElementById('recent-transactions');
    list.innerHTML = '';

    if (STATE.transactions.length === 0) {
        list.innerHTML = '<li class="list-item" style="color:var(--text-secondary);justify-content:center;font-size:0.9rem;">No transactions yet</li>';
        return;
    }

    STATE.transactions.slice(0, 4).forEach(t => {
        const li = document.createElement('li');
        li.className = 'list-item';

        let colorClass = 'amount-positive';
        let prefix = '+';
        let amount = t.amount;

        if (t.type === 'expense' || t.type === 'lend' || t.type === 'savings_deposit') {
            colorClass = 'amount-negative';
            prefix = '-';
        } else if (t.type === 'split') {
            colorClass = 'amount-negative';
            prefix = '-';
            if (t.splitDetails) {
                amount = t.splitDetails.amountPerPerson;
            }
        }

        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

        li.innerHTML = `
            <div>
                <div style="font-weight:700; font-size:0.9rem;">${t.desc}</div>
                <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${dateStr} • ${t.type.toUpperCase()}</div>
            </div>
            <div class="${colorClass}">${prefix}${formatCurrency(amount)}</div>
        `;
        list.appendChild(li);
    });
}

function renderFriends() {
    const list = document.getElementById('friends-list');
    if (!list) return;
    list.innerHTML = '';

    let totalOwed = 0;

    STATE.friends.forEach(f => {
        totalOwed += f.balance;

        const li = document.createElement('li');
        li.className = 'list-item';

        let actionHtml = '';
        if (f.balance > 0) {
            actionHtml = `<button onclick="settleFriendDebt(${f.id}, '${f.name.replace(/'/g, "\\'")}', ${f.balance})" style="padding:6px 12px; font-size:0.75rem; font-weight:700; background:none; border:1px solid var(--success); color:var(--success); border-radius:8px; cursor:pointer; width:auto;">Settle</button>`;
        }

        li.innerHTML = `
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.95rem;">${f.name}</div>
                <div style="color: ${f.balance > 0 ? 'var(--success)' : 'var(--text-secondary)'}; font-size:0.8rem; font-weight:600;">
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

    if (STATE.savingsGoal) {
        document.getElementById('goal-title-input').value = STATE.savingsGoal.title || '';
        document.getElementById('goal-target-input').value = STATE.savingsGoal.target || '';
    }
}

function showHistoryView() {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-history').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    renderHistoryView();
}

function renderHistoryView() {
    const list = document.getElementById('history-list');
    const filterVal = document.getElementById('history-filter').value;
    list.innerHTML = '';

    const now = new Date();
    let cutoffDate = new Date(0); 

    if (filterVal === '30days') {
        cutoffDate.setDate(now.getDate() - 30);
    } else if (filterVal === '1year') {
        cutoffDate.setFullYear(now.getFullYear() - 1);
    }

    const filtered = STATE.transactions.filter(t => new Date(t.date) >= cutoffDate);

    if (filtered.length === 0) {
        list.innerHTML = '<li class="list-item" style="color:var(--text-secondary);justify-content:center;font-size:0.9rem;">No matching transactions</li>';
        return;
    }

    filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = 'list-item';

        let colorClass = 'amount-positive';
        let prefix = '+';
        let amount = t.amount;

        if (t.type === 'expense' || t.type === 'lend' || t.type === 'savings_deposit') {
            colorClass = 'amount-negative';
            prefix = '-';
        } else if (t.type === 'split') {
            colorClass = 'amount-negative';
            prefix = '-';
            if (t.splitDetails) {
                amount = t.splitDetails.amountPerPerson;
            }
        }

        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

        li.innerHTML = `
            <div>
                <div style="font-weight:700; font-size:0.9rem;">${t.desc}</div>
                <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${dateStr} • ${t.type.toUpperCase()}</div>
            </div>
            <div class="${colorClass}">${prefix}${formatCurrency(amount)}</div>
        `;
        list.appendChild(li);
    });
}

function exportHistoryToCSV() {
    const filterVal = document.getElementById('history-filter').value;
    const now = new Date();
    let cutoffDate = new Date(0);

    if (filterVal === '30days') {
        cutoffDate.setDate(now.getDate() - 30);
    } else if (filterVal === '1year') {
        cutoffDate.setFullYear(now.getFullYear() - 1);
    }

    const filtered = STATE.transactions.filter(t => new Date(t.date) >= cutoffDate);

    if (filtered.length === 0) {
        alert("No transactions to export for this period.");
        return;
    }

    let csvContent = "Date,Description,Type,Amount,Friend\n";

    filtered.forEach(t => {
        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
        const desc = `"${t.desc.replace(/"/g, '""')}"`;

        let friendName = "";
        if (t.friend) {
            friendName = t.friend;
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
    link.setAttribute("download", `PocketSafe_transactions_${now.toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- THEME UTILS ---
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

    if (isDark) {
        if (sun) sun.style.display = 'block';
        if (moon) moon.style.display = 'none';
    } else {
        if (sun) sun.style.display = 'none';
        if (moon) moon.style.display = 'block';
    }
}

initTheme();

// --- DROPDOWN POPULATORS ---

function renderFriendDropdown() {
    const select = document.getElementById('t-friend-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Friend --</option>';
    STATE.friends.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.text = f.name;
        select.appendChild(opt);
    });
}

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
            <input type="checkbox" id="split-friend-${f.id}" value="${f.name}" style="width:18px; height:18px; margin-right:8px; accent-color: var(--primary);">
            <label for="split-friend-${f.id}" style="margin:0;">${f.name}</label>
        `;
        container.appendChild(div);
    });
}

// --- NAVIGATION & ROUTING ---
function switchView(viewId, navEl) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navEl) navEl.classList.add('active');

    const fab = document.getElementById('add-transaction-btn');
    if (fab) {
        if (viewId === 'view-dashboard') fab.style.display = 'flex';
        else fab.style.display = 'none';
    }

    if (viewId === 'view-reports') {
        renderReports();
    }
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
}

function showTransactionModal(preSelectedType) {
    const modal = document.getElementById('modal-transaction');
    modal.style.display = 'block';

    const typeSelect = document.getElementById('t-type');
    if (preSelectedType) {
        typeSelect.value = preSelectedType;
    }

    function handleTypeChange() {
        const val = typeSelect.value;
        document.getElementById('friend-selector-group').style.display = (val === 'lend' || val === 'repayment') ? 'block' : 'none';
        document.getElementById('split-selector-group').style.display = (val === 'split') ? 'block' : 'none';

        if (val === 'split') {
            refreshSplitList();
        }
    }

    typeSelect.onchange = handleTypeChange;
    handleTypeChange();
}

function showAddFriendModal() {
    document.getElementById('modal-friend').style.display = 'block';
}

function formatCurrency(num) {
    return '₹' + num.toFixed(2);
}
