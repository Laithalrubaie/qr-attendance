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

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    let { phone } = req.body;

    if (!phone) return res.status(400).json({ error: 'Phone required' });

    try {
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Baghdad' 
        });

        // --- SMART SEARCH LOGIC ---
        // 1. Remove leading zero for the search (turn '0770...' into '770...')
        //    This helps match numbers stored as integers or text without zero.
        const searchPhone = phone.startsWith('0') ? phone.substring(1) : phone;

        // 2. Search Formula: Look for the number exactly OR contained in the text
        //    SEARCH('770123456', {Phone}) checks if the number exists inside the cell
        const formula = `SEARCH('${searchPhone}', {Phone})`;
        const searchFormula = encodeURIComponent(formula);

        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula=${searchFormula}`;

        console.log(`🔎 Searching for: ${searchPhone}`);

        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const searchData = await searchResponse.json();

        // Check for Airtable Errors (like wrong Base ID)
        if (searchData.error) {
            throw new Error(`Airtable Error: ${searchData.error.message}`);
        }

        // 3. CHECK & UPDATE
        if (searchData.records && searchData.records.length > 0) {
            // Found it!
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
                        "Status": true,
                        "Time": time
                    }
                })
            });

            console.log(`✅ Found & Updated: ${existingName}`);
            
            return res.status(200).json({ 
                success: true, 
                message: `Checked in: ${existingName}`,
                type: 'UPDATE'
            });

        } else {
            // Not Found
            console.log(`⚠️ Not found, creating new: ${phone}`);
            
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

            return res.status(200).json({ 
                success: true, 
                message: 'New guest recorded',
                type: 'CREATE'
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'System Error', details: error.message });
    }
};
