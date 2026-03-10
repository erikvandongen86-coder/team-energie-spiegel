// api/analyze.js — AI-analyse genereren via server (voorkomt CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode niet toegestaan' })

  const { categoryScores, memberCount, isTeam } = req.body
  if (!categoryScores) return res.status(400).json({ error: 'Geen scores opgegeven' })

  function classifyScore(score) {
    if (score >= 4) return 'strength'
    if (score >= 3) return 'neutral'
    return 'leak'
  }

  const lines = Object.entries(categoryScores)
    .map(([cat, sc]) => {
      const label = classifyScore(sc) === 'leak' ? 'energielek' : classifyScore(sc) === 'strength' ? 'kracht' : 'neutraal'
      return `${cat}: ${sc}/5 (${label})`
    }).join('\n')

  const context = isTeam
    ? `Dit zijn de GEMIDDELDE scores van ${memberCount || 1} teamleden over hoe zij hun team beleven.`
    : 'Dit zijn de scores van één teamlid over hoe hij of zij het team beleeft. De vragen gingen over het team — niet over de persoon zelf.'

  const perspective = isTeam
    ? 'Schrijf vanuit TEAM-perspectief. Spreek het team als geheel aan met "jullie team" of "het team".'
    : 'Schrijf over het TEAM zoals de invuller dat ervaart. Gebruik "jullie team" of "het team" — nooit "jij" of "je". De invuller heeft vragen beantwoord over het team, niet over zichzelf. Zeg dus niet "jij hebt een sterke drive" maar "jullie team laat zien dat..." of "in jullie team...".'

  const prompt = `Je bent een scherpe, eerlijke teamcoach. ${context}\n\nScores op de Team Energie Spiegel (1-5, 1-2=energielek, 4-5=kracht):\n${lines}\n\n${perspective}\n\nDe vijf categorieën meten:\n- Vertrouwen: of mensen zich veilig voelen om zich uit te spreken\n- Eigenaarschap: of verantwoordelijkheid duidelijk is en opgepakt wordt\n- Samenwerking: of mensen met elkaar praten in plaats van over elkaar\n- Richting: of iedereen weet waar het team naartoe werkt\n- Tempo: of het team voortgang maakt of blijft hangen\n\nSchrijf in het Nederlands:\n1. Diagnose (max 4 zinnen, over het team)\n2. Wat dit betekent (voor het team)\n3. Wat er gebeurt als er niets verandert (in het team)\n4. 3 gespreksvragen voor het team (genummerd)\n\nToon: eerlijk, scherp, herkenbaar. Altijd over het team, nooit over de invuller persoonlijk.\n\nAntwoord ALLEEN in JSON (geen markdown backticks):\n{"diagnose":"...","betekenis":"...","geenVerandering":"...","gespreksvragen":["...","...","..."]}`

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    const data = await apiRes.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    const analysis = JSON.parse(text.replace(/```json|```/g, '').trim())
    return res.status(200).json(analysis)
  } catch (err) {
    console.error('analyze error:', err)
    return res.status(500).json({ error: 'Analyse mislukt' })
  }
}
