import React, { useEffect, useMemo } from 'react'
import { openURL } from 'renderer/viewer/lib/simpleUtils'
import { useSnapshot } from 'valtio'
import { ConnectOptions } from '../connect'
import { miscUiState } from '../globalState'
import {
  isRemoteSplashText,
  loadRemoteSplashText,
  getCachedSplashText,
  cacheSplashText,
  cacheSourceUrl,
  clearSplashCache
} from '../utils/splashText'
import styles from './mainMenu.module.css'
import Button from './Button'
import ButtonWithTooltip from './ButtonWithTooltip'
import useLongPress from './useLongPress'
import PauseLinkButtons from './PauseLinkButtons'

/** 🔗 Shadowvale server (edit if needed) */
const SHADOWVALE_SERVER = 'play.shadowvalesurvival.com:25565'

type Action = (e: React.MouseEvent<HTMLButtonElement>) => void

interface Props {
  connectToServerAction?: Action
  optionsAction?: Action
  mapsProvider?: string
  versionStatus?: string
  versionTitle?: string
  onVersionStatusClick?: () => void
  bottomRightLinks?: string
  versionText?: string
  onVersionTextClick?: () => void
}

export default ({
  connectToServerAction,
  optionsAction,
  versionText,
  onVersionTextClick,
  versionStatus,
  versionTitle,
  onVersionStatusClick,
  bottomRightLinks,
}: Props) => {
  const { appConfig } = useSnapshot(miscUiState)

  const splashText = useMemo(() => {
    const cachedText = getCachedSplashText()

    const configSplashFromApp = appConfig?.splashText
    const isRemote = configSplashFromApp && isRemoteSplashText(configSplashFromApp)
    const sourceKey = isRemote ? configSplashFromApp : (configSplashFromApp || '')
    const storedSourceKey = localStorage.getItem('minecraft_splash_url')

    if (storedSourceKey !== sourceKey) {
      clearSplashCache()
      cacheSourceUrl(sourceKey)
    } else if (cachedText) {
      return cachedText
    }

    if (!isRemote && configSplashFromApp && configSplashFromApp.trim() !== '') {
      cacheSplashText(configSplashFromApp)
      return configSplashFromApp
    }

    return appConfig?.splashTextFallback || ''
  }, [])

  useEffect(() => {
    const configSplashFromApp = appConfig?.splashText
    if (configSplashFromApp && isRemoteSplashText(configSplashFromApp)) {
      loadRemoteSplashText(configSplashFromApp)
        .then(fetchedText => {
          if (fetchedText && fetchedText.trim() !== '' && !fetchedText.includes('Failed to load')) {
            cacheSplashText(fetchedText)
          }
        })
        .catch(error => {
          console.error('Failed to preload splash text for next session:', error)
        })
    }
  }, [appConfig?.splashText])

  if (!bottomRightLinks?.trim()) bottomRightLinks = undefined
  const linksParsed = bottomRightLinks?.split(/;|\n/g).map(l => {
    const parts = l.split(':')
    return [parts[0], parts.slice(1).join(':')]
  }) as Array<[string, string]> | undefined

  const versionLongPress = useLongPress(
    () => {
      const buildDate = process.env.BUILD_VERSION
        ? new Date(process.env.BUILD_VERSION + ':00:00.000Z')
        : null
      const hoursAgo = buildDate
        ? Math.round((Date.now() - buildDate.getTime()) / (1000 * 60 * 60))
        : null
      alert(
        `BUILD DATE:\n${buildDate?.toLocaleString() || 'Development build'}${
          hoursAgo ? `\nBuilt ${hoursAgo} hours ago` : ''
        }`
      )
    },
    () => onVersionTextClick?.(),
  )

  /** Dev-only long press (unchanged) */
  const connectToServerLongPress = useLongPress(
    () => {
      if (process.env.NODE_ENV === 'development') {
        const origin = window.location.hostname
        const connectOptions: ConnectOptions = {
          server: `${origin}:25565`,
          username: 'test',
        }
        dispatchEvent(new CustomEvent('connect', { detail: connectOptions }))
      }
    },
    () => connectToServerAction?.(null as any),
    { delay: 500 }
  )

  /** ✅ MAIN PLAY CLICK → SHADOWVALE */
  const connectToShadowvale = () => {
    const connectOptions: ConnectOptions = {
      server: SHADOWVALE_SERVER,
      username: localStorage.getItem('mc_username') ?? 'Player',
    }

    dispatchEvent(
      new CustomEvent('connect', {
        detail: connectOptions,
      })
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles['game-title']}>
        <div className={styles.minecraft}>
          <div className={styles.edition} />
          <span className={styles.splash}>{splashText}</span>
        </div>
      </div>

      <div className={styles.menu}>
<ButtonWithTooltip
  onClick={connectToShadowvale}
  data-test-id='servers-screen-button'
>
  Play
</ButtonWithTooltip>


        <Button onClick={optionsAction}>
          Options
        </Button>

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
            title={`${versionTitle}`}
            className={styles['product-info']}
          >
            Shadowvale Web Client {versionStatus}
          </span>
        </div>

        <span className={styles['product-description']}>
          <div className={styles['product-link']}>
            {linksParsed?.map(([name, link], i, arr) => {
              if (!link.startsWith('http')) link = `https://${link}`
              return (
                <div
                  key={name}
                  style={{ color: 'lightgray', fontSize: 8 }}
                >
                  <a style={{ whiteSpace: 'nowrap' }} href={link}>
                    {name}
                  </a>
                  {i < arr.length - 1 && <span style={{ marginLeft: 2 }}>·</span>}
                </div>
              )
            })}
          </div>
          <span>{appConfig?.rightSideText}</span>
        </span>
      </div>
    </div>
  )
}
