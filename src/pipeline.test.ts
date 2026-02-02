import { describe, expect, it } from 'bun:test'
import { computeItemHashes } from './hashes.js'
import {
  computeAllHashes,
  deduplicateByIdentifierKey,
  filterWithIdentifier,
  scoreItem,
} from './pipeline.js'
import type { HashableItem, IdentifiedFeedItem, ItemHashes, KeyedFeedItem } from './types.js'

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

describe('filterWithIdentifier', () => {
  it('should keep items with identifier', () => {
    const value: Array<KeyedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1',
      },
    ]

    expect(filterWithIdentifier(value)).toEqual(expected)
  })

  it('should filter mixed items keeping only identified ones', () => {
    const value: Array<KeyedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1',
      },
      {
        feedItem: {},
        hashes: {},
        identifierKey: undefined,
      },
      {
        feedItem: { title: 'Title' },
        hashes: { titleHash: 'th1' },
        identifierKey: 'g:|gf:|l:|lf:|e:|t:th1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'g:gh1',
      },
      {
        feedItem: { title: 'Title' },
        hashes: { titleHash: 'th1' },
        identifierKey: 'g:|gf:|l:|lf:|e:|t:th1',
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
      },
    ]

    expect(filterWithIdentifier(value)).toEqual([])
  })
})

describe('deduplicateByIdentifierKey', () => {
  it('should keep first item when duplicates have equal scores', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', content: 'first' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
      },
      {
        feedItem: { guid: 'g1', content: 'second' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', content: 'first' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
      },
    ]

    expect(deduplicateByIdentifierKey(value)).toEqual(expected)
  })

  it('should keep richer item when scores differ', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
      },
      {
        feedItem: { guid: 'g1', link: 'https://example.com' },
        hashes: { guidHash: 'gh1', linkHash: 'lh1' },
        identifierKey: 'key1',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1', link: 'https://example.com' },
        hashes: { guidHash: 'gh1', linkHash: 'lh1' },
        identifierKey: 'key1',
      },
    ]

    expect(deduplicateByIdentifierKey(value)).toEqual(expected)
  })

  it('should keep items with different identifierKeys', () => {
    const value: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
      },
      {
        feedItem: { guid: 'g2' },
        hashes: { guidHash: 'gh2' },
        identifierKey: 'key2',
      },
    ]
    const expected: Array<IdentifiedFeedItem<HashableItem>> = [
      {
        feedItem: { guid: 'g1' },
        hashes: { guidHash: 'gh1' },
        identifierKey: 'key1',
      },
      {
        feedItem: { guid: 'g2' },
        hashes: { guidHash: 'gh2' },
        identifierKey: 'key2',
      },
    ]

    expect(deduplicateByIdentifierKey(value)).toEqual(expected)
  })

  it('should return empty array for empty input', () => {
    expect(deduplicateByIdentifierKey([])).toEqual([])
  })
})
