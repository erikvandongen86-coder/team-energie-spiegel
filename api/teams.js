// api/teams.js — team aanmaken en ophalen
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const { code } = req.query
      if (!code) return res.status(400).json({ error: 'Geen teamcode opgegeven' })

      const rows = await sql`
        SELECT team_code, team_name, owner_name, owner_email, company_name,
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
        companyName: t.company_name,
        shareWithAll: t.share_with_all,
        memberCount: t.member_count,
        deadlineDays: t.deadline_days,
        createdAt: new Date(t.created_at).getTime(),
      })
    }

    if (req.method === 'POST') {
      const {
        teamCode, teamName, ownerName, ownerEmail, companyName,
        memberCount, deadlineDays, shareWithAll, ownerToken
      } = req.body

      if (!teamCode || !teamName || !ownerName || !ownerEmail || !ownerToken) {
        return res.status(400).json({ error: 'Verplichte velden ontbreken' })
      }

      await sql`
        INSERT INTO teams (team_code, team_name, owner_name, owner_email, company_name,
                           member_count, deadline_days, share_with_all, owner_token)
        VALUES (${teamCode}, ${teamName}, ${ownerName}, ${ownerEmail}, ${companyName||null},
                ${memberCount}, ${deadlineDays}, ${shareWithAll}, ${ownerToken})
      `

      // Stuur beheerlink per e-mail naar aanmaker
      if (process.env.BREVO_API_KEY) {
        const ownerLink = `${process.env.APP_URL}?team=${teamCode}&owner=${ownerToken}`
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
            to: [{ email: ownerEmail }],
            subject: `Jouw beheerlink — Team ${teamName}`,
            htmlContent: `
              <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; color: #2C2C2A;">
                <div style="background: #5C6B3A; padding: 28px 32px; border-radius: 12px 12px 0 0;">
                  <p style="color: #F5F0E8; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0;">Team Energie Spiegel</p>
                </div>
                <div style="background: #F5F0E8; padding: 32px; border-radius: 0 0 12px 12px;">
                  <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 24px; color: #2C2C2A; margin: 0 0 16px;">Hoi ${ownerName},</h1>
                  <p style="font-size: 15px; line-height: 1.7; color: #7A7268; margin: 0 0 16px;">
                    Je hebt zojuist het team <strong style="color: #2C2C2A;">${teamName}</strong> aangemaakt. Bewaar deze e-mail goed — hieronder vind je jouw persoonlijke beheerlink waarmee je op elk moment de resultaten kunt inzien en instellingen kunt aanpassen.
                  </p>
                  <div style="background: #EEF1E8; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
                    <p style="font-family: Georgia, serif; font-size: 15px; font-weight: 600; color: #5C6B3A; margin: 0 0 10px;">Jouw beheerlink</p>
                    <p style="font-size: 12px; color: #7A7268; word-break: break-all; margin: 0 0 14px; line-height: 1.6;">${ownerLink}</p>
                    <a href="${ownerLink}" style="display: inline-block; background: #5C6B3A; color: #FDFCFA; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 50px; text-decoration: none;">Open beheerdersdashboard →</a>
                  </div>
                  <p style="font-size: 14px; line-height: 1.7; color: #7A7268; margin: 0 0 8px;">
                    <strong style="color: #2C2C2A;">Uitnodigingslink voor teamleden:</strong><br/>
                    <a href="${process.env.APP_URL}?team=${teamCode}" style="color: #5C6B3A; word-break: break-all;">${process.env.APP_URL}?team=${teamCode}</a>
                  </p>
                  <p style="font-size: 12px; color: #9E9688; margin: 24px 0 0; text-align: center;">
                    Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color: #9E9688;">erikvandongen.eu</a>
                  </p>
                </div>
              </div>
            `,
          }),
        }).catch(err => console.error('Email fout:', err))
      }

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
