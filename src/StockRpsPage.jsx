import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Table, Select, Input, message } from 'antd'

const fmtNum = (v, digits = 2) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(digits))

const RPS_COLS = [50, 120, 250, 5, 10, 20]

// antd 5 中 sorter: true 不会做本地排序，这里自己排序以保证与「交易日」合并单元格一致
const cmpValue = (av, bv) => {
  if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : -1
  if (bv === null || bv === undefined) return 1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv))
}

export default function StockRpsPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
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
    fetch('/api/stock-rps/dates')
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

      const res = await fetch(`/api/stock-rps/stocks?${params}`)
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
      title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120, ...sp('trade_date'),
      onCell: (record) => {
        const idx = sortedData.findIndex(r => `${r.trade_date}_${r.stock_code}` === `${record.trade_date}_${record.stock_code}`)
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
    { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 120 },
    {
      title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 120,
      render: (v) => v || '-',
    },
    {
      title: '三连红', dataIndex: 'is_triple_red', key: 'is_triple_red', width: 90, align: 'center', ...sp('is_triple_red'),
      render: (v) => (v
        ? <span style={{ color: '#cf1322', fontWeight: 600 }}>是</span>
        : <span style={{ color: '#8c8c8c' }}>否</span>),
    },
    { title: '收盘价', dataIndex: 'close_price', key: 'close_price', width: 100, align: 'right', render: fmtNum, ...sp('close_price') },
    ...RPS_COLS.map(n => ([
      {
        title: `RPS${n}日`, dataIndex: `rps_${n}d`, key: `rps_${n}d`, width: 100, align: 'right', render: fmtNum, ...sp(`rps_${n}d`),
      },
      {
        title: `翻红${n}日`, dataIndex: `is_red_${n}d`, key: `is_red_${n}d`, width: 90, align: 'center', ...sp(`is_red_${n}d`),
        render: (v) => (v
          ? <span style={{ color: '#cf1322', fontWeight: 600 }}>是</span>
          : <span style={{ color: '#8c8c8c' }}>否</span>),
      },
    ])).flat(),
    { title: '红K数', dataIndex: 'red_cnt', key: 'red_cnt', width: 90, align: 'right', ...sp('red_cnt') },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">数据库表：</div>
        <div><code>dwd_mkt_stock_rps_d</code></div>
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
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="table-wrapper">
        <Table
          rowKey={(r) => `${r.trade_date}_${r.stock_code}`}
          columns={columns} dataSource={sortedData} loading={loading}
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
          scroll={{ x: 1680 }} size="middle"
        />
      </div>
    </>
  )
}
