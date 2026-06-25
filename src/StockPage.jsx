import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, Tag, Checkbox, message } from 'antd'

const LEVEL_COLORS = {
  '一般恐慌': 'orange',
  '无恐慌': 'green',
  '未获取冰点数据': 'default',
}

const PREFIX_OPTIONS = [
  { label: '00 (深市主板)', value: '00' },
  { label: '30 (创业板)', value: '30' },
  { label: '60 (沪市主板)', value: '60' },
  { label: '688 (科创板)', value: '688' },
]

const columns = [
  { title: '日期', dataIndex: 'target_date', key: 'target_date', width: 120, sorter: true },
  { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 120, sorter: true },
  { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 120 },
  {
    title: '机会等级', dataIndex: 'opportunity_level', key: 'opportunity_level', width: 140,
    render: (v) => <Tag color={LEVEL_COLORS[v] || 'default'}>{v}</Tag>,
  },
  { title: '来源表', dataIndex: 'source_table', key: 'source_table', width: 200, ellipsis: true },
  { title: '板块', dataIndex: 'sector_names', key: 'sector_names', width: 300, ellipsis: true },
]

export default function StockPage({ apiPath, title }) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [sectors, setSectors] = useState([])
  const [sourceTables, setSourceTables] = useState([])
  const [sectorSearch, setSectorSearch] = useState('')
  const [date, setDate] = useState(undefined)
  const [level, setLevel] = useState(undefined)
  const [prefix, setPrefix] = useState(undefined)
  const [sector, setSector] = useState(undefined)
  const [sourceTable, setSourceTable] = useState(undefined)
  const [excludeStandalone, setExcludeStandalone] = useState(false)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch(`${apiPath}/dates`)
      .then(r => r.json())
      .then(setDates)
      .catch(() => {})
  }, [apiPath])

  useEffect(() => {
    fetch(`${apiPath}/sectors`)
      .then(r => r.json())
      .then(setSectors)
      .catch(() => {})
  }, [apiPath])

  useEffect(() => {
    fetch(`${apiPath}/source-tables`)
      .then(r => r.json())
      .then(setSourceTables)
      .catch(() => {})
  }, [apiPath])

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, pageSize: 100 })
      if (date) params.set('date', date)
      if (level) params.set('level', level)
      if (prefix) params.set('prefix', prefix)
      if (sector) params.set('sector', sector)
      if (sourceTable && sourceTable.length > 0) params.set('sourceTable', sourceTable.join(','))
      if (excludeStandalone) params.set('excludeStandalone', '1')
      if (keyword) params.set('keyword', keyword)

      const res = await fetch(`${apiPath}/stocks?${params}`)
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
  }, [apiPath, date, level, prefix, sector, sourceTable, excludeStandalone, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const filteredSectors = sectors.filter(s =>
    s.toLowerCase().includes(sectorSearch.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <p>
          共 {total.toLocaleString()} 条记录（按日期+股票代码去重）
          {sector && (
            <span className="sector-active">
              当前板块：<Tag closable onClose={() => setSector(undefined)} color="blue">{sector}</Tag>
            </span>
          )}
        </p>
      </div>

      <div className="filter-bar">
        <Select
          allowClear placeholder="选择日期" style={{ width: 160 }}
          value={date} onChange={(v) => setDate(v)}
          options={dates.map(d => ({ label: d, value: d }))}
          showSearch filterOption={(input, option) => (option?.label ?? '').includes(input)}
        />
        <Select
          allowClear placeholder="机会等级" style={{ width: 160 }}
          value={level} onChange={(v) => setLevel(v)}
          options={[
            { label: '一般恐慌', value: '一般恐慌' },
            { label: '无恐慌', value: '无恐慌' },
            { label: '未获取冰点数据', value: '未获取冰点数据' },
          ]}
        />
        <Select
          allowClear placeholder="股票代码前缀" style={{ width: 170 }}
          value={prefix} onChange={(v) => setPrefix(v)}
          options={PREFIX_OPTIONS}
        />
        <Select
          mode="multiple" allowClear placeholder="来源表" style={{ width: 320 }}
          value={sourceTable} onChange={(v) => { setSourceTable(v); if (!v || v.length === 0) setExcludeStandalone(false); }}
          options={sourceTables.map(s => ({ label: s, value: s }))}
          showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          maxTagCount={2}
        />
        {sourceTable && sourceTable.length > 0 && (
          <Checkbox checked={excludeStandalone} onChange={(e) => setExcludeStandalone(e.target.checked)}>
            排除单独
          </Checkbox>
        )}
        <Input.Search
          placeholder="搜索股票代码或名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setKeyword(v)} enterButton="搜索"
        />
      </div>

      <div className="main-layout">
        <div className="sector-panel">
          <div className="sector-panel-header">板块列表</div>
          <div className="sector-search">
            <Input placeholder="搜索板块" size="small" allowClear
              value={sectorSearch} onChange={(e) => setSectorSearch(e.target.value)} />
          </div>
          <div className="sector-list">
            {filteredSectors.map((s, i) => (
              <div key={i}
                className={`sector-item ${sector === s ? 'active' : ''}`}
                onClick={() => setSector(sector === s ? undefined : s)}
              >
                {s}
              </div>
            ))}
          </div>
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
            scroll={{ x: 1400 }} size="middle"
          />
        </div>
      </div>
    </>
  )
}
