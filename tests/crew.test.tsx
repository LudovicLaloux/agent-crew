import { expect, mock, test } from 'claude-code/testing'

const scroll = { offset: 0, bodyRows: 20, maxOffset: 0 }

test('a spawned agent shows in the band and the panel, then finishes', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('agent.spawn', () => ({ model: 'test-model', agentId: 'a1' }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.complete', () => ({ text: 'ok' }))

  await $.agent.spawn({ prompt: 'Read the README', description: 'Read the README', subagentType: 'Explore' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({
      plugin: 'agent-crew', surface, component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll, view: {} },
    } as never)
    expect(await band.find({ type: 'Button', text: /1 agent in parallel/ })).toBeDefined()
    await band.unmount()

    const pane = await $.ui.mount({
      plugin: 'agent-crew', surface, component: 'Pane', requestId: 'agent-crew',
      props: { title: 'Running agents', isFocused: false, bodyColumns: 40, placement: 'dock', scroll, view: {} },
    } as never)
    expect(await pane.find({ type: 'Text', text: /Read the README/ })).toBeDefined()
    await pane.unmount()
  }

  await clock.advance(12_000)
  await $.turn.complete({ answer: 'ok', durationMs: 12_000, isAborted: false, turnId: 't1', agentId: 'a1', reason: 'answer' } as never)
  const pane = await $.ui.mount({
    plugin: 'agent-crew', surface: 'desktop', component: 'Pane', requestId: 'agent-crew',
    props: { title: 'Running agents', isFocused: false, bodyColumns: 40, placement: 'dock', scroll, view: {} },
  } as never)
  expect(await pane.find({ type: 'Text', text: /done in 12s/ })).toBeDefined()
})

test('each agent gets a Clawd costumed for its type, walking while it runs', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  let n = 0
  on('agent.spawn', () => ({ model: 'test-model', agentId: `a${++n}` }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.complete', () => ({ text: 'ok' }))

  await $.agent.spawn({ prompt: 'x', description: 'Explore', subagentType: 'Explore' })
  await $.agent.spawn({ prompt: 'x', description: 'Review', subagentType: 'Code Reviewer' })
  await $.agent.spawn({ prompt: 'x', description: 'Other', subagentType: 'general-purpose' })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', agentId: 'a3', reason: 'answer' } as never)

  const pane = await $.ui.mount({
    plugin: 'agent-crew', surface: 'desktop', component: 'Pane', requestId: 'agent-crew',
    props: { title: 'Running agents', isFocused: false, bodyColumns: 40, placement: 'dock', scroll, view: {} },
  } as never)
  const sources = (await pane.findAll({ type: 'Svg' })).map(s => String(s.props.source))
  expect(sources.some(s => s.includes('class="c-pirate run"'))).toBe(true)
  expect(sources.some(s => s.includes('class="c-detective run"'))).toBe(true)
  expect(sources.some(s => s.includes('class="c-plain"'))).toBe(true)
})

test('the band shows the Clawds on one line and its button opens the panel', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  let n = 0
  const opened: unknown[] = []
  on('agent.spawn', () => ({ model: 'test-model', agentId: `a${++n}` }))
  on('ui.open', (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } } as never
  })
  on('agent.list', () => ({ value: [] }) as never)

  for (let i = 0; i < 8; i++) await $.agent.spawn({ prompt: 'x', description: `Agent number ${i} with a long descriptive name`, subagentType: 'Explore' })

  const band = await $.ui.mount({
    plugin: 'agent-crew', surface: 'desktop', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll, view: {} },
  } as never)
  const svg = String((await band.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('class="c-pirate run"')
  expect(svg).toMatch(/>\+\d+</)

  const before = opened.length
  await band.press({ key: 'agent-crew-open' })
  expect(opened.length).toBe(before + 1)
  expect(opened.at(-1)).toMatchObject({ id: 'agent-crew' })
})

test('the terminal panel draws the same pixel Clawd as a Raster, its legs stepping each tick', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', () => ({ value: [] }) as never)

  let n = 0
  on('agent.spawn', () => ({ model: 'test-model', agentId: `a${++n}` }))
  await $.agent.spawn({ prompt: 'x', description: 'Explore', subagentType: 'Explore' })
  await $.agent.spawn({ prompt: 'x', description: 'Review', subagentType: 'Code Reviewer' })

  const raster = async (bodyRows = scroll.bodyRows) => {
    const pane = await $.ui.mount({
      plugin: 'agent-crew', surface: 'terminal', component: 'Pane', requestId: 'agent-crew',
      props: { title: 'Running agents', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { ...scroll, bodyRows }, view: {} },
    } as never)
    const r = await pane.find({ type: 'Raster' })
    // 14-row crabs sit side by side as cards, not stacked past the pane's height.
    expect(await pane.findAll({ type: 'Raster' })).toHaveLength(2)
    expect((await pane.findAll({ type: 'Box' })).some(b => b.props.flexWrap === 'wrap')).toBe(true)
    await pane.unmount()
    return r?.props as { columns: number; rows: number; cells: string }
  }

  const first = await raster()
  expect(first).toMatchObject({ columns: 30, rows: 14 })
  const words = new Uint32Array(Uint8Array.fromBase64(first.cells).buffer)
  expect(words.length).toBe(30 * 14 * 3)
  // Claude's clay (#D97757) paints the body.
  expect(words.includes(0xd97757)).toBe(true)

  // A pane too short for a full card halves the crab, which keeps its clay and still walks.
  const small = await raster(12)
  expect(small).toMatchObject({ columns: 15, rows: 7 })
  expect(new Uint32Array(Uint8Array.fromBase64(small.cells).buffer).includes(0xd97757)).toBe(true)

  await clock.advance(1_000)
  expect((await raster()).cells).not.toBe(first.cells)
  expect((await raster(12)).cells).not.toBe(small.cells)
})

test('the panel closes once the whole crew is done', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  let n = 0
  const closed: string[] = []
  on('agent.spawn', () => ({ model: 'test-model', agentId: `a${++n}` }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', (_$, e) => {
    closed.push(e.id)
    return { value: undefined } as never
  })
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.complete', () => ({ text: 'ok' }))

  await $.agent.spawn({ prompt: 'x', description: 'One', subagentType: 'Explore' })
  await $.agent.spawn({ prompt: 'x', description: 'Two', subagentType: 'Plan' })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', agentId: 'a1', reason: 'answer' } as never)
  await clock.advance(1_000)
  expect(closed).toEqual([])

  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't2', agentId: 'a2', reason: 'answer' } as never)
  await clock.advance(1_000)
  expect(closed).toEqual(['agent-crew'])
})
