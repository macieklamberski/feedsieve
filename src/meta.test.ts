import { describe, expect, it } from 'bun:test'
import { hasStrongHash } from './meta.js'

describe('hasStrongHash', () => {
  it('should return true when guidHash is present', () => {
    expect(hasStrongHash({ guidHash: 'abc' })).toBe(true)
  })

  it('should return true when linkHash is present', () => {
    expect(hasStrongHash({ linkHash: 'abc' })).toBe(true)
  })

  it('should return true when enclosureHash is present', () => {
    expect(hasStrongHash({ enclosureHash: 'abc' })).toBe(true)
  })

  it('should return true when multiple strong hashes are present', () => {
    expect(hasStrongHash({ guidHash: 'abc', linkHash: 'def' })).toBe(true)
  })

  it('should return false when only titleHash is present', () => {
    expect(hasStrongHash({ titleHash: 'abc' })).toBe(false)
  })

  it('should return false when only contentHash is present', () => {
    expect(hasStrongHash({ contentHash: 'abc' })).toBe(false)
  })

  it('should return false when only summaryHash is present', () => {
    expect(hasStrongHash({ summaryHash: 'abc' })).toBe(false)
  })

  it('should return false when only fragment hashes are present', () => {
    expect(hasStrongHash({ guidFragmentHash: 'abc', linkFragmentHash: 'def' })).toBe(false)
  })

  it('should return false for empty hashes', () => {
    expect(hasStrongHash({})).toBe(false)
  })
})
