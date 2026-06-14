// 本地开发服务器，模拟 Netlify Functions 的 API
import 'dotenv/config'
import express from 'express'
import mysql from 'mysql2/promise'

const app = express()
const PORT = 3001

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
})

// 表名映射
const TABLES = {
  huicai: 'aads_回踩和新高表',
  qita: 'aads_其他模式',
}

function formatDate(d) {
  if (!d) return null
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(d) {
  if (!d) return null
  const dt = new Date(d)
  return `${formatDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`
}

Object.entries(TABLES).forEach(([key, table]) => {
  const p = `/api/${key}`

  app.get(`${p}/dates`, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT DISTINCT target_date FROM \`${table}\` ORDER BY target_date DESC`
      )
      res.json(rows.map(r => formatDate(r.target_date)))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get(`${p}/sectors`, async (req, res) => {
    try {
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
      res.json([...set].sort())
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get(`${p}/stocks`, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1)
      const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
      const date = req.query.date || ''
      const level = req.query.level || ''
      const prefix = req.query.prefix || ''
      const sector = req.query.sector || ''
      const keyword = req.query.keyword || ''

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

      res.json({ total, page, pageSize, data: formatted })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
})

// 7天频繁新高 API
app.get('/api/newhigh/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT window_end_date FROM `ads_sig_new_high_largecap_cnt_15d_d` ORDER BY window_end_date DESC'
    )
    res.json(rows.map(r => formatDate(r.window_end_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/newhigh/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const prefix = req.query.prefix || ''
    const period = req.query.period || ''
    const cnt = req.query.cnt || ''
    const keyword = req.query.keyword || ''

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

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 7天首次新高 API
app.get('/api/firsthigh/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT window_end_date FROM `ads_sig_new_high_largecap_first_times_d` ORDER BY window_end_date DESC'
    )
    res.json(rows.map(r => formatDate(r.window_end_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/firsthigh/first-dates', async (req, res) => {
  try {
    const cols = ['first_all_time','first_year_5','first_year_4','first_year_3','first_year_2','first_year_1','first_half_year']
    const unionSql = cols.map(c => `SELECT \`${c}\` as d FROM \`ads_sig_new_high_largecap_first_times_d\` WHERE \`${c}\` IS NOT NULL`).join(' UNION ')
    const [rows] = await pool.execute(`SELECT DISTINCT d FROM (${unionSql}) t ORDER BY d DESC`)
    res.json(rows.map(r => formatDate(r.d)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/firsthigh/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const prefix = req.query.prefix || ''
    const period = req.query.period || ''
    const firstDate = req.query.firstDate || ''
    const keyword = req.query.keyword || ''

    // UNPIVOT: 把 first_* 列转成行
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

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`)
})
