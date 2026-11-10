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

// Query login_attempts and explicitly alias columns to match frontend expectations
app.get('/api/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id, 
                'LOGIN_ATTEMPT' AS event_type,
                email AS user_identifier, 
                ip_address AS source_info, 
                CONCAT('Success: ', success) AS details, 
                attempt_time AS created_at 
            FROM login_attempts 
            ORDER BY id DESC 
            LIMIT 100
        `);
        res.json({ success: true, logs: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Monitoring Service live on port ${PORT}`);
});