import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { verifyJWT, AuthRequest } from '../middleware/auth'
import User from '../models/User'

const router = express.Router()

// Rate limit: max 60 messages per user per hour
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req: any) => req.userId || ipKeyGenerator(req.ip),
  message: { message: 'Too many messages. Please wait before continuing.' }
})

// POST /api/chat/message — proxies to Google Gemini API
// Frontend sends messages[], gets back AI reply
router.post('/message', verifyJWT, chatLimiter, async (req: AuthRequest, res) => {
  try {
    const { messages, language = 'english' } = req.body
    const userId = req.userId!

    // Fetch user profile for personalisation
    const user = await User.findById(userId).select('age education name')

    // Build age-adjusted vocabulary instruction
    const ageNote = user?.age
      ? `The user is ${user.age} years old.`
      : ''

    const educationNote = (() => {
      switch (user?.education) {
        case 'none':      return 'Use very simple, short words. Maximum 8-word sentences.'
        case 'primary':   return 'Use simple everyday vocabulary. Short sentences.'
        case 'secondary': return 'Use clear, moderate vocabulary. Normal sentence length.'
        case 'graduate':  return 'The user is well-educated. Normal vocabulary is fine.'
        default:          return 'Use simple, clear vocabulary.'
      }
    })()

    const nameNote = user?.name ? `The user's name is ${user.name}.` : ''

    const langInstruction = 
      language === 'hindi' ? "RULE 7 — LANGUAGE: You must reply entirely in Hindi (written in standard Hindi script)." :
      language === 'hinglish' ? "RULE 7 — LANGUAGE: You must reply in Hinglish (casual conversational Hindi written in English letters)." :
      "RULE 7 — LANGUAGE: You must reply in standard English.";

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are a warm, patient daily companion for an elderly person.
Your hidden purpose is gentle cognitive assessment through natural conversation.
${ageNote} ${nameNote}
${educationNote}

RULE 1 — MEMORY PROBE (most important):
Every 3 to 5 exchanges, casually reference something the user mentioned earlier
in this exact conversation. Example: "You mentioned your knee earlier — feeling better?"
If they do not remember, respond warmly and move on. Never make them feel tested.

RULE 2 — TEMPORAL ORIENTATION:
Once per session, ask one natural time-based question.
Good: "Have you had lunch yet?" or "It has been quite warm lately, has it not?"
Never ask directly: "What is today's date?" — that feels like a test.

RULE 3 — TOPIC SHIFT:
Every 4 to 5 exchanges, gently introduce a new topic to test cognitive flexibility.
Example: "That reminds me — have you spoken to your family recently?"

RULE 4 — RESPONSE LENGTH (mandatory):
Always respond in exactly 2 to 3 sentences. Never longer.
Longer responses slow the user's reply and corrupt timing signals.

RULE 5 — FORBIDDEN WORDS:
Never say: memory, brain, test, assessment, dementia, cognitive,
health check, score, or anything implying evaluation.

RULE 6 — OPENING:
If the conversation has only one message, open with a warm greeting
asking about their day. Example: "Good morning! How has your day been going so far?"
${langInstruction}`
    })

    // Anthropic uses 'assistant', Gemini uses 'model'
    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }]
    }))

    const result = await model.generateContent({
      contents: formattedContents
    })

    const reply = result.response.text() || ''
    res.json({ reply })
  } catch (err) {
    console.error('Gemini error:', err)
    res.status(500).json({ message: 'Chat request failed', error: err })
  }
})

export default router
