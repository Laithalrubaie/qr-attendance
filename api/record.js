// api/record.js - FIXED TABLE NAME VERSION

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// Your Base ID (from your URL)
const AIRTABLE_BASE_ID = 'appJFX8HETEg4xsud'; 

// ✅ CHANGED: Using the name "Table" exactly as you said
// If it is "Table 1", change this line to: const AIRTABLE_TABLE_NAME = 'Table 1';
const AIRTABLE_TABLE_NAME = 'Table'; 

module.exports = async (req, res) => {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    console.log(`🚀 Processing phone: ${phone} for Table: ${AIRTABLE_TABLE_NAME}`);

    try {
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Baghdad' 
        });

        // 1. SMART SEARCH
        const searchPhone = phone.startsWith('0') ? phone.substring(1) : phone;
        const formula = `SEARCH('${searchPhone}', {Phone})`;
        const searchFormula = encodeURIComponent(formula);

        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula=${searchFormula}`;

        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const searchData = await searchResponse.json();

        // ❌ CATCH PERMISSION/NAME ERRORS
        if (searchData.error) {
            console.error('❌ Airtable Error:', searchData.error);
            // This sends the specific error back to your phone screen
            throw new Error(`Airtable Error: ${searchData.error.message} (Check Table Name!)`);
        }

        // 2. CHECK & UPDATE
        if (searchData.records && searchData.records.length > 0) {
            const recordId = searchData.records[0].id;
            const existingName = searchData.records[0].fields.Name || "Unknown";

            const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`;
            await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: { "Status": true, "Time": time }
                })
            });

            return res.status(200).json({ success: true, message: `Checked in: ${existingName}`, type: 'UPDATE' });

        } else {
            // Create New
            const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
            await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        "Phone": phone,
                        "Name": "New Guest",
                        "Status": true,
                        "Time": time
                    }
                })
            });

            return res.status(200).json({ success: true, message: 'New guest recorded', type: 'CREATE' });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
