import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, Tag, message } from 'antd'

const BOARD_TYPE_OPTIONS = [
  { label: '主板 (main)', value: 'main' },
  { label: '创业板 (cyb)', value: 'cyb' },
  { label: '科创板 (kcb)', value: 'kcb' },
]

export default function LowerShadowPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [boardType, setBoardType] = useState(undefined)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/lower-shadow/dates')
      .then(r => r.json())
      .then(setDates)
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, pageSize: 100 })
      if (date) params.set('date', date)
      if (boardType) params.set('boardType', boardType)
      if (keyword) params.set('keyword', keyword)

      const res = await fetch(`/api/lower-shadow/stocks?${params}`)
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
  }, [date, boardType, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const columns = [
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
    {
      title: '板块类型', dataIndex: 'board_type', key: 'board_type', width: 120,
      render: (v) => <Tag color="blue">{v || '-'}</Tag>,
    },
    { title: '昨收', dataIndex: 'prev_close', key: 'prev_close', width: 100, sorter: true },
    { title: '开盘价', dataIndex: 'open_price', key: 'open_price', width: 100, sorter: true },
    { title: '最高价', dataIndex: 'high_price', key: 'high_price', width: 100, sorter: true },
    { title: '最低价', dataIndex: 'low_price', key: 'low_price', width: 100, sorter: true },
    { title: '收盘价', dataIndex: 'close_price', key: 'close_price', width: 100, sorter: true },
    { title: '下影线', dataIndex: 'lower_shadow', key: 'lower_shadow', width: 100, sorter: true },
    { title: 'MA5', dataIndex: 'ma5', key: 'ma5', width: 100, sorter: true },
    { title: 'MA10', dataIndex: 'ma10', key: 'ma10', width: 100, sorter: true },
    { title: '交叉价', dataIndex: 'cross_price', key: 'cross_price', width: 100, sorter: true },
    { title: '跌破MA5(%)', dataIndex: 'break_ma5_pct', key: 'break_ma5_pct', width: 120, sorter: true },
    { title: '跌破MA10(%)', dataIndex: 'break_ma10_pct', key: 'break_ma10_pct', width: 120, sorter: true },
    { title: '涨跌幅(%)', dataIndex: 'change_pct', key: 'change_pct', width: 110, sorter: true },
    { title: '涨停次数', dataIndex: 'zt_cnt', key: 'zt_cnt', width: 100, sorter: true },
    { title: '申万行业', dataIndex: 'industry_sw', key: 'industry_sw', width: 200, ellipsis: true },
    { title: '概念板块', dataIndex: 'concept_sectors', key: 'concept_sectors', width: 300, ellipsis: true },
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
        <Select
          allowClear placeholder="板块类型" style={{ width: 160 }}
          value={boardType} onChange={(v) => setBoardType(v)}
          options={BOARD_TYPE_OPTIONS}
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
          scroll={{ x: 2400 }} size="middle"
        />
      </div>
    </>
  )
}
