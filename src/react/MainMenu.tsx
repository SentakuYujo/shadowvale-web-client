import React, { useEffect, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import { miscUiState } from '../globalState'
import {
  isRemoteSplashText,
  loadRemoteSplashText,
  getCachedSplashText,
  cacheSplashText,
  cacheSourceUrl,
  clearSplashCache,
} from '../utils/splashText'
import styles from './mainMenu.module.css'
import Button from './Button'
import useLongPress from './useLongPress'
import PauseLinkButtons from './PauseLinkButtons'

type Action = (e: React.MouseEvent<HTMLButtonElement>) => void

interface Props {
  optionsAction?: Action
  versionStatus?: string
  versionTitle?: string
  onVersionStatusClick?: () => void
  versionText?: string
}

export default function MainMenu({
  optionsAction,
  versionText,
  versionStatus,
  versionTitle,
  onVersionStatusClick,
}: Props) {
  const { appConfig } = useSnapshot(miscUiState)

  /* ================= SPLASH TEXT ================= */

  const splashText = useMemo(() => {
    const cachedText = getCachedSplashText()
    const configSplashFromApp = appConfig?.splashText
    const isRemote =
      !!configSplashFromApp && isRemoteSplashText(configSplashFromApp)

    const sourceKey = isRemote
      ? configSplashFromApp
      : configSplashFromApp || ''

    const storedSourceKey = localStorage.getItem('minecraft_splash_url')

    if (storedSourceKey !== sourceKey) {
      clearSplashCache()
      cacheSourceUrl(sourceKey)
    } else if (cachedText) {
      return cachedText
    }

    if (!isRemote && configSplashFromApp?.trim()) {
      cacheSplashText(configSplashFromApp)
      return configSplashFromApp
    }

    return appConfig?.splashTextFallback || ''
  }, [appConfig])

  useEffect(() => {
    const splash = appConfig?.splashText
    if (splash && isRemoteSplashText(splash)) {
      loadRemoteSplashText(splash)
        .then(text => text && cacheSplashText(text))
        .catch(console.error)
    }
  }, [appConfig?.splashText])

  /* ================= VERSION LONG PRESS ================= */

  const versionLongPress = useLongPress(() => {
    const buildDate = process.env.BUILD_VERSION
      ? new Date(process.env.BUILD_VERSION + ':00:00.000Z')
      : null

    alert(
      `BUILD DATE:\n${buildDate?.toLocaleString() || 'Development build'}`
    )
  })

  /* ================= PLAY ================= */

  const onPlayClick = () => {
    window.dispatchEvent(
      new CustomEvent('connect', {
        detail: {
          server: 'play.shadowvalesurvival.com:25565',
          authenticatedAccount: true,
          proxy: 'https://proxy.mcraft.fun',
          botVersion: '1.21.8',
        },
      })
    )
  }

  /* ================= RENDER ================= */

  return (
    <div className={styles.root}>
      <div className={styles['game-title']}>
        <div className={styles.minecraft}>
          <div className={styles.edition} />
          <span className={styles.splash}>{splashText}</span>
        </div>
      </div>

      <div className={styles.menu}>
        {/* PLAY */}
        <Button onClick={onPlayClick}>Play</Button>

        {/* OPTIONS */}
        <Button onClick={optionsAction}>Options</Button>

        {/* STORE / DISCORD */}
        <div className={styles['menu-row']}>
          <PauseLinkButtons />
        </div>
      </div>

      <div className={styles['bottom-info']}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'gray' }} {...versionLongPress}>
            {versionText}
          </span>

          <span
            title={versionTitle}
            onClick={onVersionStatusClick}
            className={styles['product-info']}
          >
            Minecraft 1.21.8 {versionStatus}
          </span>
        </div>

        <span className={styles['product-description']}>
          {appConfig?.rightSideText}
        </span>
      </div>
    </div>
  )
}
