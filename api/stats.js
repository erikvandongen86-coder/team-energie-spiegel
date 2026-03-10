// api/stats.js — totaal aantal ingevulde spiegels
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT COUNT(*) as total FROM entries`
    return res.status(200).json({ total: parseInt(rows[0].total) })
  } catch (err) {
    console.error('stats error:', err)
    return res.status(500).json({ total: 0 })
  }
}
