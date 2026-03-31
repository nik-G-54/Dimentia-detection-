import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import { verifyJWT, AuthRequest } from '../middleware/auth'

const router = express.Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, pin, age, education, livesAlone, caregiverPhone, caregiverEmail } = req.body

    const existing = await User.findOne({ phone })
    if (existing) return res.status(400).json({ message: 'Phone number already registered' })

    const pinHash = await bcrypt.hash(pin, 10)

    const user = await User.create({
      name, phone, pinHash, age, education,
      livesAlone: livesAlone || false,
      caregiverPhone, caregiverEmail
    })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
    })

    res.status(201).json({ token, userId: user._id, name: user.name })
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Registration failed', error: err })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body

    const user = await User.findOne({ phone })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isValid = await bcrypt.compare(pin, user.pinHash)
    if (!isValid) return res.status(401).json({ message: 'Incorrect PIN' })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
    })

    res.json({ token, userId: user._id, name: user.name })
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err })
  }
})

// GET /api/auth/me — protected
router.get('/me', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('-pinHash')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err })
  }
})

export default router
