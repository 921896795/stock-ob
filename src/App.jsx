import React, { useState } from 'react'
import { ConfigProvider, Tabs } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import StockPage from './StockPage'

const TABS = [
  { key: 'huicai', label: '回踩和新高', apiPath: '/api/huicai' },
  { key: 'qita', label: '其他模式', apiPath: '/api/qita' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('huicai')

  return (
    <ConfigProvider locale={zhCN}>
      <div className="container">
        <div className="header">
          <h1>股票数据看板</h1>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={TABS.map(t => ({
            key: t.key,
            label: t.label,
            children: <StockPage apiPath={t.apiPath} />,
          }))}
        />
      </div>
    </ConfigProvider>
  )
}
