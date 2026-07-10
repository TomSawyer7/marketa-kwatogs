export const POSITIVE_TAGS = [
  "As described",
  "On time",
  "Communicative",
  "Fair price",
  "Friendly",
] as const;

export const NEGATIVE_TAGS = [
  "Not as described",
  "Late",
  "Poor communication",
  "Overpriced",
  "Unfriendly",
] as const;

export const ALL_TAGS = [...POSITIVE_TAGS, ...NEGATIVE_TAGS] as const;
export type ReviewTag = (typeof ALL_TAGS)[number];

export const MAX_TAGS = 3;
export const MAX_COMMENT = 500;
