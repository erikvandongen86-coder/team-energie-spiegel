// api/tester.js — testersfeedback opslaan
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'POST') {
    const {
      anonymous, name,
      eersteReactie, doelgroep,
      teamGetest,
      invulErvaring, invulToelichting,
      aantalVragen, aantalVragenOpmerking,
      aantalVragenBetrouwbaar, aantalVragenAdvies,
      blokkade, sterkste,
      analyseLengte, analyseTaal, analyseOpmerking,
      inzettenKeuze,
      teamAnalyseLengte, teamAnalyseTaal,
      teamAanmaken, teamAanmakenToelichting,
      inzetten, mist, overig
    } = req.body

    try {
      await sql`
        INSERT INTO tester_responses (
          anonymous, name,
          eerste_reactie, doelgroep,
          team_getest,
          invul_ervaring, invul_toelichting,
          aantal_vragen, aantal_vragen_opmerking,
          aantal_vragen_betrouwbaar, aantal_vragen_advies,
          blokkade, sterkste,
          analyse_lengte, analyse_taal, analyse_opmerking,
          inzetten_keuze,
          team_analyse_lengte, team_analyse_taal,
          team_aanmaken, team_aanmaken_toelichting,
          inzetten, mist, overig
        ) VALUES (
          ${anonymous}, ${anonymous ? null : name},
          ${eersteReactie||null}, ${doelgroep||null},
          ${teamGetest||null},
          ${invulErvaring||null}, ${invulToelichting||null},
          ${aantalVragen||null}, ${aantalVragenOpmerking||null},
          ${aantalVragenBetrouwbaar||null}, ${aantalVragenAdvies||null},
          ${blokkade||null}, ${sterkste||null},
          ${analyseLengte||null}, ${analyseTaal||null}, ${analyseOpmerking||null},
          ${inzettenKeuze||null},
          ${teamAnalyseLengte||null}, ${teamAnalyseTaal||null},
          ${teamAanmaken||null}, ${teamAanmakenToelichting||null},
          ${inzetten||null}, ${mist||null}, ${overig||null}
        )
      `
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('tester error:', err)
      return res.status(500).json({ error: 'Serverfout' })
    }
  }

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM tester_responses ORDER BY created_at DESC`
      return res.status(200).json(rows)
    } catch (err) {
      return res.status(500).json({ error: 'Serverfout' })
    }
  }

  return res.status(405).json({ error: 'Methode niet toegestaan' })
}
