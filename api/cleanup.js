// api/cleanup.js — verwijder data ouder dan 2 jaar (Vercel cron job)
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Niet geautoriseerd' })
  }

  try {
    const sql = neon(process.env.DATABASE_URL)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const deletedEntries = await sql`
      DELETE FROM entries
      WHERE submitted_at < ${twoYearsAgo.toISOString()}
      RETURNING session_id
    `

    const deletedFeedback = await sql`
      DELETE FROM feedback
      WHERE created_at < ${twoYearsAgo.toISOString()}
      RETURNING id
    `

    const deletedTeams = await sql`
      DELETE FROM teams
      WHERE created_at < ${twoYearsAgo.toISOString()}
      AND team_code NOT IN (
        SELECT DISTINCT team_code FROM entries
        WHERE submitted_at >= ${twoYearsAgo.toISOString()}
      )
      RETURNING team_code
    `

    if (process.env.BREVO_API_KEY && (deletedEntries.length > 0 || deletedFeedback.length > 0 || deletedTeams.length > 0)) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
          to: [{ email: 'info@erikvandongen.eu' }],
          subject: 'Automatische opschoning uitgevoerd — Team Energie Spiegel',
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #332D28;">
              <div style="background: #45543B; padding: 20px 28px; border-radius: 12px 12px 0 0;">
                <p style="color: #F5F3EF; font-size: 13px; margin: 0;">Team Energie Spiegel — Automatische opschoning</p>
              </div>
              <div style="background: #F5F3EF; padding: 24px 28px; border-radius: 0 0 12px 12px;">
                <p style="font-size: 14px; color: #766960; margin: 0 0 12px;">De nachtelijke opschoning heeft het volgende verwijderd (ouder dan 2 jaar):</p>
                <table style="font-size: 14px; color: #332D28; border-collapse: collapse;">
                  <tr><td style="padding: 5px 12px 5px 0; font-weight: 600;">Entries</td><td>${deletedEntries.length}</td></tr>
                  <tr><td style="padding: 5px 12px 5px 0; font-weight: 600;">Feedback</td><td>${deletedFeedback.length}</td></tr>
                  <tr><td style="padding: 5px 12px 5px 0; font-weight: 600;">Teams</td><td>${deletedTeams.length}</td></tr>
                </table>
                <p style="font-size: 12px; color: #9E9688; margin: 20px 0 0;">${new Date().toLocaleString('nl-NL')}</p>
              </div>
            </div>
          `,
        }),
      }).catch(err => console.error('Mail fout:', err))
    }

    return res.status(200).json({
      success: true,
      deletedEntries: deletedEntries.length,
      deletedFeedback: deletedFeedback.length,
      deletedTeams: deletedTeams.length,
    })
  } catch (err) {
    console.error('cleanup error:', err)
    return res.status(500).json({ error: err.message })
  }
}
