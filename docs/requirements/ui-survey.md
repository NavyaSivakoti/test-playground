# Customer survey (/ui/survey)

**Purpose:** a data-driven target (public/fixtures/testdata/survey.csv: case, stars, nps, recommend, comment) covering every common question type, branching and a timer.

## User stories
- As a respondent I answer single/multiple choice, a star rating, a 0–10 scale and an agreement matrix.
- As a respondent who would not recommend the product, I am asked what to improve.
- As a respondent I see how much time is left and get a score after submitting.

## Acceptance criteria
- Star rating is a radiogroup ("1 star" … "5 stars"); arrow keys, Home and End change the value; state.answers.stars.
- The 0–10 scale is a set of radios labelled "0" … "10"; state.answers.nps.
- Each matrix cell is a radio labelled "<statement>: <option>"; state.answers.likert.
- Given "Would you recommend us?" = No, then "What should we improve?" is shown (state.answers.improve); given Yes, "What do you like most?" is shown instead.
- When I click "Submit" without stars, score or recommend, then "Please answer all required questions" shows; state.missing lists them.
- When I submit valid answers, then a Results section shows "Score: X / 100" with X = stars × 12 + nps × 4 (CSV rows happy/neutral/unhappy → 96/60/20) and a category (Promoter ≥ 9, Passive 7–8, Detractor ≤ 6); a `survey` record is created.
- The countdown starts at 05:00 (or `timerSec`) using the frozen clock; at 0 "Time is up" shows, Submit is disabled and state.timedOut = true.

## Trap params
`timerSec`, `now`, `variant=b` ("Submit survey", "What could we do better?", reversed first question options), `unstableIds`, `unstableClasses`, `duplicateLabels`.
