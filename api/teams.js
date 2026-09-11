// api/teams.js — team aanmaken en ophalen
import { neon } from '@neondatabase/serverless'

function buildOwnerEmailHtml(ownerName, teamName, ownerLink, inviteLink) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Je beheerlink voor ${teamName}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#EFEBE7; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

<span style="display:none; font-size:1px; color:#EFEBE7; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">Bewaar deze e-mail: hierin staat jouw persoonlijke beheerlink voor ${teamName}.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#EFEBE7; width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px;">

        <!-- Header -->
        <tr>
          <td bgcolor="#45543B" style="background-color:#45543B; padding:26px 40px;">
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:1.6px; text-transform:uppercase; color:#DDE4D4;">Team Energie Spiegel</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:40px 40px 8px 40px;">
            <h1 style="margin:0 0 18px 0; font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:26px; line-height:34px; mso-line-height-rule:exactly; color:#332D28;">Hoi ${ownerName},</h1>
            <p style="margin:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#332D28;">Je hebt zojuist het team <strong style="font-weight:600; color:#332D28;">${teamName}</strong> aangemaakt.</p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:27px; mso-line-height-rule:exactly; color:#332D28;">Bewaar deze e-mail goed. Hieronder vind je jouw persoonlijke beheerlink en de uitnodigingslink voor je teamleden.</p>
          </td>
        </tr>

        <!-- Beheerlink -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:24px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#EFEBE7;">
              <tr>
                <td style="padding:26px 28px 28px 28px; border-left:3px solid #45543B;">
                  <p style="margin:0 0 12px 0; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:24px; mso-line-height-rule:exactly; color:#45543B;">Jouw beheerlink</p>
                  <p style="margin:0 0 20px 0; font-family:'Courier New',Courier,monospace; font-size:13px; line-height:21px; mso-line-height-rule:exactly; color:#5C5349; word-break:break-all;">${ownerLink}</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#45543B" align="center" style="background-color:#45543B; border-radius:4px; padding:14px 28px;">
                        <a href="${ownerLink}" style="display:block; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:20px; mso-line-height-rule:exactly; font-weight:600; color:#F5F3EF; text-decoration:none;">Open beheerdersdashboard</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Uitnodigingslink -->
        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:28px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
              <tr>
                <td style="padding:0 0 18px 0; border-bottom:1px solid #DFD9D2;"></td>
              </tr>
            </table>
            <p style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:24px; mso-line-height-rule:exactly; color:#332D28; padding-top:18px;">Uitnodigingslink voor teamleden</p>
            <p style="margin:0 0 10px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:25px; mso-line-height-rule:exactly; color:#5C5349;">Deel deze link met de leden van ${teamName}, zodat zij de spiegel kunnen invullen.</p>
            <p style="margin:0; font-family:'Courier New',Courier,monospace; font-size:13px; line-height:21px; mso-line-height-rule:exactly; word-break:break-all;"><a href="${inviteLink}" style="color:#45543B; text-decoration:underline;">${inviteLink}</a></p>
          </td>
        </tr>

        <tr>
          <td bgcolor="#F5F3EF" style="background-color:#F5F3EF; padding:36px 40px 40px 40px;">
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:25px; mso-line-height-rule:exactly; color:#5C5349;">Zodra iedereen heeft ingevuld, ontvang je de teamanalyse per e-mail.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="#EFEBE7" style="background-color:#EFEBE7; padding:24px 40px 8px 40px;" align="center">
            <p style="margin:0 0 6px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; mso-line-height-rule:exactly; color:#6B6258;">Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color:#45543B; text-decoration:none;">erikvandongen.eu</a></p>
            <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; mso-line-height-rule:exactly; color:#8A8177;">Je ontvangt deze e-mail omdat je een team hebt aangemaakt in Team Energie Spiegel.</p>
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const { code } = req.query
      if (!code) return res.status(400).json({ error: 'Geen teamcode opgegeven' })

      const rows = await sql`
        SELECT team_code, team_name, owner_name, owner_email, company_name, notified_at,
               member_count, share_with_all, created_at, analysis, analysis_at
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
        createdAt: new Date(t.created_at).getTime(),
        analysis: t.analysis || null,
        analysisAt: t.analysis_at ? new Date(t.analysis_at).getTime() : null,
      })
    }

    if (req.method === 'POST') {
      const {
        teamCode, teamName, ownerName, ownerEmail, companyName,
        memberCount, shareWithAll, ownerToken
      } = req.body

      if (!teamCode || !teamName || !ownerName || !ownerEmail || !ownerToken) {
        return res.status(400).json({ error: 'Verplichte velden ontbreken' })
      }

      await sql`
        INSERT INTO teams (team_code, team_name, owner_name, owner_email, company_name,
                           member_count, share_with_all, owner_token)
        VALUES (${teamCode}, ${teamName}, ${ownerName}, ${ownerEmail}, ${companyName||null},
                ${memberCount}, ${shareWithAll}, ${ownerToken})
      `

      const ownerLink = `${process.env.APP_URL}?team=${teamCode}&owner=${ownerToken}`
      const inviteLink = `${process.env.APP_URL}?team=${teamCode}`

      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: 'Team Energie Spiegel', email: 'info@erikvandongen.eu' },
            to: [{ email: ownerEmail }],
            subject: `Jouw beheerlink — Team ${teamName}`,
            htmlContent: buildOwnerEmailHtml(ownerName, teamName, ownerLink, inviteLink),
          }),
        })

        const bodyText = await brevoRes.text()

        if (!brevoRes.ok) {
          console.error('teams: Brevo fout bij beheerlink-mail voor', ownerEmail, '- status', brevoRes.status, '-', bodyText)
        } else {
          console.log('teams: Brevo geaccepteerd voor', ownerEmail, '-', bodyText)
        }
      } catch (err) {
        console.error('teams: fetch naar Brevo mislukt voor', ownerEmail, '-', err.message)
      }

      return res.status(201).json({ success: true, teamCode })
    }

    if (req.method === 'PATCH') {
      const { teamCode, shareWithAll, analysis } = req.body
      if (!teamCode) return res.status(400).json({ error: 'Geen teamcode opgegeven' })

      if (analysis !== undefined) {
        await sql`
          UPDATE teams SET analysis = ${JSON.stringify(analysis)}, analysis_at = NOW()
          WHERE team_code = ${teamCode}
        `
      } else {
        await sql`
          UPDATE teams SET share_with_all = ${shareWithAll}
          WHERE team_code = ${teamCode}
        `
      }
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Methode niet toegestaan' })
  } catch (err) {
    console.error('teams error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
