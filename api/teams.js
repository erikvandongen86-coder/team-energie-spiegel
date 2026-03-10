// api/teams.js — team aanmaken en ophalen
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const { code } = req.query
      if (!code) return res.status(400).json({ error: 'Geen teamcode opgegeven' })

      const rows = await sql`
        SELECT team_code, team_name, owner_name, owner_email,
               member_count, deadline_days, share_with_all, created_at
        FROM teams WHERE team_code = ${code}
      `
      if (rows.length === 0) return res.status(404).json({ error: 'Team niet gevonden' })

      const t = rows[0]
      return res.status(200).json({
        teamCode: t.team_code,
        teamName: t.team_name,
        ownerName: t.owner_name,
        ownerEmail: t.owner_email,
        memberCount: t.member_count,
        deadlineDays: t.deadline_days,
        shareWithAll: t.share_with_all,
        createdAt: new Date(t.created_at).getTime(),
      })
    }

    if (req.method === 'POST') {
      const {
        teamCode, teamName, ownerName, ownerEmail,
        memberCount, deadlineDays, shareWithAll, ownerToken
      } = req.body

      if (!teamCode || !teamName || !ownerName || !ownerEmail || !ownerToken) {
        return res.status(400).json({ error: 'Verplichte velden ontbreken' })
      }

      await sql`
        INSERT INTO teams (team_code, team_name, owner_name, owner_email,
                           member_count, deadline_days, share_with_all, owner_token)
        VALUES (${teamCode}, ${teamName}, ${ownerName}, ${ownerEmail},
                ${memberCount}, ${deadlineDays}, ${shareWithAll}, ${ownerToken})
      `

      return res.status(201).json({ success: true, teamCode })
    }

    if (req.method === 'PATCH') {
      const { teamCode, shareWithAll } = req.body
      if (!teamCode) return res.status(400).json({ error: 'Geen teamcode opgegeven' })

      await sql`
        UPDATE teams SET share_with_all = ${shareWithAll}
        WHERE team_code = ${teamCode}
      `
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Methode niet toegestaan' })
  } catch (err) {
    console.error('teams error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
