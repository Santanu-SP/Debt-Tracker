// State Management
const STATE = {
    currentUser: null,
    transactions: [],
    friends: [],
    settings: {
        salaryAmount: 0, // Set by user during onboarding
        salaryDate: 1, // Day of month (1-31)
        lastSalaryMonth: null, // 'YYYY-MM' format
        onboarded: false
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

// --- FIREBASE CONFIGURATION ---
// Replace these placeholders with your actual web app config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDA-aN1GCjWpyjZUX2oVufT42nTg4cZJ5A",
  authDomain: "pocket-saver-4a8e9.firebaseapp.com",
  projectId: "pocket-saver-4a8e9",
  storageBucket: "pocket-saver-4a8e9.firebasestorage.app",
  messagingSenderId: "694005609776",
  appId: "1:694005609776:web:155aa4933f9fc3b4f244f5",
  measurementId: "G-7GKHM1VWE7"
};

// Initialize Firebase SDK
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initAuthObserver();
});

function initAuthObserver() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Retrieve username from email
            let username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            if (user.email.endsWith('@pocketsafe.local')) {
                username = user.email.split('@')[0];
            }
            STATE.currentUser = username;
            showAppView();
        } else {
            STATE.currentUser = null;
            showAuthView();
        }
    });
}

// --- AUTH & SESSION ---
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
    loadData();
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
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!username || !password) {
        alert("Please enter username and password");
        return;
    }

    const email = `${username}@pocketsafe.local`;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        usernameInput.value = '';
        passwordInput.value = '';
    } catch (error) {
        alert("Invalid username or password");
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

    const email = `${username}@pocketsafe.local`;
    try {
        // Create user in Firebase Auth
        await auth.createUserWithEmailAndPassword(email, password);
        
        // Setup initial user doc in Firestore
        await db.collection('users').doc(username).set({
            username,
            email,
            settings: { salaryAmount: 3000, salaryDate: 1, lastSalaryMonth: null },
            savingsGoal: { title: "Set a savings goal! 🎯", target: 0 },
            friends: []
        });

        alert("Account created successfully!");
        toggleAuthMode('login');
    } catch (error) {
        alert(error.message);
    }
}

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        // Google popup login
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

        // Auto-provision user doc in Firestore if first login
        const userDoc = await db.collection('users').doc(username).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(username).set({
                username,
                email: user.email,
                settings: { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null, onboarded: false },
                savingsGoal: { title: "Set a savings goal! 🎯", target: 0 },
                friends: []
            });
        }
    } catch (error) {
        alert("Google Sign-In failed: " + error.message);
    }
}

function handleLogout() {
    STATE.currentUser = null;
    auth.signOut().then(() => {
        location.reload();
    });
}

// --- DATA PERSISTENCE & COMPILING ---
async function loadData() {
    if (!STATE.currentUser) return;
    const username = STATE.currentUser;

    try {
        // 1. Fetch user doc
        const userDoc = await db.collection('users').doc(username).get();
        if (!userDoc.exists) {
            // Provision backup doc
            await db.collection('users').doc(username).set({
                username,
                email: auth.currentUser ? auth.currentUser.email : '',
                settings: { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null, onboarded: false },
                savingsGoal: { title: "Set a savings goal! 🎯", target: 0 },
                friends: []
            });
            await loadData();
            return;
        }

        const userData = userDoc.data();
        STATE.settings = userData.settings || { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null, onboarded: false };
        STATE.savingsGoal = userData.savingsGoal || { title: "Set a savings goal! 🎯", target: 0 };

        document.getElementById('user-display-name').textContent = username;

        if (STATE.settings.onboarded !== true) {
            showOnboardingModal();
            return;
        }

        // 2. Fetch all transactions involving this user (payer, friend, or split list)
        const q1 = db.collection('transactions').where('payer', '==', username).get();
        const q2 = db.collection('transactions').where('friend', '==', username).get();
        const q3 = db.collection('transactions').where('splitDetails.involvedUsernames', 'array-contains', username).get();

        const [s1, s2, s3] = await Promise.all([q1, q2, q3]);

        const txMap = new Map();
        const addDoc = (doc) => {
            const data = doc.data();
            const dateStr = data.date ? data.date.toDate().toISOString() : new Date().toISOString();
            txMap.set(doc.id, {
                id: doc.id,
                ...data,
                date: dateStr
            });
        };

        s1.forEach(addDoc);
        s2.forEach(addDoc);
        s3.forEach(addDoc);

        // Sort descending by date
        STATE.transactions = Array.from(txMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

        // 3. Dynamic roommate balance compiling
        const friendsList = [];
        for (const fName of userData.friends || []) {
            let debtBalance = 0;
            STATE.transactions.forEach(t => {
                if (t.type === 'lend') {
                    if (t.payer === username && t.friend === fName) debtBalance += t.amount;
                    else if (t.payer === fName && t.friend === username) debtBalance -= t.amount;
                } else if (t.type === 'repayment') {
                    if (t.payer === fName && t.friend === username) debtBalance -= t.amount;
                    else if (t.payer === username && t.friend === fName) debtBalance += t.amount;
                } else if (t.type === 'split' && t.splitDetails) {
                    if (t.payer === username && t.splitDetails.involvedUsernames.includes(fName)) {
                        debtBalance += t.splitDetails.amountPerPerson;
                    } else if (t.payer === fName && t.splitDetails.involvedUsernames.includes(username)) {
                        debtBalance -= t.splitDetails.amountPerPerson;
                    }
                }
            });
            friendsList.push({
                id: fName,
                name: fName,
                balance: debtBalance
            });
        }
        STATE.friends = friendsList;

        // 4. Wallet balance & savings tracker calculations
        let walletBalance = 0;
        let savingsTotal = 0;

        STATE.transactions.forEach(t => {
            if (t.payer === username) {
                if (t.type === 'income' || t.type === 'salary') {
                    walletBalance += t.amount;
                } else if (t.type === 'expense' || t.type === 'lend' || t.type === 'savings_deposit' || t.type === 'split') {
                    walletBalance -= t.amount;
                } else if (t.type === 'repayment') {
                    walletBalance -= t.amount;
                }

                if (t.type === 'savings_deposit') {
                    savingsTotal += t.amount;
                }
            } else if (t.friend === username && t.type === 'repayment') {
                walletBalance += t.amount;
            }
        });

        STATE.balance = walletBalance;
        STATE.savingsGoal.current = savingsTotal;

        checkSalaryAutoAdd();
        renderAll();
    } catch (e) {
        console.error("Firestore fetch error:", e);
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

    try {
        await db.collection('users').doc(STATE.currentUser).update({
            'savingsGoal.title': title,
            'savingsGoal.target': target
        });
        alert("Savings goal updated!");
        await loadData();
    } catch (e) {
        alert("Firestore error updating goal: " + e.message);
    }
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

    try {
        const targetTitle = STATE.savingsGoal ? STATE.savingsGoal.title : "Savings Goal";
        await db.collection('transactions').add({
            payer: STATE.currentUser,
            desc: `Deposit to: ${targetTitle}`,
            amount: amount,
            type: 'savings_deposit',
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        amtInput.value = '';
        await loadData();
        alert(`Deposited ${formatCurrency(amount)} into savings goal!`);
    } catch (e) {
        alert("Failed to record savings deposit: " + e.message);
    }
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
        bubble.className = `roommate-bubble ${selectedRoommates.includes(f.name) ? 'selected' : ''}`;
        bubble.onclick = () => toggleRoommateBubble(f.name);

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

function toggleRoommateBubble(name) {
    const idx = selectedRoommates.indexOf(name);
    if (idx > -1) {
        selectedRoommates.splice(idx, 1);
    } else {
        selectedRoommates.push(name);
    }
    renderQuickSplitBubbles();
}

// --- 1-TAP QUICK SPENDING ACTIONS ---
async function quickLogTemplate(desc, amount) {
    if (isNaN(amount) || amount <= 0) return;

    const txData = {
        payer: STATE.currentUser,
        desc: desc,
        amount: amount,
        type: selectedRoommates.length > 0 ? 'split' : 'expense',
        date: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (selectedRoommates.length > 0) {
        const total = selectedRoommates.length + 1;
        txData.desc = `${desc} (Split)`;
        txData.splitDetails = {
            totalParticipants: total,
            amountPerPerson: amount / total,
            involvedUsernames: [...selectedRoommates],
            includedMe: true
        };
    }

    try {
        await db.collection('transactions').add(txData);
        selectedRoommates = [];
        const quickAmtInput = document.getElementById('quick-amount');
        if (quickAmtInput) quickAmtInput.value = '';
        await loadData();
    } catch (e) {
        alert("Error saving transaction: " + e.message);
    }
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

    const selectedFriend = friendInput.options[friendInput.selectedIndex]?.text;
    const txData = {
        payer: STATE.currentUser,
        desc,
        amount,
        type,
        friend: (type === 'lend' || type === 'repayment') ? selectedFriend : null,
        date: firebase.firestore.FieldValue.serverTimestamp()
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
        await db.collection('transactions').add(txData);
        descInput.value = '';
        amountInput.value = '';
        closeModals();
        await loadData();
    } catch (e) {
        alert("Transaction failed: " + e.message);
    }
}

async function addFriend() {
    const nameInput = document.getElementById('f-name');
    const nameOrEmail = nameInput.value.trim().toLowerCase();

    if (!nameOrEmail) return;

    if (nameOrEmail === STATE.currentUser) {
        alert("You cannot add yourself as a roommate!");
        return;
    }

    try {
        let friendUsername = null;

        // 1. Check if input is a direct username (doc ID exists)
        const docRef = db.collection('users').doc(nameOrEmail);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            friendUsername = nameOrEmail;
        } else {
            // 2. Query doc where email matches input
            const querySnap = await db.collection('users').where('email', '==', nameOrEmail).get();
            if (!querySnap.empty) {
                friendUsername = querySnap.docs[0].id;
            }
        }

        if (!friendUsername) {
            alert(`No student found with username or email: "${nameOrEmail}". Make sure they sign up first!`);
            return;
        }

        const batch = db.batch();
        const myRef = db.collection('users').doc(STATE.currentUser);
        batch.update(myRef, {
            friends: firebase.firestore.FieldValue.arrayUnion(friendUsername)
        });

        const friendRef = db.collection('users').doc(friendUsername);
        batch.update(friendRef, {
            friends: firebase.firestore.FieldValue.arrayUnion(STATE.currentUser)
        });

        await batch.commit();
        
        nameInput.value = '';
        closeModals();
        await loadData();
    } catch (e) {
        alert("Failed to link friend: " + e.message);
    }
}

async function settleFriendDebt(friendId, friendName, amount) {
    if (!confirm(`Mark ${friendName}'s debt of ${formatCurrency(amount)} as fully settled?`)) return;

    try {
        await db.collection('transactions').add({
            payer: friendName, 
            desc: `Settle with ${STATE.currentUser}`,
            amount: amount,
            type: 'repayment',
            friend: STATE.currentUser, 
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadData();
    } catch (e) {
        alert("Failed to settle: " + e.message);
    }
}

// --- STUDENT ALLOWANCE LOGIC ---
async function saveSalaryConfig() {
    const val = document.getElementById('salary-input').value;
    const amount = val === '' ? 0 : parseFloat(val);
    const date = parseInt(document.getElementById('salary-date').value);

    if (isNaN(amount) || isNaN(date)) return;

    try {
        await db.collection('users').doc(STATE.currentUser).update({
            'settings.salaryAmount': amount,
            'settings.salaryDate': date
        });
        alert("Allowance settings saved!");
        await loadData();
    } catch (e) {
        alert("Error saving settings: " + e.message);
    }
}

async function checkSalaryAutoAdd() {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${today.getMonth() + 1}`; 

    if (STATE.settings.lastSalaryMonth !== currentMonthStr && STATE.settings.salaryAmount > 0) {
        if (today.getDate() >= STATE.settings.salaryDate) {
            try {
                const batch = db.batch();
                
                const txRef = db.collection('transactions').doc();
                batch.set(txRef, {
                    payer: STATE.currentUser,
                    desc: 'Monthly Allowance (Auto Received)',
                    amount: STATE.settings.salaryAmount,
                    type: 'salary',
                    date: firebase.firestore.FieldValue.serverTimestamp()
                });

                const userRef = db.collection('users').doc(STATE.currentUser);
                batch.update(userRef, {
                    'settings.lastSalaryMonth': currentMonthStr
                });

                await batch.commit();
                await loadData();
                alert(`Allowance of ${formatCurrency(STATE.settings.salaryAmount)} added automatically!`);
            } catch (e) {
                console.error("Auto add allowance failed", e);
            }
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

// --- STUDENT DEMO SETUP (Simulated in Firestore) ---
async function loadDemoData() {
    if (!confirm("This will overwrite your account with demo data. Continue?")) return;

    try {
        const batch = db.batch();
        const now = new Date();

        // 1. Setup profile in batch
        const userRef = db.collection('users').doc(STATE.currentUser);
        batch.update(userRef, {
            'settings.salaryAmount': 8000,
            'settings.salaryDate': 1,
            'settings.lastSalaryMonth': `${now.getFullYear()}-${now.getMonth() + 1}`,
            'savingsGoal': { title: "Noise Earphones 🎧", target: 2500 },
            'friends': ['rahul', 'sneha', 'amit']
        });

        // Ensure other test users exist in Firestore
        batch.set(db.collection('users').doc('rahul'), { username: 'rahul', friends: [STATE.currentUser] }, { merge: true });
        batch.set(db.collection('users').doc('sneha'), { username: 'sneha', friends: [STATE.currentUser] }, { merge: true });
        batch.set(db.collection('users').doc('amit'), { username: 'amit', friends: [STATE.currentUser] }, { merge: true });

        // 2. Clear old transactions for current user
        const oldTxs = await db.collection('transactions').where('payer', '==', STATE.currentUser).get();
        oldTxs.forEach(doc => batch.delete(doc.ref));

        // 3. Staged Demo Transactions
        const txs = [
            { type: 'salary', amount: 8000, desc: 'Pocket Money from Dad', date: new Date(now.getFullYear(), now.getMonth(), 1) },
            { type: 'savings_deposit', amount: 500, desc: 'Deposit to: Noise Earphones 🎧', date: new Date(now.getFullYear(), now.getMonth(), 2) },
            { type: 'expense', amount: 1500, desc: 'Hostel Wifi bill', date: new Date(now.getFullYear(), now.getMonth(), 3) },
            { type: 'split', amount: 360, desc: 'Canteen Lunch', date: new Date(now.getFullYear(), now.getMonth(), 5), splitDetails: { totalParticipants: 2, amountPerPerson: 180, involvedUsernames: ['rahul'], includedMe: true } },
            { type: 'expense', amount: 40, desc: 'Chai & Samosa', date: new Date(now.getFullYear(), now.getMonth(), 5) },
            { type: 'lend', amount: 50, desc: 'Lent for Xerox Sneha', date: new Date(now.getFullYear(), now.getMonth(), 6), friend: 'sneha' },
            { type: 'expense', amount: 60, desc: 'Auto auto charge', date: new Date(now.getFullYear(), now.getMonth(), 7) }
        ];

        txs.forEach(t => {
            const docRef = db.collection('transactions').doc();
            batch.set(docRef, {
                payer: STATE.currentUser,
                ...t,
                date: firebase.firestore.Timestamp.fromDate(t.date)
            });
        });

        await batch.commit();
        alert("Demo data loaded successfully!");
        await loadData();
    } catch (e) {
        alert("Failed to load demo data: " + e.message);
    }
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
            actionHtml = `<button onclick="settleFriendDebt(null, '${f.name.replace(/'/g, "\\'")}', ${f.balance})" style="padding:6px 12px; font-size:0.75rem; font-weight:700; background:none; border:1px solid var(--success); color:var(--success); border-radius:8px; cursor:pointer; width:auto;">Settle</button>`;
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
        opt.value = f.name;
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
            <input type="checkbox" id="split-friend-${f.name}" value="${f.name}" style="width:18px; height:18px; margin-right:8px; accent-color: var(--primary);">
            <label for="split-friend-${f.name}" style="margin:0;">${f.name}</label>
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

function showOnboardingModal() {
    const modal = document.getElementById('modal-onboarding');
    if (!modal) return;

    // Populate dates
    const select = document.getElementById('onboard-allowance-date');
    if (select && select.options.length === 0) {
        for (let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = i;
            select.appendChild(opt);
        }
    }

    modal.style.display = 'flex';
}

async function submitOnboarding() {
    const balInput = document.getElementById('onboard-balance');
    const allowInput = document.getElementById('onboard-allowance');
    const dateInput = document.getElementById('onboard-allowance-date');

    const balance = parseFloat(balInput.value) || 0;
    const allowance = parseFloat(allowInput.value) || 0;
    const date = parseInt(dateInput.value) || 1;

    if (balance < 0 || allowance < 0) {
        alert("Values cannot be negative.");
        return;
    }

    const username = STATE.currentUser;
    try {
        const batch = db.batch();

        // 1. Log starting balance transaction if > 0
        if (balance > 0) {
            const txRef = db.collection('transactions').doc();
            batch.set(txRef, {
                payer: username,
                desc: 'Starting Balance Adjustment',
                amount: balance,
                type: 'income',
                date: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // 2. Set settings
        const userRef = db.collection('users').doc(username);
        batch.update(userRef, {
            settings: {
                salaryAmount: allowance,
                salaryDate: date,
                lastSalaryMonth: null,
                onboarded: true
            }
        });

        await batch.commit();

        document.getElementById('modal-onboarding').style.display = 'none';
        await loadData();
    } catch (e) {
        alert("Setup failed: " + e.message);
    }
}

async function clearAllData() {
    if (!confirm("Are you sure you want to delete all user settings and transactions? This cannot be undone.")) return;

    try {
        const username = STATE.currentUser;
        const batch = db.batch();

        // 1. Delete transactions where payer == username
        const txsSnap = await db.collection('transactions').where('payer', '==', username).get();
        txsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. Reset user settings & friends list
        const userRef = db.collection('users').doc(username);
        batch.update(userRef, {
            settings: { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null, onboarded: false },
            savingsGoal: { title: "Set a savings goal! 🎯", target: 0 },
            friends: []
        });

        await batch.commit();
        alert("Data reset successfully!");
        location.reload();
    } catch (e) {
        alert("Reset failed: " + e.message);
    }
}
