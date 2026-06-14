import React, { useState } from 'react'
import { ConfigProvider, Tabs } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import StockPage from './StockPage'
import NewHighPage from './NewHighPage'
import FirstHighPage from './FirstHighPage'

const TABS = [
  { key: 'huicai', label: '回踩和新高', apiPath: '/api/huicai' },
  { key: 'qita', label: '其他模式', apiPath: '/api/qita' },
  { key: 'newhigh', label: '7天频繁新高（200+）', component: 'newhigh' },
  { key: 'firsthigh', label: '7天首次新高（200+）', component: 'firsthigh' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('huicai')

  const renderTab = (t) => {
    if (t.component === 'newhigh') return <NewHighPage />
    if (t.component === 'firsthigh') return <FirstHighPage />
    return <StockPage apiPath={t.apiPath} />
  }

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
            children: renderTab(t),
          }))}
        />
      </div>
    </ConfigProvider>
  )
}
