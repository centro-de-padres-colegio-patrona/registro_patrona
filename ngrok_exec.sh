#!/bin/bash

set -x
set -e

ngrok config add-authtoken 3D3xkgV2VMiomUGPXxquBggmLpf_6M6G24dUoDRBvVmmVjqev
ngrok http 5001
