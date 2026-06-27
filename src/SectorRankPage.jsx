import React, { useState, useEffect } from 'react'
import { Select, Input, Spin, Empty } from 'antd'

export default function SectorRankPage() {
  const [dates, setDates] = useState([])
  const [industries, setIndustries] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [industryFilter, setIndustryFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(undefined)
  const [phaseFilter, setPhaseFilter] = useState(undefined)
  const [hoveredIndustry, setHoveredIndustry] = useState(null)

  useEffect(() => {
    fetch('/api/sector-rank/dates').then(r => r.json()).then(setDates).catch(() => {})
    fetch('/api/sector-rank/industries').then(r => r.json()).then(setIndustries).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (industryFilter) params.set('industryName', industryFilter)
    if (dateFilter) params.set('tradingDate', dateFilter)
    if (phaseFilter) params.set('resultPhase', phaseFilter)
    fetch(`/api/sector-rank/data?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [industryFilter, dateFilter, phaseFilter])

  const dateGroups = {}
  data.forEach(row => {
    if (!dateGroups[row.trading_date]) dateGroups[row.trading_date] = []
    dateGroups[row.trading_date].push(row)
  })

  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a))

  return (
    <>
      <div className="filter-bar">
        <Input.Search
          placeholder="搜索板块名称" style={{ width: 240 }}
          allowClear onSearch={(v) => setIndustryFilter(v)} enterButton="搜索"
        />
        <Select
          allowClear placeholder="选择日期" style={{ width: 160 }}
          value={dateFilter} onChange={setDateFilter}
          options={dates.map(d => ({ label: d, value: d }))}
          showSearch filterOption={(input, option) => (option?.label ?? '').includes(input)}
        />
        <Select
          allowClear placeholder="结果阶段" style={{ width: 160 }}
          value={phaseFilter} onChange={setPhaseFilter}
          options={[
            { label: '3点前结果', value: '3点前结果' },
            { label: '3点后结果', value: '3点后结果' },
          ]}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : sortedDates.length === 0 ? (
        <Empty description="暂无数据" style={{ marginTop: 60 }} />
      ) : (
        <div className="sector-rank-wrapper">
          <div className="sector-rank-scroll">
            {sortedDates.map(date => (
              <div key={date} className="sector-rank-column">
                <div className="sector-rank-date-header">{date}</div>
                <div className="sector-rank-date-phase">
                  {dateGroups[date][0]?.result_phase}
                </div>
                <div className="sector-rank-list">
                  {dateGroups[date].map((row, idx) => (
                    <div key={row.id}
                      className={`sector-rank-row${hoveredIndustry && hoveredIndustry === row.industry_name ? ' highlight' : ''}`}
                      onMouseEnter={() => setHoveredIndustry(row.industry_name)}
                      onMouseLeave={() => setHoveredIndustry(null)}
                    >
                      <span className="sector-rank-num">{idx + 1}</span>
                      <span className="sector-rank-name">{row.industry_name}</span>
                      <span className="sector-rank-value">{row.zt_number}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
