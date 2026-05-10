
# Previewer ↔ Viewer channels + Active Call Space

## What we're building (slice 1: Channels + 1‑to‑many broadcast)

A new section inside `/live` that lets a **Previewer** open named **channels**, lets **Viewers** browse and join those channels, request a "movie‑call" with a story/role suggestion, and — once the Previewer accepts — opens a shared **Active Call Space (ACS)** with a persistent scratchpad, an upload area, and an AI cinephile that occasionally chimes in as a third wheel.

Realtime transport: **Supabase Realtime** (Postgres changes + presence + broadcast). No WebRTC in this slice.

## User flow

```
Previewer (role='previewer')
  └─ creates channel "Drag-Queen Re-Birth"
        └─ visible on /live → Channels list
Viewer
  ├─ opens channel → sees Previewer activity feed (text addendums + STT lines)
  ├─ clicks "Request movie-call"
  │     ├─ writes story plot + suggested role (creative-art-forming, art-in-creation,
  │     │  translocatory action, Drag-Queen, Re-Birth/Re-born, Deathly-harbingers, Life's gateway)
  │     └─ submits → Previewer gets pending request
  └─ Previewer accepts/rejects (rejection allowed; only Previewer can add anything)
       └─ on accept → Active Call Space (ACS) is created, both sides join
              ├─ shared text/file box (live, 2-user only, persisted)
              ├─ Previewer can paste a Viewership-membrane id to elevate the call
              └─ Cinephile AI watches both sides and posts brief 3rd-person notes
```

## Roles

Add `'previewer'` to the existing `app_role` enum. `has_role(uid, 'previewer')` gates channel/accept actions. Anyone signed in can be a Viewer.

## Database (one migration)

- `ALTER TYPE app_role ADD VALUE 'previewer'`
- `live_channels(id, previewer_id, name, slug unique, description, is_open bool, created_at)`
  - RLS: any authenticated user can `select`; only `has_role(uid,'previewer')` can `insert`; only owner can `update/delete`.
- `live_call_requests(id, channel_id, viewer_id, previewer_id, story_plot text, suggested_role text, status text check in ('pending','accepted','rejected','closed'), created_at, decided_at)`
  - RLS: viewer/previewer participants can `select`; viewer can `insert` their own; only previewer can `update` status.
- `live_active_call_spaces(id, request_id unique, channel_id, previewer_id, viewer_id, membrane_id text, scratchpad text default '', created_at, closed_at)`
  - RLS: only the two participants can `select/update`; insert via SECURITY DEFINER function `accept_call_request(req_id)` that flips status and creates the ACS.
- `live_acs_messages(id, acs_id, author_id, kind text check in ('text','ai','system','file'), body text, file_path text null, created_at)`
  - RLS: only ACS participants can `select`; participants can `insert` text/file; AI messages inserted by edge function via service role.
- Storage bucket `acs-files` (private). RLS on `storage.objects`: only the two ACS participants for paths prefixed by `acs/<acs_id>/...`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE live_channels, live_call_requests, live_active_call_spaces, live_acs_messages`.

## Edge function: `cinephile`

- Triggered from the client whenever a new participant message lands in an ACS (debounced ~6s; also after every 4 messages).
- Reads the last ~30 messages of that ACS (service role), calls Lovable AI Gateway with `openai/gpt-5` and a tight system prompt:
  > "You are a curious cinephile and a fun third-wheeler in a 2-person creative call between a Previewer and a Viewer. Speak in third person about *both* of them. Be brief (1–2 sentences max), warm, very curious about the story, never bossy. Skip if you have nothing genuinely useful or playful to add — return empty string."
- If the model returns non-empty, insert a row into `live_acs_messages` with `kind='ai'`. Empty → no-op (keeps token use low).
- Auth: verify the caller's JWT, then verify they belong to the ACS. Handle 429/402.

## Frontend

Inside `src/pages/Live.tsx`, add a third top-level section (besides Viewer/Previewer mode picker): **Channels**.

New components in `src/components/live/`:
- `ChannelsPanel.tsx` — browse open channels; "Create channel" button shown only if `has_role 'previewer'`.
- `ChannelRoom.tsx` — Previewer activity feed (existing addendum + STT events stream as `live_acs_messages` siblings on the channel) and "Request movie-call" button for Viewers.
- `CallRequestDialog.tsx` — Viewer writes story plot + suggested role (preset chips: Drag-Queen, Re-Birth, Deathly-harbinger, Life's gateway, etc.).
- `PreviewerInbox.tsx` — pending requests with Accept / Reject.
- `ActiveCallSpace.tsx` — split view: shared scratchpad (`textarea` synced via debounced `update` on `live_active_call_spaces.scratchpad` + realtime), message list, file upload to `acs-files`, "Paste membrane id" input (Previewer only), AI bubbles styled distinctly. Window is live for both as long as ACS is open; "Close space" only by Previewer.

Hook: `src/hooks/useRealtimeRows.tsx` — small generic helper for table subscriptions used by the four panels.

## Permissions recap

- Create channel: `previewer` role only.
- Send call request: any signed-in viewer.
- Accept/reject: only the channel's previewer.
- Edit scratchpad / upload files: both ACS participants.
- Paste membrane id: previewer only (matches current `Viewership membrane` mechanic in `Live.tsx`).
- AI agent: writes via edge function with service role; users can't impersonate it.

## Out of scope (this pass)

- Live audio/video (WebRTC). Channel feed is text + previewer-side STT addendums only.
- Performance ratings / reputation surfaces beyond the existing accept/reject signal.
- Public discovery beyond the open-channel list.

## Files I'll touch

- `supabase/migrations/<new>.sql` — schema, RLS, `accept_call_request` function, realtime publication, storage bucket + policies.
- `supabase/functions/cinephile/index.ts` — new edge function.
- `src/pages/Live.tsx` — wire the Channels tab into the existing mode picker.
- `src/components/live/ChannelsPanel.tsx`, `ChannelRoom.tsx`, `CallRequestDialog.tsx`, `PreviewerInbox.tsx`, `ActiveCallSpace.tsx` — new.
- `src/hooks/useRealtimeRows.tsx` — new.

## After approval

I'll run the migration first (you'll get a confirm prompt), then add the edge function and UI in the same turn.
