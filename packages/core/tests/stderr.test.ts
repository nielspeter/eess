import { describe, it, expect, vi, afterEach } from 'vitest'
import { writeStderr, resetStderrGuardForTests } from '../src/stderr.js'

afterEach(() => {
  resetStderrGuardForTests()
  vi.restoreAllMocks()
})

describe('writeStderr', () => {
  it('writes the message to process.stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    writeStderr('hello')
    expect(spy).toHaveBeenCalledWith('hello\n')
  })

  it('adds a trailing newline when absent', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    writeStderr('no newline')
    expect(spy).toHaveBeenCalledWith('no newline\n')
  })

  it('does not double a newline that is already present', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    writeStderr('already terminated\n')
    expect(spy).toHaveBeenCalledWith('already terminated\n')
  })

  it('attaches the EPIPE guard listener lazily, once, not per write', () => {
    const listenerSpy = vi.spyOn(process.stderr, 'on').mockImplementation(() => process.stderr)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    writeStderr('first')
    writeStderr('second')
    writeStderr('third')

    const errorListenerCalls = listenerSpy.mock.calls.filter(([event]) => String(event) === 'error')
    expect(errorListenerCalls).toHaveLength(1)
  })

  it('resetStderrGuardForTests lets the next writeStderr call reattach the listener', () => {
    const listenerSpy = vi.spyOn(process.stderr, 'on').mockImplementation(() => process.stderr)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    writeStderr('before reset')
    resetStderrGuardForTests()
    writeStderr('after reset')

    const errorListenerCalls = listenerSpy.mock.calls.filter(([event]) => String(event) === 'error')
    expect(errorListenerCalls).toHaveLength(2)
  })
})
