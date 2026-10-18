import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, message } from 'antd'

const fmtNum = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2))

const pad2 = (n) => String(n).padStart(2, '0')
const fmtDateTime = (v) => {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

const jumpRender = (v) => {
  const n = Number(v)
  if (v === null || v === undefined || v === '' || isNaN(n)) return '-'
  return (
    <span style={{ color: n >= 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>
      {n >= 0 ? '+' : ''}{n.toFixed(2)}%
    </span>
  )
}

const yesNo = (v) => (v ? '是' : '否')

const COMPARE_SOURCES = ['信号日比', '历史比']

export default function ProfitGapBreakPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [keyword, setKeyword] = useState('')
  const [compareSource, setCompareSource] = useState('信号日比')

  useEffect(() => {
    fetch('/api/profit-gap-break/dates')
      .then(r => r.json())
      .then(setDates)
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, pageSize: 100 })
      if (date) params.set('date', date)
      if (keyword) params.set('keyword', keyword)
      if (compareSource) params.set('compareSource', compareSource)

      const res = await fetch(`/api/profit-gap-break/stocks?${params}`)
      const json = await res.json()

      if (json.error) throw new Error(json.error)
      setData(json.data || [])
      setTotal(json.total || 0)
      setPage(p)
    } catch (err) {
      message.error('加载数据失败: ' + err.message)
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [date, keyword, compareSource])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const columns = [
    { title: '现价时间', dataIndex: 'current_price_time', key: 'current_price_time', width: 170, render: fmtDateTime },
    { title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120 },
    { title: '股票代码', dataIndex: 'code', key: 'code', width: 110 },
    { title: '股票名称', dataIndex: 'name', key: 'name', width: 130 },
    { title: '交易所', dataIndex: 'exchange', key: 'exchange', width: 90 },
    { title: '比价来源', dataIndex: 'compare_source', key: 'compare_source', width: 100 },
    { title: '今日公告', dataIndex: 'has_today_announcement', key: 'has_today_announcement', width: 100, render: yesNo },
    { title: '昨日公告', dataIndex: 'has_prev_day_announcement', key: 'has_prev_day_announcement', width: 100, render: yesNo },
    { title: '开盘价', dataIndex: 'open_price', key: 'open_price', width: 110, align: 'right', render: fmtNum },
    { title: '昨收', dataIndex: 'prev_close', key: 'prev_close', width: 110, align: 'right', render: fmtNum },
    { title: '高开幅度(%)', dataIndex: 'open_jump_pct', key: 'open_jump_pct', width: 130, align: 'right', render: jumpRender },
    { title: '信号日最高价', dataIndex: 'trade_date_high_price', key: 'trade_date_high_price', width: 130, align: 'right', render: fmtNum },
    { title: '历史最高价', dataIndex: 'history_high_price', key: 'history_high_price', width: 130, align: 'right', render: fmtNum },
    { title: '现价', dataIndex: 'current_price', key: 'current_price', width: 110, align: 'right', render: fmtNum },
    { title: '现价最低', dataIndex: 'current_low_price', key: 'current_low_price', width: 120, align: 'right', render: fmtNum },
    { title: '超出金额', dataIndex: 'exceed_amount', key: 'exceed_amount', width: 120, align: 'right', render: fmtNum },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        <ol>
          <li><code>信号日比</code>：盘中突破信号日最高价（最高价突破、最低价回落）</li>
          <li><code>历史比</code>：当日最高价创历史新高（突破前期高点）</li>
        </ol>
        <div className="rule-title">运行时间：</div>
        <ol>
          <li>从 10:30 开盘后开始，覆盖 <code>10:30 / 12:05 / 13:30 / 14:40</code> 四个时间点</li>
          <li>收盘后全量调度每天 <code>17:15</code> 触发</li>
        </ol>
        <div className="rule-title">数据库表：</div>
        <div><code>ads_sig_net_profit_gap_break_daily</code></div>
      </div>

      <div className="page-header">
        <p>共 {total.toLocaleString()} 条记录</p>
      </div>

      <div className="filter-bar">
        <Select
          allowClear placeholder="交易日" style={{ width: 160 }}
          value={date} onChange={(v) => setDate(v)}
          options={dates.map(d => ({ label: d, value: d }))}
          showSearch filterOption={(input, option) => (option?.label ?? '').includes(input)}
        />
        <Select
          allowClear placeholder="比价来源" style={{ width: 140 }}
          value={compareSource} onChange={(v) => setCompareSource(v)}
          options={COMPARE_SOURCES.map(s => ({ label: s, value: s }))}
        />
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="table-wrapper">
        <div className="table-title">信号明细（按现价时间倒序）</div>
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{
            current: page, pageSize: 100, total,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          scroll={{ x: 1500 }} size="middle"
        />
      </div>
    </>
  )
}
