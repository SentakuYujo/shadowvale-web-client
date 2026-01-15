#!/usr/bin/env node

const express = require('express')
const netApi = require('net-browserify')
const compression = require('compression')
const path = require('path')
const cors = require('cors')
const fs = require('fs')
const { pipeline } = require('stream')
const { promisify } = require('util')

const streamPipeline = promisify(pipeline)

let siModule
try {
  siModule = require('systeminformation')
} catch {}

/* ================================
   CREATE APP
================================ */
const app = express()

const isProd =
  process.argv.includes('--prod') || process.env.NODE_ENV === 'production'

const timeoutIndex = process.argv.indexOf('--timeout')
let timeout =
  timeoutIndex > -1 && timeoutIndex + 1 < process.argv.length
    ? parseInt(process.argv[timeoutIndex + 1])
    : process.env.TIMEOUT
    ? parseInt(process.env.TIMEOUT)
    : 10000

if (isNaN(timeout) || timeout < 0) {
  console.warn('Invalid timeout value, using default 10000ms')
  timeout = 10000
}

/* ================================
   MIDDLEWARE
================================ */
app.use(compression())
app.use(cors())

app.use(
  netApi({
    allowOrigin: '*',
    log: process.argv.includes('--log') || process.env.LOG === 'true',
    timeout
  })
)

/* ================================
   DEV-ONLY ASSETS
================================ */
if (!isProd) {
  app.use(
    '/sounds',
    express.static(path.join(__dirname, './generated/sounds'))
  )
}

/* ================================
   CONFIG.JSON PATCH
================================ */
app.get('/config.json', (req, res) => {
  let config = {}
  let publicConfig = {}

  try {
    config = require('./config.json')
  } catch {
    try {
      config = require('./dist/config.json')
    } catch {}
  }

  try {
    publicConfig = require('./public/config.json')
  } catch {}

  res.json({
    ...config,
    defaultProxy: '', // FORCE using THIS proxy
    ...publicConfig
  })
})

/* ================================
   SPLASH TEXT JSON (FIXED)
================================ */
app.get('/splashes.json', (req, res) => {
  const splashPath = path.join(__dirname, 'dist', 'splashes.json')

  if (!fs.existsSync(splashPath)) {
    return res.status(404).json({ error: 'splashes.json not found' })
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.sendFile(splashPath)
})

/* ================================
   RESOURCE PACK CORS PROXY (WEB)
================================ */
app.get('/resourcepack.zip', async (req, res) => {
  try {
    const RESOURCE_PACK_URL =
      'https://pack.shadowvalesurvival.com/generated.zip'

    const response = await fetch(RESOURCE_PACK_URL)

    if (!response.ok) {
      console.error('Resource pack fetch failed:', response.status)
      return res.status(502).send('Failed to fetch resource pack')
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    await streamPipeline(response.body, res)
  } catch (err) {
    console.error('Resource pack proxy error:', err)
    res.status(500).send('Resource pack proxy failed')
  }
})

/* ================================
   PRODUCTION STATIC FILES
================================ */
if (isProd) {
  // Required for SharedArrayBuffer
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    next()
  })

  // Optional override folder
  app.use(express.static(path.join(__dirname, './public')))

  // Built client
  app.use(express.static(path.join(__dirname, './dist')))
}

/* ================================
   PORT
================================ */
const numArg = process.argv.find(x => /^\d+$/.test(x))
const port = (require.main === module ? numArg : undefined) || 8080

/* ================================
   START SERVER
================================ */
const server = app.listen(port, async () => {
  console.log('Proxy server listening on port ' + port)

  if (siModule && isProd) {
    try {
      const interfaces = await siModule.networkInterfaces()
      const list = Array.isArray(interfaces) ? interfaces : [interfaces]

      let netInterface = list.find(i => i.default)
      if (!netInterface) {
        netInterface = list.find(i => !i.virtual) ?? list[0]
      }

      if (netInterface?.ip4) {
        console.log(
          `Access at http://localhost:${port} or http://${netInterface.ip4}:${port}`
        )
      }
    } catch {}
  }
})

module.exports = { app }
