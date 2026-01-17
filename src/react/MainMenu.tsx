import React, { useEffect, useMemo, useState } from 'react'
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

const MS_CACHE_KEY = 'shadowvale_ms_cached_tokens_v1'
const MS_PROFILE_KEY = 'shadowvale_ms_profile_v1'

function hasSavedMicrosoftLogin() {
  try {
    const raw = localStorage.getItem(MS_CACHE_KEY)
    if (!raw) return false
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && Object.keys(obj).length > 0
  } catch {
    return false
  }
}

function getSavedProfileName() {
  try {
    const raw = localStorage.getItem(MS_PROFILE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return typeof p?.username === 'string' ? p.username : null
  } catch {
    return null
  }
}

export default function MainMenu({
  optionsAction,
  versionText,
  versionStatus,
  versionTitle,
  onVersionStatusClick,
}: Props) {
  const { appConfig } = useSnapshot(miscUiState)

  // -----------------------------
  // Auth UI state
  // -----------------------------
  const [signedIn, setSignedIn] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      setSignedIn(hasSavedMicrosoftLogin())
      setProfileName(getSavedProfileName())
    }
    sync()

    const onAuthChanged = () => sync()
    window.addEventListener('auth:changed', onAuthChanged as any)
    return () => window.removeEventListener('auth:changed', onAuthChanged as any)
  }, [])

  // -----------------------------
  // Splash text
  // -----------------------------
  const splashText = useMemo(() => {
    const cachedText = getCachedSplashText()
    const configSplash = appConfig?.splashText
    const isRemote = configSplash && isRemoteSplashText(configSplash)
    const sourceKey = isRemote ? configSplash : configSplash || ''
    const storedSourceKey = localStorage.getItem('minecraft_splash_url')

    if (storedSourceKey !== sourceKey) {
      clearSplashCache()
      cacheSourceUrl(sourceKey)
    } else if (cachedText) {
      return cachedText
    }

    if (!isRemote && configSplash?.trim()) {
      cacheSplashText(configSplash)
      return configSplash
    }

    return appConfig?.splashTextFallback || 'Welcome!'
  }, [appConfig?.splashText, appConfig?.splashTextFallback])

  useEffect(() => {
    const splash = appConfig?.splashText
    if (splash && isRemoteSplashText(splash)) {
      loadRemoteSplashText(splash)
        .then(text => text && cacheSplashText(text))
        .catch(console.error)
    }
  }, [appConfig?.splashText])

  // -----------------------------
  // Version long-press
  // -----------------------------
  const versionLongPress = useLongPress(() => {
    const buildDate = process.env.BUILD_VERSION
      ? new Date(process.env.BUILD_VERSION + ':00:00.000Z')
      : null
    alert(`BUILD DATE:\n${buildDate?.toLocaleString() || 'Development build'}`)
  })

  // -----------------------------
  // Actions
  // -----------------------------
  const onPlayClick = () => {
    window.dispatchEvent(
      new CustomEvent('connect', {
        detail: {
          server: 'play.shadowvalesurvival.com:25565',
          authenticatedAccount: true, // will now use saved MS cache
	  proxy: 'https://proxy.mcraft.fun',
          botVersion: '1.21.8',
        },
      })
    )
  }


  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className={styles.root}>
      <div className={styles['game-title']}>
        <div className={styles.minecraft}>
          <div className={styles.edition} />
          <span className={styles.splash}>{splashText}</span>
        </div>
      </div>

      <div className={styles.menu}>
        <Button onClick={onPlayClick}>Play</Button>

        <Button onClick={optionsAction}>Options</Button>

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
            className={styles['product-info']}
          >
            Minecraft 1.21.8
          </span>
        </div>

        <span className={styles['product-description']}>
          {appConfig?.rightSideText}
        </span>
      </div>
    </div>
  )
}
