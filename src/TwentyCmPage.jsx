import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, message } from 'antd'

export default function TwentyCmPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/20cm/dates')
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

      const res = await fetch(`/api/20cm/stocks?${params}`)
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
  }, [date, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const columns = [
    {
      title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 140,
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
    { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 160 },
    { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 200 },
  ]

  return (
    <>
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
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        <ol>
          <li>昨日 20cm 涨停 <code>昨收 ÷ 前收 − 1</code> ≥ 19.5%</li>
          <li>今日高开 <code>今开 ÷ 昨收 − 1</code> &gt; 5%</li>
        </ol>
        <div className="rule-title">运行时间：</div>
        <div>工作日 12:00 运行</div>
        <div className="rule-title">数据来源：</div>
        <div><code>dwd_sig_20cm_di</code></div>
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
          scroll={{ x: 600 }} size="middle"
        />
      </div>
    </>
  )
}
