const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

async function listModels() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    
    if (data.error) {
       console.log('API Error:', data.error);
       return;
    }

    const available = data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name);
      
    console.log("AVAILABLE MODELS:", available);
  } catch (err) {
    console.error(err);
  }
}

listModels();
