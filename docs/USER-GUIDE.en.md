# Project portfolio — user guide

## What it is

A portal where the company keeps all its projects in one place:
- every project has a **card**: team, links, timeline, budget, health, change history, comments, status reports and risks;
- the PM regularly submits a **status report** — it is the only way to change the project's key indicators (status, health, % complete, dates, costs);
- **the PMO approves** every status report: a report reaches the card only after approval;
- project **risks and issues** are scored as "probability × impact", and each gets a response strategy;
- the **home page** shows the state of the portfolio: key figures, the risk map, schedule slips, upcoming go-lives, the portfolio by department.

Everyone sees only the projects where they or their direct reports have a role.

## How to open

- **Computer:** open `https://smarthrua.sharepoint.com/sites/pmo-test` in a browser and sign in with your Microsoft 365 work account.
- **Phone and tablet (iPhone, iPad, Android):** the same address in Safari or Chrome. To open it like an app: in Safari — Share → "Add to Home Screen", in Chrome — menu ⋮ → "Add to Home screen".
- **The SharePoint mobile app** may not show the portal fully — use the browser in that case. The SharePoint menu above the portal is hidden: everything is done in the portal tabs.

This guide is always available under the **?** button at the top of the portal.

## Who sees what and can do what

| Who | Sees | Can |
|---|---|---|
| Project PM | own project | edit the card (team, links), submit status reports, manage risks, comment |
| The PM's managers (org chart) | projects of their reports | view and comment |
| Owner, project team and their managers | projects where they or their reports have a role | view and comment |
| PMO | all projects | create new projects, approve or return status reports, view and comment |
| Other employees | an empty portal | — |

An archived project is view-only for everyone. If the portal is empty for you, you have no role in any project.

## Home

- **Key figures strip** at the top: active projects; the share of projects with a recent report (no older than 14 days); for the PMO — reports awaiting approval; high risks (open, score 15 and above); overdue projects (the plan date has passed but the project is open). Click a figure to open the filtered list.
- **Portfolio by health** — a ring: how many active projects are green, yellow, red and not rated yet; **Portfolio health over time** — how health changed over the last 12 weeks: every project as of the snapshot date by its latest approved report, grey — no approved report yet; today's column matches the ring.
- **Risk map** 5 × 5: rows are probability, columns are impact, each cell shows the number of open risks. Click a cell to list its risks below the map.
- **Portfolio by department** — active projects of each department broken down by health; the number inside each coloured part of the bar is how many projects are in that state.
- **Biggest schedule slips** — projects whose forecast completion is later than planned: by how many days and how many times the plan was moved. **Go-lives in the next 30 days** — go-live date, health, PM.
- Below — **Projects at risk**, **No recent status report**, **Management decisions needed**, **Open risks**; "See all" opens the full list.

Everything is counted only over the projects you can see (excluding the archive).

## Projects

- **Tiles** or **List** — the switch at the top. Tiles are handier on a phone.
- **Show:** All projects, Strategic, At risk, My projects (where I am PM, owner or on the team), No recent report, Overdue.
- **In the list:** click a column header to sort; the funnel ▽ filters by value; the gear ⚙ chooses columns; **CSV** exports the table as shown (the file opens in Excel). New records are on top.
- **Colours:** a red completion date means the deadline has passed and the project is still open. Report light: green — up to 8 days, yellow — 8–14, red — over 14.

## Project card

Click a project and its card opens on the right (full screen on a phone):
- at the top — type, health, status, priority and **Links** (Loop, documents, etc.); **Add status report** and **Edit** buttons (PM only);
- approval notes: "Status report of … is awaiting PMO approval" or "Report of … returned for rework" with the PMO's comment;
- **Stakeholders**: PM, owner and **Project team** — a table: member, role, what to contact them about;
- **Timeline** (with the forecast deviation), **Budget and progress**;
- **Change history** — who changed what and when: "old → new", the reason (including PMO decisions — "Report approval");
- **Comments** — the feed and "Add comment";
- **Health history** — ratings from the latest reports;
- **Status reports** — with the approval mark; click the date or summary to open a report; **Risks and issues**;
- **Card access** — who sees the project and with what rights.

You can share a link to the card: the browser address points exactly to it.

## Status report (for the PM)

1. In the card — **Add status report** (or the "Status reports" tab → "New status report").
2. Rate **schedule, budget and resources**: green, yellow, red. **Overall health** is calculated automatically — the worst of the three.
3. **Key indicators** are prefilled with the current values. Change only what has changed: status, % complete, type, dates, actual costs.
4. If you changed the status, type or a date, fill in **Reason for changing indicators** (required, goes to the history).
5. A **One-line summary** (required), what was done, the plan, issues; tick **Management decision needed** if one is needed and describe it.
6. **Save.** The report goes **to the PMO for approval**; the card updates after approval. A submitted report cannot be changed.
7. If the PMO **returned** the report, the PMO's comment is shown in the card and in the report itself. Click **New report based on the returned one**: the form is filled with the returned report's data — fix it and save.

The **"Completed — move to archive"** and **"Cancelled — move to archive"** status options send the project to the archive once the report is approved — after that the project is view-only.

## Approving status reports (for the PMO)

1. Reports waiting for you: the "Awaiting approval" figure on the home page and "Status reports" → "Show: Awaiting approval".
2. Open the report: ratings, the key indicators it changes, what was done, the plan, issues.
3. In the **Report approval** block:
   - **Approve** — the report reaches the card with the PM's ratings;
   - change the schedule, budget or resources rating and click **Approve with changed ratings** — your rating reaches the card; a comment is required;
   - **Return for rework** — the card does not change, the PM sees your comment (required).
4. The PMO changes only the ratings; the report itself (texts, dates, status) stays unchanged. The decision is recorded in the project's change history ("Report approval": "old → new", your comment).

A decided report cannot be approved again: if changes are needed, return it and the PM will submit a new one.

## How to change the project status

The status (Initiation, Planning, Execution, On hold, Cancelled, Completed) changes **only through a status report** — it is not edited in the card.

1. **The PM** opens the project card → **Add status report**.
2. In **Key indicators** chooses the new **Project status** (and changes dates and % complete if needed).
3. Fills in **Reason for changing indicators** — why the status changes; the reason goes to the history.
4. Rates schedule, budget, resources, writes the summary → **Save**. The report goes for approval.
5. **The PMO** approves the report — the status in the card changes, and "Report approval" and "Updated by status report" rows appear in the history ("old → new", the reason). If the PMO returns the report, the status does not change and the PM submits a new report.
6. **"Completed — move to archive"** or **"Cancelled — move to archive"** — after approval the project gets the "Archived" status and an archive date and moves to the "Archive" tab; after that it is view-only. That the project was cancelled is shown in its last status report and in the "Change history".

## Risks and issues

- Add one from the card ("Add risk", PM only) or on the "Risks and issues" tab.
- **Probability** and **impact** are 1 to 5; the **score** = probability × impact: 15–25 — high (red), 8–14 — medium (yellow), 1–7 — low (green).
- **Response strategy:** Avoid, Reduce (mitigate), Transfer, Accept (clicking the selected one again clears the choice).
- **Risk reduction actions** — what we do now; **Contingency plan** — what we do if the risk occurs.
- Set the risk owner, status (Open, In progress, Closed) and the **Mitigation due date**. An overdue open risk is shown in red.
- "Show: High risks" — open risks with a score of 15 and above.

## Comments

Anyone who sees the project can comment: in the card — "Comments" → "Add comment".

## New project and editing

- A **New project** is created by the PMO: the name and the PM are required (the PM is not prefilled — choose one); the project number is assigned by the system in order (PRJ-001, PRJ-002…) — it is unique and cannot be changed by hand.
- Only the PM can **Edit** the card: name, department, priority, owner, budget, description, and also:
  - **Project team** — "+ Add member": a person, their **role** (required) and what to contact them about; × removes the member;
  - **Links** — "+ Add link": a name and an address (starting with `https://`); × removes it.
- Status, health, dates and costs change only through a status report (see "How to change the project status").
- After the team changes, access rights are recalculated automatically: team members see the project and can comment.

## Archive

The "Archive" tab lists completed projects with their archive date, view-only. Navigation is the same as in "Projects": **List** or **Tiles**, "Show" (All projects, Strategic, My projects), CSV and column choice; tiles show the archive date.

## Language and theme

Top right: **UA / EN / RU** and the light ☀ / dark ☾ theme. The choice is remembered in this browser. Values (statuses, health, types, priorities, departments, approval) and the names in "Show" are translated with the interface; record content stays as entered.

## When changes appear

Anything you save in the forms appears on screen immediately; so do PMO decisions on reports. Access rights (including for new team members), the change history and "Card access" update automatically within ~15 minutes.

## Feedback

The **Feedback** tab → **Leave feedback** (or the "Feedback" button in Help): describe what is wrong or what could be better and add up to 5 screenshots:
- on a computer — take a screenshot and paste it into the form: **Ctrl+V** (Windows) or **Cmd+V** (Mac); or use "Add screenshot";
- on a phone or tablet — "Add screenshot" → gallery or camera.

Your device is added automatically; in the text, say on which screen you noticed the problem.

The **Feedback** tab lists all participants' feedback: the text, the author, the review status (New, Accepted, Done, Commented, Rejected) and the developers' answer. Screenshots are visible only to the author and the developers. The status and the answer are set by the solution's developers.

## Tasks for the focus group

Do what applies to your role and after each task leave **feedback**: what was unclear, inconvenient or did not work.

1. Open the portal on a computer and on a phone. Is it clear from the home page what is happening with the portfolio? Click the key figures and a risk map cell.
2. Find your projects ("Show: My projects"). Are all your projects there, and nothing extra?
3. Open a project card: team, links, timeline, change history, access. What is missing?
4. **PM:** add a team member with a role and a link to a document.
5. **PM:** submit a status report that changes the completion date (with a reason) and check that the card is waiting for approval.
6. **PMO:** approve one report with a changed rating (with a comment) and return another one for rework.
7. **PM:** submit a new report from the returned one ("New report based on the returned one").
8. **PM:** add a risk with a response strategy, risk reduction actions and a contingency plan.
9. **Everyone:** add a comment to a project where you are the owner or on the team; look through the "Feedback" tab.
10. Switch the language and theme; send feedback with a screenshot from your phone.
