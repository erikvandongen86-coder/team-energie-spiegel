// api/subscribe.js — e-mailadres koppelen aan een entry
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { teamCode, sessionId, name, email, wantsTeamAnalysis } = req.body

  if (!teamCode || !sessionId || !email) {
    return res.status(400).json({ error: 'Verplichte velden ontbreken' })
  }

  try {
    await sql`
      UPDATE entries SET email = ${email}, name = ${name || null}
      WHERE team_code = ${teamCode} AND session_id = ${sessionId}
    `

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Team Energie Spiegel <info@erikvandongen.eu>',
          to: email,
          subject: 'Jouw Team Energie Spiegel resultaten',
          html: `
            <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; color: #2C2C2A;">
              <div style="background: #5C6B3A; padding: 28px 32px; border-radius: 12px 12px 0 0;">
                <p style="color: #F5F0E8; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0;">erikvandongen.eu</p>
              </div>
              <div style="background: #F5F0E8; padding: 32px; border-radius: 0 0 12px 12px;">
                <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 26px; color: #2C2C2A; margin: 0 0 16px;">Hoi ${name || 'daar'},</h1>
                <p style="font-size: 15px; line-height: 1.7; color: #7A7268; margin: 0 0 24px;">
                  Bedankt voor het invullen van de Team Energie Spiegel. Je resultaten zijn opgeslagen.
                </p>
                <p style="font-size: 15px; line-height: 1.7; color: #7A7268; margin: 0 0 24px;">
                  ${wantsTeamAnalysis
                    ? 'Zodra alle teamleden klaar zijn ontvang je automatisch de teamanalyse.'
                    : 'Wil je meer inzicht in jouw teampatronen? Erik denkt graag met je mee.'}
                </p>
                <div style="text-align: center; margin-top: 32px;">
                  <a href="https://erikvandongen.eu/contact" style="display: inline-block; background: #5C6B3A; color: #FDFCFA; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 50px; text-decoration: none;">Plan een gesprek met Erik →</a>
                </div>
                <p style="font-size: 12px; color: #9E9688; margin: 24px 0 0; text-align: center;">
                  Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color: #9E9688;">erikvandongen.eu</a>
                </p>
              </div>
            </div>
          `,
        }),
      })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('subscribe error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
