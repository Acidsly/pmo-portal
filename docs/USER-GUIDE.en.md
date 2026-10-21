# PPM — Project Portfolio Management: user guide

## What it is

A portal where the company keeps all its projects in one place:
- every project has a **card**: team, links, timeline, budget, health, change history, comments, status reports and risks;
- the PM regularly submits a **status report** — it is the only way to change the project's key indicators (phase, health, % complete, dates, costs);
- **the PMO approves** every status report: a report reaches the card only after approval;
- project **risks and issues** are scored as "probability × impact", and each gets a response strategy;
- the **home page** shows the state of the portfolio: key figures, the risk map, schedule slips, upcoming go-lives, the portfolio by department.

Everyone sees only the projects where they or their direct reports have a role.

## How to open

- **Computer:** open `https://smarthrua.sharepoint.com/sites/pmo-test` in a browser and sign in with your Microsoft 365 work account.
- **Phone and tablet (iPhone, iPad, Android):** the same address in Safari or Chrome. To open it like an app: in Safari — Share → "Add to Home Screen", in Chrome — menu ⋮ → "Add to Home screen".
- **The SharePoint mobile app** may not show the portal fully — use the browser in that case. The SharePoint menu above the portal is hidden: everything is done in the portal tabs.

The menu tabs have icons, each section in its own colour. On a phone only the icons remain (the name is in the tooltip).

This guide is always available under the **?** button at the top of the portal.

## Who sees what and can do what

| Who | Sees | Can |
|---|---|---|
| Project PM | own project | edit the card (team, links), submit status reports, manage risks, comment |
| The PM's managers (org chart) | projects of their reports | view and comment |
| Owner, project team and their managers | projects where they or their reports have a role | view and comment |
| Country CEO | projects of their countries (the "Country" field) | view and comment |
| PMO | all projects | create new projects, approve or return status reports, view and comment |
| Other employees | an empty portal | — |

An archived project is view-only for everyone. If the portal is empty for you, you have no role in any project.

## Home

- **Key figures strip** at the top: active projects; the share of projects with a recent report (no older than 14 days); for the PMO — reports awaiting approval; high risks (open, score 15 and above); overdue projects (the plan date has passed but the project is open). Click a figure to open the filtered list.
- **Portfolio by health** — a ring: how many active projects are green, yellow, red and not rated yet; **Portfolio health over time** — how health changed over the last 12 weeks: every project as of the snapshot date by its latest approved report, grey — no approved report yet; today's column matches the ring.
- **Risk map** 5 × 5: rows are probability, columns are impact, each cell shows the number of open risks. Click a cell to list its risks below the map.
- **Portfolio by department** — active projects of each department broken down by health; the number inside each coloured part of the bar is how many projects are in that state.
- **Portfolio by country** — the same by the "Country" field.
- **Biggest schedule slips** — the three projects whose forecast completion is later than planned: by how many days and how many times the plan was moved. **Go-lives in the next 7 days** — go-live date, health, PM.
- Below — **Projects at risk**, **No recent status report**, **Management decisions needed**, **Open risks**; "See all" opens the full list.

Everything is counted only over the projects you can see (excluding the archive).

## Projects

- **Tiles** or **List** — the switch at the top. Tiles are handier on a phone.
- **Show:** All projects, Strategic, At risk, My projects (all) — where I am PM, owner or on the team, **I am PM** — only projects where I am the PM, No recent report, Overdue.
- **In the list:** click a column header to sort; the funnel ▽ filters by value; the gear ⚙ chooses and orders columns (↑ / ↓); on a computer, drag a column header's edge to change its width — it is remembered for each list, "Reset column widths" is in the gear menu; **CSV** exports the table as shown (the file opens in Excel). New records are on top. On a phone, status reports and risks are shown as cards (sorting and filters set on a computer apply there too).
- **A long list** scrolls in its own window: column headers stay at the top, the horizontal scroll bar is always at the bottom of the visible part of the table, so the right-hand columns of the first rows are visible without scrolling the page down. On the phone — as before, without a separate window.
- **Filters** (funnel and "Show") apply while you stay on the page: switching to another tab resets them to the defaults (column choice and sorting are remembered). Column widths do not change with filters.
- **"Report" column** — the date of the last approved report, with the approval of the newest report below it (for "Awaiting approval" and "Returned" — also the report date on its own line). Hover the label to see when and by whom the report was submitted. The column filter (⏷): by freshness and by approval — "Approved", "Awaiting approval", "Returned", "No reports submitted".
- **Project phase** (life-cycle stage) is a coloured label: Initiation — purple, Planning — blue, Execution — green, On hold — orange, Completed — green, Cancelled — grey. The dot next to it is the project health (green, yellow, red, grey — not rated).
- **Colours:** a red completion date means the deadline has passed and the project is still open. The dot in the "Report" column is the freshness of the last approved report: green — up to 8 days, yellow — 9–14, red — over 14, grey — no approved reports yet (hover over the dot to see how many days old the report is). Below the date is the **approval of the newest report**: "Approved", "Awaiting approval" or "Returned" (for the last two — the report date).

## Project card

Click a project and its card opens on the right (full screen on a phone). Every side panel has a **coloured label** at the top showing what is open: Project, Status report, Risk, Issue, Assignment, Notifications, Feedback, Help — the same wherever you opened it from.
- at the top — type, health, phase, priority and **Links** (Loop, documents, etc.); **Add status report** and **Edit project** buttons (PM only);
- **Parent project** and **Child projects** — a link between projects (any nesting); click a name to open the project. The link grants no access: child projects show only if you can see them; a parent you cannot open shows its name without a link. «Projects» has a **Parent project** column (⚙ — column picker).
- **Goal and description** — up to 10 lines (line breaks are kept); a longer text — **Show all** / **Collapse**.
- approval notes: "Status report of … is awaiting PMO approval" or "Report of … returned for rework" with the PMO's comment;
- **Stakeholders**: PM, owner and **Project team** — a table: member, role, what to contact them about;
- **Timeline** (with the forecast deviation), **Budget and progress** (amounts in US dollars): budget (plan), the **cost at completion forecast** with its deviation from the budget (red — overrun, "−" — savings), actual cost, **country**;
- **Change history** — who changed what and when: "old → new", the reason (including PMO decisions — "Report approval"); also **report submissions** ("Report submitted", including "New report based on the returned one") and **risks and issues** ("Added", field changes, "Closed") — with an "Open report" / "Open risk" link. These events appear after synchronization (~15 minutes);
- **Comments** — the feed and "Add comment";
- **Health history** — ratings from the latest reports;
- **Status reports** — the three latest, with the approval mark; **Show all reports (N)** — all of them, **Collapse** — three again; click the date or summary to open a report; **Risks and issues**;
- **Card access** — who sees the project and with what rights.

You can share a link to the card: the browser address points exactly to it.

## Status report (for the PM)

1. In the card — **Add status report** (or the "Status reports" tab → "New status report"). A project can have **only one report awaiting approval**: until the PMO decides, the button is hidden and the card says "The report from … is awaiting PMO approval". Opened from the card, the form is for that project — you cannot switch the project there. In the general form, projects with a report awaiting approval cannot be selected (marked "report of … awaiting approval").
2. The **submission date** is the day you save the report — nothing to pick. The **period** is calculated automatically: from the date of the project's last approved report (if there is none — from the start date) to the submission date, e.g. "06.10.2026 – 08.10.2026".
3. Rate **schedule, budget and resources**: green, yellow, red. **Overall health** is calculated automatically — the worst of the three.
4. **Key indicators** are prefilled with the current values. Change only what has changed: phase, % complete (a whole number from 0 to 100), type, dates, actual costs (amounts are shown with spaces between thousands: 1 450 000), the **budget (plan)** and the **cost at completion forecast** — what the project will cost by the end (the hint below the field is "at the current spending rate": costs ÷ % complete). The forecast cannot be lower than the cost to date; for "Completed" and "Cancelled" it equals the costs. The budget (plan) is changed only by a report — the card shows it but does not edit it. Launch, planned end and forecast dates cannot be earlier than the start date. For "Completed — move to archive", % complete becomes 100 and cannot be changed. Enter dates as dd.mm.yyyy (dots are added automatically) or pick them in the calendar — the button on the right of the field. For "Completed" or "Cancelled" — the **actual completion date**: not earlier than the start date and not later than the submission date (the portal explains next to the field which date it compared with); enter a future completion as the forecast, an early one is fine.
5. If you changed the phase, type, a date, the budget (plan) or the cost forecast, fill in **Reason for changing indicators** (required, goes to the history). Cost to date and % complete need no reason.
6. A **One-line summary** (required), what was done, **not done from the plan and why** (above the field — "Planned": the plan from the last approved report; if there was a plan, the field is required — if everything is done, say so), the plan, **issues and risks for the period** — briefly, what got in the way (the project's risk and issue register is separate, in the card, «Risks and issues» block). **Management decision needed** — tick it if further work needs a decision beyond the PM's authority: e.g. approving an additional budget, changing priorities or resolving a resource conflict. Then **Decision required** is mandatory: state which decision is needed and what happens without it. A regular PMO approval of the status report does not need this tick.
7. **Save.** If something is missing or entered incorrectly, the portal highlights all such fields at once and explains next to the field what is wrong. The report goes **to the PMO for approval**; the card updates after approval. A submitted report cannot be changed.
8. If the PMO **returned** the report, the PMO's comment is shown in the card and in the report itself. Click **New report based on the returned one**: the form is filled with the returned report's data — fix it and save.
9. A report is **returned automatically** if the project PM changed before the PMO decision (the new PM submits a current report) or the project moved to the archive — the comment explains why.

The **"Completed — move to archive"** and **"Cancelled — move to archive"** phase options send the project to the archive once the report is approved — after that the project is view-only. They require the **"Actual completion date"** — when the project was actually completed or cancelled: not before the start date and not after the report date.

## AI assistant (pilot)

Pilot participants have an AI assistant (Microsoft Copilot Studio) in the status report form. It suggests but does not decide: the report and ratings are the PM's responsibility and are approved by the PMO.

1. **Turning it on.** Click your avatar at the top right → the **«AI assistant»** switch. The first time, the portal shows which data goes to AI — click **«Allow»** (we ask once). Turned off — the report form works without AI again; you can turn it back on any time without allowing again. The setting is kept for you, not for the browser: turned on on your phone — it is on on your computer too. On a computer, a Microsoft sign-in window opens (if the browser blocked it, allow pop-ups for the site); on a phone, the portal goes to the Microsoft sign-in page and comes back, and turning on finishes by itself. If it fails, the reason is shown under the switch. If **«Sign in»** appears in the report form on a phone, sign in to Microsoft again while the form is empty (entered data will not be kept).
2. **«Fill with AI»** (at the top of the form) drafts the report from project data: «One-line summary», «Done this period», «Plan for next period», «Issues and risks for the period». Empty fields are filled at once, filled ones only after you click «Replace». **«Undo AI insert»** restores the texts until you change them. The **«AI hints»** panel shows what not to forget (items of the previous plan, overdue actions, high risks, a decision request) and suggested ratings: a rating changes only if you click **«Accept»**. Review and correct the texts — it is a draft.
3. **«Check with AI»** (instead of «Save»). First the usual form checks; then the **«Contradictions (AI analysis)»** field (read-only) lists items, each naming the field to fix:
   - the portal compares dates and amounts itself: green «Schedule» but the forecast is later than the plan or actions are overdue; green «Budget» but the cost or the cost forecast exceeds the budget; «Management decision needed» without a description; a reduced «% complete»;
   - AI checks the content: whether high risks and issues from the register are mentioned with actions, whether the previous plan items are reflected (in «Done», «Not done from the plan and why» or «Plan for next period») and the decision request, whether the summary contradicts the ratings, whether a phase or date change is explained, whether the PMO comment on a returned report is addressed.
   Under an item about a register record — **«Show record»** and **«Add a mention»**: a line with the actions from the register is added to «Issues and risks for the period».
4. Changed the report — the button is **«Check with AI»** again. No changes — **«Save»**: the report is saved with the check result, even if you disagree with the items.
5. **AI did not respond** (no connection, limit reached, no access) — the reason and a **«Save without check»** button appear: submitting a report does not depend on AI, and the PMO sees «AI check not performed: …». Change the report to try again. On the test site the failure is also recorded in «Feedback» automatically (technical data only, without the report text) so that we can find the cause.
6. **The more reports, the more useful AI is.** The draft and the check rely on the project's earlier approved reports: the previous plan, «Not done from the plan», budget and forecast changes with reasons. After a few reports the assistant reminds you more precisely what was promised and not done and drafts texts in your style — so fill the fields fully and specifically already now.
7. **What data goes to AI** — this project only: indicators, recent approved reports, risk and issue register records, the form text; no e-mails or team. Processing — Microsoft Copilot Studio (Europe; the model may process data outside it).

## Approving status reports (for the PMO)

1. Reports waiting for you: the "Awaiting approval" figure on the home page and "Status reports" → "Show: Awaiting approval".
2. Open the report: ratings, the key indicators it changes, what was done, the plan, issues.
3. In the **Report approval** block:
   - **Approve** — the report reaches the card with the PM's ratings;
   - change the schedule, budget or resources rating and click **Approve with changed ratings** — your rating reaches the card; a comment is required;
   - **Return for rework** — the card does not change, the PM sees your comment (required).
4. The PMO changes only the ratings; the report itself (texts, dates, phase) stays unchanged. The decision is recorded in the project's change history ("Report approval": "old → new", your comment).

If the AI assistant checked the report, it has a **«Contradictions (AI analysis)»** block with the check date or «Saved without AI check» (with the reason). It is a hint for the conversation with the PM, not a decision: it does not affect the approval.

A decided report cannot be approved again: if changes are needed, return it and the PM will submit a new one. A report approved by mistake can only be corrected by the PM's next report.

Before a decision the portal checks the report's current state: if another PMO has already decided it, your decision is not saved (you see why). A report whose author is no longer the project PM can only be returned.

## How to change the project phase

The phase (Initiation, Planning, Execution, On hold, Cancelled, Completed) changes **only through a status report** — it is not edited in the card.

1. **The PM** opens the project card → **Add status report**.
2. In **Key indicators** chooses the new **Project phase** (and changes dates and % complete if needed).
3. Fills in **Reason for changing indicators** — why the phase changes; the reason goes to the history.
4. Rates schedule, budget, resources, writes the summary → **Save**. The report goes for approval.
5. **The PMO** approves the report — the phase in the card changes, and "Report approval" and "Updated by status report" rows appear in the history ("old → new", the reason). If the PMO returns the report, the phase does not change and the PM submits a new report.
6. **"Completed — move to archive"** or **"Cancelled — move to archive"** — after approval the project gets the "Completed" or "Cancelled" phase, the "Completed / cancelled on" date and the "Actual completion date" and moves to the "Archive" tab; after that it is view-only.

## Risks and issues

- Add one from the card ("Add risk / issue", PM only) or on the "Risks and issues" tab → "New risk / issue".
- First choose the **type** (Risk or Issue) — the form title follows it ("New risk" / "New issue"), then fill in the **description**.
- **Probability** and **impact** are 1 to 5; the **score** = probability × impact: 15–25 — high (red), 8–14 — medium (yellow), 1–7 — low (green).
- **Response strategy:** Avoid, Reduce (mitigate), Transfer, Accept (clicking the selected one again clears the choice).
- **Risk reduction actions** — what we do now; **Contingency plan** — what we do if the risk occurs.
- **Required fields** (marked *): for a risk — the description, "Response strategy", "Risk reduction actions" and "Contingency plan" — at any score; for an issue — the description and actions. Empty values or spaces only are not accepted; the explanation is shown next to the field.
- Set the risk owner, status (Open — orange label, In progress — blue, Closed — green) and the **Mitigation due date** — not earlier than today. An overdue open risk is shown in red; the form says "The due date has passed": close the record or create a copy with a new due date.
- In a **saved record** only the **status** can be changed (other fields are view-only), so the register history stays accurate. To change the strategy, actions, score or due date — **"Copy risk"** ("Copy issue"): a new record opens with all fields; change what you need and save, then close the original (status "Closed").
- Risks and issues are **not approved**: the PMO sees new high risks (15+) and all issues, and their status changes, in notifications; PMO feedback — as a comment in the project card.
- "Show: High risks" — open risks with a score of 15 and above; "Risks of archived projects" — risks of archived projects (view-only).

## Comments

Anyone who sees the project can comment: in the card — "Comments" → "Add comment". An archived project is view-only: no new comments.

## Notifications

- At the top right there is a **bell**. A **red number** on it shows how many new events there are for you in your projects; while there are new ones, the bell sways now and then.
- Click the bell to open **"Notifications"**: events for 14 days, new ones at the top and highlighted ("New"), already seen ones below. Clicking an event opens the card, status report or risk; **"← Notifications"** at the top takes you back to the list. "Only new" hides what you have seen.
- Opening an event marks it as read and the number goes down. **"Mark all as read"** marks everything shown as read and the number disappears. Just opening the list marks nothing.
- What you see depends on your role in the project: the PM, owner and team see project creation, assignments, PMO decisions on reports, indicator updates and comments; risks — the PM and the risk owner always, the owner and team only high ones (score 15 and above); card edits — the PM and the owner; the PMO sees reports submitted for approval, projects moved to the archive, new high risks (15+) and all issues, and their status changes. Your own actions are not shown.
- **You were added to a project team** or your role in it changed — a separate notification only for you: "You were added to the team" / "Your team role was changed" with your role; clicking it opens the card. It appears together with the access rights, within ~15 minutes. There is no notification about removal from a team — the project simply disappears from your list.
- **Your feedback was reviewed** — the "Feedback reviewed" notification: the item number, status and answer; clicking it opens the item. A new answer to the same item — a new notification.
- **New portal release** — a notification for everyone with the version number; clicking it opens "What's new".
- For a new participant notifications appear within ~15 minutes; earlier events are not treated as new.

## New project and editing

- A **New project** is created by the PMO: the name (unique — no two projects share a name) and the PM are required (the PM is not prefilled — choose one); the project number is assigned by the system in order (PRJ-001, PRJ-002…) — it is unique and cannot be changed by hand.
- For ~15 minutes after creation the project is **being prepared** (the card says "The project is being prepared"): after that the PM can add reports, risks and team members.
- Only the PM can **Edit project**: name, department, priority, description, **parent project** (any project except itself and its own children; the PMO also sets it when creating), and also:
  - **Project team** — "+ Add member": a person, their **role** (required) and what to contact them about; × removes the member;
  - **Links** — "+ Add link": a name and an address (starting with `https://`); × removes it.
- **«Goal and description»** is required when the PM saves the card (including projects created earlier — at the next save): briefly, the project goal and the expected result. The PMO can create a new project without a description — the PM adds it.
- **Type and priority are different things.** **Type** («Strategic» / «Regular») is the project's importance to the company; it is set at creation and then changes only through a status report. **Priority** («1 — High» … «3 — Low») is the current order of resource allocation; the PM changes it in the card (the field next to the department). A strategic project may temporarily have a low priority — this is not an error.
- Phase, health, dates, costs, the **budget (plan)** and the **cost forecast** change only through a status report (see "How to change the project phase"). The PMO sets the budget when creating the project; in the card form it is read-only.
- After the team changes, access rights are recalculated automatically **within ~15 minutes**: then the person sees the project in their list and in «Card access» and can comment.
- The PMO chooses the project **country** when creating it (required; a project of several countries is created separately for each country). The country CEO sees the projects of their countries and can comment.
- After the project is created, only the PMO changes the **PM, the owner and the country**: in the card — **"Change PM / owner / country"** (new PM, new owner, new country — an empty field means no change, the reason is required). The change shows in the card and in the "Change history" ("Assignment") right away and is finally applied by synchronization within ~15 minutes; until then a new change cannot be submitted. A report of the former PM that is pending approval is returned automatically.
- After a **PM change** the former PM can no longer change the project right away; the new PM sees "You are assigned as PM of this project: edit access appears within 15 minutes" — the page refreshes by itself.

## Archive

The "Archive" tab lists projects with the **Completed** or **Cancelled** phase (the "Project phase" column) and their completion / cancellation date, view-only (no new comments). Their risks — "Risks and issues" → "Show: Risks of archived projects". Navigation is the same as in "Projects": **List** or **Tiles**, "Show" (All projects, **Completed**, **Cancelled**, Strategic, My projects, I am PM), CSV and column choice; tiles show the completion / cancellation date.

## Language and theme

Top right: **UA / EN / RU** and the light ☀ / dark ☾ theme. On a phone — in the menu under your avatar (the header is a single row there). The choice is remembered in this browser. Values (statuses, health, types, priorities, departments, approval) and the names in "Show" are translated with the interface; record content stays as entered.

## When changes appear

Anything you save in the forms appears on screen immediately; so do PMO decisions on reports. Access rights (including for new team members), the change history and "Card access" update automatically within ~15 minutes.

Before every save the portal checks the current data: if meanwhile the PM changed, the project moved to the archive, the project already has a report awaiting approval or another user changed the record — nothing is saved, you see an explanation and the data refreshes. An open page refreshes its data when you return to the tab and every 5 minutes. To refresh the data right away (for example, on a phone), press **↻ «Refresh data»** above the list — next to «CSV».

## Feedback

The **Feedback** tab → **Leave feedback** (or the "Feedback" button in Help): describe what is wrong or what could be better and add up to 5 screenshots:
- on a computer — take a screenshot and paste it into the form: **Ctrl+V** (Windows) or **Cmd+V** (Mac); or use "Add screenshot";
- on a phone or tablet — "Add screenshot" → gallery or camera.

Your device is added automatically; in the text, say on which screen you noticed the problem.

The **Feedback** tab lists all participants' feedback: the number (#46 — answers refer to feedback by it), the text, the author, the review status (New, Accepted, Done, Commented, Rejected) and the developers' answer. Screenshots are visible only to the author and the developers. The status and the answer are set by the solution's developers. In the feedback window the **‹ ›** arrows next to the number go to the previous and next feedback in the table's order (with its filters and sorting).

## Tasks for the focus group

Do what applies to your role and after each task leave **feedback**: what was unclear, inconvenient or did not work.

1. Open the portal on a computer and on a phone. Is it clear from the home page what is happening with the portfolio? Click the key figures and a risk map cell.
2. Find your projects ("Show: My projects (all)" or "I am PM"). Are all your projects there, and nothing extra?
3. Open a project card: team, links, timeline, change history, access. What is missing?
4. **PM:** add a team member with a role and a link to a document.
5. **PM:** submit a status report that changes the completion date (with a reason) and check that the card is waiting for approval.
6. **PMO:** approve one report with a changed rating (with a comment) and return another one for rework.
7. **PM:** submit a new report from the returned one ("New report based on the returned one").
8. **PM:** add a risk with a response strategy, risk reduction actions and a contingency plan.
9. **Everyone:** add a comment to a project where you are the owner or on the team; look through the "Feedback" tab.
10. Switch the language and theme; send feedback with a screenshot from your phone.

## Detailed system overview

At the top of Help — the **portal version** and release date and **What's new →**: new features and fixes of the current release, numbers of implemented feedback items (click a number to open the item), what to re-check, and earlier releases.

At the end of Help there is a **Detailed system overview** button: why the portal exists, what it consists of, every screen with screenshots, approval rules and security. The overview opens in the portal (in Ukrainian); **Download PDF** there saves or prints it.
