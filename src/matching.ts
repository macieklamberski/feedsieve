import { applyCandidateGates } from './gates.js'
import { isDefined } from './helpers.js'
import { hashMeta, hasStrongHash } from './meta.js'
import type {
  CandidateGate,
  ChannelProfile,
  ItemHashes,
  MatchableItem,
  MatchResult,
  MatchSource,
  TraceEvent,
} from './types.js'

// Detect meaningful content changes between existing and incoming item.
// Compares all isContent hashes (title, summary, content, enclosure).
// Uses loose inequality (!=) so null and undefined are treated as equal,
// preventing false positives from DB null vs pipeline undefined.
export const hasItemChanged = (existing: MatchableItem, incomingHashes: ItemHashes): boolean =>
  hashMeta
    .filter((meta) => meta.isContent)
    /* biome-ignore lint/suspicious/noDoubleEquals: Intentional — null == undefined. */
    .some((meta) => existing[meta.key] != incomingHashes[meta.key])

// Returns true when link is the item's only strong identifier
// (no guid, no enclosure). Link-only items always get link matching
// even on low-uniqueness channels.
export const isLinkOnly = (hashes: ItemHashes): boolean => {
  return !!hashes.linkHash && !hashes.guidHash && !hashes.enclosureHash
}

// In-memory filter: returns all existing items where any matchable hash matches.
// Does NOT apply gating — that's selectMatch's job.
// Non-matchable hashes (fragments, content, summary) are excluded: too volatile
// or only used as tiebreakers. Title only checked when no strong hash exists —
// prevents title pulling in unrelated candidates that would confuse selectMatch.
export const findCandidatesForItem = (
  hashes: ItemHashes,
  existingItems: Array<MatchableItem>,
): Array<MatchableItem> => {
  const hasStrong = hasStrongHash(hashes)

  return existingItems.filter((existing) =>
    hashMeta.some((meta) => {
      if (!meta.isMatchable || !hashes[meta.key]) {
        return false
      }

      if (!meta.isStrongHash && hasStrong) {
        return false
      }

      return existing[meta.key] === hashes[meta.key]
    }),
  )
}

// Priority-based match selection with per-channel link gating.
// High uniqueness: guid > link > enclosure > title
// Low uniqueness:  guid > enclosure > link (if link-only) > title
// Summary/content excluded: too volatile for cross-scan matching.
// Returns null for ambiguous matches (>1) — prefer insert over wrong merge.
export const selectMatch = ({
  hashes,
  candidates,
  linkUniquenessRate,
  candidateGates,
  trace,
}: {
  hashes: ItemHashes
  candidates: Array<MatchableItem>
  linkUniquenessRate: number
  candidateGates: Array<CandidateGate>
  trace?: (event: TraceEvent) => void
}): MatchResult | undefined => {
  const incoming = { hashes }
  const channel = { linkUniquenessRate }

  const gated = (source: MatchSource, filtered: Array<MatchableItem>): Array<MatchableItem> => {
    return applyCandidateGates({
      candidates: filtered,
      source,
      gates: candidateGates,
      incoming,
      channel,
      trace,
    })
  }
  const selected = (result: MatchResult): MatchResult => {
    trace?.({
      kind: 'match.selected',
      source: result.identifierSource,
      existingItemId: result.match.id,
    })
    return result
  }

  const ambiguous = (source: MatchSource, count: number): undefined => {
    trace?.({ kind: 'match.ambiguous', source, count })
    return
  }

  if (candidates.length === 0) {
    trace?.({ kind: 'match.none' })
    return
  }

  // Priority 1: GUID match (always strongest — 94.9% coverage).
  if (hashes.guidHash) {
    const byGuid = gated(
      'guid',
      candidates.filter((candidate) => candidate.guidHash === hashes.guidHash),
    )

    if (byGuid.length === 1) {
      return selected({ match: byGuid[0], identifierSource: 'guid' })
    }

    // Multiple GUID matches — try narrowing by enclosure, guid fragment, link.
    if (byGuid.length > 1) {
      if (hashes.enclosureHash) {
        const byEnclosure = byGuid.filter((candidate) => {
          return candidate.enclosureHash === hashes.enclosureHash
        })

        if (byEnclosure.length === 1) {
          return selected({ match: byEnclosure[0], identifierSource: 'guid' })
        }
      }

      if (hashes.guidFragmentHash) {
        const byGuidFragment = byGuid.filter((candidate) => {
          return candidate.guidFragmentHash === hashes.guidFragmentHash
        })

        if (byGuidFragment.length === 1) {
          return selected({ match: byGuidFragment[0], identifierSource: 'guid' })
        }
      }

      if (hashes.linkHash) {
        const byLink = byGuid.filter((candidate) => {
          return candidate.linkHash === hashes.linkHash
        })

        if (byLink.length === 1) {
          return selected({ match: byLink[0], identifierSource: 'guid' })
        }
      }

      return ambiguous('guid', byGuid.length)
    }
  }

  if (linkUniquenessRate >= 0.95) {
    // High-uniqueness channel: link is reliable.
    if (hashes.linkHash) {
      const byLink = gated(
        'link',
        candidates.filter((candidate) => candidate.linkHash === hashes.linkHash),
      )

      if (byLink.length === 1) {
        return selected({ match: byLink[0], identifierSource: 'link' })
      }

      if (byLink.length > 1) {
        if (hashes.linkFragmentHash) {
          const byFragment = byLink.filter((candidate) => {
            return candidate.linkFragmentHash === hashes.linkFragmentHash
          })

          if (byFragment.length === 1) {
            return selected({ match: byFragment[0], identifierSource: 'link' })
          }
        }

        return ambiguous('link', byLink.length)
      }
    }

    if (hashes.enclosureHash) {
      const byEnclosure = gated(
        'enclosure',
        candidates.filter((candidate) => candidate.enclosureHash === hashes.enclosureHash),
      )

      if (byEnclosure.length === 1) {
        return selected({ match: byEnclosure[0], identifierSource: 'enclosure' })
      }

      if (byEnclosure.length > 1) {
        return ambiguous('enclosure', byEnclosure.length)
      }
    }
  } else {
    // Low-uniqueness channel (podcast/hub): enclosure is per-item, link is shared.
    if (hashes.enclosureHash) {
      const byEnclosure = gated(
        'enclosure',
        candidates.filter((candidate) => candidate.enclosureHash === hashes.enclosureHash),
      )

      if (byEnclosure.length === 1) {
        return selected({ match: byEnclosure[0], identifierSource: 'enclosure' })
      }

      if (byEnclosure.length > 1) {
        return ambiguous('enclosure', byEnclosure.length)
      }
    }

    // Link-only items still get link matching even on low-uniqueness channels.
    if (isLinkOnly(hashes) && hashes.linkHash) {
      const byLink = gated(
        'link',
        candidates.filter((candidate) => candidate.linkHash === hashes.linkHash),
      )

      if (byLink.length === 1) {
        return selected({ match: byLink[0], identifierSource: 'link' })
      }

      if (byLink.length > 1) {
        if (hashes.linkFragmentHash) {
          const byFragment = byLink.filter((candidate) => {
            return candidate.linkFragmentHash === hashes.linkFragmentHash
          })

          if (byFragment.length === 1) {
            return selected({ match: byFragment[0], identifierSource: 'link' })
          }
        }

        return ambiguous('link', byLink.length)
      }
    }
  }

  // Weak fallback: title only.
  // Only used when item has no strong hashes — prevents title from
  // accidentally merging items that have guid/link/enclosure but failed
  // to match on those (e.g. changed GUID with same title).

  if (!hasStrongHash(hashes) && hashes.titleHash) {
    const byTitle = gated(
      'title',
      candidates.filter((candidate) => candidate.titleHash === hashes.titleHash),
    )

    if (byTitle.length === 1) {
      return selected({ match: byTitle[0], identifierSource: 'title' })
    }

    if (byTitle.length > 1) {
      return ambiguous('title', byTitle.length)
    }
  }

  trace?.({ kind: 'match.none' })
  return
}

// Compute link uniqueness from the current batch (no DB needed).
// Used as fallback for new channels with no historical items.
export const computeBatchLinkUniqueness = (linkHashes: Array<string>): number => {
  if (linkHashes.length === 0) {
    return 0
  }

  return new Set(linkHashes).size / linkHashes.length
}

// Pure profile computation from existing + incoming hashes.
// When one side has no data, uses the other side's rate instead of 0.
export const computeChannelProfile = (
  existingItems: Array<MatchableItem>,
  incomingLinkHashes: Array<string>,
): ChannelProfile => {
  const existingLinkHashes = existingItems.map((item) => item.linkHash).filter(isDefined)
  const historicalRate = computeBatchLinkUniqueness(existingLinkHashes)
  const batchRate = computeBatchLinkUniqueness(incomingLinkHashes)

  if (existingLinkHashes.length === 0) {
    return { linkUniquenessRate: batchRate }
  }

  if (incomingLinkHashes.length === 0) {
    return { linkUniquenessRate: historicalRate }
  }

  return { linkUniquenessRate: Math.min(historicalRate, batchRate) }
}
