/// <reference types="./src/env" />
import { defineConfig, mergeRsbuildConfig, RsbuildPluginAPI } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTypedCSSModules } from '@rsbuild/plugin-typed-css-modules'
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill'
import childProcess from 'child_process'
import fs from 'fs'
import fsExtra from 'fs-extra'
import { promisify } from 'util'
import { appAndRendererSharedConfig } from './renderer/rsbuildSharedConfig'
import { genLargeDataAliases } from './scripts/genLargeDataAliases'

const execAsync = promisify(childProcess.exec)

const SINGLE_FILE_BUILD = process.env.SINGLE_FILE_BUILD === 'true'
const dev = process.env.NODE_ENV === 'development'
const buildingVersion = new Date().toISOString().split(':')[0]

// ------------------------------------
// Load config.json (+ local override)
// ------------------------------------
const configJson = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
try {
  const localConfig = process.env.LOCAL_CONFIG_FILE || './config.local.json'
  if (fs.existsSync(localConfig)) {
    Object.assign(configJson, JSON.parse(fs.readFileSync(localConfig, 'utf8')))
  }
} catch {}

if (dev) {
  configJson.defaultProxy = ':8080'
}

const configSource = (SINGLE_FILE_BUILD
  ? 'BUNDLED'
  : (process.env.CONFIG_JSON_SOURCE || 'REMOTE')) as 'BUNDLED' | 'REMOTE'

// ------------------------------------
// HTML
// ------------------------------------
const faviconPath = 'favicon.png'
const htmlTags: any[] = [{ tag: 'link', attrs: { rel: 'favicon', href: faviconPath } }]

if (!SINGLE_FILE_BUILD) {
  htmlTags.push(
    { tag: 'link', attrs: { rel: 'manifest', crossorigin: 'anonymous', href: 'manifest.json' } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: faviconPath } },
    { tag: 'meta', attrs: { property: 'og:image', content: faviconPath } }
  )
}

// ------------------------------------
// MAIN CONFIG
// ------------------------------------
const appConfig = defineConfig({
  html: {
    template: './index.html',
    inject: 'body',
    tags: htmlTags,
  },

  // ✅ THIS IS THE CRITICAL FIX
  output: {
    externals: {
      sharp: 'commonjs sharp', // ⬅️ prevents Rspack from parsing native .node
    },
    sourceMap: { js: 'source-map', css: true },
    inlineScripts: SINGLE_FILE_BUILD,
    inlineStyles: SINGLE_FILE_BUILD,
    dataUriLimit: 51200,
  },

  source: {
    entry: { index: './src/index.ts' },
    define: {
      'process.env.BUILD_VERSION': JSON.stringify(!dev ? buildingVersion : 'undefined'),
      'process.env.SINGLE_FILE_BUILD': JSON.stringify(process.env.SINGLE_FILE_BUILD),
      'process.platform': '"browser"',
      'process.env.INLINED_APP_CONFIG': JSON.stringify(
        configSource === 'BUNDLED' ? configJson : null
      ),
    },
  },

  plugins: [
    pluginReact(),
    pluginNodePolyfill(),
    pluginTypedCSSModules(),

    // ------------------------------------
    // INTERNAL BUILD PLUGIN
    // ------------------------------------
    {
      name: 'shadowvale-build-assets',
      setup(build: RsbuildPluginAPI) {
        const prep = async () => {
          console.log('[Shadowvale] Preparing build assets...')

          fs.mkdirSync('./dist', { recursive: true })
          fs.mkdirSync('./generated', { recursive: true })

          // --- Core data generation ---
          childProcess.execSync('tsx ./scripts/makeOptimizedMcData.mjs', { stdio: 'inherit' })
          childProcess.execSync('tsx ./scripts/optimizeBlockCollisions.ts', { stdio: 'inherit' })
          childProcess.execSync('tsx ./scripts/genShims.ts', { stdio: 'inherit' })
          genLargeDataAliases(
            SINGLE_FILE_BUILD || process.env.ALWAYS_COMPRESS_LARGE_DATA === 'true'
          )

          // --- Static assets ---
          fs.copyFileSync('./assets/favicon.png', './dist/favicon.png')

          if (fs.existsSync('./assets/background')) {
            fsExtra.copySync('./assets/background', './dist/background')
          }

          if (fs.existsSync('./assets/splashes.json')) {
            fs.copyFileSync('./assets/splashes.json', './dist/splashes.json')
          }

          // --- RESOURCE PACK ---
          if (fs.existsSync('./assets/generated.zip')) {
            console.log('[Shadowvale] Copying resource pack...')
            fs.copyFileSync(
              './assets/generated.zip',
              './dist/generated.zip'
            )
          }

	  // --- MUSIC ---
          if (fs.existsSync('./assets/music')) {
            console.log('Copying menu music...')
            fsExtra.copySync('./assets/music', './dist/music')
          }


          // --- NETLIFY HEADERS (CORS) ---
          if (fs.existsSync('./assets/_headers')) {
            fs.copyFileSync('./assets/_headers', './dist/_headers')
          }

          if (fs.existsSync('./assets/_redirects')) {
            fs.copyFileSync('./assets/_redirects', './dist/_redirects')
          }
          // --- Config.json for REMOTE mode ---
          if (configSource === 'REMOTE') {
            fs.writeFileSync(
              './dist/config.json',
              JSON.stringify(configJson, null, 2),
              'utf8'
            )
          }

          if (!dev) {
            await execAsync('pnpm run build-mesher')
          }
        }

        build.onBeforeBuild(prep)
        build.onBeforeStartDevServer(prep)
      },
    },
  ],
})

export default mergeRsbuildConfig(appAndRendererSharedConfig(), appConfig)
