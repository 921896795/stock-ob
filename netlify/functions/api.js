import { handleDates, handleSectors, handleSourceTables, handleStocks, handleNewHighDates, handleNewHighStocks, handleFirstHighDates, handleFirstHighFirstDates, handleFirstHighStocks, handleSentimentData, handleSentimentAfterHours } from './helpers.js'

const TABLES = {
  huicai: 'aads_回踩和新高表',
  qita: 'aads_其他模式',
}

export default async (req) => {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const tableKey = parts.find(p => TABLES[p] || p === 'newhigh' || p === 'firsthigh' || p === 'sentiment')
  const action = parts[parts.length - 1]

  if (tableKey === 'newhigh') {
    try {
      if (action === 'dates') return await handleNewHighDates()
      if (action === 'stocks') return await handleNewHighStocks(req)
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
  }

  if (tableKey === 'firsthigh') {
    try {
      if (action === 'dates') return await handleFirstHighDates()
      if (action === 'first-dates') return await handleFirstHighFirstDates()
      if (action === 'stocks') return await handleFirstHighStocks(req)
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
  }

  if (tableKey === 'sentiment') {
    try {
      if (action === 'data') return await handleSentimentData()
      if (action === 'after-hours') return await handleSentimentAfterHours()
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
  }

  if (!tableKey || !TABLES[tableKey]) {
    return new Response(
      JSON.stringify({ error: 'Invalid table key' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const table = TABLES[tableKey]

  try {
    if (action === 'dates') return await handleDates(table)
    if (action === 'sectors') return await handleSectors(table)
    if (action === 'source-tables') return await handleSourceTables(table)
    if (action === 'stocks') return await handleStocks(table, req)
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export const config = {
  path: '/api/*',
}
