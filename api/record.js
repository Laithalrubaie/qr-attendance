// api/record.js - PHONE + TELEGRAM SUPPORT + FIXED TIME COLUMN

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = 'app4viasf1twQh1aW'; 
const AIRTABLE_TABLE_NAME = 'QR Code Scanner'; 

module.exports = async (req, res) => {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { phone, telegram } = req.body;
    let searchFormula = '';
    let searchValue = '';
    
    // --- LOGIC: Determine if we are searching for Phone or Telegram ---
    
    if (telegram) {
        // === TELEGRAM LOGIC ===
        searchValue = telegram;
        // Formula: {TG} = '@username'
        searchFormula = `{TG}='${telegram}'`;
        console.log(`🔎 Searching Telegram: ${telegram}`);

    } else if (phone) {
        // === PHONE LOGIC (CONTAINS) ===
        let corePhone = phone;
        // Clean phone number for better matching
        if (corePhone.startsWith('964')) corePhone = corePhone.substring(3);
        if (corePhone.startsWith('0')) corePhone = corePhone.substring(1);
        
        searchValue = phone; 
        
        // Formula: SEARCH('770123456', {Phone})
        searchFormula = `SEARCH('${corePhone}', {Phone})`;
        console.log(`🔎 Searching Phone (Contains): ${corePhone}`);

    } else {
        return res.status(400).json({ error: 'No Phone or Telegram data found' });
    }

    try {
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Baghdad' 
        });

        // 1. PERFORM SEARCH
        const encodedFormula = encodeURIComponent(searchFormula);
        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula=${encodedFormula}`;

        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const searchData = await searchResponse.json();

        if (searchData.error) {
            console.error('❌ Airtable Error:', searchData.error);
            throw new Error(`Airtable Error: ${searchData.error.message}`);
        }

        // 2. CHECK RESULTS
        if (searchData.records && searchData.records.length > 0) {
            // === FOUND MATCH ===
            const recordId = searchData.records[0].id;
            const existingFields = searchData.records[0].fields;
            const existingName = existingFields.Name || "Unknown";
            
            // Determine existing Phone/TG to return complete data
            const displayPhone = existingFields.Phone || phone || "-";
            const displayTG = existingFields.TG || telegram || "-";

            // Update Status to Checked
            const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`;
            await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: { 
                        "Arrived": true, 
                        "Time": time // UPDATED: Matches your new column header "Time"
                    }
                })
            });

            return res.status(200).json({ 
                success: true, 
                message: `Checked in: ${existingName}`,
                type: 'UPDATE',
                // Return data in the specific order needed by frontend
                record: {
                    "Name": existingName,
                    "Phone": displayPhone,
                    "TG": displayTG,
                    "Arrived": true,
                    "Time": time
                }
            });

        } else {
            // === NOT FOUND (CREATE NEW) ===
            
            let newFields = {
                "Name": "New Guest",
                "Arrived": true,
                "Time": time // UPDATED: Matches your new column header "Time"
            };

            if (telegram) {
                newFields["TG"] = telegram;
                newFields["Phone"] = "-";
            } else {
                newFields["Phone"] = searchValue;
                newFields["TG"] = "-";
            }

            const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
            await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: newFields })
            });

            return res.status(200).json({ 
                success: true, 
                message: 'New guest recorded',
                type: 'CREATE',
                // Return data in the specific order needed by frontend
                record: {
                    "Name": newFields["Name"],
                    "Phone": newFields["Phone"],
                    "TG": newFields["TG"],
                    "Arrived": true,
                    "Time": time
                }
            });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
