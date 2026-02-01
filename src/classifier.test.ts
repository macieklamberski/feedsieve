import { describe, expect, it } from 'bun:test'
import { classifyItems } from './classifier.js'
import { computeItemHashes } from './hashes.js'
import type { HashableItem, MatchableItem } from './types.js'

const makeMatchable = (overrides: Partial<MatchableItem> = {}): MatchableItem => {
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

const hashForGuid = (guid: string) => computeItemHashes({ guid }).guidHash
const hashForLink = (link: string) => computeItemHashes({ link }).linkHash
const hashForTitle = (title: string) => computeItemHashes({ title }).titleHash
const hashForContent = (content: string) => computeItemHashes({ content }).contentHash
const hashForEnclosure = (url: string) => computeItemHashes({ enclosures: [{ url }] }).enclosureHash

describe('classifyItems', () => {
  it('should insert all items when no existing items', () => {
    const value = {
      feedItems: [
        { guid: 'guid-1', title: 'Post 1' },
        { guid: 'guid-2', title: 'Post 2' },
      ],
      existingItems: [] as Array<MatchableItem>,
    }
    const expected = {
      inserts: [
        {
          feedItem: { guid: 'guid-1', title: 'Post 1' },
          hashes: computeItemHashes({ guid: 'guid-1', title: 'Post 1' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          feedItem: { guid: 'guid-2', title: 'Post 2' },
          hashes: computeItemHashes({ guid: 'guid-2', title: 'Post 2' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should update when item matches existing by guid and content changed', () => {
    const value = {
      feedItems: [{ guid: 'guid-1', title: 'Updated Title', content: 'New content' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guidHash: hashForGuid('guid-1'),
          titleHash: hashForTitle('Old Title'),
          contentHash: hashForContent('Old content'),
        }),
      ],
    }
    const expected = {
      inserts: [],
      updates: [
        {
          feedItem: { guid: 'guid-1', title: 'Updated Title', content: 'New content' },
          hashes: computeItemHashes({
            guid: 'guid-1',
            title: 'Updated Title',
            content: 'New content',
          }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'guid',
        },
      ],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should handle mix of inserts, updates, and skips', () => {
    const value = {
      feedItems: [
        { guid: 'guid-1', title: 'Unchanged Title' },
        { guid: 'guid-2', title: 'Changed Title', content: 'New' },
        { guid: 'guid-3', title: 'Brand New' },
      ],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guidHash: hashForGuid('guid-1'),
          titleHash: hashForTitle('Unchanged Title'),
        }),
        makeMatchable({
          id: 'existing-2',
          guidHash: hashForGuid('guid-2'),
          titleHash: hashForTitle('Old Title'),
          contentHash: hashForContent('Old'),
        }),
      ],
    }
    const expected = {
      inserts: [
        {
          feedItem: { guid: 'guid-3', title: 'Brand New' },
          hashes: computeItemHashes({ guid: 'guid-3', title: 'Brand New' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [
        {
          feedItem: { guid: 'guid-2', title: 'Changed Title', content: 'New' },
          hashes: computeItemHashes({ guid: 'guid-2', title: 'Changed Title', content: 'New' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-2',
          identifierSource: 'guid',
        },
      ],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should match via guid when channel has no link hashes', () => {
    const value = {
      feedItems: [{ guid: 'guid-1', title: 'Updated', content: 'New content' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guidHash: hashForGuid('guid-1'),
          titleHash: hashForTitle('Old'),
          contentHash: hashForContent('Old content'),
        }),
      ],
    }
    const expected = {
      inserts: [],
      updates: [
        {
          feedItem: { guid: 'guid-1', title: 'Updated', content: 'New content' },
          hashes: computeItemHashes({ guid: 'guid-1', title: 'Updated', content: 'New content' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'guid',
        },
      ],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should match via enclosure on low-uniqueness channel', () => {
    const feedItem = {
      link: 'https://example.com/shared',
      enclosures: [{ url: 'https://example.com/episode.mp3' }],
      title: 'Updated Episode',
    }
    const value = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          linkHash: hashForLink('https://example.com/shared'),
          enclosureHash: hashForEnclosure('https://example.com/episode.mp3'),
          titleHash: hashForTitle('Old Episode'),
        }),
        makeMatchable({
          id: 'existing-2',
          linkHash: hashForLink('https://example.com/shared'),
          enclosureHash: hashForEnclosure('https://example.com/other.mp3'),
        }),
      ],
    }
    const expected = {
      inserts: [],
      updates: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'enclosure',
        },
      ],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should omit matched items with no changes', () => {
    const value = {
      feedItems: [{ guid: 'guid-1', title: 'Same Title', content: 'Same content' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guidHash: hashForGuid('guid-1'),
          titleHash: hashForTitle('Same Title'),
          contentHash: hashForContent('Same content'),
        }),
      ],
    }
    const expected = {
      inserts: [],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should skip link matching on low-uniqueness channel when item has guid', () => {
    const feedItem = { guid: 'guid-new', link: 'https://example.com/shared', title: 'New Post' }
    const value = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          linkHash: hashForLink('https://example.com/shared'),
          guidHash: hashForGuid('guid-old'),
        }),
        makeMatchable({
          id: 'existing-2',
          linkHash: hashForLink('https://example.com/shared'),
          guidHash: hashForGuid('guid-old-2'),
        }),
      ],
    }
    const expected = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should deduplicate duplicate feed items into single insert', () => {
    const value = {
      feedItems: [
        { guid: 'guid-1', title: 'Post' },
        { guid: 'guid-1', title: 'Post' },
      ],
      existingItems: [] as Array<MatchableItem>,
    }
    const expected = {
      inserts: [
        {
          feedItem: { guid: 'guid-1', title: 'Post' },
          hashes: computeItemHashes({ guid: 'guid-1', title: 'Post' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should preserve generic item type in output', () => {
    type ExtendedItem = HashableItem & { customField: string }
    const feedItem: ExtendedItem = { guid: 'guid-1', title: 'Post', customField: 'extra' }
    const value = {
      feedItems: [feedItem],
      existingItems: [] as Array<MatchableItem>,
    }
    const expected = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should filter out items with no identity', () => {
    const value = {
      feedItems: [{ content: 'Only content, no identifiable fields' }],
      existingItems: [] as Array<MatchableItem>,
    }
    const expected = {
      inserts: [],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert two items when links differ only by fragment', () => {
    const feedItemA = { link: 'https://example.com/page#Earth2', title: 'Earth2' }
    const feedItemB = { link: 'https://example.com/page#LimeVPN', title: 'LimeVPN' }
    const value = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [] as Array<MatchableItem>,
    }
    const expected = {
      inserts: [
        {
          feedItem: feedItemA,
          hashes: computeItemHashes(feedItemA),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          feedItem: feedItemB,
          hashes: computeItemHashes(feedItemB),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should return empty output for empty feed', () => {
    const value = {
      feedItems: [] as Array<HashableItem>,
      existingItems: [] as Array<MatchableItem>,
    }
    const expected = {
      inserts: [],
      updates: [],
    }

    expect(classifyItems(value)).toEqual(expected)
  })
})
