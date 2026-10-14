import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CrewAgent, CrewStatus } from '../types'

const PANE = 'agent-crew'
const TITLE = 'Running agents'
const agents = atom({ plugin: 'agent-crew', key: 'agents' } as const, [])
const tick = atom({ plugin: 'agent-crew', key: 'tick' } as const, 0)

// One colour per agent, handed out in turn.
const PALETTE = ['#E8875B', '#5BA8E8', '#7BC47F', '#C58BE8', '#E8C35B', '#E86B8F', '#5BD1C9', '#A0A0F0']

const isLive = (a: CrewAgent) => a.status === 'running'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`
}

// Pixel Clawd and its costumes: adapted from savvy-progress (github.com/johnnyvizz/claude-kit, MIT),
// itself traced from DockCrab. A 24×18 crab on a 30×28 grid, one pixel = one <rect>.
const CLAY = '#D97757'
const INK = '#1F1E1D'

// `cls` puts the pixel in a group: `bd` the body and its costume, `la`/`lb` the leg pairs,
// any other name a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string) =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

const crabBody = (f: Fill, status: CrewStatus, armFront = 0, armCls?: string) => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  if (status === 'running') {
    f(9, 12, 2, 2, INK)
    f(19, 12, 2, 2, INK)
  } else if (status === 'failed') {
    stamp(f, 8, 11, ['k.k', '.k.', 'k.k'], { k: INK })
    stamp(f, 18, 11, ['k.k', '.k.', 'k.k'], { k: INK })
  } else {
    f(9, 13, 2, 1, INK)
    f(19, 13, 2, 1, INK)
  }
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

// CSS only: periods divide one second, so the ticker's redraw restarts them in phase.
const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-astronaut.run{animation:float 1s ease-in-out infinite}
.c-astronaut.run .la,.c-astronaut.run .lb,.c-astronaut.run .bd{animation:none}
.c-astronaut.run .ant{animation:blink 1s steps(1) infinite}
.c-astronaut.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-detective.run .it{animation:scan 1s steps(1) infinite}
.c-detective.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-engineer.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-chef.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-chef.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-racer.run .la{animation-duration:.25s}.c-racer.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-racer.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-pirate.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

type Costume = 'astronaut' | 'detective' | 'engineer' | 'chef' | 'racer' | 'pirate' | 'plain'

// `t` is the agent's colour, carried by the costume's accent; the body keeps Claude's clay.
const COSTUMES: Record<Costume, (f: Fill, s: CrewStatus, t: string) => void> = {
  astronaut: (f, s, t) => {
    crabBody(f, s)
    f(6, 7, 18, 1, '#E6E8EE'); f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 8, 18, 14, 'rgba(169,214,245,.32)'); f(8, 9, 2, 1, '#fff'); f(8, 10, 1, 2, '#fff')
    f(14, 4, 2, 3, '#C9CCD2'); f(14, 2, 2, 2, t, 'ant'); f(13, 18, 4, 2, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  detective: (f, s, t) => {
    crabBody(f, s, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' })
    f(6, 9, 18, 1, t)
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  engineer: (f, s, t) => {
    crabBody(f, s)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  chef: (f, s, t) => {
    crabBody(f, s, -4, 'pan')
    stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: t, d: '#B45F43' })
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
  },
  racer: (f, s, t) => {
    crabBody(f, s, -4)
    stamp(f, 6, 5, ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'], { r: t, w: '#F8F6F1', k: INK })
    f(25, 1, 1, 9, '#8E929A')
    stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  pirate: (f, s) => {
    crabBody(f, s)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  plain: (f, s) => crabBody(f, s),
}

// The costume follows the agent's job; order matters (a "Security Engineer" investigates before tinkering).
const costumeOf = (type: string): Costume => {
  if (/explore|search|grep/i.test(type)) return 'pirate'
  if (/review|checker|audit|security/i.test(type)) return 'detective'
  if (/plan|architect/i.test(type)) return 'chef'
  if (/prototyp|fetch/i.test(type)) return 'racer'
  if (/docs|research|guide|writer/i.test(type)) return 'astronaut'
  if (/engineer|developer|devops|builder|minimal/i.test(type)) return 'engineer'
  return 'plain'
}

const crabMarkup = (type: string, accent: string, status: CrewStatus) => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (x, y, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const costume = costumeOf(type)
  COSTUMES[costume](f, status, accent)
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  // Props sit inside `bd` to ride its bob; the legs step on their own.
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  const run = status === 'running' ? ' run' : ''
  const opacity = status === 'running' ? 1 : 0.55
  return `<g opacity="${opacity}" shape-rendering="crispEdges"><g class="c-${costume}${run}">${body}${group('la')}${group('lb')}</g></g>`
}

const avatarSvg = (type: string, accent: string, status: CrewStatus) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 28" width="33" height="31">${CRAB_CSS}${crabMarkup(type, accent, status)}</svg>`

// ── Desktop band: a single image, since the desktop wraps sibling elements onto new lines ──
const BAND_H = 28
const BAND_CSS = `<style>
.bt{font:600 12px system-ui,-apple-system,"Segoe UI",sans-serif;fill:#1f1e1d}
.bs{font:11px system-ui,-apple-system,"Segoe UI",sans-serif;fill:#6b6b68}
@media (prefers-color-scheme: dark){.bt{fill:#ececec}.bs{fill:#a8a8a4}}
</style>`

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
// An image cannot measure its text: estimate generously so the ellipsis lands before the edge.
const textW = (s: string, px: number) => s.length * px * 0.56
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`)

const bandSvg = (live: CrewAgent[], now: number, W: number) => {
  const CRAB = 24
  const MORE = 36
  let x = 0
  let chips = ''
  for (const [i, a] of live.entries()) {
    const color = PALETTE[a.color] ?? CLAY
    const meta = `${fmt(now - a.startedAt)}${a.lastTool ? ` · ${a.lastTool}` : ''}`
    const fixed = CRAB + 6 + 6 + textW(meta, 11) + 12
    const reserve = i < live.length - 1 ? MORE : 0
    const chars = Math.min(28, Math.floor((W - x - reserve - fixed) / (12 * 0.56)))
    if (chars < 6) {
      chips += `<text x="${x + 4}" y="18" class="bs">+${live.length - i}</text>`
      break
    }
    const label = clip(a.description, chars)
    const w = fixed + textW(label, 12)
    chips += `<g transform="translate(${x},0)">
<rect x=".5" y="1.5" width="${w - 1}" height="${BAND_H - 3}" rx="12.5" fill="${color}" fill-opacity=".14" stroke="${color}" stroke-opacity=".5"/>
<g transform="translate(5,3) scale(.8)">${crabMarkup(a.type, color, a.status)}</g>
<text x="${CRAB + 8}" y="18"><tspan class="bt">${esc(label)}</tspan><tspan class="bs" dx="6">${esc(meta)}</tspan></text></g>`
    x += w + 6
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAND_H}" viewBox="0 0 ${W} ${BAND_H}">${CRAB_CSS}${BAND_CSS}${chips}</svg>`
}

// ── Terminal avatar: the same pixel grid in a Raster, two pixels per cell (▀ = top in fg, bottom in bg) ──
const GRID_W = 30
const GRID_H = 28
const TERM_DEFAULT = 0x01000000
// shortcut: the terminal's background is unknown, so translucency blends over a dark one; read it if the API ever exposes it.
const BACKDROP = 0x1f1e1d

const parseColor = (c: string): [rgb: number, alpha: number] => {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (m) return [(Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
  const hex = c.slice(1)
  return [parseInt(hex.length === 3 ? [...hex].map(d => d + d).join('') : hex, 16), 1]
}

const mix = (over: number, under: number, a: number) =>
  [16, 8, 0].reduce((acc, s) => acc | (Math.round(((over >> s) & 255) * a + ((under >> s) & 255) * (1 - a)) << s), 0)

const crabCells = (type: string, accent: string, status: CrewStatus, frame: number) => {
  const px = new Array<number>(GRID_W * GRID_H).fill(TERM_DEFAULT)
  // The CSS gait, one tick per step: each leg pair lifts in turn.
  const lifted = status === 'running' ? (frame % 2 ? 'lb' : 'la') : null
  const f: Fill = (x, y, w, h, c, cls) => {
    const [rgb, a] = parseColor(c)
    const top = cls === lifted ? y - 1 : y
    for (let j = Math.max(0, top); j < Math.min(GRID_H, top + h); j++)
      for (let i = Math.max(0, x); i < Math.min(GRID_W, x + w); i++) {
        const under = px[j * GRID_W + i] ?? TERM_DEFAULT
        px[j * GRID_W + i] = a >= 1 ? rgb : mix(rgb, under === TERM_DEFAULT ? BACKDROP : under, a)
      }
  }
  COSTUMES[costumeOf(type)](f, status, accent)
  const shown = status === 'running' ? px : px.map(p => (p === TERM_DEFAULT ? p : mix(p, BACKDROP, 0.55)))
  const words = new Uint32Array(GRID_W * (GRID_H / 2) * 3)
  for (let r = 0; r < GRID_H / 2; r++)
    for (let i = 0; i < GRID_W; i++) {
      const top = shown[2 * r * GRID_W + i] ?? TERM_DEFAULT
      const bottom = shown[(2 * r + 1) * GRID_W + i] ?? TERM_DEFAULT
      const cell = top === TERM_DEFAULT ? [bottom === TERM_DEFAULT ? 0x20 : 0x2584, bottom, TERM_DEFAULT] : [0x2580, top, bottom]
      words.set(cell, (r * GRID_W + i) * 3)
    }
  return new Uint8Array(words.buffer).toBase64()
}

// One-line text version for the terminal band.
const avatarText = (status: CrewStatus, frame: number) => {
  if (status === 'done') return '◖ᵔᴗᵔ◗'
  if (status === 'failed') return '◖×_×◗'
  if (status === 'stopped') return '◖-_-◗'
  return ['◖•ᴗ•◗', '◖•ᴗ•◗', '◖-ᴗ-◗', '◖•ᴗ•◗ﾉ'][frame % 4]
}

const statusLabel: Record<CrewStatus, string> = {
  running: 'running',
  done: 'done',
  failed: 'failed',
  stopped: 'stopped',
}

let timer: { cancel: () => void } | null = null

function ensureTicker($: EngineInterface) {
  if (timer) return
  timer = $.clock.every(1000, () => {
    void (async () => {
      const list = await read($, agents)
      if (!list.some(isLive)) {
        timer?.cancel()
        timer = null
        return
      }
      // Reconcile with the engine's list (killed, failed agents…).
      try {
        const known = await $.agent.list()
        const byId = new Map(known.map(k => [k.id, k.status]))
        const now = await $.clock.now()
        await update($, agents, l =>
          l.map(a => {
            if (!isLive(a)) return a
            const s = byId.get(a.id)
            if (s === 'completed') return { ...a, status: 'done' as const, endedAt: now }
            if (s === 'failed') return { ...a, status: 'failed' as const, endedAt: now }
            if (s === 'killed') return { ...a, status: 'stopped' as const, endedAt: now }
            return a
          }),
        )
      } catch {
        // the list is only a safety net
      }
      await update($, tick, n => (n + 1) % 1_000_000)
    })()
  })
}

export const register: Register = on => {
  let colorCursor = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agents',
      description: 'Open the panel of running parallel agents',
    })
    const list = await read($, agents)
    if (list.some(isLive)) ensureTicker($)
    return next(e)
  })

  on('command.run', { command: 'agents' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Agents panel opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (!('agentId' in result) || !result.agentId) return result
    const id = result.agentId
    const now = await $.clock.now()
    const before = await read($, agents)
    const wasIdle = !before.some(isLive)
    const row: CrewAgent = {
      id,
      description: e.description || e.subagentType,
      type: e.subagentType,
      color: colorCursor++ % PALETTE.length,
      startedAt: now,
      endedAt: null,
      status: 'running',
      lastTool: null,
      tools: 0,
    }
    await update($, agents, l => {
      // keep the live agents + the last 12 finished ones
      const rest = l.filter(a => a.id !== id)
      const live = rest.filter(isLive)
      const ended = rest.filter(a => !isLive(a)).slice(-12)
      return [...ended, ...live, row]
    })
    ensureTicker($)
    if (wasIdle) void $.ui.open({ id: PANE, title: TITLE })
    return result
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      const tool = e.tool
      await update($, agents, l =>
        l.map(a => (a.id === id && isLive(a) ? { ...a, lastTool: tool, tools: a.tools + 1 } : a)),
      )
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      const now = await $.clock.now()
      const status: CrewStatus = e.isAborted ? 'stopped' : e.reason === 'answer' ? 'done' : 'failed'
      let finished: CrewAgent | undefined
      await update($, agents, l =>
        l.map(a => {
          if (a.id !== id || !isLive(a)) return a
          finished = { ...a, status, endedAt: now }
          return finished
        }),
      )
      const list = await read($, agents)
      if (finished && list.length > 1 && !list.some(isLive)) {
        $.ui.toast(`All agents finished (${list.filter(a => a.endedAt !== null).length})`)
      }
    }
    return next(e)
  })

  // ── Band above the prompt ────────────────────────────────────────────
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const list = await read($, agents)
    const live = list.filter(isLive)
    if (live.length === 0) return next(e)
    const frame = await read($, tick)
    const now = await $.clock.now()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const done = list.filter(a => !isLive(a) && a.endedAt !== null && a.endedAt >= Math.min(...live.map(l => l.startedAt))).length
    const summary = `${live.length} agent${live.length > 1 ? 's' : ''} in parallel${done > 0 ? ` · ${done} done` : ''}`
    // Only a Button takes clicks: it carries the summary and opens the panel (never closes it).
    const open = <Button key="agent-crew-open" label={`${summary} ›`} plain onPress={() => void $.ui.open({ id: PANE, title: TITLE })} />

    // The terminal gets an Svg that draws nothing: test the surface too.
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(160, Math.min(1600, (e.props.bodyColumns || 100) * 8 - textW(summary, 13) - 64))
      return (
        <Box flexDirection="row" alignItems="center" gap={1} overflow="hidden">
          {open}
          <Svg
            source={bandSvg(live, now, W)}
            alt={live.map(a => `${a.description}, ${fmt(now - a.startedAt)}`).join(' ; ')}
            width={W}
            height={BAND_H}
          />
        </Box>
      )
    }

    const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][frame % 10]
    return (
      <Box flexDirection="row" gap={1}>
        <Text color="claude" bold>{spin}</Text>
        {open}
        <Box flexShrink={1}>
          <Text wrap="truncate-end">
            {live.map(a => (
              <Text color={PALETTE[a.color]}>
                {'  '}{avatarText(a.status, frame)} {a.description} <Text dimColor>{fmt(now - a.startedAt)}</Text>
              </Text>
            ))}
          </Text>
        </Box>
      </Box>
    )
  })

  // ── Side panel with avatars ─────────────────────────────────────────
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, agents)
    const frame = await read($, tick)
    const now = await $.clock.now()
    const live = list.filter(isLive)
    const ended = list.filter(a => !isLive(a)).reverse()
    const ordered = [...live, ...ended]

    if (ordered.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No agents yet. They will show up here as soon as they start.</Text>
        </Box>
      )
    }

    const row = (a: CrewAgent) => {
      const color = PALETTE[a.color] ?? "#E8875B"
      const elapsed = fmt((a.endedAt ?? now) - a.startedAt)
      const detail = isLive(a)
        ? `${elapsed} · ${a.tools} tool${a.tools > 1 ? 's' : ''}${a.lastTool ? ` · ${a.lastTool}` : ''}`
        : `${statusLabel[a.status]} in ${elapsed} · ${a.tools} tool${a.tools > 1 ? 's' : ''}`
      let avatar
      if (e.surface === 'terminal') {
        const { Raster } = $.ui.resolve(e)
        avatar = <Raster key={`crab-${a.id}`} columns={GRID_W} rows={GRID_H / 2} cells={crabCells(a.type, color, a.status, frame)} />
      } else {
        const { Svg } = $.ui.resolve(e)
        avatar = (
          <Svg
            source={avatarSvg(a.type, color, a.status)}
            alt={`${a.description}: ${statusLabel[a.status]}`}
            width={33}
            height={31}
            isInteractive
          />
        )
      }
      return (
        <Box flexDirection="row" alignItems="center" columnGap={1} marginBottom={1}>
          {avatar}
          <Box flexDirection="column" flexShrink={1}>
            <Text bold={isLive(a)} dimColor={!isLive(a)} wrap="truncate-end">
              {a.description}
            </Text>
            <Text dimColor wrap="truncate-end">
              {a.type} · {detail}
            </Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text color="claude" bold>
          {live.length > 0 ? `${live.length} running` : 'All done'}
          {ended.length > 0 ? ` · ${ended.length} done` : ''}
        </Text>
        <Box marginTop={1} flexDirection="column">
          {ordered.map(row)}
        </Box>
      </Box>
    )
  })
}
