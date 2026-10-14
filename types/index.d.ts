export type CrewStatus = 'running' | 'done' | 'failed' | 'stopped'

export type CrewAgent = {
  id: string
  description: string
  type: string
  color: number
  startedAt: number
  endedAt: number | null
  status: CrewStatus
  lastTool: string | null
  tools: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-crew': { agents: CrewAgent[]; tick: number }
  }
}
