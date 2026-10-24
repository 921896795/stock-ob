import React, { useState, useEffect, useMemo } from 'react'
import { Table, Switch, message } from 'antd'

const GROUPS = [
  {
    title: '涨跌家数',
    metrics: [
      { key: 'up_cnt', label: '上涨家数', color: '#cf1322' },
      { key: 'down_cnt', label: '下跌家数', color: '#3f8600' },
      { key: 'flat_cnt', label: '平盘家数' },
    ],
  },
  {
    title: '涨跌停与连板',
    metrics: [
      { key: 'limit_up_cnt', label: '涨停家数', color: '#cf1322' },
      { key: 'limit_down_cnt', label: '跌停家数', color: '#3f8600' },
      { key: 'limit_level', label: '涨跌停标签' },
      { key: 'max_board_cnt', label: '连板高度' },
      { key: 'board_level', label: '连板标签' },
    ],
  },
  {
    title: '全A涨跌幅',
    metrics: [
      { key: 'avg_chg_pct', label: '全A平均涨跌幅(%)', colorFn: (v) => v >= 0 ? '#cf1322' : '#3f8600', suffix: '%' },
      { key: 'median_chg_pct', label: '全A涨跌幅中位数(%)', colorFn: (v) => v >= 0 ? '#cf1322' : '#3f8600', suffix: '%' },
    ],
  },
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

  const filtered = useMemo(() => {
    return onlyIce ? rawData.filter(d => d.up_cnt < 1000) : rawData
  }, [rawData, onlyIce])

  const weakDates = useMemo(() => {
    return new Set(filtered.filter(d => d.up_cnt < 1000).map(d => d.snap_time))
  }, [filtered])

  // 公共列定义
  const columns = useMemo(() => {
    const dateCols = filtered.map(d => {
      const isWeak = weakDates.has(d.snap_time)
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
    return [
      { title: '指标', dataIndex: 'label', key: 'label', width: 180, fixed: 'left' },
      ...dateCols,
    ]
  }, [filtered, weakDates])

  // 根据分组生成 dataSource
  const groupData = useMemo(() => {
    return GROUPS.map(group => {
      const rows = group.metrics.map(m => {
        const row = { key: m.key, label: m.label }
        filtered.forEach(d => {
          let val = d[m.key]
          if (m.suffix && val != null) val = val + m.suffix
          row[d.snap_time] = val ?? '-'
        })
        return row
      })
      return { title: group.title, metrics: group.metrics, rows }
    })
  }, [filtered])

  // 给单元格加颜色的 render
  const makeRender = (metric, isWeakCol) => (val) => {
    if (isWeakCol) {
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
  }

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

      {groupData.map(group => {
        const coloredCols = columns.map(col => {
          if (col.key === 'label') return col
          const isWeak = weakDates.has(col.key)
          return {
            ...col,
            render: (val, record) => {
              const metric = group.metrics.find(m => m.key === record.key)
              return makeRender(metric, isWeak)(val)
            },
          }
        })

        return (
          <div key={group.title} style={{
            background: '#fff',
            borderRadius: 8,
            marginBottom: 16,
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 24px',
              fontWeight: 600,
              fontSize: 14,
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa',
            }}>
              {group.title}
            </div>
            <div style={{ padding: '12px 24px 16px' }}>
              <Table
                rowKey="key"
                columns={coloredCols}
                dataSource={group.rows}
                loading={loading}
                pagination={false}
                scroll={{ x: 300 + filtered.length * 160 }}
                size="middle"
              />
            </div>
          </div>
        )
      })}
    </>
  )
}
