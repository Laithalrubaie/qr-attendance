// api/record.js - Airtable version
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = 'Attendance';

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { teacherName, phone, organization, subject } = req.body;

    // Get Baghdad time
    const date = new Date().toLocaleDateString('en-GB', { 
        timeZone: 'Asia/Baghdad'
    });
    
    const time = new Date().toLocaleTimeString('ar-IQ', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Baghdad'
    });

    try {
        // Send to Airtable
        const response = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        'Teacher Name': teacherName,
                        'Phone': phone,
                        'Organization': organization || '-',
                        'Subject': subject || '-',
                        'Date': date,
                        'Time': time,
                        'Status': 'ARRIVED',
                        'WhatsApp Status': 'pending'
                    }
                })
            }
        );

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ Record created in Airtable: ${result.id}`);
            return res.status(200).json({ 
                success: true,
                message: `تم تسجيل حضور ${teacherName}`,
                recordId: result.id,
                date,
                time
            });
        } else {
            throw new Error(result.error.message);
        }

    } catch (error) {
        console.error('Airtable error:', error);
        return res.status(500).json({ 
            error: 'Failed to record',
            details: error.message 
        });
    }
};

const { google } = require('googleapis');

// Helper function to create Google Sheets client
async function getGoogleSheetsClient() {
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

    return google.sheets({ version: 'v4', auth });
}

// Main handler function
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { teacherName, phone, organization, subject, timestamp, status } = req.body;

    // Validate required fields
    if (!teacherName || !phone) {
        return res.status(400).json({ 
            error: 'Teacher name and phone are required',
            received: { teacherName, phone, organization, subject }
        });
    }

    try {
        // Get current time in Baghdad timezone directly
        const date = new Date().toLocaleDateString('en-GB', { 
            timeZone: 'Asia/Baghdad'
        }); // DD/MM/YYYY
        
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Asia/Baghdad'
        });
        
        // Save to Google Sheets
        const sheets = await getGoogleSheetsClient();
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Sheet1!A:G', // Extended to 7 columns
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    teacherName,                    // Column A: Teacher Name
                    phone,                          // Column B: Phone
                    organization || '-',            // Column C: Organization
                    subject || '-',                 // Column D: Subject
                    date,                           // Column E: Date
                    time,                           // Column F: Time
                    status || 'ARRIVED'            // Column G: Status
                ]]
            }
        });

        // FIXED: Added parentheses to console.log
        console.log(`✅ Recorded: ${teacherName} (${organization || 'N/A'}) - ${subject || 'N/A'} at ${time} on ${date}`);

        // Success response
        return res.status(200).json({ 
            success: true,
            message: `تم تسجيل حضور ${teacherName}`,
            teacherName,
            organization: organization || null,
            subject: subject || null,
            date: date,
            time: time
        });

    } catch (error) {
        console.error('Error recording attendance:', error);
        
        return res.status(500).json({ 
            error: 'Failed to record attendance',
            details: error.message
        });
    }
};