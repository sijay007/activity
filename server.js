const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
// Render assigns its own port dynamically, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Safely look for ca.pem locally or fallback if running pure environment SSL
let sslConfig = { rejectUnauthorized: true };
const caPath = path.join(__dirname, 'ca.pem');
if (fs.existsSync(caPath)) {
    sslConfig.ca = fs.readFileSync(caPath);
} else {
    // Fallback if ca.pem isn't bundled locally
    sslConfig = { rejectUnauthorized: false };
}

// Connects securely to your Aiven cloud database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslConfig,
    waitForConnections: true,
    connectionLimit: 10
});

// API endpoint to fetch live logs mapped to your audit_logs schema
app.get('/api/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, event_type, user_identifier AS identifier, source_info AS ip_address, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100'
        );
        res.json({ success: true, logs: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Monitoring Service live on port ${PORT}`);
});