import { useSnapshot } from 'valtio'
import { openURL } from 'renderer/viewer/lib/simpleUtils'
import { ErrorBoundary } from '@zardoy/react-util'
import { miscUiState } from '../globalState'
import Button from './Button'
import styles from './PauseScreen.module.css'

function PauseLinkButtonsInner () {
  const { appConfig } = useSnapshot(miscUiState)
  const pauseLinksConfig = appConfig?.pauseLinks

  if (!pauseLinksConfig) return null

  const renderButton = (
    button: Record<string, any>,
    style: React.CSSProperties,
    key: number
  ) => {
    // 🔵 Discord → NORMAL button (no dropdown)
    if (button.type === 'discord') {
      return (
        <Button
          key={key}
          className="button"
          style={style}
          onClick={() => openURL(button.url ?? 'https://discord.shadowvalesurvival.com')}
        >
          {button.text ?? 'Discord'}
        </Button>
      )
    }

    // 🟡 GitHub → Store
    if (button.type === 'github') {
      return (
        <Button
          key={key}
          className="button"
          style={style}
          onClick={() => openURL(button.url ?? 'https://store.shadowvalesurvival.com')}
        >
          {button.text ?? 'Store'}
        </Button>
      )
    }

    // 🔗 Generic URL button
    if (button.type === 'url' && button.text && button.url) {
      return (
        <Button
          key={key}
          className="button"
          style={style}
          onClick={() => openURL(button.url)}
        >
          {button.text}
        </Button>
      )
    }

    return null
  }

  return (
    <>
      {pauseLinksConfig.map((row, i) => {
        const style = {
          width: (204 / row.length - (row.length > 1 ? 4 : 0)) + 'px'
        }

        return (
          <div key={i} className={styles.row}>
            {row.map((button, k) => renderButton(button, style, k))}
          </div>
        )
      })}
    </>
  )
}

export default () => (
  <ErrorBoundary
    renderError={(error) => {
      console.error(error)
      return null
    }}
  >
    <PauseLinkButtonsInner />
  </ErrorBoundary>
)
