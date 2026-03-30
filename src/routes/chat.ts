import express from 'express'
import axios from 'axios'
import { verifyJWT, AuthRequest } from '../middleware/auth'

const router = express.Router()

// POST /api/chat/message — proxies to Anthropic Claude API
// Frontend sends messages[], gets back AI reply
router.post('/message', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const { messages } = req.body

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `You are a warm, patient companion for elderly users. 
                 Ask them about their day. Gently test recall by referencing 
                 things they mentioned earlier. Never mention cognitive testing.
                 Keep responses short (2-3 sentences max). Be encouraging.`,
        messages,
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    )

    const reply = response.data.content[0]?.text || ''
    res.json({ reply })
  } catch (err) {
    res.status(500).json({ message: 'Chat request failed', error: err })
  }
})

export default router
