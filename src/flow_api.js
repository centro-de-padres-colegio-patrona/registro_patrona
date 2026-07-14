const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

// Nota: Asumo que tienes un archivo de configuración similar al Config.class.php
// Si no, puedes pasar las keys directamente al constructor.
/*const Config = {
    APIKEY: '7FEF32BF-B9D3-4DA8-A190-9422737A5LCD',
    SECRETKEY: 'aefc24bed6613e40db09df328849568a220085ca',
    //APIURL: 'https://www.flow.cl/api' // O la URL que corresponda
    APIURL: 'https://sandbox.flow.cl/api'
};*/

const Config = {
        'production': {
            APIKEY: '7FEF32BF-B9D3-4DA8-A190-9422737A5LCD',
            SECRETKEY: 'aefc24bed6613e40db09df328849568a220085ca',
            APIURL: 'https://www.flow.cl/api' // O la URL que corresponda
        },
        'sandbox': {
            APIKEY: '50820F32-D480-4CDB-9B04-4330L4590A18',
            SECRETKEY: '3217d34ab37f4b3a328a3b8009f44dec50b0cca4',
            APIURL: 'https://sandbox.flow.cl/api'
        }
};

class FlowApi {
    constructor(apiKey = null, secretKey = null, endpoint = 'sandbox') {
        this.apiKey = apiKey || Config[endpoint].APIKEY;
        this.secretKey = secretKey || Config[endpoint].SECRETKEY;
        this.apiUrl = Config[endpoint].APIURL;
    }

    /**
     * Setea las llaves manualmente
     */
    setKeys(apiKey, secretKey) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }

    /**
     * Firma los parámetros (Equivalente a sign en PHP)
     */
    sign(params) {
        const keys = Object.keys(params).sort();
        let toSign = "";

        keys.forEach(key => {
            toSign += key + params[key];
        });

        // HMAC SHA256
        return crypto
            .createHmac('sha256', this.secretKey)
            .update(toSign)
            .digest('hex');
    }

    /**
     * Envía la petición al servicio
     */
    async send(service, params, method = "GET") {
        method = method.toUpperCase();
        const url = `${this.apiUrl}/${service}`;
        
        // Agregar apiKey a los parámetros y firmar
        const signedParams = { 
            apiKey: this.apiKey, 
            paymentMethod:9, 
            timeout: 900,
            merchantId: 'colegio-patrona-registro',
            ...params };
        signedParams.s = this.sign(signedParams);

        console.log('send params: ', signedParams);
        try {
            let response;

            if (method === "GET") {
                // En GET usamos query strings
                response = await axios.get(url, { params: signedParams });
            } else {
                // En POST, Flow espera x-www-form-urlencoded
                const formData = querystring.stringify(signedParams);
                console.log('formData: ', formData);
                const body = new URLSearchParams(signedParams).toString();
                console.log('body: ', body);
                response = await axios.post(url, body /*formData*/, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
            }
            //Concatenar la respuesta con los parámetros enviados para tener un registro completo
            const allParams = {...signedParams, ...response.data, status: response.status, statusText: response.statusText};
            //return { payment_create_response: response.data, status: response.status, statusText: response.statusText, allParams };
            return allParams;

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                // Flow maneja 400 y 401 como errores de negocio con cuerpo JSON
                if ([400, 401].includes(status)) {
                    return error.response.data;
                }
                throw new Error(`Unexpected error occurred. HTTP_CODE: ${status}`);
            }
            throw new Error(error.message);
        }
    }
}

module.exports = FlowApi;