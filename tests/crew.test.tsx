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
