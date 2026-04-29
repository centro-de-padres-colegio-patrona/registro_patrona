#!/bin/bash

set -x
set -e

# simpleParams:  {
#  apiKey: '7FEF32BF-B9D3-4DA8-A190-9422737A5LCD',
#  s: 'e6122af1b954ded984ecbbe3c61330150ffe491b10dd583f908d1d90a75f5db4'
#}

TU_API_KEY=7FEF32BF-B9D3-4DA8-A190-9422737A5LCD
FIRMA_GENERADA=e6122af1b954ded984ecbbe3c61330150ffe491b10dd583f908d1d90a75f5db4

curl -G https://sandbox.flow.cl/api/payment/getTypes \
     -d "apiKey=${TU_API_KEY}" \
     -d "s=${FIRMA_GENERADA}"
