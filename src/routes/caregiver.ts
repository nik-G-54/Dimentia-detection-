import express from 'express'
const router = express.Router()

// Placeholder for caregiver routes since it's imported in app.ts but not fully defined in the main prompt
router.get('/', (req, res) => {
  res.json({ message: 'Caregiver routes setup' })
})

export default router
