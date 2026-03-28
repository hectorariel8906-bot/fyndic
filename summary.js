export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { transactions, budgets, period } = req.body
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

  const totalExpenses = transactions.filter(t => t.type === 'e').reduce((s, t) => s + t.amount, 0)
  const totalIncome = transactions.filter(t => t.type === 'i').reduce((s, t) => s + t.amount, 0)

  const categoryTotals = {}
  transactions.filter(t => t.type === 'e').forEach(t => {
    const key = t.parent_category || 'Otro'
    categoryTotals[key] = (categoryTotals[key] || 0) + t.amount
  })

  const prompt = `Sos un asesor financiero personal para un ingeniero civil uruguayo que usa la app Fyndic para gestionar sus finanzas en pareja.

Período: ${period || 'este mes'}
Ingresos totales: $${Math.round(totalIncome).toLocaleString('es-UY')} UYU
Gastos totales: $${Math.round(totalExpenses).toLocaleString('es-UY')} UYU
Ganancia neta: $${Math.round(totalIncome - totalExpenses).toLocaleString('es-UY')} UYU (${Math.round((totalIncome - totalExpenses) / totalIncome * 100)}%)

Gastos por categoría:
${Object.entries(categoryTotals).map(([cat, total]) => `- ${cat}: $${Math.round(total).toLocaleString('es-UY')}`).join('\n')}

${budgets ? `Presupuestos configurados:
${JSON.stringify(budgets, null, 2)}` : ''}

Generá un resumen semanal conciso en español rioplatense (vos, no tú). Devolvé SOLO JSON con esta estructura:
{
  "headline": "frase corta del estado financiero (máx 10 palabras)",
  "insights": [
    {
      "type": "warn|good|info",
      "title": "título corto",
      "body": "explicación concisa con números reales"
    }
  ],
  "advice": "consejo principal accionable para esta semana (1-2 oraciones)",
  "score": número del 1 al 10 de salud financiera
}

Máximo 4 insights. Usá números reales de los datos. Sé directo, no genérico.`

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const summary = JSON.parse(clean)

    return res.status(200).json(summary)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
