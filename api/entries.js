// api/entries.js — individuele resultaten opslaan en ophalen
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const { code } = req.query
      if (!code) return res.status(400).json({ error: 'Geen teamcode opgegeven' })

      const rows = await sql`
        SELECT session_id, scores, submitted_at
        FROM entries WHERE team_code = ${code}
        ORDER BY submitted_at ASC
      `

      return res.status(200).json(rows.map(r => ({
        sid: r.session_id,
        scores: r.scores,
        ts: new Date(r.submitted_at).getTime(),
      })))
    }

    if (req.method === 'POST') {
      const { teamCode, sessionId, scores, email } = req.body

      if (!teamCode || !sessionId || !scores) {
        return res.status(400).json({ error: 'Verplichte velden ontbreken' })
      }

      await sql`
        INSERT INTO entries (team_code, session_id, scores, email)
        VALUES (${teamCode}, ${sessionId}, ${JSON.stringify(scores)}, ${email || null})
        ON CONFLICT (team_code, session_id)
        DO UPDATE SET scores = EXCLUDED.scores, email = EXCLUDED.email
      `

      const [team] = await sql`SELECT * FROM teams WHERE team_code = ${teamCode}`
      if (team) {
        const [{ count }] = await sql`
          SELECT COUNT(*) as count FROM entries WHERE team_code = ${teamCode}
        `
        if (parseInt(count) >= team.member_count) {
          await fetch(`${process.env.APP_URL}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamCode, reason: 'complete' }),
          }).catch(() => {})
        }
      }

      return res.status(201).json({ success: true })
    }

    return res.status(405).json({ error: 'Methode niet toegestaan' })
  } catch (err) {
    console.error('entries error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
