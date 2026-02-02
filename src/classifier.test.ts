import { describe, expect, it } from 'bun:test'
import { classifyItems } from './classifier.js'
import { computeItemHashes } from './hashes.js'
import type {
  ClassificationResult,
  ClassifyItemsInput,
  HashableItem,
  MatchableItem,
} from './types.js'

describe('classifyItems', () => {
  const makeMatchable = (input: HashableItem & { id?: string } = {}): MatchableItem => {
    const { id = 'item-1', ...hashableFields } = input
    const hashes = computeItemHashes(hashableFields)

    return {
      id,
      guidHash: hashes.guidHash ?? null,
      guidFragmentHash: hashes.guidFragmentHash ?? null,
      linkHash: hashes.linkHash ?? null,
      linkFragmentHash: hashes.linkFragmentHash ?? null,
      enclosureHash: hashes.enclosureHash ?? null,
      titleHash: hashes.titleHash ?? null,
      summaryHash: hashes.summaryHash ?? null,
      contentHash: hashes.contentHash ?? null,
    }
  }

  it('should insert all items when no existing items', () => {
    const value: ClassifyItemsInput = {
      feedItems: [
        { guid: 'guid-1', title: 'Post 1' },
        { guid: 'guid-2', title: 'Post 2' },
      ],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should update when item matches existing by guid and content changed', () => {
    const value: ClassifyItemsInput = {
      feedItems: [{ guid: 'guid-1', title: 'Updated Title', content: 'New content' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Old Title',
          content: 'Old content',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should handle mix of inserts, updates, and skips', () => {
    const value: ClassifyItemsInput = {
      feedItems: [
        { guid: 'guid-1', title: 'Unchanged Title' },
        { guid: 'guid-2', title: 'Changed Title', content: 'New' },
        { guid: 'guid-3', title: 'Brand New' },
      ],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Unchanged Title',
        }),
        makeMatchable({
          id: 'existing-2',
          guid: 'guid-2',
          title: 'Old Title',
          content: 'Old',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should match via guid when channel has no link hashes', () => {
    const value: ClassifyItemsInput = {
      feedItems: [{ guid: 'guid-1', title: 'Updated', content: 'New content' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Old',
          content: 'Old content',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should match via enclosure on low-uniqueness channel', () => {
    const feedItem = {
      link: 'https://example.com/shared',
      enclosures: [{ url: 'https://example.com/episode.mp3' }],
      title: 'Updated Episode',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          enclosures: [{ url: 'https://example.com/episode.mp3' }],
          title: 'Old Episode',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          enclosures: [{ url: 'https://example.com/other.mp3' }],
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'enclosure',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should omit matched items with no changes', () => {
    const value: ClassifyItemsInput = {
      feedItems: [{ guid: 'guid-1', title: 'Same Title', content: 'Same content' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Same Title',
          content: 'Same content',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should skip link matching on low-uniqueness channel when item has guid', () => {
    const feedItem = { guid: 'guid-new', link: 'https://example.com/shared', title: 'New Post' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          guid: 'guid-old',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          guid: 'guid-old-2',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should deduplicate duplicate feed items into single insert', () => {
    const value: ClassifyItemsInput = {
      feedItems: [
        { guid: 'guid-1', title: 'Post' },
        { guid: 'guid-1', title: 'Post' },
      ],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem: { guid: 'guid-1', title: 'Post' },
          hashes: computeItemHashes({ guid: 'guid-1', title: 'Post' }),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should preserve generic item type in output', () => {
    const feedItem = { guid: 'guid-1', title: 'Post', customField: 'extra' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should filter out items with no identity', () => {
    const value: ClassifyItemsInput = {
      feedItems: [{ content: 'Only content, no identifiable fields' }],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert two items when links differ only by fragment', () => {
    const feedItemA = { link: 'https://example.com/page#Earth2', title: 'Earth2' }
    const feedItemB = { link: 'https://example.com/page#LimeVPN', title: 'LimeVPN' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'linkWithFragment',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should return empty output for empty feed', () => {
    const value: ClassifyItemsInput = {
      feedItems: [],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should detect floorKeyChanged when floor is downgraded', () => {
    // Two link-only items with same link but different titles → at linkBase
    // the prefix is identical (g:|gf:|l:L) → collision → should downgrade.
    const feedItemA = { link: 'https://example.com/shared', title: 'Post A' }
    const feedItemB = { link: 'https://example.com/shared', title: 'Post B' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'title',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not set floorKeyChanged when floor is stable', () => {
    const feedItem1 = { guid: 'guid-1', title: 'Post 1' }
    const feedItem2 = { guid: 'guid-2', title: 'Post 2' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem1, feedItem2],
      existingItems: [],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem: feedItem1,
          hashes: computeItemHashes(feedItem1),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          feedItem: feedItem2,
          hashes: computeItemHashes(feedItem2),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not downgrade floor due to duplicate feed items', () => {
    // Same item appears twice — dedup removes the duplicate before floor computation,
    // so guidBase should remain stable (no collision).
    const feedItem = { guid: 'guid-1', title: 'Post' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem, feedItem],
      existingItems: [],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should produce distinct identifierHashes for hub feed items with shared link and floor=title', () => {
    const feedItemA = { link: 'https://example.com/hub', title: 'Article A' }
    const feedItemB = { link: 'https://example.com/hub', title: 'Article B' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'title',
      floorKeyChanged: false,
    }

    const result = classifyItems(value)

    expect(result).toEqual(expected)
    expect(result.inserts[0].identifierHash).not.toBe(result.inserts[1].identifierHash)
  })

  it('should downgrade floor when new item collides with existing item', () => {
    // Hub pattern: multiple existing items share a link → low uniqueness →
    // selectMatch won't match via link. Unmatched existing items stay in the
    // floor set, causing a collision at linkBase → downgrade to title.
    const feedItem = { link: 'https://example.com/shared', title: 'New Article' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          title: 'Article A',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          title: 'Article B',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert hub feed item instead of merging when floor prevents it', () => {
    // End-to-end: hub feed with shared link and floor=title active.
    // Matching alignment rejects candidates with different ladder keys →
    // incoming item becomes an INSERT, not an UPDATE.
    const feedItem = { link: 'https://example.com/shared', title: 'New Article' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          title: 'Article A',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          title: 'Article B',
        }),
      ],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should downgrade floor on hub onset with single existing item', () => {
    // Hub onset: only 1 existing item with link=L, so link uniqueness is high
    // and selectMatch would match by link. But the link match has a different
    // title (different max-rung key) → not excluded from floor set → collision
    // detected at linkBase → downgrade to title → INSERT not UPDATE.
    const feedItem = { link: 'https://example.com/shared', title: 'New Article' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          title: 'Old Article',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not downgrade floor when existing item matches incoming exactly', () => {
    // Same item re-appearing in feed — existing and incoming have identical hashes,
    // so the exact-duplicate filter removes one. No collision.
    const feedItem = { link: 'https://example.com/post', title: 'Same Title' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/post',
          title: 'Same Title',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [],
      floorKey: 'linkBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should pick linkBase when some items lack guid', () => {
    const feedItem1 = { guid: 'guid-1', link: 'https://example.com/post-1', title: 'Post 1' }
    const feedItem2 = { link: 'https://example.com/post-2', title: 'Post 2' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem1, feedItem2],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem: feedItem1,
          hashes: computeItemHashes(feedItem1),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          feedItem: feedItem2,
          hashes: computeItemHashes(feedItem2),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'linkBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should downgrade from linkBase to linkWithFragment when fragments resolve collision', () => {
    const feedItemA = { link: 'https://example.com/page#section-a', title: 'Section A' }
    const feedItemB = { link: 'https://example.com/page#section-b', title: 'Section B' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'linkWithFragment',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not downgrade floor when guid match resolves the collision', () => {
    const feedItem = { guid: 'guid-1', link: 'https://example.com/post', title: 'New Title' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          link: 'https://example.com/post',
          title: 'Old Title',
        }),
      ],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'guid',
        },
      ],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should update when floor active and ladder key matches', () => {
    const feedItem = {
      link: 'https://example.com/post',
      title: 'Post Title',
      content: 'New content',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/post',
          title: 'Post Title',
          content: 'Old content',
        }),
      ],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'link',
        },
      ],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should update via enclosure when floor is enclosure', () => {
    const feedItem = {
      link: 'https://example.com/shared',
      enclosures: [{ url: 'https://example.com/ep1.mp3' }],
      title: 'Episode 1 Updated',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          enclosures: [{ url: 'https://example.com/ep1.mp3' }],
          title: 'Episode 1',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          enclosures: [{ url: 'https://example.com/ep2.mp3' }],
          title: 'Episode 2',
        }),
      ],
      floorKey: 'enclosure',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'enclosure',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert link-only item with changed title when floor active', () => {
    const feedItem = { link: 'https://example.com/post', title: 'New Title' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/post',
          title: 'Old Title',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when fragment added and floor active', () => {
    const feedItem = { link: 'https://example.com/post#comments', title: 'Post Title' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/post',
          title: 'Post Title',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'linkWithFragment',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when fragment differs and floor is linkWithFragment', () => {
    const feedItem = { link: 'https://example.com/post#comments', title: 'Post Title' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/post',
          title: 'Post Title',
        }),
      ],
      floorKey: 'linkWithFragment',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'linkWithFragment',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not merge hub items even without floor', () => {
    const feedItem = { link: 'https://example.com/shared', title: 'Article C' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          title: 'Article A',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          title: 'Article B',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should dedup all-identical items to single insert', () => {
    const feedItem = { link: 'https://example.com/post', title: 'Post' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem, feedItem, feedItem, feedItem, feedItem],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'linkBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should filter unidentifiable items without affecting floor', () => {
    const feedItem1 = { guid: 'guid-1', title: 'Post 1' }
    const feedItem2 = { content: 'Only content' }
    const feedItem3 = { guid: 'guid-2', title: 'Post 2' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem1, feedItem2, feedItem3],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem: feedItem1,
          hashes: computeItemHashes(feedItem1),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          feedItem: feedItem3,
          hashes: computeItemHashes(feedItem3),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should downgrade guidBase to guidWithFragment when guid fragments differ', () => {
    const feedItemA = { guid: 'https://example.com/post#v1', title: 'Version 1' }
    const feedItemB = { guid: 'https://example.com/post#v2', title: 'Version 2' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'guidWithFragment',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should downgrade guidBase to enclosure when guid collides without fragments', () => {
    const feedItemA = {
      guid: 'shared-guid',
      enclosures: [{ url: 'https://example.com/ep1.mp3' }],
      title: 'Episode 1',
    }
    const feedItemB = {
      guid: 'shared-guid',
      enclosures: [{ url: 'https://example.com/ep2.mp3' }],
      title: 'Episode 2',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'enclosure',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should prefer enclosure over title when link collides and enclosure resolves', () => {
    const feedItemA = {
      link: 'https://example.com/shared',
      enclosures: [{ url: 'https://example.com/ep1.mp3' }],
      title: 'Episode 1',
    }
    const feedItemB = {
      link: 'https://example.com/shared',
      enclosures: [{ url: 'https://example.com/ep2.mp3' }],
      title: 'Episode 2',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'enclosure',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not upgrade floor when floorKey is already deeper', () => {
    const feedItem1 = { guid: 'guid-1', link: 'https://example.com/post-1', title: 'Post 1' }
    const feedItem2 = { guid: 'guid-2', link: 'https://example.com/post-2', title: 'Post 2' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem1, feedItem2],
      existingItems: [],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem: feedItem1,
          hashes: computeItemHashes(feedItem1),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          feedItem: feedItem2,
          hashes: computeItemHashes(feedItem2),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when guid update changes title and floor is title', () => {
    const feedItem = { guid: 'guid-1', title: 'New Title' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Old Title',
        }),
      ],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should downgrade guidBase to linkBase when guid collides but links differ', () => {
    const feedItemA = { guid: 'shared-guid', link: 'https://example.com/post-1', title: 'Post 1' }
    const feedItemB = { guid: 'shared-guid', link: 'https://example.com/post-2', title: 'Post 2' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
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
      floorKey: 'linkBase',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when guid match is rejected by enclosure conflict', () => {
    const feedItem = {
      guid: 'guid-1',
      enclosures: [{ url: 'https://example.com/new.mp3' }],
      title: 'Updated',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          enclosures: [{ url: 'https://example.com/old.mp3' }],
          title: 'Original',
        }),
      ],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'enclosure',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should update via guid when floor is title and title matches', () => {
    const feedItem = { guid: 'guid-1', title: 'Same Title', content: 'New content' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Same Title',
          content: 'Old content',
        }),
      ],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'guid',
        },
      ],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not hide guid collisions in existing items', () => {
    const feedItem = { guid: 'shared-guid', title: 'Article A Updated' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'shared-guid',
          title: 'Article A',
        }),
        makeMatchable({
          id: 'existing-2',
          guid: 'shared-guid',
          title: 'Article B',
        }),
      ],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: true,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not change floorKey when feed and existing are both empty', () => {
    const value: ClassifyItemsInput = {
      feedItems: [],
      existingItems: [],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should not change floorKey when only unidentifiable items arrive with existing history', () => {
    const value: ClassifyItemsInput = {
      feedItems: [{ content: 'Only content, no identifiable fields' }],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          title: 'Post 1',
        }),
      ],
      floorKey: 'guidBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [],
      floorKey: 'guidBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when guid match has enclosure conflict even without floorKey', () => {
    const feedItem = {
      guid: 'guid-1',
      enclosures: [{ url: 'https://example.com/new.mp3' }],
      title: 'Updated',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          enclosures: [{ url: 'https://example.com/old.mp3' }],
          title: 'Original',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'enclosure',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should update only the floor-matching existing item on hub channel', () => {
    const feedItem = {
      link: 'https://example.com/shared',
      title: 'Article C',
      content: 'New content',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/shared',
          title: 'Article A',
          content: 'Old A',
        }),
        makeMatchable({
          id: 'existing-2',
          link: 'https://example.com/shared',
          title: 'Article C',
          content: 'Old C',
        }),
      ],
      floorKey: 'title',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-2',
          identifierSource: 'link',
        },
      ],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should produce collision-free identifierHashes after floor downgrade', () => {
    const feedItem1 = { link: 'https://example.com/page#s1', title: 'Section 1' }
    const feedItem2 = { link: 'https://example.com/page#s2', title: 'Section 2' }
    const feedItem3 = { link: 'https://example.com/page#s3', title: 'Section 3' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem1, feedItem2, feedItem3],
      existingItems: [],
      floorKey: 'linkBase',
    }

    const result = classifyItems(value)
    const identifierHashes = result.inserts.map((item) => item.identifierHash)

    expect(result.floorKey).toBe('linkWithFragment')
    expect(result.floorKeyChanged).toBe(true)
    expect(identifierHashes.length).toBe(3)
    expect(new Set(identifierHashes).size).toBe(3)
  })

  it('should update title-only item when content changes', () => {
    const feedItem = { title: 'Post Title', content: 'New content' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          title: 'Post Title',
          content: 'Old content',
        }),
      ],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [],
      updates: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingItemId: 'existing-1',
          identifierSource: 'title',
        },
      ],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should collapse title-only items with same title to single insert', () => {
    const feedItemA = { title: 'Same Title', content: 'Content A' }
    const feedItemB = { title: 'Same Title', content: 'Content B' }
    const value: ClassifyItemsInput = {
      feedItems: [feedItemA, feedItemB],
      existingItems: [],
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem: feedItemA,
          hashes: computeItemHashes(feedItemA),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'title',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when guid appears on existing item under floor', () => {
    const feedItem = {
      guid: 'guid-1',
      link: 'https://example.com/post',
      title: 'Post Title',
      content: 'New content',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          link: 'https://example.com/post',
          title: 'Post Title',
          content: 'Old content',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'linkBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should insert when guid disappears from existing item under floor', () => {
    const feedItem = {
      link: 'https://example.com/post',
      title: 'Post Title',
      content: 'New content',
    }
    const value: ClassifyItemsInput = {
      feedItems: [feedItem],
      existingItems: [
        makeMatchable({
          id: 'existing-1',
          guid: 'guid-1',
          link: 'https://example.com/post',
          title: 'Post Title',
          content: 'Old content',
        }),
      ],
      floorKey: 'linkBase',
    }
    const expected: ClassificationResult<HashableItem> = {
      inserts: [
        {
          feedItem,
          hashes: computeItemHashes(feedItem),
          identifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      updates: [],
      floorKey: 'linkBase',
      floorKeyChanged: false,
    }

    expect(classifyItems(value)).toEqual(expected)
  })

  it('should throw when floorKey is invalid at runtime', () => {
    const value: ClassifyItemsInput = {
      feedItems: [{ guid: 'guid-1', title: 'Post' }],
      existingItems: [],
      // @ts-expect-error: This is for testing purposes.
      floorKey: 'not-a-rung',
    }
    const throwing = () => classifyItems(value)

    expect(throwing).toThrow()
  })
})
