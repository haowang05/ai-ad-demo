const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// English ad categories
const AD_CATEGORIES = [
    "Arts & Entertainment", "Automotive", "Business & Finance", "Careers", "Education", "Family & Parenting",
    "Food & Drink", "Health & Fitness", "Hobbies & Interests", "Home & Garden", "Law, Gov’t & Politics",
    "News", "Personal Finance", "Pets", "Real Estate", "Science", "Shopping", "Society",
    "Sports", "Style & Fashion", "Technology & Computing", "Travel", "Weather"
];

async function callLLM(prompt) {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
        throw new Error("API Key not set in environment variables.");
    }

    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
            messages: [{ role: "user", content: prompt }],
            stream: false,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("LLM API Error:", errorText);
        throw new Error("LLM service returned an error");
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
}

app.post("/api/get-category", async (req, res) => {
    try {
        const { gender, age, location } = req.body;
        if (!gender || age == null) {
            return res.status(400).json({ error: "Request is missing gender or age." });
        }

        let userInfoForPrompt = `a ${gender.toLowerCase()}, around ${age} years old`;
        if (location) {
            userInfoForPrompt += ` from ${location}`;
        }

        const categoryPrompt = `For ${userInfoForPrompt}, pick the most relevant ad category from this list: [${AD_CATEGORIES.join(", ")}]. Return only the category name.`;
        let selectedCategory = await callLLM(categoryPrompt);
        selectedCategory = AD_CATEGORIES.find(c => selectedCategory.includes(c)) || "Shopping";

        res.json({ category: selectedCategory });

    } catch (err) {
        console.error("Failed to select category:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/get-ad", async (req, res) => {
    try {
        const { gender, age, location, category } = req.body;
        if (!gender || age == null || !category) {
            return res.status(400).json({ error: "Request is missing gender, age, or category." });
        }

        let userInfoForPrompt = `a ${gender.toLowerCase()}, around ${age} years old`;
        if (location) {
            userInfoForPrompt += ` from ${location}`;
        }

        const adPrompt = `Create a modern, appealing ad slogan for "${category}", targeted at ${userInfoForPrompt}. Keep it under 25 words.`;
        const adContent = await callLLM(adPrompt);

        res.json({ ad: adContent || `Explore the infinite possibilities of ${category}!` });

    } catch (err) {
        console.error("Failed to generate ad slogan:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/location", async (req, res) => {
    try {
        const ip = req.ip;

        if (!ip || ip === "::1" || ip === "127.0.0.1") {
             return res.json({ city: 'Development', country: 'Local Network' });
        }

        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            res.json({ 
                city: data.city || 'Unknown City', 
                country: data.country || 'Unknown Country' 
            });
        } else {
            res.json({ city: 'Unknown', country: 'Location' });
        }
    } catch (error) {
        console.error('Failed to get location:', error);
        res.status(500).json({ city: 'Error', country: 'Failed to fetch' });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

