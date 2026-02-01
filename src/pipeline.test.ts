import { describe, expect, it } from 'bun:test'
import { computeItemHashes } from './hashes.js'
import { type CollisionMap, emptyCollisions } from './meta.js'
import {
  buildAllKeys,
  computeAllHashes,
  deduplicateByBatchKey,
  detectCollisions,
  filterWithIdentifier,
  scoreItem,
} from './pipeline.js'
import type {
  HashableItem,
  HashedFeedItem,
  IdentifiedFeedItem,
  ItemHashes,
  KeyedFeedItem,
} from './types.js'

describe('scoreItem', () => {
  it('should sum weights for multiple hashes', () => {
    const value: ItemHashes = { guidHash: 'g1', linkHash: 'l1', titleHash: 't1' }

    expect(scoreItem(value)).toBe(32 + 8 + 4)
  })

  it('should return max score when all hashes present', () => {
    const value: ItemHashes = {
      guidHash: 'g1',
      enclosureHash: 'e1',
      linkHash: 'l1',
      titleHash: 't1',
      contentHash: 'c1',
      summaryHash: 's1',
    }

    expect(scoreItem(value)).toBe(32 + 16 + 8 + 4 + 2 + 1)
  })

  it('should weight guid highest', () => {
    expect(scoreItem({ guidHash: 'g1' })).toBe(32)
  })

  it('should return 0 for empty hashes', () => {
    expect(scoreItem({})).toBe(0)
  })
})

describe('computeAllHashes', () => {
  it('should map items to hashed pairs', () => {
    const value: Array<HashableItem> = [
      { guid: 'guid-1', title: 'Title 1' },
      { link: 'https://example.com/post' },
    ]
    const expected = [
      {
        feedItem: { guid: 'guid-1', title: 'Title 1' },
        hashes: computeItemHashes({ guid: 'guid-1', title: 'Title 1' }),
      },
      {
        feedItem: { link: 'https://example.com/post' },
        hashes: computeItemHashes({ link: 'https://example.com/post' }),
      },
    ]

    expect(computeAllHashes(value)).toEqual(expected)
  })

  it('should return empty array for empty input', () => {
    expect(computeAllHashes([])).toEqual([])
  })
})

describe('detectCollisions', () => {
  it('should detect all collision types', () => {
    const value: Array<HashedFeedItem<HashableItem>> = [
      {
        feedItem: {},
        hashes: {
          guidHash: 'g1',
          guidFragmentHash: 'gf1',
          linkHash: 'l1',
          linkFragmentHash: 'lf1',
          enclosureHash: 'e1',
          titleHash: 't1',
          contentHash: 'c1',
          summaryHash: 's1',
        },
      },
      {
        feedItem: {},
        hashes: {
          guidHash: 'g1',
          guidFragmentHash: 'gf1',
          linkHash: 'l1',
          linkFragmentHash: 'lf1',
          enclosureHash: 'e1',
          titleHash: 't1',
          contentHash: 'c1',
          summaryHash: 's1',
        },
      },
    ]
    const expected: CollisionMap = {
      guidHash: new Set(['g1']),
      guidFragmentHash: new Set(['gf1']),
      linkHash: new Set(['l1']),
      linkFragmentHash: new Set(['lf1']),
      enclosureHash: new Set(['e1']),
      titleHash: new Set(['t1']),
      contentHash: new Set(['c1']),
      summaryHash: new Set(['s1']),
    }

    expect(detectCollisions(value)).toEqual(expected)
  })

  it('should return empty sets when all hashes are unique', () => {
    const value: Array<HashedFeedItem<HashableItem>> = [
      { feedItem: {}, hashes: { guidHash: 'g1', linkHash: 'l1' } },
      { feedItem: {}, hashes: { guidHash: 'g2', linkHash: 'l2' } },
    ]

    expect(detectCollisions(value)).toEqual(emptyCollisions)
  })

  it('should only mark duplicated hashes, not unique ones', () => {
    const value: Array<HashedFeedItem<HashableItem>> = [
      { feedItem: {}, hashes: { guidHash: 'g1' } },
      { feedItem: {}, hashes: { guidHash: 'g1' } },
      { feedItem: {}, hashes: { guidHash: 'g2' } },
    ]
    const expected: CollisionMap = {
      ...emptyCollisions,
      guidHash: new Set(['g1']),
    }

    expect(detectCollisions(value)).toEqual(expected)
  })

  it('should return empty sets for empty input', () => {
    expect(detectCollisions([])).toEqual(emptyCollisions)
  })
})

describe('buildAllKeys', () => {
  it('should compute identifier and batch dedup keys', () => {
    const value: Array<HashedFeedItem<HashableItem>> = [
      { feedItem: { guid: 'g1' }, hashes: { guidHash: 'gh1' } },
    ]
    const expected = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: expect.any(String),
        batchDedupKey: 'g:gh1',
      },
    ]

    expect(buildAllKeys(value, emptyCollisions)).toEqual(expected)
  })

  it('should set undefined keys when no usable hashes', () => {
    const value: Array<HashedFeedItem<HashableItem>> = [{ feedItem: {}, hashes: {} }]
    const expected = [
      {
        feedItem: {},
        hashes: {},
        identifierKey: undefined,
        batchDedupKey: undefined,
      },
    ]

    expect(buildAllKeys(value, emptyCollisions)).toEqual(expected)
  })
})

describe('filterWithIdentifier', () => {
  it('should keep items with identifier', () => {
    const value: Array<KeyedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1|gf:|l:|lf:|e:|t:',
        batchDedupKey: 'g:gh1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1|gf:|l:|lf:|e:|t:',
        batchDedupKey: 'g:gh1',
      },
    ]

    expect(filterWithIdentifier(value)).toEqual(expected)
  })

  it('should filter mixed items keeping only identified ones', () => {
    const value: Array<KeyedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1|gf:|l:|lf:|e:|t:',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: {},
        hashes: {},
        identifierKey: undefined,
        batchDedupKey: undefined,
      },
      {
        feedItem: { title: 'Title' },
        hashes: { titleHash: 'th1' },
        identifierKey: 'g:|gf:|l:|lf:|e:|t:th1',
        batchDedupKey: 't:th1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1|gf:|l:|lf:|e:|t:',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: { title: 'Title' },
        hashes: { titleHash: 'th1' },
        identifierKey: 'g:|gf:|l:|lf:|e:|t:th1',
        batchDedupKey: 't:th1',
      },
    ]

    expect(filterWithIdentifier(value)).toEqual(expected)
  })

  it('should return empty array when no items have identifier', () => {
    const value: Array<KeyedFeedItem<HashableItem>> = [
      {
        feedItem: {},
        hashes: {},
        identifierKey: undefined,
        batchDedupKey: undefined,
      },
    ]

    expect(filterWithIdentifier(value)).toEqual([])
  })
})

describe('deduplicateByBatchKey', () => {
  it('should keep first item when duplicates have equal scores', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', content: 'first' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: { guid: 'g1', content: 'second' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', content: 'first' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
    ]

    expect(deduplicateByBatchKey(value)).toEqual(expected)
  })

  it('should keep richer item when scores differ', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: { guid: 'g1', link: 'https://example.com' },
        hashes: { guidHash: 'gh1', linkHash: 'lh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', link: 'https://example.com' },
        hashes: { guidHash: 'gh1', linkHash: 'lh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
    ]

    expect(deduplicateByBatchKey(value)).toEqual(expected)
  })

  it('should handle mix of keyed and unkeyed items', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: { guid: 'g2' },
        hashes: { guidHash: 'gh2' },
        identifierKey: 'key2',
        batchDedupKey: undefined,
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: 'g:gh1',
      },
      {
        feedItem: { guid: 'g2' },
        hashes: { guidHash: 'gh2' },
        identifierKey: 'key2',
        batchDedupKey: undefined,
      },
    ]

    expect(deduplicateByBatchKey(value)).toEqual(expected)
  })

  it('should collapse items with different batch keys but same identifierKey', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', link: 'https://example.com/a' },
        hashes: { guidHash: 'gh1', linkHash: 'lh-a' },
        identifierKey: 'g:gh1|gf:|l:lh-a|lf:|e:|t:',
        batchDedupKey: 'g:gh1|l:lh-a',
      },
      {
        feedItem: { guid: 'g1', link: 'https://example.com/b' },
        hashes: { guidHash: 'gh1', linkHash: 'lh-b' },
        identifierKey: 'g:gh1|gf:|l:lh-a|lf:|e:|t:',
        batchDedupKey: 'g:gh1|l:lh-b',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', link: 'https://example.com/a' },
        hashes: { guidHash: 'gh1', linkHash: 'lh-a' },
        identifierKey: 'g:gh1|gf:|l:lh-a|lf:|e:|t:',
        batchDedupKey: 'g:gh1|l:lh-a',
      },
    ]

    expect(deduplicateByBatchKey(value)).toEqual(expected)
  })

  it('should dedup items with undefined batch key using identifierKey fallback', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: undefined,
      },
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: undefined,
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: undefined,
      },
    ]

    expect(deduplicateByBatchKey(value)).toEqual(expected)
  })

  it('should keep items with different identifierKeys when batch key is undefined', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: undefined,
      },
      {
        feedItem: { guid: 'g2' },
        hashes: { guidHash: 'gh2' },
        identifierKey: 'key2',
        batchDedupKey: undefined,
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
        batchDedupKey: undefined,
      },
      {
        feedItem: { guid: 'g2' },
        hashes: { guidHash: 'gh2' },
        identifierKey: 'key2',
        batchDedupKey: undefined,
      },
    ]

    expect(deduplicateByBatchKey(value)).toEqual(expected)
  })

  it('should return empty array for empty input', () => {
    expect(deduplicateByBatchKey([])).toEqual([])
  })
})
