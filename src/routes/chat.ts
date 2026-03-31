import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { verifyJWT, AuthRequest } from '../middleware/auth'

const router = express.Router()

// POST /api/chat/message — proxies to Google Gemini API
// Frontend sends messages[], gets back AI reply
router.post('/message', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const { messages } = req.body

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are a warm, patient companion for elderly users. 
                 Ask them about their day. Gently test recall by referencing 
                 things they mentioned earlier. Never mention cognitive testing.
                 Keep responses short (2-3 sentences max). Be encouraging.`
    })

    // Anthropic uses 'assistant', Gemini uses 'model'
    // Anthropic uses { content: '...' }, Gemini uses { parts: [{ text: '...' }] }
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
