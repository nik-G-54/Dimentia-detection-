import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyD8d79SRHy43LuNvWKPLqKWttazirJZBJ0');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

model.generateContent('hello')
  .then(res => console.log('SUCCESS:', res.response.text()))
  .catch(err => console.error('ERROR:', err.message));
