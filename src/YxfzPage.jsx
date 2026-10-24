import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, message } from 'antd'

const fmtNum = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2))

const yesNo = (v) => (v ? '是' : '否')

export default function YxfzPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [sources, setSources] = useState([])
  const [date, setDate] = useState(undefined)
  const [keyword, setKeyword] = useState('')
  const [sourceName, setSourceName] = useState(undefined)

  useEffect(() => {
    fetch('/api/yxfz/dates')
      .then(r => r.json())
      .then(setDates)
      .catch(() => {})
    fetch('/api/yxfz/sources')
      .then(r => r.json())
      .then(setSources)
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, pageSize: 100 })
      if (date) params.set('date', date)
      if (keyword) params.set('keyword', keyword)
      if (sourceName) params.set('sourceName', sourceName)

      const res = await fetch(`/api/yxfz/stocks?${params}`)
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
  }, [date, keyword, sourceName])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const columns = [
    { title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 110 },
    { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 110 },
    { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 130 },
    { title: '交易所', dataIndex: 'exchange', key: 'exchange', width: 80 },
    { title: '收盘价', dataIndex: 'close_price', key: 'close_price', width: 100, align: 'right', render: fmtNum },
    { title: 'RPS50', dataIndex: 'rps50', key: 'rps50', width: 90, align: 'right', render: fmtNum },
    { title: 'RPS120', dataIndex: 'rps120', key: 'rps120', width: 90, align: 'right', render: fmtNum },
    { title: '15日内首次', dataIndex: 'is_first_in_15d', key: 'is_first_in_15d', width: 110, align: 'center', render: yesNo },
    { title: '首次信号日', dataIndex: 'first_signal_date', key: 'first_signal_date', width: 120 },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">数据库表：</div>
        <div><code>ads_mkt_yxfz_signal_d</code></div>
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
          allowClear placeholder="来源" style={{ width: 220 }}
          value={sourceName} onChange={(v) => setSourceName(v)}
          options={sources.map(s => ({ label: `${s.name}（${s.count}）`, value: s.name }))}
        />
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="table-wrapper">
        <div className="table-title">信号明细（按交易日倒序）</div>
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{
            current: page, pageSize: 100, total,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          scroll={{ x: 1000 }} size="middle"
        />
      </div>
    </>
  )
}
