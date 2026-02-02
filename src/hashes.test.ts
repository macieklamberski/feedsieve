import { describe, expect, it } from 'bun:test'
import { buildIdentifierKeyLadder, computeFloorKey, computeItemHashes } from './hashes.js'
import type { HashableItem, ItemHashes } from './types.js'

describe('buildIdentifierKeyLadder', () => {
  it('should include only guidBase slot at floor=guidBase', () => {
    const value = { guidHash: 'g1', linkHash: 'l1', titleHash: 't1' }
    const expected = 'g:g1'

    expect(buildIdentifierKeyLadder(value, 'guidBase')).toBe(expected)
  })

  it('should include guidBase and guidWithFragment at floor=guidWithFragment', () => {
    const value = { guidHash: 'g1', guidFragmentHash: 'gf1', linkHash: 'l1' }
    const expected = 'g:g1|gf:gf1'

    expect(buildIdentifierKeyLadder(value, 'guidWithFragment')).toBe(expected)
  })

  it('should include up to linkBase at floor=linkBase', () => {
    const value = { guidHash: 'g1', linkHash: 'l1', titleHash: 't1' }
    const expected = 'g:g1|gf:|l:l1'

    expect(buildIdentifierKeyLadder(value, 'linkBase')).toBe(expected)
  })

  it('should include up to linkWithFragment at floor=linkWithFragment', () => {
    const value = { guidHash: 'g1', linkHash: 'l1', linkFragmentHash: 'lf1' }
    const expected = 'g:g1|gf:|l:l1|lf:lf1'

    expect(buildIdentifierKeyLadder(value, 'linkWithFragment')).toBe(expected)
  })

  it('should include up to enclosure at floor=enclosure', () => {
    const value = { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e1' }
    const expected = 'g:g1|gf:|l:l1|lf:|e:e1'

    expect(buildIdentifierKeyLadder(value, 'enclosure')).toBe(expected)
  })

  it('should include all six slots at floor=title', () => {
    const value = {
      guidHash: 'g1',
      guidFragmentHash: 'gf1',
      linkHash: 'l1',
      linkFragmentHash: 'lf1',
      enclosureHash: 'e1',
      titleHash: 't1',
    }
    const expected = 'g:g1|gf:gf1|l:l1|lf:lf1|e:e1|t:t1'

    expect(buildIdentifierKeyLadder(value, 'title')).toBe(expected)
  })

  it('should produce empty slots for missing hashes', () => {
    const value = { guidHash: 'g1' }
    const expected = 'g:g1|gf:|l:|lf:|e:|t:'

    expect(buildIdentifierKeyLadder(value, 'title')).toBe(expected)
  })

  it('should produce different keys for items with same link but different titles at floor=title', () => {
    const value1 = { linkHash: 'l1', titleHash: 't1' }
    const value2 = { linkHash: 'l1', titleHash: 't2' }

    expect(buildIdentifierKeyLadder(value1, 'title')).not.toBe(
      buildIdentifierKeyLadder(value2, 'title'),
    )
  })

  it('should produce same keys for items with same link but different titles at floor=linkBase', () => {
    const value1 = { linkHash: 'l1', titleHash: 't1' }
    const value2 = { linkHash: 'l1', titleHash: 't2' }

    expect(buildIdentifierKeyLadder(value1, 'linkBase')).toBe(
      buildIdentifierKeyLadder(value2, 'linkBase'),
    )
  })

  it('should ignore fragments at floor=linkBase', () => {
    const value1 = { linkHash: 'l1', linkFragmentHash: 'lf1' }
    const value2 = { linkHash: 'l1', linkFragmentHash: 'lf2' }

    expect(buildIdentifierKeyLadder(value1, 'linkBase')).toBe(
      buildIdentifierKeyLadder(value2, 'linkBase'),
    )
  })

  it('should include fragments at floor=linkWithFragment', () => {
    const value1 = { linkHash: 'l1', linkFragmentHash: 'lf1' }
    const value2 = { linkHash: 'l1', linkFragmentHash: 'lf2' }

    expect(buildIdentifierKeyLadder(value1, 'linkWithFragment')).not.toBe(
      buildIdentifierKeyLadder(value2, 'linkWithFragment'),
    )
  })

  it('should return undefined when no hashes exist in prefix', () => {
    const value: ItemHashes = {}

    expect(buildIdentifierKeyLadder(value, 'title')).toBeUndefined()
  })

  it('should return undefined when only hashes below the floor exist', () => {
    const value = { titleHash: 't1' }

    expect(buildIdentifierKeyLadder(value, 'linkBase')).toBeUndefined()
  })
})

describe('computeFloorKey', () => {
  it('should pick strongest collision-free rung for new channel', () => {
    const values = [
      { guidHash: 'g1', linkHash: 'l1', titleHash: 't1' },
      { guidHash: 'g2', linkHash: 'l2', titleHash: 't2' },
    ]

    expect(computeFloorKey(values)).toBe('guidBase')
  })

  it('should return current floor unchanged when no collisions', () => {
    const values = [
      { guidHash: 'g1', linkHash: 'l1' },
      { guidHash: 'g2', linkHash: 'l2' },
    ]

    expect(computeFloorKey(values, 'linkBase')).toBe('linkBase')
  })

  it('should downgrade when current floor has collisions', () => {
    // Same link → linkBase collides → should move to a weaker rung.
    const values = [
      { linkHash: 'l1', titleHash: 't1' },
      { linkHash: 'l1', titleHash: 't2' },
    ]

    expect(computeFloorKey(values, 'linkBase')).toBe('title')
  })

  it('should return guidBase when no collisions at any level', () => {
    const values = [
      { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' },
      { guidHash: 'g2', linkHash: 'l2', enclosureHash: 'e2', titleHash: 't2' },
    ]

    expect(computeFloorKey(values)).toBe('guidBase')
  })

  it('should return title when collisions exist at all levels', () => {
    // All rungs collide — identical hashes everywhere.
    const values = [
      { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' },
      { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' },
    ]

    expect(computeFloorKey(values)).toBe('title')
  })

  it('should skip to enclosure when guid and link collide', () => {
    const values = [
      { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e1', titleHash: 't1' },
      { guidHash: 'g1', linkHash: 'l1', enclosureHash: 'e2', titleHash: 't2' },
    ]

    expect(computeFloorKey(values)).toBe('enclosure')
  })

  it('should handle single-item batch as guidBase', () => {
    const values = [{ guidHash: 'g1', linkHash: 'l1' }]

    expect(computeFloorKey(values)).toBe('guidBase')
  })

  it('should handle empty batch as title', () => {
    expect(computeFloorKey([])).toBe('title')
  })

  it('should preserve current floor on empty batch', () => {
    expect(computeFloorKey([], 'guidBase')).toBe('guidBase')
  })

  it('should skip rungs that identify no items', () => {
    // Link-only items — guidBase produces no keys, should skip to linkBase.
    const values = [
      { linkHash: 'l1', titleHash: 't1' },
      { linkHash: 'l2', titleHash: 't2' },
    ]

    expect(computeFloorKey(values)).toBe('linkBase')
  })

  it('should never upgrade above current floor', () => {
    // No collisions at guidBase, but current floor is title — should stay at title.
    const values = [
      { guidHash: 'g1', linkHash: 'l1', titleHash: 't1' },
      { guidHash: 'g2', linkHash: 'l2', titleHash: 't2' },
    ]

    expect(computeFloorKey(values, 'title')).toBe('title')
  })
})

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
    const expected = {
      guidHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      linkHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      enclosureHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      titleHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      contentHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      summaryHash: expect.stringMatching(/^[a-f0-9]{32}$/),
    }

    expect(computeItemHashes(value)).toEqual(expected)
  })

  it('should compute only guidHash when only guid present', () => {
    const value: HashableItem = { guid: 'abc-123' }
    const expected = {
      guidHash: expect.stringMatching(/^[a-f0-9]{32}$/),
    }

    expect(computeItemHashes(value)).toEqual(expected)
  })

  it('should return empty object when no relevant fields present', () => {
    const value: HashableItem = {}

    expect(computeItemHashes(value)).toEqual({})
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
