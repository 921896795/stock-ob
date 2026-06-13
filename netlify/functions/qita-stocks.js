import { handleStocks } from './helpers.js'
export default async (req) => handleStocks('aads_其他模式', req)
export const config = { path: '/api/qita/stocks' }
