// api/admin.js — admin overzicht van alle teams en sessies
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { password } = req.body
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Ongeldig wachtwoord' })
  }

  try {
    const sql = neon(process.env.DATABASE_URL)

    const teams = await sql`
      SELECT team_code, team_name, owner_name, owner_email, company_name,
             member_count, deadline_days, share_with_all, created_at, analysis, analysis_at
      FROM teams ORDER BY created_at DESC
    `
    const entries = await sql`
      SELECT team_code, session_id, scores, email, name, submitted_at
      FROM entries ORDER BY submitted_at DESC
    `
    const feedback = await sql`
      SELECT session_id, page, rating, comment, would_use, created_at
      FROM feedback ORDER BY created_at DESC
    `

    const result = teams.map(t => {
      const teamEntries = entries.filter(e => e.team_code === t.team_code)
      return {
        teamCode: t.team_code,
        teamName: t.team_name,
        ownerName: t.owner_name,
        ownerEmail: t.owner_email,
        companyName: t.company_name,
        memberCount: t.member_count,
        deadlineDays: t.deadline_days,
        shareWithAll: t.share_with_all,
        createdAt: new Date(t.created_at).getTime(),
        analysis: t.analysis || null,
        analysisAt: t.analysis_at ? new Date(t.analysis_at).getTime() : null,
        entries: teamEntries.map(e => ({
          sid: e.session_id,
          scores: e.scores,
          email: e.email || null,
          name: e.name || null,
          ts: new Date(e.submitted_at).getTime(),
        }))
      }
    })

    return res.status(200).json({
      teams: result,
      totalTeams: teams.length,
      totalEntries: entries.length,
      feedback: feedback.map(f => {
        const entry = entries.find(e => e.session_id === f.session_id)
        return {
          sessionId: f.session_id,
          name: entry?.name || null,
          email: entry?.email || null,
          page: f.page,
          rating: f.rating,
          comment: f.comment,
          wouldUse: f.would_use,
          createdAt: new Date(f.created_at).getTime(),
        }
      })
    })
  } catch (err) {
    console.error('admin error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
