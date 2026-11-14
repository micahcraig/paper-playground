import { render } from 'preact'
import './theme/fonts.css'
import './theme/tokens.css'
import { App } from './app/App'
import { readStoredOverride, setThemeOverride } from './app/theme'

// Apply a saved theme before the first render so the page does not flash.
const savedTheme = readStoredOverride()
if (savedTheme) setThemeOverride(savedTheme)

render(<App />, document.getElementById('app')!)
