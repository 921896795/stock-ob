import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, message } from 'antd'

const fmtNum = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2))

const yesNo = (v) => (v ? '是' : '否')

const RULES = [
  {
    name: 'FYX1 RPS 强度',
    require: 'RPS50 ≥ 87 或 RPS120 ≥ 90',
    detail: [
      'fyx130 = RPS50 ≥ 90 或 RPS120 ≥ 90',
      'fyx131 = 收盘 ≥ 70 日最高价',
      'fyx13 = 两者同时成立（供后续条件引用）',
    ],
  },
  {
    name: 'FYX2 低点抬高',
    require: '三条满足其一',
    detail: [
      '① LLV(L,50) > LLV(L,200) 且 fyx13',
      '② LLV(L,30) > LLV(L,120) 且 fyx13',
      '③ LLV(L,20) > LLV(L,50)',
    ],
  },
  {
    name: 'FYX3 阶段新高',
    require: '两条满足其一',
    detail: [
      '① 最近 10 日内出现过 H ≥ HHV(H,80)',
      '② 收盘或最高价创 50 日新高，且 fyx130',
    ],
  },
  {
    name: 'FYX4 站上中长期均线',
    require: '三条同时',
    detail: ['收盘 > MA20、收盘 > MA200、MA120/MA200 > 0.9'],
  },
  {
    name: 'FYX5 长期均线修复',
    require: '三条满足其一',
    detail: [
      '① 45 日内收盘站上 MA200 的天数 ≥ 2 且 < 45',
      '② 45 日内有最低价跌破 MA200 且站上 MA200 天数 > 2',
      '③ 同上但用 MA250',
    ],
  },
  {
    name: 'FYX6 均线向上 + 平台紧凑',
    require: '三条满足其一（平台比 = HHV(H,30)/LLV(L,120)）',
    detail: [
      '① 平台比 < 1.50 且 MA120 或 MA200 较 10/15 日前不下降',
      '② 平台比 < 1.55 且 MA120、MA200 均不下降',
      '③ 平台比 < 1.65 且 MA120 > MA200、MA120 或 MA200 向上的 fyx601 成立，且 fyx13',
    ],
  },
  {
    name: 'FYX7 接近阶段高点',
    require: '两条同时',
    detail: [
      '① HHV(H,5)/HHV(H,120) > 0.85（或 > 0.80 且 fyx13）',
      '② 收盘 / HHV(H,10) > 0.90',
    ],
  },
]

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
        <div className="rule-title">模型解释：</div>
        <div>月线反转是一个“底部大概率已确立、刚起步、且已经开始变强”的初选信号，说明个股正从长期下跌转入欧奈尔/温斯坦意义上的第二阶段初期——但它本身不是买点，也不保证成功。</div>
      </div>

      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        {RULES.map((r) => (
          <div key={r.name} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div>要求：{r.require}</div>
            {r.detail && (
              <>
                <div>判定细节：</div>
                {r.detail.map((d) => (
                  <div key={d} style={{ paddingLeft: 16 }}>{d}</div>
                ))}
              </>
            )}
          </div>
        ))}
        <div className="rule-title">运行时间：</div>
        <div>每个交易日 <code>18:40</code></div>
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
