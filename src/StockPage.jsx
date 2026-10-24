import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Input, Tag, Checkbox, message, Modal } from 'antd'

const PREFIX_OPTIONS = [
  { label: '00 (深市主板)', value: '00' },
  { label: '30 (创业板)', value: '30' },
  { label: '60 (沪市主板)', value: '60' },
  { label: '688 (科创板)', value: '688' },
]

const SOURCE_TABLE_LABELS = {
  model_platform_610: '610模型',
  stock_analysis_five_year: '5年',
  stock_analysis_half_year: '半年',
  stock_analysis_three_month: '3个月',
  stock_analysis_year: '1年',
  stock_sector_summary_today_2639_daily: '今日板块汇总',
}

// 展示顺序：5年 → 1年 → 半年 → 3个月（时间越近越靠后）→ 今日板块汇总 → 610模型
const SOURCE_TABLE_ORDER = [
  'stock_analysis_five_year',
  'stock_analysis_year',
  'stock_analysis_half_year',
  'stock_analysis_three_month',
  'stock_sector_summary_today_2639_daily',
  'model_platform_610',
]

const sourceTableRank = (s) => {
  const i = SOURCE_TABLE_ORDER.indexOf(s)
  return i === -1 ? SOURCE_TABLE_ORDER.length : i
}

const formatSourceTable = (v) => {
  if (!v) return v
  return String(v)
    .split('、')
    .map(s => s.trim())
    .filter(Boolean)
    .sort((a, b) => sourceTableRank(a) - sourceTableRank(b))
    .map(s => SOURCE_TABLE_LABELS[s] || s)
    .join('、')
}

const columns = [
  { title: '日期', dataIndex: 'target_date', key: 'target_date', width: 120, sorter: true },
  { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 120, sorter: true },
  { title: '股票名称', dataIndex: 'stock_name', key: 'stock_name', width: 120 },
  { title: '来源表', dataIndex: 'source_table', key: 'source_table', width: 200, ellipsis: true, render: formatSourceTable },
  { title: '板块', dataIndex: 'sector_names', key: 'sector_names', width: 300, ellipsis: true },
]

export default function StockPage({ apiPath, title, excludeSoleSource }) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState([])
  const [sectors, setSectors] = useState([])
  const [sourceTables, setSourceTables] = useState([])
  const [sectorSearch, setSectorSearch] = useState('')
  const [date, setDate] = useState(undefined)
  const [prefix, setPrefix] = useState(undefined)
  const [selectedSectors, setSelectedSectors] = useState([])
  const [sourceTable, setSourceTable] = useState(undefined)
  const [excludeStandalone, setExcludeStandalone] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [collections, setCollections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stock_sector_collections') || '[]') }
    catch { return [] }
  })
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')

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
      if (prefix) params.set('prefix', prefix)
      if (selectedSectors.length > 0) params.set('sector', selectedSectors.join(','))
      if (sourceTable && sourceTable.length > 0) params.set('sourceTable', sourceTable.join(','))
      if (excludeStandalone) params.set('excludeStandalone', '1')
      if (excludeSoleSource) params.set('excludeSoleSource', excludeSoleSource)
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
  }, [apiPath, date, prefix, selectedSectors, sourceTable, excludeStandalone, excludeSoleSource, keyword])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const filteredSectors = sectors.filter(s =>
    s.toLowerCase().includes(sectorSearch.toLowerCase())
  )

  const saveCollection = () => {
    if (!collectionName.trim()) {
      message.warning('请输入集合名称')
      return
    }
    if (selectedSectors.length === 0) {
      message.warning('请先选择板块')
      return
    }
    if (collections.some(c => c.name === collectionName.trim())) {
      message.warning('集合名称已存在')
      return
    }
    const next = [...collections, { name: collectionName.trim(), sectors: [...selectedSectors] }]
    setCollections(next)
    localStorage.setItem('stock_sector_collections', JSON.stringify(next))
    setCollectionModalOpen(false)
    setCollectionName('')
    message.success('保存成功')
  }

  const deleteCollection = (name) => {
    const next = collections.filter(c => c.name !== name)
    setCollections(next)
    localStorage.setItem('stock_sector_collections', JSON.stringify(next))
  }

  const applyCollection = (sectors) => {
    setSelectedSectors([...sectors])
  }

  return (
    <>
      <div className="rule-box">
        <div className="rule-title">模型规则：</div>
        <ol>
          <li>今日最低价 &lt; 前 5-10 日中某日的“此前 10 日最高价”（回踩跌破）</li>
          <li>今日最高价 &gt; 前 5-10 日中某日的“此前 10 日最高价”（突破）</li>
          <li>新高判断：过去 1-10 日中某日收盘价 &gt; 该日之前 N 日的最大收盘价（确认是新高）</li>
          <li>近 20 日内有单日涨幅 &gt; 7%（确认有强势表现）</li>
          <li>前 6-10 日最高价 &gt;= 今日收盘价 × 1.08（确认有回踩空间，高点比现价高 8% 以上）</li>
        </ol>
        <div className="rule-title">运行时间：</div>
        <div>工作日 14:35 和 17:20</div>
        <div className="rule-title">数据库表：</div>
        <pre>{`stock_analysis_three_month  ──┐
stock_analysis_half_year    ──┤
stock_analysis_year         ──┼──→ stock_sector_summary_today_2639_daily ──→ aads_回踩和新高表
stock_analysis_five_year    ──┘`}</pre>
      </div>

      <div className="page-header">
        <p>
          共 {total.toLocaleString()} 条记录（按日期+股票代码去重）
          {selectedSectors.length > 0 && (
            <span className="sector-active">
              当前板块：{selectedSectors.map(s => (
                <Tag key={s} closable onClose={() => setSelectedSectors(prev => prev.filter(x => x !== s))} color="blue" style={{ margin: '0 4px 4px 0' }}>{s}</Tag>
              ))}
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
          allowClear placeholder="股票代码前缀" style={{ width: 170 }}
          value={prefix} onChange={(v) => setPrefix(v)}
          options={PREFIX_OPTIONS}
        />
        <Select
          mode="multiple" allowClear placeholder="来源表" style={{ width: 320 }}
          value={sourceTable} onChange={(v) => { setSourceTable(v); if (!v || v.length === 0) setExcludeStandalone(false); }}
          options={[...sourceTables].sort((a, b) => sourceTableRank(a) - sourceTableRank(b)).map(s => ({ label: SOURCE_TABLE_LABELS[s] || s, value: s }))}
          showSearch filterOption={(input, option) => `${option?.label ?? ''}${option?.value ?? ''}`.toLowerCase().includes(input.toLowerCase())}
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
          <div className="sector-panel-header">
            板块列表
            {selectedSectors.length > 0 && (
              <span style={{ float: 'right', fontSize: 12, color: '#1677ff', cursor: 'pointer', fontWeight: 'normal' }}
                onClick={() => setSelectedSectors([])}>清除全部</span>
            )}
          </div>
          {collections.length > 0 && (
            <div className="sector-collections">
              {collections.map(c => (
                <span key={c.name} className="sector-collection-tag" onClick={() => applyCollection(c.sectors)}>
                  {c.name}
                  <span className="sector-collection-del" onClick={(e) => { e.stopPropagation(); deleteCollection(c.name) }}>×</span>
                </span>
              ))}
            </div>
          )}
          <div className="sector-search">
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Input placeholder="搜索板块" size="small" allowClear style={{ flex: 1 }}
                value={sectorSearch} onChange={(e) => setSectorSearch(e.target.value)} />
              <Tag
                color="blue"
                style={{ cursor: 'pointer', margin: 0, flexShrink: 0, lineHeight: '22px', padding: '0 6px' }}
                onClick={() => setCollectionModalOpen(true)}
              >+ 集合</Tag>
            </div>
          </div>
          <div className="sector-list">
            {filteredSectors.map((s, i) => {
              const isSelected = selectedSectors.includes(s)
              return (
                <div key={i}
                  className={`sector-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedSectors(prev => isSelected ? prev.filter(x => x !== s) : [...prev, s])}
                >
                  {s}
                </div>
              )
            })}
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

      <Modal
        title="保存板块集合"
        open={collectionModalOpen}
        onOk={saveCollection}
        onCancel={() => { setCollectionModalOpen(false); setCollectionName('') }}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="输入集合名称，如：CRO+CXO概念"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          onPressEnter={saveCollection}
          autoFocus
        />
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          将保存当前选中的 {selectedSectors.length} 个板块
        </div>
      </Modal>
    </>
  )
}
