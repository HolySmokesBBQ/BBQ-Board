# Hunk surgery — committing ONLY your lines from a shared-working-tree file

Why this exists: four-plus sessions share one working tree and one git index.
`git commit -- <path>` scopes by FILE, not hunk, so committing a shared file
takes every session's uncommitted lines under your message. Board nearly did
exactly that (caught pre-push, soft-reset, 2026-09-29), and the rule since is:
never commit a file another session has uncommitted edits in — unless you do
this surgery, which commits provably only your own lines.

## The pattern (proven: Website on App.board.jsx, Notebook on firestore.rules)

1. BACKUP the working file (copy aside, outside the repo or in scratch).
2. REBUILD the commit version: start from `git show HEAD:<path>` and apply
   ONLY your hunk(s) to it.
3. PROVE the delta: `git diff --no-index <(git show HEAD:path)` vs your built
   file — the output must be EXACTLY your lines, nothing else. Count them.
   If anything unexpected appears, stop; do not commit.
4. Swap the built file in, `git add <path>`, `git commit -- <path>` with a
   message that names whose work it is (credit another session explicitly in
   the body if you are landing their handed-off fix).
5. RESTORE the full working file from the backup.
6. RE-VERIFY the working tree: `git diff <path>` must now show everyone
   else's hunks intact and yours gone — the pending diff shrinks by exactly
   your line count (Notebook: +104/-18 → +96/-18 after a +8/-1 commit).

## Failure mode the pattern itself caught (Notebook, 2026-10-12)

Anchoring the splice by FORWARD SEARCH for context lines is unsafe when the
file repeats structure. Notebook's first splice searched for the enclosing
list's last line and matched `reviewFields()` instead of `cookFields()`,
because BOTH lists end `'restaurantKey', 'syncedAt'`. That build would have
silently committed eight of another session's uncommitted fields. The
step-3 diff-against-HEAD proof caught it before anything touched the repo.

**Rule: the anchor must be INSIDE the function/block you are editing (your
own added line, or the block's unique header), never the nearest structural
match. Walk backwards from your own content, not forwards from lookalikes.**

## Non-negotiables

- Step 3 is the pattern. Skipping the exact-delta proof is not surgery, it
  is hope. Both recorded near-misses were caught at step 3 or its absence.
- Attribution follows authorship: if the hunk is another session's handed-off
  fix, their session is credited in the commit body.
- If the delta cannot be made exact, hand the file to the session that owns
  the other hunks instead of committing.
