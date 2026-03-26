import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getSettings, updateSettings } from './api'

interface SettingsContextType {
  settings: Record<string, string>
  loaded: boolean
  saveSettings: (data: Record<string, string>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType>({
  settings: {},
  loaded: false,
  saveSettings: async () => {}
})

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loaded, setLoaded]     = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s); setLoaded(true) })
      .catch(console.error)
  }, [])

  const saveSettings = useCallback(async (data: Record<string, string>) => {
    await updateSettings(data)
    // Merge into local cache immediately — no need to re-fetch
    setSettings((prev) => ({ ...prev, ...data }))
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loaded, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextType {
  return useContext(SettingsContext)
}
