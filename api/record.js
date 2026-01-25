// api/record.js - SEARCH & UPDATE VERSION

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = 'Table'; 

module.exports = async (req, res) => {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Baghdad' 
        });

        // 1. SEARCH
        const searchFormula = encodeURIComponent(`{Phone}='${phone}'`);
        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula=${searchFormula}`;

        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const searchData = await searchResponse.json();

        // 2. CHECK & UPDATE
        if (searchData.records && searchData.records.length > 0) {
            // === FOUND! ===
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
                    fields: {
                        "Status": true, // <--- This ticks the checkbox
                        "Time": time
                    }
                })
            });

            console.log(`✅ Checked box for: ${existingName}`);
            
            return res.status(200).json({ 
                success: true, 
                message: `Checked in: ${existingName}`,
                type: 'UPDATE'
            });

        } else {
            // === NOT FOUND (NEW GUEST) ===
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
                        "Status": true, // <--- This ticks the checkbox
                        "Time": time
                    }
                })
            });

            return res.status(200).json({ 
                success: true, 
                message: 'New guest recorded',
                type: 'CREATE'
            });
        }

    } catch (error) {
        console.error('Airtable Error:', error);
        return res.status(500).json({ error: 'System Error', details: error.message });
    }
};
