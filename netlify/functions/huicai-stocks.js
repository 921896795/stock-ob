import { handleStocks } from './helpers.js'
export default async (req) => handleStocks('aads_回踩和新高表', req)
export const config = { path: '/api/huicai/stocks' }
