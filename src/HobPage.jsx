import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, Tag, message } from 'antd'

export default function HobPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [keyword, setKeyword] = useState('')
  const [phase, setPhase] = useState('after_close')

  useEffect(() => {
    fetch('/api/hob/dates')
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
      if (phase && phase !== 'all') params.set('phase', phase)

      const res = await fetch(`/api/hob/stocks?${params}`)
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
  }, [date, keyword, phase])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const columns = [
    { title: '运行时间', dataIndex: 'run_time', key: 'run_time', width: 180 },
    {
      title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120, sorter: true,
      onCell: (record) => {
        const idx = data.findIndex(r => r.id === record.id)
        if (idx === 0 || data[idx - 1].trade_date !== record.trade_date) {
          let rowSpan = 1
          for (let i = idx + 1; i < data.length; i++) {
            if (data[i].trade_date === record.trade_date) rowSpan++
            else break
          }
          return { rowSpan, style: { fontWeight: 600, color: '#1677ff', verticalAlign: 'top' } }
        }
        return { rowSpan: 0 }
      },
    },
    { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 120, sorter: true },
    { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 120 },
    { title: '开盘涨幅(%)', dataIndex: 'open_pnl_pct', key: 'open_pnl_pct', width: 120, sorter: true },
    { title: '涨跌幅(%)', dataIndex: 'change_pct', key: 'change_pct', width: 110, sorter: true },
    { title: '换手率(%)', dataIndex: 'turnover_rate', key: 'turnover_rate', width: 110, sorter: true },
    { title: '流通市值(亿元)', dataIndex: 'float_mkt_cap_amt', key: 'float_mkt_cap_amt', width: 140, sorter: true,
      render: (v) => v ? (v / 1e8).toFixed(2) : '-' },
    { title: '总市值(亿元)', dataIndex: 'total_mkt_cap_amt', key: 'total_mkt_cap_amt', width: 140, sorter: true,
      render: (v) => v ? (v / 1e8).toFixed(2) : '-' },
    { title: '申万行业', dataIndex: 'industry_sw', key: 'industry_sw', width: 140 },
    { title: '证监会行业', dataIndex: 'industry_zjh', key: 'industry_zjh', width: 140 },
    { title: '概念板块', dataIndex: 'concept_sectors', key: 'concept_sectors', width: 300, ellipsis: true },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        <ol>
          <li>高开：开盘价相对前收盘价涨幅 &gt; <code>7%</code></li>
          <li>大阴：当前价（盘中）/ 收盘价（盘后）跌破开盘价</li>
        </ol>
        <div className="rule-title">运行时间：</div>
        <ol>
          <li><code>11:35</code></li>
          <li><code>14:10</code></li>
          <li><code>16:10</code></li>
        </ol>
        <div className="rule-title">原表：</div>
        <div><code>dwd_mkt_hob_signal_d</code></div>
      </div>

      <div className="page-header">
        <p>共 {total.toLocaleString()} 条记录</p>
      </div>

      <div className="filter-bar">
        <Select
          style={{ width: 140 }}
          value={phase} onChange={(v) => setPhase(v)}
          options={[
            { label: '盘后', value: 'after_close' },
            { label: '盘中', value: 'intraday' },
            { label: '全部', value: 'all' },
          ]}
        />
        <Select
          allowClear placeholder="交易日" style={{ width: 160 }}
          value={date} onChange={(v) => setDate(v)}
          options={dates.map(d => ({ label: d, value: d }))}
          showSearch filterOption={(input, option) => (option?.label ?? '').includes(input)}
        />
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="table-wrapper">
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{
            current: page, pageSize: 100, total,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          scroll={{ x: 1680 }} size="middle"
        />
      </div>
    </>
  )
}
