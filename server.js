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

  app.get(`${p}/source-tables`, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT DISTINCT source_table FROM \`${table}\` WHERE source_table IS NOT NULL AND source_table != ''`
      )
      const set = new Set()
      rows.forEach(r => {
        r.source_table.split('、').forEach(s => {
          const trimmed = s.trim()
          if (trimmed) set.add(trimmed)
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
      const sourceTable = req.query.sourceTable || ''
      const keyword = req.query.keyword || ''

      const conditions = []
      const params = []

      const excludeStandalone = req.query.excludeStandalone === '1'
      const excludeSoleSource = req.query.excludeSoleSource || ''

      if (date) { conditions.push('t.target_date = ?'); params.push(date) }
      if (level) { conditions.push('t.opportunity_level = ?'); params.push(level) }
      if (prefix) { conditions.push('t.stock_code LIKE ?'); params.push(`${prefix}%`) }
      if (sector) {
        const sectors = sector.split(',').filter(Boolean)
        const sectorConds = sectors.map(() => "FIND_IN_SET(?, REPLACE(t.sector_names, ';', ','))")
        conditions.push('(' + sectorConds.join(' OR ') + ')')
        sectors.forEach(s => params.push(s))
      }
      if (sourceTable) {
        const tables = sourceTable.split(',').filter(Boolean)
        tables.forEach(t => {
          conditions.push("FIND_IN_SET(?, REPLACE(t.source_table, '、', ','))")
          params.push(t)
        })
        if (excludeStandalone) {
          conditions.push("t.source_table LIKE '%、%'")
        }
      }
      if (excludeSoleSource) { conditions.push('TRIM(t.source_table) <> ?'); params.push(excludeSoleSource) }
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

// 实时涨跌 API
app.get('/api/sentiment/data', async (req, res) => {
  try {
    const [data] = await pool.execute(
      `SELECT id, trade_date, snap_time, up_cnt, down_cnt, flat_cnt, total_cnt,
              limit_up_cnt, limit_down_cnt, limit_level,
              max_board_cnt, board_level, avg_chg_pct, median_chg_pct
       FROM \`dws_mkt_sentiment_d\`
       ORDER BY COALESCE(snap_time, trade_date) DESC`
    )
    const formatSnap = (d) => {
      if (!d) return null
      const dt = new Date(d)
      const y = dt.getFullYear()
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      const h = String(dt.getHours()).padStart(2, '0')
      const min = String(dt.getMinutes()).padStart(2, '0')
      return `${y}-${m}-${day} ${h}:${min}`
    }
    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      snap_time: formatSnap(row.snap_time) || formatDate(row.trade_date),
      avg_chg_pct: row.avg_chg_pct != null ? Number(row.avg_chg_pct).toFixed(2) : null,
      median_chg_pct: row.median_chg_pct != null ? Number(row.median_chg_pct).toFixed(2) : null,
    }))
    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 盘后涨跌 API（取每天最后一次快照）
app.get('/api/sentiment/after-hours', async (req, res) => {
  try {
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.snap_time, t.up_cnt, t.down_cnt, t.flat_cnt, t.total_cnt,
              t.limit_up_cnt, t.limit_down_cnt, t.limit_level,
              t.max_board_cnt, t.board_level, t.avg_chg_pct, t.median_chg_pct
       FROM dws_mkt_sentiment_d t
       INNER JOIN (
         SELECT DATE(snap_time) as d, MAX(snap_time) as max_snap
         FROM dws_mkt_sentiment_d
         WHERE snap_time IS NOT NULL
         GROUP BY DATE(snap_time)
       ) m ON t.snap_time = m.max_snap
       ORDER BY t.snap_time DESC`
    )
    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      snap_time: formatDate(row.snap_time) || formatDate(row.trade_date),
      avg_chg_pct: row.avg_chg_pct != null ? Number(row.avg_chg_pct).toFixed(2) : null,
      median_chg_pct: row.median_chg_pct != null ? Number(row.median_chg_pct).toFixed(2) : null,
    }))
    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 板块排行 API
const SECTOR_TABLE = 'ods_spider_xgt_sector_di'

app.get(`/api/sector-rank/dates`, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trading_date FROM \`${SECTOR_TABLE}\` ORDER BY trading_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trading_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get(`/api/sector-rank/industries`, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT industry_name FROM \`${SECTOR_TABLE}\` ORDER BY industry_name`
    )
    res.json(rows.map(r => r.industry_name))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get(`/api/sector-rank/data`, async (req, res) => {
  try {
    const industryName = req.query.industryName || ''
    const tradingDate = req.query.tradingDate || ''
    const resultPhase = req.query.resultPhase || ''

    const conditions = []
    const params = []

    if (industryName) { conditions.push('industry_name LIKE ?'); params.push(`%${industryName}%`) }
    if (tradingDate) { conditions.push('trading_date = ?'); params.push(tradingDate) }
    if (resultPhase) { conditions.push('result_phase = ?'); params.push(resultPhase) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [data] = await pool.execute(
      `SELECT id, industry_name, zt_number, trading_date, result_phase
       FROM \`${SECTOR_TABLE}\`
       ${where}
       ORDER BY trading_date DESC, zt_number DESC`,
      params
    )

    const formatted = data.map(row => ({
      ...row,
      trading_date: formatDate(row.trading_date),
    }))

    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 连扳潜伏 API
const LIANBAN_TABLE = 'dwd_mkt_lb_signal_d'

app.get('/api/lianban/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${LIANBAN_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/lianban/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const boardType = req.query.boardType || ''
    const keyword = req.query.keyword || ''
    const isYizi = req.query.isYizi || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (boardType) { conditions.push('t.board_type = ?'); params.push(boardType) }
    if (isYizi) { conditions.push('t.is_yizi = ?'); params.push(Number(isYizi)) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${LIANBAN_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.stock_code, t.stock_name, t.board_type,
              t.limit_up_days, t.limit_up_stat, t.change_pct,
              t.first_seal_time, t.last_seal_time, t.seal_fund_amt,
              t.float_mkt_cap_amt, t.total_mkt_cap_amt,
              t.industry_sw, t.industry_zjh, t.concept_sectors, t.is_yizi
       FROM \`${LIANBAN_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.limit_up_days DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      first_seal_time: row.first_seal_time ? String(row.first_seal_time).slice(0, 8) : null,
      last_seal_time: row.last_seal_time ? String(row.last_seal_time).slice(0, 8) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 高开大阴 API
const HOB_TABLE = 'dwd_mkt_hob_signal_d'

app.get('/api/hob/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${HOB_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/hob/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const keyword = req.query.keyword || ''
    const phase = req.query.phase || 'after_close'

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }
    if (phase && phase !== 'all') { conditions.push('t.phase = ?'); params.push(phase) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${HOB_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.run_time, t.stock_code, t.stock_name,
              t.open_pnl_pct, t.change_pct, t.turnover_rate,
              t.float_mkt_cap_amt, t.total_mkt_cap_amt,
              t.industry_sw, t.industry_zjh, t.concept_sectors
       FROM \`${HOB_TABLE}\` t
       ${where}
       ORDER BY t.run_time DESC, t.open_pnl_pct DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      run_time: formatDateTime(row.run_time),
      open_pnl_pct: row.open_pnl_pct != null ? Number(row.open_pnl_pct) : null,
      change_pct: row.change_pct != null ? Number(row.change_pct) : null,
      turnover_rate: row.turnover_rate != null ? Number(row.turnover_rate) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 活跃炸板 API
const ZB_TABLE = 'dwd_mkt_zb_signal_d'

app.get('/api/zb/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${ZB_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/zb/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const boardType = req.query.boardType || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (boardType) { conditions.push('t.board_type = ?'); params.push(boardType) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${ZB_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.stock_code, t.stock_name, t.board_type,
              t.limit_pct, t.last_price, t.limit_up_price, t.change_pct,
              t.turnover_rate, t.turnover_amt, t.limit_up_stat, t.first_seal_time,
              t.open_board_cnt, t.limit_up_cnt_20d,
              t.float_mkt_cap_amt, t.total_mkt_cap_amt,
              t.industry_sw, t.industry_zjh, t.concept_sectors
       FROM \`${ZB_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.open_board_cnt DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      change_pct: row.change_pct != null ? Number(row.change_pct) : null,
      turnover_rate: row.turnover_rate != null ? Number(row.turnover_rate) : null,
      limit_pct: row.limit_pct != null ? Number(row.limit_pct) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 510 下影线交叉均线 API
const LOWER_SHADOW_TABLE = 'dwd_mkt_lower_shadow_cross_ma_d'

app.get('/api/lower-shadow/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${LOWER_SHADOW_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/lower-shadow/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const boardType = req.query.boardType || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (boardType) { conditions.push('t.board_type = ?'); params.push(boardType) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${LOWER_SHADOW_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.stock_code, t.stock_name, t.board_type,
              t.prev_close, t.open_price, t.high_price, t.low_price, t.close_price,
              t.lower_shadow, t.ma5, t.ma10, t.cross_price,
              t.break_ma5_pct, t.break_ma10_pct, t.change_pct, t.zt_cnt,
              t.industry_sw, t.concept_sectors
       FROM \`${LOWER_SHADOW_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      change_pct: row.change_pct != null ? Number(row.change_pct) : null,
      break_ma5_pct: row.break_ma5_pct != null ? Number(row.break_ma5_pct) : null,
      break_ma10_pct: row.break_ma10_pct != null ? Number(row.break_ma10_pct) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 板块RPS API
const SECTOR_RPS_TABLE = 'dwd_mkt_index_rps_d'

app.get('/api/sector-rps/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${SECTOR_RPS_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sector-rps/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const exchange = req.query.exchange || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (exchange) { conditions.push('t.exchange = ?'); params.push(exchange) }
    if (keyword) { conditions.push('(t.index_code LIKE ? OR t.index_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${SECTOR_RPS_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.index_code, t.index_name, t.exchange,
              t.close_price, t.volume, t.amount,
              t.rps_5d, t.rps_10d, t.rps_15d, t.rps_20d, t.rps_50d,
              t.rank_5d, t.rank_10d, t.rank_15d, t.rank_20d, t.rank_50d,
              t.red_cnt, t.is_triple_red
       FROM \`${SECTOR_RPS_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.rps_50d DESC, t.index_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      close_price: row.close_price != null ? Number(row.close_price) : null,
      rps_5d: row.rps_5d != null ? Number(row.rps_5d) : null,
      rps_10d: row.rps_10d != null ? Number(row.rps_10d) : null,
      rps_15d: row.rps_15d != null ? Number(row.rps_15d) : null,
      rps_20d: row.rps_20d != null ? Number(row.rps_20d) : null,
      rps_50d: row.rps_50d != null ? Number(row.rps_50d) : null,
      amount: row.amount != null ? Number(row.amount) : null,
      volume: row.volume != null ? Number(row.volume) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 个股RPS API
const STOCK_RPS_TABLE = 'dwd_mkt_stock_rps_d'
// RPS 表本身没有股票名称，从板块映射表取（同一代码名称唯一）
const STOCK_NAME_SUBQUERY =
  '(SELECT stock_code, MIN(stock_name) AS stock_name FROM `marry_stock_sector_2639` GROUP BY stock_code)'
const STOCK_RPS_COLUMNS = `t.trade_date, t.stock_code, t.close_price,
  t.rps_5d, t.rps_10d, t.rps_20d, t.rps_50d, t.rps_120d, t.rps_250d,
  t.is_red_5d, t.is_red_10d, t.is_red_20d, t.is_red_50d, t.is_red_120d, t.is_red_250d,
  t.red_cnt, t.is_triple_red`

app.get('/api/stock-rps/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${STOCK_RPS_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/stock-rps/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (keyword) {
      conditions.push(`(CONVERT(t.stock_code USING utf8mb4) COLLATE utf8mb4_general_ci LIKE ?
        OR CONVERT(nm.stock_name USING utf8mb4) COLLATE utf8mb4_general_ci LIKE ?)`)
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const countJoin = keyword ? `LEFT JOIN ${STOCK_NAME_SUBQUERY} nm ON nm.stock_code = t.stock_code` : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${STOCK_RPS_TABLE}\` t ${countJoin} ${where}`, params,
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    // 无关键词时先按索引排序取一页，再关联名称，避免对 380 万行整体排序
    const dataSql = keyword
      ? `SELECT ${STOCK_RPS_COLUMNS}, nm.stock_name
         FROM \`${STOCK_RPS_TABLE}\` t
         LEFT JOIN ${STOCK_NAME_SUBQUERY} nm ON nm.stock_code = t.stock_code
         ${where}
         ORDER BY t.trade_date DESC, t.rps_50d DESC, t.stock_code ASC
         LIMIT ? OFFSET ?`
      : `SELECT d.*, nm.stock_name
         FROM (
           SELECT ${STOCK_RPS_COLUMNS}
           FROM \`${STOCK_RPS_TABLE}\` t
           ${where}
           ORDER BY t.trade_date DESC, t.rps_50d DESC, t.stock_code ASC
           LIMIT ? OFFSET ?
         ) d
         LEFT JOIN ${STOCK_NAME_SUBQUERY} nm ON nm.stock_code = d.stock_code
         ORDER BY d.trade_date DESC, d.rps_50d DESC, d.stock_code ASC`

    const [data] = await pool.execute(dataSql, [...params, String(pageSize), String(offset)])

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      close_price: row.close_price != null ? Number(row.close_price) : null,
      rps_5d: row.rps_5d != null ? Number(row.rps_5d) : null,
      rps_10d: row.rps_10d != null ? Number(row.rps_10d) : null,
      rps_20d: row.rps_20d != null ? Number(row.rps_20d) : null,
      rps_50d: row.rps_50d != null ? Number(row.rps_50d) : null,
      rps_120d: row.rps_120d != null ? Number(row.rps_120d) : null,
      rps_250d: row.rps_250d != null ? Number(row.rps_250d) : null,
      is_red_5d: row.is_red_5d != null ? Number(row.is_red_5d) : null,
      is_red_10d: row.is_red_10d != null ? Number(row.is_red_10d) : null,
      is_red_20d: row.is_red_20d != null ? Number(row.is_red_20d) : null,
      is_red_50d: row.is_red_50d != null ? Number(row.is_red_50d) : null,
      is_red_120d: row.is_red_120d != null ? Number(row.is_red_120d) : null,
      is_red_250d: row.is_red_250d != null ? Number(row.is_red_250d) : null,
      red_cnt: row.red_cnt != null ? Number(row.red_cnt) : null,
      is_triple_red: row.is_triple_red != null ? Number(row.is_triple_red) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 20冰点活跃 API
const TWENTY_CM_TABLE = 'dwd_sig_20cm_di'

app.get('/api/20cm/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${TWENTY_CM_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/20cm/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${TWENTY_CM_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.stock_code, t.stock_name
       FROM \`${TWENTY_CM_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 利润断层 API
const PROFIT_GAP_TABLE = 'ads_sig_net_profit_gap_daily'

app.get('/api/profit-gap/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${PROFIT_GAP_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 次数小表：仅出现 >= 2 次的股票，按次数降序
app.get('/api/profit-gap/counts', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT code, MAX(name) AS name, COUNT(*) AS cnt
       FROM \`${PROFIT_GAP_TABLE}\`
       GROUP BY code
       HAVING COUNT(*) >= 2
       ORDER BY cnt DESC, code ASC`
    )
    res.json(rows.map(r => ({ code: r.code, name: r.name, cnt: Number(r.cnt) })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 明细表：按交易日倒序
app.get('/api/profit-gap/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (keyword) { conditions.push('(t.code LIKE ? OR t.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${PROFIT_GAP_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.code, t.name, t.exchange,
              t.has_today_announcement, t.has_prev_day_announcement,
              t.open_price, t.prev_close, t.open_jump_pct
       FROM \`${PROFIT_GAP_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 利润断层突破 API
const PROFIT_GAP_BREAK_TABLE = 'ads_sig_net_profit_gap_break_daily'
const PROFIT_GAP_BREAK_COMBINED = '信号日比+历史比'

app.get('/api/profit-gap-break/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${PROFIT_GAP_BREAK_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/profit-gap-break/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const keyword = req.query.keyword || ''
    const compareSource = req.query.compareSource || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (keyword) { conditions.push('(t.code LIKE ? OR t.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }
    if (compareSource === PROFIT_GAP_BREAK_COMBINED) {
      conditions.push('t.compare_source IN (?, ?)')
      params.push('信号日比', '历史比')
    } else if (compareSource) { conditions.push('t.compare_source = ?'); params.push(compareSource) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${PROFIT_GAP_BREAK_TABLE}\` t ${where}`, params,
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.code, t.secid, t.compare_source, t.name, t.exchange,
              t.has_today_announcement, t.has_prev_day_announcement,
              t.open_price, t.prev_close, t.open_jump_pct,
              t.trade_date_high_price, t.history_high_price,
              t.current_price, t.current_low_price, t.current_price_time,
              t.exceed_amount
       FROM \`${PROFIT_GAP_BREAK_TABLE}\` t
       ${where}
       ORDER BY t.current_price_time DESC, t.code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 中期指数 API
const MIDTERM_INDEX_TABLE = 'dwd_mkt_midterm_index_signal_w'

app.get('/api/midterm-index/data', async (req, res) => {
  try {
    const weeks = Math.max(0, parseInt(req.query.weeks) || 0)

    let where = ''
    const params = []
    if (weeks > 0) {
      where = `WHERE week_date >= (
        SELECT week_date FROM (
          SELECT DISTINCT week_date FROM \`${MIDTERM_INDEX_TABLE}\`
          ORDER BY week_date DESC LIMIT 1 OFFSET ?
        ) t
      )`
      params.push(String(weeks - 1))
    }

    const [data] = await pool.execute(
      `SELECT id, week_date, index_code, index_name, close_price,
              hhv_4w, llv_4w, is_buy_signal, is_end_signal
       FROM \`${MIDTERM_INDEX_TABLE}\`
       ${where}
       ORDER BY week_date DESC, index_code ASC`,
      params
    )

    const formatted = data.map(row => ({
      ...row,
      week_date: formatDate(row.week_date),
      close_price: row.close_price != null ? Number(row.close_price) : null,
      hhv_4w: row.hhv_4w != null ? Number(row.hhv_4w) : null,
      llv_4w: row.llv_4w != null ? Number(row.llv_4w) : null,
      is_buy_signal: Number(row.is_buy_signal) === 1,
      is_end_signal: Number(row.is_end_signal) === 1,
    }))

    res.json({ data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 月线反转 API
const YXFZ_TABLE = 'ads_mkt_yxfz_signal_d'

app.get('/api/yxfz/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${YXFZ_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/yxfz/sources', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT source_name, COUNT(*) AS cnt FROM \`${YXFZ_TABLE}\` GROUP BY source_name ORDER BY cnt DESC`
    )
    res.json(rows.map(r => ({ name: r.source_name, count: Number(r.cnt) })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/yxfz/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const keyword = req.query.keyword || ''
    const sourceName = req.query.sourceName || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }
    if (sourceName) { conditions.push('t.source_name = ?'); params.push(sourceName) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${YXFZ_TABLE}\` t ${where}`, params,
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.stock_code, t.stock_name, t.exchange, t.close_price,
              t.rps50, t.rps120, t.fyx1, t.fyx2, t.fyx3, t.fyx4, t.fyx5, t.fyx6, t.fyx7,
              t.yxfz, t.is_first_in_15d, t.first_signal_date, t.signal_type, t.source_name
       FROM \`${YXFZ_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => {
      const out = {
        ...row,
        trade_date: formatDate(row.trade_date),
        first_signal_date: formatDate(row.first_signal_date),
        close_price: row.close_price != null ? Number(row.close_price) : null,
        rps50: row.rps50 != null ? Number(row.rps50) : null,
        rps120: row.rps120 != null ? Number(row.rps120) : null,
        yxfz: Number(row.yxfz) === 1,
        is_first_in_15d: Number(row.is_first_in_15d) === 1,
      }
      for (let i = 1; i <= 7; i++) out[`fyx${i}`] = Number(row[`fyx${i}`]) === 1
      return out
    })

    res.json({ data: formatted, total, page, pageSize })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 一字 API
const ONE_WORD_BOARD_TABLE = 'dwd_mkt_one_word_board_d'

app.get('/api/one-word-board/dates', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT trade_date FROM \`${ONE_WORD_BOARD_TABLE}\` ORDER BY trade_date DESC`
    )
    res.json(rows.map(r => formatDate(r.trade_date)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/one-word-board/stocks', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 100))
    const date = req.query.date || ''
    const boardType = req.query.boardType || ''
    const keyword = req.query.keyword || ''

    const conditions = []
    const params = []

    if (date) { conditions.push('t.trade_date = ?'); params.push(date) }
    if (boardType) { conditions.push('t.board_type = ?'); params.push(boardType) }
    if (keyword) { conditions.push('(t.stock_code LIKE ? OR t.stock_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM \`${ONE_WORD_BOARD_TABLE}\` t ${where}`, params
    )
    const total = countRows[0].total

    const offset = (page - 1) * pageSize
    const [data] = await pool.execute(
      `SELECT t.id, t.trade_date, t.stock_code, t.stock_name, t.exchange, t.board_type,
              t.limit_pct, t.industry_name, t.prev_close_price, t.open_price, t.high_price,
              t.low_price, t.close_price, t.limit_up_price, t.change_pct,
              t.limit_up_days, t.limit_up_stat, t.first_seal_time, t.last_seal_time,
              t.break_cnt, t.trade_amt, t.turnover_rate, t.seal_fund_amt,
              t.float_mkt_cap_amt, t.total_mkt_cap_amt
       FROM \`${ONE_WORD_BOARD_TABLE}\` t
       ${where}
       ORDER BY t.trade_date DESC, t.limit_up_days DESC, t.stock_code ASC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    )

    const formatted = data.map(row => ({
      ...row,
      trade_date: formatDate(row.trade_date),
      first_seal_time: row.first_seal_time ? String(row.first_seal_time).slice(0, 8) : null,
      last_seal_time: row.last_seal_time ? String(row.last_seal_time).slice(0, 8) : null,
      limit_pct: row.limit_pct != null ? Number(row.limit_pct) : null,
      prev_close_price: row.prev_close_price != null ? Number(row.prev_close_price) : null,
      open_price: row.open_price != null ? Number(row.open_price) : null,
      high_price: row.high_price != null ? Number(row.high_price) : null,
      low_price: row.low_price != null ? Number(row.low_price) : null,
      close_price: row.close_price != null ? Number(row.close_price) : null,
      limit_up_price: row.limit_up_price != null ? Number(row.limit_up_price) : null,
      change_pct: row.change_pct != null ? Number(row.change_pct) : null,
      turnover_rate: row.turnover_rate != null ? Number(row.turnover_rate) : null,
    }))

    res.json({ total, page, pageSize, data: formatted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 周末投票 API
const WEEKEND_VOTE_TABLE = 'ads_mkt_weekend_vote_d'

app.get('/api/weekend-vote/data', async (req, res) => {
  try {
    const [data] = await pool.execute(
      `SELECT vote_date, bull_pct, bear_pct, flat_pct,
              sz_comp_index, long_short_diff, vote_count
       FROM \`${WEEKEND_VOTE_TABLE}\`
       ORDER BY vote_date DESC`
    )

    const formatted = data.map(row => ({
      vote_date: formatDate(row.vote_date),
      bull_pct: row.bull_pct != null ? Number(row.bull_pct) : null,
      bear_pct: row.bear_pct != null ? Number(row.bear_pct) : null,
      flat_pct: row.flat_pct != null ? Number(row.flat_pct) : null,
      sz_comp_index: row.sz_comp_index != null ? Number(row.sz_comp_index) : null,
      long_short_diff: row.long_short_diff != null ? Number(row.long_short_diff) : null,
      vote_count: row.vote_count != null ? Number(row.vote_count) : null,
    }))

    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`)
})
