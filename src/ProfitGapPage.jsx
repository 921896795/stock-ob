import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, message } from 'antd'

const fmtNum = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2))

export default function ProfitGapPage() {
  const [counts, setCounts] = useState([])
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [date, setDate] = useState(undefined)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/profit-gap/counts')
      .then(r => r.json())
      .then(d => setCounts(Array.isArray(d) ? d : []))
      .catch(() => {})
    fetch('/api/profit-gap/dates')
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

      const res = await fetch(`/api/profit-gap/stocks?${params}`)
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

  const countColumns = [
    {
      title: '次数', dataIndex: 'cnt', key: 'cnt', width: 70, align: 'center',
      render: v => <span style={{ fontWeight: 600, color: '#1677ff' }}>{v}</span>,
    },
    { title: '股票名称', dataIndex: 'name', key: 'name' },
  ]

  const detailColumns = [
    { title: '交易日', dataIndex: 'trade_date', key: 'trade_date', width: 120 },
    { title: '股票代码', dataIndex: 'code', key: 'code', width: 110 },
    { title: '股票名称', dataIndex: 'name', key: 'name', width: 130 },
    { title: '交易所', dataIndex: 'exchange', key: 'exchange', width: 90 },
    {
      title: '今日公告', dataIndex: 'has_today_announcement', key: 'has_today_announcement', width: 100,
      render: v => (v ? '是' : '否'),
    },
    {
      title: '昨日公告', dataIndex: 'has_prev_day_announcement', key: 'has_prev_day_announcement', width: 100,
      render: v => (v ? '是' : '否'),
    },
    { title: '开盘价', dataIndex: 'open_price', key: 'open_price', width: 110, align: 'right', render: fmtNum },
    { title: '昨收', dataIndex: 'prev_close', key: 'prev_close', width: 110, align: 'right', render: fmtNum },
    {
      title: '高开幅度(%)', dataIndex: 'open_jump_pct', key: 'open_jump_pct', width: 130, align: 'right',
      render: (v) => {
        const n = Number(v)
        if (v === null || v === undefined || v === '' || isNaN(n)) return '-'
        return (
          <span style={{ color: n >= 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>
            {n >= 0 ? '+' : ''}{n.toFixed(2)}%
          </span>
        )
      },
    },
  ]

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        <ol>
          <li>发布公告 <code>预增、预升、预盈、减亏</code> 的公告日期</li>
          <li>开盘涨幅大于 5%</li>
        </ol>
        <div className="rule-title">运行时间：</div>
        <div>工作日 17:15</div>
        <div className="rule-title">数据来源：</div>
        <div><code>ads_sig_net_profit_gap_daily</code></div>
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

      <div className="two-col">
        <div className="table-wrapper count-panel">
          <div className="table-title">出现次数排行（仅出现 ≥ 2 次的股票）</div>
          <Table
            rowKey="code" columns={countColumns} dataSource={counts}
            pagination={false} size="small" scroll={{ y: 520 }}
          />
        </div>

        <div className="table-wrapper detail-panel">
          <div className="table-title">信号明细（按交易日倒序）</div>
          <Table
            rowKey="id" columns={detailColumns} dataSource={data} loading={loading}
            pagination={{
              current: page, pageSize: 100, total,
              showTotal: (t) => `共 ${t.toLocaleString()} 条`,
              showSizeChanger: false,
              onChange: (p) => fetchData(p),
            }}
            scroll={{ x: 1000 }} size="middle"
          />
        </div>
      </div>
    </>
  )
}
