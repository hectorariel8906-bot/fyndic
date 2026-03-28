export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { content, bank, filename } = req.body
  
  if (!content) {
    return res.status(400).json({ error: 'No content provided' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' })
  }

  // Mapeo de cuentas para contexto
  const accountMap = {
    'itau-ca': 'Itaú Pesos HH901',
    'itau-usd': 'Itaú USD 9101',
    'itau-visa': 'Itaú Crédito HH8015',
    'oca': 'Oca Crédito HH5400',
    'brou-pesos': 'BROU HZ Pesos',
    'brou-usd': 'BROU HZ USD'
  }

  const accountName = accountMap[bank] || bank

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `Sos un extractor de datos bancarios para Uruguay. Analizá este estado de cuenta de ${accountName} y extraé las transacciones.

Reglas:
1. Fecha en formato DD/MM/YYYY
2. Amount solo número (positivo para cargos, negativo para abonos si el extracto lo muestra así, o positivo con type correcto)
3. Type: "e" (gasto/egreso), "i" (ingreso), "t" (transferencia entre cuentas propias)
4. Currency: "UYU" o "USD"
5. Detectá si es Transferencia (t), Ingreso (i) o Gasto (e) según el contexto
6. Para tarjetas de crédito, si dice "PAGO TARJETA" o similar, es tipo "t" (transferencia/pago)

Respondé ÚNICAMENTE con este JSON válido (sin markdown, sin explicaciones):
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "Nombre limpio",
      "amount": 1234.56,
      "type": "e",
      "currency": "UYU",
      "parent_category": "Alimentación",
      "category": "Supermercado",
      "account": "${accountName}"
    }
  ]
}

Categorías disponibles y sus subcategorías:
- Alimentación: Supermercado, Restaurante, Panadería
- Vivienda: Alquiler, Servicios
- Transporte: Combustible, Taxi
- Salud: Farmacia, Médico
- Entretenimiento: Salidas, Cine
- Suscripciones: Netflix, Spotify, Otro
- Compras: MercadoLibre, Amazon, Otro
- Gastos financieros: Seguro, Comisión
- Ingresos: Sueldo, Freelance, Otro
- Transferencia: Interna, Pago tarjeta
- Otro: Sin categorizar

Contenido del extracto:
${content.substring(0, 15000)}`
        }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Claude API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    
    // La respuesta de Claude viene en content[0].text como string
    let text = data.content[0].text
    
    // Limpiar posible markdown ```json ... ```
    text = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim()
    
    // Extraer solo el objeto JSON si hay texto adicional
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta de Claude')
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // Validar estructura mínima
    if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
      throw new Error('Respuesta sin campo transactions')
    }

    // Limpiar y validar cada transacción
    parsed.transactions = parsed.transactions.map(tx => ({
      date: tx.date || new Date().toLocaleDateString('es-UY'),
      description: (tx.description || 'Sin descripción').substring(0, 100),
      amount: Math.abs(parseFloat(tx.amount) || 0),
      type: ['i', 'e', 't'].includes(tx.type) ? tx.type : 'e',
      currency: tx.currency === 'USD' ? 'USD' : 'UYU',
      parent_category: tx.parent_category || 'Otro',
      category: tx.category || 'Sin categorizar',
      account: tx.account || accountName
    }))

    return res.status(200).json(parsed)
    
  } catch (error) {
    console.error('Process error:', error)
    return res.status(500).json({ 
      error: error.message,
      details: 'Error procesando con Claude. Verificá tu ANTHROPIC_API_KEY.'
    })
  }
}