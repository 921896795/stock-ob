import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Table, Select, Input, Tag, message } from 'antd'

const fmtNum = (v, digits = 2) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(digits))

const fmtYi = (v) => (v === null || v === undefined || v === '' ? '-' : (Number(v) / 1e8).toFixed(2))

// antd 5 中 sorter: true 不会做本地排序，这里自己排序以保证与「交易日」合并单元格一致
const cmpValue = (av, bv) => {
  if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : -1
  if (bv === null || bv === undefined) return 1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv))
}

const EXCHANGE_OPTIONS = [
  { label: '上交所 (SH)', value: 'SH' },
  { label: '深交所 (SZ)', value: 'SZ' },
]

const RPS_COLS = [5, 10, 15, 20, 50]

export default function SectorRpsPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [exchange, setExchange] = useState(undefined)
  const [keyword, setKeyword] = useState('')
  const [sortField, setSortField] = useState(null)
  const [sortOrder, setSortOrder] = useState(null)

  // 自己维护排序结果，避免 antd 内部排序后「交易日」rowSpan 仍按原始顺序计算导致列错位
  const sortedData = useMemo(() => {
    if (!sortField || !sortOrder) return data
    const sorted = [...data].sort((a, b) => cmpValue(a[sortField], b[sortField]))
    return sortOrder === 'descend' ? sorted.reverse() : sorted
  }, [data, sortField, sortOrder])

  const sp = (key) => ({ sorter: true, sortOrder: sortField === key ? sortOrder : null })

  useEffect(() => {
    fetch('/api/sector-rps/dates')
      .then(r => r.json())
      .then(setDates)
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, pageSize: 100 })
      if (date) params.set('date', date)
      if (exchange) params.set('exchange', exchange)
      if (keyword) params.set('keyword', keyword)

      const res = await fetch(`/api/sector-rps/stocks?${params}`)
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
  }, [date, exchange, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const columns = [
    {
      title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120, ...sp('trade_date'),
      onCell: (record) => {
        const idx = sortedData.findIndex(r => r.id === record.id)
        if (idx === 0 || sortedData[idx - 1].trade_date !== record.trade_date) {
          let rowSpan = 1
          for (let i = idx + 1; i < sortedData.length; i++) {
            if (sortedData[i].trade_date === record.trade_date) rowSpan++
            else break
          }
          return { rowSpan, style: { fontWeight: 600, color: '#1677ff', verticalAlign: 'top' } }
        }
        return { rowSpan: 0 }
      },
    },
    { title: '指数代码', dataIndex: 'index_code', key: 'index_code', width: 120 },
    { title: '指数名称', dataIndex: 'index_name', key: 'index_name', width: 140 },
    {
      title: '交易所', dataIndex: 'exchange', key: 'exchange', width: 90,
      render: (v) => <Tag>{v || '-'}</Tag>,
    },
    {
      title: '三连红', dataIndex: 'is_triple_red', key: 'is_triple_red', width: 90, align: 'center', ...sp('is_triple_red'),
      render: (v) => (v
        ? <span style={{ color: '#cf1322', fontWeight: 600 }}>是</span>
        : <span style={{ color: '#8c8c8c' }}>否</span>),
    },
    { title: '成交额(亿)', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: fmtYi, ...sp('amount') },
    { title: '收盘价', dataIndex: 'close_price', key: 'close_price', width: 100, align: 'right', render: fmtNum, ...sp('close_price') },
    ...RPS_COLS.map(n => ([
      {
        title: `RPS${n}日`, dataIndex: `rps_${n}d`, key: `rps_${n}d`, width: 100, align: 'right', render: fmtNum, ...sp(`rps_${n}d`),
      },
      {
        title: `排名${n}日`, dataIndex: `rank_${n}d`, key: `rank_${n}d`, width: 100, align: 'right', ...sp(`rank_${n}d`),
      },
    ])).flat(),
    { title: '红K数', dataIndex: 'red_cnt', key: 'red_cnt', width: 90, align: 'right', ...sp('red_cnt') },
    { title: '成交量(亿手)', dataIndex: 'volume', key: 'volume', width: 130, align: 'right', render: fmtYi, ...sp('volume') },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        <div className="rule-title">五条周期：</div>
        <ol>
          <li><code>RPS5</code>：5 日涨幅排名</li>
          <li><code>RPS10</code>：10 日涨幅排名</li>
          <li><code>RPS15</code>：15 日涨幅排名</li>
          <li><code>RPS20</code>：20 日涨幅排名</li>
          <li><code>RPS50</code>：50 日涨幅排名</li>
        </ol>
        <div>不使用 120 / 250 周期（通达信原版才有）。</div>

        <div className="rule-title">翻红（单条信号）</div>
        <ol>
          <li>阈值 <code>M = 96</code>：<code>RPS ≥ 96</code> 即该条「翻红」</li>
          <li>对应样本前 4%（598 × 4% ≈ 24 只）</li>
          <li>每条周期各有一列 <code>is_red_xxd</code>，并汇总为 <code>red_cnt</code>（翻红列数）</li>
        </ol>

        <div className="rule-title">三线翻红（组合信号）</div>
        <ol>
          <li>取 5/10/15/20 四条，≥ 3 条 <code>RPS ≥ 90</code>（阈值 T）即成立</li>
          <li>附加条件：该信号需在 20 个交易日内首次出现（<code>BARSSINCEN(...,20)=0</code> 等价实现），即 <code>is_first_occurrence(series, i, 20)</code></li>
          <li>仅用 5/10/15/20，不含 50 日</li>
        </ol>

        <div className="rule-title">数据库表：</div>
        <div><code>dwd_mkt_index_rps_d</code></div>
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
          allowClear placeholder="交易所" style={{ width: 160 }}
          value={exchange} onChange={(v) => setExchange(v)}
          options={EXCHANGE_OPTIONS}
        />
        <Input.Search
          placeholder="搜索指数代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="table-wrapper">
        <Table
          rowKey="id" columns={columns} dataSource={sortedData} loading={loading}
          onChange={(_, __, sorter) => {
            setSortField(sorter.order ? sorter.columnKey : null)
            setSortOrder(sorter.order || null)
          }}
          pagination={{
            current: page, pageSize: 100, total,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          scroll={{ x: 1900 }} size="middle"
        />
      </div>
    </>
  )
}
