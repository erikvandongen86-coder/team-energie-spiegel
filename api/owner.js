// api/owner.js — valideer of de owner token klopt
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { code, token } = req.query
  if (!code || !token) return res.status(400).json({ valid: false })

  try {
    const rows = await sql`
      SELECT owner_token FROM teams WHERE team_code = ${code}
    `
    if (rows.length === 0) return res.status(404).json({ valid: false })

    const valid = rows[0].owner_token === token
    return res.status(200).json({ valid })
  } catch (err) {
    console.error('owner error:', err)
    return res.status(500).json({ valid: false })
  }
}
