import React, { useState, useEffect, useMemo } from 'react'
import { Table, message, DatePicker, Switch } from 'antd'
import dayjs from 'dayjs'
import { LineChart } from './SentimentPage'

const { RangePicker } = DatePicker

const CHART_SERIES = [
  { key: 'bull_pct', label: '看涨(%)', color: '#cf1322' },
  { key: 'bear_pct', label: '看跌(%)', color: '#3f8600' },
  { key: 'flat_pct', label: '横盘(%)', color: '#faad14' },
  { key: 'sz_comp_index', label: '深证综指', color: '#1677ff', axis: 'right' },
]

export default function WeekendVotePage({ apiPath = '/api/weekend-vote/data' }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState(() => [dayjs().subtract(1, 'year'), dayjs()])
  const [showFlat, setShowFlat] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(apiPath)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d || [])
      })
      .catch(err => message.error('加载数据失败: ' + err.message))
      .finally(() => setLoading(false))
  }, [apiPath])

  const dataRange = useMemo(() => {
    if (!data.length) return null
    let min = data[0].vote_date
    let max = data[0].vote_date
    data.forEach(r => {
      if (r.vote_date < min) min = r.vote_date
      if (r.vote_date > max) max = r.vote_date
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
    return data.filter(r => r.vote_date >= s && r.vote_date <= e)
  }, [data, range])

  const columns = [
    {
      title: '投票日期', dataIndex: 'vote_date', key: 'vote_date', fixed: 'left', width: 120,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '看涨(%)', dataIndex: 'bull_pct', key: 'bull_pct', width: 100, align: 'right',
      render: (v) => <span style={{ color: '#cf1322', fontWeight: 600 }}>{v ?? '-'}</span>,
    },
    {
      title: '看跌(%)', dataIndex: 'bear_pct', key: 'bear_pct', width: 100, align: 'right',
      render: (v) => <span style={{ color: '#3f8600', fontWeight: 600 }}>{v ?? '-'}</span>,
    },
    {
      title: '横盘(%)', dataIndex: 'flat_pct', key: 'flat_pct', width: 100, align: 'right',
      render: (v) => (v == null ? '-' : <span style={{ color: '#8c6d1f' }}>{v}%</span>),
    },
    {
      title: '多空差(%)', dataIndex: 'long_short_diff', key: 'long_short_diff', width: 110, align: 'right',
      render: (v) => {
        if (v == null) return '-'
        return <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}%</span>
      },
    },
    {
      title: '深证综指', dataIndex: 'sz_comp_index', key: 'sz_comp_index', width: 110, align: 'right',
      render: (v) => (v == null ? '-' : <span>{v.toFixed(2)}</span>),
    },
    {
      title: '投票人数', dataIndex: 'vote_count', key: 'vote_count', width: 110, align: 'right',
      render: (v) => (v == null ? '-' : <span>{v.toLocaleString()}</span>),
    },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">数据来源：</div>
        <div>「未来5个交易日指数走势」周末投票</div>
        <div className="rule-title">数据库表：</div>
        <div><code>ads_mkt_weekend_vote_d</code></div>
      </div>

      <div className="page-header">
        <p>周末投票（共 {filtered.length} 条记录，{dataRange ? `${dataRange.min} ~ ${dataRange.max}` : '无数据'}）</p>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#666' }}>时间范围：</span>
        <RangePicker
          value={range}
          onChange={(v) => setRange(v)}
          presets={presets}
          allowClear={false}
          format="YYYY-MM-DD"
        />
        <span style={{ fontSize: 12, color: '#999' }}>
          {filtered.length ? `当前范围共 ${filtered.length} 期（${filtered[filtered.length - 1].vote_date} ~ ${filtered[0].vote_date}）` : '当前范围无数据'}
        </span>
      </div>

      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch checked={showFlat} onChange={setShowFlat} size="small" />
        <span style={{ fontSize: 13, color: '#666' }}>显示横盘(%)</span>
      </div>

      <div className="table-wrapper" style={{ marginBottom: 24 }}>
        <LineChart
          data={filtered}
          series={showFlat ? CHART_SERIES : CHART_SERIES.filter(s => s.key !== 'flat_pct')}
          dateKey="vote_date"
        />
      </div>

      <div className="table-wrapper">
        <Table
          rowKey="vote_date" columns={columns} dataSource={filtered} loading={loading}
          pagination={{ pageSize: 100, showSizeChanger: false }}
          scroll={{ x: 760 }} size="middle"
        />
      </div>
    </>
  )
}
