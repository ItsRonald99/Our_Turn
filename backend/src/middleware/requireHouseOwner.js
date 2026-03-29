/**
 * Requires that the authenticated user is the owner of the house.
 * Must be used after requireHouseMember, which attaches req.member.
 */
export function requireHouseOwner(req, res, next) {
  if (req.member?.role !== 'owner') {
    return res.status(403).json({ error: 'Forbidden: only the house owner can perform this action' });
  }
  next();
}
