// Rungs of the identity ladder, strongest → weakest.
export type LadderRung =
  | 'guidBase'
  | 'guidWithFragment'
  | 'linkBase'
  | 'linkWithFragment'
  | 'enclosure'
  | 'title'

export type HashableItem = {
  guid?: string
  link?: string
  title?: string
  summary?: string
  content?: string
  enclosures?: Array<{ url?: string; isDefault?: boolean }>
}

export type ItemHashes = {
  guidHash?: string
  guidFragmentHash?: string
  linkHash?: string
  linkFragmentHash?: string
  enclosureHash?: string
  titleHash?: string
  summaryHash?: string
  contentHash?: string
}

// Minimal shape for existing items — what matching + change detection need.
export type MatchableItem = {
  id: string
  guidHash: string | null
  guidFragmentHash: string | null
  linkHash: string | null
  linkFragmentHash: string | null
  enclosureHash: string | null
  titleHash: string | null
  summaryHash: string | null
  contentHash: string | null
}

export type HashedFeedItem<TItem> = {
  feedItem: TItem
  hashes: ItemHashes
}

export type KeyedFeedItem<TItem> = HashedFeedItem<TItem> & {
  identifierKey: string | undefined
  batchDedupKey: string | undefined
}

// KeyedFeedItem after filterWithIdentifier — identifierKey is guaranteed set.
export type IdentifiedFeedItem<TItem> = HashedFeedItem<TItem> & {
  identifierKey: string
  batchDedupKey: string | undefined
}

export type ChannelProfile = {
  linkUniquenessRate: number
}

export type MatchResult = {
  match: MatchableItem
  identifierSource: string
}

export type InsertAction<TItem> = {
  feedItem: TItem
  hashes: ItemHashes
  identifierHash: string
}

export type UpdateAction<TItem> = {
  feedItem: TItem
  hashes: ItemHashes
  identifierHash: string
  existingItemId: string
  identifierSource: string
}

export type ClassifyItemsInput<TItem extends HashableItem = HashableItem> = {
  feedItems: Array<TItem>
  existingItems: Array<MatchableItem>
  floorKey?: LadderRung
}

export type ClassificationResult<TItem> = {
  inserts: Array<InsertAction<TItem>>
  updates: Array<UpdateAction<TItem>>
  floorKey: LadderRung
  floorKeyChanged: boolean
}
