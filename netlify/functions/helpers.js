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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ====== 回踩和新高 / 其他模式 ======

export async function handleDates(table) {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      `SELECT DISTINCT target_date FROM \`${table}\` ORDER BY target_date DESC`
    )
    return jsonResponse(rows.map(r => formatDate(r.target_date)))
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

export async function handleSectors(table) {
  try {
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
    return jsonResponse([...set].sort())
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

export async function handleStocks(table, req) {
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

    return jsonResponse({ total, page, pageSize, data: formatted })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

// ====== 7天频繁新高 ======

export async function handleNewHighDates() {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      'SELECT DISTINCT window_end_date FROM `ads_sig_new_high_largecap_cnt_15d_d` ORDER BY window_end_date DESC'
    )
    return jsonResponse(rows.map(r => formatDate(r.window_end_date)))
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

export async function handleNewHighStocks(req) {
  try {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 100))
    const date = url.searchParams.get('date') || ''
    const prefix = url.searchParams.get('prefix') || ''
    const period = url.searchParams.get('period') || ''
    const cnt = url.searchParams.get('cnt') || ''
    const keyword = url.searchParams.get('keyword') || ''

    const pool = getPool()
    const conditions = []
    const params = []

    if (date) { conditions.push('t.window_end_date = ?'); params.push(date) }
    if (prefix) { conditions.push('t.stock_code LIKE ?'); params.push(`${prefix}%`) }
    if (period) { conditions.push('t.new_high_period = ?'); params.push(period) }
    if (cnt) { conditions.push('t.cnt >= ?'); params.push(cnt) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`ads_sig_new_high_largecap_cnt_15d_d\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.window_start_date, t.window_end_date, t.new_high_period,
              t.stock_code, t.stock_name, t.cnt
       FROM \`ads_sig_new_high_largecap_cnt_15d_d\` t
       ${where}
       ORDER BY t.window_end_date DESC, t.cnt DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      window_start_date: formatDate(row.window_start_date),
      window_end_date: formatDate(row.window_end_date),
    }))

    return jsonResponse({ total, page, pageSize, data: formatted })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

// ====== 7天首次新高 ======

export async function handleFirstHighDates() {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      'SELECT DISTINCT window_end_date FROM `ads_sig_new_high_largecap_first_times_d` ORDER BY window_end_date DESC'
    )
    return jsonResponse(rows.map(r => formatDate(r.window_end_date)))
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

export async function handleFirstHighFirstDates() {
  try {
    const pool = getPool()
    const cols = ['first_all_time','first_year_5','first_year_4','first_year_3','first_year_2','first_year_1','first_half_year']
    const unionSql = cols.map(c => `SELECT \`${c}\` as d FROM \`ads_sig_new_high_largecap_first_times_d\` WHERE \`${c}\` IS NOT NULL`).join(' UNION ')
    const [rows] = await pool.execute(`SELECT DISTINCT d FROM (${unionSql}) t ORDER BY d DESC`)
    return jsonResponse(rows.map(r => formatDate(r.d)))
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

export async function handleFirstHighStocks(req) {
  try {
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 100))
    const date = url.searchParams.get('date') || ''
    const prefix = url.searchParams.get('prefix') || ''
    const period = url.searchParams.get('period') || ''
    const firstDate = url.searchParams.get('firstDate') || ''
    const keyword = url.searchParams.get('keyword') || ''

    const pool = getPool()

    const unpivotParts = [
      ["'历史新高'", "first_all_time"],
      ["'5年新高'", "first_year_5"],
      ["'4年新高'", "first_year_4"],
      ["'3年新高'", "first_year_3"],
      ["'2年新高'", "first_year_2"],
      ["'1年新高'", "first_year_1"],
      ["'半年新高'", "first_half_year"],
    ]
    const unionSql = unpivotParts.map(([label, col]) =>
      `SELECT id, window_start_date, window_end_date, stock_code, stock_name, ${label} as new_high_period, \`${col}\` as first_date FROM \`ads_sig_new_high_largecap_first_times_d\` WHERE \`${col}\` IS NOT NULL`
    ).join(' UNION ALL ')

    const baseQuery = `FROM (${unionSql}) t`

    const conditions = []
    const params = []

    if (date) { conditions.push('t.window_end_date = ?'); params.push(date) }
    if (prefix) { conditions.push('t.stock_code LIKE ?'); params.push(`${prefix}%`) }
    if (period) { conditions.push('t.new_high_period = ?'); params.push(period) }
    if (firstDate) { conditions.push('t.first_date = ?'); params.push(firstDate) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(`SELECT COUNT(*) as total ${baseQuery} ${where}`, params)
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.window_start_date, t.window_end_date, t.new_high_period,
              t.stock_code, t.stock_name, t.first_date
       ${baseQuery} ${where}
       ORDER BY t.window_end_date DESC, t.first_date ASC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      window_start_date: formatDate(row.window_start_date),
      window_end_date: formatDate(row.window_end_date),
      first_date: formatDate(row.first_date),
    }))

    return jsonResponse({ total, page, pageSize, data: formatted })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}
