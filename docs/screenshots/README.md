# Report screenshots

Start the app with the invented demo database and `ASSISTANT_DATA_MODE=sample`, as described in the main README. Sign in and save genuine screenshots of these pages:

- `inventory.png`: Inventory with sample product names, prices and stock visible.
- `assistant.png`: Shop assistant with the **Sample catalog** badge and, preferably, a completed answer with its sources visible.

JPEG files named `inventory.jpg` and `assistant.jpg` are also accepted. Use a landscape desktop view with readable text. Keep passwords, API keys and real business records outside the images. Do not substitute generated interfaces or a saved answer presented as a live response.

Then install `requirements-report.txt` and run `python scripts/build_report.py` from the app folder. The builder checks both image files before replacing the report, and validates seven pages with at least two embedded images. Inspect the resulting PDF before submission.
