const MAX_WORDS = 5
const HTTPS_REGEX = /^https?:\/\//
const TIMEOUT_MS = 5000

const SPLASH_CACHE_KEY = 'minecraft_splash_text_cache'
const SPLASH_URL_KEY = 'minecraft_splash_url'

const limitWords = (text: string): string => {
  const words = text.split(/\s+/)
  if (words.length <= MAX_WORDS) return text
  return words.slice(0, MAX_WORDS).join(' ') + '...'
}

/* ===============================
   PUBLIC HELPERS (USED BY UI)
   =============================== */

export const isRemoteSplashText = (text: string): boolean => {
  if (!text) return false
  return HTTPS_REGEX.test(text) || text.endsWith('.json')
}

export const cacheSourceUrl = (url: string): void => {
  localStorage.setItem(SPLASH_URL_KEY, url)
}

export const clearSplashCache = (): void => {
  localStorage.removeItem(SPLASH_CACHE_KEY)
}

export const getCachedSplashText = (): string | null => {
  return localStorage.getItem(SPLASH_CACHE_KEY)
}

export const cacheSplashText = (text: string): void => {
  localStorage.setItem(SPLASH_CACHE_KEY, text)
}

/* ===============================
   REMOTE SPLASH LOADER
   =============================== */

export const loadRemoteSplashText = async (url: string): Promise<string> => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch splash text: ${response.status}`)
    }

    const data = await response.json()

    // ✅ Vanilla-style splashes.json (array)
    if (Array.isArray(data)) {
      if (data.length === 0) return 'Welcome!'
      const random = data[Math.floor(Math.random() * data.length)]
      return limitWords(String(random))
    }

    // ✅ Object support
    if (typeof data === 'object' && data !== null) {
      if ('title' in data) return limitWords(String(data.title))
      if ('text' in data) return limitWords(String(data.text))
      if ('message' in data) return limitWords(String(data.message))
    }

    // ✅ String fallback
    return limitWords(String(data))
  } catch (error) {
    console.error('Error loading remote splash text:', error)
    return 'Welcome!'
  }
}
