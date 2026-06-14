module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.query
  const client_id = process.env.SPOTIFY_CLIENT_ID
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!client_id || !client_secret) {
    return res.status(500).json({ error: 'Spotify credentials not configured' })
  }

  const baseParams = { client_id, client_secret }

  if (action === 'token') {
    const { code, redirect_uri, code_verifier } = req.body
    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({ error: 'Missing required params: code, redirect_uri, code_verifier' })
    }
    const body = new URLSearchParams({
      ...baseParams,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      code_verifier,
    })
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await resp.json()
    return res.status(resp.status).json(data)
  }

  if (action === 'refresh') {
    const { refresh_token } = req.body
    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token' })
    }
    const body = new URLSearchParams({
      ...baseParams,
      grant_type: 'refresh_token',
      refresh_token,
    })
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await resp.json()
    return res.status(resp.status).json(data)
  }

  return res.status(400).json({ error: 'Invalid action. Use ?action=token or ?action=refresh' })
}
