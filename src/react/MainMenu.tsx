import React, { useEffect, useMemo, useRef, useState } from 'react'
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

const MENU_MUSIC_SRC = '/music/main_menu.mp3' // served from dist/music/main_menu.mp3

export default function MainMenu({
  optionsAction,
  versionText,
  versionStatus,
  versionTitle,
  onVersionStatusClick,
}: Props) {
  const { appConfig } = useSnapshot(miscUiState)

  // -----------------------------
  // Auth State
  // -----------------------------
  const [hasMicrosoftAccount, setHasMicrosoftAccount] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('microsoft-auth')
    setHasMicrosoftAccount(!!stored)
  }, [])

  // -----------------------------
  // Splash Text
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
  // Main Menu Music (ONLY on MainMenu)
  // -----------------------------
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startedRef = useRef(false)

  const stopMenuMusic = () => {
    const a = audioRef.current
    if (!a) return
    try {
      a.pause()
      a.currentTime = 0
    } catch {}
  }

  useEffect(() => {
    const audio = new Audio(MENU_MUSIC_SRC)
    audio.loop = true
    audio.volume = 0.35
    audio.preload = 'auto'
    audioRef.current = audio

    const tryPlay = async () => {
      if (startedRef.current) return
      try {
        await audio.play()
        startedRef.current = true
      } catch {
        // autoplay blocked; will start on first user gesture
      }
    }

    // attempt autoplay on mount
    void tryPlay()

    // fallback: start music on first user interaction
    const onFirstGesture = async () => {
      await tryPlay()
      if (startedRef.current) {
        window.removeEventListener('pointerdown', onFirstGesture, true)
        window.removeEventListener('keydown', onFirstGesture, true)
      }
    }

    window.addEventListener('pointerdown', onFirstGesture, true)
    window.addEventListener('keydown', onFirstGesture, true)

    // cleanup on leaving main menu (stop + reset so it restarts when you come back)
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture, true)
      window.removeEventListener('keydown', onFirstGesture, true)

      try {
        audio.pause()
        audio.currentTime = 0
        // detach
        audio.src = ''
        audio.load()
      } catch {}

      audioRef.current = null
      startedRef.current = false
    }
  }, [])

  // -----------------------------
  // Version Long Press
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
    stopMenuMusic() // ensure it does NOT continue after Play

    window.dispatchEvent(
      new CustomEvent('connect', {
        detail: {
          server: 'play.shadowvalesurvival.com:25565',
          authenticatedAccount: true,
        },
      })
    )
  }

  const onOptionsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    stopMenuMusic() // ensure it does NOT continue in Options
    optionsAction?.(e)
  }

  const onMicrosoftLogin = () => {
    window.dispatchEvent(new CustomEvent('auth:microsoft'))
  }

  const onSignOut = () => {
    localStorage.removeItem('microsoft-auth')
    window.dispatchEvent(new CustomEvent('logout'))
    setHasMicrosoftAccount(false)
    location.reload()
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

        {!hasMicrosoftAccount && (
          <Button onClick={onMicrosoftLogin}>Sign in with Microsoft</Button>
        )}

        {hasMicrosoftAccount && <Button onClick={onSignOut}>Sign out</Button>}

        <Button onClick={onOptionsClick}>Options</Button>

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
