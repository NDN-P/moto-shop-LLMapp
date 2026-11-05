# Report screenshots

Both images were captured on 25 October 2026 from the production build in shop mode, against a read-only backup copy of the real shop database, in a 1000 px wide window at 2x density, cropped to the page's main content:

- `inventory.png`: Inventory page. The SKU and supplier columns are hidden before capture because SKUs encode private cost data.
- `assistant.png`: Shop assistant with the **Shop inventory** badge and a completed answer to "Which parts are low on stock?" with its sources.

Keep passwords, API keys, SKUs and supplier details out of the images. Do not substitute generated interfaces or a saved answer presented as a live response.

Then run `tectonic -X compile report/moto-shop-report.tex --outdir output/pdf` from the app folder and inspect the resulting PDF before submission.
