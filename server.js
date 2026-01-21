// server.js - Backend API for QR Attendance System
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio Configuration
const twilioClient = twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_TOKEN
);

// Google Sheets Configuration
const auth = new google.auth.GoogleAuth({
    credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'QR Attendance API is running',
        timestamp: new Date().toISOString()
    });
});

// Record attendance endpoint
app.post('/record', async (req, res) => {
    const { name, phone, timestamp, status } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    try {
        // 1. Save to Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Sheet1!A:D', // Adjust sheet name if needed
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[name, phone, timestamp, status]]
            }
        });

        console.log(`✅ Recorded: ${name} - ${phone}`);

        // 2. Send WhatsApp message
        try {
            await twilioClient.messages.create({
                body: `Welcome ${name}! You are checked in at ${new Date(timestamp).toLocaleTimeString()}.`,
                from: process.env.TWILIO_FROM,
                to: phone
            });
            console.log(`📨 WhatsApp sent to ${name}`);
        } catch (whatsappError) {
            console.error('WhatsApp error:', whatsappError.message);
            // Don't fail the request if WhatsApp fails
        }

        res.json({ 
            success: true,
            message: `Attendance recorded for ${name}`,
            timestamp
        });

    } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).json({ 
            error: 'Failed to record attendance',
            details: error.message 
        });
    }
});

// Manual WhatsApp send endpoint (optional)
app.post('/whatsapp', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_FROM,
            to: to
        });

        res.json({ 
            success: true,
            messageSid: result.sid,
            status: result.status
        });
    } catch (error) {
        console.error('WhatsApp error:', error);
        res.status(500).json({ 
            error: 'Failed to send WhatsApp message',
            details: error.message 
        });
    }
});

// Get recent attendance records (optional - for dashboard)
app.get('/records', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Sheet1!A:D',
        });

        const rows = response.data.values || [];
        const records = rows.slice(1).map(row => ({
            name: row[0],
            phone: row[1],
            timestamp: row[2],
            status: row[3]
        }));

        res.json({ 
            success: true,
            count: records.length,
            records: records.slice(-50).reverse() // Last 50 records
        });
    } catch (error) {
        console.error('Error fetching records:', error);
        res.status(500).json({ 
            error: 'Failed to fetch records',
            details: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`✅ Ready to accept requests`);
});