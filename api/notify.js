// api/notify.js — stuur teamanalyse e-mail
import { neon } from '@neondatabase/serverless'

async function generateTeamAnalysis(avgScores, memberCount) {
  const lines = Object.entries(avgScores)
    .map(([cat, sc]) => {
      const label = sc >= 4 ? 'kracht' : sc >= 3 ? 'neutraal' : 'energielek'
      return `${cat}: ${sc}/5 (${label})`
    }).join('\n')

  const prompt = `Je bent een scherpe, eerlijke teamcoach. Dit zijn de GEMIDDELDE scores van ${memberCount} teamleden op de Team Energie Spiegel.

Scores (1-5, waarbij 4-5=kracht/positief en 1-2=energielek/probleem):
${lines}

Schrijf in het Nederlands vanuit TEAM-perspectief een heldere teamanalyse.

Antwoord ALLEEN in JSON (geen markdown):
{"diagnose":"...","betekenis":"...","geenVerandering":"...","gespreksvragen":["...","...","..."]}`

  const maxRetries = 2
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await res.json()
      const text = data.content?.find(b => b.type === 'text')?.text || '{}'
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch (err) {
      console.error('notify: generateTeamAnalysis poging', attempt, 'mislukt -', err.message)
      if (attempt === maxRetries) {
        return {
          diagnose: 'De teamanalyse kon niet automatisch worden gegenereerd. Bekijk de scores hieronder voor een eerste beeld.',
          betekenis: 'Neem de scores per categorie door om te zien waar de meeste energie zit of weglekt.',
          geenVerandering: 'Gebruik de scores als gespreksstarter met het team.',
          gespreksvragen: ['Wat valt jullie op aan deze scores?', 'Waar zijn jullie het meest over verrast?', 'Welk onderwerp verdient als eerste aandacht?'],
        }
      }
    }
  }
}

function buildTeamEmailHtml(teamName, ownerName, analysis, memberCount, dashboardUrl) {
  const gespreksvragenRows = (analysis.gespreksvragen || []).map((v, i) => `
              <tr>
                <td width="34" valign="top" style="width:34px; padding:0 0 14px 0; font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#8A8177;">${i + 1}.</td>
                <td valign="top" style="padding:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#332D28;">${v}</td>
              </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>De teamanalyse van ${teamName}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#EFEBE7; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

<span style="display:none; font-size:1px; color:#EFEBE7; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">Alle teamleden hebben de spiegel ingevuld. Hier is de teamanalyse van ${teamName}.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#EFEBE7; width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px;">

        <!-- Header -->
        <tr>
          <td bgcolor="#45543B" style="background-color:#45543B; padding:30px 40px 34px 40px;">
            <p style="margin:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; text-transform:uppercase; color:#DDE4D4;">Team Energie Spiegel · Teamanalyse</p>
            <h1 style="margin:0; font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:30px; line-height:38px; mso-line-height-rule:exactly; color:#F5F3EF;">${teamName}</h1>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:38px 40px 0 40px;">
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#332D28;">Hoi ${ownerName}, alle ${memberCount} teamleden hebben de spiegel ingevuld. Hieronder vind je de teamanalyse. Gebruik hem als gespreksstarter.</p>
          </td>
        </tr>

        <!-- Diagnose -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:34px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#EFEBE7;">
              <tr>
                <td style="padding:26px 28px; border-left:3px solid #45543B;">
                  <p style="margin:0 0 10px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.4px; text-transform:uppercase; color:#6B6258;">Diagnose</p>
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
            <p style="margin:0 0 18px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:26px; mso-line-height-rule:exactly; color:#45543B;">Start het gesprek</p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">${gespreksvragenRows}
            </table>
          </td>
        </tr>

        <!-- Primaire CTA -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:26px 40px 44px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#45543B" align="center" style="background-color:#45543B; border-radius:4px; padding:15px 30px;">
                  <a href="${dashboardUrl}" style="display:block; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; font-weight:600; color:#F5F3EF; text-decoration:none;">Bekijk het teamdashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Uitnodiging tot gesprek -->
        <tr>
          <td bgcolor="#45543B" style="background-color:#45543B; padding:40px;">
            <p style="margin:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; text-transform:uppercase; color:#DDE4D4;">Van diagnose naar beweging</p>
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
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; mso-line-height-rule:exactly; color:#8A8177;">Je ontvangt deze e-mail omdat je een team beheert in Team Energie Spiegel.</p>
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

  const { teamCode } = req.body
  if (!teamCode) return res.status(400).json({ error: 'Geen teamcode' })

  try {
    const [team] = await sql`SELECT * FROM teams WHERE team_code = ${teamCode}`
    if (!team) return res.status(404).json({ error: 'Team niet gevonden' })

    if (team.notified_at) {
      console.log('notify: al eerder verstuurd voor', teamCode)
      return res.status(200).json({ success: true, note: 'Al eerder verstuurd' })
    }

    const entries = await sql`SELECT scores FROM entries WHERE team_code = ${teamCode}`
    if (entries.length === 0) return res.status(400).json({ error: 'Geen entries' })

    const cats = ['Vertrouwen', 'Eigenaarschap', 'Samenwerking', 'Richting', 'Tempo']
    const avgScores = {}
    cats.forEach(cat => {
      const vals = entries.map(e => e.scores[cat] || 3)
      avgScores[cat] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    })

    const analysis = await generateTeamAnalysis(avgScores, entries.length)
    const dashboardUrl = `${process.env.APP_URL}/?team=${teamCode}&owner=${team.owner_token}`
    const html = buildTeamEmailHtml(team.team_name, team.owner_name, analysis, entries.length, dashboardUrl)

    if (!process.env.BREVO_API_KEY) {
      return res.status(200).json({ success: true, analysis, note: 'Geen Brevo key geconfigureerd' })
    }

    const recipients = [team.owner_email]

    if (team.share_with_all) {
      const memberEmails = await sql`
        SELECT DISTINCT email FROM entries
        WHERE team_code = ${teamCode} AND email IS NOT NULL AND email != ${team.owner_email}
      `
      memberEmails.forEach(r => recipients.push(r.email))
    }

    console.log('notify: verstuur naar', recipients)

    const sendResults = await Promise.all(recipients.map(async (to) => {
      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
            to: [{ email: to }],
            subject: `Teamanalyse ${team.team_name} — Team Energie Spiegel`,
            htmlContent: html,
          }),
        })

        const bodyText = await brevoRes.text()

        if (!brevoRes.ok) {
          console.error('notify: Brevo fout voor', to, '- status', brevoRes.status, '-', bodyText)
          return { to, success: false, status: brevoRes.status, error: bodyText }
        }

        console.log('notify: Brevo geaccepteerd voor', to, '-', bodyText)
        return { to, success: true }
      } catch (err) {
        console.error('notify: fetch naar Brevo mislukt voor', to, '-', err.message)
        return { to, success: false, error: err.message }
      }
    }))

    const failed = sendResults.filter(r => !r.success)
    const allFailed = failed.length === recipients.length

    if (failed.length > 0) {
      console.error('notify: mislukte verzendingen:', JSON.stringify(failed))
    }

    if (!allFailed) {
      await sql`UPDATE teams SET notified_at = NOW() WHERE team_code = ${teamCode}`
    } else {
      console.error('notify: alle verzendingen mislukt voor', teamCode, '- notified_at NIET gezet, kan opnieuw geprobeerd worden')
    }

    return res.status(200).json({
      success: !allFailed,
      sentTo: recipients.length - failed.length,
      failed: failed.length > 0 ? failed : undefined,
    })
  } catch (err) {
    console.error('notify error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
