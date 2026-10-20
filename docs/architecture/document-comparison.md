# Split view

Split view is an optional layout over the existing document sessions. Open two different documents, then use **Split view** beside the tabs and choose a verified open partner. PDF/PDF, PDF/EPUB and EPUB/EPUB use the same engines, saved content identities and annotation ownership as ordinary tabs. Missing/disconnected or unverified tabs cannot start split view; reselect their local source first.

## Interaction

| Action                                          | Result                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Choose a split view partner                     | Pair the focused document with a different verified open tab; keep the initial focus           |
| Click or focus a pane, including an EPUB iframe | Give that document the selected-tab marker, global shortcuts and active reading-time ownership |
| Focus/Show document buttons                     | Explicitly select a pane and move keyboard focus into it                                       |
| Swap                                            | Reverse pane order, keeping focus, reader instances and per-document state                     |
| Select/open a third tab                         | Replace the focused slot; retain the other compared document                                   |
| Exit split view                                 | Keep the focused document in ordinary single-reader mode and return focus to its tab           |
| Close either compared tab                       | Exit split view; if closing the focused tab, prefer its surviving split view partner           |
| Reload                                          | Restore ordinary tab shells and the selected document; split view arrangement is not restored  |

The existing 46px tab strip and sidebar width policy are retained. A compact extra control row exists only during split view. At **960px or more of actual reader workspace width**, show two columns with at least 480px each. Below that, show only the focused pane and use the explicit Show buttons to switch. Library open/close/resize can change this without discarding document state. Side drawers remain bounded to their owning pane. Shared tooltips/popovers retain their existing accessible overlay behavior.

Each pane keeps its own page/chapter, zoom/fit/typography, utility/search, bookmarks, highlights, notes, loading and errors. Focus is separate from visibility: two wide panes can render, but only the focused reader receives `active=true`, enabling its shortcuts and reading statistics. EPUB document pointer/focus events are forwarded to the host and removed with the existing frame listeners. An unfocused restored annotations panel does not autofocus its search field. Reader/panel IDs retain session prefixes; split view uses individually named regions rather than pretending two visible regions are one selected tabpanel.

## Lifecycle and persistence

`DocumentSessions` owns the transient pair, focus, eligible visible IDs and resource retention. The host coordinates Vue rendering, available-width observation, keyboard focus and existing persistence events. No duplicate viewer engine, network processing or new storage service/schema is introduced.

Two visible readers remain mounted even when one is unfocused. A hidden retained reader has the existing five-inactive-minute deadline. In narrow split view, the hidden partner can expire; switching back reconstructs only that reader from its lightweight state. Exiting split view starts/retains the hidden partner's normal deadline. Closing/reset releases resources immediately and generation checks reject stale callbacks. Changing pane order does not remount readers.

An error or disconnected source in one pane does not block the other. Reconnection still requires verified matching content; rendering eligibility and focus are independent. Reader cleanup is nonblocking, so a rejected or unfinished disposal cannot poison other sessions. Functional lifecycle tests establish ownership/instance cleanup, not a numeric process-memory budget (#16/#167).

Split view IDs/order are deliberately omitted from `WorkspaceTabs`. Existing snapshots continue to preserve bounded per-document state and focused active ID, including legacy migration and unsupported-future-schema protection. Reload returns to a single selected shell, with existing permission/reselect behavior. No document bytes, handles, engine instances or URLs are added to saved split view metadata because no such metadata is persisted.

Linked scrolling, diffing, document merging, synchronized annotations and same-document duplicate panes are outside this increment. Annotation JSON export remains per document. Production activation is separate from staging acceptance; visual comparison/baseline adoption remains manual under #230.

Split view supports two different documents for independent reading. It does not compare text, data or annotations, calculate differences, or highlight changes. Three or more visible documents and configurable layouts are outside this increment.
