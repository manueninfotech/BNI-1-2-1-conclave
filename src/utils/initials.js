/**
 * Utility to extract user initials dynamically from a full name.
 *
 * Rules:
 * 1. Two or more words: First letter of first word + first letter of last word
 *    - "Shravya Venishetty" -> "SV"
 *    - "Ravi Kumar" -> "RK"
 *    - "John Michael Smith" -> "JS"
 * 2. Single word (>= 2 chars): First two letters uppercase
 *    - "Priya" -> "PR"
 *    - "Admin" -> "AD"
 * 3. Single word (1 char): That character uppercase
 *    - "P" -> "P"
 * 4. Empty, whitespace, null, or undefined: Neutral fallback (defaults to 'U')
 *    - null / undefined / "" -> "U"
 *
 * @param {string|null|undefined} name - Full user name
 * @param {string} [fallback='U'] - Fallback initials when name is absent/empty
 * @returns {string} Initials (1-2 uppercase characters)
 */
export function getInitials(name, fallback = 'U') {
  if (!name || typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  // Split on whitespace and filter empty parts
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  if (parts.length === 1) {
    const single = parts[0];
    if (single.length >= 2) {
      return single.slice(0, 2).toUpperCase();
    }
    return single.toUpperCase();
  }

  // 2 or more words: first letter of first word + first letter of last word
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return (first + last).toUpperCase();
}

/**
 * Resolves a profile photo URL from any standard user profile object.
 * Inspects photoUrl, avatarUrl, profileImage, photo, and picture.
 *
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
export function getProfilePhotoUrl(user) {
  if (!user || typeof user !== 'object') return null;
  const candidate = user.photoUrl || user.avatarUrl || user.profileImage || user.photo || user.picture;
  if (!candidate || typeof candidate !== 'string' || !candidate.trim()) return null;
  return candidate.trim();
}

