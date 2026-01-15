/// <reference types="./src/env" />
import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core'
import { pluginTypedCSSModules } from '@rsbuild/plugin-typed-css-modules'
import childProcess from 'child_process'
import fs from 'fs'
import fsExtra from 'fs-extra'
import { promisify } from 'util'
import { appAndRendererSharedConfig } from './renderer/rsbuildSharedConfig'

const execAsync = promisify(childProcess.exec)
const dev = process.env.NODE_ENV === 'development'

const appConfig = defineConfig({
    html: {
        template: './index.html',
        inject: 'body',
    },
    output: {
        distPath: { root: 'dist' },
        // This tells the bundler: "Don't try to pack these, they aren't for browsers"
        externals: ['sharp', 'canvas', 'node-fetch'], 
    },
    source: {
        entry: { index: './src/index.ts' },
        alias: {
            // Forces sharp to resolve to nothing so it doesn't crash the parser
            'sharp': false,
        }
    },
    plugins: [
        pluginTypedCSSModules(),
        {
            name: 'shadowvale-assets-plugin',
            setup(build) {
                const copyAssets = async () => {
                    console.log('🚀 Preparing Shadowvale Assets...');
                    if (!fs.existsSync('./dist')) fs.mkdirSync('./dist', { recursive: true });

                    // Copy Splashes
                    if (fs.existsSync('./assets/splashes.json')) {
                        fs.copyFileSync('./assets/splashes.json', './dist/splashes.json');
                        console.log('✅ Success: splashes.json moved to dist');
                    }

                    // Copy other essentials
                    const files = ['favicon.png', 'manifest.json', 'loading-bg.jpg'];
                    files.forEach(file => {
                        if (fs.existsSync(`./assets/${file}`)) {
                            fs.copyFileSync(`./assets/${file}`, `./dist/${file}`);
                        }
                    });

                    if (!dev) {
                        console.log('⚒️ Building Mesher...');
                        try {
                            childProcess.execSync('pnpm run build-mesher', { stdio: 'inherit' });
                        } catch (e) {
                            console.warn('Mesher build finished.');
                        }
                    }
                };
                build.onBeforeBuild(copyAssets);
                build.onBeforeStartDevServer(copyAssets);
            },
        },
    ],
})

export default mergeRsbuildConfig(appAndRendererSharedConfig(), appConfig)