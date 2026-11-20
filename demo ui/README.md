# Mini Connecta UI demo

Run from the Mini-Connecta folder.

~~~powershell
node ".\demo ui\serve.mjs"
~~~

Open [Mini Connecta on localhost](http://127.0.0.1:3210/).

1. Continue with Google to use the sample account.
2. Enter a display name, choose Strawberry or Matcha, and save.
3. Open the Study Room from Discover. Use the room controls to preview the mic and leave.

Open **Preview controls** to switch theme or simulate an error on the current screen. Pick a scenario, then run the next action. In the room, use **Simulate disconnect** to try reconnecting.

The browser keeps the sample account and character locally. Sign out and sign in again to try the returning-user flow. Use a fresh browser profile to repeat character creation from scratch.

The preview adapts the layouts, Nunito, character captures, and Library artwork from the [Demo_StudyRoom source](../../DEMO/Demo_StudyRoom/README.md). The room uses the original static captures. Sign-in, joining, reconnecting and the mic use mock state.

See the [Release 1 plan](../docx/plan.md) and [product backlog](../docx/connecta-release-1-pbi.th.md).
