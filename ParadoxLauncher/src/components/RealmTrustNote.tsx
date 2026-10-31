/*
 * Copyright (C) 2026 MysticFox / Pranav Karande (pranav158/Mystic-Paradox)
 * Licensed under the GNU Affero General Public License v3.0.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 * Additional terms under AGPLv3 Section 7 apply. See ADDITIONAL_TERMS.md.
 */

import { ShieldIcon } from "./icons";

// [2026-10-14] The trust warning shown wherever a Paradox realm is joined, hosted or added. It states what is true: the code
// is open source, and a player may act in bad faith. The last sentence points to the realm's host, the one person who can
// remove someone from a realm (kick and ban), and to the support address of the Terms (LEGAL.supportEmail in
// src/legal/legalMeta.ts - keep the two in step; it is written out here so this note has no imports beyond its icon).
export const REALM_TRUST_WARNING =
  "Only join MNG Servers and invite players you trust. MNG DAUNTLESS is open source, so anyone can study how it works, " +
  "and a player with bad intent may try to disrupt your game or exploit bugs in the game. Keep Windows and your " +
  "antivirus up to date. If someone behaves badly, tell the MNG Server's host and report it to studioferrermoz@gmail.com.";

export function RealmTrustNote() {
  return (
    <p className="note with-icon realm-trust-note">
      <ShieldIcon />
      <span>{REALM_TRUST_WARNING}</span>
    </p>
  );
}
