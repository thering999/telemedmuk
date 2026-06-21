import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.get('/api/snapshots', (req, res) => {
  // TODO: Fetch from database
  res.json({
    data: [],
    message: 'API not yet connected to database'
  })
})

app.get('/api/snapshots/:date', (req, res) => {
  const { date } = req.params
  // TODO: Fetch specific snapshot from database
  res.json({
    data: null,
    message: `Snapshot for ${date} not found`
  })
})

app.post('/api/snapshots/import', (req, res) => {
  // TODO: Handle Excel file upload and import
  res.json({
    success: false,
    message: 'Import endpoint not yet implemented'
  })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Telemedicine API running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})
