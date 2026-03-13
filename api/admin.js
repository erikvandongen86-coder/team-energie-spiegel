// api/admin.js — admin dashboard data
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { password } = req.query
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Niet geautoriseerd' })
  }

  try {
    const sql = neon(process.env.DATABASE_URL)

    const teams = await sql`
      SELECT team_code, team_name, owner_name, owner_email, company_name,
             member_count, deadline_days, share_with_all, created_at,
             analysis, analysis_at, owner_token
      FROM teams ORDER BY created_at DESC
    `

    const entries = await sql`
      SELECT team_code, session_id, scores, email, name, submitted_at
      FROM entries ORDER BY submitted_at DESC
    `

    const subscribers = await sql`
      SELECT DISTINCT name, email, submitted_at
      FROM entries WHERE email IS NOT NULL
      ORDER BY submitted_at DESC
    `

    const feedback = await sql`
      SELECT session_id, page, rating, comment, would_use, naam, created_at
      FROM feedback ORDER BY created_at DESC
    `

    const testers = await sql`
      SELECT * FROM tester_responses ORDER BY created_at DESC
    `.catch(() => [])

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
      totalSessions: entries.length,
      subscribers: subscribers.map(s => ({
        name: s.name || '—',
        email: s.email,
        date: new Date(s.submitted_at).getTime(),
      })),
      testers: testers,
      feedback: feedback.map(f => ({
        sessionId: f.session_id,
        naam: f.naam || null,
        page: f.page,
        rating: f.rating,
        comment: f.comment,
        wouldUse: f.would_use,
        createdAt: new Date(f.created_at).getTime(),
      }))
    })
  } catch (err) {
    console.error('admin error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
