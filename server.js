const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(session({
  secret: 'club-manager-secret',
  resave: false,
  saveUninitialized: false
}));

// Serve everything inside /public (html, css, js)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Block API access when not logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }
  next();
}

app.use('/auth', require('./routes/auth'));
app.use('/dashboard-data', requireLogin, require('./routes/dashboard'));
app.use('/players', requireLogin, require('./routes/players'));
app.use('/squad', requireLogin, require('./routes/squad'));
app.use('/matches', requireLogin, require('./routes/matches'));
app.use('/finance', requireLogin, require('./routes/finance'));

// Turns common MySQL errors into readable messages
app.use((err, req, res, next) => {
  const known = {
    ER_DUP_ENTRY: 'Duplicate value (email, club name, or player name already exists)',
    ER_CHECK_CONSTRAINT_VIOLATED: 'A value broke a database rule (check age, jersey, salary, amount, goals)',
    ER_NO_REFERENCED_ROW_2: 'Referenced record does not exist',
    ER_BAD_NULL_ERROR: 'A required field is missing',
    ER_TRUNCATED_WRONG_VALUE: 'A value has an invalid format',
    WARN_DATA_TRUNCATED: 'A value is not allowed for that field',
    ER_WARN_DATA_TRUNCATED: 'A value is not allowed for that field',
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: 'A value has an invalid format'
  };
  if (known[err.code]) return res.status(400).json({ error: known[err.code] });
  console.error(err);
  res.status(500).json({ error: 'Server error: ' + err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});