export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { content, bank, filename } = req.body

  if (!content || !bank) {
    return res.status(400).json({ error: 'Faltan parámetros' })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key no configurada' })
  }

  const bankDescriptions = {
    'itau-ca': 'Itaú Uruguay - Caja de Ahorro en Pesos. Columnas: Fecha, Concepto, Débito, Crédito, Saldo.',
    'itau-usd': 'Itaú Uruguay - Caja de Ahorro en Dólares. Columnas: Fecha, Concepto, Débito, Crédito, Saldo.',
    'itau-visa': 'Itaú Uruguay - Tarjeta Visa de Crédito. Formato PDF con columnas: Fecha, Tarjeta, Detalle, Cuotas, Importe $, Importe U$S.',
    'oca': 'OCA Uruguay - Tarjeta de Crédito. Formato PDF con columnas: Fecha, Tarjeta, Detalle, Cuotas, Importe U$S, Importe $.',
    'brou-pesos': 'BROU Uruguay - Cuenta en Pesos. Columnas similares a Itaú con Fecha, Descripción, Débito, Crédito.',
    'brou-usd': 'BROU Uruguay - Cuenta en Dólares. Columnas similares a Itaú con Fecha, Descripción, Débito, Crédito.',
  }

  const accountNames = {
    'itau-ca': 'Itaú Pesos HH901',
    'itau-usd': 'Itaú USD 9101',
    'itau-visa': 'Itaú Crédito HH8015',
    'oca': 'Oca Crédito HH5400',
    'brou-pesos': 'BROU HZ Pesos',
    'brou-usd': 'BROU HZ USD',
  }

  const prompt = `Eres un asistente financiero experto en bancos uruguayos. 
Tenés el siguiente estado de cuenta:
Banco: ${bankDescriptions[bank] || bank}
Cuenta en Fyndic: ${accountNames[bank] || bank}

Contenido del archivo:
${content}

Extraé TODAS las transacciones y devolvé ÚNICAMENTE un array JSON válido sin texto adicional, sin markdown, sin explicaciones.

Cada transacción debe tener:
- date: formato "M/D/YYYY" (ej: "3/14/2025")
- description: descripción limpia del comercio o concepto
- amount: número positivo (sin signos)
- type: "e" (gasto), "i" (ingreso) o "t" (transferencia entre cuentas propias o pago de tarjeta)
- currency: "UYU" o "USD"
- parent_category: categoría padre (ej: "Alimentación", "Vivienda", "Transporte", "Salud", "Entretenimiento", "Suscripciones", "Ingresos", "Transferencia", "Gastos financieros")
- category: subcategoría (ej: "Supermercado", "Restaurante", "Alquiler", "Combustible", "Farmacia", "Sueldo", "Netflix")
- account: "${accountNames[bank] || bank}"
- notes: cualquier info extra como número de cuota (ej: "Cuota 2/6")

Reglas importantes para Uruguay:
- DISCO, TIENDA INGLESA, COVADONGA, TATA, GEANT → Alimentación:Supermercado
- ANCAP, PETROBRAS, SHELL → Transporte:Combustible
- FARMASHOP, FARMACIA, TUNEL → Salud:Farmacia  
- UTE, OSE, ANTEL → Vivienda:Servicios
- NETFLIX, SPOTIFY → Suscripciones:streaming
- MERPAGO, MERCADOPAGO → Compras:MercadoLibre
- AMAZON → Compras:Amazon
- CABIFY, UBER → Transporte:Taxi
- Débitos automáticos de alquiler → Vivienda:Alquiler
- Acreditación de sueldo → Ingresos:Sueldo
- Transferencias entre cuentas propias → Transferencia:Interna
- Pagos de tarjeta de crédito → Transferencia:Pago tarjeta
- Su Pago / PAGOS en extractos de tarjeta → Transferencia:Pago tarjeta (type: "t")
- REDUC. IVA → omitir o incluir como ajuste negativo en Gastos financieros
- Seguros de vida → Gastos financieros:Seguro

Devolvé SOLO el JSON array, nada más.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error de API' })
    }

    const text = data.content[0]?.text || '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const transactions = JSON.parse(clean)

    return res.status(200).json({ transactions, count: transactions.length })
  } catch (err) {
    console.error('Error procesando:', err)
    return res.status(500).json({ error: 'Error procesando el archivo: ' + err.message })
  }
}
