// api/delete.js — verwijder alle data gekoppeld aan een e-mailadres
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { email } = req.body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ongeldig e-mailadres' })
  }

  try {
    const sql = neon(process.env.DATABASE_URL)

    const deletedEntries = await sql`
      DELETE FROM entries WHERE email = ${email}
      RETURNING session_id
    `

    const sessionIds = deletedEntries.map(e => e.session_id)
    let deletedFeedback = 0
    if (sessionIds.length > 0) {
      const result = await sql`
        DELETE FROM feedback WHERE session_id = ANY(${sessionIds})
        RETURNING id
      `
      deletedFeedback = result.length
    }

    const userMailBody = `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; color: #332D28;">
        <div style="background: #45543B; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="color: #F5F3EF; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0;">Team Energie Spiegel</p>
        </div>
        <div style="background: #F5F3EF; padding: 32px; border-radius: 0 0 12px 12px;">
          <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 24px; color: #332D28; margin: 0 0 16px;">Jouw gegevens zijn verwijderd</h1>
          <p style="font-size: 15px; line-height: 1.7; color: #766960; margin: 0 0 16px;">
            Op jouw verzoek zijn alle gegevens die gekoppeld waren aan <strong style="color: #332D28;">${email}</strong> verwijderd uit de Team Energie Spiegel.
          </p>
          <p style="font-size: 14px; line-height: 1.7; color: #766960; margin: 0 0 16px;">
            Heb je vragen of verwacht je dat er nog gegevens zijn die niet verwijderd zijn? Neem dan contact op via <a href="mailto:info@erikvandongen.eu" style="color: #45543B;">info@erikvandongen.eu</a>.
          </p>
          <p style="font-size: 12px; color: #9E9688; margin: 24px 0 0; text-align: center;">
            Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color: #9E9688;">erikvandongen.eu</a>
          </p>
        </div>
      </div>
    `

    const adminMailBody = `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; color: #332D28;">
        <div style="background: #45543B; padding: 20px 32px; border-radius: 12px 12px 0 0;">
          <p style="color: #F5F3EF; font-size: 13px; margin: 0;">Team Energie Spiegel — Verwijderverzoek uitgevoerd</p>
        </div>
        <div style="background: #F5F3EF; padding: 28px 32px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px; color: #332D28; margin: 0 0 12px;">Het volgende verwijderverzoek is automatisch uitgevoerd:</p>
          <table style="font-size: 14px; color: #766960; border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 6px 0; font-weight: 600; color: #332D28; width: 140px;">E-mailadres</td><td>${email}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600; color: #332D28;">Entries verwijderd</td><td>${deletedEntries.length}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600; color: #332D28;">Feedback verwijderd</td><td>${deletedFeedback}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600; color: #332D28;">Tijdstip</td><td>${new Date().toLocaleString('nl-NL')}</td></tr>
          </table>
        </div>
      </div>
    `

    if (process.env.BREVO_API_KEY) {
      const userMailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
          to: [{ email: email }],
          subject: 'Jouw gegevens zijn verwijderd — Team Energie Spiegel',
          htmlContent: userMailBody,
        }),
      }).catch(err => { console.error('Gebruikersmail fout:', err); return null; })
      if (userMailRes) {
        const userMailJson = await userMailRes.json().catch(() => {})
        console.log('Gebruikersmail result:', userMailRes.status, JSON.stringify(userMailJson))
      }

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
          to: [{ email: 'info@erikvandongen.eu' }],
          subject: `Verwijderverzoek uitgevoerd — ${email}`,
          htmlContent: adminMailBody,
        }),
      }).catch(err => console.error('Adminmail fout:', err))
    }

    return res.status(200).json({ success: true, deletedEntries: deletedEntries.length, deletedFeedback })
  } catch (err) {
    console.error('delete error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
