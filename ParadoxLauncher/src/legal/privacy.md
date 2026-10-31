# MNG DAUNTLESS Privacy Policy

Version {{PRIVACY_VERSION}}

This policy explains what data MNG DAUNTLESS collects, why, who sees it, how long we keep it, and your choices. It covers
the MNG DAUNTLESS launcher, the MNG DAUNTLESS servers, and MNG Servers hosted by players. MNG DAUNTLESS is a free community
server run by the MNG DAUNTLESS team. Privacy and data requests: {{PRIVACY_EMAIL}}. Help with the game, bug and abuse
reports: {{SUPPORT_EMAIL}}.

It does **not** cover other servers you add to the launcher (see section 6), or Discord and other services you choose to
use, which have their own policies.

## 1. What we collect

**Your account**
- Username, email address (if you sign up with email), and your password, stored only as a secure one-way hash (Argon2id).
  We never see or store your password itself.
- If the server offers Discord sign-in and you use it: your Discord user ID, Discord username and avatar link. Only basic
  identity is requested, not your email, friends or servers.
- Account ID, sign-up date, last sign-in, account status and roles, and which version of these documents you accepted.

**Your game data**
- Characters, inventory, loadouts, in-game currencies, progression, challenges, cooldowns, Slayer's Path, mastery, and the
  history of in-game transactions (what was granted or spent, when, and by which part of the game).
- Party and friends information, and chat needed to deliver messages. Our logs record that a message was sent and its
  size, not what it says.

**Your in-game activity**
- What you do in the game is recorded: when and how long you play, the hunts you join or host, the Behemoths you defeat,
  the rewards you get, what you spend in-game currency on, the challenges you claim and what you unlock. We use it to keep
  the game fair, to find exploits and cheating, to fix bugs and to understand how the server is used.

**MNG Servers and co-op**
- Which MNG Servers you belong to or host, bans from them, and which MNG Server hub or hunt you are in.
- Who took part in each co-op hunt, and a record of what the host's game server saved for each player (used to check for
  cheating), including XP earned per hunt.
- If you host: your PC's free memory, number of CPU cores and CPU load, power-saver state, the launcher version, and
  fingerprints (hashes) of the game and launcher files, so we can tell whether your PC can host and runs unmodified files.

**Integrity checks**
- While you play, the launcher sends integrity summaries: the game's process ID and start time, how many modules are loaded
  plus a single fingerprint of that list, and counters such as unexpected modules, modified protected memory, and whether a
  debugger is attached.
- When a program file that is not part of Windows or the game is loaded into the game (for example an overlay or a
  recording tool), it also sends that file's name, its publisher's name and a fingerprint (hash) of the file, never the
  folder it is in, and never a list of your other programs.
- These checks only record and report. They never close the game or stop you from playing. No hardware IDs are sent.

**Technical data**
- Our servers log requests (what was requested, with passwords and codes removed, the result and timing) and account IDs
  for actions taken.
- Your IP address is used to deliver data to you and, briefly and in memory, to limit abuse such as password guessing. It
  also appears in a few security logs, for example chat connections.
- **Log files, testers only.** The launcher keeps logs of your recent sessions on your PC (section 10). We receive them only
  from accounts we have given tester access, and only when that tester presses "Upload logs". An upload contains their
  newest Play session and the logs written since: the launcher and game logs, the logs of game servers their PC runs, the
  connection logs, and the game's settings files with password- and token-like values removed. If you play on a tester's MNG
  Server, those logs can include your username and what you did there. For every other account, log upload is switched off.

**What we do not collect**
- No real names, dates of birth, home addresses, phone numbers or payment details.
- No precise location.
- No advertising or analytics trackers.

## 2. Why we use it

- **To run the service**: accounts, sign-in, saving your progress, matchmaking, MNG Servers and co-op hunts.
- **To keep it fair and safe**: preventing cheating, exploits, abuse and attacks, enforcing the Terms of Use, and fixing
  bugs.
- **To answer your requests** and to meet any legal obligations.

We do not sell your data, and we do not use it for advertising.

## 3. Who sees it

- **Other players** see your username and what the game normally shows (your character, gear, progress in a party).
- **MNG Server hosts** see who is on their server, where (Ramsgate, Training or a hunt) and how each player is connected,
  and they can kick or ban players. Their PC runs that server's game, so game data for that session passes through it.
- **The MNG DAUNTLESS team**, who run the servers, can see the data above to operate and protect the service, and can read
  log files that testers upload.
- **Discord**, if you choose to sign in with Discord.
- **Whoever provides the computers or hosting the servers run on.**
- **Authorities**, if the law requires it.

**Your IP address:** our servers see it, as any online service does. In co-op play and on MNG Servers, the host and other
players may also see it, unless the connection goes through a relay.

## 4. Where it is stored

Your data is stored on the computers that run the MNG DAUNTLESS servers, operated by the MNG DAUNTLESS team.

## 5. How long we keep it

- **Account and game data:** while your account exists.
- **Deleting your account:** request it on the launcher's Account page. Your account is **deactivated at once** (you
  cannot play) and held for **30 days**, during which you can sign in and restore it. After 30 days we delete your
  account, game data, MNG Server data and integrity records.
- **After deletion we keep only a minimal record:** that an account was deleted and when, under a pseudonymous ID. If the
  account was banned, we also keep what we need to enforce the ban, such as a one-way hash of the email address and the
  reason.
- **Activity statistics:** daily summaries are kept for up to 400 days; the detailed records stay while your account
  exists.
- **Integrity check data:** up to 90 days.
- **Server logs:** up to 90 days. Sign-in sessions expire on their own.
- **Tester log uploads:** 90 days after a session's last upload, or sooner if the tester asks.

## 6. Other servers

When you add a server that someone else runs, you send your data to them, not to us. Its operator can see your IP address
and everything that server stores. We do not run or check other servers; ask their operator about their own terms and
privacy.

## 7. Your rights

Depending on where you live, you can ask to see, correct, export or delete your data, object to how we use it, or
withdraw consent. Delete your account in the launcher, or email {{PRIVACY_EMAIL}} for anything else. We answer within 30
days. You can also complain to your data protection authority.

## 8. Age

MNG DAUNTLESS is for people aged **{{MINIMUM_AGE}} or older**. We do not knowingly collect data from anyone younger; if
we learn that we have, we delete it.

## 9. Security

- Connections to our servers are encrypted (HTTPS).
- Passwords are hashed with Argon2id.
- Your sign-in is stored on your PC in Windows Credential Manager or encrypted with Windows' own protection.
- Access to our servers and admin tools is restricted.

No system is perfectly secure; tell us at {{SUPPORT_EMAIL}} if you find a security problem.

## 10. Data on your PC

The launcher stores your settings, your saved sign-in (as above), the servers you added, and logs of your recent sessions
in `%LOCALAPPDATA%\MNGDauntless\Logs`. These logs stay on your PC unless your account has tester access and you press
"Upload logs" (section 1). The launcher uses no cookies or trackers. You can remove all of it by uninstalling the launcher
and deleting those folders.

## 11. Changes

We may update this policy. When we change it in a meaningful way, the launcher will ask you to accept the new version.
The version date is at the top.
