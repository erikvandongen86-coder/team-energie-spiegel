// api/feedback.js — feedback opslaan
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { sessionId, page, rating, comment, wouldUse, naam } = req.body
  if (!sessionId) return res.status(400).json({ error: 'Geen sessie-ID' })

  try {
    const sql = neon(process.env.DATABASE_URL)
    await sql`
      INSERT INTO feedback (session_id, page, rating, comment, would_use, naam)
      VALUES (${sessionId}, ${page||null}, ${rating||null}, ${comment||null}, ${wouldUse||null}, ${naam||null})
    `
    return res.status(201).json({ success: true })
  } catch (err) {
    console.error('feedback error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
