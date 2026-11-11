/** Stroke icons from the mocks; all decorative, so the button carries the name. */
interface IconProps {
  size?: number
}

function Icon({ size = 24, children }: IconProps & { children: preact.ComponentChildren }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const MenuIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
export const ConsoleIcon = (p: IconProps) => <Icon {...p}><path d="M4 6l5 5-5 5M12 17h8" /></Icon>
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5.5" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="12" cy="18.5" r="1.4" />
  </Icon>
)
export const PlayIcon = (p: IconProps) => <Icon {...p}><path d="M8 5.5l11 6.5-11 6.5z" /></Icon>
export const ReloadIcon = (p: IconProps) => <Icon {...p}><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" /></Icon>
export const ExpandIcon = (p: IconProps) => <Icon {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>
export const CollapseIcon = (p: IconProps) => <Icon {...p}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Icon>
export const ChevronUpIcon = (p: IconProps) => <Icon {...p}><path d="M6 14.5l6-6 6 6" /></Icon>
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="M6 9.5l6 6 6-6" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
