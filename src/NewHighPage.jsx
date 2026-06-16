import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, InputNumber, message } from 'antd'

const PERIOD_OPTIONS = [
  { label: '历史新高', value: '历史新高' },
  { label: '5年新高', value: '5年新高' },
  { label: '4年新高', value: '4年新高' },
  { label: '3年新高', value: '3年新高' },
  { label: '2年新高', value: '2年新高' },
  { label: '1年新高', value: '1年新高' },
  { label: '半年新高', value: '半年新高' },
]

const PREFIX_OPTIONS = [
  { label: '00 (深市主板)', value: '00' },
  { label: '30 (创业板)', value: '30' },
  { label: '60 (沪市主板)', value: '60' },
  { label: '688 (科创板)', value: '688' },
]

const columns = [
  { title: '窗口开始日期', dataIndex: 'window_start_date', key: 'window_start_date', width: 130, sorter: true },
  { title: '窗口结束日期', dataIndex: 'window_end_date', key: 'window_end_date', width: 130, sorter: true },
  { title: '新高维度', dataIndex: 'new_high_period', key: 'new_high_period', width: 120 },
  { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 120, sorter: true },
  { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 120 },
  { title: '新高次数', dataIndex: 'cnt', key: 'cnt', width: 100, sorter: true },
]

export default function NewHighPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [prefix, setPrefix] = useState(undefined)
  const [period, setPeriod] = useState(undefined)
  const [cnt, setCnt] = useState(undefined)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/newhigh/dates')
      .then(r => r.json())
      .then(setDates)
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, pageSize: 100 })
      if (date) params.set('date', date)
      if (prefix) params.set('prefix', prefix)
      if (period) params.set('period', period)
      if (cnt) params.set('cnt', cnt)
      if (keyword) params.set('keyword', keyword)

      const res = await fetch(`/api/newhigh/stocks?${params}`)
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
  }, [date, prefix, period, cnt, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  return (
    <>
      <div className="page-header">
        <p>共 {total.toLocaleString()} 条记录</p>
      </div>

      <div className="filter-bar">
        <Select
          allowClear placeholder="窗口结束日期" style={{ width: 160 }}
          value={date} onChange={(v) => setDate(v)}
          options={dates.map(d => ({ label: d, value: d }))}
          showSearch filterOption={(input, option) => (option?.label ?? '').includes(input)}
        />
        <Select
          allowClear placeholder="新高维度" style={{ width: 140 }}
          value={period} onChange={(v) => setPeriod(v)}
          options={PERIOD_OPTIONS}
        />
        <InputNumber
          placeholder="最低次数" style={{ width: 120 }}
          min={1} value={cnt}
          onChange={(v) => setCnt(v || undefined)}
          allowClear
        />
        <Select
          allowClear placeholder="股票代码前缀" style={{ width: 170 }}
          value={prefix} onChange={(v) => setPrefix(v)}
          options={PREFIX_OPTIONS}
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
          scroll={{ x: 800 }} size="middle"
        />
      </div>
    </>
  )
}
