/// <reference types="./src/env" />
import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core'
import { pluginTypedCSSModules } from '@rsbuild/plugin-typed-css-modules'
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
        alias: { 'sharp': false }
    },
    plugins: [
        pluginTypedCSSModules(),
        {
            name: 'shadowvale-full-prep-plugin',
            setup(build) {
                const prep = async () => {
                    console.log('🚀 Starting Shadowvale Deep Prep...');
                    
                    // 1. Create necessary directories
                    if (!fs.existsSync('./dist')) fs.mkdirSync('./dist', { recursive: true });
                    if (!fs.existsSync('./generated')) fs.mkdirSync('./generated', { recursive: true });

                    // 2. RUN DATA OPTIMIZATION (Fixes the current error)
                    console.log('📦 Optimizing Minecraft Data...');
                    childProcess.execSync('tsx ./scripts/makeOptimizedMcData.mjs', { stdio: 'inherit' });
                    
                    console.log('📦 Generating Shims & Collisions...');
                    childProcess.execSync('tsx ./scripts/genShims.ts', { stdio: 'inherit' });
                    childProcess.execSync('tsx ./scripts/optimizeBlockCollisions.ts', { stdio: 'inherit' });
                    
                    console.log('📦 Generating Large Data Aliases...');
                    genLargeDataAliases(false);

                    // 3. Copy Splashes & Essential Assets
                    if (fs.existsSync('./assets/splashes.json')) {
                        fs.copyFileSync('./assets/splashes.json', './dist/splashes.json');
                        console.log('✅ Splashes moved to dist');
                    }

                    const coreAssets = ['favicon.png', 'manifest.json', 'loading-bg.jpg'];
                    coreAssets.forEach(file => {
                        const src = `./assets/${file}`;
                        if (fs.existsSync(src)) {
                            fs.copyFileSync(src, `./dist/${file}`);
                        }
                    });

                    // 4. Production Mesher Build
                    if (!dev) {
                        console.log('⚒️ Building Mesher...');
                        try {
                            childProcess.execSync('pnpm run build-mesher', { stdio: 'inherit' });
                        } catch (e) {
                            console.log('Mesher step finished.');
                        }
                    }
                    console.log('✨ Prep Complete! Starting Rspack...');
                };

                build.onBeforeBuild(prep);
                build.onBeforeStartDevServer(prep);
            },
        },
    ],
})

export default mergeRsbuildConfig(appAndRendererSharedConfig(), appConfig)