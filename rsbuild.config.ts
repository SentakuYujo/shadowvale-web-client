/// <reference types="./src/env" />
import { defineConfig, mergeRsbuildConfig, RsbuildPluginAPI } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTypedCSSModules } from '@rsbuild/plugin-typed-css-modules'
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill'
import path from 'path'
import childProcess from 'child_process'
import fs from 'fs'
import fsExtra from 'fs-extra'
import { promisify } from 'util'
import { generateSW } from 'workbox-build'
import { getSwAdditionalEntries } from './scripts/build'
import { appAndRendererSharedConfig } from './renderer/rsbuildSharedConfig'
import { genLargeDataAliases } from './scripts/genLargeDataAliases'
import sharp from 'sharp'
import supportedVersions from './src/supportedVersions.mjs'
import { startWsServer } from './scripts/wsServer'

const SINGLE_FILE_BUILD = process.env.SINGLE_FILE_BUILD === 'true'
const execAsync = promisify(childProcess.exec)
const buildingVersion = new Date().toISOString().split(':')[0]
const dev = process.env.NODE_ENV === 'development'
const disableServiceWorker = process.env.DISABLE_SERVICE_WORKER === 'true'

//@ts-ignore
try { require('./localSettings.js') } catch (e) { }

const configJson = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
try {
    const localConfig = process.env.LOCAL_CONFIG_FILE || './config.local.json'
    if (fs.existsSync(localConfig)) Object.assign(configJson, JSON.parse(fs.readFileSync(localConfig, 'utf8')))
} catch (err) { }
if (dev) configJson.defaultProxy = ':8080'

const configSource = (SINGLE_FILE_BUILD ? 'BUNDLED' : (process.env.CONFIG_JSON_SOURCE || 'REMOTE')) as 'BUNDLED' | 'REMOTE'
const faviconPath = 'favicon.png'
const enableMetrics = process.env.ENABLE_METRICS === 'true'

const htmlTags: any[] = [{ tag: 'link', attrs: { rel: 'favicon', href: faviconPath } }]
if (!SINGLE_FILE_BUILD) {
    htmlTags.push({ tag: 'link', attrs: { rel: 'manifest', crossorigin: 'anonymous', href: 'manifest.json' } })
    htmlTags.push({ tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: faviconPath } })
    htmlTags.push({ tag: 'meta', attrs: { property: 'og:image', content: faviconPath } })
}

const appConfig = defineConfig({
    html: { template: './index.html', inject: 'body', tags: htmlTags },
    output: {
        externals: ['sharp'],
        sourceMap: { js: 'source-map', css: true },
        distPath: SINGLE_FILE_BUILD ? { html: './single' } : undefined,
        inlineScripts: SINGLE_FILE_BUILD,
        inlineStyles: SINGLE_FILE_BUILD,
        dataUriLimit: SINGLE_FILE_BUILD ? 1073741824 : 51200
    },
    source: {
        entry: { index: './src/index.ts' },
        define: {
            'process.env.BUILD_VERSION': JSON.stringify(!dev ? buildingVersion : 'undefined'),
            'process.env.SINGLE_FILE_BUILD': JSON.stringify(process.env.SINGLE_FILE_BUILD),
            'process.platform': '"browser"',
            'process.env.GITHUB_URL': JSON.stringify(`https://github.com/${process.env.GITHUB_REPOSITORY || 'unknown'}`),
            'process.env.WS_PORT': JSON.stringify(enableMetrics ? 8081 : false)
        }
    },
    plugins: [
        pluginReact(),
        pluginNodePolyfill(),
        pluginTypedCSSModules(),
        {
            name: 'internal-build-plugin',
            setup(build: RsbuildPluginAPI) {
                const prep = async () => {
                    console.log('Starting pre-build generation...')
                    fs.mkdirSync('./generated', { recursive: true })
                    fs.mkdirSync('./dist', { recursive: true })

                    // FIX: Ensure these scripts run to create the missing JSON files
                    console.log('Generating optimized Minecraft data...')
                    childProcess.execSync('tsx ./scripts/makeOptimizedMcData.mjs', { stdio: 'inherit' })
                    
                    console.log('Generating collision shapes...')
                    childProcess.execSync('tsx ./scripts/optimizeBlockCollisions.ts', { stdio: 'inherit' })
                    
                    console.log('Generating shims and aliases...')
                    childProcess.execSync('tsx ./scripts/genShims.ts', { stdio: 'inherit' })
                    genLargeDataAliases(SINGLE_FILE_BUILD || process.env.ALWAYS_COMPRESS_LARGE_DATA === 'true')
                    
                    fs.copyFileSync('./assets/favicon.png', './dist/favicon.png')
                    if (fs.existsSync('./assets/splashes.json')) {
                        fs.copyFileSync('./assets/splashes.json', './dist/splashes.json')
                    }
                }
                build.onBeforeBuild(prep)
                build.onBeforeStartDevServer(prep)
            }
        }
    ]
})

export default mergeRsbuildConfig(appAndRendererSharedConfig(), appConfig)