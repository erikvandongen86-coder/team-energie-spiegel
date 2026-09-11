// api/subscribe.js — e-mailadres koppelen aan een entry
import { neon } from '@neondatabase/serverless'

function buildAnalysisSection(analysis) {
  if (!analysis) return ''
  const vragenRows = (analysis.gespreksvragen || []).map((v, i) => `
              <tr>
                <td width="34" valign="top" style="width:34px; padding:0 0 14px 0; font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#8A8177;">${i + 1}.</td>
                <td valign="top" style="padding:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#332D28;">${v}</td>
              </tr>`).join('')

  return `
        <!-- Spiegel -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:34px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#EFEBE7;">
              <tr>
                <td style="padding:26px 28px; border-left:3px solid #45543B;">
                  <p style="margin:0 0 10px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.4px; text-transform:uppercase; color:#6B6258;">Spiegel</p>
                  <p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:19px; line-height:30px; mso-line-height-rule:exactly; color:#332D28;">${analysis.diagnose}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Wat dit betekent -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:34px 40px 0 40px;">
            <p style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:26px; mso-line-height-rule:exactly; color:#45543B;">Wat dit betekent</p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#332D28;">${analysis.betekenis}</p>
          </td>
        </tr>

        <!-- Als er niets verandert -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:28px 40px 0 40px;">
            <p style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:26px; mso-line-height-rule:exactly; color:#45543B;">Als er niets verandert</p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#332D28;">${analysis.geenVerandering}</p>
          </td>
        </tr>

        <!-- Gespreksvragen -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:34px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
              <tr>
                <td style="border-top:1px solid #DFD9D2; padding:0 0 22px 0; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
            </table>
            <p style="margin:0 0 18px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:26px; mso-line-height-rule:exactly; color:#45543B;">Gespreksvragen voor je team</p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">${vragenRows}
            </table>
          </td>
        </tr>`
}

function buildEmailHtml(name, analysis, wantsTeamAnalysis) {
  const displayName = name || 'daar'
  const analysisSection = buildAnalysisSection(analysis)

  const teamAnalysisTeaser = wantsTeamAnalysis ? `
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:30px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#EFEBE7;">
              <tr>
                <td style="padding:22px 28px;">
                  <p style="margin:0 0 6px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.4px; text-transform:uppercase; color:#6B6258;">Nog te komen</p>
                  <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:25px; mso-line-height-rule:exactly; color:#332D28;">Zodra alle teamleden klaar zijn ontvang je automatisch ook de teamanalyse.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Jouw persoonlijke analyse</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#EFEBE7; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

<span style="display:none; font-size:1px; color:#EFEBE7; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">Bedankt voor het invullen van de spiegel. Hieronder vind je jouw persoonlijke analyse.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#EFEBE7; width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px;">

        <!-- Header -->
        <tr>
          <td bgcolor="#45543B" style="background-color:#45543B; padding:30px 40px 34px 40px;">
            <p style="margin:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; text-transform:uppercase; color:#DDE4D4;">Team Energie Spiegel · Persoonlijke analyse</p>
            <h1 style="margin:0; font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:30px; line-height:38px; mso-line-height-rule:exactly; color:#F5F3EF;">Jouw spiegel</h1>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:38px 40px 0 40px;">
            <p style="margin:0 0 14px 0; font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:31px; mso-line-height-rule:exactly; color:#332D28;">Hoi ${displayName}</p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#332D28;">Bedankt voor het invullen van de Team Energie Spiegel.${analysis ? ' Hieronder vind je jouw persoonlijke analyse.' : ''}</p>
          </td>
        </tr>
${analysisSection}
${teamAnalysisTeaser}

        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; height:40px; font-size:0; line-height:0;">&nbsp;</td>
        </tr>

        <!-- Uitnodiging tot gesprek -->
        <tr>
          <td bgcolor="#45543B" style="background-color:#45543B; padding:40px;">
            <p style="margin:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; text-transform:uppercase; color:#DDE4D4;">Van spiegel naar beweging</p>
            <p style="margin:0 0 14px 0; font-family:Georgia,'Times New Roman',serif; font-size:23px; line-height:33px; mso-line-height-rule:exactly; color:#F5F3EF;">Je weet nu waar energie lekt in jullie team.</p>
            <p style="margin:0 0 26px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#E4E9DC;">In een vrijblijvend gesprek kijk ik met je mee naar de uitkomsten en verkennen we hoe wat nu wrijving geeft, kan uitgroeien tot de kracht van jullie team.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#F5F3EF" align="center" style="background-color:#F5F3EF; border-radius:4px; padding:15px 30px;">
                  <a href="https://erikvandongen.eu/inzicht-in-teamdynamiek" style="display:block; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; font-weight:600; color:#332D28; text-decoration:none;">Plan een vrijblijvend intakegesprek</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="#EFEBE7" style="background-color:#EFEBE7; padding:24px 40px 8px 40px;" align="center">
            <p style="margin:0 0 6px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly; color:#6B6258;">Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color:#45543B; text-decoration:none;">erikvandongen.eu</a></p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; mso-line-height-rule:exactly; color:#8A8177;">Je ontvangt deze e-mail omdat je de Team Energie Spiegel hebt ingevuld.</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`
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

    const html = buildEmailHtml(name, analysis, wantsTeamAnalysis)

    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
          to: [{ email }],
          subject: 'Jouw Team Energie Spiegel resultaten',
          htmlContent: html,
        }),
      })

      const bodyText = await brevoRes.text()

      if (!brevoRes.ok) {
        console.error('subscribe: Brevo fout voor', email, '- status', brevoRes.status, '-', bodyText)
      } else {
        console.log('subscribe: Brevo geaccepteerd voor', email, '-', bodyText)
      }
    } catch (err) {
      console.error('subscribe: fetch naar Brevo mislukt voor', email, '-', err.message)
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('subscribe error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
