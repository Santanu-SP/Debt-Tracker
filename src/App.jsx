import { useState, useEffect, useRef } from 'react';
import SplashScreen from './components/SplashScreen';

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const appJsLoaded = useRef(false);

  useEffect(() => {
    // Expose a global callback so app.js can signal React to dismiss the splash
    window.__hideSplashReact = () => {
      setSplashVisible(false);
    };

    // Dynamically load app.js after React mounts so it can access the DOM
    if (!appJsLoaded.current) {
      appJsLoaded.current = true;
      const script = document.createElement('script');
      script.src = import.meta.env.BASE_URL + 'app.js';
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      {/* Premium animated splash — managed by React state */}
      <SplashScreen isVisible={splashVisible} />

      {/* App shell — identical HTML structure to original index.html */}
      <div className="app-shell">

        {/* ═══════════════════════════ AUTH VIEW ═══════════════════════════ */}
        <div id="auth-view" style={{ display: 'none', padding: '32px 20px', overflowY: 'auto', height: '100%' }}>
          <header style={{ flexDirection: 'column', textAlign: 'center', marginBottom: 28, gap: 8 }}>
            <img
              src="assets/logo.png"
              alt="PocketSafe Logo"
              style={{ width: 84, height: 84, borderRadius: 22, boxShadow: '0 12px 32px rgba(22,163,74,0.28)', margin: '0 auto 10px', display: 'block', objectFit: 'cover' }}
            />
            <div className="logo-text-lg" style={{ marginTop: 8 }}>
              <span className="word-pocket">Pocket</span><span className="word-safe">Safe</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, marginTop: 4 }}>Your personal money diary 🌱</p>
          </header>

          {/* Login Form */}
          <div id="login-form" className="card">
            <h2 style={{ textAlign: 'center', marginBottom: 4, fontSize: '1.1rem' }}>Welcome Back 👋</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 20, fontWeight: 500 }}>Log in to see your spending snapshot</p>
            <div className="input-group">
              <label>Username</label>
              <input type="text" id="login-username" placeholder="e.g. rahul_123" autoComplete="username" />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" id="login-password" placeholder="Your secret password" autoComplete="current-password" />
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', cursor: 'pointer', letterSpacing: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <input type="checkbox" id="login-remember" style={{ width: 'auto', height: 'auto', accentColor: 'var(--primary)' }} defaultChecked />
                Keep me signed in
              </label>
            </div>
            <button className="btn btn-primary" onClick={() => window.handleLogin()}>Sign In</button>

            <div id="google-signin-container" style={{ marginTop: 16 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, marginBottom: 12, position: 'relative' }}>
                <span style={{ background: 'var(--card-bg)', padding: '0 10px', position: 'relative', zIndex: 2 }}>or continue with</span>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--border-color)', zIndex: 1 }}></div>
              </div>
              <button className="btn btn-secondary" onClick={() => window.loginWithGoogle()} style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 'var(--radius-md)', fontWeight: 700, alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '0.85rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 4 }}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
            </div>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              New here? <a href="#" onClick={(e) => { e.preventDefault(); window.toggleAuthMode('register'); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>Create your profile</a>
            </p>
          </div>

          {/* Register Form */}
          <div id="register-form" className="card" style={{ display: 'none' }}>
            <h2 style={{ textAlign: 'center', marginBottom: 4, fontSize: '1.1rem' }}>Create Your Profile</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 20, fontWeight: 500 }}>Takes less than a minute to set up</p>
            <div className="input-group">
              <label>Pick a Username</label>
              <input type="text" id="reg-username" placeholder="e.g. arjun_budget" autoComplete="username" />
            </div>
            <div className="input-group">
              <label>Create a Password</label>
              <input type="password" id="reg-password" placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <input type="password" id="reg-confirm-password" placeholder="Repeat your password" autoComplete="new-password" />
            </div>
            <button className="btn btn-primary" onClick={() => window.handleRegister()}>Create Account</button>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); window.toggleAuthMode('login'); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>Sign In</a>
            </p>
          </div>
        </div>

        {/* ═══════════════════════════ MAIN APP VIEW ═══════════════════════════ */}
        <div id="app-view" style={{ display: 'none' }}>
          <div className="app-container">

            {/* App Header */}
            <header>
              <div className="logo-badge" onClick={() => window.showProfileModal()}>
                <img src="assets/logo.png" alt="Logo" />
                <div className="logo-text">
                  <span className="word-pocket">Pocket</span><span className="word-safe">Safe</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="icon-btn" onClick={() => window.toggleTheme()} id="theme-toggle" title="Toggle dark/light mode">
                  <svg id="icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ display: 'none', width: 17, height: 17 }}>
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                  <svg id="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 17, height: 17 }}>
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                </button>
                <div className="user-pill" id="user-profile-badge" onClick={() => window.showProfileModal()}>
                  <div className="user-pill-avatar" id="user-pill-avatar-img">👤</div>
                  <span id="user-display-name">...</span>
                </div>
              </div>
            </header>

            {/* ─── 1. DASHBOARD VIEW ─── */}
            <div id="view-dashboard" className="view active">

              {/* Username reminder banner */}
              <div
                id="username-reminder-banner"
                style={{ display: 'none', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', padding: '10px 14px', marginBottom: 10, borderRadius: 'var(--radius-md)', alignItems: 'center', gap: 10, fontSize: '0.78rem', fontWeight: 600, color: '#92400e', cursor: 'pointer' }}
                onClick={() => window.showProfileModal()}
              >
                <span>👋 Set a username so friends can find and split bills with you</span>
              </div>

              {/* Budget Gauge Card */}
              <div className="card">
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Today's Budget Health</div>
                <div className="budget-gauge">
                  <div className="gauge-circle" id="budget-progress-dial">
                    <div className="gauge-content">
                      <div className="gauge-amount" id="safe-to-spend">₹0.00</div>
                      <div className="gauge-label">Safe to Spend</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10, fontWeight: 500, padding: '5px 12px', background: 'var(--input-bg)', borderRadius: 'var(--radius-pill)' }}>
                    Daily budget left = Wallet ÷ Days remaining this month
                  </div>
                  <div className="budget-stats">
                    <div className="budget-stat-item">
                      <div className="budget-stat-val" id="parent-allowance">₹0.00</div>
                      <div className="budget-stat-lbl">Monthly Allowance</div>
                    </div>
                    <div className="budget-stat-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: 20 }}>
                      <div className="budget-stat-val" id="total-wallet">₹0.00</div>
                      <div className="budget-stat-lbl">Wallet Balance</div>
                    </div>
                    <div className="budget-stat-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: 20 }}>
                      <div className="budget-stat-val stat-gold" id="saved-money">₹0.00</div>
                      <div className="budget-stat-lbl">Saved So Far</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Log Card */}
              <div className="card">
                <h2 style={{ marginBottom: 4 }}>Log a Spend</h2>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 10 }}>Enter an amount or tap a shortcut below</p>
                <div className="quick-log-wrapper">
                  <div className="quick-log-input-group">
                    <span style={{ position: 'absolute', left: 16, top: 13, fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-muted)' }}>₹</span>
                    <input type="number" id="quick-amount" placeholder="0.00" className="quick-amount-input" style={{ paddingLeft: 36 }} />
                    <button className="btn btn-primary" onClick={() => window.handleQuickAdd()} style={{ width: 'auto', padding: '12px 18px', borderRadius: 14 }}>Log</button>
                  </div>
                  <div id="quick-split-section" style={{ marginTop: 4 }}>
                    <div className="roommate-bubbles-label">Split with (tap to select):</div>
                    <div className="roommate-bubbles-container" id="quick-split-bubbles"></div>
                  </div>
                  <div className="quick-chips-scroll">
                    <button className="quick-chip" onClick={() => window.quickLogTemplate('Tea ☕', 20)}>☕ ₹20 Tea</button>
                    <button className="quick-chip" onClick={() => window.quickLogTemplate('Maggi 🍜', 50)}>🍜 ₹50 Maggi</button>
                    <button className="quick-chip" onClick={() => window.quickLogTemplate('Auto 🛺', 40)}>🛺 ₹40 Auto</button>
                    <button className="quick-chip" onClick={() => window.quickLogTemplate('Canteen 🍛', 120)}>🍛 ₹120 Lunch</button>
                    <button className="quick-chip" onClick={() => window.quickLogTemplate('Xerox 📚', 30)}>📚 ₹30 Xerox</button>
                  </div>
                </div>
              </div>

              {/* Savings Goal Card */}
              <div className="card" id="savings-goal-card" style={{ cursor: 'pointer' }} onClick={() => window.switchView('view-settings', document.querySelector(".nav-item[data-target='view-settings']"))}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Savings Goal</div>
                <div className="goal-header">
                  <span className="goal-title" id="goal-title-display">Goal: New Earphones 🎧</span>
                  <span className="goal-values" id="goal-progress-values">₹0 / ₹0</span>
                </div>
                <div className="goal-progress-track">
                  <div className="goal-progress-bar" id="goal-progress-bar" style={{ background: 'linear-gradient(90deg, #047857, #d97706)' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="goal-meta" id="goal-days-status">Spend less than usual to build savings</span>
                  <span style={{ fontSize: '0.73rem', color: 'var(--primary)', fontWeight: 700 }}>Edit →</span>
                </div>
              </div>

              {/* Recent Activity Card */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ marginBottom: 0 }}>Recent Activity</h2>
                  <span id="quick-settlement-alert" style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--primary)' }}></span>
                </div>
                <ul className="transaction-list" id="recent-transactions">
                  <li className="list-item" style={{ color: 'var(--text-secondary)', justifyContent: 'center', fontSize: '0.88rem', padding: '20px 0' }}>
                    <span>No transactions yet — tap + to add one!</span>
                  </li>
                </ul>
                <button className="btn btn-secondary" style={{ marginTop: 12, padding: 10, fontSize: '0.85rem' }} onClick={() => window.showHistoryView()}>View Full History</button>
              </div>
            </div>

            {/* ─── 2. HISTORY VIEW ─── */}
            <div id="view-history" className="view">
              <header style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => window.switchView('view-dashboard', document.querySelector(".nav-item[data-target='view-dashboard']"))} style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 6px' }}>←</button>
                  <h2 style={{ margin: 0 }}>Transaction History</h2>
                </div>
              </header>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
                  <select id="history-filter" onChange={() => window.renderHistoryView()} style={{ padding: 10, borderRadius: 12, flex: 1 }}>
                    <option value="30days">Last 30 Days</option>
                    <option value="1year">Last 1 Year</option>
                    <option value="all">All Time</option>
                  </select>
                  <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 14px', borderRadius: 12, fontSize: '0.82rem', flexShrink: 0 }} onClick={() => window.exportHistoryToCSV()}>Export CSV</button>
                </div>
                <ul className="transaction-list" id="history-list"></ul>
              </div>
            </div>

            {/* ─── 3. REPORTS VIEW ─── */}
            <div id="view-reports" className="view">
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ margin: 0 }}>Money Report</h2>
                  <select id="reports-filter" onChange={() => window.renderReports()} style={{ width: 'auto', padding: 8, borderRadius: 10, fontSize: '0.82rem' }}>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
                <div style={{ textAlign: 'center', marginBottom: 14, color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }} id="reports-date-display"></div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-label">Money In</div>
                    <div className="stat-value text-success" id="report-income">₹0.00</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Money Out</div>
                    <div className="stat-value text-danger" id="report-expense">₹0.00</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Saved</div>
                    <div className="stat-value" id="report-savings" style={{ color: 'var(--gold)' }}>₹0.00</div>
                  </div>
                </div>
                <div className="tip-box">
                  <strong>Money In</strong> = allowance + extra income &nbsp;·&nbsp; <strong>Money Out</strong> = all your expenses &nbsp;·&nbsp; <strong>Saved</strong> = what's left over
                </div>
              </div>
              <div className="card">
                <h2>Monthly Cash Flow</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 10 }}>Each bar = one month's spending vs income</p>
                <div className="bar-chart-container" id="bar-chart-container"></div>
              </div>
              <div className="card">
                <h2>Where Your Money Goes</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>Top expense categories this period</p>
                <div className="chart-donut-wrapper">
                  <div id="category-donut" className="donut-chart"></div>
                  <div id="category-legend" className="donut-legend"></div>
                </div>
              </div>
            </div>

            {/* ─── 4. FRIENDS / SPLIT VIEW ─── */}
            <div id="view-friends" className="view">
              <div className="card">
                <h2>Split & Settle</h2>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 14 }}>Track who owes you money from shared expenses</p>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Others Owe You</div>
                  <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--success)', fontFamily: "'Nunito', sans-serif" }} id="total-owed">₹0.00</span>
                </div>
                <ul className="friend-list" id="friends-list"></ul>
                <button className="btn btn-primary" onClick={() => window.showAddFriendModal()} style={{ marginTop: 14 }}>Add Roommate / Friend</button>
              </div>
            </div>

            {/* ─── 5. SETTINGS VIEW ─── */}
            <div id="view-settings" className="view">
              {/* Allowance Setup */}
              <div className="card">
                <h2>Monthly Allowance</h2>
                <div className="tip-box" style={{ marginBottom: 14 }}>
                  PocketSafe uses your allowance to calculate your <strong>daily safe-to-spend budget</strong>. This tells you how much you can spend each day without running out of money before the month ends.
                </div>
                <div className="input-group">
                  <label>Allowance Amount (₹ per month)</label>
                  <input type="number" id="salary-input" placeholder="e.g. 8000 — leave blank if no allowance" />
                </div>
                <div className="input-group">
                  <label>Which date do you receive it?</label>
                  <select id="salary-date"></select>
                </div>
                <button className="btn btn-primary" id="save-salary-btn">Save Allowance</button>
              </div>

              {/* Savings Goal Setup */}
              <div className="card">
                <h2>Savings Goal</h2>
                <div className="tip-box" style={{ marginBottom: 14 }}>
                  Set a goal like "New Phone 📱 — ₹15,000". Deposit small amounts regularly and watch the progress bar fill up!
                </div>
                <div className="input-group"><label>What are you saving for?</label><input type="text" id="goal-title-input" placeholder="e.g. New Earphones 🎧, Trip to Goa" /></div>
                <div className="input-group"><label>Target Amount (₹)</label><input type="number" id="goal-target-input" placeholder="e.g. 5000" /></div>
                <div className="input-group"><label>Add Money to Goal (₹) — deducted from Wallet</label><input type="number" id="goal-deposit-input" placeholder="How much to deposit now?" /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => window.depositToSavings()} style={{ flex: 1 }}>Deposit</button>
                  <button className="btn btn-primary" onClick={() => window.saveSavingsGoal()} style={{ flex: 2 }}>Save Goal</button>
                </div>
              </div>

              {/* Data Management */}
              <div className="card">
                <h2>Data</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => window.loadDemoData()}>Load Sample Data (Demo)</button>
                  <button className="btn btn-danger" onClick={() => window.clearAllData()}>Reset All Data</button>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Bottom Navigation ─── */}
          <nav className="bottom-nav">
            <a href="#" className="nav-item active" data-target="view-dashboard" onClick={(e) => { e.preventDefault(); window.switchView('view-dashboard', e.currentTarget); }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
              <span>Home</span>
            </a>
            <a href="#" className="nav-item" data-target="view-friends" onClick={(e) => { e.preventDefault(); window.switchView('view-friends', e.currentTarget); }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A3.375 3.375 0 0111.625 22.5h-1.25a3.375 3.375 0 01-3.375-3.263v-.114m0-10.464a3 3 0 110-6 3 3 0 010 6zm6 0a3 3 0 110-6 3 3 0 010 6zM3.375 7.5h.008v.008H3.375V7.5zm0 3h.008v.008H3.375v-.008zm0 3h.008v.008H3.375v-.008z" /></svg>
              <span>Splits</span>
            </a>
            <a href="#" className="nav-item" data-target="view-reports" onClick={(e) => { e.preventDefault(); window.switchView('view-reports', e.currentTarget); }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>
              <span>Reports</span>
            </a>
            <a href="#" className="nav-item" data-target="view-settings" onClick={(e) => { e.preventDefault(); window.switchView('view-settings', e.currentTarget); }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827a1.125 1.125 0 01.26 1.43l-1.297 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span>Setup</span>
            </a>
          </nav>

          {/* FAB — Add Transaction */}
          <button className="fab" id="add-transaction-btn" onClick={() => window.showTransactionModal()} title="Add new transaction">+</button>
        </div>

        {/* ═══════════════════════════ MODAL OVERLAYS ═══════════════════════════ */}

        {/* 1. Transaction Modal */}
        <div id="modal-transaction" className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: 4 }}>New Transaction</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 16 }}>Log what you spent or received</p>
            <div className="input-group"><label>What was it for?</label><input type="text" id="t-desc" placeholder="e.g. Canteen Lunch, Bus fare" /></div>
            <div className="input-group"><label>Amount (₹)</label><input type="number" id="t-amount" placeholder="0.00" /></div>
            <div className="input-group">
              <label>Type of Transaction</label>
              <select id="t-type">
                <option value="expense">Personal Expense (money I spent)</option>
                <option value="income">Income (extra money I received)</option>
                <option value="lend">I Paid for a Friend (lend)</option>
                <option value="repayment">Friend Paid Me Back</option>
                <option value="split">Split Bill (shared expense)</option>
              </select>
            </div>
            <div className="input-group" id="friend-selector-group" style={{ display: 'none' }}>
              <label>Which Friend?</label>
              <select id="t-friend-select"></select>
            </div>
            <div className="input-group" id="split-selector-group" style={{ display: 'none' }}>
              <label style={{ marginBottom: 8, display: 'block' }}>Who's in on this split?</label>
              <div style={{ border: '1px solid var(--border-color)', padding: 10, borderRadius: 12, maxHeight: 150, overflowY: 'auto', background: 'var(--input-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <input type="checkbox" id="split-include-me" defaultChecked style={{ width: 18, height: 18, marginRight: 8, accentColor: 'var(--primary)' }} />
                  <label htmlFor="split-include-me" style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>Me (I paid)</label>
                </div>
                <div id="split-friends-list"></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => window.closeModals()} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => window.addTransaction()} style={{ flex: 2 }}>Save Transaction</button>
            </div>
          </div>
        </div>

        {/* 2. Add Friend Modal */}
        <div id="modal-friend" className="modal-overlay">
          <div className="modal-content" style={{ bottom: 'auto', top: '30%', width: '90%', margin: '0 auto', borderRadius: 'var(--radius-lg)', position: 'relative' }}>
            <h2 style={{ marginBottom: 4 }}>Add Roommate / Friend</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 16 }}>Enter their PocketSafe username or email to connect</p>
            <div className="input-group"><label>Their Username or Email</label><input type="text" id="f-name" placeholder="e.g. priya_wallet or priya@gmail.com" /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => window.closeModals()} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => window.addFriend()} style={{ flex: 1 }}>Add</button>
            </div>
          </div>
        </div>

        {/* 3. Onboarding / First-time Guide Modal */}
        <div id="modal-onboarding" className="modal-overlay" style={{ display: 'none', background: 'rgba(0,0,0,0.80)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal-content" style={{ bottom: 'auto', top: '8%', width: '92%', margin: '0 auto', borderRadius: 'var(--radius-xl)', position: 'relative', padding: '24px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: '2rem', marginBottom: 4 }}>🌱</div>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 4 }}>Welcome to PocketSafe!</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>Let's set up your wallet in 30 seconds. You can always change these later.</p>
            </div>

            {/* How it works mini-guide */}
            <div style={{ background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>How PocketSafe works</div>
              <div className="onboard-feature-row">
                <div className="onboard-feature-icon">💰</div>
                <div className="onboard-feature-text">
                  <div className="onboard-feature-title">Set your wallet balance</div>
                  <div className="onboard-feature-desc">Tell us how much money you have right now. We'll track it as you spend.</div>
                </div>
              </div>
              <div className="onboard-feature-row">
                <div className="onboard-feature-icon">📅</div>
                <div className="onboard-feature-text">
                  <div className="onboard-feature-title">Add your monthly allowance</div>
                  <div className="onboard-feature-desc">We'll calculate your safe daily budget = wallet ÷ days left in month.</div>
                </div>
              </div>
              <div className="onboard-feature-row">
                <div className="onboard-feature-icon">🎯</div>
                <div className="onboard-feature-text">
                  <div className="onboard-feature-title">Log spends &amp; build savings</div>
                  <div className="onboard-feature-desc">Tap + to log what you spend. Stay under your daily limit to save money!</div>
                </div>
              </div>
            </div>

            <div className="input-group"><label>How much is in your wallet right now? (₹)</label><input type="number" id="onboard-balance" placeholder="e.g. 3500" min="0" /></div>
            <div className="input-group"><label>Monthly Allowance / Pocket Money (₹) — optional</label><input type="number" id="onboard-allowance" placeholder="e.g. 8000" min="0" /></div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label>On which date do you receive it?</label>
              <select id="onboard-allowance-date"></select>
            </div>
            <button className="btn btn-primary" onClick={() => window.submitOnboarding()} style={{ width: '100%', padding: 13, fontWeight: 700 }}>Start Tracking!</button>
          </div>
        </div>

        {/* 4. Profile Modal */}
        <div id="modal-profile" className="modal-overlay" style={{ display: 'none', background: 'rgba(0,0,0,0.80)', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div className="modal-content" style={{ bottom: 'auto', top: '8%', width: '92%', margin: '0 auto', borderRadius: 'var(--radius-xl)', position: 'relative', padding: 24, maxHeight: '82vh', overflowY: 'auto' }}>
            
            {/* Top Close Shortcut */}
            <button 
              className="close-modal-btn" 
              onClick={() => window.closeModals()}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: '800',
                fontSize: '0.85rem',
                zIndex: 10,
                transition: 'all var(--ease-out)'
              }}
              title="Close modal"
            >
              ✕
            </button>

            <h2 style={{ marginBottom: 4, textAlign: 'center', fontSize: '1.1rem' }}>My Profile</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center', marginBottom: 16 }}>Your account details and preferences</p>

            <div style={{ fontSize: '0.75rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Account: <span id="profile-email-display" style={{ color: 'var(--text-muted)' }}>...</span></div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>User ID: <span id="profile-id-display" style={{ color: 'var(--text-muted)' }}>...</span></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
              <div id="profile-avatar-preview" style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', border: '2.5px solid var(--primary)', overflow: 'hidden', objectFit: 'cover', color: 'var(--text-secondary)', marginBottom: 10 }}>👤</div>
              <input type="file" id="profile-upload" accept="image/*" style={{ display: 'none' }} onChange={(e) => window.handleImageUpload(e)} />
              <button className="btn btn-secondary" onClick={() => document.getElementById('profile-upload').click()} style={{ width: 'auto', padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 8 }}>Change Photo</button>
            </div>

            <div className="input-group"><label>Your Username (friends use this to add you)</label><input type="text" id="profile-username" placeholder="e.g. rahul_wallet" /></div>
            <div className="input-group"><label>Mobile Number (optional)</label><input type="tel" id="profile-phone" placeholder="+91 98765 43210" /></div>
            <div className="input-group" style={{ marginBottom: 20 }}><label>Room / Address (optional)</label><input type="text" id="profile-room" placeholder="e.g. Room 204-B" /></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => window.saveProfile()} style={{ width: '100%', padding: 12, fontWeight: 700 }}>Save Profile</button>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button className="btn btn-secondary" onClick={() => window.closeModals()} style={{ flex: 1, padding: 10 }}>Close</button>
                <button className="btn btn-danger" onClick={() => window.handleLogout()} style={{ flex: 1, padding: 10 }}>Logout</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
