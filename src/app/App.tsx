import { THEME_NAMES, useTheme } from './theme'
import './app.css'

/** M0 placeholder: shows the app name and the active theme. */
export function App() {
  const theme = useTheme()
  return (
    <main class="placeholder">
      <h1>Paper Playground</h1>
      <p>
        Theme: <span data-testid="theme-name">{THEME_NAMES[theme]}</span>
      </p>
      <p class="muted">Touch-first creative coding for Paper.js. The editor arrives in M2.</p>
    </main>
  )
}
