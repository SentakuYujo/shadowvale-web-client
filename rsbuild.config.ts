/// <reference types="./src/env" />
import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core'
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
const dev = process.env.NODE_ENV === 'development'

const appConfig = defineConfig({
    html: {
        template: './index.html',
        inject: 'body',
    },
    output: {
        distPath: { root: 'dist' },
        externals: ['sharp', 'canvas', 'node-fetch'], 
    },
    source: {
        entry: { index: './src/index.ts' },
        alias: { 'sharp': false },
        define: {
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.platform': '"browser"',
            'global': 'window', // Crucial: redirects global calls to window
            'node': 'undefined',  // Fixes the specific ReferenceError: node is not defined
        }
    },
    plugins: [
        pluginReact(),
        pluginNodePolyfill(), // Injects Buffer, process, etc.
        pluginTypedCSSModules(),
        {
            name: 'shadowvale-full-prep-plugin',
            setup(build) {
                const prep = async () => {
                    console.log('🚀 Running Shadowvale Deep Prep...');
                    if (!fs.existsSync('./dist')) fs.mkdirSync('./dist', { recursive: true });
                    if (!fs.existsSync('./generated')) fs.mkdirSync('./generated', { recursive: true });

                    console.log('📦 Generating Minecraft Data & Shims...');
                    childProcess.execSync('tsx ./scripts/makeOptimizedMcData.mjs', { stdio: 'inherit' });
                    childProcess.execSync('tsx ./scripts/genShims.ts', { stdio: 'inherit' });
                    childProcess.execSync('tsx ./scripts/optimizeBlockCollisions.ts', { stdio: 'inherit' });
                    genLargeDataAliases(false);

                    // Asset Sync (Splashes, etc.)
                    if (fs.existsSync('./assets/splashes.json')) {
                        fs.copyFileSync('./assets/splashes.json', './dist/splashes.json');
                        console.log('✅ splashes.json ready');
                    }
                    
                    const coreAssets = ['favicon.png', 'manifest.json', 'loading-bg.jpg'];
                    coreAssets.forEach(file => {
                        const src = `./assets/${file}`;
                        if (fs.existsSync(src)) fs.copyFileSync(src, `./dist/${file}`);
                    });

                    if (!dev) {
                        console.log('⚒️ Building Mesher...');
                        try {
                            childProcess.execSync('pnpm run build-mesher', { stdio: 'inherit' });
                        } catch (e) { console.log('Mesher build finished.'); }
                    }
                };
                build.onBeforeBuild(prep);
                build.onBeforeStartDevServer(prep);
            },
        },
    ],
})

export default mergeRsbuildConfig(appAndRendererSharedConfig(), appConfig)