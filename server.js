const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sslConfig = { rejectUnauthorized: true };
const caPath = path.join(__dirname, 'ca.pem');
if (fs.existsSync(caPath)) {
    sslConfig.ca = fs.readFileSync(caPath);
} else {
    sslConfig = { rejectUnauthorized: false };
}

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

// Query live login_attempts table from your payroll system
app.get('/api/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, event_type, email AS identifier, ip_address, details, created_at FROM login_attempts ORDER BY created_at DESC LIMIT 100'
        );
        res.json({ success: true, logs: rows });
    } catch (err) {
        // Fallback generic select if column names differ slightly
        try {
            const [fallbackRows] = await pool.query('SELECT * FROM login_attempts ORDER BY id DESC LIMIT 100');
            res.json({ success: true, logs: fallbackRows });
        } catch (fallbackErr) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Monitoring Service live on port ${PORT}`);
});