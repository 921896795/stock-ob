import { getPool } from './db.js'

export default async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      'SELECT DISTINCT target_date FROM `aads_回踩和新高表` ORDER BY target_date DESC'
    )
    // 格式化为 YYYY-MM-DD
    const dates = rows.map(r => {
      const d = new Date(r.target_date)
      return d.toISOString().slice(0, 10)
    })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dates),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}

export const config = {
  path: '/api/dates',
}
