# Report screenshots

Start the app with the invented demo database and `ASSISTANT_DATA_MODE=sample`, as described in the main README. Sign in and save genuine screenshots of these pages:

- `inventory.png`: Inventory with sample product names, prices and stock visible.
- `assistant.png`: Shop assistant with the **Sample catalog** badge and, preferably, a completed answer with its sources visible.

JPEG files named `inventory.jpg` and `assistant.jpg` are also accepted. Use a landscape desktop view with readable text. Keep passwords, API keys and real business records outside the images. Do not substitute generated interfaces or a saved answer presented as a live response.

Then run `tectonic -X compile report/moto-shop-capstone-report.tex --outdir output/pdf` from the app folder and inspect the resulting PDF before submission. The report crops fixed regions of both images, so recapture at 1440 px width.
