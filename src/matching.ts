import { isDefined } from './helpers.js'
import type { ChannelProfile, ItemHashes, MatchableItem, MatchResult } from './types.js'

// Detect meaningful content changes between existing and incoming item.
// Compares title, summary, content, and enclosure hashes — not just content.
// Uses loose inequality (!=) so null and undefined are treated as equal,
// preventing false positives from DB null vs pipeline undefined.
export const hasItemChanged = (existing: MatchableItem, incomingHashes: ItemHashes): boolean => {
  return (
    /* biome-ignore lint/suspicious/noDoubleEquals: Intentional — null == undefined. */
    existing.titleHash != incomingHashes.titleHash ||
    /* biome-ignore lint/suspicious/noDoubleEquals: Intentional — null == undefined. */
    existing.summaryHash != incomingHashes.summaryHash ||
    /* biome-ignore lint/suspicious/noDoubleEquals: Intentional — null == undefined. */
    existing.contentHash != incomingHashes.contentHash ||
    /* biome-ignore lint/suspicious/noDoubleEquals: Intentional — null == undefined. */
    existing.enclosureHash != incomingHashes.enclosureHash
  )
}

// Returns true when link is the item's only strong identifier
// (no guid, no enclosure). Link-only items always get link matching
// even on low-uniqueness channels.
export const isLinkOnly = (hashes: ItemHashes): boolean => {
  return !!hashes.linkHash && !hashes.guidHash && !hashes.enclosureHash
}

// Both sides have an enclosureHash and they differ — different items
// sharing a URL (e.g. podcast episodes on a show page).
export const hasEnclosureConflict = (
  candidateEnclosureHash: string | null | undefined,
  incomingEnclosureHash: string | undefined,
): boolean => {
  return (
    !!candidateEnclosureHash &&
    !!incomingEnclosureHash &&
    candidateEnclosureHash !== incomingEnclosureHash
  )
}

// In-memory filter: returns all existing items where any hash matches.
// Does NOT apply gating — that's selectMatch's job.
// Summary/content excluded: too volatile for cross-scan matching.
// Title only checked when no strong hash exists — prevents title pulling
// in unrelated candidates that would confuse selectMatch.
export const findCandidatesForItem = (
  hashes: ItemHashes,
  existingItems: Array<MatchableItem>,
): Array<MatchableItem> => {
  const hasStrong = !!hashes.guidHash || !!hashes.linkHash || !!hashes.enclosureHash

  return existingItems.filter((existing) => {
    if (hashes.guidHash && existing.guidHash === hashes.guidHash) {
      return true
    }

    if (hashes.linkHash && existing.linkHash === hashes.linkHash) {
      return true
    }

    if (hashes.enclosureHash && existing.enclosureHash === hashes.enclosureHash) {
      return true
    }

    if (!hasStrong && hashes.titleHash && existing.titleHash === hashes.titleHash) {
      return true
    }

    return false
  })
}

// Priority-based match selection with per-channel link gating.
// High uniqueness: guid > link > enclosure > title
// Low uniqueness:  guid > enclosure > link (if link-only) > title
// Summary/content excluded: too volatile for cross-scan matching.
// Returns null for ambiguous matches (>1) — prefer insert over wrong merge.
export const selectMatch = (props: {
  hashes: ItemHashes
  candidates: Array<MatchableItem>
  linkUniquenessRate: number
}): MatchResult | undefined => {
  const { hashes, candidates, linkUniquenessRate } = props

  if (candidates.length === 0) {
    return
  }

  // Priority 1: GUID match (always strongest — 94.9% coverage).
  // Enclosure conflict check prevents merging items that share a GUID but
  // have different enclosures (e.g. regenerated GUIDs across episodes).
  if (hashes.guidHash) {
    const byGuid = candidates
      .filter((candidate) => candidate.guidHash === hashes.guidHash)
      .filter((candidate) => !hasEnclosureConflict(candidate.enclosureHash, hashes.enclosureHash))

    if (byGuid.length === 1) {
      return { match: byGuid[0], identifierSource: 'guid' }
    }

    // Multiple GUID matches — try narrowing by enclosure, guid fragment, link.
    if (byGuid.length > 1) {
      if (hashes.enclosureHash) {
        const byEnc = byGuid.filter((candidate) => {
          return candidate.enclosureHash === hashes.enclosureHash
        })

        if (byEnc.length === 1) {
          return { match: byEnc[0], identifierSource: 'guid' }
        }
      }

      if (hashes.guidFragmentHash) {
        const byGuidFragment = byGuid.filter((candidate) => {
          return candidate.guidFragmentHash === hashes.guidFragmentHash
        })

        if (byGuidFragment.length === 1) {
          return { match: byGuidFragment[0], identifierSource: 'guid' }
        }
      }

      if (hashes.linkHash) {
        const byLink = byGuid.filter((candidate) => {
          return candidate.linkHash === hashes.linkHash
        })

        if (byLink.length === 1) {
          return { match: byLink[0], identifierSource: 'guid' }
        }
      }

      return
    }
  }

  if (linkUniquenessRate >= 0.95) {
    // High-uniqueness channel: link is reliable.
    if (hashes.linkHash) {
      const byLink = candidates
        .filter((candidate) => candidate.linkHash === hashes.linkHash)
        .filter((candidate) => !hasEnclosureConflict(candidate.enclosureHash, hashes.enclosureHash))

      if (byLink.length === 1) {
        return { match: byLink[0], identifierSource: 'link' }
      }

      if (byLink.length > 1) {
        if (hashes.linkFragmentHash) {
          const byFragment = byLink.filter((candidate) => {
            return candidate.linkFragmentHash === hashes.linkFragmentHash
          })

          if (byFragment.length === 1) {
            return { match: byFragment[0], identifierSource: 'link' }
          }
        }

        return
      }
    }

    if (hashes.enclosureHash) {
      const byEnclosure = candidates.filter((candidate) => {
        return candidate.enclosureHash === hashes.enclosureHash
      })

      if (byEnclosure.length === 1) {
        return { match: byEnclosure[0], identifierSource: 'enclosure' }
      }

      if (byEnclosure.length > 1) {
        return
      }
    }
  } else {
    // Low-uniqueness channel (podcast/hub): enclosure is per-item, link is shared.
    if (hashes.enclosureHash) {
      const byEnclosure = candidates.filter((candidate) => {
        return candidate.enclosureHash === hashes.enclosureHash
      })

      if (byEnclosure.length === 1) {
        return { match: byEnclosure[0], identifierSource: 'enclosure' }
      }

      if (byEnclosure.length > 1) {
        return
      }
    }

    // Link-only items still get link matching even on low-uniqueness channels.
    if (isLinkOnly(hashes) && hashes.linkHash) {
      const byLink = candidates.filter((candidate) => {
        return candidate.linkHash === hashes.linkHash
      })

      if (byLink.length === 1) {
        return { match: byLink[0], identifierSource: 'link' }
      }

      if (byLink.length > 1) {
        if (hashes.linkFragmentHash) {
          const byFragment = byLink.filter((candidate) => {
            return candidate.linkFragmentHash === hashes.linkFragmentHash
          })

          if (byFragment.length === 1) {
            return { match: byFragment[0], identifierSource: 'link' }
          }
        }

        return
      }
    }
  }

  // Weak fallback: title only.
  // Only used when item has no strong hashes — prevents title from
  // accidentally merging items that have guid/link/enclosure but failed
  // to match on those (e.g. changed GUID with same title).
  const hasStrong = !!hashes.guidHash || !!hashes.linkHash || !!hashes.enclosureHash

  if (!hasStrong && hashes.titleHash) {
    const byTitle = candidates.filter((candidate) => {
      return candidate.titleHash === hashes.titleHash
    })

    if (byTitle.length === 1) {
      return { match: byTitle[0], identifierSource: 'title' }
    }

    if (byTitle.length > 1) {
      return
    }
  }

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
