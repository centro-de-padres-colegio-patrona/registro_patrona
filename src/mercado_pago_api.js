const { MercadoPagoConfig, Preference } = require('mercadopago');

const Config = {
  production: {
    ACCESS_TOKEN: 'APP_USR-5125226598398616-061717-deb2d0807c31471873fa7b9b821eccbf-3479686713',
  },
  sandbox: {
    ACCESS_TOKEN: 'APP_USR-5125226598398616-061717-deb2d0807c31471873fa7b9b821eccbf-3479686713',
  }
};

class MercadoPagoApi {
  constructor(endpoint = 'sandbox') {
    this.accessToken = Config[endpoint].ACCESS_TOKEN;
    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: { timeout: 5000 }
    });
    this.preference = new Preference(this.client);
  }

  /**
   * Crea una preferencia de pago en Mercado Pago.
   * @param {object} params - { title, amount, email, externalReference, backUrls }
   * @returns {object} - { id, init_point, sandbox_init_point }
   */
  async createPreference({ title, amount, email, externalReference, backUrls }) {
    const body = {
      items: [
        {
          title: title || 'Pago CPA Colegio Patrona',
          quantity: 1,
          unit_price: parseInt(amount),
          currency_id: 'CLP'
        }
      ],
      payer: {
        email: email
      },
      external_reference: String(externalReference),
      back_urls: {
        success: backUrls.success,
        failure: backUrls.failure,
        pending: backUrls.pending
      },
      statement_descriptor: 'CPA Patrona'
    };

    console.log('[MercadoPagoApi] Creando preferencia:', JSON.stringify(body));
    const result = await this.preference.create({ body });
    console.log('[MercadoPagoApi] Preferencia creada:', result.id);
    return result;
  }
}

module.exports = MercadoPagoApi;
