import React, { useState, useEffect, useMemo } from 'react'
import { Table, message, DatePicker } from 'antd'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const MAJOR_INDEXES = [
  { code: '000001', name: '上证指数', desc: '沪市整体' },
  { code: '399001', name: '深证成指', desc: '深市主板' },
  { code: '399106', name: '深证综指', desc: '深市整体' },
  { code: '000300', name: '沪深300', desc: '沪深两市大盘股' },
  { code: '000016', name: '上证50', desc: '沪市超大盘' },
  { code: '000688', name: '科创50', desc: '科创板龙头' },
  { code: '399006', name: '创业板指', desc: '创业板龙头' },
  { code: '399102', name: '创业板综', desc: '创业板整体' },
  { code: '399905', name: '中证500', desc: '中盘股' },
  { code: '000852', name: '中证1000', desc: '小盘股' },
]

const SERIES = [
  { key: 'buy', color: '#ff4d4f', name: '买入信号' },
  { key: 'end', color: '#52c41a', name: '结束信号' },
  { key: 'none', color: '#bfbfbf', name: '无信号' },
]

function SignalChart({ stats }) {
  const [hover, setHover] = useState(null)
  const W = 1200
  const H = 300
  const padL = 44
  const padR = 20
  const padT = 20
  const padB = 56
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const n = stats.length
  const maxY = Math.max(1, ...stats.map(s => Math.max(s.buy, s.end, s.none)))
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1))
  const y = (v) => padT + innerH - (innerH * v) / maxY
  const poly = (key) => stats.map((s, i) => `${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(' ')
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxY * i) / 4))
  const labelEvery = Math.max(1, Math.ceil(n / 12))

  // 标签索引：均匀采样 + 强制包含最后一个（最新日期）
  const labelIdx = new Set()
  for (let i = 0; i < n; i += labelEvery) labelIdx.add(i)
  if (n > 0) labelIdx.add(n - 1)

  const slotW = n > 0 ? innerW / n : innerW
  const cur = hover != null ? stats[hover] : null
  const tw = 168
  const th = 84
  const tx = cur ? Math.min(Math.max(x(hover) - tw / 2, padL), W - padR - tw) : 0
  const ty = padT + 6

  return (
    <div onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#eee" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#888">{t}</text>
          </g>
        ))}
        {stats.map((s, i) => (labelIdx.has(i) ? (
          <text
            key={i} x={x(i)} y={H - padB + 16} textAnchor="end" fontSize={10} fill="#888"
            transform={`rotate(-40 ${x(i)} ${H - padB + 16})`}
          >
            {s.date.slice(0, 7)}
          </text>
        ) : null))}
        {SERIES.map(se => (
          <polyline key={se.key} points={poly(se.key)} fill="none" stroke={se.color} strokeWidth={2} />
        ))}
        {cur && (
          <line
            x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH}
            stroke="#555" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none"
          />
        )}
        {SERIES.map(se => stats.map((s, i) => {
          const active = hover === i
          return (
            <circle
              key={se.key + i} cx={x(i)} cy={y(s[se.key])} r={active ? 4.5 : 2.5}
              fill={se.color} stroke={active ? '#fff' : 'none'} strokeWidth={active ? 1.5 : 0}
              pointerEvents="none"
            />
          )
        }))}
        {cur && (
          <g pointerEvents="none">
            <rect x={tx} y={ty} width={tw} height={th} rx={6} fill="rgba(0,0,0,0.82)" />
            <text x={tx + 12} y={ty + 21} fontSize={13} fill="#fff" fontWeight={600}>{cur.date}</text>
            {SERIES.map((se, k) => (
              <g key={se.key}>
                <rect x={tx + 12} y={ty + 36 + k * 16 - 8} width={10} height={10} rx={2} fill={se.color} />
                <text x={tx + 28} y={ty + 36 + k * 16} fontSize={12} fill="#fff">
                  {se.name}：{cur[se.key]}
                </text>
              </g>
            ))}
          </g>
        )}
        {stats.map((s, i) => (
          <rect
            key={'hz' + i} x={padL + slotW * i} y={padT} width={slotW} height={innerH}
            fill="transparent" onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  )
}

export default function MidTermIndexPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState(() => [dayjs().subtract(1, 'year'), dayjs()])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/midterm-index/data?weeks=0')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.data || [])
    } catch (err) {
      message.error('加载数据失败: ' + err.message)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const indexes = useMemo(() => {
    const map = {}
    data.forEach(r => {
      if (!map[r.index_code]) map[r.index_code] = { code: r.index_code, name: r.index_name }
    })
    const majorOrder = Object.fromEntries(MAJOR_INDEXES.map((m, i) => [m.code, i]))
    return Object.values(map).sort((a, b) => {
      const am = majorOrder[a.code]
      const bm = majorOrder[b.code]
      if (am !== undefined && bm !== undefined) return am - bm
      if (am !== undefined) return -1
      if (bm !== undefined) return 1
      return a.code.localeCompare(b.code)
    })
  }, [data])

  const dataRange = useMemo(() => {
    if (!data.length) return null
    let min = data[0].week_date
    let max = data[0].week_date
    data.forEach(r => {
      if (r.week_date < min) min = r.week_date
      if (r.week_date > max) max = r.week_date
    })
    return { min, max }
  }, [data])

  const presets = useMemo(() => {
    const t = dayjs()
    const list = [
      { label: '最近一年', value: [t.subtract(1, 'year'), t] },
      { label: '最近两年', value: [t.subtract(2, 'year'), t] },
      { label: '最近三年', value: [t.subtract(3, 'year'), t] },
    ]
    if (dataRange) list.push({ label: '全部时间', value: [dayjs(dataRange.min), dayjs(dataRange.max)] })
    return list
  }, [dataRange])

  const filtered = useMemo(() => {
    if (!range || range.length !== 2 || !range[0] || !range[1]) return data
    const s = range[0].format('YYYY-MM-DD')
    const e = range[1].format('YYYY-MM-DD')
    return data.filter(r => r.week_date >= s && r.week_date <= e)
  }, [data, range])

  const stats = useMemo(() => {
    const byDate = {}
    filtered.forEach(r => {
      if (!byDate[r.week_date]) byDate[r.week_date] = { date: r.week_date, buy: 0, end: 0, none: 0 }
      if (r.is_buy_signal) byDate[r.week_date].buy++
      else if (r.is_end_signal) byDate[r.week_date].end++
      else byDate[r.week_date].none++
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  const rows = useMemo(() => {
    const byDate = {}
    filtered.forEach(r => {
      if (!byDate[r.week_date]) byDate[r.week_date] = { key: r.week_date, week_date: r.week_date }
      byDate[r.week_date][r.index_code] = r
    })
    return Object.values(byDate).sort((a, b) => b.week_date.localeCompare(a.week_date))
  }, [filtered])

  const majorStats = useMemo(() => {
    const majorCodes = new Set(MAJOR_INDEXES.map(m => m.code))
    const byDate = {}
    filtered.forEach(r => {
      if (!majorCodes.has(r.index_code)) return
      if (!byDate[r.week_date]) byDate[r.week_date] = { date: r.week_date, buy: 0, end: 0, none: 0 }
      if (r.is_buy_signal) byDate[r.week_date].buy++
      else if (r.is_end_signal) byDate[r.week_date].end++
      else byDate[r.week_date].none++
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  const renderCell = (record) => {
    if (!record) return null
    const isBuy = record.is_buy_signal
    const isEnd = record.is_end_signal
    if (!isBuy && !isEnd) return null
    const bg = isBuy ? '#ff4d4f' : '#52c41a'
    return <div style={{ width: '100%', height: 18, borderRadius: 3, background: bg }} />
  }

  const columns = [
    {
      title: '日期', dataIndex: 'week_date', key: 'week_date', fixed: 'left', width: 110,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    ...indexes.map(ix => ({
      title: (
        <div>
          <div style={{ fontWeight: 600 }}>{ix.code}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{ix.name}</div>
        </div>
      ),
      dataIndex: ix.code, key: ix.code, width: 72, align: 'center',
      render: (record) => renderCell(record),
    })),
  ]

  return (
    <>
      <div className="page-header">
        <p>中期指数信号（共 {indexes.length} 个指数，红色=买入信号，绿色=结束信号）</p>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#666' }}>时间范围：</span>
        <RangePicker
          value={range}
          onChange={(v) => { if (v && v[0] && v[1]) setRange(v) }}
          presets={presets}
          allowClear={false}
          format="YYYY-MM-DD"
        />
        <span style={{ fontSize: 12, color: '#999' }}>
          当前范围共 {stats.length} 个交易日（{stats.length ? `${stats[0].date} ~ ${stats[stats.length - 1].date}` : '无数据'}）
        </span>
      </div>

      <div style={{ marginBottom: 8, display: 'flex', gap: 20, alignItems: 'center' }}>
        {SERIES.map(se => (
          <span key={se.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 16, height: 3, background: se.color, display: 'inline-block', borderRadius: 2 }} />
            {se.name}
          </span>
        ))}
        <span style={{ fontSize: 12, color: '#999' }}>（每日各信号的指数数量，鼠标悬停查看具体数值）</span>
      </div>

      <div className="table-wrapper" style={{ marginBottom: 24 }}>
        <SignalChart stats={stats} />
      </div>

      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>大指数信号数量</span>
        <span style={{ fontSize: 12, color: '#999' }}>（仅统计上述 10 个大指数，颜色含义同上，鼠标悬停查看具体数值）</span>
      </div>

      <div className="table-wrapper" style={{ marginBottom: 24 }}>
        <SignalChart stats={majorStats} />
      </div>

      <div className="table-wrapper">
        <Table
          rowKey="week_date" columns={columns} dataSource={rows} loading={loading}
          pagination={false}
          scroll={{ x: 'max-content', y: 600 }} size="small"
        />
      </div>
    </>
  )
}
