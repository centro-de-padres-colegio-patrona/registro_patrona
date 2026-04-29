const FlowApi = require('./FlowApi');
const flow = new FlowApi();

app.post('/api/crear_orden', async (req, res) => {
    try {
        const params = {
            commerceOrder: "1001",
            subject: "Pago de Cuota CPA",
            currency: "CLP",
            amount: 20000,
            email: "cliente@correo.com",
            urlConfirmation: "https://tu-sitio.com/confirmacion",
            urlReturn: "https://tu-sitio.com/retorno"
        };

        const result = await flow.send("payment/create", params, "POST");
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});