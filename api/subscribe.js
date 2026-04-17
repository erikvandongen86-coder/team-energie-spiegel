// api/subscribe.js — e-mailadres koppelen aan een entry
import { neon } from '@neondatabase/serverless'

const CTA_BLOCK = `
  <div style="background: #45543B; border-radius: 12px; padding: 28px 32px; text-align: center; margin-top: 32px;">
    <p style="font-family: Georgia, serif; font-size: 11px; color: #c0d4a8; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 10px;">Van spiegel naar beweging</p>
    <p style="font-family: Georgia, serif; font-size: 20px; font-weight: 400; color: #F5F3EF; margin: 0 0 12px; line-height: 1.35;">Je weet nu waar energie lekt in jullie team.</p>
    <p style="font-size: 14px; line-height: 1.7; color: #b8c9a3; margin: 0 0 20px;">In een vrijblijvend gesprek kijk ik met je mee naar de uitkomsten en verkennen we hoe wat nu wrijving geeft, kan uitgroeien tot de kracht van jullie team.</p>
    <a href="https://erikvandongen.eu/inzicht-in-teamdynamiek" style="display: inline-block; background: #F5F3EF; color: #332D28; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 50px; text-decoration: none;">Plan een vrijblijvend intakegesprek</a>
    <p style="font-size: 12px; color: #9E9688; margin: 20px 0 0; text-align: center;">Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color: #9E9688;">erikvandongen.eu</a></p>
  </div>
`

function buildAnalysisHtml(analysis) {
  if (!analysis) return ''
  const vragen = (analysis.gespreksvragen || []).map((v, i) => `
    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
      <span style="font-size: 13px; font-weight: 700; color: #45543B; min-width: 20px;">${i + 1}.</span>
      <p style="font-size: 14px; line-height: 1.6; color: #332D28; margin: 0;">${v}</p>
    </div>
  `).join('')
  return `
    <div style="margin-top: 28px;">
      <div style="background: #FBF0EA; border-radius: 10px; padding: 20px 24px; margin-bottom: 16px;">
        <p style="font-family: Georgia, serif; font-size: 15px; font-weight: 600; color: #9D6D58; margin: 0 0 8px;">Spiegel</p>
        <p style="font-size: 14px; line-height: 1.7; color: #332D28; margin: 0;">${analysis.diagnose}</p>
      </div>
      <div style="background: #EFEBE7; border-radius: 10px; padding: 20px 24px; margin-bottom: 16px;">
        <p style="font-family: Georgia, serif; font-size: 15px; font-weight: 600; color: #332D28; margin: 0 0 8px;">Wat dit betekent</p>
        <p style="font-size: 14px; line-height: 1.7; color: #332D28; margin: 0;">${analysis.betekenis}</p>
      </div>
      <div style="background: #EFEBE7; border-radius: 10px; padding: 20px 24px; margin-bottom: 16px;">
        <p style="font-family: Georgia, serif; font-size: 15px; font-weight: 600; color: #332D28; margin: 0 0 8px;">Als er niets verandert</p>
        <p style="font-size: 14px; line-height: 1.7; color: #332D28; margin: 0;">${analysis.geenVerandering}</p>
      </div>
      <div style="padding: 20px 24px;">
        <p style="font-family: Georgia, serif; font-size: 15px; font-weight: 600; color: #45543B; margin: 0 0 12px;">Gespreksvragen voor je team</p>
        ${vragen}
      </div>
    </div>
  `
}

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
        UPDATE entries SET email = ${email}, name = ${name || null}, analysis = ${analysis ? JSON.stringify(analysis) : null}
        WHERE team_code = ${teamCode} AND session_id = ${sessionId}
      `
    }

    const analysisHtml = buildAnalysisHtml(analysis)

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
        to: [{ email }],
        subject: 'Jouw Team Energie Spiegel resultaten',
        htmlContent: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #EFEBE7;">
            <tr>
              <td align="center" style="padding: 32px 16px;">
                <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; font-family: 'Helvetica Neue', sans-serif; color: #332D28; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td style="background: #45543B; padding: 28px 32px; border-radius: 12px 12px 0 0;">
                      <p style="color: #c0d4a8; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">Team Energie Spiegel</p>
                      <p style="color: #F5F3EF; font-size: 13px; margin: 0;">erikvandongen.eu</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background: #F5F3EF; padding: 32px; border-radius: 0 0 12px 12px;">
                      <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 26px; color: #332D28; margin: 0 0 16px;">Hoi ${name || 'daar'},</h1>
                      <p style="font-size: 15px; line-height: 1.7; color: #766960; margin: 0 0 8px;">
                        Bedankt voor het invullen van de Team Energie Spiegel.${analysis ? ' Hieronder vind je jouw persoonlijke analyse.' : ''}
                      </p>
                      ${wantsTeamAnalysis
                        ? '<p style="font-size: 14px; line-height: 1.7; color: #766960; margin: 0 0 8px;">Zodra alle teamleden klaar zijn ontvang je automatisch ook de teamanalyse.</p>'
                        : ''}
                      ${analysisHtml}
                      ${CTA_BLOCK}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `,
      }),
    }).catch(err => console.error('Brevo fout:', err))

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('subscribe error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
