// api/subscribe.js — e-mailadres koppelen aan een entry
import { neon } from '@neondatabase/serverless'

// ── Individuele analyse-mail (bestaand gedrag) ──────────────────────────────
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

function buildIndividualEmailHtml(name, analysis, wantsTeamAnalysis) {
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

// ── Teamanalyse-mail voor late aanmelders (team al compleet + al verstuurd) ─
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
    console.error('subscribe: generateTeamAnalysis mislukt -', err.message)
    return null
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

<span style="display:none; font-size:1px; color:#EFEBE7; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">De teamanalyse van ${teamName}.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#EFEBE7; width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px;">

        <tr>
          <td bgcolor="#45543B" style="background-color:#45543B; padding:30px 40px 34px 40px;">
            <p style="margin:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; text-transform:uppercase; color:#DDE4D4;">Team Energie Spiegel · Teamanalyse</p>
            <h1 style="margin:0; font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:30px; line-height:38px; mso-line-height-rule:exactly; color:#F5F3EF;">${teamName}</h1>
          </td>
        </tr>

        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:38px 40px 0 40px;">
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#332D28;">Hoi, alle ${memberCount} teamleden hebben inmiddels de spiegel ingevuld. Hieronder vind je de teamanalyse. Gebruik hem als gespreksstarter.</p>
          </td>
        </tr>

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

        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:34px 40px 0 40px;">
            <p style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:26px; mso-line-height-rule:exactly; color:#45543B;">Wat dit betekent</p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#332D28;">${analysis.betekenis}</p>
          </td>
        </tr>

        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:28px 40px 0 40px;">
            <p style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:26px; mso-line-height-rule:exactly; color:#45543B;">Als er niets verandert</p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; mso-line-height-rule:exactly; color:#332D28;">${analysis.geenVerandering}</p>
          </td>
        </tr>

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

        <tr>
          <td bgcolor="#EFEBE7" style="background-color:#EFEBE7; padding:24px 40px 8px 40px;" align="center">
            <p style="margin:0 0 6px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly; color:#6B6258;">Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color:#45543B; text-decoration:none;">erikvandongen.eu</a></p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; mso-line-height-rule:exactly; color:#8A8177;">Je ontvangt deze e-mail omdat je hebt aangegeven de teamanalyse te willen ontvangen.</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`
}

async function sendViaBrevo(to, subject, html, logLabel) {
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
        subject,
        htmlContent: html,
      }),
    })
    const bodyText = await brevoRes.text()
    if (!brevoRes.ok) {
      console.error(logLabel, ': Brevo fout voor', to, '- status', brevoRes.status, '-', bodyText)
    } else {
      console.log(logLabel, ': Brevo geaccepteerd voor', to, '-', bodyText)
    }
  } catch (err) {
    console.error(logLabel, ': fetch naar Brevo mislukt voor', to, '-', err.message)
  }
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

    // Check: is dit team al compleet EN is de batch-teamanalyse-mail al verstuurd?
    // Zo ja: deze late aanmelder mist de automatische trigger, dus sturen we 'm nu alsnog.
    let sentAsLateJoiner = false
    if (teamCode && wantsTeamAnalysis) {
      const [team] = await sql`SELECT * FROM teams WHERE team_code = ${teamCode}`
      if (team && team.notified_at) {
        console.log('subscribe: late aanmelder voor reeds verstuurd team', teamCode, '-', email)

        let teamAnalysis = team.analysis
        if (!teamAnalysis) {
          // Zou niet moeten voorkomen (notify.js slaat 'm altijd op), maar voor de zekerheid alsnog genereren
          const entries = await sql`SELECT scores FROM entries WHERE team_code = ${teamCode}`
          const cats = ['Vertrouwen', 'Eigenaarschap', 'Samenwerking', 'Richting', 'Tempo']
          const avgScores = {}
          cats.forEach(cat => {
            const vals = entries.map(e => e.scores[cat] || 3)
            avgScores[cat] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
          })
          teamAnalysis = await generateTeamAnalysis(avgScores, entries.length)
          if (teamAnalysis) {
            await sql`UPDATE teams SET analysis = ${JSON.stringify(teamAnalysis)}, analysis_at = NOW() WHERE team_code = ${teamCode}`
          }
        }

        if (teamAnalysis) {
          const dashboardUrl = `${process.env.APP_URL}/?team=${teamCode}`
          const html = buildTeamEmailHtml(team.team_name, team.owner_name, teamAnalysis, team.member_count, dashboardUrl)
          await sendViaBrevo(email, `Teamanalyse ${team.team_name} — Team Energie Spiegel`, html, 'subscribe (late aanmelder)')
          sentAsLateJoiner = true
        }
      }
    }

    // Normale individuele-analyse-mail — altijd sturen, ook als de late-aanmelder-mail hierboven al ging
    // (die bevat de persoonlijke analyse, dit is een aparte mail met de teamanalyse)
    const html = buildIndividualEmailHtml(name, analysis, wantsTeamAnalysis && !sentAsLateJoiner)
    await sendViaBrevo(email, 'Jouw Team Energie Spiegel resultaten', html, 'subscribe')

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('subscribe error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
