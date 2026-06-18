
import { MercadoPagoConfig, Order } from "mercadopago";

const Config = {
        'production': {
            APIKEY: 'APP_USR-7274724f-cbd4-4f56-8478-7023ee480857',
            SECRETKEY: 'aefc24bed6613e40db09df328849568a220085ca',
            APIURL: ''
        },
        'sandbox': {
            APIKEY: 'APP_USR-7274724f-cbd4-4f56-8478-7023ee480857',
            SECRETKEY: 'APP_USR-5125226598398616-061717-deb2d0807c31471873fa7b9b821eccbf-3479686713',
            APIURL: '',
            APPNUMBER: '5125226598398616',
            USERID: '3479686713',
            USUARIO_DE_PRUEBA: 'TESTUSER1357645298606034860',
            PASSWORD_DE_PRUEBA: 'PJQr2SEYbp',
            COD_VERIFICACION: '686713'
        }
};

class MercadoPagoApi {
        constructor(apiKey = null, secretKey = null, endpoint = 'sandbox') {
        this.apiKey = apiKey || Config[endpoint].APIKEY;
        this.secretKey = secretKey || Config[endpoint].SECRETKEY;
        this.apiUrl = Config[endpoint].APIURL;

        // Step 2: Initialize the client object
        const client = new MercadoPagoConfig({
            accessToken: this.secretKey,
            options: { timeout: 5000 },
        });
    }

    /**
     * Setea las llaves manualmente
     */
    setKeys(apiKey, secretKey) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }
}

// Step 3: Initialize the API object
const order = new Order(client);

// Step 4: Create the request object
const body = {
	type: "online",
	processing_mode: "automatic",
	total_amount: "1000.00",
	external_reference: "ext_ref_1234",
	payer: {
		email: "<PAYER_EMAIL>",
	},
	transactions: {
		payments: [
			{
				amount: "1000.00",
				payment_method: {
					id: "master",
					type: "credit_card",
					token: "<CARD_TOKEN>",
					installments: 1,
					statement_descriptor: "Store name",
				},
			},
		],
	},
};

// Step 5: Create request options object - Optional
const requestOptions = {
	idempotencyKey: "<IDEMPOTENCY_KEY>",
};

// Step 6: Make the request
order.create({ body, requestOptions }).then(console.log).catch(console.error);