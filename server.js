const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serving static files from the project directory
app.use(express.static(__dirname));

// MongoDB connection setup (fallback to local if MONGODB_URI not in env)
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pocketsafe';
mongoose.connect(mongoURI)
    .then(() => console.log(`Successfully connected to MongoDB at: ${mongoURI}`))
    .catch(err => console.error('MongoDB connection error:', err));

// --- SCHEMAS & MODELS ---

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    settings: {
        salaryAmount: { type: Number, default: 3000 },
        salaryDate: { type: Number, default: 1 },
        lastSalaryMonth: { type: String, default: null }
    },
    savingsGoal: {
        title: { type: String, default: "Set a savings goal! 🎯" },
        target: { type: Number, default: 0 }
    },
    friends: [{ type: String }] // array of usernames
});

const User = mongoose.model('User', UserSchema);

const TransactionSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    desc: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true }, // 'expense', 'income', 'lend', 'repayment', 'split', 'savings_deposit', 'salary'
    payer: { type: String, required: true }, // username who paid
    friend: { type: String, default: null }, // username of friend (for lend/repayment)
    splitDetails: {
        totalParticipants: { type: Number },
        amountPerPerson: { type: Number },
        involvedUsernames: [{ type: String }],
        includedMe: { type: Boolean }
    }
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

// --- API ENDPOINTS ---

// Server health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected' });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Please enter all fields' });
        }
        
        const existing = await User.findOne({ username: username.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const newUser = new User({
            username: username.toLowerCase(),
            password: password // simple plain text password matching localStorage baseline
        });
        await newUser.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase(), password });
        if (user) {
            res.json({ success: true, username: user.username });
        } else {
            res.status(400).json({ error: 'Invalid username or password' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fetch user data package (transactions, friends, calculated balances)
app.get('/api/user/state', async (req, res) => {
    try {
        const username = req.query.username.toLowerCase();
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Fetch transactions involving user (either they paid, they split, or it's a direct lend/repay to them)
        const transactions = await Transaction.find({
            $or: [
                { payer: username },
                { friend: username },
                { 'splitDetails.involvedUsernames': username }
            ]
        }).sort({ date: -1 });

        // Calculate balances dynamically for each friend
        const friendsList = [];
        for (const fName of user.friends) {
            // Find all transactions involving current user and this specific friend
            const relativeTxs = await Transaction.find({
                $or: [
                    { payer: username, friend: fName },
                    { payer: fName, friend: username },
                    { payer: username, type: 'split', 'splitDetails.involvedUsernames': fName },
                    { payer: fName, type: 'split', 'splitDetails.involvedUsernames': username }
                ]
            });

            let debtBalance = 0; // Positive: friend owes user, Negative: user owes friend
            relativeTxs.forEach(t => {
                if (t.type === 'lend') {
                    if (t.payer === username) debtBalance += t.amount;
                    else debtBalance -= t.amount;
                } else if (t.type === 'repayment') {
                    if (t.payer === fName) debtBalance -= t.amount; // friend paid user back
                    else debtBalance += t.amount; // user paid friend back
                } else if (t.type === 'split' && t.splitDetails) {
                    if (t.payer === username) {
                        debtBalance += t.splitDetails.amountPerPerson; // friend owes user their share
                    } else {
                        debtBalance -= t.splitDetails.amountPerPerson; // user owes friend their share
                    }
                }
            });

            // Find friend metadata
            const friendProfile = await User.findOne({ username: fName });
            friendsList.push({
                id: friendProfile ? friendProfile._id : Date.now(),
                name: fName,
                balance: debtBalance
            });
        }

        // Calculate wallet balance dynamically
        // + allowances, + external incomes, - personal expenses, - lends made, - savings deposits, - split bills paid, - repayments paid, + repayments received
        const walletTxs = await Transaction.find({
            $or: [
                { payer: username },
                { friend: username, type: 'repayment' }
            ]
        });

        let walletBalance = 0;
        let savingsTotal = 0;

        walletTxs.forEach(t => {
            if (t.payer === username) {
                if (t.type === 'income' || t.type === 'salary') {
                    walletBalance += t.amount;
                } else if (t.type === 'expense' || t.type === 'lend' || t.type === 'savings_deposit' || t.type === 'split') {
                    walletBalance -= t.amount;
                } else if (t.type === 'repayment') {
                    walletBalance -= t.amount; // Repaid someone else
                }

                if (t.type === 'savings_deposit') {
                    savingsTotal += t.amount;
                }
            } else if (t.friend === username && t.type === 'repayment') {
                walletBalance += t.amount; // Repayment received
            }
        });

        // Ensure savingsGoal state is synced
        const goalState = {
            title: user.savingsGoal.title || "Set a savings goal! 🎯",
            target: user.savingsGoal.target || 0,
            current: savingsTotal
        };

        res.json({
            settings: user.settings,
            savingsGoal: goalState,
            friends: friendsList,
            transactions: transactions,
            balance: walletBalance
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Allowance Settings
app.post('/api/user/settings', async (req, res) => {
    try {
        const { username, salaryAmount, salaryDate, lastSalaryMonth } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (salaryAmount !== undefined) user.settings.salaryAmount = salaryAmount;
        if (salaryDate !== undefined) user.settings.salaryDate = salaryDate;
        if (lastSalaryMonth !== undefined) user.settings.lastSalaryMonth = lastSalaryMonth;

        await user.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Savings Goal Config
app.post('/api/user/goal', async (req, res) => {
    try {
        const { username, title, target } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (title !== undefined) user.savingsGoal.title = title;
        if (target !== undefined) user.savingsGoal.target = target;

        await user.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add New Friend / Roommate Profile Linkage
app.post('/api/friends/add', async (req, res) => {
    try {
        const { username, friendUsername } = req.body;
        const targetFriend = friendUsername.toLowerCase().trim();

        if (username.toLowerCase() === targetFriend) {
            return res.status(400).json({ error: "You cannot add yourself as a roommate!" });
        }

        const friendUser = await User.findOne({ username: targetFriend });
        if (!friendUser) {
            return res.status(404).json({ error: `Username "${friendUsername}" does not exist. Ask them to register first!` });
        }

        const currentUser = await User.findOne({ username: username.toLowerCase() });
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        // Add to current user's list
        if (!currentUser.friends.includes(targetFriend)) {
            currentUser.friends.push(targetFriend);
            await currentUser.save();
        }

        // Add to friend's list (mutual linking)
        if (!friendUser.friends.includes(username.toLowerCase())) {
            friendUser.friends.push(username.toLowerCase());
            await friendUser.save();
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add Transaction (expense, income, split, lend, repayment, savings)
app.post('/api/transactions', async (req, res) => {
    try {
        const { username, desc, amount, type, friend, splitDetails } = req.body;

        const newTx = new Transaction({
            desc,
            amount,
            type,
            payer: username.toLowerCase(),
            friend: friend ? friend.toLowerCase() : null
        });

        if (type === 'split' && splitDetails) {
            newTx.splitDetails = {
                totalParticipants: splitDetails.totalParticipants,
                amountPerPerson: splitDetails.amountPerPerson,
                involvedUsernames: splitDetails.involvedUsernames.map(u => u.toLowerCase()),
                includedMe: splitDetails.includedMe
            };
        }

        await newTx.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`PocketSafe collaborative server is listening on port ${PORT}`);
});
