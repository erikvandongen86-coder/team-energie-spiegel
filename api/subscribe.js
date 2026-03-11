// api/subscribe.js — e-mailadres koppelen aan een entry
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { teamCode, sessionId, name, email, wantsTeamAnalysis, analysis } = req.body

  if (!sessionId || !email) {
    return res.status(400).json({ error: 'Verplichte velden ontbreken' })
  }

  try {
    if (teamCode) {
      await sql`
        UPDATE entries SET email = ${email}, name = ${name || null}
        WHERE team_code = ${teamCode} AND session_id = ${sessionId}
      `
    }

    if (process.env.BREVO_API_KEY) {
      const analysisHtml = analysis ? `
        <div style="background: #FBF0EA; border-radius: 10px; padding: 20px 24px; margin-bottom: 20px;">
          <p style="font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: #B5622A; margin: 0 0 8px;">Diagnose</p>
          <p style="font-size: 15px; line-height: 1.7; color: #2C2C2A; margin: 0;">${analysis.diagnose}</p>
        </div>
        <div style="margin-bottom: 20px;">
          <p style="font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: #2C2C2A; margin: 0 0 8px;">Wat dit betekent</p>
          <p style="font-size: 15px; line-height: 1.7; color: #2C2C2A; margin: 0;">${analysis.betekenis}</p>
        </div>
        <div style="background: #EDE7D9; border-radius: 10px; padding: 20px 24px; margin-bottom: 20px;">
          <p style="font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: #2C2C2A; margin: 0 0 8px;">Als er niets verandert</p>
          <p style="font-size: 15px; line-height: 1.7; color: #2C2C2A; margin: 0;">${analysis.geenVerandering}</p>
        </div>
        <div style="margin-bottom: 28px;">
          <p style="font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: #5C6B3A; margin: 0 0 12px;">Start het gesprek</p>
          ${(analysis.gespreksvragen || []).map((v, i) => `
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
              <span style="font-size: 13px; font-weight: 700; color: #5C6B3A; min-width: 20px;">${i + 1}.</span>
              <p style="font-size: 14px; line-height: 1.6; color: #2C2C2A; margin: 0;">${v}</p>
            </div>
          `).join('')}
        </div>
      ` : `
        <p style="font-size: 15px; line-height: 1.7; color: #7A7268; margin: 0 0 24px;">
          Je resultaten zijn opgeslagen.
          ${wantsTeamAnalysis ? 'Zodra alle teamleden klaar zijn ontvang je automatisch de teamanalyse.' : ''}
        </p>
      `

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
          to: [{ email }],
          subject: 'Jouw Team Energie Spiegel analyse',
          htmlContent: `
            <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; color: #2C2C2A;">
              <div style="background: #45543B; padding: 28px 32px; border-radius: 12px 12px 0 0;">
                <p style="color: #EFEBE7; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px;">Team Energie Spiegel</p>
                <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 26px; color: #F5F3EF; margin: 0;">Jouw teampatroon in beeld</h1>
              </div>
              <div style="background: #F5F3EF; padding: 32px; border-radius: 0 0 12px 12px;">
                <p style="font-size: 15px; line-height: 1.7; color: #7A7268; margin: 0 0 28px;">Hoi ${name || 'daar'}, hieronder vind je jouw persoonlijke analyse.</p>
                ${analysisHtml}
                <div style="background: #45543B; border-radius: 10px; padding: 24px; text-align: center; margin-top: 8px;">
                  <p style="font-family: Georgia, serif; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #EFEBE7; margin: 0 0 10px;">Van diagnose naar beweging</p>
                  <p style="font-family: Georgia, serif; font-size: 20px; color: #F5F3EF; margin: 0 0 8px;">Je weet nu waar energie lekt in jullie team.</p>
                  <p style="font-size: 13px; color: #EFEBE7; margin: 0 0 20px; line-height: 1.6;">In een vrijblijvend gesprek kijk ik met je mee naar de uitkomsten en verkennen we hoe wat nu wrijving geeft, kan uitgroeien tot de kracht van jullie team.</p>
                  <a href="https://erikvandongen.eu/contact" style="display: inline-block; background: #F5F3EF; color: #332D28; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 50px; text-decoration: none;">Plan een vrijblijvend intakegesprek</a>
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
