# What's new

## 1.7.11.0 · 02.11.2026

**New**
- **"Countries and CEOs"** (for the PMO, menu under the avatar): the directory of project countries: add a country with names in three languages, assign or change the country CEO, set the order, deactivate a country. New countries appear in the "Country" choice right away; a new CEO gets access within ~15 minutes.

## 1.7.10.4 · 02.11.2026

**Changed**
- The hint under «Not done from the plan and why» now points to the «The plan is fully done» checkbox instead of «say so».

## 1.7.10.3 · 02.11.2026

**Changed**
- The AI assistant («Fill with AI») suggests the «Budget» rating by the PMO rule: cost forecast up to 9% over budget — yellow, 10% and more — red (#137).

## 1.7.10.2 · 02.11.2026

**Changed**
- «Detailed system overview»: the new view name «High risks and issues».

## 1.7.10.1 · 02.11.2026

**Changed**
- Technical update: test and production versions aligned, no changes in how the portal works.

## 1.7.10.0 · 02.11.2026

**Changed** (PMO decisions on R8 testing feedback)
- «Budget» rating: in the «Initiation» and «Planning» phases you can choose «Not rated» — overall health is then calculated from the other two ratings (#121, #123).
- A hint under the «Budget» rating by the PMO rule: cost forecast up to 9% over budget — yellow, 10% and more — red; a greener rating shows a warning (#137).
- Unknown amounts stay empty instead of «0»; calculations treat an empty amount as 0 (#111).
- «Cost to date» — all project costs together, since the project start (#122).
- The risk owner is required; by default — the project PM (#129).

## 1.7.9.0 · 02.11.2026

**New** (R8 testing feedback)
- Status report: the project's open risks and issues are shown right in the form; hints when the forecast completion date has passed, the cost to date is lower than approved, or the project goes to the archive with open risks (#124, #125, #127, #134).
- "The plan is fully done" checkbox — no need to type "All done" by hand (#120).
- Changing the project in a form that already has text, and closing an unsaved report, now ask first, so the text is not lost or moved to another project (#133, #134).
- A report view shows the budget, cost and cost forecast as of the report date, even if the report did not change them, and "Planned" — the previous report's plan (#135, #136).

**Changed**
- "High risks and issues" — the new name of the view and the home page indicator: issues with a score of 15+ are there too (#128).
- "Decision needed" — only the request from the project's latest report: a new report clears the previous request (#132).
- A risk of an archived project explains: "The project is archived — the risk is view-only" (#118).

## 1.7.8.1 · 02.11.2026

**Fixed** (tests reconciled with all handled feedback)
- On a phone, amount fields open a keyboard with a comma — cents can be typed (#131).
- Columns menu: the first column can no longer be moved down — the order «strategic, priority, title» stays (#49).

## 1.7.8.0 · 02.11.2026

**Fixed** (R8 testing feedback)
- Amounts with cents: «1450,50» in the budget, cost and forecast now rounds to $1,451 instead of becoming $145,050 (#131).
- Risk or issue: when switching the type, each type keeps its own description — back on «Risk», you see the risk description (#130).
- An invalid date (e.g. 31.11.2026) no longer disappears silently: it stays in the field with an explanation, and the form is not saved until the date is fixed (#119).
- On iPhone the calendar button next to a date opens the date picker (#116).
- On a phone an overdue due date of an open risk is red, as in the table (#114).
- «Portfolio health over time»: the «today» column matches the «Portfolio by health» ring — the card state counts, not an approved report that was not applied to the card (#117).
- «Change history»: a risk created and closed within a few minutes now shows both «Added» and «Closed» (#115).
- AI assistant («Check with AI»): a plan item explained in «Not done from the plan and why» is no longer reported as missing (#112).

**Please re-check**
- Typing amounts with cents; switching «Risk ↔ Issue»; the date 31.11; the calendar on iPhone; red risk due dates on a phone; «Portfolio health over time» and the ring on the home page.

## 1.7.7.9 · 28.10.2026

**Changed**
- Help: new section «External project participant» — how to add a person from outside the company (a helpdesk request, then search by the full e-mail address). The people search hints say the same.

## 1.7.7.8 · 28.10.2026

**Fixed**
- An external participant (guest) who is not yet on the site can now be found by their full e-mail address — the search used to show «Not found».

## 1.7.7.7 · 26.10.2026

**Fixed**
- The people search shows «Not found in the organization» when nobody matches. A team member not selected from the list is no longer reported as a missing role — the portal explains that the person must be selected from the search or first invited to the organization.

## 1.7.7.6 · 26.10.2026

**Fixed**
- An external participant (a guest of the organization) can now be added to the project team or assigned as PM, owner or risk owner. If the person is not yet in the organization, the portal explains that the Microsoft 365 administrator must invite them first.

## 1.7.7.5 · 21.10.2026

**Changed**
- "Help" and "Detailed system overview" — country, budget and cost forecast, plan vs actual; the AI assistant — the more reports, the more useful.

## 1.7.7.4 · 21.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.7.3 · 21.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.7.2 · 21.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.7.1 · 21.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.7.0 · 21.10.2026

**New**
- **Budget works like the schedule.** In the status report: **Budget (plan)** and **Cost at completion forecast** ("at the current spending rate" hint); a change needs a reason and reaches the card after PMO approval; the card shows the forecast and the deviation from the budget. **Plan vs actual:** "Planned" from the last approved report and **Not done from the plan and why** (required if there was a plan); the AI assistant takes it into account when checking.

## 1.7.6.0 · 21.10.2026

**New**
- Project **Country**: the PMO chooses it when creating a project and later changes it with "Change PM / owner / country". The **country CEO** sees the projects of their countries and can comment. **Country** column in "Projects" and "Archive"; **Portfolio by country** on the home page.

## 1.7.5.4 · 28.10.2026

**Fixed**
- An external participant (guest) who is not yet on the site can now be found by their full e-mail address — the search used to show «Not found».

## 1.7.5.3 · 26.10.2026

**Fixed**
- An external participant (a guest of the organization) can now be added to the project team or assigned as PM, owner or risk owner. The people search shows «Not found» when nobody matches, and a team member not selected from the list is no longer reported as a missing role. For guests, the administrator must invite the person to the organization and allow guests on the site.

## 1.7.5.2 · 20.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.5.1 · 20.10.2026

**Changed**
- System name: **PPM — Project Portfolio Management**.

## 1.7.5.0 · 19.10.2026

**New**
- **Parent project** on the card: a link between projects (any nesting; the project itself and its children cannot be chosen). The card shows a link to the parent and a **Child projects** list; «Projects» has a **Parent project** column. Changes appear in «Change history». For linking only for now, analytics later.

## 1.7.4.7 · 18.10.2026

**Changed**
- On a phone the avatar menu opens right under it, not at the bottom of the screen.

## 1.7.4.6 · 18.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.4.5 · 18.10.2026

**Changed**
- On a phone: a single-row header, only the section menu stays when scrolling; language and theme — in the menu under the avatar. Filter and column windows open at the bottom, with «Default» and «Reset widths» at the top of the window (#107). The approval block in the report view no longer overlaps the title (#97). A report card in the list shows the PM, date and health first (#99). «Feedback» — as cards (#102).

**Please re-check**
- On a phone: the header, the avatar menu, filters and columns in lists, report approval, «Feedback».

## 1.7.4.4 · 17.10.2026

**Fixed**
- «Detailed system overview»: tables wrap text — no sideways scrolling.

## 1.7.4.3 · 17.10.2026

**Fixed**
- «AI assistant» turns on the first time: the Microsoft sign-in window opens right after «Allow»; on a phone, sign-in goes to the Microsoft page and back, and turning on finishes by itself. If it fails, the reason is shown (sign-in window blocked, sign-in not completed, AI error with a code); on the test site the failure is recorded in «Feedback».

**Changed**
- «AI assistant» is kept for you, not for the browser: turned on on your phone — it is on on your computer too.

## 1.7.4.2 · 17.10.2026

**New**
- The **↻ «Refresh data»** button above lists (next to «CSV») — fresh data without reopening the page, handy on a phone (#103).

**Changed**
- «What's new»: the current version at the top; consecutive technical updates are collected in one collapsed block; each release with changes expands by tapping its title, the «New / Changed / Fixed» sections are highlighted (#95).
- Project card: «Goal and description» is required when the PM saves the card (including projects created earlier — at the next save) (#96).
- Project card: «Priority» is in «General», next to the department, with a hint on how priority differs from type; definitions in «Help» (#105).
- Status report view: the responsible PM under the title (#98).
- The SharePoint search in the grey bar is hidden: on a phone it zoomed the page (#106).

**Fixed**
- Feedback is sent on the first try: on a connection failure the portal retries itself, pressing «Send» again does not create a duplicate; sent feedback is visible in the list right away (#108, #103).

## 1.7.4.1 · 14.10.2026

**Changed**
- «Detailed system overview» in «Help»: a new «AI assistant (pilot)» section; data security and project status now cover the assistant.

## 1.7.4.0 · 14.10.2026

**New**
- AI assistant for pilot participants: the «AI assistant» switch in the avatar menu (consent once, when turning it on); in the status report form — «Fill with AI» (draft, «Don't forget», suggested ratings) and «Check with AI» (contradictions between the report and project data); the «Contradictions (AI analysis)» field is visible in the report and during approval. Details — «Help», section «AI assistant (pilot)».

## 1.7.3.13 · 14.10.2026

**Changed**
- Approval badges («Awaiting approval», «Approved», «Returned») are on one line again; «Returned for rework» is now «Returned».

## 1.7.3.12 · 14.10.2026

**Changed**
- The «Projects», «Status reports», «Risks» and «Archive» tables fit the window without horizontal scrolling: the page is wider (up to 1440 px), long headers and badges wrap, the rating columns' filter goes under the title when space is short.

## 1.7.3.11 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.3.7 · 14.10.2026

**Changed**
- The «Accept» and «Show record» buttons in the AI assistant hints are now outlined.
- Names in the «PM» and «Author» columns no longer break mid-word onto a third line.

## 1.7.3.1 · 14.10.2026

**New**
- "Copy risk" / "Copy issue" in a saved record: a new record opens with all fields — change what you need and save, then close the original (#92).
- The PMO gets new high risks (15+) and all issues, and their status changes, in the bell (#87).

**Changed**
- Risk: "Response strategy", "Risk reduction actions" and "Contingency plan" are required at any score; issue — description and actions. Required fields are marked *, the explanation is next to the field (#91, #88).
- A saved risk or issue can only change its status; other fields — via "Copy" (#92).
- The new record form explains how risks are handled: they are not approved, the PMO sees them in notifications, feedback is a comment in the card (#87).
- "Detailed system overview" in Help: the risks and notifications sections follow the risk decisions.

**Check again**
- A new risk without strategy, actions or contingency plan — errors next to the fields; a new issue — only description and actions.
- A saved risk: only "Status" can be changed; "Copy risk" opens a new record with all fields.
- PMO: about 15 minutes after a new high risk or issue from a PM, or its status change — an event in the bell.

## 1.7.2.31 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.30 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.29 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.28 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.27 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.26 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.25 · 14.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.24 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.23 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.22 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.21 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.20 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.19 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.18 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.17 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.16 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.15 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.14 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.13 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.12 · 13.10.2026

**Changed**
- Technical update with no changes to how the portal works.

## 1.7.2.11 · 13.10.2026

**Changed**
- The report freshness dot tooltip: yellow — 9–14 days (was "8–14"), as the portal calculates it.

## 1.7.2.10 · 12.10.2026

**New**
- Notification "You were added to the project team" with your role, and when your role in the team changes (#84).
- Long tables scroll in their own window: column headers stay pinned, the horizontal scroll bar is always visible at the bottom of the table (#89).
- The portal version and "What's new" are in Help (the **?** button) (#90); the bell announces a new release.
- Bell: "Feedback reviewed" — when the status of or answer to your feedback changes.
- The project card shows the three latest status reports and "Show all reports (N)" (#82).

**Changed**
- "Report" column: the approval label and the date form one block, the date on its own line; tooltip "Submitted … · author" (#85).
- The report field "Issues and risks" → "Issues and risks for the period", with a hint where the risk register is (#81).
- Risk "Mitigation due date": for a new record — not earlier than today, when changed — not earlier than the registration date; an overdue one is marked "The due date has passed" (#88).
- No empty space in the menu after "Feedback"; the project form says team members get access within ~15 minutes (#83).

**Re-check**
- Add a member to a project team — within ~15 minutes their bell shows "You were added to the team".
- Risk form: a due date earlier than today (new record) — an error next to the field.
- Long lists: column headers and the horizontal scroll bar stay visible.
- Bell: "New portal release" opens "What's new"; the feedback author gets "Feedback reviewed" after the status or answer changes.
- Project card: the three latest reports and "Show all reports (N)"; "Report" column — tooltip "Submitted … · author".

## 1.7.2.1 · 08.10.2026

**Changed**
- The report submission date is the day it is saved, the period is calculated (#62, #69).
- Report form checks: actual completion, description of the decision needed (#64, #67, #68).
- Project "Status" → "Project phase"; phase and type are written to every report (#77, #78).
- "Report" column — approval of the newest report, filter by approval (#73); "Goal and description" — up to 10 lines (#71); buttons on the phone (#72).

## 1.7.1 · 08.10.2026

**New**
- Notifications: a bell with the number of new events in your projects, "Mark all as read".
- Archive by phase "Completed" / "Cancelled", views "Completed" / "Cancelled".
- Section icons in the menu, a coloured label in every side window.

## 1.7.0 · 04.10.2026

**New**
- "Assignment": only PMO changes the PM and the owner (#43).
- Risk form: type first, then description (#47, #55); actual completion date (#54).
- Sync runs in Azure Automation.
