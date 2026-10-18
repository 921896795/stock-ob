import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Table, Switch, message } from 'antd'

const GROUPS = [
  {
    title: '涨跌家数',
    metrics: [
      { key: 'up_cnt', label: '上涨家数', color: '#cf1322' },
      { key: 'down_cnt', label: '下跌家数', color: '#3f8600' },
      { key: 'flat_cnt', label: '平盘家数' },
    ],
  },
  {
    title: '涨跌停与连板',
    metrics: [
      { key: 'limit_up_cnt', label: '涨停家数', color: '#cf1322' },
      { key: 'limit_down_cnt', label: '跌停家数', color: '#3f8600' },
      { key: 'max_board_cnt', label: '连板高度' },
    ],
  },
  {
    title: '全A涨跌幅',
    metrics: [
      { key: 'avg_chg_pct', label: '全A平均涨跌幅(%)', colorFn: (v) => v >= 0 ? '#cf1322' : '#3f8600', suffix: '%' },
      { key: 'median_chg_pct', label: '全A涨跌幅中位数(%)', colorFn: (v) => v >= 0 ? '#cf1322' : '#3f8600', suffix: '%' },
    ],
  },
]

const GROUP_SERIES = {
  '涨跌家数': [
    { key: 'up_cnt', label: '上涨家数', color: '#cf1322' },
    { key: 'down_cnt', label: '下跌家数', color: '#3f8600' },
  ],
  '涨跌停与连板': [
    { key: 'limit_up_cnt', label: '涨停家数', color: '#cf1322' },
    { key: 'limit_down_cnt', label: '跌停家数', color: '#3f8600' },
    { key: 'max_board_cnt', label: '连板高度', color: '#1677ff', axis: 'right' },
  ],
  '全A涨跌幅': [
    { key: 'avg_chg_pct', label: '全A平均涨跌幅(%)', color: '#cf1322' },
    { key: 'median_chg_pct', label: '全A涨跌幅中位数(%)', color: '#1677ff' },
  ],
}

const REF_LINES = {
  '涨跌家数': [
    { value: 1000, label: '冰点线 1000', color: '#faad14' },
  ],
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function niceScale(min, max, ticks = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const b = Number.isFinite(max) ? max : 1
    return { min: b - 1, max: b + 1, step: 1 }
  }
  const rough = (max - min) / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step }
}

const fmtTick = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000))

function useContainerWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setWidth(w)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function LineChart({ data, series, refLines = [], height = 320 }) {
  const [boxRef, width] = useContainerWidth()
  const [hoverIdx, setHoverIdx] = useState(null)

  const points = useMemo(
    () => [...data].sort((a, b) => (a.snap_time < b.snap_time ? -1 : 1)),
    [data]
  )

  const leftSeries = series.filter(s => s.axis !== 'right')
  const rightSeries = series.filter(s => s.axis === 'right')
  const hasRight = rightSeries.length > 0

  const padL = 56, padR = hasRight ? 52 : 20, padT = 16, padB = 44
  const innerW = Math.max(width - padL - padR, 10)
  const innerH = height - padT - padB

  const makeScale = (list) => {
    const vals = []
    points.forEach(p => list.forEach(s => {
      const v = num(p[s.key])
      if (v != null) vals.push(v)
    }))
    const lo = Math.min(0, ...(vals.length ? vals : [0]))
    const hi = Math.max(0, ...(vals.length ? vals : [1]))
    return niceScale(lo, hi)
  }

  const leftScale = useMemo(() => makeScale(leftSeries), [points, series])
  const rightScale = useMemo(() => (hasRight ? makeScale(rightSeries) : null), [points, series])

  const x = (i) => padL + (points.length <= 1 ? innerW / 2 : (innerW * i) / (points.length - 1))
  const yL = (v) => padT + innerH - ((v - leftScale.min) / (leftScale.max - leftScale.min)) * innerH
  const yR = (v) => padT + innerH - ((v - rightScale.min) / (rightScale.max - rightScale.min)) * innerH
  const yOf = (s, v) => (s.axis === 'right' ? yR(v) : yL(v))

  const ticksOf = (scale) => {
    const out = []
    for (let v = scale.min; v <= scale.max + 1e-9; v += scale.step) out.push(Math.round(v * 1000) / 1000)
    return out
  }
  const yTicks = ticksOf(leftScale)
  const rTicks = rightScale ? ticksOf(rightScale) : []

  const labelStep = Math.max(1, Math.ceil(points.length / 12))

  const buildPath = (key) => {
    let started = false
    const parts = []
    points.forEach((p, i) => {
      const v = num(p[key])
      if (v == null) { started = false; return }
      const sv = series.find(s => s.key === key)
      parts.push(`${started ? 'L' : 'M'}${x(i)},${yOf(sv, v)}`)
      started = true
    })
    return parts.join(' ')
  }

  const handleMove = (e) => {
    if (!points.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    let idx = 0, best = Infinity
    for (let i = 0; i < points.length; i++) {
      const dx = Math.abs(x(i) - px)
      if (dx < best) { best = dx; idx = i }
    }
    setHoverIdx(idx)
  }

  const hover = hoverIdx != null ? points[hoverIdx] : null
  const tipW = 196
  const tipX = hover
    ? Math.min(Math.max(x(hoverIdx) - tipW / 2, padL), padL + innerW - tipW)
    : 0

  return (
    <div ref={boxRef} style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 20, padding: '0 4px 8px', fontSize: 13, color: '#595959', flexWrap: 'wrap' }}>
        {series.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 3, background: s.color, display: 'inline-block', borderRadius: 2 }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        {yTicks.map((t, i) => (
          <g key={'l' + i}>
            <line x1={padL} x2={padL + innerW} y1={yL(t)} y2={yL(t)} stroke={t === 0 ? '#d9d9d9' : '#f0f0f0'} />
            <text x={padL - 8} y={yL(t) + 4} textAnchor="end" fontSize="11" fill="#8c8c8c">{fmtTick(t)}</text>
          </g>
        ))}
        {rTicks.map((t, i) => (
          <text key={'r' + i} x={padL + innerW + 8} y={yR(t) + 4} textAnchor="start" fontSize="11" fill="#1677ff">{fmtTick(t)}</text>
        ))}
        {points.map((d, i) =>
          (i % labelStep === 0 || i === points.length - 1) ? (
            <text key={d.snap_time} x={x(i)} y={height - 16} textAnchor="middle" fontSize="11" fill="#8c8c8c">
              {String(d.snap_time).slice(5)}
            </text>
          ) : null
        )}
        {series.map(s => (
          <path key={s.key} d={buildPath(s.key)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}
        {refLines.map((rl, i) => (
          <g key={'ref' + i}>
            <line x1={padL} x2={padL + innerW} y1={yL(rl.value)} y2={yL(rl.value)} stroke={rl.color} strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={padL + innerW - 4} y={yL(rl.value) - 6} textAnchor="end" fontSize="11" fill={rl.color}>{rl.label}</text>
          </g>
        ))}
        {hover && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={padT + innerH} stroke="#bfbfbf" strokeDasharray="4 4" />
            {series.map(s => {
              const v = num(hover[s.key])
              return v == null ? null : (
                <circle key={s.key} cx={x(hoverIdx)} cy={yOf(s, v)} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2" />
              )
            })}
            <rect x={tipX} y={padT} width={tipW} height={26 + series.length * 17} rx="6" fill="rgba(0,0,0,0.78)" />
            <text x={tipX + 12} y={padT + 22} fontSize="12" fill="#fff" fontWeight="600">{hover.snap_time}</text>
            {series.map((s, i) => (
              <text key={s.key} x={tipX + 12} y={padT + 42 + i * 17} fontSize="12" fill="#fff">
                {s.label}: {hover[s.key] ?? '-'}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}


export default function SentimentPage({ apiPath = '/api/sentiment/data' }) {
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(false)
  const [onlyIce, setOnlyIce] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(apiPath)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRawData(d || [])
      })
      .catch(err => message.error('加载数据失败: ' + err.message))
      .finally(() => setLoading(false))
  }, [apiPath])

  const filtered = useMemo(() => {
    return onlyIce ? rawData.filter(d => d.up_cnt < 1000) : rawData
  }, [rawData, onlyIce])

  const weakDates = useMemo(() => {
    return new Set(filtered.filter(d => d.up_cnt < 1000).map(d => d.snap_time))
  }, [filtered])

  // 公共列定义
  const columns = useMemo(() => {
    const dateCols = filtered.map(d => {
      const isWeak = weakDates.has(d.snap_time)
      return {
        title: d.snap_time,
        dataIndex: d.snap_time,
        key: d.snap_time,
        width: 160,
        align: 'center',
        onCell: () => ({
          style: isWeak ? { backgroundColor: '#f0fff0' } : {},
        }),
      }
    })
    return [
      { title: '指标', dataIndex: 'label', key: 'label', width: 180, fixed: 'left' },
      ...dateCols,
    ]
  }, [filtered, weakDates])

  // 根据分组生成 dataSource
  const groupData = useMemo(() => {
    return GROUPS.map(group => {
      const rows = group.metrics.map(m => {
        const row = { key: m.key, label: m.label }
        filtered.forEach(d => {
          let val = d[m.key]
          if (m.suffix && val != null) val = val + m.suffix
          row[d.snap_time] = val ?? '-'
        })
        return row
      })
      return { title: group.title, metrics: group.metrics, rows }
    })
  }, [filtered])

  // 给单元格加颜色的 render
  const makeRender = (metric, isWeakCol) => (val) => {
    if (isWeakCol) {
      return <span style={{ color: '#595959', fontWeight: 600 }}>{val}</span>
    }
    if (metric?.colorFn) {
      const numVal = parseFloat(val)
      return <span style={{ color: metric.colorFn(numVal), fontWeight: 600 }}>{val}</span>
    }
    if (metric?.color) {
      return <span style={{ color: metric.color, fontWeight: 600 }}>{val}</span>
    }
    return val
  }

  return (
    <>
      <div className="page-header">
        <p>
          共 {rawData.length} 个交易日
          <span style={{ marginLeft: 24 }}>
            <Switch checked={onlyIce} onChange={setOnlyIce} size="small" />
            <span style={{ marginLeft: 8, fontSize: 14 }}>只看冰点</span>
          </span>
        </p>
      </div>

      {groupData.map(group => {
        const coloredCols = columns.map(col => {
          if (col.key === 'label') return col
          const isWeak = weakDates.has(col.key)
          return {
            ...col,
            render: (val, record) => {
              const metric = group.metrics.find(m => m.key === record.key)
              return makeRender(metric, isWeak)(val)
            },
          }
        })

        return (
          <div key={group.title} style={{
            background: '#fff',
            borderRadius: 8,
            marginBottom: 16,
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 24px',
              fontWeight: 600,
              fontSize: 14,
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa',
            }}>
              {group.title}
            </div>
            <div style={{ padding: '12px 24px 16px' }}>
              {GROUP_SERIES[group.title] && (
                <div style={{ marginBottom: 16 }}>
                  <LineChart data={filtered} series={GROUP_SERIES[group.title]} refLines={REF_LINES[group.title] || []} />
                </div>
              )}
              <Table
                rowKey="key"
                columns={coloredCols}
                dataSource={group.rows}
                loading={loading}
                pagination={false}
                scroll={{ x: 300 + filtered.length * 160 }}
                size="middle"
              />
            </div>
          </div>
        )
      })}
    </>
  )
}
