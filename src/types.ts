// Rungs of the identity ladder, strongest → weakest.
export const ladderRungs = [
  'guid',
  'guidFragment',
  'link',
  'linkFragment',
  'enclosure',
  'title',
] as const

export type LadderRung = (typeof ladderRungs)[number]

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
  item: TItem
  hashes: ItemHashes
}

export type KeyedFeedItem<TItem> = HashedFeedItem<TItem> & {
  identifier: string | undefined
}

// KeyedFeedItem after filterWithIdentifier — identifier is guaranteed set.
export type IdentifiedFeedItem<TItem> = HashedFeedItem<TItem> & {
  identifier: string
}

export type ChannelProfile = {
  linkUniquenessRate: number
}

export type MatchResult = {
  match: MatchableItem
  identifierSource: string
}

export type InsertAction<TItem> = {
  item: TItem
  hashes: ItemHashes
  identifierHash: string
}

export type UpdateAction<TItem> = {
  item: TItem
  hashes: ItemHashes
  identifierHash: string
  existingItemId: string
  identifierSource: string
}

export type ClassifyItemsInput<TItem extends HashableItem = HashableItem> = {
  newItems: Array<TItem>
  existingItems: Array<MatchableItem>
  minRung?: LadderRung
}

export type ClassifyItemsResult<TItem> = {
  inserts: Array<InsertAction<TItem>>
  updates: Array<UpdateAction<TItem>>
  minRung: LadderRung
  minRungChanged: boolean
}
