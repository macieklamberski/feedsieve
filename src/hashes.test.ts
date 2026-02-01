import { describe, expect, it } from 'bun:test'
import { buildBatchDedupKey, buildIdentifierKey, computeItemHashes } from './hashes.js'
import { emptyCollisions } from './meta.js'
import type { HashableItem } from './types.js'

describe('computeItemHashes', () => {
  it('should compute all hashes when all fields present', () => {
    const value: HashableItem = {
      guid: 'https://example.com/post-1',
      link: 'https://example.com/post-1',
      title: 'Post Title',
      summary: 'Post summary text',
      content: 'Post content text',
      enclosures: [{ url: 'https://example.com/audio.mp3' }],
    }

    const result = computeItemHashes(value)

    expect(result.guidHash).toMatch(/^[a-f0-9]{32}$/)
    expect(result.linkHash).toMatch(/^[a-f0-9]{32}$/)
    expect(result.enclosureHash).toMatch(/^[a-f0-9]{32}$/)
    expect(result.titleHash).toMatch(/^[a-f0-9]{32}$/)
    expect(result.summaryHash).toMatch(/^[a-f0-9]{32}$/)
    expect(result.contentHash).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should compute only guidHash when only guid present', () => {
    const value: HashableItem = { guid: 'abc-123' }

    const result = computeItemHashes(value)

    expect(result.guidHash).toMatch(/^[a-f0-9]{32}$/)
    expect(result.linkHash).toBeUndefined()
    expect(result.enclosureHash).toBeUndefined()
    expect(result.titleHash).toBeUndefined()
    expect(result.summaryHash).toBeUndefined()
    expect(result.contentHash).toBeUndefined()
  })

  it('should return no hashes when no relevant fields present', () => {
    const value: HashableItem = {}

    const result = computeItemHashes(value)

    expect(result.guidHash).toBeUndefined()
    expect(result.linkHash).toBeUndefined()
    expect(result.enclosureHash).toBeUndefined()
    expect(result.titleHash).toBeUndefined()
    expect(result.summaryHash).toBeUndefined()
    expect(result.contentHash).toBeUndefined()
  })

  it('should use first enclosure URL when no isDefault', () => {
    const value: HashableItem = {
      enclosures: [
        { url: 'https://example.com/first.mp3' },
        { url: 'https://example.com/second.mp3' },
      ],
    }

    const valueFirstOnly: HashableItem = {
      enclosures: [{ url: 'https://example.com/first.mp3' }],
    }

    expect(computeItemHashes(value).enclosureHash).toBe(
      computeItemHashes(valueFirstOnly).enclosureHash,
    )
  })

  it('should prefer isDefault enclosure for enclosureHash', () => {
    const value: HashableItem = {
      enclosures: [
        { url: 'https://example.com/first.mp3' },
        { url: 'https://example.com/default.mp3', isDefault: true },
      ],
    }

    const valueDefaultOnly: HashableItem = {
      enclosures: [{ url: 'https://example.com/default.mp3' }],
    }

    expect(computeItemHashes(value).enclosureHash).toBe(
      computeItemHashes(valueDefaultOnly).enclosureHash,
    )
  })

  it('should produce stable hashes for same input', () => {
    const value: HashableItem = {
      guid: 'guid-1',
      link: 'https://example.com/post',
      title: 'Post Title',
      enclosures: [{ url: 'https://example.com/audio.mp3' }],
    }

    expect(computeItemHashes(value)).toEqual(computeItemHashes(value))
  })

  it('should produce same guidHash for equivalent URL GUIDs', () => {
    const value1: HashableItem = { guid: 'https://example.com/post' }
    const value2: HashableItem = { guid: 'http://www.example.com/post/' }

    expect(computeItemHashes(value1).guidHash).toBe(computeItemHashes(value2).guidHash)
  })

  it('should produce same linkHash for equivalent URLs', () => {
    const value1: HashableItem = { link: 'https://example.com/post' }
    const value2: HashableItem = { link: 'http://www.example.com/post/' }

    expect(computeItemHashes(value1).linkHash).toBe(computeItemHashes(value2).linkHash)
  })

  it('should produce same titleHash for equivalent titles', () => {
    const value1: HashableItem = { title: '  Hello  World  ' }
    const value2: HashableItem = { title: 'hello world' }

    expect(computeItemHashes(value1).titleHash).toBe(computeItemHashes(value2).titleHash)
  })

  it('should produce same summaryHash for equivalent summaries', () => {
    const value1: HashableItem = { summary: '  Hello  World  ' }
    const value2: HashableItem = { summary: 'hello world' }

    expect(computeItemHashes(value1).summaryHash).toBe(computeItemHashes(value2).summaryHash)
  })

  it('should produce different contentHash for different content', () => {
    const value1: HashableItem = { content: '<p>Hello</p>' }
    const value2: HashableItem = { content: '<p>World</p>' }

    expect(computeItemHashes(value1).contentHash).not.toBe(computeItemHashes(value2).contentHash)
  })

  it('should skip contentHash when content is undefined', () => {
    const value: HashableItem = { title: 'Post' }

    expect(computeItemHashes(value).contentHash).toBeUndefined()
  })

  it('should skip enclosureHash when enclosures array is empty', () => {
    const value: HashableItem = { enclosures: [] }

    expect(computeItemHashes(value).enclosureHash).toBeUndefined()
  })

  it('should skip enclosureHash when first enclosure has no url', () => {
    const value = { enclosures: [{}] }

    expect(computeItemHashes(value).enclosureHash).toBeUndefined()
  })

  it('should compute linkFragmentHash when link contains fragment', () => {
    const value: HashableItem = { link: 'https://example.com/post#section' }

    expect(computeItemHashes(value).linkFragmentHash).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should not compute linkFragmentHash when link has no fragment', () => {
    const value: HashableItem = { link: 'https://example.com/post' }

    expect(computeItemHashes(value).linkFragmentHash).toBeUndefined()
  })

  it('should produce different linkFragmentHash for different fragments', () => {
    const value1: HashableItem = { link: 'https://example.com/post#Earth2' }
    const value2: HashableItem = { link: 'https://example.com/post#LimeVPN' }

    expect(computeItemHashes(value1).linkFragmentHash).not.toBe(
      computeItemHashes(value2).linkFragmentHash,
    )
  })

  it('should produce same linkHash for links differing only by fragment', () => {
    const value1: HashableItem = { link: 'https://example.com/post#Earth2' }
    const value2: HashableItem = { link: 'https://example.com/post#LimeVPN' }

    expect(computeItemHashes(value1).linkHash).toBe(computeItemHashes(value2).linkHash)
  })

  it('should not compute linkFragmentHash when link is undefined', () => {
    const value: HashableItem = { guid: 'abc-123' }

    expect(computeItemHashes(value).linkFragmentHash).toBeUndefined()
  })

  it('should compute guidFragmentHash when guid is URL with fragment', () => {
    const value: HashableItem = { guid: 'https://example.com/page#item1' }

    expect(computeItemHashes(value).guidFragmentHash).toMatch(/^[a-f0-9]{32}$/)
  })

  it('should not compute guidFragmentHash when guid is URL without fragment', () => {
    const value: HashableItem = { guid: 'https://example.com/page' }

    expect(computeItemHashes(value).guidFragmentHash).toBeUndefined()
  })

  it('should not compute guidFragmentHash when guid is non-URL', () => {
    const value: HashableItem = { guid: 'abc-123#fragment' }

    expect(computeItemHashes(value).guidFragmentHash).toBeUndefined()
  })

  it('should produce different guidFragmentHash for different fragments', () => {
    const value1: HashableItem = { guid: 'https://example.com/page#Earth2' }
    const value2: HashableItem = { guid: 'https://example.com/page#LimeVPN' }

    expect(computeItemHashes(value1).guidFragmentHash).not.toBe(
      computeItemHashes(value2).guidFragmentHash,
    )
  })

  it('should produce same guidHash for URL GUIDs differing only by fragment', () => {
    const value1: HashableItem = { guid: 'https://example.com/page#Earth2' }
    const value2: HashableItem = { guid: 'https://example.com/page#LimeVPN' }

    expect(computeItemHashes(value1).guidHash).toBe(computeItemHashes(value2).guidHash)
  })
})

describe('buildIdentifierKey', () => {
  it('should include all strong hashes when all present', () => {
    const value = { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' }
    const expected = 'g:g1|gf:|l:l1|lf:|e:e1|t:'

    expect(buildIdentifierKey(value)).toBe(expected)
  })

  it('should include fragment hashes when present', () => {
    const value = {
      guidHash: 'g1',
      guidFragmentHash: 'gf1',
      linkHash: 'l1',
      linkFragmentHash: 'lf1',
    }
    const expected = 'g:g1|gf:gf1|l:l1|lf:lf1|e:|t:'

    expect(buildIdentifierKey(value)).toBe(expected)
  })

  it('should produce different keys for items differing only by link fragment', () => {
    const value1 = { linkHash: 'l1', linkFragmentHash: 'lf-earth' }
    const value2 = { linkHash: 'l1', linkFragmentHash: 'lf-lime' }

    expect(buildIdentifierKey(value1)).not.toBe(buildIdentifierKey(value2))
  })

  it('should exclude titleHash when any strong hash exists', () => {
    const value = { guidHash: 'g1', titleHash: 't1' }
    const expected = 'g:g1|gf:|l:|lf:|e:|t:'

    expect(buildIdentifierKey(value)).toBe(expected)
  })

  it('should include titleHash when no strong hashes exist', () => {
    const value = { titleHash: 't1' }
    const expected = 'g:|gf:|l:|lf:|e:|t:t1'

    expect(buildIdentifierKey(value)).toBe(expected)
  })

  it('should return undefined when no hashes exist', () => {
    const value = {}

    expect(buildIdentifierKey(value)).toBeUndefined()
  })

  it('should handle guid-only hash', () => {
    const value = { guidHash: 'g1' }
    const expected = 'g:g1|gf:|l:|lf:|e:|t:'

    expect(buildIdentifierKey(value)).toBe(expected)
  })

  it('should handle link-only hash', () => {
    const value = { linkHash: 'l1' }
    const expected = 'g:|gf:|l:l1|lf:|e:|t:'

    expect(buildIdentifierKey(value)).toBe(expected)
  })

  it('should handle enclosure-only hash', () => {
    const value = { enclosureHash: 'e1' }
    const expected = 'g:|gf:|l:|lf:|e:e1|t:'

    expect(buildIdentifierKey(value)).toBe(expected)
  })
})

describe('buildBatchDedupKey', () => {
  it('should return guid key when guid is unique', () => {
    const value = { guidHash: 'g1', linkHash: 'l1' }

    expect(buildBatchDedupKey(value, emptyCollisions)).toBe('g:g1')
  })

  it('should split guid with guid fragment when guid collides and guid fragment is safe', () => {
    const collisions = { ...emptyCollisions, guidHash: new Set(['g1']) }
    const value = { guidHash: 'g1', guidFragmentHash: 'gf1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('g:g1|gf:gf1')
  })

  it('should split guid with enclosure when guid and guid fragment collide', () => {
    const collisions = {
      ...emptyCollisions,
      guidHash: new Set(['g1']),
      guidFragmentHash: new Set(['gf1']),
    }
    const value = { guidHash: 'g1', guidFragmentHash: 'gf1', enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('g:g1|e:e1')
  })

  it('should split guid with enclosure when guid collides and enclosure is safe', () => {
    const collisions = { ...emptyCollisions, guidHash: new Set(['g1']) }
    const value = { guidHash: 'g1', enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('g:g1|e:e1')
  })

  it('should split guid with link when guid and enclosure collide but link is safe', () => {
    const collisions = {
      ...emptyCollisions,
      guidHash: new Set(['g1']),
      enclosureHash: new Set(['e1']),
    }
    const value = { guidHash: 'g1', enclosureHash: 'e1', linkHash: 'l1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('g:g1|l:l1')
  })

  it('should split guid with link fragment when guid, enclosure, and link all collide but link fragment is safe', () => {
    const collisions = {
      ...emptyCollisions,
      guidHash: new Set(['g1']),
      enclosureHash: new Set(['e1']),
      linkHash: new Set(['l1']),
    }
    const value = {
      guidHash: 'g1',
      enclosureHash: 'e1',
      linkHash: 'l1',
      linkFragmentHash: 'lf1',
    }

    expect(buildBatchDedupKey(value, collisions)).toBe('g:g1|lf:lf1')
  })

  it('should split guid with title when guid, enclosure, link, and link fragment all collide', () => {
    const collisions = {
      ...emptyCollisions,
      guidHash: new Set(['g1']),
      enclosureHash: new Set(['e1']),
      linkHash: new Set(['l1']),
      linkFragmentHash: new Set(['lf1']),
    }
    const value = {
      guidHash: 'g1',
      enclosureHash: 'e1',
      linkHash: 'l1',
      linkFragmentHash: 'lf1',
      titleHash: 't1',
    }

    expect(buildBatchDedupKey(value, collisions)).toBe('g:g1|t:t1')
  })

  it('should return undefined when guid collides and all splitters are unsafe', () => {
    const collisions = {
      ...emptyCollisions,
      guidHash: new Set(['g1']),
      enclosureHash: new Set(['e1']),
      linkHash: new Set(['l1']),
      titleHash: new Set(['t1']),
    }
    const value = { guidHash: 'g1', enclosureHash: 'e1', linkHash: 'l1', titleHash: 't1' }

    expect(buildBatchDedupKey(value, collisions)).toBeUndefined()
  })

  it('should return undefined when guid collides and no splitter hashes exist', () => {
    const collisions = { ...emptyCollisions, guidHash: new Set(['g1']) }
    const value = { guidHash: 'g1' }

    expect(buildBatchDedupKey(value, collisions)).toBeUndefined()
  })

  it('should return link key when link is unique', () => {
    const value = { linkHash: 'l1' }

    expect(buildBatchDedupKey(value, emptyCollisions)).toBe('l:l1')
  })

  it('should split link with fragment when link collides and fragment is safe', () => {
    const collisions = { ...emptyCollisions, linkHash: new Set(['l1']) }
    const value = { linkHash: 'l1', linkFragmentHash: 'lf1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('l:l1|lf:lf1')
  })

  it('should prefer fragment over enclosure as link splitter', () => {
    const collisions = { ...emptyCollisions, linkHash: new Set(['l1']) }
    const value = { linkHash: 'l1', linkFragmentHash: 'lf1', enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('l:l1|lf:lf1')
  })

  it('should fall back to enclosure when link and fragment both collide', () => {
    const collisions = {
      ...emptyCollisions,
      linkHash: new Set(['l1']),
      linkFragmentHash: new Set(['lf1']),
    }
    const value = { linkHash: 'l1', linkFragmentHash: 'lf1', enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('l:l1|e:e1')
  })

  it('should split link with enclosure when link collides and enclosure is safe', () => {
    const collisions = { ...emptyCollisions, linkHash: new Set(['l1']) }
    const value = { linkHash: 'l1', enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('l:l1|e:e1')
  })

  it('should split link with title when link and enclosure collide but title is safe', () => {
    const collisions = {
      ...emptyCollisions,
      linkHash: new Set(['l1']),
      enclosureHash: new Set(['e1']),
    }
    const value = { linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('l:l1|t:t1')
  })

  it('should return undefined when link collides and all splitters are unsafe', () => {
    const collisions = {
      ...emptyCollisions,
      linkHash: new Set(['l1']),
      enclosureHash: new Set(['e1']),
      titleHash: new Set(['t1']),
    }
    const value = { linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' }

    expect(buildBatchDedupKey(value, collisions)).toBeUndefined()
  })

  it('should return enclosure key when enclosure-only and not colliding', () => {
    const value = { enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, emptyCollisions)).toBe('e:e1')
  })

  it('should return undefined when enclosure-only and colliding', () => {
    const collisions = { ...emptyCollisions, enclosureHash: new Set(['e1']) }
    const value = { enclosureHash: 'e1' }

    expect(buildBatchDedupKey(value, collisions)).toBeUndefined()
  })

  it('should return title key when title is unique', () => {
    const value = { titleHash: 't1' }

    expect(buildBatchDedupKey(value, emptyCollisions)).toBe('t:t1')
  })

  it('should split title with content when title collides and content is safe', () => {
    const collisions = { ...emptyCollisions, titleHash: new Set(['t1']) }
    const value = { titleHash: 't1', contentHash: 'c1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('t:t1|c:c1')
  })

  it('should split title with summary when title and content collide but summary is safe', () => {
    const collisions = {
      ...emptyCollisions,
      titleHash: new Set(['t1']),
      contentHash: new Set(['c1']),
    }
    const value = { titleHash: 't1', contentHash: 'c1', summaryHash: 's1' }

    expect(buildBatchDedupKey(value, collisions)).toBe('t:t1|s:s1')
  })

  it('should return undefined when title collides and no safe splitter exists', () => {
    const collisions = {
      ...emptyCollisions,
      titleHash: new Set(['t1']),
      contentHash: new Set(['c1']),
      summaryHash: new Set(['s1']),
    }
    const value = { titleHash: 't1', contentHash: 'c1', summaryHash: 's1' }

    expect(buildBatchDedupKey(value, collisions)).toBeUndefined()
  })

  it('should return content key when content-only', () => {
    const value = { contentHash: 'c1' }

    expect(buildBatchDedupKey(value, emptyCollisions)).toBe('c:c1')
  })

  it('should return summary key when summary-only', () => {
    const value = { summaryHash: 's1' }

    expect(buildBatchDedupKey(value, emptyCollisions)).toBe('s:s1')
  })

  it('should return undefined when no hashes exist', () => {
    expect(buildBatchDedupKey({}, emptyCollisions)).toBeUndefined()
  })

  it('should use empty collisions as default when no collision profile provided', () => {
    const value = { guidHash: 'g1', linkHash: 'l1' }

    expect(buildBatchDedupKey(value)).toBe('g:g1')
  })
})
