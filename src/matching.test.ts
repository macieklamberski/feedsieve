import { describe, expect, it } from 'bun:test'
import {
  computeBatchLinkUniqueness,
  computeChannelProfile,
  findCandidatesForItem,
  hasEnclosureConflict,
  hasItemChanged,
  isLinkOnly,
  selectMatch,
} from './matching.js'
import type { ItemHashes, MatchableItem } from './types.js'

const makeItem = (overrides: Partial<MatchableItem> = {}): MatchableItem => {
  return {
    id: 'item-1',
    guidHash: null,
    guidFragmentHash: null,
    linkHash: null,
    linkFragmentHash: null,
    enclosureHash: null,
    titleHash: null,
    summaryHash: null,
    contentHash: null,
    ...overrides,
  }
}

describe('hasItemChanged', () => {
  it('should return false when all hashes match', () => {
    const existing = makeItem({
      titleHash: 'title-1',
      summaryHash: 'summary-1',
      contentHash: 'content-1',
      enclosureHash: 'enclosure-1',
    })
    const incoming: ItemHashes = {
      titleHash: 'title-1',
      summaryHash: 'summary-1',
      contentHash: 'content-1',
      enclosureHash: 'enclosure-1',
    }

    expect(hasItemChanged(existing, incoming)).toBe(false)
  })

  it('should return false when all hashes are null/undefined', () => {
    const existing = makeItem()
    const incoming: ItemHashes = {}

    expect(hasItemChanged(existing, incoming)).toBe(false)
  })

  it('should return true when titleHash differs', () => {
    const existing = makeItem({ titleHash: 'title-1' })
    const incoming: ItemHashes = { titleHash: 'title-2' }

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should return true when summaryHash differs', () => {
    const existing = makeItem({ summaryHash: 'summary-1' })
    const incoming: ItemHashes = { summaryHash: 'summary-2' }

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should return true when contentHash differs', () => {
    const existing = makeItem({ contentHash: 'content-1' })
    const incoming: ItemHashes = { contentHash: 'content-2' }

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should return true when enclosureHash differs', () => {
    const existing = makeItem({ enclosureHash: 'enclosure-1' })
    const incoming: ItemHashes = { enclosureHash: 'enclosure-2' }

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should return true when existing has value and incoming has undefined', () => {
    const existing = makeItem({ titleHash: 'title-1' })
    const incoming: ItemHashes = {}

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should return true when existing has null and incoming has value', () => {
    const existing = makeItem({ contentHash: null })
    const incoming: ItemHashes = { contentHash: 'content-1' }

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should return true when multiple hashes differ', () => {
    const existing = makeItem({ titleHash: 'title-1', contentHash: 'content-1' })
    const incoming: ItemHashes = { titleHash: 'title-2', contentHash: 'content-2' }

    expect(hasItemChanged(existing, incoming)).toBe(true)
  })

  it('should ignore non-content hashes like guidHash and linkHash', () => {
    const existing = makeItem({ guidHash: 'guid-1', linkHash: 'link-1' })
    const incoming: ItemHashes = { guidHash: 'guid-2', linkHash: 'link-2' }

    expect(hasItemChanged(existing, incoming)).toBe(false)
  })
})

describe('isLinkOnly', () => {
  it('should return true when only linkHash is present', () => {
    const value: ItemHashes = { linkHash: 'abc' }

    expect(isLinkOnly(value)).toBe(true)
  })

  it('should return false when guidHash is also present', () => {
    const value: ItemHashes = { linkHash: 'abc', guidHash: 'def' }

    expect(isLinkOnly(value)).toBe(false)
  })

  it('should return false when enclosureHash is also present', () => {
    const value: ItemHashes = { linkHash: 'abc', enclosureHash: 'def' }

    expect(isLinkOnly(value)).toBe(false)
  })

  it('should return false when no linkHash', () => {
    const value: ItemHashes = { guidHash: 'abc' }

    expect(isLinkOnly(value)).toBe(false)
  })

  it('should return false when empty', () => {
    const value: ItemHashes = {}

    expect(isLinkOnly(value)).toBe(false)
  })
})

describe('hasEnclosureConflict', () => {
  it('should return true when both present and differ', () => {
    expect(hasEnclosureConflict('hash-a', 'hash-b')).toBe(true)
  })

  it('should return false when both present and same', () => {
    expect(hasEnclosureConflict('hash-a', 'hash-a')).toBe(false)
  })

  it('should return false when candidate is null', () => {
    expect(hasEnclosureConflict(null, 'hash-b')).toBe(false)
  })

  it('should return false when candidate is undefined', () => {
    expect(hasEnclosureConflict(undefined, 'hash-b')).toBe(false)
  })

  it('should return false when incoming is undefined', () => {
    expect(hasEnclosureConflict('hash-a', undefined)).toBe(false)
  })

  it('should return false when both are undefined', () => {
    expect(hasEnclosureConflict(undefined, undefined)).toBe(false)
  })
})

describe('findCandidatesForItem', () => {
  it('should match on guidHash', () => {
    const value: ItemHashes = { guidHash: 'guid-1' }
    const existing = [
      makeItem({ id: 'a', guidHash: 'guid-1' }),
      makeItem({ id: 'b', guidHash: 'guid-2' }),
    ]
    const expected = [existing[0]]

    expect(findCandidatesForItem(value, existing)).toEqual(expected)
  })

  it('should match on linkHash', () => {
    const value: ItemHashes = { linkHash: 'link-1' }
    const existing = [
      makeItem({ id: 'a', linkHash: 'link-1' }),
      makeItem({ id: 'b', linkHash: 'link-2' }),
    ]
    const expected = [existing[0]]

    expect(findCandidatesForItem(value, existing)).toEqual(expected)
  })

  it('should match on enclosureHash', () => {
    const value: ItemHashes = { enclosureHash: 'enc-1' }
    const existing = [
      makeItem({ id: 'a', enclosureHash: 'enc-1' }),
      makeItem({ id: 'b', enclosureHash: 'enc-2' }),
    ]
    const expected = [existing[0]]

    expect(findCandidatesForItem(value, existing)).toEqual(expected)
  })

  it('should match on titleHash', () => {
    const value: ItemHashes = { titleHash: 'title-1' }
    const existing = [
      makeItem({ id: 'a', titleHash: 'title-1' }),
      makeItem({ id: 'b', titleHash: 'title-2' }),
    ]
    const expected = [existing[0]]

    expect(findCandidatesForItem(value, existing)).toEqual(expected)
  })

  it('should return multiple matches across different hashes', () => {
    const value: ItemHashes = { guidHash: 'guid-1', linkHash: 'link-2' }
    const existing = [
      makeItem({ id: 'a', guidHash: 'guid-1' }),
      makeItem({ id: 'b', linkHash: 'link-2' }),
    ]
    const expected = [existing[0], existing[1]]

    expect(findCandidatesForItem(value, existing)).toEqual(expected)
  })

  it('should not duplicate items matching on multiple hashes', () => {
    const value: ItemHashes = { guidHash: 'guid-1', linkHash: 'link-1' }
    const existing = [makeItem({ id: 'a', guidHash: 'guid-1', linkHash: 'link-1' })]
    const expected = [existing[0]]

    expect(findCandidatesForItem(value, existing)).toEqual(expected)
  })

  it('should return empty array when no matches', () => {
    const value: ItemHashes = { guidHash: 'guid-x' }
    const existing = [makeItem({ id: 'a', guidHash: 'guid-1' })]

    expect(findCandidatesForItem(value, existing)).toEqual([])
  })

  it('should return empty array for empty existing items', () => {
    const value: ItemHashes = { guidHash: 'guid-1' }

    expect(findCandidatesForItem(value, [])).toEqual([])
  })

  it('should not match on summaryHash', () => {
    const value: ItemHashes = { summaryHash: 'sum-1' }
    const existing = [
      makeItem({ id: 'a', summaryHash: 'sum-1' }),
      makeItem({ id: 'b', summaryHash: 'sum-2' }),
    ]

    expect(findCandidatesForItem(value, existing)).toEqual([])
  })

  it('should not match on contentHash', () => {
    const value: ItemHashes = { contentHash: 'cnt-1' }
    const existing = [
      makeItem({ id: 'a', contentHash: 'cnt-1' }),
      makeItem({ id: 'b', contentHash: 'cnt-2' }),
    ]

    expect(findCandidatesForItem(value, existing)).toEqual([])
  })

  it('should not match on titleHash when strong hashes present', () => {
    const value: ItemHashes = { guidHash: 'guid-1', titleHash: 'title-1' }
    const existing = [makeItem({ id: 'a', titleHash: 'title-1' })]

    expect(findCandidatesForItem(value, existing)).toEqual([])
  })

  it('should not match on null hash values', () => {
    const value: ItemHashes = {}
    const existing = [makeItem({ id: 'a', guidHash: null, linkHash: null })]

    expect(findCandidatesForItem(value, existing)).toEqual([])
  })
})

describe('selectMatch', () => {
  it('should return null for empty candidates', () => {
    const value = {
      hashes: { guidHash: 'guid-1' },
      candidates: [],
      linkUniquenessRate: 1.0,
    }
    expect(selectMatch(value)).toBeUndefined()
  })

  it('should match on guid with single candidate', () => {
    const candidate = makeItem({ guidHash: 'guid-1' })
    const value = {
      hashes: { guidHash: 'guid-1' },
      candidates: [candidate],
      linkUniquenessRate: 1.0,
    }
    const expected = {
      match: candidate,
      identifierSource: 'guid',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should return null for ambiguous guid matches with no narrowing hashes', () => {
    const value = {
      hashes: { guidHash: 'guid-1' },
      candidates: [
        makeItem({ id: 'a', guidHash: 'guid-1' }),
        makeItem({ id: 'b', guidHash: 'guid-1' }),
      ],
      linkUniquenessRate: 1.0,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should disambiguate guid matches by enclosure', () => {
    const target = makeItem({ id: 'a', guidHash: 'guid-1', enclosureHash: 'enc-1' })
    const value = {
      hashes: { guidHash: 'guid-1', enclosureHash: 'enc-1' },
      candidates: [target, makeItem({ id: 'b', guidHash: 'guid-1', enclosureHash: 'enc-2' })],
      linkUniquenessRate: 1.0,
    }
    const expected = { match: target, identifierSource: 'guid' }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should disambiguate guid matches by link when enclosure does not narrow', () => {
    const target = makeItem({ id: 'a', guidHash: 'guid-1', linkHash: 'link-1' })
    const value = {
      hashes: { guidHash: 'guid-1', linkHash: 'link-1' },
      candidates: [target, makeItem({ id: 'b', guidHash: 'guid-1', linkHash: 'link-2' })],
      linkUniquenessRate: 1.0,
    }
    const expected = { match: target, identifierSource: 'guid' }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should disambiguate guid matches by guidFragmentHash', () => {
    const target = makeItem({ id: 'a', guidHash: 'guid-1', guidFragmentHash: 'gf-1' })
    const value = {
      hashes: { guidHash: 'guid-1', guidFragmentHash: 'gf-1' },
      candidates: [target, makeItem({ id: 'b', guidHash: 'guid-1', guidFragmentHash: 'gf-2' })],
      linkUniquenessRate: 1.0,
    }
    const expected = { match: target, identifierSource: 'guid' }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should return null when guidFragmentHash is also ambiguous', () => {
    const value = {
      hashes: { guidHash: 'guid-1', guidFragmentHash: 'gf-shared' },
      candidates: [
        makeItem({ id: 'a', guidHash: 'guid-1', guidFragmentHash: 'gf-shared' }),
        makeItem({ id: 'b', guidHash: 'guid-1', guidFragmentHash: 'gf-shared' }),
      ],
      linkUniquenessRate: 1.0,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should return null when guid disambiguation still ambiguous', () => {
    const value = {
      hashes: { guidHash: 'guid-1', linkHash: 'link-shared' },
      candidates: [
        makeItem({ id: 'a', guidHash: 'guid-1', linkHash: 'link-shared' }),
        makeItem({ id: 'b', guidHash: 'guid-1', linkHash: 'link-shared' }),
      ],
      linkUniquenessRate: 1.0,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should reject guid match when enclosures conflict', () => {
    const value = {
      hashes: { guidHash: 'guid-1', enclosureHash: 'enc-new' },
      candidates: [makeItem({ guidHash: 'guid-1', enclosureHash: 'enc-old' })],
      linkUniquenessRate: 1.0,
    }
    expect(selectMatch(value)).toBeUndefined()
  })

  it('should allow guid match when enclosures are same', () => {
    const candidate = makeItem({ guidHash: 'guid-1', enclosureHash: 'enc-same' })
    const value = {
      hashes: { guidHash: 'guid-1', enclosureHash: 'enc-same' },
      candidates: [candidate],
      linkUniquenessRate: 1.0,
    }
    const expected = {
      match: candidate,
      identifierSource: 'guid',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should allow guid match when candidate has no enclosure', () => {
    const candidate = makeItem({ guidHash: 'guid-1', enclosureHash: null })
    const value = {
      hashes: { guidHash: 'guid-1', enclosureHash: 'enc-new' },
      candidates: [candidate],
      linkUniquenessRate: 1.0,
    }
    const expected = {
      match: candidate,
      identifierSource: 'guid',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should allow guid match when incoming has no enclosure', () => {
    const candidate = makeItem({ guidHash: 'guid-1', enclosureHash: 'enc-existing' })
    const value = {
      hashes: { guidHash: 'guid-1' },
      candidates: [candidate],
      linkUniquenessRate: 1.0,
    }
    const expected = {
      match: candidate,
      identifierSource: 'guid',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should match on link when high uniqueness', () => {
    const candidate = makeItem({ linkHash: 'link-1' })
    const value = {
      hashes: { linkHash: 'link-1' },
      candidates: [candidate],
      linkUniquenessRate: 0.98,
    }
    const expected = {
      match: candidate,
      identifierSource: 'link',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should filter out link matches with enclosure conflict', () => {
    const value = {
      hashes: { linkHash: 'link-1', enclosureHash: 'enc-new' },
      candidates: [makeItem({ linkHash: 'link-1', enclosureHash: 'enc-old' })],
      linkUniquenessRate: 0.98,
    }
    expect(selectMatch(value)).toBeUndefined()
  })

  it('should allow link match when enclosures are same', () => {
    const candidate = makeItem({ linkHash: 'link-1', enclosureHash: 'enc-same' })
    const value = {
      hashes: { linkHash: 'link-1', enclosureHash: 'enc-same' },
      candidates: [candidate],
      linkUniquenessRate: 0.98,
    }
    const expected = {
      match: candidate,
      identifierSource: 'link',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should allow link match when candidate has no enclosure', () => {
    const candidate = makeItem({ linkHash: 'link-1', enclosureHash: null })
    const value = {
      hashes: { linkHash: 'link-1', enclosureHash: 'enc-new' },
      candidates: [candidate],
      linkUniquenessRate: 0.98,
    }
    const expected = {
      match: candidate,
      identifierSource: 'link',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should disambiguate link matches by fragment on high-uniqueness channel', () => {
    const target = makeItem({ id: 'a', linkHash: 'link-1', linkFragmentHash: 'frag-1' })
    const value = {
      hashes: { linkHash: 'link-1', linkFragmentHash: 'frag-1' },
      candidates: [target, makeItem({ id: 'b', linkHash: 'link-1', linkFragmentHash: 'frag-2' })],
      linkUniquenessRate: 0.98,
    }
    const expected = { match: target, identifierSource: 'link' }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should return null when fragment is also ambiguous on high-uniqueness channel', () => {
    const value = {
      hashes: { linkHash: 'link-1', linkFragmentHash: 'frag-shared' },
      candidates: [
        makeItem({ id: 'a', linkHash: 'link-1', linkFragmentHash: 'frag-shared' }),
        makeItem({ id: 'b', linkHash: 'link-1', linkFragmentHash: 'frag-shared' }),
      ],
      linkUniquenessRate: 0.98,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should return null when incoming has no fragment and link is ambiguous', () => {
    const value = {
      hashes: { linkHash: 'link-1' },
      candidates: [
        makeItem({ id: 'a', linkHash: 'link-1', linkFragmentHash: 'frag-1' }),
        makeItem({ id: 'b', linkHash: 'link-1', linkFragmentHash: 'frag-2' }),
      ],
      linkUniquenessRate: 0.98,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should match on enclosure when high uniqueness and no link match', () => {
    const candidate = makeItem({ enclosureHash: 'enc-1' })
    const value = {
      hashes: { enclosureHash: 'enc-1' },
      candidates: [candidate],
      linkUniquenessRate: 0.98,
    }
    const expected = {
      match: candidate,
      identifierSource: 'enclosure',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should prioritize enclosure over link on low-uniqueness channel', () => {
    const candidates = [
      makeItem({ id: 'a', linkHash: 'link-shared', enclosureHash: 'enc-1' }),
      makeItem({ id: 'b', linkHash: 'link-shared', enclosureHash: 'enc-2' }),
    ]
    const value = {
      hashes: { linkHash: 'link-shared', enclosureHash: 'enc-1' },
      candidates,
      linkUniquenessRate: 0.3,
    }
    const expected = {
      match: candidates[0],
      identifierSource: 'enclosure',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should not match on link for non-link-only item on low-uniqueness channel', () => {
    const value = {
      hashes: { linkHash: 'link-1', guidHash: 'guid-x' },
      candidates: [makeItem({ linkHash: 'link-1' })],
      linkUniquenessRate: 0.3,
    }
    expect(selectMatch(value)).toBeUndefined()
  })

  it('should match on link for link-only item on low-uniqueness channel', () => {
    const candidate = makeItem({ linkHash: 'link-1' })
    const value = {
      hashes: { linkHash: 'link-1' },
      candidates: [candidate],
      linkUniquenessRate: 0.3,
    }
    const expected = {
      match: candidate,
      identifierSource: 'link',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should disambiguate link matches by fragment on low-uniqueness channel for link-only item', () => {
    const target = makeItem({ id: 'a', linkHash: 'link-1', linkFragmentHash: 'frag-1' })
    const value = {
      hashes: { linkHash: 'link-1', linkFragmentHash: 'frag-1' },
      candidates: [target, makeItem({ id: 'b', linkHash: 'link-1', linkFragmentHash: 'frag-2' })],
      linkUniquenessRate: 0.3,
    }
    const expected = { match: target, identifierSource: 'link' }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should return null when fragment is also ambiguous on low-uniqueness channel', () => {
    const value = {
      hashes: { linkHash: 'link-1', linkFragmentHash: 'frag-shared' },
      candidates: [
        makeItem({ id: 'a', linkHash: 'link-1', linkFragmentHash: 'frag-shared' }),
        makeItem({ id: 'b', linkHash: 'link-1', linkFragmentHash: 'frag-shared' }),
      ],
      linkUniquenessRate: 0.3,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should match on title as last resort', () => {
    const candidate = makeItem({ titleHash: 'title-1' })
    const value = {
      hashes: { titleHash: 'title-1' },
      candidates: [candidate],
      linkUniquenessRate: 1.0,
    }
    const expected = {
      match: candidate,
      identifierSource: 'title',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should return null for ambiguous title matches', () => {
    const value = {
      hashes: { titleHash: 'title-1' },
      candidates: [
        makeItem({ id: 'a', titleHash: 'title-1' }),
        makeItem({ id: 'b', titleHash: 'title-1' }),
      ],
      linkUniquenessRate: 1.0,
    }
    expect(selectMatch(value)).toBeUndefined()
  })

  it('should not match on title when strong hashes present', () => {
    const value = {
      hashes: { guidHash: 'guid-x', titleHash: 'title-1' },
      candidates: [makeItem({ titleHash: 'title-1' })],
      linkUniquenessRate: 1.0,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should not match on summary-only candidates', () => {
    const value = {
      hashes: { summaryHash: 'sum-1' } as ItemHashes,
      candidates: [makeItem({ summaryHash: 'sum-1' })],
      linkUniquenessRate: 1.0,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should not match on content-only candidates', () => {
    const value = {
      hashes: { contentHash: 'cnt-1' } as ItemHashes,
      candidates: [makeItem({ contentHash: 'cnt-1' })],
      linkUniquenessRate: 1.0,
    }

    expect(selectMatch(value)).toBeUndefined()
  })

  it('should prefer guid over link', () => {
    const guidCandidate = makeItem({ id: 'guid-match', guidHash: 'guid-1' })
    const linkCandidate = makeItem({ id: 'link-match', linkHash: 'link-1' })
    const value = {
      hashes: { guidHash: 'guid-1', linkHash: 'link-1' },
      candidates: [guidCandidate, linkCandidate],
      linkUniquenessRate: 1.0,
    }
    const expected = {
      match: guidCandidate,
      identifierSource: 'guid',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should prefer link over enclosure on high-uniqueness channel', () => {
    const linkCandidate = makeItem({ id: 'link-match', linkHash: 'link-1' })
    const encCandidate = makeItem({ id: 'enc-match', enclosureHash: 'enc-1' })
    const value = {
      hashes: { linkHash: 'link-1', enclosureHash: 'enc-1' },
      candidates: [linkCandidate, encCandidate],
      linkUniquenessRate: 0.98,
    }
    const expected = {
      match: linkCandidate,
      identifierSource: 'link',
    }

    expect(selectMatch(value)).toEqual(expected)
  })

  it('should return null when no hashes match any priority', () => {
    const value = {
      hashes: { guidHash: 'guid-x' },
      candidates: [makeItem({ guidHash: 'guid-y', linkHash: 'link-1' })],
      linkUniquenessRate: 1.0,
    }
    expect(selectMatch(value)).toBeUndefined()
  })
})

describe('computeBatchLinkUniqueness', () => {
  it('should return 1.0 for all unique hashes', () => {
    const value = ['hash-1', 'hash-2', 'hash-3']

    expect(computeBatchLinkUniqueness(value)).toBe(1.0)
  })

  it('should return 0.5 for half-unique hashes', () => {
    const value = ['hash-1', 'hash-1', 'hash-2', 'hash-2']

    expect(computeBatchLinkUniqueness(value)).toBe(0.5)
  })

  it('should return 0 for empty array', () => {
    expect(computeBatchLinkUniqueness([])).toBe(0)
  })

  it('should handle single hash', () => {
    const value = ['hash-1']

    expect(computeBatchLinkUniqueness(value)).toBe(1.0)
  })
})

describe('computeChannelProfile', () => {
  it('should return 1.0 when all link hashes are unique', () => {
    const existingItems = [
      makeItem({ id: 'a', linkHash: 'link-1' }),
      makeItem({ id: 'b', linkHash: 'link-2' }),
    ]
    const incomingLinkHashes = ['link-3', 'link-4']
    const expected = { linkUniquenessRate: 1.0 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })

  it('should return min of historical and batch rates', () => {
    const existingItems = [
      makeItem({ id: 'a', linkHash: 'link-1' }),
      makeItem({ id: 'b', linkHash: 'link-1' }),
    ]
    const incomingLinkHashes = ['link-3', 'link-4']
    const expected = { linkUniquenessRate: 0.5 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })

  it('should use batch rate when no historical link data exists', () => {
    const existingItems: Array<MatchableItem> = []
    const incomingLinkHashes = ['link-1', 'link-2']
    const expected = { linkUniquenessRate: 1.0 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })

  it('should use batch rate when existing items have only null link hashes', () => {
    const existingItems = [
      makeItem({ id: 'a', linkHash: null }),
      makeItem({ id: 'b', linkHash: null }),
    ]
    const incomingLinkHashes = ['link-1', 'link-2']
    const expected = { linkUniquenessRate: 1.0 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })

  it('should use historical rate when no incoming link hashes exist', () => {
    const existingItems = [
      makeItem({ id: 'a', linkHash: 'link-1' }),
      makeItem({ id: 'b', linkHash: 'link-1' }),
    ]
    const incomingLinkHashes: Array<string> = []
    const expected = { linkUniquenessRate: 0.5 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })

  it('should return 0 when neither side has link data', () => {
    const existingItems = [makeItem({ id: 'a' })]
    const incomingLinkHashes: Array<string> = []
    const expected = { linkUniquenessRate: 0 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })

  it('should ignore null link hashes in existing items', () => {
    const existingItems = [
      makeItem({ id: 'a', linkHash: null }),
      makeItem({ id: 'b', linkHash: 'link-1' }),
    ]
    const incomingLinkHashes = ['link-2']
    const expected = { linkUniquenessRate: 1.0 }

    expect(computeChannelProfile(existingItems, incomingLinkHashes)).toEqual(expected)
  })
})
