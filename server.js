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

// Unified API endpoint: combines login attempts and CSV/attendance logs for the dashboard
app.get('/api/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id, 
                CASE WHEN ok = 1 THEN 'SUCCESS_LOGIN' ELSE 'FAILED_LOGIN' END AS event_type,
                email AS user_identifier, 
                ip AS source_info, 
                CONCAT('Login Status: ', IF(ok = 1, 'Success', 'Failed')) AS details, 
                attempted_at AS created_at 
            FROM login_attempts
            
            UNION ALL
            
            SELECT 
                id + 100000 AS id, 
                CASE WHEN processed = 1 THEN 'CSV_UPLOAD_SUCCESS' ELSE 'CSV_UPLOAD_PENDING' END AS event_type,
                CONCAT('User: ', device_user_id) AS user_identifier,
                COALESCE(source, 'System Upload') AS source_info,
                CONCAT('Punch Time: ', punch_time, ' | Processed: ', processed) AS details,
                received_at AS created_at 
            FROM attendance_logs
            
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        res.json({ success: true, logs: rows });
    } catch (err) {
        // Fallback to login_attempts only if attendance_logs query encounters any issue
        try {
            const [fallbackRows] = await pool.query(`
                SELECT 
                    id, 
                    CASE WHEN ok = 1 THEN 'SUCCESS_LOGIN' ELSE 'FAILED_LOGIN' END AS event_type,
                    email AS user_identifier, 
                    ip AS source_info, 
                    CONCAT('Login Status: ', IF(ok = 1, 'Success', 'Failed')) AS details, 
                    attempted_at AS created_at 
                FROM login_attempts 
                ORDER BY id DESC 
                LIMIT 100
            `);
            res.json({ success: true, logs: fallbackRows });
        } catch (fallbackErr) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Monitoring Service live on port ${PORT}`);
});