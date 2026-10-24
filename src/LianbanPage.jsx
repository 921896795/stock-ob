import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, Tag, message } from 'antd'

const BOARD_TYPE_OPTIONS = [
  { label: '主板 (main)', value: 'main' },
  { label: '创业板 (cyb)', value: 'cyb' },
  { label: '科创板 (kcb)', value: 'kcb' },
]

export default function LianbanPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [boardType, setBoardType] = useState(undefined)
  const [isYizi, setIsYizi] = useState(undefined)
  const [keyword, setKeyword] = useState('')

  // 按交易日分组计算每组最大连板数，用于标红
  const maxLimitUpDaysByDate = {}
  data.forEach(r => {
    const d = r.trade_date
    if (!(d in maxLimitUpDaysByDate) || (r.limit_up_days || 0) > maxLimitUpDaysByDate[d]) {
      maxLimitUpDaysByDate[d] = r.limit_up_days || 0
    }
  })

  const columns = [
    {
      title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120, sorter: true,
      onCell: (record) => {
        // 合并相同日期的单元格
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
    { title: '连板数', dataIndex: 'limit_up_days', key: 'limit_up_days', width: 100, sorter: true },
    { title: '涨停统计', dataIndex: 'limit_up_stat', key: 'limit_up_stat', width: 120 },
    { title: '涨跌幅(%)', dataIndex: 'change_pct', key: 'change_pct', width: 110, sorter: true },
    { title: '首次封板时间', dataIndex: 'first_seal_time', key: 'first_seal_time', width: 130 },
    { title: '最后封板时间', dataIndex: 'last_seal_time', key: 'last_seal_time', width: 130 },
    { title: '封板资金(亿元)', dataIndex: 'seal_fund_amt', key: 'seal_fund_amt', width: 140, sorter: true,
      render: (v) => v ? (v / 1e8).toFixed(2) : '-' },
    { title: '流通市值(亿元)', dataIndex: 'float_mkt_cap_amt', key: 'float_mkt_cap_amt', width: 140, sorter: true,
      render: (v) => v ? (v / 1e8).toFixed(2) : '-' },
    { title: '总市值(亿元)', dataIndex: 'total_mkt_cap_amt', key: 'total_mkt_cap_amt', width: 140, sorter: true,
      render: (v) => v ? (v / 1e8).toFixed(2) : '-' },
    { title: '申万行业', dataIndex: 'industry_sw', key: 'industry_sw', width: 140 },
    { title: '证监会行业', dataIndex: 'industry_zjh', key: 'industry_zjh', width: 140 },
    { title: '概念板块', dataIndex: 'concept_sectors', key: 'concept_sectors', width: 300, ellipsis: true },
    {
      title: '是否一字板', dataIndex: 'is_yizi', key: 'is_yizi', width: 110,
      render: (v) => v === 1 ? <Tag color="gold">是</Tag> : <Tag>否</Tag>,
    },
  ]

  useEffect(() => {
    fetch('/api/lianban/dates')
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
      if (isYizi) params.set('isYizi', isYizi)
      if (keyword) params.set('keyword', keyword)

      const res = await fetch(`/api/lianban/stocks?${params}`)
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
  }, [date, boardType, isYizi, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const rowClassName = (record) => {
    if (record.limit_up_days === maxLimitUpDaysByDate[record.trade_date] && maxLimitUpDaysByDate[record.trade_date] > 0) return 'row-max-limit'
    if (record.is_yizi === 1) return 'row-yizi'
    return ''
  }

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
        <Select
          allowClear placeholder="是否一字板" style={{ width: 160 }}
          value={isYizi} onChange={(v) => setIsYizi(v)}
          options={[
            { label: '是', value: '1' },
            { label: '否', value: '0' },
          ]}
        />
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="table-wrapper">
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading}
          rowClassName={rowClassName}
          pagination={{
            current: page, pageSize: 100, total,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          scroll={{ x: 1800 }} size="middle"
        />
      </div>
    </>
  )
}
