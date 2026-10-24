import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, Tag, message } from 'antd'

const BOARD_TYPE_OPTIONS = [
  { label: '主板 (main)', value: 'main' },
  { label: '创业板 (cyb)', value: 'cyb' },
  { label: '科创板 (kcb)', value: 'kcb' },
]

const fmtNum = (v, digits = 2) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(digits))
const fmtYi = (v) => (v === null || v === undefined || v === '' ? '-' : (Number(v) / 1e8).toFixed(2))

export default function OneWordBoardPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [boardType, setBoardType] = useState(undefined)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/one-word-board/dates')
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

      const res = await fetch(`/api/one-word-board/stocks?${params}`)
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
      title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120,
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
    { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 110 },
    { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 120 },
    {
      title: '板块类型', dataIndex: 'board_type', key: 'board_type', width: 110,
      render: (v) => <Tag color="blue">{v || '-'}</Tag>,
    },
    { title: '交易所', dataIndex: 'exchange', key: 'exchange', width: 90 },
    { title: '所属行业', dataIndex: 'industry_name', key: 'industry_name', width: 140, ellipsis: true },
    { title: '涨停幅度(%)', dataIndex: 'limit_pct', key: 'limit_pct', width: 110, align: 'right', render: (v) => fmtNum(v, 1) },
    { title: '收盘价', dataIndex: 'close_price', key: 'close_price', width: 100, align: 'right', render: fmtNum },
    { title: '涨跌幅(%)', dataIndex: 'change_pct', key: 'change_pct', width: 110, align: 'right', render: fmtNum },
    { title: '连板数', dataIndex: 'limit_up_days', key: 'limit_up_days', width: 90 },
    { title: '涨停统计', dataIndex: 'limit_up_stat', key: 'limit_up_stat', width: 110 },
    { title: '首次封板时间', dataIndex: 'first_seal_time', key: 'first_seal_time', width: 130 },
    { title: '最后封板时间', dataIndex: 'last_seal_time', key: 'last_seal_time', width: 130 },
    { title: '炸板次数', dataIndex: 'break_cnt', key: 'break_cnt', width: 100 },
    { title: '成交额(亿元)', dataIndex: 'trade_amt', key: 'trade_amt', width: 130, align: 'right', render: fmtYi },
    { title: '换手率(%)', dataIndex: 'turnover_rate', key: 'turnover_rate', width: 110, align: 'right', render: fmtNum },
    { title: '封板资金(亿元)', dataIndex: 'seal_fund_amt', key: 'seal_fund_amt', width: 140, align: 'right', render: fmtYi },
    { title: '流通市值(亿元)', dataIndex: 'float_mkt_cap_amt', key: 'float_mkt_cap_amt', width: 140, align: 'right', render: fmtYi },
    { title: '总市值(亿元)', dataIndex: 'total_mkt_cap_amt', key: 'total_mkt_cap_amt', width: 140, align: 'right', render: fmtYi },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">数据库表：</div>
        <div><code>dwd_mkt_one_word_board_d</code></div>
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
        <div className="table-title">一字板明细（按交易日倒序）</div>
        <Table
          rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{
            current: page, pageSize: 100, total,
            showTotal: (t) => `共 ${t.toLocaleString()} 条`,
            showSizeChanger: false,
            onChange: (p) => fetchData(p),
          }}
          scroll={{ x: 2100 }} size="middle"
        />
      </div>
    </>
  )
}
