// api/notify.js — stuur teamanalyse e-mail
import { neon } from '@neondatabase/serverless'

async function generateTeamAnalysis(avgScores, memberCount) {
  const lines = Object.entries(avgScores)
    .map(([cat, sc]) => {
      const label = sc <= 2 ? 'kracht' : sc <= 3 ? 'neutraal' : 'energielek'
      return `${cat}: ${sc}/5 (${label})`
    }).join('\n')

  const prompt = `Je bent een scherpe, eerlijke teamcoach. Dit zijn de GEMIDDELDE scores van ${memberCount} teamleden op de Team Energie Spiegel.

Scores (1-5, waarbij 4-5 energielek is en 1-2 kracht):
${lines}

Schrijf in het Nederlands vanuit TEAM-perspectief een heldere teamanalyse.

Antwoord ALLEEN in JSON (geen markdown):
{"diagnose":"...","betekenis":"...","geenVerandering":"...","gespreksvragen":["...","...","..."]}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const text = data.content?.find(b => b.type === 'text')?.text || '{}'
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

function buildTeamEmailHtml(teamName, ownerName, analysis, memberCount) {
  return `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; color: #2C2C2A;">
      <div style="background: #5C6B3A; padding: 28px 32px; border-radius: 12px 12px 0 0;">
        <p style="color: #c8d4a8; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px;">Team Energie Spiegel</p>
        <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 28px; color: #FDFCFA; margin: 0;">${teamName}</h1>
      </div>
      <div style="background: #F5F0E8; padding: 32px; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #7A7268; line-height: 1.7; margin: 0 0 28px;">
          Hoi ${ownerName}, alle ${memberCount} teamleden hebben de spiegel ingevuld.
          Hieronder vind je de teamanalyse — gebruik hem als gespreksstarter.
        </p>
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
        <div style="background: #5C6B3A; border-radius: 10px; padding: 20px 24px; text-align: center;">
          <p style="font-family: Georgia, serif; font-size: 18px; color: #FDFCFA; margin: 0 0 8px;">Wil je dit verder bespreken?</p>
          <p style="font-size: 13px; color: #c8d4a8; margin: 0 0 16px;">Erik denkt graag 30 minuten mee — vrijblijvend.</p>
          <a href="https://erikvandongen.eu/contact" style="display: inline-block; background: #FDFCFA; color: #2C2C2A; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 50px; text-decoration: none;">Plan een gesprek →</a>
        </div>
        <p style="font-size: 12px; color: #9E9688; margin: 24px 0 0; text-align: center;">
          Team Energie Spiegel · <a href="https://erikvandongen.eu" style="color: #9E9688;">erikvandongen.eu</a>
        </p>
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

  const { teamCode } = req.body
  if (!teamCode) return res.status(400).json({ error: 'Geen teamcode' })

  try {
    const [team] = await sql`SELECT * FROM teams WHERE team_code = ${teamCode}`
    if (!team) return res.status(404).json({ error: 'Team niet gevonden' })

    const entries = await sql`SELECT scores FROM entries WHERE team_code = ${teamCode}`
    if (entries.length === 0) return res.status(400).json({ error: 'Geen entries' })

    const cats = ['Vertrouwen', 'Eigenaarschap', 'Samenwerking', 'Richting', 'Tempo']
    const avgScores = {}
    cats.forEach(cat => {
      const vals = entries.map(e => e.scores[cat] || 3)
      avgScores[cat] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    })

    const analysis = await generateTeamAnalysis(avgScores, entries.length)
    const html = buildTeamEmailHtml(team.team_name, team.owner_name, analysis, entries.length)

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

    await Promise.all(recipients.map(to =>
      fetch('https://api.brevo.com/v3/smtp/email', {
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
    ))

    return res.status(200).json({ success: true, sentTo: recipients.length })
  } catch (err) {
    console.error('notify error:', err)
    return res.status(500).json({ error: 'Serverfout' })
  }
}
