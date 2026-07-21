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
    savingsGoals: [],        // Multi-goal: [{id, title, target, savedAmount}]
    autoSave: { enabled: false, percent: 20 }, // Auto-save settings
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

// Track when the app started for minimum splash enforcement
const SPLASH_START = Date.now();
const MIN_SPLASH_MS = 3000;

// --- INITIALIZATION ---
// app.js is dynamically loaded by React after mount, so DOM is ready.
initTheme();
initAuthObserver();

function initAuthObserver() {
    auth.onAuthStateChanged(async (user) => {
        // Enforce minimum 3-second splash duration
        const elapsed = Date.now() - SPLASH_START;
        const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));

        // Smooth animated exit of splash
        await hideSplash();

        if (user) {
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

function hideSplash() {
    return new Promise(resolve => {
        // Signal React to dismiss the cinematic splash via AnimatePresence
        if (typeof window.__hideSplashReact === 'function') {
            window.__hideSplashReact();
        }
        // Allow React's exit animation to complete (550ms) before resolving
        setTimeout(resolve, 600);
    });
}

// --- AUTH & SESSION ---
function showAuthView() {
    const splash = document.getElementById('splash-view');
    if (splash) splash.style.display = 'none';
    document.getElementById('auth-view').style.display = 'block';
    document.getElementById('app-view').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showAppView() {
    const splash = document.getElementById('splash-view');
    if (splash) splash.style.display = 'none';
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
                settings: { salaryAmount: 3000, salaryDate: 1, lastSalaryMonth: null },
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
                settings: { salaryAmount: 3000, salaryDate: 1, lastSalaryMonth: null },
                savingsGoal: { title: "Set a savings goal! 🎯", target: 0 },
                friends: []
            });
            await loadData();
            return;
        }

        const userData = userDoc.data();
        STATE.settings = userData.settings || { salaryAmount: 3000, salaryDate: 1, lastSalaryMonth: null };
        STATE.savingsGoal = userData.savingsGoal || { title: "Set a savings goal! 🎯", target: 0 };

        const displayName = userData.customUsername || username;
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = displayName;

        const banner = document.getElementById('username-reminder-banner');
        if (banner) {
            banner.style.display = (userData.customUsername) ? 'none' : 'flex';
        }

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

        // 4. Wallet balance & multi-goal savings calculations
        let walletBalance = 0;
        let savingsTotal = 0;

        // Load multi-goals from Firestore, or migrate from legacy single goal
        const firestoreGoals = userData.savingsGoals;
        const loadedGoals = (firestoreGoals && firestoreGoals.length > 0)
            ? firestoreGoals.map(g => ({ id: g.id, title: g.title, target: g.target || 0, savedAmount: 0 }))
            : [{
                id: 'g_legacy',
                title: (userData.savingsGoal ? userData.savingsGoal.title : 'Set a savings goal! 🎯'),
                target: (userData.savingsGoal ? userData.savingsGoal.target || 0 : 0),
                savedAmount: 0
            }];

        STATE.autoSave = userData.autoSave || { enabled: false, percent: 20 };

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
                    // Attribute deposit to the correct goal by goalId
                    if (t.goalId) {
                        const goalIdx = loadedGoals.findIndex(g => g.id === t.goalId);
                        if (goalIdx >= 0) {
                            loadedGoals[goalIdx].savedAmount += t.amount;
                        }
                    } else if (loadedGoals.length > 0) {
                        // Legacy: no goalId, goes to first goal
                        loadedGoals[0].savedAmount += t.amount; 
                    }
                }
            } else if (t.friend === username && t.type === 'repayment') {
                walletBalance += t.amount;
            }
        });

        STATE.balance = walletBalance;
        STATE.savingsGoals = loadedGoals;

        // Backwards compat: keep STATE.savingsGoal pointing to first goal for updateDailyDial
        const _pg = loadedGoals[0] || { title: 'Set a savings goal! 🎯', target: 0, savedAmount: 0 };
        STATE.savingsGoal = { title: _pg.title, target: _pg.target, current: _pg.savedAmount };

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

    // Use first goal as the primary dashboard goal
    const goals = STATE.savingsGoals || [];
    const goal = goals[0] || { title: 'Set a savings goal! 🎯', target: 0, savedAmount: 0 };
    const title = goal.title;
    const target = goal.target || 0;
    const current = goal.savedAmount || 0;

    const titleDisplay = document.getElementById('goal-title-display');
    if (titleDisplay) {
        titleDisplay.textContent = goals.length > 1 ? `${title} (+${goals.length - 1} more)` : title;
    }
    document.getElementById('goal-progress-values').textContent = `${formatCurrency(current)} / ${formatCurrency(target)}`;

    const bar = document.getElementById('goal-progress-bar');
    if (bar) {
        const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        bar.style.width = `${percent}%`;
    }

    const status = document.getElementById('goal-days-status');
    if (status) {
        if (target === 0) {
            status.textContent = "Open Setup tab to configure a savings goal!";
            status.style.color = "var(--text-secondary)";
        } else if (current >= target) {
            status.textContent = "🎉 Goal achieved! Set a new one in Setup.";
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
        await applyAutoSave();
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
        if (type === 'expense' || type === 'split') await applyAutoSave();
    } catch (e) {
        alert("Transaction failed: " + e.message);
    }
}

async function addFriend() {
    const nameInput = document.getElementById('f-name');
    const name = nameInput.value.trim().toLowerCase();

    if (!name) return;

    if (name === STATE.currentUser) {
        alert("You cannot add yourself as a roommate!");
        return;
    }

    try {
        // Validate friend profile exists in database
        const friendDoc = await db.collection('users').doc(name).get();
        if (!friendDoc.exists) {
            alert(`Hostel username "${name}" does not exist. They must register first!`);
            return;
        }

        const batch = db.batch();
        const myRef = db.collection('users').doc(STATE.currentUser);
        batch.update(myRef, {
            friends: firebase.firestore.FieldValue.arrayUnion(name)
        });

        const friendRef = db.collection('users').doc(name);
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
    const amount = parseFloat(document.getElementById('salary-input').value);
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
            } else if (t.type === 'expense' || t.type === 'split' || t.type === 'lend' || (t.type === 'repayment' && t.payer === STATE.currentUser)) {
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

    renderSavingsRateBadge();
}

// Note: renderReports() is already called inside switchView() below when viewId==='view-reports'

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
    renderSmartTip();
    renderSavingsPace();
}

function getTxMeta(t) {
    const typeMap = {
        expense:         { label: 'Spent',    dot: '#ef4444', sign: '-', cls: 'amount-negative' },
        income:          { label: 'Received', dot: '#059669', sign: '+', cls: 'amount-positive'  },
        salary:          { label: 'Allowance',dot: '#059669', sign: '+', cls: 'amount-positive'  },
        lend:            { label: 'Lent',     dot: '#d97706', sign: '-', cls: 'amount-negative'  },
        repayment:       { label: 'Paid Back',dot: '#059669', sign: '+', cls: 'amount-positive'  },
        split:           { label: 'Split',    dot: '#6366f1', sign: '-', cls: 'amount-negative'  },
        savings_deposit: { label: 'Saved',    dot: '#047857', sign: '-', cls: 'amount-negative'  },
    };
    const meta = typeMap[t.type] || { label: t.type, dot: '#8a9180', sign: '', cls: '' };
    let amount = t.amount;
    if (t.type === 'split' && t.splitDetails) amount = t.splitDetails.amountPerPerson;
    // Repayment received by current user = positive
    if (t.type === 'repayment' && t.friend === STATE.currentUser) { meta.sign = '+'; meta.cls = 'amount-positive'; }
    return { ...meta, amount };
}

function renderDashboard() {
    document.getElementById('parent-allowance').textContent = formatCurrency(STATE.settings.salaryAmount || 0);
    document.getElementById('total-wallet').textContent = formatCurrency(STATE.balance);
    const _totalSaved = (STATE.savingsGoals || []).reduce((sum, g) => sum + (g.savedAmount || 0), 0);
    document.getElementById('saved-money').textContent = formatCurrency(_totalSaved);

    const list = document.getElementById('recent-transactions');
    list.innerHTML = '';

    if (STATE.transactions.length === 0) {
        list.innerHTML = '<li class="list-item" style="color:var(--text-secondary);justify-content:center;font-size:0.9rem;padding:20px 0;">No transactions yet — tap + to add one!</li>';
        return;
    }

    STATE.transactions.slice(0, 4).forEach(t => {
        const li = document.createElement('li');
        li.className = 'list-item';
        const { label, dot, sign, cls, amount } = getTxMeta(t);
        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

        li.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <div style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
                <div style="min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.desc}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted);font-weight:500;margin-top:1px;">${dateStr} &middot; ${label}</div>
                </div>
            </div>
            <div class="${cls}" style="font-size:0.88rem;flex-shrink:0;margin-left:8px;">${sign}${formatCurrency(amount)}</div>
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
    renderGoalsManager();
    renderAutoSaveUI();
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
        const { label, dot, sign, cls, amount } = getTxMeta(t);
        const dateObj = new Date(t.date);
        const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

        li.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <div style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
                <div style="min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.desc}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted);font-weight:500;margin-top:1px;">${dateStr} &middot; ${label}</div>
                </div>
            </div>
            <div class="${cls}" style="font-size:0.88rem;flex-shrink:0;margin-left:8px;">${sign}${formatCurrency(amount)}</div>
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
    if (balance < 0 || allowance < 0) { alert('Values cannot be negative.'); return; }
    const username = STATE.currentUser;
    try {
        const batch = db.batch();
        if (balance > 0) {
            const txRef = db.collection('transactions').doc();
            batch.set(txRef, { payer: username, desc: 'Starting Balance', amount: balance, type: 'income', date: firebase.firestore.FieldValue.serverTimestamp() });
        }
        const userRef = db.collection('users').doc(username);
        batch.update(userRef, { settings: { salaryAmount: allowance, salaryDate: date, lastSalaryMonth: null, onboarded: true } });
        await batch.commit();
        document.getElementById('modal-onboarding').style.display = 'none';
        await loadData();
    } catch (e) { alert('Setup failed: ' + e.message); }
}

async function clearAllData() {
    if (!confirm('Are you sure you want to delete all user settings and transactions? This cannot be undone.')) return;
    try {
        const username = STATE.currentUser;
        const batch = db.batch();
        const txsSnap = await db.collection('transactions').where('payer', '==', username).get();
        txsSnap.forEach(doc => batch.delete(doc.ref));
        const userRef = db.collection('users').doc(username);
        batch.update(userRef, {
            settings: { salaryAmount: 0, salaryDate: 1, lastSalaryMonth: null, onboarded: false },
            savingsGoal: { title: 'Set a savings goal! 🎯', target: 0 },
            savingsGoals: [],
            autoSave: { enabled: false, percent: 20 },
            friends: []
        });
        await batch.commit();
        showToast('Everything cleared. Fresh start!');
        setTimeout(() => location.reload(), 1200);
    } catch (e) { alert('Reset failed: ' + e.message); }
}

let selectedPhotoBase64 = '';

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX = 120;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            selectedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
            const preview = document.getElementById('profile-avatar-preview');
            if (preview) preview.innerHTML = `<img src="${selectedPhotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function showProfileModal() {
    if (!STATE.currentUser) return;
    const username = STATE.currentUser;
    try {
        const userDoc = await db.collection('users').doc(username).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            const currentUserObj = auth.currentUser;
            document.getElementById('profile-email-display').textContent = currentUserObj ? currentUserObj.email : 'Local Account';
            document.getElementById('profile-id-display').textContent = username;
            document.getElementById('profile-username').value = data.customUsername || '';
            document.getElementById('profile-phone').value = data.phone || '';
            document.getElementById('profile-room').value = data.roomNo || '';
            selectedPhotoBase64 = data.photoUrl || '';
            const preview = document.getElementById('profile-avatar-preview');
            if (preview) {
                if (selectedPhotoBase64) {
                    preview.innerHTML = `<img src="${selectedPhotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    preview.textContent = '👤';
                }
            }
            // Show username change info
            const changesLeft = 3 - (data.usernameChangesCount || 0);
            const usernameField = document.getElementById('profile-username');
            if (usernameField) usernameField.title = `${changesLeft} username change(s) remaining (max 3 lifetime, 30-day cooldown)`;
            document.getElementById('modal-profile').style.display = 'flex';
        }
    } catch (e) { alert('Failed to load profile: ' + e.message); }
}

async function saveProfile() {
    if (!STATE.currentUser) return;
    const username = STATE.currentUser;
    const newUsername = document.getElementById('profile-username').value.trim().toLowerCase();
    const phone = document.getElementById('profile-phone').value.trim();
    const room = document.getElementById('profile-room').value.trim();
    if (newUsername !== '') {
        const usernameRegex = /^[a-z0-9_]+$/;
        if (!usernameRegex.test(newUsername)) {
            alert('Username must only contain lowercase letters, numbers, and underscores.');
            return;
        }
    }
    try {
        const userDoc = await db.collection('users').doc(username).get();
        const userData = userDoc.data() || {};
        let customUsername = userData.customUsername || '';
        let changesCount = userData.usernameChangesCount || 0;
        let lastChangeStr = userData.lastUsernameChangeDate || null;
        let updatePayload = { phone, roomNo: room, photoUrl: selectedPhotoBase64 };
        if (newUsername !== '' && newUsername !== customUsername) {
            if (changesCount >= 3) {
                alert('You have reached the maximum limit of 3 lifetime username changes.');
                return;
            }
            if (lastChangeStr) {
                const diffDays = Math.floor((new Date() - new Date(lastChangeStr)) / (1000 * 60 * 60 * 24));
                if (diffDays < 30) {
                    alert(`You can only change your username once every 30 days. Please try again in ${30 - diffDays} day(s).`);
                    return;
                }
            }
            const querySnap = await db.collection('users').where('customUsername', '==', newUsername).get();
            if (!querySnap.empty && querySnap.docs.some(doc => doc.id !== username)) {
                alert('This username is already taken. Please pick a different one!');
                return;
            }
            updatePayload.customUsername = newUsername;
            updatePayload.usernameChangesCount = changesCount + 1;
            updatePayload.lastUsernameChangeDate = new Date().toISOString();
        } else if (newUsername === customUsername) {
            updatePayload.customUsername = newUsername;
        }
        await db.collection('users').doc(username).update(updatePayload);
        alert('Profile updated successfully!');
        closeModals();
        await loadData();
    } catch (e) { alert('Failed to save profile: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════
function showToast(message, duration = 3200) {
    let toast = document.getElementById('ps-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ps-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 1 — SMART SAVINGS TIP (Dashboard)
// ═══════════════════════════════════════════════════════════
function renderSmartTip() {
    const card = document.getElementById('smart-tip-card');
    const content = document.getElementById('smart-tip-content');
    if (!card || !content) return;

    const goals = STATE.savingsGoals || [];
    const primaryGoal = goals[0];
    const dailyBudget = STATE.settings.salaryAmount ? STATE.settings.salaryAmount / 30 : 0;

    // Calculate overspend days in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const daySpendMap = {};
    STATE.transactions.forEach(t => {
        if (t.payer !== STATE.currentUser) return;
        if (t.type !== 'expense' && t.type !== 'split') return;
        const d = new Date(t.date);
        if (d < sevenDaysAgo) return;
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const amt = (t.type === 'split' && t.splitDetails) ? t.splitDetails.amountPerPerson : t.amount;
        daySpendMap[key] = (daySpendMap[key] || 0) + amt;
    });
    const dayValues = Object.values(daySpendMap);
    const overDays = dailyBudget > 0 ? dayValues.filter(v => v > dailyBudget).length : 0;

    let tipIcon = '💡';
    let tipText = '';

    if (primaryGoal && primaryGoal.target > 0 && (primaryGoal.savedAmount || 0) >= primaryGoal.target) {
        // Goal complete
        tipIcon = '🎉';
        tipText = `You've hit your "${primaryGoal.title}" goal! Head to Setup to create a new one.`;
    } else if (overDays >= 3 && dailyBudget > 0) {
        // Overspending
        const avgSpend = dayValues.reduce((a, b) => a + b, 0) / (dayValues.length || 1);
        const overshoot = Math.max(0, avgSpend - dailyBudget);
        tipIcon = '⚠️';
        tipText = `You've exceeded your daily limit ${overDays} days this week. Trimming just ${formatCurrency(overshoot)} per day would go straight into savings.`;
    } else if (STATE.balance > (STATE.settings.salaryAmount || 0) * 0.25 && primaryGoal && primaryGoal.target > 0) {
        // High idle balance, push toward goal
        tipIcon = '🏦';
        tipText = `You have ${formatCurrency(STATE.balance)} sitting idle. Consider parking some in "${primaryGoal.title}" — every deposit counts!`;
    } else if (primaryGoal && primaryGoal.target > 0) {
        // Show progress encouragement
        const pct = Math.round(((primaryGoal.savedAmount || 0) / primaryGoal.target) * 100);
        if (pct >= 75) {
            tipIcon = '🏁';
            tipText = `You're ${pct}% of the way to "${primaryGoal.title}" — almost there! Keep it up.`;
        } else if (pct > 0) {
            tipIcon = '📈';
            tipText = `${pct}% of "${primaryGoal.title}" funded. Small, consistent deposits are your best friend here.`;
        } else {
            tipIcon = '🌱';
            tipText = `Your "${primaryGoal.title}" goal is waiting for its first deposit. Head to Setup → Savings Goals to get started!`;
        }
    } else {
        tipIcon = '🎯';
        tipText = `Set a savings goal in the Setup tab to start getting personalized money tips!`;
    }

    content.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="font-size:1.5rem;flex-shrink:0;margin-top:1px;">${tipIcon}</div>
            <div>
                <div style="font-size:0.65rem;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Smart Tip</div>
                <div style="font-size:0.82rem;font-weight:600;color:var(--text-primary);line-height:1.55;">${tipText}</div>
            </div>
        </div>
    `;
    card.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 2 — SAVINGS PACE TRACKER (Dashboard goal card)
// ═══════════════════════════════════════════════════════════
function renderSavingsPace() {
    const paceEl = document.getElementById('goal-pace-info');
    if (!paceEl) return;

    const goals = STATE.savingsGoals || [];
    const goal = goals[0];
    if (!goal || goal.target <= 0) { paceEl.textContent = ''; return; }

    const remaining = Math.max(0, goal.target - (goal.savedAmount || 0));
    if (remaining <= 0) {
        paceEl.innerHTML = `<span style="color:var(--success);">🎉 Goal reached!</span>`;
        return;
    }

    // Avg daily deposit from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentDeposits = STATE.transactions.filter(t =>
        t.type === 'savings_deposit' &&
        t.payer === STATE.currentUser &&
        new Date(t.date) >= thirtyDaysAgo
    );
    const totalDeposited = recentDeposits.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = totalDeposited / 30;

    if (avgDaily >= 1) {
        const daysToGoal = Math.ceil(remaining / avgDaily);
        const color = daysToGoal <= 30 ? 'var(--success)' : daysToGoal <= 90 ? 'var(--gold)' : 'var(--text-muted)';
        const dot = daysToGoal <= 30 ? '🟢' : daysToGoal <= 90 ? '🟡' : '⚪';
        paceEl.innerHTML = `<span style="color:${color};">${dot} At this pace — goal in ~<strong>${daysToGoal} days</strong></span>`;
    } else {
        paceEl.innerHTML = `<span style="color:var(--text-muted);">Start depositing to see your savings pace</span>`;
    }
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 3 — AUTO-SAVE RULE (Settings)
// ═══════════════════════════════════════════════════════════
function renderAutoSaveUI() {
    const toggle = document.getElementById('auto-save-toggle');
    const config = document.getElementById('auto-save-config');
    const percentInput = document.getElementById('auto-save-percent');
    const percentLabel = document.getElementById('auto-save-percent-label');

    const as = STATE.autoSave || { enabled: false, percent: 20 };
    if (toggle) toggle.checked = as.enabled;
    if (config) config.style.display = as.enabled ? 'block' : 'none';
    if (percentInput) percentInput.value = as.percent || 20;
    if (percentLabel) percentLabel.textContent = as.percent || 20;
}

async function toggleAutoSave() {
    const toggle = document.getElementById('auto-save-toggle');
    const config = document.getElementById('auto-save-config');
    const enabled = toggle ? toggle.checked : false;

    STATE.autoSave = STATE.autoSave || { enabled: false, percent: 20 };
    STATE.autoSave.enabled = enabled;
    if (config) config.style.display = enabled ? 'block' : 'none';

    try {
        await db.collection('users').doc(STATE.currentUser).update({
            'autoSave.enabled': enabled,
            'autoSave.percent': STATE.autoSave.percent || 20
        });
        showToast(enabled ? 'Auto-Save turned on ✨' : 'Auto-Save turned off');
    } catch (e) { console.error('Auto-save toggle save failed:', e); }
}

function updateAutoSavePercent(val) {
    const label = document.getElementById('auto-save-percent-label');
    if (label) label.textContent = val;
    STATE.autoSave = STATE.autoSave || { enabled: true, percent: 20 };
    STATE.autoSave.percent = parseInt(val);

    clearTimeout(window._autoSaveDebounce);
    window._autoSaveDebounce = setTimeout(async () => {
        try {
            await db.collection('users').doc(STATE.currentUser).update({ 'autoSave.percent': parseInt(val) });
        } catch (e) { console.error('Auto-save percent save failed:', e); }
    }, 800);
}

async function applyAutoSave() {
    if (!STATE.autoSave || !STATE.autoSave.enabled) return;

    const goals = STATE.savingsGoals || [];
    // Find the first incomplete goal
    const activeGoal = goals.find(g => g.target > 0 && (g.savedAmount || 0) < g.target) || goals[0];
    if (!activeGoal || activeGoal.target <= 0) return;

    // Compute today's total spend
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let todaySpend = 0;
    let alreadyAutoSavedToday = false;

    STATE.transactions.forEach(t => {
        if (t.payer !== STATE.currentUser) return;
        const tDate = new Date(t.date);
        if (tDate < todayStart) return;

        if (t.type === 'expense' || t.type === 'split') {
            const amt = (t.type === 'split' && t.splitDetails) ? t.splitDetails.amountPerPerson : t.amount;
            todaySpend += amt;
        }
        if (t.type === 'savings_deposit' && t.desc && t.desc.startsWith('[Auto]')) {
            alreadyAutoSavedToday = true;
        }
    });

    if (alreadyAutoSavedToday) return; // One auto-save per day

    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyBudget = (STATE.settings.salaryAmount || 0) / totalDays;
    const surplus = dailyBudget - todaySpend;
    if (surplus <= 0) return;

    const autoAmt = Math.floor(surplus * ((STATE.autoSave.percent || 20) / 100) * 100) / 100;
    if (autoAmt < 1 || autoAmt > STATE.balance) return;

    try {
        await db.collection('transactions').add({
            payer: STATE.currentUser,
            desc: `[Auto] Swept to: ${activeGoal.title}`,
            amount: autoAmt,
            type: 'savings_deposit',
            goalId: activeGoal.id,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadData();
        showToast(`${formatCurrency(autoAmt)} auto-swept into savings ✨`);
    } catch (e) { console.error('Auto-save transaction failed:', e); }
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 4 — MULTI-GOAL MANAGER (Settings)
// ═══════════════════════════════════════════════════════════
function renderGoalsManager() {
    const container = document.getElementById('goals-list-container');
    if (!container) return;

    const goals = STATE.savingsGoals || [];
    const addBtn = document.getElementById('add-goal-btn');
    if (addBtn) addBtn.style.display = goals.length >= 3 ? 'none' : '';

    if (goals.length === 0) {
        container.innerHTML = `<div onclick="showAddGoalForm()" style="cursor:pointer;text-align:center;padding:20px 0;color:var(--primary);font-size:0.88rem;font-weight:700;">No goals yet — tap here to add one 🎯</div>`;
        return;
    }

    container.innerHTML = '';
    goals.forEach((goal, idx) => {
        const saved = goal.savedAmount || 0;
        const target = goal.target || 0;
        const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
        const remaining = Math.max(0, target - saved);
        const completed = pct >= 100;
        const isFirst = idx === 0;

        const div = document.createElement('div');
        div.className = 'goal-item';

        div.innerHTML = `
            <div class="goal-item-header">
                <span class="goal-item-title">${goal.title}${isFirst ? ' <span style="font-size:0.62rem;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">• Active</span>' : ''}</span>
                <div style="display:flex;gap:4px;">
                    ${isFirst
                        ? `<button onclick="toggleGoalEdit(${idx})" style="background:none;border:1px solid var(--border-color);color:var(--text-muted);cursor:pointer;font-size:0.78rem;padding:3px 8px;border-radius:6px;">✏️ Edit</button>`
                        : `<button onclick="deleteGoal(${idx})" class="goal-delete-btn">✕ Delete</button>`}
                </div>
            </div>
            <div class="goal-item-amounts">
                <span class="goal-saved">${formatCurrency(saved)}</span>
                <span class="goal-target-amt">of ${formatCurrency(target)}</span>
                ${completed ? '<span style="color:var(--success);font-weight:700;font-size:0.75rem;margin-left:4px;">✅</span>' : ''}
            </div>
            <div class="goal-progress-track" style="margin:6px 0 8px;">
                <div class="goal-progress-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--gold));"></div>
            </div>
            <div id="goal-edit-form-${idx}" style="display:none;margin-bottom:10px;padding:12px;background:var(--input-bg);border-radius:10px;border:1px solid var(--border-color);">
                <div class="input-group" style="margin-bottom:8px;"><label>Goal Name</label><input type="text" id="edit-goal-title-${idx}" value="${goal.title}" placeholder="e.g. New Earphones 🎧"/></div>
                <div class="input-group" style="margin-bottom:10px;"><label>Target (₹)</label><input type="number" id="edit-goal-target-${idx}" value="${target > 0 ? target : ''}"/></div>
                <button class="btn btn-primary" onclick="saveGoalEdit(${idx})" style="padding:8px 16px;font-size:0.8rem;width:auto;border-radius:10px;">Save Changes</button>
            </div>
            ${!completed
                ? `<div style="display:flex;gap:8px;margin-top:2px;">
                    <input type="number" id="deposit-input-${idx}" placeholder="₹ Deposit amount"
                        style="flex:2;padding:9px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--input-bg);color:var(--text-primary);font-size:0.85rem;font-family:inherit;font-weight:600;">
                    <button class="btn btn-secondary" onclick="depositToGoal(${idx})" style="flex:1;padding:9px;font-size:0.8rem;border-radius:10px;">Save 💰</button>
                   </div>`
                : `<div style="font-size:0.82rem;font-weight:700;color:var(--success);text-align:center;padding:8px 0;">🎉 Goal reached! Amazing work!</div>`}
            ${!completed && remaining > 0 ? `<div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;margin-top:6px;">${formatCurrency(remaining)} more to go</div>` : ''}
        `;

        container.appendChild(div);

        if (idx < goals.length - 1) {
            const sep = document.createElement('hr');
            sep.style.cssText = 'border:none;border-top:1px solid var(--border-color);margin:16px 0;';
            container.appendChild(sep);
        }
    });
}

function toggleGoalEdit(idx) {
    const form = document.getElementById(`goal-edit-form-${idx}`);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveGoalEdit(idx) {
    const titleInput = document.getElementById(`edit-goal-title-${idx}`);
    const targetInput = document.getElementById(`edit-goal-target-${idx}`);
    const title = titleInput ? titleInput.value.trim() : '';
    const target = parseFloat(targetInput ? targetInput.value : '');

    if (!title || isNaN(target) || target < 0) {
        showToast('Please enter a valid name and target amount.');
        return;
    }

    const goals = (STATE.savingsGoals || []).map(g => ({ id: g.id, title: g.title, target: g.target }));
    if (!goals[idx]) return;
    goals[idx] = { ...goals[idx], title, target };

    try {
        await db.collection('users').doc(STATE.currentUser).update({ savingsGoals: goals });
        await loadData();
        showToast('Goal updated! ✨');
    } catch (e) { showToast('Failed to save: ' + e.message); }
}

function showAddGoalForm() {
    const goals = STATE.savingsGoals || [];
    if (goals.length >= 3) {
        showToast('You can have up to 3 savings goals at a time.');
        return;
    }
    const form = document.getElementById('add-goal-form');
    if (form) form.style.display = 'block';
    const btn = document.getElementById('add-goal-btn');
    if (btn) btn.style.display = 'none';
}

function hideAddGoalForm() {
    const form = document.getElementById('add-goal-form');
    if (form) form.style.display = 'none';
    const titleInput = document.getElementById('new-goal-title');
    const targetInput = document.getElementById('new-goal-target');
    if (titleInput) titleInput.value = '';
    if (targetInput) targetInput.value = '';
    const btn = document.getElementById('add-goal-btn');
    if (btn) btn.style.display = '';
}

async function addGoal() {
    const titleInput = document.getElementById('new-goal-title');
    const targetInput = document.getElementById('new-goal-target');
    const title = titleInput ? titleInput.value.trim() : '';
    const target = parseFloat(targetInput ? targetInput.value : '');

    if (!title || isNaN(target) || target <= 0) {
        showToast('Please enter a goal name and a target amount.');
        return;
    }

    const currentGoals = STATE.savingsGoals || [];

    // If we have only the placeholder goal (no target, legacy id), replace it
    if (currentGoals.length === 1 && currentGoals[0].id === 'g_legacy' && currentGoals[0].target === 0) {
        const updated = [{ id: 'g_legacy', title, target }];
        try {
            await db.collection('users').doc(STATE.currentUser).update({ savingsGoals: updated });
            hideAddGoalForm();
            await loadData();
            showToast(`Goal "${title}" created! 🎯`);
        } catch (e) { showToast('Failed to create goal: ' + e.message); }
        return;
    }

    if (currentGoals.length >= 3) {
        showToast('You can have up to 3 savings goals at a time.');
        return;
    }

    const newGoal = { id: 'g_' + Date.now(), title, target };
    const newGoals = [...currentGoals.map(g => ({ id: g.id, title: g.title, target: g.target })), newGoal];

    try {
        await db.collection('users').doc(STATE.currentUser).update({ savingsGoals: newGoals });
        hideAddGoalForm();
        await loadData();
        showToast(`Goal "${title}" created! 🎯`);
    } catch (e) { showToast('Failed to create goal: ' + e.message); }
}

async function depositToGoal(idx) {
    const input = document.getElementById(`deposit-input-${idx}`);
    const amount = parseFloat(input ? input.value : '');

    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid deposit amount.');
        return;
    }
    if (amount > STATE.balance) {
        showToast('Insufficient wallet balance.');
        return;
    }

    const goal = (STATE.savingsGoals || [])[idx];
    if (!goal) return;

    try {
        await db.collection('transactions').add({
            payer: STATE.currentUser,
            desc: `Deposit to: ${goal.title}`,
            amount,
            type: 'savings_deposit',
            goalId: goal.id,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (input) input.value = '';
        await loadData();
        showToast(`${formatCurrency(amount)} saved toward "${goal.title}" ✨`);
    } catch (e) { showToast('Deposit failed: ' + e.message); }
}

async function deleteGoal(idx) {
    const goals = STATE.savingsGoals || [];
    const goal = goals[idx];
    if (!goal) return;

    if (goals.length <= 1) {
        showToast("Can't delete your only goal — edit it instead.");
        return;
    }

    const savedAmt = goal.savedAmount || 0;
    if (!confirm(`Delete "${goal.title}"?${savedAmt > 0 ? ` Your ${formatCurrency(savedAmt)} deposit will be returned to your wallet.` : ''}`)) return;

    const newGoals = goals.filter((_, i) => i !== idx).map(g => ({ id: g.id, title: g.title, target: g.target }));

    try {
        const batch = db.batch();
        if (savedAmt > 0) {
            const txRef = db.collection('transactions').doc();
            batch.set(txRef, {
                payer: STATE.currentUser,
                desc: `Returned from: ${goal.title}`,
                amount: savedAmt,
                type: 'income',
                date: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        batch.update(db.collection('users').doc(STATE.currentUser), { savingsGoals: newGoals });
        await batch.commit();
        await loadData();
        showToast(savedAmt > 0 ? `Goal deleted. ${formatCurrency(savedAmt)} returned to wallet.` : `"${goal.title}" deleted.`);
    } catch (e) { showToast('Failed to delete goal: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 5 — MONTHLY SAVINGS RATE BADGE (Reports)
// ═══════════════════════════════════════════════════════════
function renderSavingsRateBadge() {
    const el = document.getElementById('report-savings-rate');
    if (!el) return;

    const filterEl = document.getElementById('reports-filter');
    const filterVal = filterEl ? filterEl.value : 'this_month';
    const now = new Date();
    let startDate, endDate;

    if (filterVal === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterVal === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else {
        startDate = new Date(0);
        endDate = new Date(8640000000000000);
    }

    let income = 0, expense = 0;
    STATE.transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate < startDate || tDate > endDate) return;
        if (t.type === 'income' || t.type === 'salary' || (t.type === 'repayment' && t.friend === STATE.currentUser)) {
            income += t.amount;
        } else if (t.payer === STATE.currentUser) {
            if (t.type === 'expense' || t.type === 'lend') {
                expense += t.amount;
            } else if (t.type === 'split' && t.splitDetails) {
                expense += t.splitDetails.amountPerPerson;
            } else if (t.type === 'repayment' && t.payer === STATE.currentUser) {
                expense += t.amount;
            }
        }
    });

    if (income === 0) {
        el.innerHTML = `<span class="savings-rate-badge rate-neutral">No income logged</span>`;
        return;
    }

    const rate = Math.round(((income - expense) / income) * 100);
    const clampedRate = Math.max(-99, Math.min(100, rate));
    let badgeClass, emoji;
    if (clampedRate >= 20)      { badgeClass = 'rate-good'; emoji = '📈'; }
    else if (clampedRate >= 10) { badgeClass = 'rate-ok';   emoji = '📊'; }
    else                        { badgeClass = 'rate-low';  emoji = '📉'; }

    el.innerHTML = `<span class="savings-rate-badge ${badgeClass}">${clampedRate}% ${emoji}</span>`;
}

// Expose new functions to window for inline event handlers
window.showAddGoalForm = showAddGoalForm;
window.hideAddGoalForm = hideAddGoalForm;
window.addGoal = addGoal;
window.depositToGoal = depositToGoal;
window.deleteGoal = deleteGoal;
window.toggleGoalEdit = toggleGoalEdit;
window.saveGoalEdit = saveGoalEdit;
window.toggleAutoSave = toggleAutoSave;
window.updateAutoSavePercent = updateAutoSavePercent;

