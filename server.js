// 本地开发服务器，模拟 Netlify Functions 的 API
import 'dotenv/config'
import express from 'express'
import mysql from 'mysql2/promise'

const app = express()
const PORT = 3001

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
})

// 获取板块列表（拆分分号后去重）
app.get('/api/sectors', async (req, res) => {
  try {
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
    res.json([...set].sort())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取可用日期列表
app.get('/api/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT target_date FROM `aads_回踩和新高表` ORDER BY target_date DESC'
    )
    // 格式化为 YYYY-MM-DD（避免时区偏移）
    res.json(rows.map(r => {
      const d = new Date(r.target_date)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 查询股票数据（去重 + 筛选 + 分页）
app.get('/api/stocks', async (req, res) => {
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

    const baseQuery = `
      FROM \`aads_回踩和新高表\` t
      INNER JOIN (
        SELECT MAX(id) as max_id
        FROM \`aads_回踩和新高表\`
        GROUP BY target_date, stock_code
      ) dedup ON t.id = dedup.max_id
      ${where}
    `

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total ${baseQuery}`,
      params
    )
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

    // 格式化日期字段（避免时区偏移）
    const formatDate = (d) => {
      if (!d) return null
      const dt = new Date(d)
      const y = dt.getFullYear()
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const formatDateTime = (d) => {
      if (!d) return null
      const dt = new Date(d)
      return `${formatDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`
    }
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

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`)
})
