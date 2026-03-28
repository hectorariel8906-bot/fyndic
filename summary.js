export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { transactions, period } = req.body
  
  if (!transactions || transactions.length === 0) {
    return res.status(400).json({ error: 'No transactions provided' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })
  }

  // Resumen estadístico para enviar a Claude (reduce tokens)
  const stats = {
    totalTransactions: transactions.length,
    totalIncome: transactions.filter(t => t.type === 'i').reduce((s, t) => s + t.amount, 0),
    totalExpense: transactions.filter(t => t.type === 'e').reduce((s, t) => s + t.amount, 0),
    categories: {}
  }
  
  transactions.filter(t => t.type === 'e').forEach(t => {
    const cat = t.parent_category || 'Otro'
    stats.categories[cat] = (stats.categories[cat] || 0) + t.amount
  })

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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analizá estas finanzas personales de Uruguay y dame insights útiles.

Datos del período ${period || 'actual'}:
- Ingresos totales: $${stats.totalIncome.toFixed(2)}
- Gastos totales: $${stats.totalExpense.toFixed(2)}
- Balance: $${(stats.totalIncome - stats.totalExpense).toFixed(2)}
- Cantidad de transacciones: ${stats.totalTransactions}

Gastos por categoría:
${Object.entries(stats.categories).map(([k,v]) => `- ${k}: $${v.toFixed(2)}`).join('\n')}

Respondé ÚNICAMENTE con este JSON válido:
{
  "headline": "Frase corta sobre la situación (ej: Gastos controlados este mes)",
  "score": 7,
  "insights": [
    {
      "type": "good|warn|info",
      "title": "Título corto",
      "body": "Descripción detallada"
    }
  ],
  "advice": "Consejo práctico específico para mejorar"
}

Reglas:
- Score: 1-10 (10 = excelente salud financiera)
- Máximo 3 insights
- Sé concreto, mencioná montos cuando sea relevante
- Adaptado a economía uruguaya (pesos y dólares)`
        }]
      })
    })

    const data = await response.json()
    let text = data.content[0].text
    text = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim()
    
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch[0])
    
    return res.status(200).json(parsed)
    
  } catch (error) {
    console.error('Summary error:', error)
    return res.status(500).json({ 
      error: error.message,
      headline: 'Error al generar análisis',
      score: 5,
      insights: [{ type: 'warn', title: 'Error', body: 'No se pudo conectar con el servicio de IA' }],
      advice: 'Intentá nuevamente en unos momentos'
    })
  }
}