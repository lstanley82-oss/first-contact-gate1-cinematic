# Operation First Contact: Gate 1 Mission

A realtime, teacher-hosted team game for the Grade 8 ELA First Contact Onboarding Manual and Gate 1: Word Function.

## What is included

- 15 fixed questions arranged in five difficulty bands.
- Tiered scoring: 100, 200, 300, 400, and 500 points.
- 2 to 6 teams, with one captain device per team.
- 30-second response window.
- Teacher-controlled +10 second extension.
- Automatic answer locking and scoring.
- Leaderboard after every question.
- Correct and incorrect visual feedback.
- Cinematic FBI / alien-contact interface.
- Synthesized ambient sci-fi audio and event sounds through the browser.
- Host recovery controls for restarting, skipping, going back, releasing a team, reopening responses, and ending early.
- Unique 6-digit mission rooms so multiple teachers can host independent classes at the same time.

## Backend

The game uses Supabase Realtime Broadcast only. It does not require database tables.

The included `config.js` is already configured with the Supabase project and publishable browser key used for the first First Contact multiplayer test.

Do not replace the publishable key with a Supabase secret key or service-role key.

## Files

- `index.html` : app structure
- `styles.css` : cinematic visual design and animations
- `app.js` : multiplayer game logic, teacher controls, scoring, timer, and sound
- `questions.js` : the 15-question Gate 1 question bank
- `config.js` : Supabase Project URL and publishable key
- `field-agent.png` : cinematic FBI eagle field-agent art
- `scene-landing.jpg` : mission launch environment
- `scene-host.jpg` : teacher briefing-room environment
- `scene-player.jpg` : student incoming-transmission environment
- `scene-final.jpg` : results / mission-complete environment

Keeping the questions in `questions.js` makes later question edits much easier without rewriting the rest of the game.

## Recommended GitHub deployment

Create a new public GitHub repository, for example:

`first-contact-gate1-mission`

Upload all eleven files listed above to the repository root.

Then go to:

`Settings > Pages > Build and deployment`

Choose:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

Save and wait for GitHub Pages to publish the site.

The same published URL is used by teachers and students.

## Classroom flow

1. Teacher opens the site and chooses **Enter Briefing Room**.
2. Choose 2 to 6 teams and edit names if desired.
3. Enable Mission Audio on the teacher computer if desired.
4. Create the mission room.
5. Project the 6-digit code.
6. One captain device per team opens the same URL and enters the code.
7. Each captain selects the assigned team.
8. Teacher chooses **Initiate First Contact**.
9. Teacher opens each transmission. The 30-second timer begins automatically.
10. Teams discuss, choose an answer, and the captain selects **Submit Analysis**.
11. Teacher reveals the analysis. Correct teams receive the question's point value automatically.
12. Teacher shows the Field Performance Report after every question.
13. Continue through all 15 transmissions.
14. The final screen displays Gate 1 readiness completion and final standings.

## Simultaneous classes

Each host receives a separate 6-digit room code. Two teachers can open the same published site and run separate games at the same time. The app also checks for an already-active host before accepting a newly generated room code.

## Audio behavior

Audio is generated in the browser with the Web Audio API, so there are no separate sound files to host.

The teacher computer provides:

- sparse eerie alien-contact ambience with shifting radio texture
- mission-start tone
- incoming-transmission tone
- final-five-second countdown ticks
- answer-reveal confirmation
- incorrect-response warning when applicable
- leaderboard cue
- final victory cue

Browsers require a user click before audio can begin, so use **Enable Mission Audio** before launching the mission.

## Question editing

All questions are stored in `questions.js`.

Each question includes:

- difficulty level
- clearance label
- point value
- category
- question text
- four answer choices
- correct answer index
- explanation

If the question bank changes later, edit that file while leaving the multiplayer engine unchanged.


## Audio tuning
This build includes an audible browser-generated ambient command-center bed and confirmation tones tuned for typical laptop speakers.


## Visual pass v2.3
This version adds dedicated cinematic scene backgrounds, a full FBI briefing-room host layout, a signal-analysis student console, and a mission-complete results environment designed to closely match the approved Style A concept.

## Previous visual pass v2.2
This package includes the approved cinematic Style A visual overhaul embedded directly inside `styles.css`. The gameplay logic is unchanged from v2.1. No separate image asset uploads are required for the visual pass.


## Answer-position balance
The 15 correct answers are deliberately distributed across A/B/C/D as 4 / 4 / 4 / 3, with no long repeated-answer pattern.
