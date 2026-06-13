import { getPool } from './db.js'

export function formatDate(d) {
  if (!d) return null
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(d) {
  if (!d) return null
  const dt = new Date(d)
  return `${formatDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`
}

export async function handleDates(table) {
  const pool = getPool()
  const [rows] = await pool.execute(
    `SELECT DISTINCT target_date FROM \`${table}\` ORDER BY target_date DESC`
  )
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows.map(r => formatDate(r.target_date))),
  }
}

export async function handleSectors(table) {
  const pool = getPool()
  const [rows] = await pool.execute(
    `SELECT DISTINCT sector_names FROM \`${table}\` WHERE sector_names IS NOT NULL AND sector_names != ''`
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
}

export async function handleStocks(table, req) {
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

  if (date) { conditions.push('t.target_date = ?'); params.push(date) }
  if (level) { conditions.push('t.opportunity_level = ?'); params.push(level) }
  if (prefix) { conditions.push('t.stock_code LIKE ?'); params.push(`${prefix}%`) }
  if (sector) { conditions.push("FIND_IN_SET(?, REPLACE(t.sector_names, ';', ','))"); params.push(sector) }
  if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const baseQuery = `
    FROM \`${table}\` t
    INNER JOIN (
      SELECT MAX(id) as max_id FROM \`${table}\` GROUP BY target_date, stock_code
    ) dedup ON t.id = dedup.max_id
    ${where}
  `

  const [countRows] = await pool.execute(`SELECT COUNT(*) as total ${baseQuery}`, params)
  const total = countRows[0].total

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

  const formatted = data.map(row => ({
    ...row,
    target_date: formatDate(row.target_date),
    created_at: formatDateTime(row.created_at),
  }))

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ total, page, pageSize, data: formatted }),
  }
}
