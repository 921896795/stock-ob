import React, { useState } from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import StockPage from './StockPage'
import NewHighPage from './NewHighPage'
import FirstHighPage from './FirstHighPage'
import SentimentPage from './SentimentPage'
import SectorRankPage from './SectorRankPage'
import LianbanPage from './LianbanPage'
import HobPage from './HobPage'
import ZbPage from './ZbPage'
import LowerShadowPage from './LowerShadowPage'
import TwentyCmPage from './TwentyCmPage'
import ProfitGapPage from './ProfitGapPage'
import ProfitGapBreakPage from './ProfitGapBreakPage'
import MidTermIndexPage from './MidTermIndexPage'
import YxfzPage from './YxfzPage'
import OneWordBoardPage from './OneWordBoardPage'
import WeekendVotePage from './WeekendVotePage'

const MODELS = [
  {
    key: 'index',
    label: '指数模型',
    tabs: [
      { key: 'afterhours', label: '涨跌分布', component: 'afterhours', highlight: true },
      { key: 'sectorrank', label: '板块排行', component: 'sectorrank' },
      { key: 'midterm-index', label: '中期指数', component: 'midterm-index' },
      { key: 'weekend-vote', label: '周末投票', component: 'weekend-vote' },
    ],
  },
  {
    key: 'stock',
    label: '选股模型',
    tabs: [
      { key: 'huicai', label: '回踩和新高回踩', apiPath: '/api/huicai', excludeSoleSource: 'model_platform_610', highlight: true },
      { key: 'lianban', label: '连扳潜伏', component: 'lianban' },
      { key: 'one-word-board', label: '一字', component: 'one-word-board' },
      { key: 'hob', label: '高开大阴', component: 'hob', highlight: true },
      { key: 'zb', label: '活跃炸板', component: 'zb' },
      { key: 'lower-shadow', label: '510', component: 'lower-shadow', highlight: true },
      { key: 'profit-gap', label: '利润断层', component: 'profit-gap' },
      { key: 'profit-gap-break', label: '利润断层突破', component: 'profit-gap-break', highlight: true },
      { key: 'yxfz', label: '月线反转', component: 'yxfz' },
      { key: 'newhigh', label: '7天频繁新高（200+）', component: 'newhigh' },
      { key: 'firsthigh', label: '7天首次新高（200+）', component: 'firsthigh' },
    ],
  },
  {
    key: 'ice',
    label: '冰点模型',
    tabs: [
      { key: '20cm', label: '20冰点活跃', component: '20cm' },
    ],
  },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('huicai')

  const renderTab = (t) => {
    if (t.component === 'newhigh') return <NewHighPage />
    if (t.component === 'firsthigh') return <FirstHighPage />
    if (t.component === 'afterhours') return <SentimentPage apiPath="/api/sentiment/after-hours" />
    if (t.component === 'sectorrank') return <SectorRankPage />
    if (t.component === 'lianban') return <LianbanPage />
    if (t.component === 'one-word-board') return <OneWordBoardPage />
    if (t.component === 'hob') return <HobPage />
    if (t.component === 'zb') return <ZbPage />
    if (t.component === 'lower-shadow') return <LowerShadowPage />
    if (t.component === '20cm') return <TwentyCmPage />
    if (t.component === 'profit-gap') return <ProfitGapPage />
    if (t.component === 'profit-gap-break') return <ProfitGapBreakPage />
    if (t.component === 'midterm-index') return <MidTermIndexPage />
    if (t.component === 'weekend-vote') return <WeekendVotePage />
    if (t.component === 'yxfz') return <YxfzPage />
    return <StockPage apiPath={t.apiPath} excludeSoleSource={t.excludeSoleSource} />
  }

  const getCurrentTab = () => {
    for (const model of MODELS) {
      const t = model.tabs.find(t => t.key === activeTab)
      if (t) return t
    }
    return null
  }

  return (
    <ConfigProvider locale={zhCN}>
      <div className="container">
        <div className="model-nav">
          {MODELS.map(model => (
            <div key={model.key} className="model-group">
              <div className="model-header">
                <span className="model-label">{model.label}</span>
                <span className="model-count">{model.tabs.length > 0 ? `(${model.tabs.length})` : '(0)'}</span>
              </div>
              {model.tabs.length > 0 ? (
                <div className="model-tabs">
                  {model.tabs.map(t => (
                    <button
                      key={t.key}
                      className={activeTab === t.key ? 'tab-btn active' : 'tab-btn'}
                      onClick={() => setActiveTab(t.key)}
                    >
                      {t.highlight ? (
                        <span style={{ color: '#cf1322' }}>{t.label}</span>
                      ) : t.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="model-empty">暂无页面</div>
              )}
            </div>
          ))}
        </div>
        <div className="tab-content">
          {renderTab(getCurrentTab())}
        </div>
      </div>
    </ConfigProvider>
  )
}
