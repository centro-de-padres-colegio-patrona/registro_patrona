#!/bin/bash

set -e
set -x

mongodump --uri="mongodb+srv://<username>:<password>@<cluster>/<database>?authSource=admin" --db=<database> --collection=cpa_patrona_2026 --out=/path/to/backup

mongodump --uri="mongodb+srv://<username>:<password>@<cluster>/<database>?authSource=admin" --db=<database> --collection=cpa_patrona_2026 --archive=/path/to/cpa_patrona_2026.archive
