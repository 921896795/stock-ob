import { getPool } from './db.js'

export default async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      "SELECT DISTINCT sector_names FROM `aads_回踩和新高表` WHERE sector_names IS NOT NULL AND sector_names != ''"
    )
    const set = new Set()
    rows.forEach(r => {
      r.sector_names.split(';').forEach(s => {
        const trimmed = s.trim()
        if (trimmed && trimmed.length > 4) set.add(trimmed)
      })
    })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([...set].sort()),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}

export const config = {
  path: '/api/sectors',
}
