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

export type MatchSource = 'guid' | 'link' | 'enclosure' | 'title'

export type MatchResult = {
  match: MatchableItem
  identifierSource: MatchSource
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
  identifierSource: MatchSource
}

export type CandidateGateContext = {
  source: MatchSource
  incoming: { hashes: ItemHashes }
  candidate: MatchableItem
  channel: { linkUniquenessRate: number }
}

export type CandidateGateResult = { allow: true } | { allow: false; reason: string }

export type CandidateGate = {
  name: string
  appliesTo: Array<MatchSource> | 'all'
  decide: (context: CandidateGateContext) => CandidateGateResult
}

export type UpdateGateContext = {
  existing: MatchableItem
  incomingHashes: ItemHashes
  identifierSource: MatchSource
}

export type UpdateGate = {
  name: string
  shouldEmit: (context: UpdateGateContext) => boolean
}

export type TraceEvent =
  | { kind: 'candidates.found'; source: MatchSource; count: number }
  | {
      kind: 'candidates.gated'
      source: MatchSource
      gateName: string
      reason: string
      before: number
      after: number
    }
  | { kind: 'match.selected'; source: MatchSource; existingItemId: string }
  | { kind: 'match.ambiguous'; source: MatchSource; count: number }
  | { kind: 'match.none' }
  | { kind: 'classify.insert'; identifierHash: string }
  | { kind: 'classify.update'; identifierHash: string; existingItemId: string }
  | { kind: 'classify.skip'; existingItemId: string }
  | { kind: 'rung.resolved'; minRung: LadderRung; changed: boolean }

export type ClassifyPolicy = {
  candidateGates?: Array<CandidateGate>
  updateGates?: Array<UpdateGate>
  trace?: (event: TraceEvent) => void
}

export type ClassifyItemsInput<TItem extends HashableItem = HashableItem> = {
  newItems: Array<TItem>
  existingItems: Array<MatchableItem>
  minRung?: LadderRung
  policy?: ClassifyPolicy
}

export type ClassifyItemsResult<TItem> = {
  inserts: Array<InsertAction<TItem>>
  updates: Array<UpdateAction<TItem>>
  minRung: LadderRung
  minRungChanged: boolean
}
