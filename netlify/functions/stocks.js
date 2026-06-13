import { getPool } from './db.js'

export default async (req) => {
  try {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 100))
    const date = url.searchParams.get('date') || ''
    const level = url.searchParams.get('level') || ''
    const prefix = url.searchParams.get('prefix') || ''
    const sector = url.searchParams.get('sector') || ''
    const keyword = url.searchParams.get('keyword') || ''

    const pool = getPool()
    const conditions = []
    const params = []

    if (date) {
      conditions.push('t.target_date = ?')
      params.push(date)
    }
    if (level) {
      conditions.push('t.opportunity_level = ?')
      params.push(level)
    }
    if (prefix) {
      conditions.push('t.stock_code LIKE ?')
      params.push(`${prefix}%`)
    }
    if (sector) {
      conditions.push("FIND_IN_SET(?, REPLACE(t.sector_names, ';', ','))")
      params.push(sector)
    }
    if (keyword) {
      conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)')
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // 先按 target_date + stock_code 去重，取每组最新一条
    const baseQuery = `
      FROM \`aads_回踩和新高表\` t
      INNER JOIN (
        SELECT MAX(id) as max_id
        FROM \`aads_回踩和新高表\`
        GROUP BY target_date, stock_code
      ) dedup ON t.id = dedup.max_id
      ${where}
    `

    // 查总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total ${baseQuery}`,
      params
    )
    const total = countRows[0].total

    // 查数据
    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.target_date, t.opportunity_level, t.fall_count,
              t.sh_index_kdj_j, t.stock_code, t.stock_name, t.sector_names,
              t.model, t.source_table, t.created_at
       ${baseQuery}
       ORDER BY t.target_date DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    // 格式化日期字段
    const formatted = data.map(row => ({
      ...row,
      target_date: row.target_date ? new Date(row.target_date).toISOString().slice(0, 10) : null,
      created_at: row.created_at ? new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ') : null,
    }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total, page, pageSize, data: formatted }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}

export const config = {
  path: '/api/stocks',
}
