const { google } = require('googleapis');

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

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. EXTRACT ONLY PHONE
    // We removed teacherName, status, organization, subject
    const { phone } = req.body;

    // 2. VALIDATION
    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const date = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' });
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Baghdad' 
        });
        
        const sheets = await getGoogleSheetsClient();
        
        // 3. SAVE TO GOOGLE SHEETS
        // We now save only 3 columns: [Phone, Date, Time]
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Sheet1!A:C', 
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    phone,  // Column A: Phone
                    date,   // Column B: Date
                    time    // Column C: Time
                ]]
            }
        });

        console.log(`✅ Recorded: ${phone} at ${time}`);

        return res.status(200).json({ 
            success: true,
            message: 'Recorded',
            phone,
            time 
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Failed to record', details: error.message });
    }
};
