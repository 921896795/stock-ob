import React, { useState, useEffect, useMemo } from 'react'
import { Table, Switch, message } from 'antd'

const METRICS = [
  { key: 'up_cnt', label: '上涨家数', color: '#cf1322' },
  { key: 'down_cnt', label: '下跌家数', color: '#3f8600' },
  { key: 'flat_cnt', label: '平盘家数' },
  { key: 'total_cnt', label: '有效交易家数' },
  { key: 'limit_up_cnt', label: '涨停家数', color: '#cf1322' },
  { key: 'limit_down_cnt', label: '跌停家数', color: '#3f8600' },
  { key: 'limit_level', label: '涨跌停标签' },
  { key: 'max_board_cnt', label: '连板高度' },
  { key: 'board_level', label: '连板标签' },
  { key: 'avg_chg_pct', label: '全A平均涨跌幅(%)', colorFn: (v) => v >= 0 ? '#cf1322' : '#3f8600', suffix: '%' },
  { key: 'median_chg_pct', label: '全A涨跌幅中位数(%)', colorFn: (v) => v >= 0 ? '#cf1322' : '#3f8600', suffix: '%' },
]

export default function SentimentPage({ apiPath = '/api/sentiment/data' }) {
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(false)
  const [onlyIce, setOnlyIce] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(apiPath)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRawData(d || [])
      })
      .catch(err => message.error('加载数据失败: ' + err.message))
      .finally(() => setLoading(false))
  }, [apiPath])

  // 转置：日期作为列，指标作为行
  const { columns, dataSource } = useMemo(() => {
    const filtered = onlyIce ? rawData.filter(d => d.up_cnt < 1200) : rawData
    if (filtered.length === 0) return { columns: [], dataSource: [] }

    // 动态列：第一列是"指标"，后面每列一个快照时间
    const dateCols = filtered.map(d => {
      const isWeak = d.up_cnt < 1200
      return {
        title: d.snap_time,
        dataIndex: d.snap_time,
        key: d.snap_time,
        width: 160,
        align: 'center',
        onCell: () => ({
          style: isWeak ? { backgroundColor: '#f0fff0' } : {},
        }),
      }
    })

    const cols = [
      { title: '指标', dataIndex: 'label', key: 'label', width: 180, fixed: 'left' },
      ...dateCols,
    ]

    // 每行一个指标
    const rows = METRICS.map(m => {
      const row = { key: m.key, label: m.label }
      filtered.forEach(d => {
        let val = d[m.key]
        if (m.suffix && val != null) val = val + m.suffix
        row[d.snap_time] = val ?? '-'
      })
      return row
    })

    return { columns: cols, dataSource: rows }
  }, [rawData, onlyIce])

  // 给单元格加颜色，弱市列用深色文字保证可读性
  const weakDates = useMemo(() => {
    const filtered = onlyIce ? rawData.filter(d => d.up_cnt < 1200) : rawData
    return new Set(filtered.filter(d => d.up_cnt < 1200).map(d => d.snap_time))
  }, [rawData, onlyIce])

  const coloredColumns = columns.map(col => {
    if (col.key === 'label') return col
    const isWeak = weakDates.has(col.key)
    return {
      ...col,
      render: (val, record) => {
        const metric = METRICS.find(m => m.key === record.key)
        if (isWeak) {
          return <span style={{ color: '#595959', fontWeight: 600 }}>{val}</span>
        }
        if (metric?.colorFn) {
          const numVal = parseFloat(val)
          return <span style={{ color: metric.colorFn(numVal), fontWeight: 600 }}>{val}</span>
        }
        if (metric?.color) {
          return <span style={{ color: metric.color, fontWeight: 600 }}>{val}</span>
        }
        return val
      },
    }
  })

  return (
    <>
      <div className="page-header">
        <p>
          共 {rawData.length} 个交易日
          <span style={{ marginLeft: 24 }}>
            <Switch checked={onlyIce} onChange={setOnlyIce} size="small" />
            <span style={{ marginLeft: 8, fontSize: 14 }}>只看冰点</span>
          </span>
        </p>
      </div>

      <div className="table-wrapper">
        <Table
          rowKey="key" columns={coloredColumns} dataSource={dataSource} loading={loading}
          pagination={false}
          scroll={{ x: 300 + rawData.length * 160 }} size="middle"
        />
      </div>
    </>
  )
}
