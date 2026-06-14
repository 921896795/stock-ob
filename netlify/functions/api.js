import { handleDates, handleSectors, handleStocks } from './helpers.js'

const TABLES = {
  huicai: 'aads_回踩和新高表',
  qita: 'aads_其他模式',
}

export default async (req) => {
  const url = new URL(req.url)
  // /api/huicai/dates → ['', 'api', 'huicai', 'dates']
  // After redirect: /.netlify/functions/api → path is the original
  const parts = url.pathname.split('/').filter(Boolean)
  // Find 'huicai' or 'qita' in the path
  const tableKey = parts.find(p => TABLES[p])
  const action = parts[parts.length - 1]

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
