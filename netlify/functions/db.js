import mysql from 'mysql2/promise'

let pool = null

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      connectTimeout: 5000,
      acquireTimeout: 8000,
    })
  }
  return pool
}

export async function queryWithRetry(sql, params = [], retries = 2) {
  const pool = getPool()
  for (let i = 0; i <= retries; i++) {
    try {
      return await pool.execute(sql, params)
    } catch (err) {
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 500))
    }
  }
}
