// api.js — alle calls naar onze serverless backend

const BASE = '/api'

export async function apiCreateTeam(teamData) {
  const res = await fetch(`${BASE}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamData),
  })
  if (!res.ok) throw new Error('Aanmaken team mislukt')
  return res.json()
}

export async function apiGetTeam(teamCode) {
  const res = await fetch(`${BASE}/teams?code=${teamCode}`)
  if (!res.ok) return null
  return res.json()
}

export async function apiSaveEntry(teamCode, sessionId, scores, email) {
  const res = await fetch(`${BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode, sessionId, scores, email }),
  })
  if (!res.ok) throw new Error('Opslaan resultaat mislukt')
  return res.json()
}

export async function apiGetEntries(teamCode) {
  const res = await fetch(`${BASE}/entries?code=${teamCode}`)
  if (!res.ok) return []
  return res.json()
}

export async function apiValidateOwner(teamCode, ownerToken) {
  const res = await fetch(`${BASE}/owner?code=${teamCode}&token=${ownerToken}`)
  if (!res.ok) return false
  const data = await res.json()
  return data.valid === true
}

export async function apiSaveEmail(teamCode, sessionId, name, email, wantsTeamAnalysis) {
  const res = await fetch(`${BASE}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode, sessionId, name, email, wantsTeamAnalysis }),
  })
  if (!res.ok) throw new Error('Opslaan email mislukt')
  return res.json()
}
